import { StatusCodes } from 'http-status-codes';
import { MerchantFundsModel } from '../models/merchant-funds.model.js';
import { ApiError } from '../middleware/error.js';

export class FundsController {
  /**
   * Get merchant funds
   */
  static async getFunds(req, res, next) {
    try {
      const merchantId = req.user.id; // Assuming merchant is authenticated
      
      const funds = await MerchantFundsModel.getFunds(merchantId);
      
      if (!funds) {
        // Create empty funds if doesn't exist
        const newFunds = await MerchantFundsModel.getOrCreateFunds(merchantId);
        return res.status(StatusCodes.OK).json({
          success: true,
          data: newFunds
        });
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: funds
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add funds to merchant account
   */
  static async addFunds(req, res, next) {
    try {
      const merchantId = req.user.id;
      const { amount, description } = req.body;
      
      if (!amount || amount <= 0) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Amount must be greater than 0');
      }
      
      const result = await MerchantFundsModel.addFunds(
        merchantId,
        amount,
        merchantId, // processedBy
        description || 'Funds added by merchant'
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: result.funds,
        transaction: result.transaction,
        message: 'Funds added successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update cashback percentage
   */
  static async updateCashbackPercentage(req, res, next) {
    try {
      const merchantId = req.user.id;
      const { percentage } = req.body;
      
      if (!percentage || percentage <= 0 || percentage > 100) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Percentage must be between 0 and 100');
      }
      
      const funds = await MerchantFundsModel.updateCashbackPercentage(merchantId, percentage);
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: funds,
        message: 'Cashback percentage updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fund transactions history
   */
  static async getFundTransactions(req, res, next) {
    try {
      const merchantId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;
      
      const { getPool } = await import('../config/database.js');
      const pool = getPool();
      
      // Get funds first
      const funds = await MerchantFundsModel.getFunds(merchantId);
      if (!funds) {
        return res.status(StatusCodes.OK).json({
          success: true,
          data: {
            transactions: [],
            pagination: { limit: parseInt(limit), offset: parseInt(offset), total: 0 }
          }
        });
      }
      
      // Get transactions
      const result = await pool.query(
        `SELECT * FROM budget_transactions 
         WHERE merchant_id = $1 AND budget_id = $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [merchantId, funds.id, parseInt(limit), parseInt(offset)]
      );
      
      // Get total count
      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM budget_transactions WHERE merchant_id = $1 AND budget_id = $2',
        [merchantId, funds.id]
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          transactions: result.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: parseInt(countResult.rows[0].total)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

