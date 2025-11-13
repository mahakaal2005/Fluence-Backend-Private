import { Router } from 'express';
import { loginWithFirebase } from '../controllers/social.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { loginWithPassword } from '../controllers/password.controller.js';
import { updateAccountStatus } from '../controllers/account.controller.js';
import { getProfile, completeProfile } from '../controllers/profile.controller.js';
import { getActiveSessions, getSessionStats } from '../controllers/sessions.controller.js';
import { requestPhoneOtp, verifyPhoneOtp } from '../controllers/phone.controller.js';

const router = Router();

// Password login
router.post('/login', loginWithPassword);

// Phone / OTP auth
router.post('/phone/request-otp', requestPhoneOtp);
router.post('/phone/verify-otp', verifyPhoneOtp);

// Firebase-only auth endpoint
router.post('/firebase', loginWithFirebase);
router.get('/profile', requireAuth(['active', 'paused']), getProfile);
router.post('/complete-profile', requireAuth(['active', 'paused']), completeProfile);
router.post('/account/status', requireAuth(['active', 'paused']), updateAccountStatus);

// Admin session analytics endpoints
router.get('/sessions/active', requireAuth(['active', 'paused']), getActiveSessions);
router.get('/sessions/stats', requireAuth(['active', 'paused']), getSessionStats);

export default router;

