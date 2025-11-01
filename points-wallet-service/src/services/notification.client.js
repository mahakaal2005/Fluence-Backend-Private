import { getConfig } from '../config/index.js';

/**
 * Client for communicating with the Notification Service
 */
export class NotificationClient {
  /**
   * Send notification to user
   */
  static async sendNotification(userId, type, title, message, data = null, sentBy = null) {
    try {
      const config = getConfig();
      const notificationServiceUrl = config.services.notification;
      const serviceApiKey = process.env.SERVICE_API_KEY || 'internal-service-key';

      const response = await fetch(`${notificationServiceUrl}/api/notifications/internal/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-API-Key': serviceApiKey
        },
        body: JSON.stringify({
          userId,
          type: type || 'in_app', // Default to 'in_app'
          title,
          message,
          data,
          sentBy // Service ID or user ID that triggered the notification
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Notification service error: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      // Log error but don't throw - notifications shouldn't break transaction creation
      console.error('Failed to send notification:', error.message);
      return null;
    }
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
   * Send points redeemed notification
   */
  static async sendPointsRedeemedNotification(userId, pointsAmount, description, sentBy = null) {
    const title = 'Points Redeemed';
    const message = `You've redeemed ${pointsAmount} points: ${description}`;
    const data = {
      pointsAmount,
      description,
      category: 'points_redeemed'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }

  /**
   * Send social post reminder notification
   */
  static async sendSocialPostReminder(userId, transactionId, description, sentBy = null) {
    const title = 'Social Post Reminder';
    const message = `Don't forget to share your experience to earn points: ${description}`;
    const data = {
      transactionId,
      description,
      category: 'social_post_reminder'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }

  /**
   * Send social post verified notification
   */
  static async sendSocialPostVerifiedNotification(userId, referenceId, totalPoints = null, sentBy = null) {
    const title = 'Social Post Verified';
    const message = totalPoints
      ? `Your social post has been verified! You've earned ${totalPoints} points.`
      : 'Your social post has been verified successfully!';
    const data = {
      referenceId,
      totalPoints,
      category: 'social_post_verified'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }
}

