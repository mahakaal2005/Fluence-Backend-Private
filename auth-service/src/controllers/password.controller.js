import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { findUserByEmail } from '../models/user.model.js';
import { comparePassword } from '../utils/crypto.js';
import { signToken } from '../utils/jwt.js';
import { ApiError } from '../middleware/error.js';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required')
});

export async function loginWithPassword(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await findUserByEmail(email);
    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
    }

    if (!user.password_hash) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Password login not enabled for this account');
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
    }

    if (user.status && user.status === 'blocked') {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Account is blocked');
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    res.status(StatusCodes.OK).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      },
      token
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid input data', err.flatten()));
    }
    next(err);
  }
}
















