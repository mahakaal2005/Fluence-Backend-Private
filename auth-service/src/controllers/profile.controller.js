import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { updateUserProfile, findUserById } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import { isProfileComplete } from '../utils/profile.js';

const profileSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  phone: z.string().min(7).max(20).optional().nullable(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/ , 'date_of_birth must be YYYY-MM-DD')
    .optional()
    .nullable()
});

export async function getProfile(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    // Get user profile
    const user = await findUserById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        date_of_birth: user.date_of_birth || null,
        created_at: user.created_at,
        fluence_score: user.fluence_score || 0
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function completeProfile(req, res, next) {
  try {
    const { name, email, phone, date_of_birth } = profileSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    // Check if user exists and needs profile completion
    const user = await findUserById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    // Update user profile
    const updatedUser = await updateUserProfile(userId, name, email, phone ?? null, date_of_birth ?? null);

    // Generate new token with updated email
    const token = signToken({ sub: updatedUser.id, email: updatedUser.email });

    // Check if profile is complete
    const profileComplete = isProfileComplete(updatedUser);

    res.status(StatusCodes.OK).json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || null,
        date_of_birth: updatedUser.date_of_birth || null,
        created_at: updatedUser.created_at
      },
      token,
      completeProfile: profileComplete,
      message: 'Profile completed successfully'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid profile data', err.flatten()));
    }
    next(err);
  }
}


