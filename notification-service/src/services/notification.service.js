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
   * Send notification to all users
   */
  static async sendNotificationToAllUsers(type, title, message, data = null) {
    // This would typically get all user IDs from the auth service
    // For now, return empty array
    return [];
  }
}
