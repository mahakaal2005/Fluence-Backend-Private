import express from 'express';
import { TransactionController } from '../controllers/transaction.controller.js';
import { verifyAuthToken, requireAdmin } from '../middleware/auth.js';
import { body, param, query } from 'express-validator';

const router = express.Router();

// Validation middleware
const createTransactionValidation = [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('type').isIn(['cashback', 'payment', 'refund']).withMessage('Invalid transaction type'),
  body('customerId').isUUID().withMessage('customerId is required and must be a valid UUID'),
  body('merchantId').isUUID().withMessage('merchantId is required and must be a valid UUID'),
  body('cashbackPercentage').optional().isFloat({ min: 0.01, max: 100 }).withMessage('Cashback percentage must be between 0.01 and 100'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
];

const updateTransactionValidation = [
  param('id').isUUID().withMessage('Invalid transaction ID'),
  body('amount').optional().isNumeric().withMessage('Amount must be a number'),
  body('type').optional().isIn(['cashback', 'payment', 'refund']).withMessage('Invalid transaction type'),
  body('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
];

const transactionIdValidation = [
  param('id').isUUID().withMessage('Invalid transaction ID')
];

const queryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('status').optional().isIn(['pending', 'processed', 'failed', 'disputed']).withMessage('Invalid status'),
  query('type').optional().isIn(['cashback', 'payment', 'refund']).withMessage('Invalid transaction type'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date')
];

const analyticsValidation = [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('type').optional().isIn(['cashback', 'payment', 'refund']).withMessage('Invalid transaction type')
];

// Routes
router.post('/', verifyAuthToken(), createTransactionValidation, TransactionController.createTransaction);
router.get('/', verifyAuthToken(), queryValidation, TransactionController.getTransactions);
router.get('/analytics', verifyAuthToken(), analyticsValidation, TransactionController.getTransactionAnalytics);
router.get('/:id', verifyAuthToken(), transactionIdValidation, TransactionController.getTransactionById);
router.put('/:id', verifyAuthToken(), requireAdmin(), updateTransactionValidation, TransactionController.updateTransaction);
router.delete('/:id', verifyAuthToken(), requireAdmin(), transactionIdValidation, TransactionController.deleteTransaction);
router.post('/:id/process', verifyAuthToken(), requireAdmin(), transactionIdValidation, TransactionController.processTransaction);

export default router;