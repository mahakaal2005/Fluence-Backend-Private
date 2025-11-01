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
   * Send transaction completion notification
   */
  static async sendTransactionCompletionNotification(userId, transactionId, cashbackAmount, merchantName = null, description = null, sentBy = null) {
    const title = 'Transaction Completed';
    const message = merchantName
      ? `Your transaction has been completed! You've earned ${cashbackAmount} AED cashback from ${merchantName}.`
      : `Your transaction has been completed! You've earned ${cashbackAmount} AED cashback.`;
    
    const data = {
      transactionId,
      cashbackAmount,
      merchantName,
      description,
      category: 'transaction_completed'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }

  /**
   * Send cashback earned notification
   */
  static async sendCashbackEarnedNotification(userId, cashbackAmount, merchantName, campaignName = null, sentBy = null) {
    const title = 'Cashback Earned!';
    const message = `You've earned ${cashbackAmount} AED cashback${merchantName ? ` from ${merchantName}` : ''}!`;
    
    const data = {
      cashbackAmount,
      merchantName,
      campaignName,
      category: 'cashback_earned'
    };

    return await this.sendNotification(userId, 'in_app', title, message, data, sentBy);
  }
}

