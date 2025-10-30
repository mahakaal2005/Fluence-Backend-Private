import { getPool } from '../config/database.js';

export class MerchantProfileModel {
  /**
   * Get merchant profile by ID
   */
  static async getProfileById(profileId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM merchant_profiles WHERE id = $1',
      [profileId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get merchant profile by user ID
   */
  static async getProfileByUserId(userId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM merchant_profiles WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all merchant profiles with pagination
   */
  static async getAllProfiles(limit = 50, offset = 0, status = null) {
    const pool = getPool();
    let query = 'SELECT * FROM merchant_profiles';
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
   * Update merchant profile
   */
  static async updateProfile(profileId, updateData) {
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
      bankAccountDetails
    } = updateData;

    const result = await pool.query(
      `UPDATE merchant_profiles 
       SET business_name = $2, business_type = $3, contact_person = $4,
           email = $5, phone = $6, business_address = $7, business_license = $8,
           tax_id = $9, bank_account_details = $10, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        profileId, businessName, businessType, contactPerson, email.toLowerCase(),
        phone, businessAddress, businessLicense, taxId, bankAccountDetails
      ]
    );
    return result.rows[0] || null;
  }

  /**
   * Create merchant profile from approved application
   */
  static async createProfileFromApplication(application) {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO merchant_profiles (
        user_id, application_id, business_name, business_type, contact_person,
        email, phone, business_address, business_license, tax_id,
        bank_account_details, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        application.user_id,
        application.id,
        application.business_name,
        application.business_type,
        application.contact_person,
        application.email.toLowerCase(),
        application.phone,
        application.business_address,
        application.business_license,
        application.tax_id,
        application.bank_account_details,
        'active' // New profiles start as active
      ]
    );
    return result.rows[0] || null;
  }

  /**
   * Update merchant profile status
   */
  static async updateProfileStatus(profileId, status, updatedBy = null) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE merchant_profiles 
       SET status = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [profileId, status]
    );
    return result.rows[0] || null;
  }

  /**
   * Get merchant profile with application details
   */
  static async getProfileWithApplication(profileId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         mp.*,
         ma.business_license as original_business_license,
         ma.tax_id as original_tax_id,
         ma.bank_account_details as original_bank_details,
         ma.submitted_at,
         ma.reviewed_at,
         ma.reviewed_by
       FROM merchant_profiles mp
       LEFT JOIN merchant_applications ma ON mp.application_id = ma.id
       WHERE mp.id = $1`,
      [profileId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get merchant profile by application ID
   */
  static async getProfileByApplicationId(applicationId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM merchant_profiles WHERE application_id = $1',
      [applicationId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get active merchant profiles
   */
  static async getActiveProfiles(limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM merchant_profiles 
       WHERE status = 'active' 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * Get merchant profile statistics
   */
  static async getProfileStats() {
    const pool = getPool();

    // Get aggregated stats
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_profiles,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_profiles,
         COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_profiles,
         COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_profiles
       FROM merchant_profiles`
    );

    // Get business type breakdown
    const typeResult = await pool.query(
      `SELECT 
         business_type,
         COUNT(*) as count
       FROM merchant_profiles 
       GROUP BY business_type
       ORDER BY count DESC`
    );

    return {
      ...statsResult.rows[0],
      business_types: typeResult.rows
    };
  }

  /**
   * Search merchant profiles
   */
  static async searchProfiles(searchTerm, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM merchant_profiles 
       WHERE business_name ILIKE $1 
       OR contact_person ILIKE $1 
       OR email ILIKE $1
       ORDER BY business_name ASC 
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get merchant profiles by business type
   */
  static async getProfilesByBusinessType(businessType, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM merchant_profiles 
       WHERE business_type = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [businessType, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get merchant profile count by status
   */
  static async getProfileCountByStatus() {
    const pool = getPool();
    const result = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM merchant_profiles 
       GROUP BY status`
    );
    return result.rows;
  }

  /**
   * Check if merchant profile exists for user
   */
  static async hasProfile(userId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM merchant_profiles WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Get merchant profile with recent activity
   */
  static async getProfileWithActivity(profileId, days = 30) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         mp.*,
         COUNT(ma.id) as total_applications,
         MAX(ma.submitted_at) as last_application_date
       FROM merchant_profiles mp
       LEFT JOIN merchant_applications ma ON mp.user_id = ma.user_id
       WHERE mp.id = $1
       GROUP BY mp.id`,
      [profileId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find merchant profile by email
   */
  static async findByEmail(email) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM merchant_profiles WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Set merchant password hash and mark password_set_at
   */
  static async setPassword(profileId, passwordHash) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE merchant_profiles
       SET password_hash = $2,
           password_set_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [profileId, passwordHash]
    );
    return result.rows[0] || null;
  }

  /**
   * Set OTP code and expiry for a merchant profile by email
   */
  static async setOtpByEmail(email, otpCode, expiresAt, resetAttempts = false) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE merchant_profiles
       SET otp_code = $2,
           otp_expires_at = $3,
           otp_attempts = CASE WHEN $4 THEN 0 ELSE otp_attempts END,
           updated_at = NOW()
       WHERE email = $1
       RETURNING *`,
      [email.toLowerCase(), otpCode, expiresAt, resetAttempts]
    );
    return result.rows[0] || null;
  }

  /**
   * Verify OTP for email; increments attempts and clears on success
   */
  static async verifyOtp(email, otpCode) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, otp_code, otp_expires_at, otp_attempts
       FROM merchant_profiles WHERE email = $1`,
      [email.toLowerCase()]
    );
    const profile = rows[0];
    if (!profile) return { ok: false, reason: 'not_found' };

    const now = new Date();
    const expired = !profile.otp_expires_at || now > new Date(profile.otp_expires_at);
    const match = profile.otp_code && otpCode && profile.otp_code === otpCode;

    if (expired || !match) {
      await pool.query(
        `UPDATE merchant_profiles
         SET otp_attempts = COALESCE(otp_attempts, 0) + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [profile.id]
      );
      return { ok: false, reason: expired ? 'expired' : 'mismatch' };
    }

    await pool.query(
      `UPDATE merchant_profiles
       SET otp_code = NULL,
           otp_expires_at = NULL,
           otp_attempts = 0,
           updated_at = NOW()
       WHERE id = $1`,
      [profile.id]
    );
    return { ok: true, profileId: profile.id };
  }

  /**
   * Record successful login timestamp
   */
  static async recordLogin(profileId) {
    const pool = getPool();
    await pool.query(
      `UPDATE merchant_profiles
       SET last_login_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [profileId]
    );
  }
}
