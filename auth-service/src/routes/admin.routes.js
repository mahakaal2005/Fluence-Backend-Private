import { Router } from 'express';
import { WalletController } from '../controllers/wallet.controller.js';
import { BackgroundJobsService } from '../services/background-jobs.service.js';
import { requireAuth } from '../middleware/auth.js';
import { createAdminUser, listUsers, updateUserRole, approveUser, rejectUser, suspendUser, getUserApprovalStatus } from '../controllers/admin.controller.js';
import { getPool } from '../db/pool.js';

const router = Router();

// All admin routes require authentication
router.use(requireAuth());

// Admin middleware - check for admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.use(requireAdmin);

// Admin user management
router.post('/users/admin', createAdminUser);
router.get('/users', listUsers);
router.put('/users/:userId/role', updateUserRole);
router.post('/users/:userId/approve', approveUser);
router.post('/users/:userId/reject', rejectUser);
router.post('/users/:userId/suspend', suspendUser);
router.get('/users/:userId/approval-status', getUserApprovalStatus);

// Admin wallet management
router.get('/admin/pending-social-posts', WalletController.getPendingSocialPosts);
router.put('/admin/verify-social-post/:postId', WalletController.verifySocialPost);

// Background job management
router.get('/admin/jobs/status', (req, res) => {
  try {
    const status = BackgroundJobsService.getJobStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get job status',
      error: error.message
    });
  }
});

router.post('/admin/jobs/trigger/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    const result = await BackgroundJobsService.triggerJob(jobName);
    
    res.json({
      success: true,
      message: `Job ${jobName} triggered successfully`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to trigger job',
      error: error.message
    });
  }
});

router.post('/admin/jobs/stop/:jobName', (req, res) => {
  try {
    const { jobName } = req.params;
    BackgroundJobsService.stopJob(jobName);
    
    res.json({
      success: true,
      message: `Job ${jobName} stopped successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop job',
      error: error.message
    });
  }
});

export default router;
