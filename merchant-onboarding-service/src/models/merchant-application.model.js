import { getPool } from '../config/database.js';

export class MerchantApplicationModel {
  /**
   * Create a new merchant application
   */
  static async createApplication(applicationData) {
    const pool = getPool();
    const {
      businessName,
      businessType,
      contactPerson,
      email,
      phone,
      businessAddress,
      businessLicense,
      taxId,
      instagramId,
      bankAccountDetails
    } = applicationData;

    // Until DB schema is relaxed, use placeholder user_id
    const placeholderUserId = '00000000-0000-0000-0000-000000000000';

    const result = await pool.query(
      `INSERT INTO merchant_applications (
        user_id, business_name, business_type, contact_person, email, phone,
        business_address, business_license, tax_id, instagram_id, bank_account_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        placeholderUserId, businessName, businessType, contactPerson, email.toLowerCase(),
        phone, JSON.stringify(businessAddress), businessLicense, taxId, instagramId, bankAccountDetails
      ]
    );

    return result.rows[0];
  }

  /**
   * Get application by ID
   */
  static async getApplicationById(applicationId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM merchant_applications WHERE id = $1',
      [applicationId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get application by user ID
   */
  static async getApplicationByUserId(userId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM merchant_applications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  /**
   * Get all applications with pagination
   */
  static async getAllApplications(limit = 50, offset = 0, status = null) {
    const pool = getPool();
    let query = 'SELECT * FROM merchant_applications';
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
   * Get pending applications (for admin review)
   */
  static async getPendingApplications(limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM merchant_applications 
       WHERE status = 'pending' 
       ORDER BY submitted_at ASC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * Update application status
   */
  static async updateApplicationStatus(applicationId, status, reviewedBy, rejectionReason = null, adminNotes = null) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE merchant_applications 
       SET status = $2, reviewed_by = $3, reviewed_at = NOW(), 
           rejection_reason = $4, admin_notes = $5, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [applicationId, status, reviewedBy, rejectionReason, adminNotes]
    );
    return result.rows[0] || null;
  }

  /**
   * Update application details (before approval)
   */
  static async updateApplication(applicationId, updateData) {
    const pool = getPool();
    const {
      businessName,
      businessType,
      contactPerson,
      email,
      phone,
      businessAddress,
      businessLicense,
      taxId,
      instagramId,
      bankAccountDetails
    } = updateData;

    const result = await pool.query(
      `UPDATE merchant_applications 
       SET business_name = $2, business_type = $3, contact_person = $4,
           email = $5, phone = $6, business_address = $7, business_license = $8,
           tax_id = $9, instagram_id = $10, bank_account_details = $11, updated_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [
        applicationId, businessName, businessType, contactPerson, email.toLowerCase(),
        phone, businessAddress ? JSON.stringify(businessAddress) : undefined, businessLicense, taxId, instagramId, bankAccountDetails
      ]
    );
    return result.rows[0] || null;
  }

  /**
   * Get application status history
   */
  static async getApplicationStatusHistory(applicationId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM application_status_history 
       WHERE application_id = $1 
       ORDER BY created_at DESC`,
      [applicationId]
    );
    return result.rows;
  }

  /**
   * Get applications by status
   */
  static async getApplicationsByStatus(status, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM merchant_applications 
       WHERE status = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get application statistics
   */
  static async getApplicationStats() {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         status,
         COUNT(*) as count,
         AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at))/3600) as avg_review_hours
       FROM merchant_applications 
       WHERE reviewed_at IS NOT NULL
       GROUP BY status`
    );
    return result.rows;
  }

  /**
   * Get applications requiring review (SLA check)
   */
  static async getApplicationsRequiringReview(slaHours = 48) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM merchant_applications 
       WHERE status = 'pending' 
       AND submitted_at < NOW() - INTERVAL '${slaHours} hours'
       ORDER BY submitted_at ASC`
    );
    return result.rows;
  }

  /**
   * Check if user has existing application
   */
  static async hasExistingApplication(userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM merchant_applications 
       WHERE user_id = $1 AND status IN ('pending', 'approved')`,
      [userId]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Check if application exists for email (pending or approved)
   */
  static async hasExistingApplicationByEmail(email) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM merchant_applications
       WHERE email = $1 AND status IN ('pending', 'approved')`,
      [email.toLowerCase()]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Get application count by user
   */
  static async getApplicationCountByUser(userId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM merchant_applications WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Delete application (only if pending)
   */
  static async deleteApplication(applicationId, userId) {
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM merchant_applications 
       WHERE id = $1 AND user_id = $2 AND status = 'pending' 
       RETURNING *`,
      [applicationId, userId]
    );
    return result.rows[0] || null;
  }
}
