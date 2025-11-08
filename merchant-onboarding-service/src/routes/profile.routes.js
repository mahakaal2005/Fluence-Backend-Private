import { Router } from 'express';
import { verifyAuthToken, requireAdmin } from '../middleware/auth.js';
import {
  getMerchantProfile,
  updateMerchantProfile,
  getMerchantProfileById,
  getAllMerchantProfiles,
  getActiveMerchantProfiles,
  getMerchantProfilesByBusinessType,
  getMerchantProfileStats,
  searchMerchantProfiles,
  getMerchantProfileWithActivity,
  updateMerchantProfileStatus,
  uploadProfileImage,
  uploadSingleImage,
  getMerchantProfileByInstagramId
} from '../controllers/profile.controller.js';

const router = Router();

// Public routes (no auth required) - MUST be defined before verifyAuthToken() middleware
router.get('/active', getActiveMerchantProfiles);
router.get('/business-type/:businessType', getMerchantProfilesByBusinessType);
router.get('/search', searchMerchantProfiles);
router.get('/stats', getMerchantProfileStats);
// Public endpoint for auto-linking social posts to transactions - no authentication required
router.get('/by-instagram/:instagramId', getMerchantProfileByInstagramId);
router.put('/:merchantId/avatar', uploadSingleImage('image'), uploadProfileImage);

// Protected routes (require authentication)
router.use(verifyAuthToken());

// User profile routes
router.get('/me', getMerchantProfile);
router.put('/me', updateMerchantProfile);

// Admin routes
router.get('/admin/all', requireAdmin(), getAllMerchantProfiles);
router.get('/admin/:profileId', requireAdmin(), getMerchantProfileById);
router.get('/admin/:profileId/activity', requireAdmin(), getMerchantProfileWithActivity);
router.put('/admin/:profileId/status', requireAdmin(), updateMerchantProfileStatus);

export default router;
