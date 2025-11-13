import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getConfig } from '../config/index.js';
import { ApiError } from '../middleware/error.js';
import { hashPassword, comparePassword } from '../utils/crypto.js';
import { signToken } from '../utils/jwt.js';
import {
  getPhoneOtp,
  upsertPhoneOtp,
  incrementOtpRetry,
  deletePhoneOtp
} from '../models/phone-otp.model.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  markPhoneVerified,
  updateUserEmailIfMissing
} from '../models/user.model.js';
import { sendOtpSms, normalizePhoneNumber } from '../services/msg91.service.js';

const requestOtpSchema = z.object({
  phone: z.string().min(6, 'Phone number is required').max(20, 'Phone number is too long')
});

const verifyOtpSchema = z.object({
  phone: z.string().min(6, 'Phone number is required').max(20, 'Phone number is too long'),
  otp: z.string().min(4, 'OTP must be at least 4 digits').max(8, 'OTP must be at most 8 digits'),
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(255).optional()
});

const OTP_LENGTH = 6;
const OTP_MAX_RESENDS_PER_HOUR = 5;
const OTP_RESEND_INTERVAL_SECONDS = 60;
const OTP_MAX_VERIFY_ATTEMPTS = 5;

function generateOtp(length = OTP_LENGTH) {
  const min = 10 ** (length - 1);
  const max = (10 ** length) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function requiresProfileCompletion(user) {
  return !user?.email || !user?.name || user.name.toLowerCase().startsWith('fluence user');
}

export async function requestPhoneOtp(req, res, next) {
  try {
    const { phone } = requestOtpSchema.parse(req.body);
    const { msg91 } = getConfig();
    const normalizedPhone = normalizePhoneNumber(phone, msg91.defaultCountryCode);

    const existingToken = await getPhoneOtp(normalizedPhone);
    const now = Date.now();

    if (existingToken) {
      const lastSentAt = new Date(existingToken.last_sent_at).getTime();
      const oneHourAgo = now - 60 * 60 * 1000;

      if (now - lastSentAt < OTP_RESEND_INTERVAL_SECONDS * 1000) {
        throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Please wait before requesting another OTP');
      }

      if (lastSentAt > oneHourAgo && existingToken.resend_count >= OTP_MAX_RESENDS_PER_HOUR) {
        throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'OTP resend limit reached. Try again later.');
      }
    }

    const otp = generateOtp();
    const otpHash = await hashPassword(otp);
    const expiresAt = new Date(Date.now() + msg91.otpExpiryMinutes * 60 * 1000);
    const resetResendCount = !existingToken || (Date.now() - new Date(existingToken.last_sent_at).getTime()) > 60 * 60 * 1000;

    await sendOtpSms({ phone: normalizedPhone, otp });
    await upsertPhoneOtp({ phone: normalizedPhone, otpHash, expiresAt, resetResendCount });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid phone number', err.flatten()));
    }
    next(err);
  }
}

export async function verifyPhoneOtp(req, res, next) {
  try {
    const { phone, otp, name, email } = verifyOtpSchema.parse(req.body);
    const { msg91 } = getConfig();
    const normalizedPhone = normalizePhoneNumber(phone, msg91.defaultCountryCode);

    const tokenRecord = await getPhoneOtp(normalizedPhone);
    if (!tokenRecord) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP expired or not found. Please request a new OTP.');
    }

    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      await deletePhoneOtp(normalizedPhone);
      throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP has expired. Please request a new OTP.');
    }

    const otpMatches = await comparePassword(otp, tokenRecord.otp_hash);
    if (!otpMatches) {
      const updated = await incrementOtpRetry({ phone: normalizedPhone });
      if (updated && updated.retry_count >= OTP_MAX_VERIFY_ATTEMPTS) {
        await deletePhoneOtp(normalizedPhone);
        throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Too many invalid attempts. Please request a new OTP.');
      }
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid verification code');
    }

    await deletePhoneOtp(normalizedPhone);

    let user = await findUserByPhone(normalizedPhone);
    const normalizedEmail = email ? email.toLowerCase() : null;

    if (normalizedEmail) {
      const existingEmailUser = await findUserByEmail(normalizedEmail);
      if (existingEmailUser && (!user || existingEmailUser.id !== user.id)) {
        throw new ApiError(StatusCodes.CONFLICT, 'Email is already associated with another account');
      }
    }

    if (!user) {
      const placeholderPassword = await hashPassword(`otp-login-${randomUUID()}`);
      const defaultName = name?.trim() || `Fluence User ${normalizedPhone.slice(-4)}`;
      const fallbackEmail = normalizedEmail || `phone-user-${normalizedPhone}@pending.fluence`;

      user = await createUser({
        name: defaultName,
        email: fallbackEmail,
        password_hash: placeholderPassword,
        auth_provider: 'phone',
        phone: normalizedPhone,
        phone_verified_at: new Date(),
        status: 'active'
      });
    } else {
      await markPhoneVerified(user.id);
      if (normalizedEmail) {
        await updateUserEmailIfMissing(user.id, normalizedEmail);
      }
      user = await findUserById(user.id);
    }

    const token = signToken({
      sub: user.id,
      email: user.email || undefined,
      role: user.role
    });

    res.status(StatusCodes.OK).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneVerified: Boolean(user.phone_verified_at),
        emailVerified: Boolean(user.email_verified_at),
        status: user.status
      },
      requiresProfileCompletion: requiresProfileCompletion(user)
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid verification data', err.flatten()));
    }
    next(err);
  }
}

