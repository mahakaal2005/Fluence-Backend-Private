import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { MerchantApplicationModel } from '../models/merchant-application.model.js';
import { NotificationService } from '../services/notification.service.js';

function formatAddressString(addressValue) {
  try {
    const obj = typeof addressValue === 'string' ? JSON.parse(addressValue) : addressValue;
    if (!obj || typeof obj !== 'object') return String(addressValue || '');
    const parts = [obj.street, obj.city, obj.state, obj.zipCode, obj.country]
      .filter(Boolean)
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0);
    return parts.join(', ');
  } catch {
    return String(addressValue || '');
  }
}

// Validation schemas
const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  country: z.string().min(1)
});

const applicationSchema = z.object({
  businessName: z.string().min(1).max(255),
  businessType: z.enum([
    // Updated to match Flutter app categories
    '🎨 Fashion & Beauty',
    '🍔 Food & Beverage',
    '🛒 Retail & Shopping',
    '💻 Electronics & Tech',
    '🏥 Health & Wellness',
    '🏠 Home & Lifestyle',
    '📚 Education & Books',
    '🎮 Entertainment & Gaming',
    '🚗 Automotive',
    '✈️ Travel & Tourism',
    '💪 Fitness & Sports',
    '🐾 Pets & Animals',
    '🔧 Services & Repair',
    '📱 Telecom & Mobile',
    '💎 Jewelry & Accessories',
    '🎭 Arts & Crafts',
    '🏗️ Construction & Hardware',
    '📦 Wholesale & Distribution',
    '🌱 Organic & Natural',
    '🎉 Events & Celebrations',
    // Keep legacy values for backward compatibility
    'retail', 'restaurant', 'service', 'ecommerce', 'other'
  ]),
  contactPerson: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().min(1).max(20),
  businessAddress: addressSchema,
  businessLicense: z.string().optional(),
  taxId: z.string().optional(),
  bankAccountDetails: z.object({
    accountNumber: z.string().optional(),
    bankName: z.string().optional(),
    routingNumber: z.string().optional()
  }).optional()
});

const updateApplicationSchema = applicationSchema.partial();

const statusUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
  adminNotes: z.string().optional()
});

/**
 * Submit new merchant application
 */
export async function submitApplication(req, res, next) {
  try {
    const applicationData = applicationSchema.parse(req.body);

    // Ensure only one application per email (pending or approved)
    const existsForEmail = await MerchantApplicationModel.hasExistingApplicationByEmail(applicationData.email);
    if (existsForEmail) {
      throw new ApiError(StatusCodes.CONFLICT, 'An application already exists for this email');
    }

    const application = await MerchantApplicationModel.createApplication(applicationData);

    // Format address for response
    if (application && application.business_address) {
      application.business_address = formatAddressString(application.business_address);
    }

    // Send notifications
    try {
      // Send email notification (existing functionality)
      await NotificationService.sendApplicationSubmittedNotification(application);
    } catch (notificationError) {
      console.warn('Failed to send email notification:', notificationError.message);
      // Don't fail the application if notification fails
    }

    // Send in-app notification to applicant and admins
    try {
      const { NotificationClient } = await import('../services/notification.client.js');

      // Get user ID from request (if authenticated)
      const userId = req.user?.id;

      // Send notification to applicant if they're logged in
      if (userId) {
        await NotificationClient.sendApplicationSubmittedNotification(
          userId,
          application,
          'merchant-onboarding-service'
        );
      }

      // Send notification to all admins
      await NotificationClient.sendAdminNewMerchantApplicationNotification(
        {
          applicationId: application.id,
          businessName: application.business_name,
          businessType: application.business_type,
          contactPerson: application.contact_person,
          email: application.email
        },
        userId || 'merchant-onboarding-service'
      );
    } catch (notificationError) {
      console.warn('Failed to send in-app notifications:', notificationError.message);
      // Don't fail the application if notification fails
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: application,
      message: 'Application submitted successfully'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid application data', err.flatten()));
    }
    next(err);
  }
}

/**
 * Get user's applications
 */
export async function getUserApplications(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not authenticated');
    }

    const applications = await MerchantApplicationModel.getApplicationByUserId(userId);

    const formatted = (applications || []).map((a) => ({
      ...a,
      business_address: formatAddressString(a.business_address)
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: formatted
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get specific application
 */
export async function getApplication(req, res, next) {
  try {
    const { applicationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not authenticated');
    }

    const application = await MerchantApplicationModel.getApplicationById(applicationId);

    if (!application) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Application not found');
    }

    // Check if user owns this application (unless admin)
    if (application.user_id !== userId && req.user?.role !== 'admin') {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Access denied');
    }

    // Get status history
    const statusHistory = await MerchantApplicationModel.getApplicationStatusHistory(applicationId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ...application,
        business_address: formatAddressString(application.business_address),
        statusHistory
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update application (only if pending)
 */
export async function updateApplication(req, res, next) {
  try {
    const { applicationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not authenticated');
    }

    const updateData = updateApplicationSchema.parse(req.body);

    const application = await MerchantApplicationModel.getApplicationById(applicationId);

    if (!application) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Application not found');
    }

    if (application.user_id !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Access denied');
    }

    if (application.status !== 'pending') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot update application that is not pending');
    }

    const updatedApplication = await MerchantApplicationModel.updateApplication(applicationId, updateData);

    if (updatedApplication && updatedApplication.business_address) {
      updatedApplication.business_address = formatAddressString(updatedApplication.business_address);
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: updatedApplication,
      message: 'Application updated successfully'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid update data', err.flatten()));
    }
    next(err);
  }
}

/**
 * Delete application (only if pending)
 */
export async function deleteApplication(req, res, next) {
  try {
    const { applicationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not authenticated');
    }

    const deletedApplication = await MerchantApplicationModel.deleteApplication(applicationId, userId);

    if (!deletedApplication) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Application not found or cannot be deleted');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Application deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get application statistics
 */
export async function getApplicationStats(req, res, next) {
  try {
    const stats = await MerchantApplicationModel.getApplicationStats();

    res.status(StatusCodes.OK).json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get applications requiring review (SLA check)
 */
export async function getApplicationsRequiringReview(req, res, next) {
  try {
    const slaHours = parseInt(req.query.slaHours) || 48;
    const applications = await MerchantApplicationModel.getApplicationsRequiringReview(slaHours);

    const formatted = (applications || []).map((a) => ({
      ...a,
      business_address: formatAddressString(a.business_address)
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: formatted,
      count: formatted.length
    });
  } catch (err) {
    next(err);
  }
}
