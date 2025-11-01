import { StatusCodes } from 'http-status-codes';
import { PointsTransactionModel } from '../models/points-transaction.model.js';
import { ApiError } from '../middleware/error.js';
import { getPool } from '../config/database.js';
import { WalletBalanceModel } from '../models/wallet-balance.model.js';
import { PointsService } from '../services/points.service.js';


export class PointsController {
  /**
   * Earn points for user
   */
  static async earnPoints(req, res, next) {
    try {
      const userId = req.user.id;
      const { 
        amount, 
        transactionType, 
        description, 
        referenceId,
        socialPostRequired,
        timeBufferEndsAt = null,
        expiresAt = null
      } = req.body;
      
      if (!amount || amount <= 0) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid amount is required');
      }
      
      if (!transactionType) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Transaction type is required');
      }
      
      // Determine if social post is required (default to true for cashback transactions)
      const requiresSocialPost = (socialPostRequired !== undefined)
        ? socialPostRequired
        : (transactionType === 'cashback');

      // Use PointsService.awardPoints() which handles notifications
      // Note: PointsService.awardPoints doesn't support timeBufferEndsAt/expiresAt yet
      // So we'll call the model directly for those cases, but still send notifications
      let transaction;
      if (timeBufferEndsAt || expiresAt) {
        // If we have time buffer or expiration, we need to use the model directly
        // but still send notifications manually
        transaction = await PointsTransactionModel.createTransaction({
          userId,
          amount,
          transactionType,
          description,
          referenceId,
          socialPostRequired: requiresSocialPost,
          timeBufferEndsAt,
          expiresAt
        });

        // Send notifications manually since we bypassed the service
        try {
          const { NotificationClient } = await import('../services/notification.client.js');
          if (amount > 0) {
            await NotificationClient.sendPointsAvailableNotification(userId, amount, description || 'Points earned');
            
            if (requiresSocialPost) {
              await NotificationClient.sendSocialPostReminder(userId, transaction.id, description || 'Points earned');
            }
          }
        } catch (notificationErr) {
          console.error('Failed to send notification for points award:', notificationErr.message);
        }
      } else {
        // Use the service method which handles notifications automatically
        transaction = await PointsService.awardPoints(
          userId,
          amount,
          transactionType,
          description || 'Points earned',
          referenceId,
          requiresSocialPost
        );
      }

