import { StatusCodes } from 'http-status-codes';
import { signToken } from '../utils/jwt.js';

// Points Wallet Service URL
const POINTS_WALLET_SERVICE_URL = process.env.POINTS_WALLET_SERVICE_URL || 'http://localhost:4005';

export const WalletController = {
  /**
   * Return pending social posts awaiting verification.
   * Currently returns an empty array placeholder.
   * TODO: Integrate with social-features service to get actual pending posts
   */
  async getPendingSocialPosts(_req, res) {
    try {
      // Placeholder response; integrate with social-features service or DB later
      return res.status(StatusCodes.OK).json({
        success: true,
        data: [],
        message: 'No pending social posts (placeholder)'
      });
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch pending social posts',
        error: error.message
      });
    }
  },

  /**
   * Verify a social post associated with a cashback transaction.
   * This will:
   * 1. Call Points Wallet Service to find all pending points transactions with this referenceId
   * 2. Update their status from 'pending' to 'available'
   * 3. Mark social_post_verified = true
   * 4. The database trigger will automatically move points from pending_balance to available_balance
   */
  async verifySocialPost(req, res) {
    try {
      const { transactionId } = req.params;
      if (!transactionId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'transactionId is required'
        });
      }

      // Generate JWT for admin user to authenticate with Points Wallet Service
      const adminJwt = signToken({
        sub: req.user.id,
        email: req.user.email,
        role: 'admin'
      });

      // Call Points Wallet Service to verify social post and update transaction status
      const response = await fetch(
        `${POINTS_WALLET_SERVICE_URL}/api/points/verify-social/${transactionId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminJwt}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        return res.status(response.status).json({
          success: false,
          message: errorData.message || 'Failed to verify social post in Points Wallet Service',
          error: errorData.error || errorData.message
        });
      }

      const result = await response.json();

      return res.status(StatusCodes.OK).json({
        success: true,
        data: result.data,
        message: result.message || 'Social post verified successfully and points moved to available balance'
      });
    } catch (error) {
      console.error('Error verifying social post:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to verify social post',
        error: error.message
      });
    }
  }
};








