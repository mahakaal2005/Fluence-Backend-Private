import { Router } from 'express';
import { verifyAuthToken, requireAdmin } from '../middleware/auth.js';
import {
  getAllApplications,
  getPendingApplications,
  getApplication,
  updateApplicationStatus,
  getAllMerchantProfiles,
  getMerchantStats,
  searchMerchantProfiles,
  getApplicationsByStatus,
  getSlaViolations,
  sendSlaReminders
} from '../controllers/admin.controller.js';
import { getRecentApplicationReviews } from '../controllers/admin-activity.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(verifyAuthToken());
router.use(requireAdmin());

// Admin activity feed
router.get('/activity/recent-reviews', getRecentApplicationReviews);

// Application management
router.get('/applications', getAllApplications);
router.get('/applications/pending', getPendingApplications);
router.get('/applications/status/:status', getApplicationsByStatus);
router.get('/applications/:applicationId', getApplication);
router.put('/applications/:applicationId/status', updateApplicationStatus);

// SLA management
router.get('/sla/violations', getSlaViolations);
router.post('/sla/reminders', sendSlaReminders);

// Merchant profile management
router.get('/merchants', getAllMerchantProfiles);
router.get('/merchants/search', searchMerchantProfiles);

// Statistics
router.get('/stats', getMerchantStats);

export default router;
