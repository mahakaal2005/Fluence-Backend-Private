import { getPool } from '../db/pool.js';

/**
 * Get active sessions count and growth
 * Admin endpoint for dashboard analytics
 */
export async function getActiveSessions(req, res) {
    try {
        const pool = getPool();
        const now = new Date();

        // Get active sessions (not expired and is_active = true)
        const activeSessionsQuery = `
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE expires_at > $1 AND is_active = true
    `;
        const activeResult = await pool.query(activeSessionsQuery, [now]);
        const activeSessions = parseInt(activeResult.rows[0].count) || 0;

        // Get sessions from last 24 hours (based on last_accessed_at for better accuracy)
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentSessionsQuery = `
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE last_accessed_at > $1 AND expires_at > $2 AND is_active = true
    `;
        const recentResult = await pool.query(recentSessionsQuery, [oneDayAgo, now]);
        const recentSessions = parseInt(recentResult.rows[0].count) || 0;

        // Get sessions from previous 24 hours (24-48 hours ago)
        const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const previousSessionsQuery = `
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE last_accessed_at > $1 AND last_accessed_at <= $2 AND expires_at > $3 AND is_active = true
    `;
        const previousResult = await pool.query(previousSessionsQuery, [twoDaysAgo, oneDayAgo, now]);
        const previousSessions = parseInt(previousResult.rows[0].count) || 0;

        // Calculate growth percentage
        let growth = 0;
        if (previousSessions > 0) {
            growth = ((recentSessions - previousSessions) / previousSessions) * 100;
        } else if (recentSessions > 0) {
            growth = 100; // 100% growth if we had 0 before
        }

        // Round to 1 decimal place
        growth = Math.round(growth * 10) / 10;

        console.log('📊 Active Sessions Analytics:');
        console.log('   Active sessions:', activeSessions);
        console.log('   Recent (24h):', recentSessions);
        console.log('   Previous (24-48h):', previousSessions);
        console.log('   Growth:', growth + '%');

        res.json({
            success: true,
            data: {
                activeSessions,
                recentSessions,
                previousSessions,
                growth
            }
        });
    } catch (error) {
        console.error('❌ Error fetching active sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active sessions',
            message: error.message
        });
    }
}

/**
 * Get session statistics
 * Detailed breakdown for admin analytics
 */
export async function getSessionStats(req, res) {
    try {
        const pool = getPool();
        const now = new Date();

        // Get comprehensive session stats
        const statsQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN expires_at > $1 AND is_active = true THEN 1 END) as active_sessions,
        COUNT(CASE WHEN expires_at <= $1 OR is_active = false THEN 1 END) as expired_sessions,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(EXTRACT(EPOCH FROM (expires_at - created_at))) as avg_session_duration
      FROM user_sessions
    `;
        const statsResult = await pool.query(statsQuery, [now]);
        const stats = statsResult.rows[0];

        res.json({
            success: true,
            data: {
                totalSessions: parseInt(stats.total_sessions) || 0,
                activeSessions: parseInt(stats.active_sessions) || 0,
                expiredSessions: parseInt(stats.expired_sessions) || 0,
                uniqueUsers: parseInt(stats.unique_users) || 0,
                avgSessionDuration: parseFloat(stats.avg_session_duration) || 0
            }
        });
    } catch (error) {
        console.error('❌ Error fetching session stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch session stats',
            message: error.message
        });
    }
}
