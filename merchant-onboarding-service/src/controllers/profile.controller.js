import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { MerchantProfileModel } from '../models/merchant-profile.model.js';
import { MerchantApplicationModel } from '../models/merchant-application.model.js';
import { uploadImageToFirebase, deleteImageFromFirebase } from '../services/firebase-storage.service.js';
import { uploadSingleImage, validateImageFile } from '../middleware/upload.middleware.js';

// Validation schemas
const profileUpdateSchema = z.object({
  businessName: z.string().min(1).max(255).optional(),
  businessType: z.enum(['retail', 'restaurant', 'service', 'ecommerce', 'other']).optional(),
  contactPerson: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().min(1).max(20).optional(),
  businessAddress: z.string().min(1).optional(),
  businessLicense: z.string().optional(),
  taxId: z.string().optional(),
  bankAccountDetails: z.object({
    accountNumber: z.string().optional(),
    bankName: z.string().optional(),
    routingNumber: z.string().optional()
  }).optional(),
  profileImageUrl: z.string().url().optional(),
  instagramId: z.string().max(255).optional().transform(val => val ? val.replace('@', '').toLowerCase() : null)
});

const paginationSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
});

const topMerchantsQuerySchema = z.object({
  limit: z.string().optional().transform((val) => {
    const parsed = val ? parseInt(val, 10) : 10;
    return Number.isNaN(parsed) || parsed <= 0 ? 10 : Math.min(parsed, 100);
  }),
  days: z.string().optional().transform((val) => {
    if (!val) return null;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  })
});

/**
 * Get merchant profile
 */
export async function getMerchantProfile(req, res, next) {
  try {
    const userId = req.user?.id;
    
    console.log('[GET_PROFILE] Request received:', {
      userId: userId,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      userIdType: typeof userId
    });
    
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not authenticated');
    }

    const profile = await MerchantProfileModel.getProfileByUserId(userId);
    
    console.log('[GET_PROFILE] Profile lookup result:', {
      userId: userId,
      profileFound: !!profile,
      profileId: profile?.id,
      profileUserId: profile?.user_id
    });
    
    if (!profile) {
      // Check if user has an application
      const applications = await MerchantApplicationModel.getApplicationByUserId(userId);
      
      console.log('[GET_PROFILE] Application lookup result:', {
        userId: userId,
        applicationsFound: applications?.length || 0
      });
      
      if (applications && applications.length > 0) {
        // Get the most recent application
        const latestApplication = applications[0];
        
        // Return helpful message based on application status
        const statusMessages = {
          'pending': 'Your merchant application is pending review. Your profile will be created once approved.',
          'approved': 'Your application has been approved, but your profile is being created. Please try again in a moment.',
          'rejected': 'Your merchant application was rejected. Please contact support for more information.'
        };
        
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          error: 'Merchant profile not found',
          message: statusMessages[latestApplication.status] || 'Your merchant application is being processed.',
          applicationStatus: latestApplication.status,
          applicationId: latestApplication.id
        });
      }
      
      // No application found
      throw new ApiError(StatusCodes.NOT_FOUND, 'Merchant profile not found. Please submit a merchant application first.');
    }

    // Get profile with application details
    const profileWithDetails = await MerchantProfileModel.getProfileWithApplication(profile.id);

    res.status(StatusCodes.OK).json({
      success: true,
      data: profileWithDetails
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update merchant profile
 */
export async function updateMerchantProfile(req, res, next) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not authenticated');
    }

    const updateData = profileUpdateSchema.parse(req.body);

    const profile = await MerchantProfileModel.getProfileByUserId(userId);
    
    if (!profile) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Merchant profile not found');
    }

    if (profile.status !== 'active') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot update inactive profile');
    }

    const updatedProfile = await MerchantProfileModel.updateProfile(profile.id, updateData);

    res.status(StatusCodes.OK).json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid profile data', err.flatten()));
    }
    next(err);
  }
}

/**
 * Get merchant profile by ID (admin only)
 */
export async function getMerchantProfileById(req, res, next) {
  try {
    const { profileId } = req.params;

    const profile = await MerchantProfileModel.getProfileById(profileId);
    
    if (!profile) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Merchant profile not found');
    }

    // Get profile with application details
    const profileWithDetails = await MerchantProfileModel.getProfileWithApplication(profileId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: profileWithDetails
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get merchant profile by Instagram ID (public endpoint for auto-linking)
 * This endpoint is PUBLIC and does NOT require authentication
 */
export async function getMerchantProfileByInstagramId(req, res, next) {
  try {
    console.log(`[PUBLIC-ENDPOINT] /by-instagram called with instagramId: ${req.params.instagramId}`);
    const { instagramId } = req.params;

    const profile = await MerchantProfileModel.getProfileByInstagramId(instagramId);
    
    if (!profile) {
      console.log(`[PUBLIC-ENDPOINT] Merchant not found for instagramId: ${instagramId}`);
      throw new ApiError(StatusCodes.NOT_FOUND, 'Merchant profile not found');
    }

    console.log(`[PUBLIC-ENDPOINT] Found merchant: ${profile.id} for instagramId: ${instagramId}`);
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        id: profile.id,
        businessName: profile.business_name,
        instagramId: profile.instagram_id
      }
    });
  } catch (err) {
    console.error(`[PUBLIC-ENDPOINT] Error in getMerchantProfileByInstagramId:`, err.message);
    next(err);
  }
}

/**
 * Get top merchants ranked by cashback awarded (public endpoint)
 */
