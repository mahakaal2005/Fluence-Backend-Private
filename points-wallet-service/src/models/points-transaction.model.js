import { getPool } from '../config/database.js';

export class PointsTransactionModel {
  /**
   * Create a new points transaction
   */
  static async createTransaction(transactionData) {
    const pool = getPool();
    const {
      userId,
      amount,
      transactionType,
      description,
      referenceId,
      socialPostRequired = true,
      timeBufferEndsAt = null,
      expiresAt = null
    } = transactionData;

    const result = await pool.query(
      `INSERT INTO points_transactions (
        user_id, amount, transaction_type, description, reference_id,
        social_post_required, time_buffer_ends_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        userId, amount, transactionType, description, referenceId,
        socialPostRequired, timeBufferEndsAt, expiresAt
      ]
    );
    return result.rows[0];
  }

  /**
   * Get transaction by ID
   */
  static async getTransactionById(transactionId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM points_transactions WHERE id = $1',
      [transactionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get transactions by user ID
   */
  static async getTransactionsByUserId(userId, limit = 50, offset = 0, filters = {}) {
    const pool = getPool();
    let query = 'SELECT * FROM points_transactions WHERE user_id = $1';
    let params = [userId];
    let paramCount = 1;

    if (filters.transactionType) {
      paramCount++;
      query += ` AND transaction_type = $${paramCount}`;
      params.push(filters.transactionType);
    }

    if (filters.status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Update transaction status
   */
  static async updateTransactionStatus(transactionId, status, processedAt = null) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE points_transactions 
       SET status = $2, processed_at = $3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [transactionId, status, processedAt || new Date()]
    );
    return result.rows[0] || null;
  }

  /**
   * Update social post status
   */
  static async updateSocialPostStatus(transactionId, socialPostMade, socialPostUrl = null, socialPostVerified = false) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE points_transactions 
       SET social_post_made = $2, social_post_url = $3, social_post_verified = $4, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [transactionId, socialPostMade, socialPostUrl, socialPostVerified]
    );
    return result.rows[0] || null;
  }

  /**
   * Get transactions requiring social posts
   */
  static async getTransactionsRequiringSocialPosts(userId, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM points_transactions 
       WHERE user_id = $1 
       AND social_post_required = true 
       AND social_post_made = false 
       AND status = 'pending'
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get transactions in time buffer
   */
  static async getTransactionsInTimeBuffer(userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM points_transactions 
       WHERE user_id = $1 
       AND time_buffer_ends_at IS NOT NULL 
       AND time_buffer_ends_at > NOW() 
       AND status = 'pending'
       ORDER BY time_buffer_ends_at ASC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get transactions by reference ID
   */
  static async getTransactionsByReferenceId(id) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM points_transactions WHERE reference_id = $1 ORDER BY created_at DESC',
      [id]
    );
    return result.rows;
  }

  /**
   * Get transaction statistics
   */
  static async getTransactionStats(userId, startDate = null, endDate = null) {
    const pool = getPool();
    let query = `
      SELECT 
        transaction_type,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count
      FROM points_transactions 
      WHERE user_id = $1
    `;
    const params = [userId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
    }

    query += ' GROUP BY transaction_type ORDER BY transaction_type';

    const result = await pool.query(query, params);

    // Transform array to object with aggregated stats
    const stats = {
      total_transactions: 0,
      total_earned: 0,
      total_redeemed: 0,
      earn_count: 0,
      redeem_count: 0,
      available_count: 0,
      pending_count: 0,
      expired_count: 0,
      by_type: result.rows
    };

    result.rows.forEach(row => {
      stats.total_transactions += parseInt(row.count) || 0;
      if (row.transaction_type === 'earn') {
        stats.total_earned = parseFloat(row.total_amount) || 0;
        stats.earn_count = parseInt(row.count) || 0;
      } else if (row.transaction_type === 'redeem') {
        stats.total_redeemed = parseFloat(row.total_amount) || 0;
        stats.redeem_count = parseInt(row.count) || 0;
      }
      stats.available_count += parseInt(row.available_count) || 0;
      stats.pending_count += parseInt(row.pending_count) || 0;
      stats.expired_count += parseInt(row.expired_count) || 0;
    });

    return stats;
  }

  /**
   * Get daily transaction summary
   */
  static async getDailyTransactionSummary(userId, startDate, endDate) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as transaction_count,
         SUM(amount) as total_points,
         AVG(amount) as avg_points,
         COUNT(CASE WHEN amount > 0 THEN 1 END) as earnings_count,
         COUNT(CASE WHEN amount < 0 THEN 1 END) as redemptions_count
       FROM points_transactions 
       WHERE user_id = $1 
       AND created_at BETWEEN $2 AND $3
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId, startDate, endDate]
    );
    return result.rows;
  }

  /**
   * Get transactions by type
   */
  static async getTransactionsByType(transactionType, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM points_transactions 
       WHERE transaction_type = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [transactionType, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get transactions by status
   */
  static async getTransactionsByStatus(status, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM points_transactions 
       WHERE status = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get expired transactions
   */
  static async getExpiredTransactions() {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM points_transactions 
       WHERE expires_at IS NOT NULL 
       AND expires_at < NOW() 
       AND status = 'available'
       ORDER BY expires_at ASC`
    );
    return result.rows;
  }

  /**
   * Mark transactions as expired
   */
  static async markTransactionsAsExpired(transactionIds) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE points_transactions 
       SET status = 'expired', updated_at = NOW()
       WHERE id = ANY($1) RETURNING *`,
      [transactionIds]
    );
    return result.rows;
  }

  /**
   * Get transactions expiring soon
   */
  static async getTransactionsExpiringSoon(days = 7) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM points_transactions 
       WHERE expires_at IS NOT NULL 
       AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
       AND status = 'available'
       ORDER BY expires_at ASC`
    );
    return result.rows;
  }

  /**
   * Get total points earned by user
   */
  static async getTotalPointsEarned(userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT SUM(amount) as total_earned 
       FROM points_transactions 
       WHERE user_id = $1 AND amount > 0 AND status = 'available'`,
      [userId]
    );
    return result.rows[0]?.total_earned || 0;
  }

  /**
   * Get total points redeemed by user
   */
  static async getTotalPointsRedeemed(userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT SUM(ABS(amount)) as total_redeemed 
       FROM points_transactions 
       WHERE user_id = $1 AND amount < 0 AND status = 'available'`,
      [userId]
    );
    return result.rows[0]?.total_redeemed || 0;
  }

  /**
   * Check if user has sufficient points
   */
  static async hasSufficientPoints(userId, requiredAmount) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT available_balance FROM wallet_balances WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].available_balance >= requiredAmount;
  }

  /**
   * Delete transaction (only if pending)
   */
  static async deleteTransaction(transactionId, userId) {
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM points_transactions 
       WHERE id = $1 AND user_id = $2 AND status = 'pending' 
       RETURNING *`,
      [transactionId, userId]
    );
    return result.rows[0] || null;
  }
}
