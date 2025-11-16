import { StatusCodes } from 'http-status-codes';
import { signToken } from '../utils/jwt.js';
import { getConfig } from '../config/index.js';
console.log('✅ signToken import check:', typeof signToken);

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
      const { postId } = req.params;
      if (!postId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'postId is required'
        });
      }

      // Generate JWT for admin user to authenticate with Points Wallet Service
      const adminJwt = signToken({
        sub: req.user.id,
        email: req.user.email,
        role: 'admin'
      });

      // Call Social Features Service to update post status to approved
      const config = getConfig();
      const response = await fetch(
        `${config.services.social}/api/social/posts/${postId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminJwt}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'approved'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        return res.status(response.status).json({
          success: false,
          message: errorData.message || 'Failed to verify social post in Social Features Service',
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








