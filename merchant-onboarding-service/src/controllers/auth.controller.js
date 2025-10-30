import { StatusCodes } from 'http-status-codes';
import { MerchantProfileModel } from '../models/merchant-profile.model.js';
import { hashPassword, comparePassword } from '../utils/crypto.js';
import { signToken } from '../utils/jwt.js';
import { NotificationService } from '../services/notification.service.js';
import { createEmailOtp, verifyEmailOtp } from '../services/firebase.service.js';

export async function requestOtp(req, res, next) {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Email is required' });

    const merchant = await MerchantProfileModel.findByEmail(email);
    if (!merchant) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Merchant not found' });
    if (merchant.status !== 'active') return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Merchant not active' });
    if (merchant.login_enabled === false) return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Login disabled' });

    const ttlMinutes = Number(process.env.MERCHANT_OTP_TTL_MIN || 10);
    const { code, expiresAt } = await createEmailOtp(email, ttlMinutes);

    const subject = 'Your Merchant Login OTP';
    const message = `
      Your OTP code is: ${code}

      This code will expire in ${ttlMinutes} minutes.
      If you did not request this, you can ignore this email.
    `;

    try {
      await NotificationService.sendEmail(email, subject, message, 'merchant_login_otp', null);
    } catch (e) {
      // Continue even if email logging fails
    }

    return res.status(StatusCodes.OK).json({ success: true, message: 'OTP sent to email' });
  } catch (err) {
    next(err);
  }
}

export async function setPassword(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Email and password are required' });
    }

    const merchant = await MerchantProfileModel.findByEmail(email);
    if (!merchant) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Merchant not found' });

    // Only allow after approval; profile exists only post-approval
    if (merchant.status !== 'active') return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Merchant not active' });

    const passwordHash = await hashPassword(password);
    const updated = await MerchantProfileModel.setPassword(merchant.id, passwordHash);

    return res.status(StatusCodes.OK).json({ success: true, message: 'Password set successfully', data: { id: updated.id, email: updated.email } });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password, otp } = req.body || {};
    if (!email || !password || !otp) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Email, password and otp are required' });
    }

    const merchant = await MerchantProfileModel.findByEmail(email);
    if (!merchant) return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Invalid credentials' });
    if (merchant.status !== 'active') return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Merchant not active' });
    if (merchant.login_enabled === false) return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Login disabled' });

    const passwordOk = await comparePassword(password, merchant.password_hash);
    if (!passwordOk) return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Invalid credentials' });

    const otpCheck = await verifyEmailOtp(email, otp);
    if (!otpCheck.ok) {
      const map = { expired: 'OTP expired', mismatch: 'Invalid OTP', not_found: 'OTP not found' };
      return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: map[otpCheck.reason] || 'OTP verification failed' });
    }

    await MerchantProfileModel.recordLogin(merchant.id);

    const token = signToken({
      sub: merchant.id,
      email: merchant.email,
      role: 'merchant'
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        token,
        merchant: {
          id: merchant.id,
          email: merchant.email,
          businessName: merchant.business_name,
          status: merchant.status
        }
      },
      message: 'Login successful'
    });
  } catch (err) {
    next(err);
  }
}


