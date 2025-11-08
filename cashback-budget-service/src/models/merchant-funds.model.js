import { getPool } from '../config/database.js';

/**
 * Simplified merchant funds model
 * Reuses merchant_budgets table but with simpler logic
 */
export class MerchantFundsModel {
  /**
   * Get or create merchant funds
   */
  static async getOrCreateFunds(merchantId) {
    const pool = getPool();
    
    // Try to get existing funds
    let result = await pool.query(
      'SELECT * FROM merchant_budgets WHERE merchant_id = $1',
      [merchantId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // Create new funds record if doesn't exist
    result = await pool.query(
      `INSERT INTO merchant_budgets (merchant_id, current_balance, total_loaded, currency, cashback_percentage, status)
       VALUES ($1, 0.00, 0.00, 'AED', 5.00, 'active')
       RETURNING *`,
      [merchantId]
    );
    
    return result.rows[0];
  }

  /**
   * Get merchant funds
   */
  static async getFunds(merchantId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM merchant_budgets WHERE merchant_id = $1',
      [merchantId]
    );
    return result.rows[0] || null;
  }

  /**
   * Add funds to merchant account
   */
  static async addFunds(merchantId, amount, processedBy = null, description = 'Funds added') {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get or create funds
      const funds = await this.getOrCreateFunds(merchantId);
      
      const balanceBefore = parseFloat(funds.current_balance);
      const newBalance = balanceBefore + parseFloat(amount);
      const newTotalLoaded = parseFloat(funds.total_loaded) + parseFloat(amount);
      
      // Update funds
      await client.query(
        `UPDATE merchant_budgets 
         SET current_balance = $2, total_loaded = $3, updated_at = NOW()
         WHERE id = $1`,
        [funds.id, newBalance, newTotalLoaded]
      );
      
      // Create transaction record
      const transactionResult = await client.query(
        `INSERT INTO budget_transactions (
          merchant_id, budget_id, transaction_type, amount, 
          balance_before, balance_after, description, processed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          merchantId, funds.id, 'load', amount,
          balanceBefore, newBalance, description, processedBy
        ]
      );
      
      await client.query('COMMIT');
      return {
        funds: {
          id: funds.id,
          merchant_id: merchantId,
          current_balance: newBalance,
          total_loaded: newTotalLoaded
        },
        transaction: transactionResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if merchant has sufficient funds
   */
  static async hasSufficientFunds(merchantId, amount) {
    const funds = await this.getFunds(merchantId);
    if (!funds || funds.status !== 'active') {
      return false;
    }
    return parseFloat(funds.current_balance) >= parseFloat(amount);
  }

  /**
   * Deduct funds (for cashback payout)
   */
  static async deductFunds(merchantId, amount, processedBy = null, description = 'Cashback payout') {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get funds with lock
      const fundsResult = await client.query(
        'SELECT * FROM merchant_budgets WHERE merchant_id = $1 FOR UPDATE',
        [merchantId]
      );
      
      if (fundsResult.rows.length === 0) {
        throw new Error('Merchant funds not found');
      }
      
      const funds = fundsResult.rows[0];
      
      if (funds.status !== 'active') {
        throw new Error('Merchant funds are not active');
      }
      
      const balanceBefore = parseFloat(funds.current_balance);
      const amountToDeduct = parseFloat(amount);
      
      if (balanceBefore < amountToDeduct) {
        throw new Error('Insufficient funds');
      }
      
      const newBalance = balanceBefore - amountToDeduct;
      const newTotalSpent = parseFloat(funds.total_spent || 0) + amountToDeduct;
      
      // Update funds
      await client.query(
        `UPDATE merchant_budgets 
         SET current_balance = $2, total_spent = $3, updated_at = NOW()
         WHERE id = $1`,
        [funds.id, newBalance, newTotalSpent]
      );
      
      // Create transaction record
      const transactionResult = await client.query(
        `INSERT INTO budget_transactions (
          merchant_id, budget_id, transaction_type, amount, 
          balance_before, balance_after, description, processed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          merchantId, funds.id, 'cashback_payout', amount,
          balanceBefore, newBalance, description, processedBy
        ]
      );
      
      await client.query('COMMIT');
      return {
        funds: {
          id: funds.id,
          merchant_id: merchantId,
          current_balance: newBalance,
          total_spent: newTotalSpent
        },
        transaction: transactionResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update cashback percentage for merchant
   */
  static async updateCashbackPercentage(merchantId, percentage) {
    const pool = getPool();
    const funds = await this.getOrCreateFunds(merchantId);
    
    const result = await pool.query(
      `UPDATE merchant_budgets 
       SET cashback_percentage = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [funds.id, percentage]
    );
    
    return result.rows[0];
  }
}

