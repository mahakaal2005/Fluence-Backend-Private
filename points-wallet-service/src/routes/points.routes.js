import { Router } from 'express';
import { verifyAuthToken, requireAdmin } from '../middleware/auth.js';
import { PointsController } from '../controllers/points.controller.js';

const router = Router();

// All points routes require authentication
router.use(verifyAuthToken());

// Points earning routes
router.post('/earn', PointsController.earnPoints);

// Points transaction routes
router.get('/transactions', PointsController.getPointsTransactions);
router.get('/transactions/:transactionId', PointsController.getPointsTransactionById);
router.put('/transactions/:transactionId/status', requireAdmin(), PointsController.updateTransactionStatus);
router.put('/transactions/:transactionId/social-post', requireAdmin(), PointsController.updateSocialPostStatus);
router.delete('/transactions/:transactionId', requireAdmin(), PointsController.deleteTransaction);

// Points utility routes
router.get('/transactions/requiring-social-posts', PointsController.getTransactionsRequiringSocialPosts);
router.get('/transactions/time-buffer', PointsController.getTransactionsInTimeBuffer);
router.get('/transactions/reference/:referenceId', PointsController.getTransactionsByReferenceId);

// Points statistics routes
router.get('/stats', PointsController.getPointsTransactionStats);
router.get('/stats/daily-summary', PointsController.getDailyTransactionSummary);
router.get('/stats/total-earned', PointsController.getTotalPointsEarned);
router.get('/stats/total-redeemed', PointsController.getTotalPointsRedeemed);

export default router;
