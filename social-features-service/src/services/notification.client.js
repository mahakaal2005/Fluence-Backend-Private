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
      // Log error but don't throw - notifications shouldn't break social post creation
      console.error('Failed to send notification:', error.message);
      return null;
    }
  }

  /**
   * Send social post created notification
   */
  static async sendSocialPostCreatedNotification(userId, postId, platform = null, postType = null, sentBy = null) {
    const title = 'Social Post Created';
    const message = platform
      ? `Your social post has been created successfully on ${platform}!`
      : `Your social post has been created successfully!`;
    
    const data = {
      postId,
      platform,
      postType,
      category: 'social_post_created'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }

  /**
   * Send social post published notification
   */
  static async sendSocialPostPublishedNotification(userId, postId, platform, postUrl = null, sentBy = null) {
    const title = 'Social Post Published';
    const message = `Your social post has been published on ${platform}!`;
    
    const data = {
      postId,
      platform,
      postUrl,
      category: 'social_post_published'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }
}

