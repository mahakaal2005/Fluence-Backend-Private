import { PointsTransactionModel } from '../models/points-transaction.model.js';
import { WalletBalanceModel } from '../models/wallet-balance.model.js';
import { NotificationClient } from './notification.client.js';

export class PointsService {
  /**
   * Award points to user
   */
  static async awardPoints(userId, amount, transactionType, description, referenceId, socialPostRequired = false) {
    const transaction = await PointsTransactionModel.createTransaction({
      userId,
      amount,
      transactionType,
      description,
      referenceId,
      socialPostRequired
    });

    // Send notification for points earned
    try {
      if (amount > 0) {
        await NotificationClient.sendPointsAvailableNotification(userId, amount, description);
        
        // If social post is required, send a reminder
        if (socialPostRequired) {
          await NotificationClient.sendSocialPostReminder(userId, transaction.id, description);
        }
      }
    } catch (error) {
      // Log error but don't fail the transaction
      console.error('Failed to send notification for points award:', error.message);
    }

    return transaction;
  }

  /**
   * Redeem points from user
   */
  static async redeemPoints(userId, amount, description, referenceId) {
    // Check if user has sufficient balance
    const hasBalance = await PointsTransactionModel.hasSufficientBalance(userId, amount);
    if (!hasBalance) {
      throw new Error('Insufficient balance');
    }

    const transaction = await PointsTransactionModel.createTransaction({
      userId,
      amount: -amount, // Negative amount for redemption
      transactionType: 'redemption',
      description,
      referenceId
    });

    // Send notification for points redeemed
    try {
      await NotificationClient.sendPointsRedeemedNotification(userId, amount, description);
    } catch (error) {
      // Log error but don't fail the transaction
      console.error('Failed to send notification for points redemption:', error.message);
    }

    return transaction;
  }

  /**
   * Get wallet information
   */
  static async getWalletInfo(userId) {
    let balance = await WalletBalanceModel.getBalanceByUserId(userId);
    
    if (!balance) {
      balance = await WalletBalanceModel.createWalletBalance(userId);
    }

    return {
      userId: balance.user_id,
      availableBalance: balance.available_balance,
      pendingBalance: balance.pending_balance,
      totalEarned: balance.total_earned,
      totalRedeemed: balance.total_redeemed,
      totalExpired: balance.total_expired,
      lastUpdated: balance.last_updated_at
    };
  }

  /**
   * Submit social media post
   */
  static async submitSocialPost(userId, transactionId, socialPostUrl) {
    const transaction = await PointsTransactionModel.updateSocialPostStatus(
      transactionId,
      true,
      socialPostUrl,
      false // Not verified yet
    );

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(userId, limit = 50, offset = 0) {
    return await PointsTransactionModel.getTransactionsByUserId(userId, limit, offset);
  }

  /**
   * Get notification settings
   */
  static async getNotificationSettings(userId) {
    // This would return user's notification preferences
    // For now, return default settings
    return {
      userId,
      socialPostReminders: true,
      pointsAvailable: true,
      pointsExpiring: true
    };
  }

  /**
   * Update notification settings
   */
  static async updateNotificationSettings(userId, settings) {
    // This would update user's notification preferences
    // For now, return the settings
    return {
      userId,
      ...settings,
      updatedAt: new Date()
    };
  }

  /**
   * Verify social media post
   */
  static async verifySocialPost(transactionId, verified = true) {
    const transaction = await PointsTransactionModel.updateSocialPostStatus(
      transactionId,
      true,
      null,
      verified
    );

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  /**
   * Get transactions requiring social posts
   */
  static async getTransactionsRequiringSocialPosts(userId, limit = 50, offset = 0) {
    return await PointsTransactionModel.getTransactionsRequiringSocialPosts(userId, limit, offset);
  }

  /**
   * Get transactions in time buffer
   */
  static async getTransactionsInTimeBuffer(userId) {
    return await PointsTransactionModel.getTransactionsInTimeBuffer(userId);
  }

  /**
   * Get transaction statistics
   */
  static async getTransactionStats(userId, startDate = null, endDate = null) {
    return await PointsTransactionModel.getTransactionStats(userId, startDate, endDate);
  }

  /**
   * Get daily transaction summary
   */
  static async getDailyTransactionSummary(userId, startDate, endDate) {
    return await PointsTransactionModel.getDailyTransactionSummary(userId, startDate, endDate);
  }

  /**
   * Get total points earned
   */
  static async getTotalPointsEarned(userId) {
    return await PointsTransactionModel.getTotalPointsEarned(userId);
  }

  /**
   * Get total points redeemed
   */
  static async getTotalPointsRedeemed(userId) {
    return await PointsTransactionModel.getTotalPointsRedeemed(userId);
  }
}
