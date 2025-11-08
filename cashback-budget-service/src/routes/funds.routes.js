import { Router } from 'express';
import { FundsController } from '../controllers/funds.controller.js';
import { verifyAuthToken } from '../middleware/auth.js';
import { body } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(verifyAuthToken());

// Validation middleware
const addFundsValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description').optional().isString().withMessage('Description must be a string')
];

const updatePercentageValidation = [
  body('percentage').isFloat({ min: 0.01, max: 100 }).withMessage('Percentage must be between 0.01 and 100')
];

// Routes
router.get('/', FundsController.getFunds);
router.post('/add', addFundsValidation, FundsController.addFunds);
router.put('/cashback-percentage', updatePercentageValidation, FundsController.updateCashbackPercentage);
router.get('/transactions', FundsController.getFundTransactions);

export default router;

