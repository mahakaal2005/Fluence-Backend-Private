import { StatusCodes } from 'http-status-codes';
import { getPool } from '../config/database.js';
import { ApiError } from '../middleware/error.js';

export class SocialController {
  /**
   * Connect social account
   */
  static async connectSocialAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const { platformId, platformUserId, username, displayName, profilePictureUrl, accessToken, refreshToken, tokenExpiresAt } = req.body;

      if (!platformId || !platformUserId || !accessToken) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Platform ID, platform user ID, and access token are required');
      }

      const pool = getPool();

      // Check if account is already connected
      const existingAccount = await pool.query(
        'SELECT * FROM social_accounts WHERE user_id = $1 AND platform_id = $2',
        [userId, platformId]
      );

      if (existingAccount.rows.length > 0) {
        // Update existing account
        const updatedAccount = await pool.query(
          `UPDATE social_accounts 
           SET platform_user_id = $3, username = $4, display_name = $5, 
               profile_picture_url = $6, access_token = $7, refresh_token = $8, 
               token_expires_at = $9, is_connected = true, last_sync_at = NOW(), updated_at = NOW()
           WHERE user_id = $1 AND platform_id = $2 
           RETURNING *`,
          [userId, platformId, platformUserId, username, displayName, profilePictureUrl, accessToken, refreshToken, tokenExpiresAt]
        );

        return res.status(StatusCodes.OK).json({
          success: true,
          data: updatedAccount.rows[0],
          message: 'Social account updated successfully'
        });
      }

      // Create new social account
      const newAccount = await pool.query(
        `INSERT INTO social_accounts (
          user_id, platform_id, platform_user_id, username, display_name, 
          profile_picture_url, access_token, refresh_token, token_expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [userId, platformId, platformUserId, username, displayName, profilePictureUrl, accessToken, refreshToken, tokenExpiresAt]
      );

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: newAccount.rows[0],
        message: 'Social account connected successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's social accounts
   */
  static async getSocialAccounts(req, res, next) {
    try {
      const userId = req.user.id;
      const pool = getPool();

      const accounts = await pool.query(
        `SELECT sa.*, sp.name as platform_name, sp.display_name as platform_display_name
         FROM social_accounts sa
         JOIN social_platforms sp ON sa.platform_id = sp.id
         WHERE sa.user_id = $1 AND sa.is_connected = true
         ORDER BY sa.created_at DESC`,
        [userId]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: accounts.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect social account
   */
  static async disconnectSocialAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const { accountId } = req.params;
      const pool = getPool();

      const result = await pool.query(
        'UPDATE social_accounts SET is_connected = false, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
        [accountId, userId]
      );

      if (result.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Social account not found');
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: result.rows[0],
        message: 'Social account disconnected successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create social post
   */
  static async createSocialPost(req, res, next) {
    try {
      const userId = req.user.id;
      const { socialAccountId, content, mediaUrls, postType, scheduledAt, transactionId } = req.body;

      if (!socialAccountId || !content) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Social account ID and content are required');
      }

      const pool = getPool();

      // Verify social account belongs to user
      const account = await pool.query(
        'SELECT * FROM social_accounts WHERE id = $1 AND user_id = $2 AND is_connected = true',
        [socialAccountId, userId]
      );

      if (account.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Social account not found or not connected');
      }

      const post = await pool.query(
        `INSERT INTO social_posts (
          user_id, social_account_id, content, media_urls, post_type, scheduled_at, original_transaction_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [userId, socialAccountId, content, mediaUrls || [], postType || 'text', scheduledAt, transactionId || null]
      );

      // Send notification for social post creation
      try {
        const { NotificationClient } = await import('../services/notification.client.js');
        // Get platform name from account
        const platformResult = await pool.query(
          `SELECT sp.name as platform_name 
           FROM social_accounts sa
           JOIN social_platforms sp ON sa.platform_id = sp.id
           WHERE sa.id = $1`,
          [socialAccountId]
        );
        const platformName = platformResult.rows.length > 0 ? platformResult.rows[0].platform_name : null;
        
        await NotificationClient.sendSocialPostCreatedNotification(
          userId,
          post.rows[0].id,
          platformName,
          postType || 'text',
          userId // sentBy is the user who created the post
        );
      } catch (notificationErr) {
        // Do not block social post creation if notification fails
        console.error('Failed to send social post creation notification:', notificationErr.message);
      }

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: post.rows[0],
        message: 'Social post created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's social posts
   */
  static async getSocialPosts(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, status, postType } = req.query;
      const pool = getPool();

      let query = `
        SELECT sp.*, sa.platform_user_id, sa.username, sa.display_name, 
               pl.name as platform_name, pl.display_name as platform_display_name
        FROM social_posts sp
        JOIN social_accounts sa ON sp.social_account_id = sa.id
        JOIN social_platforms pl ON sa.platform_id = pl.id
        WHERE sp.user_id = $1
      `;
      let params = [userId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        query += ` AND sp.status = $${paramCount}`;
        params.push(status);
      }

      if (postType) {
        paramCount++;
        query += ` AND sp.post_type = $${paramCount}`;
        params.push(postType);
      }

      query += ` ORDER BY sp.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const posts = await pool.query(query, params);

      res.status(StatusCodes.OK).json({
        success: true,
        data: posts.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: posts.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update social post
   */
  static async updateSocialPost(req, res, next) {
    try {
      const userId = req.user.id;
      const { postId } = req.params;
      const { content, mediaUrls, postType, status } = req.body;
      const pool = getPool();

      const result = await pool.query(
        `UPDATE social_posts 
         SET content = $3, media_urls = $4, post_type = $5, status = $6, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [postId, userId, content, mediaUrls, postType, status]
      );

      if (result.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Social post not found');
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: result.rows[0],
        message: 'Social post updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete social post
   */
  static async deleteSocialPost(req, res, next) {
    try {
      const userId = req.user.id;
      const { postId } = req.params;
      const pool = getPool();

      const result = await pool.query(
        'UPDATE social_posts SET status = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
        [postId, userId, 'deleted']
      );

      if (result.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Social post not found');
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: result.rows[0],
        message: 'Social post deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get social analytics
   */
  static async getSocialAnalytics(req, res, next) {
    try {
      const userId = req.user.id;
      const { startDate, endDate, platformId } = req.query;
      const pool = getPool();

      let query = `
        SELECT * FROM social_analytics 
        WHERE user_id = $1
      `;
      let params = [userId];
      let paramCount = 1;

      if (platformId) {
        paramCount++;
        query += ` AND platform_id = $${paramCount}`;
        params.push(platformId);
      }

      if (startDate && endDate) {
        paramCount++;
        query += ` AND date BETWEEN $${paramCount} AND $${paramCount + 1}`;
        params.push(startDate, endDate);
      }

      query += ' ORDER BY date DESC';

      const analytics = await pool.query(query, params);

      res.status(StatusCodes.OK).json({
        success: true,
        data: analytics.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get social rewards
   */
  static async getSocialRewards(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;
      const pool = getPool();

      const rewards = await pool.query(
        `SELECT * FROM social_rewards 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, parseInt(limit), parseInt(offset)]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: rewards.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: rewards.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get social campaigns
   */
  static async getSocialCampaigns(req, res, next) {
    try {
      const pool = getPool();

      const campaigns = await pool.query(
        `SELECT * FROM social_campaigns 
         WHERE is_active = true 
         AND (end_date IS NULL OR end_date > NOW())
         ORDER BY created_at DESC`
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: campaigns.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get social platforms
   */
  static async getSocialPlatforms(req, res, next) {
    try {
      const pool = getPool();

      const platforms = await pool.query(
        'SELECT * FROM social_platforms WHERE is_active = true ORDER BY name'
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: platforms.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update social settings
   */
  static async updateSocialSettings(req, res, next) {
    try {
      const userId = req.user.id;
      const { autoPostEnabled, autoShareEnabled, notificationEnabled, privacyLevel, contentFilters, preferredPlatforms } = req.body;
      const pool = getPool();

      const result = await pool.query(
        `INSERT INTO social_settings (
          user_id, auto_post_enabled, auto_share_enabled, notification_enabled, 
          privacy_level, content_filters, preferred_platforms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          auto_post_enabled = EXCLUDED.auto_post_enabled,
          auto_share_enabled = EXCLUDED.auto_share_enabled,
          notification_enabled = EXCLUDED.notification_enabled,
          privacy_level = EXCLUDED.privacy_level,
          content_filters = EXCLUDED.content_filters,
          preferred_platforms = EXCLUDED.preferred_platforms,
          updated_at = NOW()
        RETURNING *`,
        [userId, autoPostEnabled, autoShareEnabled, notificationEnabled, privacyLevel, contentFilters, preferredPlatforms]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: result.rows[0],
        message: 'Social settings updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get social settings
   */
  static async getSocialSettings(req, res, next) {
    try {
      const userId = req.user.id;
      const pool = getPool();

      const settings = await pool.query(
        'SELECT * FROM social_settings WHERE user_id = $1',
        [userId]
      );

      if (settings.rows.length === 0) {
        // Create default settings
        const defaultSettings = await pool.query(
          `INSERT INTO social_settings (user_id) VALUES ($1) RETURNING *`,
          [userId]
        );

        return res.status(StatusCodes.OK).json({
          success: true,
          data: defaultSettings.rows[0]
        });
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: settings.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get merchant reports and insights
   */
  static async getMerchantReports(req, res, next) {
    try {
      const userId = req.user.id;
      const { startDate, endDate, platformId, limit = 50, offset = 0 } = req.query;
      const pool = getPool();

      // Get social analytics data instead of cashback transactions
      // Social service should not directly access cashback service tables
      const socialAnalytics = await pool.query(
        `SELECT * FROM social_analytics sa
        WHERE sa.user_id = $1
        ${startDate ? 'AND sa.created_at >= $2' : ''}
        ${endDate ? 'AND sa.created_at <= $3' : ''}
        ORDER BY sa.created_at DESC
        LIMIT $${startDate && endDate ? '4' : startDate || endDate ? '3' : '2'} OFFSET $${startDate && endDate ? '5' : startDate || endDate ? '4' : '3'}`,
        startDate && endDate ? [userId, startDate, endDate, limit, offset] :
          startDate ? [userId, startDate, limit, offset] :
            endDate ? [userId, endDate, limit, offset] :
              [userId, limit, offset]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          socialAnalytics: socialAnalytics.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: socialAnalytics.rows.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get influencer scoring and ranking
   */
  static async getInfluencerScoring(req, res, next) {
    try {
      const userId = req.user.id;
      const { platformId, limit = 50, offset = 0 } = req.query;
      const pool = getPool();

      // Calculate influencer scores: (Likes + Comments) / Followers
      const influencerScores = await pool.query(
        `SELECT 
          sa.id as account_id,
          sa.username,
          sa.display_name,
          sa.profile_picture_url,
          sp.name as platform_name,
          sp.display_name as platform_display_name,
          COALESCE(SUM(sp_analytics.likes_count), 0) as total_likes,
          COALESCE(SUM(sp_analytics.comments_count), 0) as total_comments,
          COALESCE(SUM(sp_analytics.shares_count), 0) as total_shares,
          COALESCE(SUM(sp_analytics.posts_count), 0) as total_posts,
          CASE 
            WHEN COALESCE(SUM(sp_analytics.followers_count), 0) > 0 
            THEN (COALESCE(SUM(sp_analytics.likes_count), 0) + COALESCE(SUM(sp_analytics.comments_count), 0))::DECIMAL / NULLIF(SUM(sp_analytics.followers_count), 0)
            ELSE 0 
          END as influencer_score,
          ROW_NUMBER() OVER (
            ORDER BY 
              CASE 
                WHEN COALESCE(SUM(sp_analytics.followers_count), 0) > 0 
                THEN (COALESCE(SUM(sp_analytics.likes_count), 0) + COALESCE(SUM(sp_analytics.comments_count), 0))::DECIMAL / NULLIF(SUM(sp_analytics.followers_count), 0)
                ELSE 0 
              END DESC
          ) as ranking
        FROM social_accounts sa
        JOIN social_platforms sp ON sa.platform_id = sp.id
        LEFT JOIN social_analytics sp_analytics ON sa.user_id = sp_analytics.user_id AND sa.platform_id = sp_analytics.platform_id
        WHERE sa.user_id = $1 AND sa.is_connected = true
        ${platformId ? 'AND sa.platform_id = $2' : ''}
        GROUP BY sa.id, sa.username, sa.display_name, sa.profile_picture_url, sp.name, sp.display_name
        ORDER BY influencer_score DESC
        LIMIT $${platformId ? '3' : '2'} OFFSET $${platformId ? '4' : '3'}`,
        platformId ? [userId, platformId, limit, offset] : [userId, limit, offset]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          influencerScores: influencerScores.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: influencerScores.rows.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get real-time influencer ranking
   */
  static async getInfluencerRanking(req, res, next) {
    try {
      const { platformId, limit = 100 } = req.query;
      const pool = getPool();

      // Get real-time ranking across all users
      const ranking = await pool.query(
        `SELECT 
          sa.user_id,
          sa.username,
          sa.display_name,
          sa.profile_picture_url,
          sp.name as platform_name,
          sp.display_name as platform_display_name,
          COALESCE(SUM(sp_analytics.likes_count), 0) as total_likes,
          COALESCE(SUM(sp_analytics.comments_count), 0) as total_comments,
          COALESCE(SUM(sp_analytics.shares_count), 0) as total_shares,
          COALESCE(SUM(sp_analytics.posts_count), 0) as total_posts,
          CASE 
            WHEN COALESCE(SUM(sp_analytics.followers_count), 0) > 0 
            THEN (COALESCE(SUM(sp_analytics.likes_count), 0) + COALESCE(SUM(sp_analytics.comments_count), 0))::DECIMAL / NULLIF(SUM(sp_analytics.followers_count), 0)
            ELSE 0 
          END as influencer_score,
          ROW_NUMBER() OVER (
            ORDER BY 
              CASE 
                WHEN COALESCE(SUM(sp_analytics.followers_count), 0) > 0 
                THEN (COALESCE(SUM(sp_analytics.likes_count), 0) + COALESCE(SUM(sp_analytics.comments_count), 0))::DECIMAL / NULLIF(SUM(sp_analytics.followers_count), 0)
                ELSE 0 
              END DESC
          ) as global_ranking
        FROM social_accounts sa
        JOIN social_platforms sp ON sa.platform_id = sp.id
        LEFT JOIN social_analytics sp_analytics ON sa.user_id = sp_analytics.user_id AND sa.platform_id = sp_analytics.platform_id
        WHERE sa.is_connected = true
        ${platformId ? 'AND sa.platform_id = $1' : ''}
        GROUP BY sa.user_id, sa.username, sa.display_name, sa.profile_picture_url, sp.name, sp.display_name
        ORDER BY influencer_score DESC
        LIMIT $${platformId ? '2' : '1'}`,
        platformId ? [platformId, limit] : [limit]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          ranking: ranking.rows,
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get merchant analytics dashboard
   */
  static async getMerchantAnalytics(req, res, next) {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      const pool = getPool();

      // Get comprehensive analytics
      const analytics = await pool.query(
        `SELECT 
          -- Transaction Analytics
          COUNT(ct.id) as total_transactions,
          SUM(ct.cashback_amount) as total_cashback_given,
          AVG(ct.cashback_percentage) as avg_cashback_percentage,
          
          -- Social Analytics
          COUNT(DISTINCT sp.id) as total_posts,
          SUM(sp.likes_count) as total_likes,
          SUM(sp.shares_count) as total_shares,
          SUM(sp.comments_count) as total_comments,
          AVG(sp.engagement_score) as avg_engagement_score,
          
          -- Campaign Analytics
          COUNT(DISTINCT cc.id) as active_campaigns,
          SUM(cc.cashback_percentage) as total_cashback_percentage
        FROM cashback_transactions ct
        LEFT JOIN social_posts sp ON sp.user_id = ct.customer_id
        LEFT JOIN cashback_campaigns cc ON ct.campaign_id = cc.id
        WHERE ct.customer_id = $1
        ${startDate ? 'AND ct.created_at >= $2' : ''}
        ${endDate ? 'AND ct.created_at <= $3' : ''}`,
        startDate && endDate ? [userId, startDate, endDate] :
          startDate ? [userId, startDate] :
            endDate ? [userId, endDate] :
              [userId]
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: analytics.rows[0] || {}
      });
    } catch (error) {
      next(error);
    }
  }
}
