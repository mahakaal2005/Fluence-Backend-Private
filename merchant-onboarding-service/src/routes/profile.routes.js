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
  uploadSingleImage
} from '../controllers/profile.controller.js';

const router = Router();

// Public routes (no auth required)
router.get('/active', getActiveMerchantProfiles);
router.get('/business-type/:businessType', getMerchantProfilesByBusinessType);
router.get('/search', searchMerchantProfiles);
router.get('/stats', getMerchantProfileStats);
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
