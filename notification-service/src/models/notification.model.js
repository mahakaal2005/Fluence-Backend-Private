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
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE notifications 
       SET read_at = NOW() 
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
