import { Router } from 'express';
import { verifyAuthToken } from '../middleware/auth.js';
import { AdminSocialController } from '../controllers/admin-social.controller.js';
import { getRecentVerifications } from '../controllers/admin-activity.controller.js';

const router = Router();

// All admin routes require authentication
router.use(verifyAuthToken());

// Admin activity feed
router.get('/activity/recent-verifications', getRecentVerifications);

// Admin post management routes
router.get('/posts', AdminSocialController.getAllPosts); // Get all posts with filtering
router.get('/posts/pending', AdminSocialController.getPendingPosts);
router.get('/posts/:postId', AdminSocialController.getPostForReview);
router.post('/posts/:postId/approve', AdminSocialController.approvePost);
router.post('/posts/:postId/reject', AdminSocialController.rejectPost);

// Post validation routes
router.get('/posts/:postId/validate', AdminSocialController.validatePostMetadata);
router.get('/posts/:postId/duplicates', AdminSocialController.checkDuplicatePosts);

// Admin dashboard routes
router.get('/posts/attention', AdminSocialController.getPostsRequiringAttention);
router.get('/posts/stats', AdminSocialController.getPostReviewStats);

// Post limits enforcement
router.get('/users/:userId/limits', AdminSocialController.enforceDailyPostLimits);
router.post('/users/:userId/limits', AdminSocialController.enforceDailyPostLimits);

export default router;
