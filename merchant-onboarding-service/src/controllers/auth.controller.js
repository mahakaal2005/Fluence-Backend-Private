import { StatusCodes } from 'http-status-codes';
import { MerchantProfileModel } from '../models/merchant-profile.model.js';
import { hashPassword, comparePassword } from '../utils/crypto.js';
import { signToken } from '../utils/jwt.js';

// OTP request removed: we now rely on Firebase email verification links

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
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Email and password are required' });
    }

    const merchant = await MerchantProfileModel.findByEmail(email);
    if (!merchant) return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Invalid credentials' });
    if (merchant.status !== 'active') return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Merchant not active' });
    if (merchant.login_enabled === false) return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Login disabled' });

    const passwordOk = await comparePassword(password, merchant.password_hash);
    if (!passwordOk) return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Invalid credentials' });

    // Email verification temporarily disabled per requirements

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


