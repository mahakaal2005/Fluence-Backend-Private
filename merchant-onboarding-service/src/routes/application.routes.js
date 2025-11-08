import { Router } from 'express';
import { verifyAuthToken } from '../middleware/auth.js';
import {
  submitApplication,
  getUserApplications,
  getApplication,
  updateApplication,
  deleteApplication,
  getApplicationStats,
  getApplicationsRequiringReview
} from '../controllers/application.controller.js';

const router = Router();

// Public: submit application does not require auth
router.post('/', submitApplication);
router.get('/:applicationId', getApplication);

// Protected: all other application routes
router.use(verifyAuthToken());
router.get('/', getUserApplications);
router.get('/stats', getApplicationStats);
router.get('/sla-check', getApplicationsRequiringReview);
router.put('/:applicationId', updateApplication);
router.delete('/:applicationId', deleteApplication);

export default router;
