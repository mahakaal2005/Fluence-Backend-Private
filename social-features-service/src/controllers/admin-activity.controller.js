import { StatusCodes } from 'http-status-codes';
import { getPool } from '../config/database.js';

/**
 * Get recent post verification activities (approvals/rejections)
 * For admin dashboard Recent Activity feed
 */
export async function getRecentVerifications(req, res, next) {
    try {
        const pool = getPool();
        const limit = parseInt(req.query.limit) || 10;

        console.log(`📊 [ADMIN_ACTIVITY] Fetching recent post verifications (limit: ${limit})`);

        const query = `
      SELECT 
        sv.id,
        sv.post_id,
        sv.user_id,
        sv.status,
        sv.verified_by,
        sv.verified_at,
        sv.rejection_reason,
        sv.verification_notes,
        sp.content,
        sa.username,
        sa.display_name,
        spl.display_name as platform_name
      FROM social_verification sv
      JOIN social_posts sp ON sv.post_id = sp.id
      JOIN social_accounts sa ON sp.social_account_id = sa.id
      JOIN social_platforms spl ON sa.platform_id = spl.id
      WHERE sv.status IN ('verified', 'rejected')
        AND sv.verified_at IS NOT NULL
      ORDER BY sv.verified_at DESC
      LIMIT $1
    `;

        const result = await pool.query(query, [limit]);

        console.log(`✅ [ADMIN_ACTIVITY] Found ${result.rows.length} verification activities`);

        const activities = result.rows.map(row => ({
            id: row.id,
            type: row.status === 'verified' ? 'post_approved' : 'post_rejected',
            postId: row.post_id,
            userId: row.user_id,
            username: row.username || row.display_name,
            platform: row.platform_name,
            content: row.content?.substring(0, 100),
            verifiedBy: row.verified_by,
            verifiedAt: row.verified_at,
            reason: row.rejection_reason,
            notes: row.verification_notes
        }));

        res.status(StatusCodes.OK).json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('❌ [ADMIN_ACTIVITY] Error fetching verifications:', error);
        next(error);
    }
}
