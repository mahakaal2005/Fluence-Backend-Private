import { StatusCodes } from 'http-status-codes';
import { NotificationService } from '../services/notification.service.js';
import { ApiError } from '../middleware/error.js';

export class NotificationController {
  /**
   * Get user's notifications
   */
  static async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const notifications = await NotificationService.getUserNotifications(userId, limit, offset);
      const unreadCount = await NotificationService.getUnreadCount(userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          notifications,
          unreadCount,
          pagination: {
            limit,
            offset,
            hasMore: notifications.length === limit
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      const notification = await NotificationService.markAsRead(notificationId, userId);

      if (!notification) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.id;

      const notifications = await NotificationService.markAllAsRead(userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: `${notifications.length} notifications marked as read`,
        data: { count: notifications.length }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all notifications as opened/viewed
   * This is called when user views their notifications list
   */
  static async markAllAsOpened(req, res, next) {
    try {
      const userId = req.user.id;

      const notifications = await NotificationService.markAllAsOpened(userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: `${notifications.length} notifications marked as opened`,
        data: { count: notifications.length }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unseen admin notification count
   * Only counts notifications RECEIVED by admin (not sent by admin)
   * Filters by metadata category starting with 'admin_' (admin_new_post, admin_new_merchant_application, etc.)
   */
  static async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;

      const count = await NotificationService.getUnreadCount(userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: { unreadCount: count }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get notifications by type
   */
  static async getNotificationsByType(req, res, next) {
    try {
      const userId = req.user.id;
      const { type } = req.params;
      const limit = parseInt(req.query.limit) || 20;

      const validTypes = ['social_post_reminder', 'points_available', 'points_expiring'];
      if (!validTypes.includes(type)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid notification type');
      }

      const notifications = await NotificationService.getNotificationsByType(userId, type, limit);

      res.status(StatusCodes.OK).json({
        success: true,
        data: notifications
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(req, res, next) {
    try {
      const userId = req.user.id;

      const stats = await NotificationService.getNotificationStats(userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get notification settings
   */
  static async getNotificationSettings(req, res, next) {
    try {
      const userId = req.user.id;

      const settings = await NotificationService.getNotificationSettings(userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update notification settings
   */
  static async updateNotificationSettings(req, res, next) {
    try {
      const userId = req.user.id;
      const { socialPostReminders, pointsAvailable, pointsExpiring } = req.body;

      const settings = await NotificationService.updateNotificationSettings(userId, {
        socialPostReminders,
        pointsAvailable,
        pointsExpiring
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Notification settings updated successfully',
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(req, res, next) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      const notification = await NotificationService.deleteNotification(notificationId, userId);

      if (!notification) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Notification deleted successfully',
        data: notification
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get notifications by date range
   */
  static async getNotificationsByDateRange(req, res, next) {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      if (!startDate || !endDate) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Start date and end date are required');
      }

      const notifications = await NotificationService.getNotificationsByDateRange(
        userId, startDate, endDate, limit, offset
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: notifications,
        pagination: {
          limit,
          offset,
          count: notifications.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Internal endpoint for service-to-service notification creation
   * This endpoint allows other microservices to create notifications
   */
  static async createInternalNotification(req, res, next) {
    try {
      const { userId, type, title, message, data, sentBy } = req.body;

      if (!userId || !title || !message) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'userId, title, and message are required');
      }

      // Default to 'in_app' type if not specified
      const notificationType = type || 'in_app';

      const notification = await NotificationService.sendNotification(
        userId,
        notificationType,
        title,
        message,
        data || null,
        sentBy || null
      );

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Notification created successfully',
        data: notification
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Internal endpoint for admin notification when new post is created
   */
  static async createAdminNewPostNotification(req, res, next) {
    try {
      const { postData, sentBy } = req.body;

      if (!postData || !postData.postId) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'postData with postId is required');
      }

      const notifications = await NotificationService.sendAdminNewPostNotification(postData, sentBy);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: `Admin notification sent to ${notifications.length} admin(s)`,
        data: { count: notifications.length, notifications }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Internal endpoint for admin notification when new merchant application is submitted
   */
  static async createAdminNewMerchantApplicationNotification(req, res, next) {
    try {
      const { applicationData, sentBy } = req.body;

      if (!applicationData || !applicationData.applicationId) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'applicationData with applicationId is required');
      }

      const notifications = await NotificationService.sendAdminNewMerchantApplicationNotification(applicationData, sentBy);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: `Admin notification sent to ${notifications.length} admin(s)`,
        data: { count: notifications.length, notifications }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sent notifications with read statistics
   * For admins to see notifications they sent and how many users read them
   */
  static async getSentNotificationsWithStats(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const notifications = await NotificationService.getSentNotificationsWithStats(limit, offset);

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          notifications,
          pagination: {
            limit,
            offset,
            count: notifications.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
