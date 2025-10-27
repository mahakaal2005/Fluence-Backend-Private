import { StatusCodes } from 'http-status-codes';
import { getPool } from '../config/database.js';

/**
 * Get recent application review activities (approvals/rejections/suspensions)
 * For admin dashboard Recent Activity feed
 */
export async function getRecentApplicationReviews(req, res, next) {
    try {
        const pool = getPool();
        const limit = parseInt(req.query.limit) || 10;

        console.log(`📊 [ADMIN_ACTIVITY] Fetching recent application reviews (limit: ${limit})`);

        const query = `
      SELECT 
        ash.id,
        ash.application_id,
        ash.previous_status,
        ash.new_status,
        ash.changed_by,
        ash.reason,
        ash.notes,
        ash.created_at,
        ma.business_name,
        ma.contact_person,
        ma.email,
        ma.business_type
      FROM application_status_history ash
      JOIN merchant_applications ma ON ash.application_id = ma.id
      WHERE ash.new_status IN ('approved', 'rejected', 'suspended')
      ORDER BY ash.created_at DESC
      LIMIT $1
    `;

        const result = await pool.query(query, [limit]);

        console.log(`✅ [ADMIN_ACTIVITY] Found ${result.rows.length} application review activities`);

        const activities = result.rows.map(row => ({
            id: row.id,
            type: `application_${row.new_status}`,
            applicationId: row.application_id,
            businessName: row.business_name,
            contactPerson: row.contact_person,
            email: row.email,
            businessType: row.business_type,
            previousStatus: row.previous_status,
            newStatus: row.new_status,
            changedBy: row.changed_by,
            reason: row.reason,
            notes: row.notes,
            createdAt: row.created_at
        }));

        res.status(StatusCodes.OK).json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('❌ [ADMIN_ACTIVITY] Error fetching application reviews:', error);
        next(error);
    }
}
