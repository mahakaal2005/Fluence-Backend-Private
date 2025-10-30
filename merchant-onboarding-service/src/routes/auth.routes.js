import { Router } from 'express';
import { requestOtp, setPassword, login } from '../controllers/auth.controller.js';

const router = Router();

// Public endpoints for merchant auth
router.post('/request-otp', requestOtp);
router.post('/set-password', setPassword);
router.post('/login', login);

export default router;


