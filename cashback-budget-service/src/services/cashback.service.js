import { BudgetModel } from '../models/budget.model.js';
import { CampaignModel } from '../models/campaign.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { getConfig } from '../config/index.js';

export class CashbackService {
  /**
   * Process cashback for a transaction
   */
  static async processCashback(transactionData) {
    const {
      merchantId,
      customerId,
      originalTransactionId,
      transactionAmount,
      campaignId = null
    } = transactionData;

    // Check if transaction already processed
    const existingTransaction = await TransactionModel.getTransactionByOriginalId(originalTransactionId);
    if (existingTransaction) {
      throw new Error('Transaction already processed');
    }

    // Verify user is approved and not suspended before processing cashback
    const { getPool } = await import('../config/database.js');
    const pool = getPool();
    
    const userResult = await pool.query(
      'SELECT is_approved, status FROM users WHERE id = $1',
      [customerId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];
    const isApproved = user.is_approved || false;
    const userStatus = user.status || 'active';

    if (!isApproved) {
      throw new Error('User is not approved to receive cashback');
    }

    if (userStatus === 'suspended') {
      throw new Error('User is suspended and cannot receive cashback');
    }

    // Get merchant budget
    const budget = await BudgetModel.getBudgetByMerchantId(merchantId);
    if (!budget) {
      throw new Error('Merchant budget not found');
    }

    if (budget.status !== 'active') {
      throw new Error('Merchant budget is not active');
    }

    // Get active campaign
    let campaign;
    if (campaignId) {
      campaign = await CampaignModel.getCampaignById(campaignId);
    } else {
      const activeCampaigns = await CampaignModel.getActiveCampaignsByMerchantId(merchantId);
      if (activeCampaigns.length === 0) {
        throw new Error('No active campaign found for merchant');
      }
      campaign = activeCampaigns[0]; // Use first active campaign
    }

    if (!campaign || campaign.status !== 'active') {
      throw new Error('No active campaign found');
    }

    // Check if campaign is within date range
    const now = new Date();
    if (now < new Date(campaign.start_date) || now > new Date(campaign.end_date)) {
      throw new Error('Campaign is not active at this time');
    }

    // Calculate cashback amount
    const cashbackAmount = (transactionAmount * campaign.cashback_percentage) / 100;
    
    // Check if budget has sufficient balance
    const hasBalance = await BudgetModel.hasSufficientBalance(budget.id, cashbackAmount);
    if (!hasBalance) {
      throw new Error('Insufficient budget balance');
    }

    // Create cashback transaction
    const cashbackTransaction = await TransactionModel.createTransaction({
      merchantId,
      campaignId: campaign.id,
      customerId,
      originalTransactionId,
      cashbackAmount,
      cashbackPercentage: campaign.cashback_percentage
    });

    // Deduct from budget
    await BudgetModel.deductBudget(
      budget.id,
      cashbackAmount,
      'system', // processed by system
      `Cashback for transaction ${originalTransactionId}`
    );

    // Update transaction status to processed
    await TransactionModel.updateTransactionStatus(cashbackTransaction.id, 'processed');

    return {
      ...cashbackTransaction,
      status: 'processed'
    };
  }

  /**
   * Calculate cashback amount for a transaction
   */
  static async calculateCashback(merchantId, transactionAmount, campaignId = null) {
    // Get active campaign
    let campaign;
    if (campaignId) {
      campaign = await CampaignModel.getCampaignById(campaignId);
    } else {
      const activeCampaigns = await CampaignModel.getActiveCampaignsByMerchantId(merchantId);
      if (activeCampaigns.length === 0) {
        return { cashbackAmount: 0, campaign: null };
      }
      campaign = activeCampaigns[0];
    }

    if (!campaign || campaign.status !== 'active') {
      return { cashbackAmount: 0, campaign: null };
    }

    // Check if campaign is within date range
    const now = new Date();
    if (now < new Date(campaign.start_date) || now > new Date(campaign.end_date)) {
      return { cashbackAmount: 0, campaign: null };
    }

    const cashbackAmount = (transactionAmount * campaign.cashback_percentage) / 100;
    
    return {
      cashbackAmount,
      campaign: {
        id: campaign.id,
        name: campaign.campaign_name,
        percentage: campaign.cashback_percentage
      }
    };
  }

  /**
   * Get merchant cashback summary
   */
  static async getMerchantCashbackSummary(merchantId, startDate = null, endDate = null) {
    const [budgetStats, campaignStats, transactionStats] = await Promise.all([
      BudgetModel.getBudgetStats(merchantId),
      CampaignModel.getMerchantCampaignStats(merchantId),
      TransactionModel.getTransactionStats(merchantId, startDate, endDate)
    ]);

    return {
      budget: budgetStats,
      campaigns: campaignStats,
      transactions: transactionStats
    };
  }

  /**
   * Get customer cashback history
   */
  static async getCustomerCashbackHistory(customerId, merchantId = null, limit = 50, offset = 0) {
    return await TransactionModel.getCustomerTransactionHistory(customerId, merchantId, limit, offset);
  }

  /**
   * Get cashback analytics
   */
  static async getCashbackAnalytics(merchantId, startDate, endDate) {
    const [dailySummary, hourlyVolume, topCustomers] = await Promise.all([
      TransactionModel.getDailyTransactionSummary(merchantId, startDate, endDate),
      TransactionModel.getTransactionVolumeByHour(merchantId, startDate, endDate),
      TransactionModel.getTopCustomersByCashback(merchantId, 10)
    ]);

    return {
      dailySummary,
      hourlyVolume,
      topCustomers
    };
  }

  /**
   * Process batch cashback transactions
   */
  static async processBatchCashback(transactions) {
    const results = [];
    const errors = [];

    for (const transaction of transactions) {
      try {
        const result = await this.processCashback(transaction);
        results.push(result);
      } catch (error) {
        errors.push({
          transaction,
          error: error.message
        });
      }
    }

    return {
      processed: results,
      errors,
      summary: {
        total: transactions.length,
        successful: results.length,
        failed: errors.length
      }
    };
  }

  /**
   * Retry failed cashback transactions
   */
  static async retryFailedTransactions(transactionIds) {
    const results = [];
    const errors = [];

    for (const transactionId of transactionIds) {
      try {
        const transaction = await TransactionModel.getTransactionById(transactionId);
        if (!transaction) {
          errors.push({ transactionId, error: 'Transaction not found' });
          continue;
        }

        if (transaction.status !== 'failed') {
          errors.push({ transactionId, error: 'Transaction is not in failed status' });
          continue;
        }

        // Reset to pending status
        await TransactionModel.retryFailedTransaction(transactionId);
        
        // Retry processing
        const result = await this.processCashback({
          merchantId: transaction.merchant_id,
          customerId: transaction.customer_id,
          originalTransactionId: transaction.original_transaction_id,
          transactionAmount: transaction.cashback_amount / (transaction.cashback_percentage / 100),
          campaignId: transaction.campaign_id
        });

        results.push(result);
      } catch (error) {
        errors.push({
          transactionId,
          error: error.message
        });
      }
    }

    return {
      retried: results,
      errors,
      summary: {
        total: transactionIds.length,
        successful: results.length,
        failed: errors.length
      }
    };
  }

  /**
   * Get cashback eligibility for a transaction
   */
  static async checkCashbackEligibility(merchantId, customerId, transactionAmount) {
    try {
      // Check if merchant has active budget
      const budget = await BudgetModel.getBudgetByMerchantId(merchantId);
      if (!budget || budget.status !== 'active') {
        return { eligible: false, reason: 'Merchant budget not active' };
      }

      // Check if merchant has active campaign
      const activeCampaigns = await CampaignModel.getActiveCampaignsByMerchantId(merchantId);
      if (activeCampaigns.length === 0) {
        return { eligible: false, reason: 'No active campaign' };
      }

      const campaign = activeCampaigns[0];
      
      // Check campaign date range
      const now = new Date();
      if (now < new Date(campaign.start_date) || now > new Date(campaign.end_date)) {
        return { eligible: false, reason: 'Campaign not active at this time' };
      }

      // Calculate potential cashback
      const cashbackAmount = (transactionAmount * campaign.cashback_percentage) / 100;
      
      // Check if budget has sufficient balance
      const hasBalance = await BudgetModel.hasSufficientBalance(budget.id, cashbackAmount);
      if (!hasBalance) {
        return { eligible: false, reason: 'Insufficient budget balance' };
      }

      return {
        eligible: true,
        cashbackAmount,
        campaign: {
          id: campaign.id,
          name: campaign.campaign_name,
          percentage: campaign.cashback_percentage
        }
      };
    } catch (error) {
      return { eligible: false, reason: error.message };
    }
  }

  /**
   * Get cashback configuration for merchant
   */
  static async getCashbackConfiguration(merchantId) {
    const [budget, activeCampaigns] = await Promise.all([
      BudgetModel.getBudgetByMerchantId(merchantId),
      CampaignModel.getActiveCampaignsByMerchantId(merchantId)
    ]);

    return {
      budget: budget ? {
        id: budget.id,
        currentBalance: budget.current_balance,
        totalLoaded: budget.total_loaded,
        totalSpent: budget.total_spent,
        status: budget.status,
        utilizationPercentage: budget.total_loaded > 0 ? 
          (budget.total_spent / budget.total_loaded) * 100 : 0
      } : null,
      activeCampaigns: activeCampaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.campaign_name,
        percentage: campaign.cashback_percentage,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
        autoStopThreshold: campaign.auto_stop_threshold,
        alertThreshold: campaign.alert_threshold
      }))
    };
  }
}
