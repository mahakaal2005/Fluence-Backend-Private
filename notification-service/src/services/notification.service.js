import { NotificationModel } from '../models/notification.model.js';

export class NotificationService {
  /**
   * Send notification to user
   */
  static async sendNotification(userId, type = 'in_app', title, message, data = null, sentBy = null) {
    const notification = await NotificationModel.createNotification({
      userId,
      type: type || 'in_app', // Default to 'in_app' for all notifications
      title,
      message,
      data,
      sentAt: new Date(),
      sentBy // User/service ID that triggered the notification
    });

    return notification;
  }

  /**
   * Send social post reminder
   */
  static async sendSocialPostReminder(userId, transactionId, socialPostUrl, sentBy = null) {
    const title = 'Social Post Reminder';
    const message = 'Don\'t forget to share your experience on social media to earn points!';
    const data = {
      transactionId,
      socialPostUrl,
      category: 'social_post_reminder'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }

  /**
   * Send points available notification
   */
  static async sendPointsAvailableNotification(userId, pointsAmount, description, sentBy = null) {
    const title = 'Points Available!';
    const message = `You've earned ${pointsAmount} points: ${description}`;
    const data = {
      pointsAmount,
      description,
      category: 'points_available'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }

  /**
   * Send points expiring notification
   */
  static async sendPointsExpiringNotification(userId, pointsAmount, expirationDate, sentBy = null) {
    const title = 'Points Expiring Soon';
    const message = `You have ${pointsAmount} points expiring on ${expirationDate}`;
    const data = {
      pointsAmount,
      expirationDate,
      category: 'points_expiring'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(userId, limit = 50, offset = 0) {
    return await NotificationModel.getUserNotifications(userId, limit, offset);
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId) {
    return await NotificationModel.getUnreadCount(userId);
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    return await NotificationModel.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    return await NotificationModel.markAllAsRead(userId);
  }

  /**
   * Get notifications by type
   */
  static async getNotificationsByType(userId, type, limit = 20) {
    return await NotificationModel.getNotificationsByType(userId, type, limit);
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(userId) {
    return await NotificationModel.getNotificationStats(userId);
  }

  /**
   * Get notification settings
   */
  static async getNotificationSettings(userId) {
    let settings = await NotificationModel.getNotificationSettings(userId);

    if (!settings) {
      // Create default settings
      settings = await NotificationModel.updateNotificationSettings(userId, {
        socialPostReminders: true,
        pointsAvailable: true,
        pointsExpiring: true
      });
    }

    return settings;
  }

  /**
   * Update notification settings
   */
  static async updateNotificationSettings(userId, settings) {
    return await NotificationModel.updateNotificationSettings(userId, settings);
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId, userId) {
    return await NotificationModel.deleteNotification(notificationId, userId);
  }

  /**
   * Get notifications by date range
   */
  static async getNotificationsByDateRange(userId, startDate, endDate, limit = 50, offset = 0) {
    return await NotificationModel.getNotificationsByDateRange(userId, startDate, endDate, limit, offset);
  }

  /**
   * Send bulk notifications
   */
  static async sendBulkNotifications(userIds, type, title, message, data = null) {
    const notifications = [];

    for (const userId of userIds) {
      const notification = await this.sendNotification(userId, type, title, message, data);
      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Schedule bulk notifications for future delivery
   */
  static async scheduleBulkNotifications(userIds, type, title, message, scheduledAt, data = null) {
    const notifications = [];
    const { getPool } = await import('../config/database.js');
    const pool = getPool();

    console.log('Starting scheduleBulkNotifications:', {
      userCount: userIds.length,
      type,
      title,
      scheduledAt,
      dataProvided: !!data
    });

    // First, check if scheduled_at column exists
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'scheduled_at'
      `);

      if (columnCheck.rows.length === 0) {
        const errorMsg = 'Database migration required: scheduled_at column does not exist in notifications table. Please run the migration: migrations/001_add_scheduled_at_column.sql';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('✓ scheduled_at column exists in database');
    } catch (checkError) {
      console.error('Failed to check for scheduled_at column:', checkError);
      throw checkError;
    }

    try {
      for (const userId of userIds) {
        console.log(`Processing user ${userId}...`);
        
        // Get user email for the recipient field
        let recipient;
        try {
          const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
          recipient = userResult.rows[0]?.email || userId;
          console.log(`  User email: ${recipient}`);
        } catch (emailError) {
          console.error(`  Failed to get email for user ${userId}:`, emailError);
          recipient = userId;
        }

        // Create scheduled notification (not sent yet)
        try {
          const result = await pool.query(
            `INSERT INTO notifications 
             (user_id, type, recipient, subject, message, status, scheduled_at, metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
             RETURNING *`,
            [
              userId,
              type || 'in_app',
              recipient,
              title,
              message,
              'pending', // Status is pending until sent
              scheduledAt,
              data ? JSON.stringify(data) : null
            ]
          );

          notifications.push(result.rows[0]);
          console.log(`  ✓ Notification scheduled for user ${userId}`);
        } catch (insertError) {
          console.error(`  Failed to insert notification for user ${userId}:`, insertError);
          throw insertError;
        }
      }

      console.log(`✓ Successfully scheduled ${notifications.length} notifications`);
      return notifications;
    } catch (error) {
      console.error('Error in scheduleBulkNotifications:', error);
      throw error;
    }
  }

  /**
   * Send notification to all users
   */
  static async sendNotificationToAllUsers(type, title, message, data = null) {
    // This would typically get all user IDs from the auth service
    // For now, return empty array
    return [];
  }

  /**
   * Get sent notifications with read statistics
   * This is for admins to see notifications they sent and how many users read them
   */
  static async getSentNotificationsWithStats(limit = 50, offset = 0) {
    try {
      const { getPool } = await import('../config/database.js');
      const pool = getPool();

      // Get unique notifications (grouped by subject, message, and sent_at)
      // with read count statistics
      const result = await pool.query(
        `SELECT 
           MIN(id)::TEXT as id,
           subject,
           message,
           type,
           sent_at,
           CAST(COUNT(*) AS INTEGER) as total_recipients,
           CAST(COUNT(*) FILTER (WHERE read_at IS NOT NULL) AS INTEGER) as total_read,
           CAST(COUNT(*) FILTER (WHERE read_at IS NULL) AS INTEGER) as total_unread,
           ROUND((COUNT(*) FILTER (WHERE read_at IS NOT NULL)::DECIMAL / COUNT(*)) * 100, 2) as read_percentage,
           MIN(created_at) as created_at,
           MAX(read_at) as last_read_at
         FROM notifications
         WHERE sent_at IS NOT NULL
         GROUP BY subject, message, type, DATE_TRUNC('second', sent_at)
         ORDER BY sent_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      return result.rows;
    } catch (error) {
      console.error('Failed to get sent notifications with stats:', error.message);
      return [];
    }
  }

  /**
   * Get all admin user IDs
   * Queries the auth service database to find users with admin role
   */
  static async getAdminUserIds() {
    try {
      const { getPool: getAuthPool } = await import('../config/database.js');
      const pool = getAuthPool();

      // Query users table for admin users
      const result = await pool.query(
        `SELECT id FROM users WHERE role = $1 AND status = $2`,
        ['admin', 'active']
      );

      return result.rows.map(row => row.id);
    } catch (error) {
      console.error('Failed to get admin user IDs:', error.message);
      return [];
    }
  }

  /**
   * Send notification to all admins
   * Used for system-wide admin notifications
   */
  static async sendAdminNotification(type, title, message, data = null, sentBy = null) {
    try {
      const adminIds = await this.getAdminUserIds();

      if (adminIds.length === 0) {
        console.warn('No admin users found to send notification');
        return [];
      }

      return await this.sendBulkNotifications(adminIds, type, title, message, data);
    } catch (error) {
      console.error('Failed to send admin notification:', error.message);
      return [];
    }
  }

  /**
   * Send notification when a new social post is created
   * Notifies all admins about the new post
   */
  static async sendAdminNewPostNotification(postData, sentBy = null) {
    const { postId, userId, username, platform, postType, contentPreview } = postData;

    const title = 'New Social Post Created';
    const message = username
      ? `${username} created a new ${postType || 'social'} post${platform ? ` on ${platform}` : ''}`
      : `A new ${postType || 'social'} post has been created${platform ? ` on ${platform}` : ''}`;

    const data = {
      postId,
      userId,
      username,
      platform,
      postType,
      contentPreview: contentPreview ? contentPreview.substring(0, 100) : null,
      category: 'admin_new_post',
      actionUrl: `/admin/social-posts/${postId}`
    };

    return await this.sendAdminNotification('in_app', title, message, data, sentBy);
  }

  /**
   * Send notification when a new merchant application is submitted
   * Notifies all admins about the new application
   */
  static async sendAdminNewMerchantApplicationNotification(applicationData, sentBy = null) {
    const { applicationId, businessName, businessType, contactPerson, email } = applicationData;

    const title = 'New Merchant Application';
    const message = `${businessName} (${businessType}) has submitted a merchant application`;

    const data = {
      applicationId,
      businessName,
      businessType,
      contactPerson,
      email,
      category: 'admin_new_merchant_application',
      actionUrl: `/admin/merchant-applications/${applicationId}`
    };

    return await this.sendAdminNotification('in_app', title, message, data, sentBy);
  }
}
