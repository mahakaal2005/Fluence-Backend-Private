import { StatusCodes } from 'http-status-codes';
import { getPool } from '../config/database.js';
import { ApiError } from '../middleware/error.js';
import crypto from 'crypto';

export class AdminSocialController {
  /**
   * Get all posts pending review (admin only)
   */
  static async getPendingPosts(req, res, next) {
    try {
      console.log('📝 [POSTS] Get pending posts request');
      console.log('   Query params:', req.query);
      console.log('   Admin user:', req.user);

      const { limit = 50, offset = 0, platformId, status } = req.query;
      const pool = getPool();

      let query = `
        SELECT 
          sp.*,
          sa.username,
          sa.display_name,
          sa.profile_picture_url,
          pl.name as platform_name,
          pl.display_name as platform_display_name
        FROM social_posts sp
        JOIN social_accounts sa ON sp.social_account_id = sa.id
        JOIN social_platforms pl ON sa.platform_id = pl.id
        WHERE sp.status = 'pending_review'
      `;

      let params = [];
      let paramCount = 0;

      if (platformId) {
        paramCount++;
        query += ` AND sa.platform_id = $${paramCount}`;
        params.push(platformId);
      }

      if (status) {
        paramCount++;
        query += ` AND sp.status = $${paramCount}`;
        params.push(status);
      }

      query += ` ORDER BY sp.created_at ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      console.log('🔍 [POSTS] Executing query');
      const posts = await pool.query(query, params);
      console.log('✅ [POSTS] Found', posts.rows.length, 'posts');

      // Check for duplicates for each post
      const postsWithDuplicateCheck = await Promise.all(
        posts.rows.map(async (post) => {
          if (!post.content_hash) {
            // Generate hash if missing
            post.content_hash = crypto.createHash('sha256')
              .update(post.content.toLowerCase().trim())
              .digest('hex');
          }

          // Check for duplicates within 7 days
          const duplicates = await pool.query(
            `SELECT COUNT(*) as count
             FROM social_posts
             WHERE content_hash = $1 
             AND id != $2
             AND created_at > NOW() - INTERVAL '7 days'`,
            [post.content_hash, post.id]
          );

          return {
            ...post,
            has_duplicates: parseInt(duplicates.rows[0].count) > 0,
            duplicate_count: parseInt(duplicates.rows[0].count)
          };
        })
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          posts: postsWithDuplicateCheck,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: posts.rows.length
          }
        }
      });
    } catch (error) {
      console.log('❌ [POSTS] Error in getPendingPosts:', error.message);
      next(error);
    }
  }

  /**
   * Get specific post for review (admin only)
   */
  static async getPostForReview(req, res, next) {
    try {
      console.log('📝 [POSTS] Get post for review:', req.params.postId);
      const { postId } = req.params;
      const pool = getPool();

      const post = await pool.query(
        `SELECT 
          sp.*,
          sa.username,
          sa.display_name,
          sa.profile_picture_url,
          pl.name as platform_name,
          pl.display_name as platform_display_name,
          u.name as user_name,
          u.email as user_email,
          sv.status as verification_status,
          sv.verified_by,
          sv.verified_at,
          sv.rejection_reason,
          sv.verification_notes
        FROM social_posts sp
        JOIN social_accounts sa ON sp.social_account_id = sa.id
        JOIN social_platforms pl ON sa.platform_id = pl.id
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN social_verification sv ON sp.id = sv.post_id
        WHERE sp.id = $1`,
        [postId]
      );

      if (post.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: post.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve a post (admin only)
   */
  static async approvePost(req, res, next) {
    try {
      console.log('✅ [POSTS] Approve post request:', req.params.postId);
      const { postId } = req.params;
      const { adminNotes } = req.body;
      const adminId = req.user.id;
      const pool = getPool();

      // Update post status to approved
      const updatedPost = await pool.query(
        `UPDATE social_posts 
         SET status = 'approved', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [postId]
      );

      if (updatedPost.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
      }

      // Create verification record
      await pool.query(
        `INSERT INTO social_verification (
          user_id, post_id, verification_type, status, verified_by, 
          verified_at, verification_notes
        ) VALUES ($1, $2, 'manual', 'verified', $3, NOW(), $4)`,
        [updatedPost.rows[0].user_id, postId, adminId, adminNotes]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: updatedPost.rows[0],
        message: 'Post approved successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject a post (admin only)
   */
  static async rejectPost(req, res, next) {
    try {
      console.log('❌ [POSTS] Reject post request:', req.params.postId, 'Reason:', req.body.rejectionReason);
      const { postId } = req.params;
      const { rejectionReason, adminNotes } = req.body;
      const adminId = req.user.id;
      const pool = getPool();

      if (!rejectionReason) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Rejection reason is required');
      }

      // Update post status to rejected
      const updatedPost = await pool.query(
        `UPDATE social_posts 
         SET status = 'rejected', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [postId]
      );

      if (updatedPost.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
      }

      // Create verification record
      await pool.query(
        `INSERT INTO social_verification (
          user_id, post_id, verification_type, status, verified_by, 
          verified_at, rejection_reason, verification_notes
        ) VALUES ($1, $2, 'manual', 'rejected', $3, NOW(), $4, $5)`,
        [updatedPost.rows[0].user_id, postId, adminId, rejectionReason, adminNotes]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: updatedPost.rows[0],
        message: 'Post rejected successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate post metadata (GPS, timestamp, merchant tags)
   */
  static async validatePostMetadata(req, res, next) {
    try {
      const { postId } = req.params;
      const pool = getPool();

      const post = await pool.query(
        'SELECT * FROM social_posts WHERE id = $1',
        [postId]
      );

      if (post.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
      }

      const postData = post.rows[0];
      const validationResults = {
        hasValidGPS: false,
        hasValidTimestamp: false,
        hasValidMerchantTags: false,
        isValid: false,
        issues: []
      };

      // Check GPS metadata
      if (postData.gps_latitude && postData.gps_longitude) {
        const lat = parseFloat(postData.gps_latitude);
        const lng = parseFloat(postData.gps_longitude);

        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          validationResults.hasValidGPS = true;
        } else {
          validationResults.issues.push('Invalid GPS coordinates');
        }
      } else {
        validationResults.issues.push('Missing GPS coordinates');
      }

      // Check timestamp metadata
      if (postData.timestamp) {
        const postTime = new Date(postData.timestamp);
        const now = new Date();
        const timeDiff = Math.abs(now - postTime) / (1000 * 60 * 60); // hours

        if (timeDiff <= 24) { // Within 24 hours
          validationResults.hasValidTimestamp = true;
        } else {
          validationResults.issues.push('Post timestamp is older than 24 hours');
        }
      } else {
        validationResults.issues.push('Missing timestamp');
      }

      // Check for merchant tags in content
      const merchantTagPattern = /@\w+/g;
      const merchantTags = postData.content.match(merchantTagPattern);

      if (merchantTags && merchantTags.length > 0) {
        validationResults.hasValidMerchantTags = true;
      } else {
        validationResults.issues.push('No merchant tags found in content');
      }

      validationResults.isValid = validationResults.hasValidGPS &&
        validationResults.hasValidTimestamp &&
        validationResults.hasValidMerchantTags;

      res.status(StatusCodes.OK).json({
        success: true,
        data: validationResults
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check for duplicate posts
   */
  static async checkDuplicatePosts(req, res, next) {
    try {
      const { postId } = req.params;
      const pool = getPool();

      const post = await pool.query(
        'SELECT * FROM social_posts WHERE id = $1',
        [postId]
      );

      if (post.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
      }

      const postData = post.rows[0];

      // Generate content hash for duplicate detection
      const contentHash = crypto.createHash('sha256')
        .update(postData.content.toLowerCase().trim())
        .digest('hex');

      // Check for duplicates within 24 hours
      const duplicates = await pool.query(
        `SELECT 
          sp.id,
          sp.content,
          sp.created_at,
          sa.username,
          u.name as user_name
        FROM social_posts sp
        JOIN social_accounts sa ON sp.social_account_id = sa.id
        JOIN users u ON sp.user_id = u.id
        WHERE sp.content_hash = $1 
        AND sp.id != $2
        AND sp.created_at > NOW() - INTERVAL '24 hours'
        ORDER BY sp.created_at DESC`,
        [contentHash, postId]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          hasDuplicates: duplicates.rows.length > 0,
          duplicates: duplicates.rows,
          contentHash
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get posts requiring attention (admin dashboard)
   */
  static async getPostsRequiringAttention(req, res, next) {
    try {
      const pool = getPool();

      // Get posts that are pending review for more than 24 hours
      const stalePosts = await pool.query(
        `SELECT 
          sp.id,
          sp.content,
          sp.created_at,
          sa.username,
          u.name as user_name,
          EXTRACT(EPOCH FROM (NOW() - sp.created_at))/3600 as hours_pending
        FROM social_posts sp
        JOIN social_accounts sa ON sp.social_account_id = sa.id
        JOIN users u ON sp.user_id = u.id
        WHERE sp.status = 'pending_review'
        AND sp.created_at < NOW() - INTERVAL '24 hours'
        ORDER BY sp.created_at ASC`
      );

      // Get posts with validation issues
      const invalidPosts = await pool.query(
        `SELECT 
          sp.id,
          sp.content,
          sp.created_at,
          sa.username,
          u.name as user_name,
          sv.rejection_reason
        FROM social_posts sp
        JOIN social_accounts sa ON sp.social_account_id = sa.id
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN social_verification sv ON sp.id = sv.post_id
        WHERE sp.status = 'rejected'
        AND sv.rejection_reason IS NOT NULL
        ORDER BY sp.created_at DESC
        LIMIT 10`
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          stalePosts: stalePosts.rows,
          invalidPosts: invalidPosts.rows,
          totalStalePosts: stalePosts.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get post review statistics
   */
  static async getPostReviewStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const pool = getPool();

      let dateFilter = '';
      let params = [];

      if (startDate && endDate) {
        dateFilter = 'AND sp.created_at BETWEEN $1 AND $2';
        params = [startDate, endDate];
      } else if (startDate) {
        dateFilter = 'AND sp.created_at >= $1';
        params = [startDate];
      } else if (endDate) {
        dateFilter = 'AND sp.created_at <= $1';
        params = [endDate];
      }

      const stats = await pool.query(
        `SELECT 
          COUNT(*) as total_posts,
          COUNT(CASE WHEN sp.status = 'pending_review' THEN 1 END) as pending_posts,
          COUNT(CASE WHEN sp.status = 'approved' THEN 1 END) as approved_posts,
          COUNT(CASE WHEN sp.status = 'rejected' THEN 1 END) as rejected_posts,
          AVG(CASE WHEN sv.verified_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (sv.verified_at - sp.created_at))/3600 
            ELSE NULL END) as avg_review_time_hours
        FROM social_posts sp
        LEFT JOIN social_verification sv ON sp.id = sv.post_id
        WHERE 1=1 ${dateFilter}`,
        params
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: stats.rows[0] || {}
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Enforce daily post limits
   */
  static async enforceDailyPostLimits(req, res, next) {
    try {
      const { userId } = req.params;
      const { dailyLimit = 5 } = req.body;
      const pool = getPool();

      // Get today's post count for user
      const todayPosts = await pool.query(
        `SELECT COUNT(*) as post_count
        FROM social_posts 
        WHERE user_id = $1 
        AND DATE(created_at) = CURRENT_DATE
        AND status IN ('published', 'approved')`,
        [userId]
      );

      const postCount = parseInt(todayPosts.rows[0].post_count);
      const canPost = postCount < dailyLimit;

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          canPost,
          currentPostCount: postCount,
          dailyLimit,
          remainingPosts: Math.max(0, dailyLimit - postCount)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
