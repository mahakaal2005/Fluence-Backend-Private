import express from 'express';
import { BudgetController } from '../controllers/budget.controller.js';
import { verifyAuthToken } from '../middleware/auth.js';
import { body, param, query } from 'express-validator';

const router = express.Router();

// Validation middleware
const createBudgetValidation = [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code')
];

const updateBudgetValidation = [
  param('id').isUUID().withMessage('Invalid budget ID'),
  body('name').optional().notEmpty().withMessage('Budget name cannot be empty'),
  body('amount').optional().isNumeric().withMessage('Amount must be a number'),
  body('currency').optional().isString().withMessage('Currency must be a string'),
  body('description').optional().isString().withMessage('Description must be a string')
];

const budgetIdValidation = [
  param('id').isUUID().withMessage('Invalid budget ID')
];

const queryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'completed']).withMessage('Invalid status')
];

// Routes
router.post('/', verifyAuthToken(), createBudgetValidation, BudgetController.createBudget);
router.get('/', verifyAuthToken(), queryValidation, BudgetController.getUserBudgets);
router.get('/:id', verifyAuthToken(), budgetIdValidation, BudgetController.getBudgetById);
router.put('/:id', verifyAuthToken(), updateBudgetValidation, BudgetController.updateBudget);
router.delete('/:id', verifyAuthToken(), budgetIdValidation, BudgetController.deleteBudget);
router.get('/:id/analytics', verifyAuthToken(), budgetIdValidation, BudgetController.getBudgetAnalytics);

export default router;