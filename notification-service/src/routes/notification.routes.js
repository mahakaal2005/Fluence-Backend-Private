import { Router } from 'express';
import { verifyAuthToken } from '../middleware/auth.js';
import { NotificationController } from '../controllers/notification.controller.js';

const router = Router();

// All notification routes require authentication
router.use(verifyAuthToken());

// Notification management routes
router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.get('/type/:type', NotificationController.getNotificationsByType);
router.get('/date-range', NotificationController.getNotificationsByDateRange);
router.get('/stats', NotificationController.getNotificationStats);

// Notification actions
router.put('/:notificationId/read', NotificationController.markAsRead);
router.put('/read-all', NotificationController.markAllAsRead);
router.delete('/:notificationId', NotificationController.deleteNotification);

// Notification settings
router.get('/settings', NotificationController.getNotificationSettings);
router.put('/settings', NotificationController.updateNotificationSettings);

export default router;