      // Explicitly reflect pending points in wallet_balances (in addition to DB trigger)
      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO wallet_balances (user_id, pending_balance, last_updated_at, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW(), NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             pending_balance = wallet_balances.pending_balance + EXCLUDED.pending_balance,
             last_updated_at = NOW(),
             updated_at = NOW()`,
          [userId, parseInt(amount, 10)]
        );
      } catch (balanceErr) {
        // Do not fail earn if balance update fails; background reconciliation will pick it up
        console.error('Failed to update pending_balance for user', userId, balanceErr);
      }
      
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: transaction,
        message: 'Points earned successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's points transactions
   */
  static async getPointsTransactions(req, res, next) {
    try {
      const userId = req.user.id;
      const { 
        limit = 50, 
        offset = 0, 
        transactionType, 
        status, 
        startDate, 
        endDate 
      } = req.query;
      
      const filters = {
        transactionType,
        status,
        startDate,
        endDate
      };
      
      const transactions = await PointsTransactionModel.getTransactionsByUserId(
        userId, 
        parseInt(limit), 
        parseInt(offset), 
        filters
      );
      
      // Clean up descriptions to remove transaction IDs and ensure transaction_id field is present
      const cleanedTransactions = transactions.map(transaction => {
        // Remove transaction ID from description if present (e.g., "Cashback pending (txn ...)" -> "Cashback pending")
        let cleanedDescription = transaction.description || '';
        cleanedDescription = cleanedDescription.replace(/\s*\(txn\s+[^)]+\)/gi, '');
        
        return {
          ...transaction,
          description: cleanedDescription,
          transaction_id: transaction.reference_id || null // Add transaction_id field for clarity
        };
      });
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: cleanedTransactions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: cleanedTransactions.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get points transaction by ID
   */
  static async getPointsTransactionById(req, res, next) {
    try {
      const { transactionId } = req.params;
      
      const transaction = await PointsTransactionModel.getTransactionById(transactionId);
      
      if (!transaction) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Transaction not found');
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: transaction
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update transaction status
   */
  static async updateTransactionStatus(req, res, next) {
    try {
      const { transactionId } = req.params;
      const { status, processedAt } = req.body;
      
      if (!status) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Status is required');
      }
      
      const transaction = await PointsTransactionModel.updateTransactionStatus(
        transactionId, 
        status, 
        processedAt
      );
      
      if (!transaction) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Transaction not found');
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: transaction,
        message: 'Transaction status updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update social post status
   */
  static async updateSocialPostStatus(req, res, next) {
    try {
      const { transactionId } = req.params;
      const { socialPostMade, socialPostUrl, socialPostVerified } = req.body;
      
      const transaction = await PointsTransactionModel.updateSocialPostStatus(
        transactionId, 
        socialPostMade, 
        socialPostUrl, 
        socialPostVerified
      );
      
      if (!transaction) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Transaction not found');
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: transaction,
        message: 'Social post status updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify social post by reference ID (cashback transaction ID)
   * This updates all pending points transactions with the given referenceId
   * to 'available' status and marks social_post_verified = true
   */
  static async verifySocialPostByReferenceId(req, res, next) {
    try {
      const referenceId = req.params.id; // ✅ get from params (NOT 'id' variable)
  
      if (!referenceId) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Reference ID (transactionId) is required');
      }
  
      // 1️⃣ Get pending transactions for this referenceId
      const pendingTransactions = await PointsTransactionModel.getTransactionsByReferenceId(referenceId);
      const filteredPending = pendingTransactions.filter(t => t.status === 'pending');
  
      if (filteredPending.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'No pending transactions found for this reference ID');
      }
  
      const pool = getPool();
      const updatedTransactions = [];
      // Track users and their total points to send notifications once per user
      const userPointsMap = new Map(); // userId -> { totalPoints, description }

      // 2️⃣ Process each transaction
      for (const transaction of filteredPending) {
        const { user_id, amount, description } = transaction;

        // Get current wallet balance
        const walletResult = await pool.query(
          `SELECT available_balance, pending_balance, total_earned, total_redeemed, total_expired
           FROM wallet_balances WHERE user_id = $1`,
          [user_id]
        );

        if (walletResult.rows.length === 0) {
          console.warn(`⚠️ No wallet found for user ${user_id}, skipping transaction ${transaction.id}`);
          continue;
        }

        const wallet = walletResult.rows[0];
        //REMINDER: here i want to print wallet amount before and after the update
        console.log('amount: ', amount);
        console.log(`Wallet amount before update: ${wallet.available_balance}`);
        // 3️⃣ Compute updated balances
        // Note: Points are moved from pending to available by the database trigger
        const updatedBalance = {
          availableBalance: Number(wallet.available_balance) , // Points moved to available
          pendingBalance: Math.max(0, Number(wallet.pending_balance) - Number(amount)),
          totalEarned: Number(wallet.total_earned),
          totalRedeemed: Number(wallet.total_redeemed),
          totalExpired: Number(wallet.total_expired)
        };

        // 4️⃣ Update wallet balance before confirming the transaction
        const updatedWallet = await WalletBalanceModel.updateWalletBalance(user_id, updatedBalance);

        if (!updatedWallet) {
          console.error(`❌ Failed to update wallet for user ${user_id}, skipping transaction ${transaction.id}`);
          continue;
        }
        
        console.log(`Wallet amount after update: ${updatedBalance.availableBalance}`);

        // 5️⃣ Mark transaction as available and update description
        // Update description to reflect that cashback is now available (not pending)
        const updatedDescription = description && description.includes('pending')
          ? description.replace(/pending/gi, 'available').replace(/Cashback pending/gi, 'Cashback available')
          : (description || 'Cashback available');
        
        const result = await pool.query(
          `UPDATE points_transactions 
           SET status = 'available',
               social_post_verified = true,
               description = $2,
               processed_at = NOW(),
               updated_at = NOW()
           WHERE id = $1 AND status = 'pending'
           RETURNING *`,
          [transaction.id, updatedDescription]
        );

        if (result.rows.length > 0) {
          const updatedTransaction = result.rows[0];
          updatedTransactions.push(updatedTransaction);
          
          // Use description from the updated transaction
          const finalDescription = updatedTransaction.description || 'Cashback available';
          
          // Track points per user for notifications
          if (userPointsMap.has(user_id)) {
            const existing = userPointsMap.get(user_id);
            // existing.totalPoints += Number(amount);
            // Update description to reflect the updated transaction (use the latest one)
            existing.description = finalDescription;
          } else {
            userPointsMap.set(user_id, {
              totalPoints: Number(amount),
              description: finalDescription
            });
          }
        }
      }

      if (updatedTransactions.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'No transactions were updated');
      }

      // 6️⃣ Send notifications for each user
      try {
        const { NotificationClient } = await import('../services/notification.client.js');
        const adminId = req.user?.id || 'system';
        
        // Send notifications for each unique user
        for (const [userId, { totalPoints, description }] of userPointsMap.entries()) {
          // Send social post verified notification
          await NotificationClient.sendSocialPostVerifiedNotification(
            userId,
            referenceId,
            totalPoints,
            adminId
          );
          
          // Send points available notification
          await NotificationClient.sendPointsAvailableNotification(
            userId,
            totalPoints,
            description,
            adminId
          );
        }
      } catch (notificationErr) {
        // Do not block verification if notification fails
        console.error('Failed to send verification notifications:', notificationErr.message);
      }

      // 7️⃣ Respond with summary
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          referenceId,
          updatedCount: updatedTransactions.length,
          transactions: updatedTransactions
        },
        message: `Successfully verified ${updatedTransactions.length} transaction(s) and updated wallet balances`
      });
    } catch (error) {
      next(error);
    }
  }
  
  

  /**
   * Get transactions requiring social posts
   */
  static async getTransactionsRequiringSocialPosts(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;
      
      const transactions = await PointsTransactionModel.getTransactionsRequiringSocialPosts(
        userId, 
        parseInt(limit), 
        parseInt(offset)
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: transactions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: transactions.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transactions in time buffer
   */
  static async getTransactionsInTimeBuffer(req, res, next) {
    try {
      const userId = req.user.id;
      
      const transactions = await PointsTransactionModel.getTransactionsInTimeBuffer(userId);
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: transactions
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get points transaction statistics
   */
  static async getPointsTransactionStats(req, res, next) {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      
      const stats = await PointsTransactionModel.getTransactionStats(
        userId, 
        startDate, 
        endDate
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get daily transaction summary
   */
  static async getDailyTransactionSummary(req, res, next) {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Start date and end date are required');
      }
      
      const summary = await PointsTransactionModel.getDailyTransactionSummary(
        userId, 
        startDate, 
        endDate
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get total points earned
   */
  static async getTotalPointsEarned(req, res, next) {
    try {
      const userId = req.user.id;
      
      const totalEarned = await PointsTransactionModel.getTotalPointsEarned(userId);
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          totalEarned
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get total points redeemed
   */
  static async getTotalPointsRedeemed(req, res, next) {
    try {
      const userId = req.user.id;
      
      const totalRedeemed = await PointsTransactionModel.getTotalPointsRedeemed(userId);
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          totalRedeemed
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transactions by reference ID
   */
  static async getTransactionsByReferenceId(req, res, next) {
    try {
      const { referenceId } = req.params;
      
      const transactions = await PointsTransactionModel.getTransactionsByReferenceId(referenceId);
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: transactions
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete transaction (only if pending)
   */
  static async deleteTransaction(req, res, next) {
    try {
      const userId = req.user.id;
      const { transactionId } = req.params;
      
      const transaction = await PointsTransactionModel.deleteTransaction(transactionId, userId);
      
      if (!transaction) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Transaction not found or cannot be deleted');
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: transaction,
        message: 'Transaction deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
