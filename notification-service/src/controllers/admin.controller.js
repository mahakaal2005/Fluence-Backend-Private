import { StatusCodes } from 'http-status-codes';
import { NotificationService } from '../services/notification.service.js';
import { ApiError } from '../middleware/error.js';
import { getPool } from '../config/database.js';

export class AdminController {
    /**
     * Send notification to all users (immediately or scheduled)
     */
    static async sendBulkNotification(req, res, next) {
        try {
            const { title, message, type = 'in_app', scheduledAt } = req.body;

            if (!title || !message) {
                throw new ApiError(StatusCodes.BAD_REQUEST, 'Title and message are required');
            }

            // Validate scheduledAt if provided
            if (scheduledAt) {
                const scheduleDate = new Date(scheduledAt);
                if (isNaN(scheduleDate.getTime())) {
                    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid scheduledAt date format');
                }
                if (scheduleDate <= new Date()) {
                    throw new ApiError(StatusCodes.BAD_REQUEST, 'scheduledAt must be in the future');
                }
            }

            // Get all user IDs from database
            const pool = getPool();
            const result = await pool.query('SELECT id FROM users');
            const userIds = result.rows.map(row => row.id);

            if (userIds.length === 0) {
                throw new ApiError(StatusCodes.BAD_REQUEST, 'No users found');
            }

            if (scheduledAt) {
                // Schedule notifications for future delivery
                console.log('Scheduling notifications for:', {
                    userCount: userIds.length,
                    scheduledAt,
                    title,
                    message
                });
                
                try {
                    await NotificationService.scheduleBulkNotifications(
                        userIds,
                        type,
                        title,
                        message,
                        scheduledAt,
                        { sentBy: req.user.id }
                    );
                    
                    console.log('Notifications scheduled successfully');
                } catch (scheduleError) {
                    console.error('Error scheduling notifications:', scheduleError);
                    throw new ApiError(
                        StatusCodes.INTERNAL_SERVER_ERROR, 
                        `Failed to schedule notifications: ${scheduleError.message}`
                    );
                }

                res.status(StatusCodes.OK).json({
                    success: true,
                    message: `Notification scheduled for ${userIds.length} users`,
                    data: {
                        recipientsCount: userIds.length,
                        scheduledAt: scheduledAt
                    }
                });
            } else {
                // Send notifications immediately
                await NotificationService.sendBulkNotifications(
                    userIds,
                    type,
                    title,
                    message,
                    { sentBy: req.user.id, sentAt: new Date() }
                );

                res.status(StatusCodes.OK).json({
                    success: true,
                    message: `Notification sent to ${userIds.length} users`,
                    data: {
                        recipientsCount: userIds.length
                    }
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get total user count
     */
    static async getUserCount(req, res, next) {
        try {
            const pool = getPool();
            const result = await pool.query('SELECT COUNT(*) as count FROM users');
            const count = parseInt(result.rows[0].count);

            res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    count
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get admin analytics - weekly notifications and engagement
     */
    static async getAnalytics(req, res, next) {
        try {
            const pool = getPool();

            // Get last 7 days of notification counts
            const weeklyResult = await pool.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM notifications
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

            // Get engagement metrics (opened, clicked, dismissed) - Last 30 days for charts
            const engagementResult = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
          COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked,
          COUNT(CASE WHEN opened_at IS NULL AND clicked_at IS NULL THEN 1 END) as dismissed
        FROM notifications
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);

            const engagement = engagementResult.rows[0];

            // Get total sent notifications and open rate (all time)
            const totalSentResult = await pool.query(`
        SELECT 
          COUNT(*) as total_sent,
          COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as total_opened
        FROM notifications
        WHERE sent_at IS NOT NULL
      `);

            const totalSent = parseInt(totalSentResult.rows[0].total_sent) || 0;
            const totalOpened = parseInt(totalSentResult.rows[0].total_opened) || 0;
            
            // For scheduled notifications: Check if scheduled_at column exists
            // (It will be added when schedule notification feature is implemented)
            let scheduled = 0;
            try {
                const scheduledResult = await pool.query(`
          SELECT COUNT(*) as scheduled
          FROM notifications
          WHERE scheduled_at IS NOT NULL AND sent_at IS NULL
        `);
                scheduled = parseInt(scheduledResult.rows[0].scheduled) || 0;
            } catch (error) {
                // Column doesn't exist yet - scheduled notifications not implemented
                // This is expected and normal, just return 0
                console.log('Scheduled notifications feature not yet implemented (scheduled_at column missing)');
                scheduled = 0;
            }
            // Calculate open rate from all-time data (to match totalSent metric)
            const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

            console.log('=== ANALYTICS DEBUG ===');
            console.log('Engagement (Last 30 days):', engagement);
            console.log('Total Sent (All Time):', totalSent);
            console.log('Total Opened (All Time):', totalOpened);
            console.log('Open Rate (All Time):', openRate + '%');
            console.log('Scheduled:', scheduled);
            console.log('======================');

            res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    // Existing fields (preserved for backward compatibility)
                    weekly: weeklyResult.rows,
                    engagement: {
                        total: parseInt(engagement.total),
                        opened: parseInt(engagement.opened),
                        clicked: parseInt(engagement.clicked),
                        dismissed: parseInt(engagement.dismissed)
                    },
                    // New fields for the frontend stat cards
                    totalSent: totalSent,
                    openRate: openRate,
                    scheduled: scheduled
                }
            });
        } catch (error) {
            next(error);
        }
    }
}
