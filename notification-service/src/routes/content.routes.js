import { Router } from 'express';
import { verifyAuthToken, optionalAuth } from '../middleware/auth.js';
import { ContentController } from '../controllers/content.controller.js';
import { body, param, query } from 'express-validator';

const router = Router();

// Validation middleware
const contentIdValidation = [
  param('contentId').isUUID().withMessage('Invalid content ID')
];

const contentTypeValidation = [
  param('contentType').isIn(['help', 'faq']).withMessage('Invalid content type')
];

const createHelpValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
];

const createFAQValidation = [
  body('question').notEmpty().withMessage('Question is required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
];

const updateFAQValidation = [
  param('faqId').isUUID().withMessage('Invalid FAQ ID'),
  body('question').optional().notEmpty().withMessage('Question cannot be empty'),
  body('answer').optional().notEmpty().withMessage('Answer cannot be empty'),
  body('category').optional().notEmpty().withMessage('Category cannot be empty'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
];

const faqIdValidation = [
  param('faqId').isUUID().withMessage('Invalid FAQ ID')
];

const createTermsValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('version').notEmpty().withMessage('Version is required'),
  body('effectiveDate').isISO8601().withMessage('Effective date must be a valid date')
];

const createPrivacyValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('version').notEmpty().withMessage('Version is required'),
  body('effectiveDate').isISO8601().withMessage('Effective date must be a valid date')
];

const updateTemplateValidation = [
  param('templateId').isUUID().withMessage('Invalid template ID'),
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('subject').optional().notEmpty().withMessage('Subject cannot be empty'),
  body('template').optional().notEmpty().withMessage('Template cannot be empty'),
  body('variables').optional().isObject().withMessage('Variables must be an object'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
];

const queryValidation = [
  query('category').optional().isString().withMessage('Category must be a string'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('type').optional().isIn(['email', 'sms', 'push', 'in_app']).withMessage('Invalid type'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('version').optional().isString().withMessage('Version must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date')
];

// Public routes (no authentication required)
router.get('/help', queryValidation, ContentController.getHelpContent);
router.get('/faq', queryValidation, ContentController.getFAQContent);
router.get('/terms', queryValidation, ContentController.getTermsAndConditions);
router.get('/privacy', queryValidation, ContentController.getPrivacyPolicy);

// View count increment (optional auth)
router.use(optionalAuth());
router.post('/:contentType/:contentId/view', contentTypeValidation, contentIdValidation, ContentController.incrementViewCount);

// Admin routes (require authentication)
router.use(verifyAuthToken());

// Admin content management
router.post('/help', createHelpValidation, ContentController.createHelpContent);
router.post('/faq', createFAQValidation, ContentController.createFAQContent);
router.put('/faq/:faqId', updateFAQValidation, ContentController.updateFAQContent);
router.delete('/faq/:faqId', faqIdValidation, ContentController.deleteFAQContent);
router.post('/terms', createTermsValidation, ContentController.createTermsAndConditions);
router.post('/privacy', createPrivacyValidation, ContentController.createPrivacyPolicy);

// Admin notification template management
router.get('/templates', queryValidation, ContentController.getNotificationTemplates);
router.put('/templates/:templateId', updateTemplateValidation, ContentController.updateNotificationTemplate);

// Admin analytics
router.get('/analytics', queryValidation, ContentController.getContentAnalytics);

export default router;
