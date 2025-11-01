import { getPool } from '../config/database.js';

export class WalletBalanceModel {
  /**
   * Get wallet balance by user ID
   */
  static async getBalanceByUserId(userId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM wallet_balances WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create wallet balance for user
   */
  static async createWalletBalance(userId) {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO wallet_balances (user_id) 
       VALUES ($1) RETURNING *`,
      [userId]
    );
    return result.rows[0];
  }

  /**
   * Update wallet balance
   */
  static async updateWalletBalance(userId, balanceData) {
    const pool = getPool();
    const {
      availableBalance,
      pendingBalance,
      totalEarned,
      totalRedeemed,
      totalExpired
    } = balanceData;

    const result = await pool.query(
      `UPDATE wallet_balances 
       SET available_balance = $2, pending_balance = $3, total_earned = $4,
           total_redeemed = $5, total_expired = $6, last_updated_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 RETURNING *`,
      [userId, availableBalance, pendingBalance, totalEarned, totalRedeemed, totalExpired]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all wallet balances with pagination
   */
  static async getAllWalletBalances(limit = 50, offset = 0, filters = {}) {
    const pool = getPool();
    let query = 'SELECT * FROM wallet_balances';
    let params = [];
    let paramCount = 0;
    const conditions = [];

    if (filters.minBalance) {
      paramCount++;
      conditions.push(`available_balance >= $${paramCount}`);
      params.push(filters.minBalance);
    }

    if (filters.maxBalance) {
      paramCount++;
      conditions.push(`available_balance <= $${paramCount}`);
      params.push(filters.maxBalance);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY last_updated_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get wallet balance statistics
   */
  static async getWalletBalanceStats() {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_wallets,
         SUM(available_balance) as total_available_balance,
         SUM(pending_balance) as total_pending_balance,
         SUM(total_earned) as total_earned_all_time,
         SUM(total_redeemed) as total_redeemed_all_time,
         SUM(total_expired) as total_expired_all_time,
         AVG(available_balance) as avg_available_balance,
         MAX(available_balance) as max_available_balance,
         MIN(available_balance) as min_available_balance
       FROM wallet_balances`
    );
    return result.rows[0] || null;
  }

  /**
   * Get top wallet balances
   */
  static async getTopWalletBalances(limit = 10) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM wallet_balances 
       ORDER BY available_balance DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Get wallet balances by range
   */
  static async getWalletBalancesByRange(minBalance, maxBalance, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM wallet_balances 
       WHERE available_balance BETWEEN $1 AND $2
       ORDER BY available_balance DESC 
       LIMIT $3 OFFSET $4`,
      [minBalance, maxBalance, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get wallet balances requiring attention (low balance, etc.)
   */
  static async getWalletBalancesRequiringAttention(threshold = 100) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM wallet_balances 
       WHERE available_balance <= $1
       ORDER BY available_balance ASC`,
      [threshold]
    );
    return result.rows;
  }

  /**
   * Get wallet balance history
   */
  static async getWalletBalanceHistory(userId, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM points_audit_log 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get wallet balance by date range
   */
  static async getWalletBalanceByDateRange(userId, startDate, endDate) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         SUM(points_amount) as daily_change,
         SUM(balance_after) as end_balance
       FROM points_audit_log 
       WHERE user_id = $1 
       AND created_at BETWEEN $2 AND $3
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId, startDate, endDate]
    );
    return result.rows;
  }

  /**
   * Get wallet balance summary
   */
  static async getWalletBalanceSummary(userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         wb.*,
         COUNT(pt.id) as total_transactions,
         SUM(CASE WHEN pt.amount > 0 THEN pt.amount ELSE 0 END) as total_earned,
         SUM(CASE WHEN pt.amount < 0 THEN ABS(pt.amount) ELSE 0 END) as total_redeemed,
         COUNT(CASE WHEN pt.status = 'available' THEN 1 END) as available_transactions,
         COUNT(CASE WHEN pt.status = 'pending' THEN 1 END) as pending_transactions,
         COUNT(CASE WHEN pt.status = 'expired' THEN 1 END) as expired_transactions
       FROM wallet_balances wb
       LEFT JOIN points_transactions pt ON wb.user_id = pt.user_id
       WHERE wb.user_id = $1
       GROUP BY wb.id`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get wallet balance trends
   */
  static async getWalletBalanceTrends(userId, days = 30) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         SUM(points_amount) as daily_change,
         SUM(SUM(points_amount)) OVER (ORDER BY DATE(created_at)) as cumulative_balance
       FROM points_audit_log 
       WHERE user_id = $1 
       AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get wallet balance by transaction type
   */
  static async getWalletBalanceByTransactionType(userId, transactionType) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         SUM(amount) as total_amount,
         COUNT(*) as transaction_count,
         AVG(amount) as avg_amount
       FROM points_transactions 
       WHERE user_id = $1 AND transaction_type = $2 AND status = 'available'`,
      [userId, transactionType]
    );
    return result.rows[0] || null;
  }

  /**
   * Get wallet balance comparison
   */
  static async getWalletBalanceComparison(userId, comparisonUserId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         user_id,
         available_balance,
         total_earned,
         total_redeemed,
         RANK() OVER (ORDER BY available_balance DESC) as balance_rank,
         RANK() OVER (ORDER BY total_earned DESC) as earned_rank
       FROM wallet_balances 
       WHERE user_id IN ($1, $2)
       ORDER BY available_balance DESC`,
      [userId, comparisonUserId]
    );
    return result.rows;
  }

  /**
   * Get wallet balance alerts
   */
  static async getWalletBalanceAlerts(userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         CASE 
           WHEN available_balance <= 100 THEN 'low_balance'
           WHEN available_balance >= 10000 THEN 'high_balance'
           ELSE 'normal'
         END as alert_type,
         available_balance,
         total_earned,
         total_redeemed
       FROM wallet_balances 
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update wallet balance from transaction
   */
  static async updateBalanceFromTransaction(userId, amount, transactionType) {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current balance
      const balanceResult = await client.query(
        'SELECT * FROM wallet_balances WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      
      if (balanceResult.rows.length === 0) {
        // Create wallet balance if it doesn't exist
        await client.query(
          'INSERT INTO wallet_balances (user_id, available_balance, total_earned, total_redeemed) VALUES ($1, $2, $3, $4)',
          [userId, amount, amount > 0 ? amount : 0, amount < 0 ? Math.abs(amount) : 0]
        );
      } else {
        const balance = balanceResult.rows[0];
        const newAvailableBalance = balance.available_balance;
        const newTotalEarned = balance.total_earned + (amount > 0 ? amount : 0);
        const newTotalRedeemed = balance.total_redeemed + (amount < 0 ? Math.abs(amount) : 0);
        
        // Update balance
        await client.query(
          `UPDATE wallet_balances 
           SET available_balance = $2, total_earned = $3, total_redeemed = $4,
               last_updated_at = NOW(), updated_at = NOW()
           WHERE user_id = $1`,
          [userId, newAvailableBalance, newTotalEarned, newTotalRedeemed]
        );
      }
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get wallet balance by user IDs
   */
  static async getWalletBalancesByUserIds(userIds) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM wallet_balances 
       WHERE user_id = ANY($1) 
       ORDER BY available_balance DESC`,
      [userIds]
    );
    return result.rows;
  }
}
