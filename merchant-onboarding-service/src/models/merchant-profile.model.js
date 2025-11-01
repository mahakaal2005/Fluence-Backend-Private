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
      bankAccountDetails,
      profileImageUrl
    } = updateData;

    // Build dynamic update query based on provided fields
    const updates = [];
    const params = [profileId];
    let paramCount = 1;

    if (businessName !== undefined) {
      paramCount++;
      updates.push(`business_name = $${paramCount}`);
      params.push(businessName);
    }
    if (businessType !== undefined) {
      paramCount++;
      updates.push(`business_type = $${paramCount}`);
      params.push(businessType);
    }
    if (contactPerson !== undefined) {
      paramCount++;
      updates.push(`contact_person = $${paramCount}`);
      params.push(contactPerson);
    }
    if (email !== undefined) {
      paramCount++;
      updates.push(`email = $${paramCount}`);
      params.push(email.toLowerCase());
    }
    if (phone !== undefined) {
      paramCount++;
      updates.push(`phone = $${paramCount}`);
      params.push(phone);
    }
    if (businessAddress !== undefined) {
      paramCount++;
      updates.push(`business_address = $${paramCount}`);
      params.push(businessAddress);
    }
    if (businessLicense !== undefined) {
      paramCount++;
      updates.push(`business_license = $${paramCount}`);
      params.push(businessLicense);
    }
    if (taxId !== undefined) {
      paramCount++;
      updates.push(`tax_id = $${paramCount}`);
      params.push(taxId);
    }
    if (bankAccountDetails !== undefined) {
      paramCount++;
      updates.push(`bank_account_details = $${paramCount}`);
      params.push(bankAccountDetails);
    }
    if (profileImageUrl !== undefined) {
      paramCount++;
      updates.push(`profile_image_url = $${paramCount}`);
      params.push(profileImageUrl);
    }

    if (updates.length === 0) {
      // No updates provided, return current profile
      return this.getProfileById(profileId);
    }

    updates.push('updated_at = NOW()');

    const result = await pool.query(
      `UPDATE merchant_profiles 
       SET ${updates.join(', ')}
       WHERE id = $1 RETURNING *`,
      params
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

  // OTP-related methods removed: flow now uses Firebase email verification

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
