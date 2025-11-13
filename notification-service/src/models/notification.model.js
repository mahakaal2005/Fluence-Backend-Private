import { getPool } from '../config/database.js';
import { getConfig } from '../config/index.js';

export class NotificationModel {
  /**
   * Get user email from database or auth service
   */
  static async getUserEmail(userId) {
    if (!userId) return null;

    try {
      // First, try to get from database directly (faster if shared DB)
      const pool = getPool();
      const dbResult = await pool.query(
        `SELECT email FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );

      if (dbResult.rows.length > 0 && dbResult.rows[0].email) {
        return dbResult.rows[0].email;
      }
    } catch (dbError) {
      // If database query fails (separate DB or table doesn't exist), try API
      console.log('Database query failed, trying API:', dbError.message);

      try {
        const config = getConfig();
        const authServiceUrl = config.services.auth;
        const serviceApiKey = process.env.SERVICE_API_KEY || 'internal-service-key';

        const response = await fetch(`${authServiceUrl}/api/auth/internal/users/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-API-Key': serviceApiKey
          }
        });

        if (response.ok) {
          const result = await response.json();
          return result?.user?.email || result?.email || null;
        }
      } catch (apiError) {
        console.error('API call also failed:', apiError.message);
      }
    }

    return null;
  }

  /**
   * Create a new notification
   */
  static async createNotification(notificationData) {
    const pool = getPool();
    const {
      userId,
      type = 'in_app', // Default to 'in_app' if not specified
      title, // Will be mapped to 'subject' column
      message,
      data = null, // Additional data to include in metadata
      sentAt = new Date(),
      sentBy = null, // User/service ID that triggered the notification
      recipient = null // Will be fetched from auth service if not provided
    } = notificationData;

    // Fetch user email if recipient not provided
    let userEmail = recipient;
    if (!userEmail && userId) {
      userEmail = await this.getUserEmail(userId);
    }

    // Fallback to default if still no email found
    if (!userEmail) {
      userEmail = 'user@fluence.com';
      console.warn(`Could not fetch email for user ${userId}, using default recipient`);
    }

    // Build metadata object with sentAt and sentBy
    const sentAtISO = sentAt && sentAt.toISOString
      ? sentAt.toISOString()
      : (typeof sentAt === 'string' ? sentAt : (sentAt ? new Date(sentAt).toISOString() : new Date().toISOString()));

    const metadata = {
      sentAt: sentAtISO,
      ...(sentBy && { sentBy }),
      ...(data && typeof data === 'object' && !Array.isArray(data) ? data : (data ? { customData: data } : {}))
    };

    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, recipient, subject, message, metadata, sent_at, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        userId,
        type,
        userEmail, // Use fetched user email
        title, // Maps to 'subject' column
        message,
        JSON.stringify(metadata), // Ensure metadata is properly stringified JSONB
        sentAt,
        'sent'
      ]
    );
    return result.rows[0];
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(userId, limit = 50, offset = 0) {
    const pool = getPool();

    // Get notifications with read count
    // For notifications sent to multiple users (same subject, message, and sent_at within 5 seconds),
    // count how many users have read their copy of the notification
    const result = await pool.query(
      `SELECT 
         n.*,
         CAST((SELECT COUNT(*) 
          FROM notifications n2 
          WHERE n2.subject = n.subject
            AND n2.message = n.message
            AND ABS(EXTRACT(EPOCH FROM (n2.sent_at - n.sent_at))) <= 5
            AND n2.read_at IS NOT NULL) AS INTEGER) as read_count
       FROM notifications n
       WHERE n.user_id = $1 
       ORDER BY n.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Get unseen admin notification count
   * Only counts notifications RECEIVED by admin (not sent by admin)
   * Filters by metadata category starting with 'admin_' (admin_new_post, admin_new_merchant_application, etc.)
   */
  static async getUnreadCount(userId) {
    const pool = getPool();
    // Count notifications RECEIVED by admin (not sent by admin)
    // Admin SENT notifications have metadata->>'sentBy' = admin_user_id
    // Admin RECEIVED notifications have metadata->>'sentBy' != admin_user_id OR NULL
    // Also include notifications with admin_ category or admin subject patterns for backward compatibility
    
    // Debug: Check what notifications exist
    const debugResult = await pool.query(
      `SELECT id, subject, metadata->>'sentBy' as sentBy, metadata->>'category' as category, opened_at 
       FROM notifications 
       WHERE user_id = $1 AND opened_at IS NULL 
       LIMIT 10`,
      [userId]
    );
    console.log(`[getUnreadCount] Found ${debugResult.rows.length} unopened notifications for user ${userId}`);
    debugResult.rows.forEach((row, idx) => {
      console.log(`  [${idx + 1}] ${row.subject} - sentBy: ${row.sentBy || 'NULL'} - category: ${row.category || 'NULL'} - opened_at: ${row.opened_at || 'NULL'}`);
    });
    
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM notifications 
       WHERE user_id = $1 
         AND opened_at IS NULL 
         AND (
           -- Not sent by this admin (received notifications)
           (metadata->>'sentBy' IS NULL OR metadata->>'sentBy' != $1::text)
           OR
           -- Admin category notifications (backward compatibility)
           (metadata IS NOT NULL AND metadata->>'category' LIKE 'admin_%')
           OR
           -- Admin notification subject patterns (backward compatibility)
           (subject LIKE 'New Merchant Application%' OR subject LIKE 'New Social Post%')
         )`,
      [userId]
    );
    const count = parseInt(result.rows[0].count);
    console.log(`[getUnreadCount] Query returned count: ${count} for user ${userId}`);
    return count;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE notifications 
       SET read_at = NOW(), 
           opened_at = COALESCE(opened_at, NOW())
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [notificationId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE notifications 
       SET read_at = NOW() 
       WHERE user_id = $1 AND read_at IS NULL RETURNING *`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Mark all admin notifications as opened/viewed (sets opened_at)
   * This is called when admin views their notifications list
   * Only marks notifications RECEIVED by admin (not sent by admin)
   */
  static async markAllAsOpened(userId) {
    const pool = getPool();
    // Mark all notifications RECEIVED by admin as opened (not sent by admin)
    // Admin SENT notifications have metadata->>'sentBy' = admin_user_id
    // Admin RECEIVED notifications have metadata->>'sentBy' != admin_user_id OR NULL
    // Also include notifications with admin_ category or admin subject patterns for backward compatibility
    
    // Debug: Check what notifications exist before update
    const beforeResult = await pool.query(
      `SELECT id, subject, metadata->>'sentBy' as sentBy, metadata->>'category' as category, opened_at 
       FROM notifications 
       WHERE user_id = $1 AND opened_at IS NULL 
       LIMIT 10`,
      [userId]
    );
    console.log(`[markAllAsOpened] Found ${beforeResult.rows.length} unopened notifications for user ${userId}`);
    beforeResult.rows.forEach((row, idx) => {
      console.log(`  [${idx + 1}] ${row.subject} - sentBy: ${row.sentBy || 'NULL'} - category: ${row.category || 'NULL'}`);
    });
    
    const result = await pool.query(
      `UPDATE notifications 
       SET opened_at = COALESCE(opened_at, NOW()) 
       WHERE user_id = $1 
         AND opened_at IS NULL 
         AND (
           -- Not sent by this admin (received notifications)
           (metadata->>'sentBy' IS NULL OR metadata->>'sentBy' != $1::text)
           OR
           -- Admin category notifications (backward compatibility)
           (metadata IS NOT NULL AND metadata->>'category' LIKE 'admin_%')
           OR
           -- Admin notification subject patterns (backward compatibility)
           (subject LIKE 'New Merchant Application%' OR subject LIKE 'New Social Post%')
         )
       RETURNING *`,
      [userId]
    );
    console.log(`[markAllAsOpened] Updated ${result.rows.length} notifications as opened for user ${userId}`);
    if (result.rows.length > 0) {
      console.log(`[markAllAsOpened] Updated notification IDs: ${result.rows.map(r => r.id).join(', ')}`);
    }
    return result.rows;
  }

  /**
   * Get notifications by type
   */
  static async getNotificationsByType(userId, type, limit = 20) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 AND type = $2 
       ORDER BY created_at DESC 
       LIMIT $3`,
      [userId, type, limit]
    );
    return result.rows;
  }

  /**
   * Get notification by ID
   */
  static async getNotificationById(notificationId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM notifications WHERE id = $1',
      [notificationId]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId, userId) {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_notifications,
         COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_notifications,
         COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read_notifications,
         COUNT(CASE WHEN type = 'social_post_reminder' THEN 1 END) as social_reminders,
         COUNT(CASE WHEN type = 'points_available' THEN 1 END) as points_notifications,
         COUNT(CASE WHEN type = 'points_expiring' THEN 1 END) as expiration_notifications
       FROM notifications 
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get notifications by date range
   */
  static async getNotificationsByDateRange(userId, startDate, endDate, limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       AND created_at BETWEEN $2 AND $3
       ORDER BY created_at DESC 
       LIMIT $4 OFFSET $5`,
      [userId, startDate, endDate, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get notification settings
   */
  static async getNotificationSettings(userId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM notification_settings WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update notification settings
   */
  static async updateNotificationSettings(userId, settings) {
    const pool = getPool();
    const {
      socialPostReminders,
      pointsAvailable,
      pointsExpiring
    } = settings;

    const result = await pool.query(
      `INSERT INTO notification_settings (user_id, social_post_reminders, points_available, points_expiring) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         social_post_reminders = EXCLUDED.social_post_reminders,
         points_available = EXCLUDED.points_available,
         points_expiring = EXCLUDED.points_expiring,
         updated_at = NOW()
       RETURNING *`,
      [userId, socialPostReminders, pointsAvailable, pointsExpiring]
    );
    return result.rows[0];
  }
}
