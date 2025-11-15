import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { findUserByEmail, createUser } from '../models/user.model.js';
import { hashPassword } from '../utils/crypto.js';
import { signToken } from '../utils/jwt.js';
import { ApiError } from '../middleware/error.js';
import { isProfileComplete } from '../utils/profile.js';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120, 'Name must be less than 120 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().min(7).max(20).optional().nullable()
});

export async function signup(req, res, next) {
  try {
    const { name, email, password, phone } = signupSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'User with this email already exists');
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const { findUserByPhone } = await import('../models/user.model.js');
      const existingPhoneUser = await findUserByPhone(phone);
      if (existingPhoneUser) {
        throw new ApiError(StatusCodes.CONFLICT, 'Phone number already exists');
      }
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    let user;
    try {
      user = await createUser({
        name,
        email,
        password_hash,
        auth_provider: 'password',
        phone: phone || null,
        role: 'user',
        status: 'active',
        is_approved: false
      });
    } catch (dbError) {
      // Handle database unique constraint violation
      if (dbError.code === '23505' && dbError.constraint === 'users_phone_key') {
        throw new ApiError(StatusCodes.CONFLICT, 'Phone number already taken');
      }
      if (dbError.code === '23505' && dbError.constraint === 'users_email_key') {
        throw new ApiError(StatusCodes.CONFLICT, 'Email already exists');
      }
      throw dbError;
    }

    // Generate JWT token
    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    // Check if profile is complete
    const profileComplete = isProfileComplete(user);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        status: user.status
      },
      token,
      completeProfile: profileComplete
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid input data', err.flatten()));
    }
    next(err);
  }
}

