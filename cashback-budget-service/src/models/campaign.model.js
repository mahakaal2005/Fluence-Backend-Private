import { getPool } from '../config/database.js';

export class CampaignModel {
  /**
   * Create a new cashback campaign
   */
  static async createCampaign(campaignData) {
    const pool = getPool();
    const {
      merchantId,
      campaignName,
      cashbackPercentage,
      startDate,
      endDate,
      autoStopThreshold = 50.00,
      alertThreshold = 60.00
    } = campaignData;

    const result = await pool.query(
      `INSERT INTO cashback_campaigns (
        merchant_id, campaign_name, cashback_percentage, start_date, end_date,
        auto_stop_threshold, alert_threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        merchantId, campaignName, cashbackPercentage, startDate, endDate,
        autoStopThreshold, alertThreshold
      ]
    );
    return result.rows[0];
  }

  /**
   * Get campaign by ID
   */
  static async getCampaignById(campaignId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM cashback_campaigns WHERE id = $1',
      [campaignId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get campaigns by merchant ID
   */
  static async getCampaignsByMerchantId(merchantId, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM cashback_campaigns 
       WHERE merchant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [merchantId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get active campaigns by merchant ID
   */
  static async getActiveCampaignsByMerchantId(merchantId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM cashback_campaigns 
       WHERE merchant_id = $1 
       AND status = 'active' 
       AND start_date <= NOW() 
       AND end_date >= NOW()
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  /**
   * Get all campaigns with pagination
   */
  static async getAllCampaigns(limit = 50, offset = 0, status = null) {
    const pool = getPool();
    let query = 'SELECT * FROM cashback_campaigns';
    let params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` WHERE status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Update campaign
   */
  static async updateCampaign(campaignId, updateData) {
    const pool = getPool();
    // Load existing to support partial updates without nulling required fields
    const existing = await CampaignModel.getCampaignById(campaignId);
    if (!existing) return null;

    const campaignName = updateData.name ?? updateData.campaignName ?? existing.campaign_name;
    const cashbackPercentage = updateData.cashbackPercentage ?? existing.cashback_percentage;
    const startDate = updateData.startDate ?? existing.start_date;
    const endDate = updateData.endDate ?? existing.end_date;
    const autoStopThreshold = updateData.autoStopThreshold ?? existing.auto_stop_threshold;
    const alertThreshold = updateData.alertThreshold ?? existing.alert_threshold;

    const result = await pool.query(
      `UPDATE cashback_campaigns 
       SET campaign_name = $2, cashback_percentage = $3, start_date = $4,
           end_date = $5, auto_stop_threshold = $6, alert_threshold = $7,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        campaignId, campaignName, cashbackPercentage, startDate, endDate,
        autoStopThreshold, alertThreshold
      ]
    );
    return result.rows[0] || null;
  }

  /**
   * Update campaign status
   */
  static async updateCampaignStatus(campaignId, status) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE cashback_campaigns 
       SET status = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [campaignId, status]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete campaign (only if no transactions)
   */
  static async deleteCampaign(campaignId) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if campaign has transactions
      const transactionCheck = await client.query(
        'SELECT COUNT(*) as count FROM cashback_transactions WHERE campaign_id = $1',
        [campaignId]
      );

      if (parseInt(transactionCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete campaign with existing transactions');
      }

      // Delete campaign
      const result = await client.query(
        'DELETE FROM cashback_campaigns WHERE id = $1 RETURNING *',
        [campaignId]
      );

      await client.query('COMMIT');
      return result.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get campaign statistics
   */
  static async getCampaignStats(campaignId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         cc.*,
         COUNT(ct.id) as total_transactions,
         SUM(ct.cashback_amount) as total_cashback_paid,
         AVG(ct.cashback_amount) as avg_cashback_amount,
         COUNT(CASE WHEN ct.status = 'processed' THEN 1 END) as processed_transactions,
         COUNT(CASE WHEN ct.status = 'pending' THEN 1 END) as pending_transactions,
         COUNT(CASE WHEN ct.status = 'failed' THEN 1 END) as failed_transactions
       FROM cashback_campaigns cc
       LEFT JOIN cashback_transactions ct ON cc.id = ct.campaign_id
       WHERE cc.id = $1
       GROUP BY cc.id`,
      [campaignId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get merchant campaign statistics
   */
  static async getMerchantCampaignStats(merchantId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_campaigns,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_campaigns,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_campaigns,
         COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_campaigns,
         SUM(CASE WHEN status = 'active' THEN cashback_percentage ELSE 0 END) as total_active_percentage
       FROM cashback_campaigns 
       WHERE merchant_id = $1`,
      [merchantId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get campaigns ending soon
   */
  static async getCampaignsEndingSoon(days = 7) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM cashback_campaigns 
       WHERE status = 'active' 
       AND end_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
       ORDER BY end_date ASC`
    );
    return result.rows;
  }

  /**
   * Get expired campaigns
   */
  static async getExpiredCampaigns() {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM cashback_campaigns 
       WHERE status = 'active' 
       AND end_date < NOW()
       ORDER BY end_date ASC`
    );
    return result.rows;
  }

  /**
   * Auto-complete expired campaigns
   */
  static async autoCompleteExpiredCampaigns() {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE cashback_campaigns 
       SET status = 'completed', updated_at = NOW()
       WHERE status = 'active' 
       AND end_date < NOW()
       RETURNING *`
    );
    return result.rows;
  }

  /**
   * Get campaign performance metrics
   */
  static async getCampaignPerformance(campaignId, startDate, endDate) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         DATE(ct.created_at) as date,
         COUNT(*) as transaction_count,
         SUM(ct.cashback_amount) as total_cashback,
         AVG(ct.cashback_amount) as avg_cashback
       FROM cashback_transactions ct
       WHERE ct.campaign_id = $1
       AND ct.created_at BETWEEN $2 AND $3
       GROUP BY DATE(ct.created_at)
       ORDER BY date ASC`,
      [startDate, endDate]
    );
    return result.rows;
  }

  /**
   * Check if merchant can create new campaign
   */
  static async canCreateCampaign(merchantId, maxActiveCampaigns = 5) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM cashback_campaigns 
       WHERE merchant_id = $1 AND status = 'active'`,
      [merchantId]
    );
    return parseInt(result.rows[0].count) < maxActiveCampaigns;
  }

  /**
   * Get campaign by merchant and name
   */
  static async getCampaignByMerchantAndName(merchantId, campaignName) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM cashback_campaigns WHERE merchant_id = $1 AND campaign_name = $2',
      [merchantId, campaignName]
    );
    return result.rows[0] || null;
  }

  /**
   * Search campaigns
   */
  static async searchCampaigns(searchTerm, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM cashback_campaigns 
       WHERE campaign_name ILIKE $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, limit, offset]
    );
    return result.rows;
  }

  // Aliases for controller compatibility
  static async findById(id) {
    return this.getCampaignById(id);
  }

  static async update(id, updateData) {
    return this.updateCampaign(id, updateData);
  }
}