export async function getTopMerchantsByCashback(req, res, next) {
  try {
    const { limit, days } = topMerchantsQuerySchema.parse(req.query);

    const merchants = await MerchantProfileModel.getTopMerchantsByCashback(limit, {
      timeframeDays: days
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: merchants,
      metadata: {
        limit,
        timeframeDays: days
      },
      message: 'Top merchants ranked by cashback awarded'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid query parameters', err.flatten()));
    }
    next(err);
  }
}

/**
 * Get all merchant profiles (admin only)
 */
export async function getAllMerchantProfiles(req, res, next) {
  try {
    const { limit, offset } = paginationSchema.parse(req.query);
    const status = req.query.status;

    const profiles = await MerchantProfileModel.getAllProfiles(limit, offset, status);

    res.status(StatusCodes.OK).json({
      success: true,
      data: profiles,
      pagination: {
        limit,
        offset,
        hasMore: profiles.length === limit
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid pagination parameters', err.flatten()));
    }
    next(err);
  }
}

/**
 * Get active merchant profiles
 */
export async function getActiveMerchantProfiles(req, res, next) {
  try {
    const { limit, offset } = paginationSchema.parse(req.query);

    const profiles = await MerchantProfileModel.getActiveProfiles(limit, offset);

    res.status(StatusCodes.OK).json({
      success: true,
      data: profiles,
      pagination: {
        limit,
        offset,
        hasMore: profiles.length === limit
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid pagination parameters', err.flatten()));
    }
    next(err);
  }
}

/**
 * Get merchant profiles by business type
 */
export async function getMerchantProfilesByBusinessType(req, res, next) {
  try {
    const { businessType } = req.params;
    const { limit, offset } = paginationSchema.parse(req.query);

    if (!['retail', 'restaurant', 'service', 'ecommerce', 'other'].includes(businessType)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid business type');
    }

    const profiles = await MerchantProfileModel.getProfilesByBusinessType(businessType, limit, offset);

    res.status(StatusCodes.OK).json({
      success: true,
      data: profiles,
      pagination: {
        limit,
        offset,
        hasMore: profiles.length === limit
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid pagination parameters', err.flatten()));
    }
    next(err);
  }
}

/**
 * Get merchant profile statistics
 */
export async function getMerchantProfileStats(req, res, next) {
  try {
    const stats = await MerchantProfileModel.getProfileStats();

    res.status(StatusCodes.OK).json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Search merchant profiles
 */
export async function searchMerchantProfiles(req, res, next) {
  try {
    const { searchTerm } = req.query;
    const { limit, offset } = paginationSchema.parse(req.query);

    if (!searchTerm) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Search term is required');
    }

    const profiles = await MerchantProfileModel.searchProfiles(searchTerm, limit, offset);

    res.status(StatusCodes.OK).json({
      success: true,
      data: profiles,
      pagination: {
        limit,
        offset,
        hasMore: profiles.length === limit
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid pagination parameters', err.flatten()));
    }
    next(err);
  }
}

/**
 * Get merchant profile with activity
 */
export async function getMerchantProfileWithActivity(req, res, next) {
  try {
    const { profileId } = req.params;
    const days = parseInt(req.query.days) || 30;

    const profile = await MerchantProfileModel.getProfileWithActivity(profileId, days);
    
    if (!profile) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Merchant profile not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: profile
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update merchant profile status (admin only)
 */
export async function updateMerchantProfileStatus(req, res, next) {
  try {
    const { profileId } = req.params;
    const { status } = req.body;
    const adminId = req.user?.id;
    
    if (!adminId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Admin not authenticated');
    }

    if (!['active', 'suspended', 'inactive'].includes(status)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid status');
    }

    const profile = await MerchantProfileModel.getProfileById(profileId);
    
    if (!profile) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Merchant profile not found');
    }

    const updatedProfile = await MerchantProfileModel.updateProfileStatus(profileId, status, adminId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: updatedProfile,
      message: `Profile status updated to ${status}`
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Upload merchant profile image (public endpoint, no auth required)
 */
export async function uploadProfileImage(req, res, next) {
  try {
    const { merchantId } = req.params;
    
    if (!merchantId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Merchant ID is required');
    }

    if (!req.file) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'No image file provided');
    }

    // Get merchant profile by ID
    const profile = await MerchantProfileModel.getProfileById(merchantId);
    
    if (!profile) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Merchant profile not found');
    }

    if (profile.status !== 'active') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot update image for inactive profile');
    }

    // Validate image file magic numbers for additional security
    try {
      validateImageFile(req.file.buffer);
    } catch (validationError) {
      throw new ApiError(StatusCodes.BAD_REQUEST, validationError.message);
    }

    let imageUrl = null;
    const oldImageUrl = profile.profile_image_url;

    try {
      // Upload new image to Firebase Storage
      imageUrl = await uploadImageToFirebase(
        req.file.buffer,
        req.file.originalname,
        'merchant-profiles'
      );

      // Update profile with new image URL
      const updatedProfile = await MerchantProfileModel.updateProfile(profile.id, {
        profileImageUrl: imageUrl
      });

      // Delete old image from Firebase Storage (non-blocking)
      if (oldImageUrl) {
        deleteImageFromFirebase(oldImageUrl).catch(err => {
          console.error('Failed to delete old image:', err);
          // Don't fail the request if old image deletion fails
        });
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: updatedProfile,
        message: 'Profile image uploaded successfully'
      });
    } catch (uploadError) {
      // If database update fails after upload, try to delete the uploaded image
      if (imageUrl) {
        deleteImageFromFirebase(imageUrl).catch(err => {
          console.error('Failed to cleanup uploaded image:', err);
        });
      }
      throw uploadError;
    }
  } catch (err) {
    next(err);
  }
}

// Export middleware for use in routes
export { uploadSingleImage };
