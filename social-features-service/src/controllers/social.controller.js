import { StatusCodes } from 'http-status-codes';
import { getPool } from '../config/database.js';
import { ApiError } from '../middleware/error.js';
import { InstagramOAuthService } from '../services/instagram-oauth.service.js';
import { getConfig } from '../config/index.js';

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

      // Update points_transactions table to set social_post_made = true
      // Map original_transaction_id from social_posts to reference_id in points_transactions
      if (transactionId) {
        try {
          // Convert UUID to string for comparison (reference_id is TEXT)
          const referenceId = typeof transactionId === 'string' ? transactionId : transactionId.toString();

          const updateResult = await pool.query(
            `UPDATE points_transactions 
             SET social_post_made = true, updated_at = NOW()
             WHERE reference_id = $1 AND social_post_made = false`,
            [referenceId]
          );

          if (updateResult.rowCount > 0) {
            console.log(`Updated ${updateResult.rowCount} point transaction(s) to set social_post_made = true for reference_id: ${referenceId}`);
          } else {
            console.log(`No points transactions found with reference_id: ${referenceId} or already marked as social_post_made`);
          }
        } catch (pointsUpdateError) {
          // Log error but don't fail the post creation
          console.error('Failed to update points_transactions social_post_made status:', pointsUpdateError);
          // Continue execution - post creation should succeed even if points update fails
        }
      }

      // Send notification for social post creation
      try {
        const { NotificationClient } = await import('../services/notification.client.js');
        // Get platform name and user info from account
        const platformResult = await pool.query(
          `SELECT sp.name as platform_name, u.name as username
           FROM social_accounts sa
           JOIN social_platforms sp ON sa.platform_id = sp.id
           LEFT JOIN users u ON sa.user_id = u.id
           WHERE sa.id = $1`,
          [socialAccountId]
        );
        const platformName = platformResult.rows.length > 0 ? platformResult.rows[0].platform_name : null;
        const username = platformResult.rows.length > 0 ? platformResult.rows[0].username : null;

        // Send notification to user
        await NotificationClient.sendSocialPostCreatedNotification(
          userId,
          post.rows[0].id,
          platformName,
          postType || 'text',
          userId // sentBy is the user who created the post
        );

        // Send notification to admins
        await NotificationClient.sendAdminNewPostNotification(
          {
            postId: post.rows[0].id,
            userId: userId,
            username: username,
            platform: platformName,
            postType: postType || 'text',
            contentPreview: content
          },
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

  /**
   * Initiate Instagram OAuth flow
   * Returns the authorization URL for the user to visit
   * Uses Instagram Graph API with Business Login (direct Instagram login, NO Facebook required)
   */
  static async initiateInstagramOAuth(req, res, next) {
    try {
      const userId = req.user.id;
      const config = getConfig();

      // Generate redirect URI - should match what's configured in Meta Developer Console
      // Priority: 1. Request body, 2. Environment variable, 3. Auto-detect (with localhost warning)
      const redirectUri = req.body.redirectUri ||
        process.env.INSTAGRAM_REDIRECT_URI ||
        `${req.protocol}://${req.get('host')}/api/social/instagram/callback`;

      // Normalize redirect URI
      const normalizedRedirectUri = InstagramOAuthService.normalizeRedirectUri(redirectUri);

      // Check if using localhost (Meta doesn't allow localhost redirect URIs)
      const isLocalhost = normalizedRedirectUri.includes('localhost') || normalizedRedirectUri.includes('127.0.0.1');

      // Generate state parameter for security (optional but recommended)
      const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

      // Generate OAuth URL using Instagram Graph API
      const authUrl = InstagramOAuthService.generateAuthUrl(normalizedRedirectUri, state);

      // Build instructions object
      const instructions = {
        note: 'If you get "Invalid redirect_uri" error, make sure this exact redirect URI is added in your Meta App Dashboard:',
        dashboardPath: 'App Dashboard > Instagram > API setup with Instagram login > 3. Set up Instagram business login > Business login settings > OAuth redirect URIs',
        redirectUri: normalizedRedirectUri
      };

      // Add localhost warning and solutions
      if (isLocalhost) {
        instructions.localhostWarning = {
          message: '⚠️ Meta Developer Platform does NOT allow localhost redirect URIs!',
          solutions: [
            {
              method: 'Cloudflare Tunnel (Recommended - Free & Persistent)',
              steps: [
                '1. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/',
                '2. Login: cloudflared tunnel login',
                '3. Create tunnel: cloudflared tunnel create fluence-social',
                '4. Configure: Add route in Cloudflare dashboard or use config file',
                '5. Start tunnel: cloudflared tunnel run fluence-social',
                '6. Get your persistent URL (e.g., https://fluence-social.your-domain.com)',
                `7. Set INSTAGRAM_REDIRECT_URI=https://fluence-social.your-domain.com/api/social/instagram/callback`,
                '8. Add the URL to Meta App Dashboard OAuth redirect URIs'
              ],
              persistent: true,
              free: true
            },
            {
              method: 'ngrok with Reserved Domain (Persistent)',
              steps: [
                '1. Sign up for ngrok: https://ngrok.com',
                '2. Get authtoken: https://dashboard.ngrok.com/get-started/your-authtoken',
                '3. Configure: ngrok config add-authtoken YOUR_TOKEN',
                '4. Reserve domain: ngrok http 4007 --domain=your-reserved-domain.ngrok-free.app',
                `5. Set INSTAGRAM_REDIRECT_URI=https://your-reserved-domain.ngrok-free.app/api/social/instagram/callback`,
                '6. Add to Meta App Dashboard',
                'Note: Reserved domains require ngrok paid plan'
              ],
              persistent: true,
              free: false
            },
            {
              method: 'Use Production/Staging URL',
              steps: [
                '1. Deploy your service to a staging/production environment',
                '2. Use the public URL as redirect URI',
                '3. Add to Meta App Dashboard'
              ],
              persistent: true,
              free: false
            }
          ],
          currentUri: normalizedRedirectUri
        };
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          authUrl,
          redirectUri: normalizedRedirectUri,
          state,
          method: 'Instagram Graph API (Business Login)',
          instructions,
          ...(isLocalhost && { warning: 'Localhost detected - Meta does not allow localhost redirect URIs. See instructions for solutions.' })
        },
        message: 'Visit the authUrl to authorize Instagram access'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Instagram OAuth callback
   * This endpoint receives the authorization code and completes the OAuth flow
   * Note: For better security, consider handling this on the frontend and sending the code to a protected endpoint
   */
  static async handleInstagramCallback(req, res, next) {
    // Helper function to get frontend URL
    const getFrontendUrl = () => {
      if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL;
      }
      // If we're behind a tunnel, use the tunnel URL
      const host = req.get('host');
      if (host && (host.includes('trycloudflare.com') || host.includes('cfargotunnel.com'))) {
        return `${req.protocol}://${host}`;
      }
      // Default to localhost for local development
      return 'http://localhost:3000';
    };

    // Helper function to generate success HTML
    const getSuccessHtml = (accountData) => {
      const frontendUrl = getFrontendUrl();
      const username = accountData?.username || 'your account';
      return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instagram Connected Successfully</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .success-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 30px;
            animation: scaleIn 0.5s ease-out 0.2s both;
        }
        @keyframes scaleIn {
            from {
                transform: scale(0);
            }
            to {
                transform: scale(1);
            }
        }
        .success-icon::after {
            content: '✓';
            color: white;
            font-size: 48px;
            font-weight: bold;
        }
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .success-message {
            background: #f0fff4;
            border-left: 4px solid #48bb78;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #22543d;
            font-size: 14px;
            text-align: left;
        }
        .account-info {
            background: #f7fafc;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .account-info strong {
            color: #2d3748;
            display: block;
            margin-bottom: 5px;
        }
        .account-info span {
            color: #4a5568;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
            color: white;
            padding: 14px 32px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 15px rgba(131, 58, 180, 0.4);
            margin-top: 10px;
        }
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(131, 58, 180, 0.5);
        }
        .button:active {
            transform: translateY(0);
        }
        .info {
            margin-top: 30px;
            padding-top: 30px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #999;
        }
        @keyframes checkmark {
            0% {
                transform: scale(0) rotate(45deg);
            }
            50% {
                transform: scale(1.2) rotate(45deg);
            }
            100% {
                transform: scale(1) rotate(45deg);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon"></div>
        <h1>Instagram Connected!</h1>
        <p>
            Your Instagram account has been successfully connected.
        </p>
        <div class="account-info">
            <strong>Connected Account:</strong>
            <span>@${username}</span>
        </div>
        <div class="success-message">
            ✓ Your Instagram account is now linked and ready to use.
        </div>
        <div class="info">
            You can close this window and return to the app.
        </div>
    </div>
</body>
</html>`;
    };

    // Helper function to generate error HTML
    const getErrorHtml = (errorMessage) => {
      const frontendUrl = getFrontendUrl();
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instagram Connection Error</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .error-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 30px;
            animation: scaleIn 0.5s ease-out 0.2s both;
        }
        @keyframes scaleIn {
            from {
                transform: scale(0);
            }
            to {
                transform: scale(1);
            }
        }
        .error-icon::after {
            content: '✕';
            color: white;
            font-size: 48px;
            font-weight: bold;
        }
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .error-message {
            background: #fff5f5;
            border-left: 4px solid #f5576c;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #c53030;
            font-size: 14px;
            text-align: left;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 14px 32px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
            margin-top: 10px;
        }
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(245, 87, 108, 0.5);
        }
        .button:active {
            transform: translateY(0);
        }
        .info {
            margin-top: 30px;
            padding-top: 30px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon"></div>
        <h1>Connection Failed</h1>
        <p>
            We couldn't connect your Instagram account. Please try again.
        </p>
        <div class="error-message">
            ${errorMessage}
        </div>
        <div class="info">
            You can close this window and try again from the app.
        </div>
    </div>
</body>
</html>`;
    };

    try {
      const { code, state, error, error_reason, error_description } = req.query;

      // Check for OAuth errors
      if (error) {
        const errorMessage = error_description || error_reason || 'Authorization failed';
        return res.status(StatusCodes.BAD_REQUEST).send(getErrorHtml(errorMessage));
      }

      if (!code) {
        return res.status(StatusCodes.BAD_REQUEST).send(getErrorHtml('Authorization code is required'));
      }

      // Extract userId from state parameter
      let userId = null;
      if (state) {
        try {
          const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
          userId = stateData.userId;
        } catch (e) {
          console.error('Failed to parse state parameter:', e);
        }
      }

      // If no userId in state, try to get from auth token (if provided)
      if (!userId && req.user?.id) {
        userId = req.user.id;
      }

      if (!userId) {
        return res.status(StatusCodes.BAD_REQUEST).send(getErrorHtml('User authentication required'));
      }

      // Get redirect URI (should match the one used in initiateInstagramOAuth)
      const config = getConfig();
      const redirectUri = process.env.INSTAGRAM_REDIRECT_URI ||
        `${req.protocol}://${req.get('host')}/api/social/instagram/callback`;

      // Normalize redirect URI to match the one used in authorization
      const normalizedRedirectUri = InstagramOAuthService.normalizeRedirectUri(redirectUri);

      // Complete OAuth flow and connect account using Instagram Graph API
      const connectedAccount = await InstagramOAuthService.connectInstagramAccount(
        code,
        normalizedRedirectUri,
        userId
      );

      // Update fluence score: Set to 75 for connecting Instagram account
      try {
        const pool = getPool();
        // Try to update fluence_score to 75
        // If column doesn't exist, this will fail gracefully
        await pool.query(
          `UPDATE users 
           SET fluence_score = 75, 
               updated_at = NOW() 
           WHERE id = $1`,
          [userId]
        );
        console.log(`✅ Set fluence score to 75 for user ${userId} for Instagram connection`);
      } catch (scoreError) {
        // Log error but don't fail the connection if fluence_score column doesn't exist
        console.warn('⚠️ Failed to update fluence score (column may not exist):', scoreError.message);
        // Optionally, you could create the column here if it doesn't exist
        // For now, we'll just log the warning
      }

      // Display success HTML page for all callbacks (web and mobile)
      return res.status(StatusCodes.OK).send(getSuccessHtml(connectedAccount));
    } catch (error) {
      console.error('Instagram callback error:', error);

      // Check if this is a mobile app callback
      const redirectUri = process.env.INSTAGRAM_REDIRECT_URI ||
        `${req.protocol}://${req.get('host')}/api/social/instagram/callback`;
      const isDeepLink = redirectUri &&
        !redirectUri.startsWith('http://') &&
        !redirectUri.startsWith('https://') &&
        redirectUri.includes('://');

      if (isDeepLink) {
        // For mobile apps, return JSON error response
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: error.message || 'Failed to connect Instagram account',
          deepLink: redirectUri.includes('?')
            ? `${redirectUri}&error=${encodeURIComponent(error.message || 'Failed to connect')}`
            : `${redirectUri}?error=${encodeURIComponent(error.message || 'Failed to connect')}`
        });
      }

      // For web apps, show a nice HTML error page
      const errorMessage = error.message || 'Failed to connect Instagram account';
      return res.status(StatusCodes.BAD_REQUEST).send(getErrorHtml(errorMessage));
    }
  }

  /**
   * Get Instagram profile and media in a single response
   * GET /api/social/get-all-instagram-data?accountId=xxx&limit=25
   */
  static async getAllInstagramData(req, res, next) {
    try {
      const userId = req.user.id;
      const { accountId, limit = 25, after = null } = req.query;
      const pool = getPool();

      if (!accountId) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Account ID is required');
      }

      const accountResult = await pool.query(
        `SELECT sa.*, sp.name as platform_name 
         FROM social_accounts sa
         JOIN social_platforms sp ON sa.platform_id = sp.id
         WHERE sa.id = $1 AND sa.user_id = $2 AND sa.is_connected = true`,
        [accountId, userId]
      );

      if (accountResult.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Social account not found or not connected');
      }

      const account = accountResult.rows[0];

      if (account.platform_name !== 'instagram') {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'This endpoint is only for Instagram accounts');
      }

      if (!account.access_token) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Access token not found for this account');
      }

      let accessToken = account.access_token;
      if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
        try {
          const refreshedToken = await InstagramOAuthService.refreshToken(accessToken);
          accessToken = refreshedToken.accessToken;

          await pool.query(
            'UPDATE social_accounts SET access_token = $1, token_expires_at = $2, updated_at = NOW() WHERE id = $3',
            [
              refreshedToken.accessToken,
              new Date(Date.now() + refreshedToken.expiresIn * 1000),
              accountId
            ]
          );
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
        }
      }

      const profile = await InstagramOAuthService.getInstagramProfile(accessToken);
      const mediaOptions = { limit: parseInt(limit, 10) };
      if (after) {
        mediaOptions.after = after;
      }
      const mediaResult = await InstagramOAuthService.getInstagramMedia(accessToken, mediaOptions);

      return res.status(StatusCodes.OK).json({
        success: true,
        data: {
          profile: {
            ...profile,
            media: {
              posts: mediaResult.data,
              paging: mediaResult.paging,
              summary: mediaResult.summary
            }
          }
        },
        message: 'Instagram profile and media fetched successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch Instagram posts from API (without syncing to database)
   * GET /api/social/instagram/posts?accountId=xxx&limit=25&sync=false
   */
  static async fetchInstagramPosts(req, res, next) {
    try {
      const userId = req.user.id;
      const { accountId, limit = 25, sync = 'false' } = req.query;
      const pool = getPool();

      if (!accountId) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Account ID is required');
      }

      // Get social account and verify it belongs to the user
      const accountResult = await pool.query(
        `SELECT sa.*, sp.name as platform_name 
         FROM social_accounts sa
         JOIN social_platforms sp ON sa.platform_id = sp.id
         WHERE sa.id = $1 AND sa.user_id = $2 AND sa.is_connected = true`,
        [accountId, userId]
      );

      if (accountResult.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Social account not found or not connected');
      }

      const account = accountResult.rows[0];

      if (account.platform_name !== 'instagram') {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'This endpoint is only for Instagram accounts');
      }

      if (!account.access_token) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Access token not found for this account');
      }

      // Check if token is expired and refresh if needed
      let accessToken = account.access_token;
      if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
        try {
          const refreshedToken = await InstagramOAuthService.refreshToken(accessToken);
          accessToken = refreshedToken.accessToken;

          // Update token in database
          await pool.query(
            'UPDATE social_accounts SET access_token = $1, token_expires_at = $2, updated_at = NOW() WHERE id = $3',
            [
              refreshedToken.accessToken,
              new Date(Date.now() + refreshedToken.expiresIn * 1000),
              accountId
            ]
          );
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          // Continue with existing token, might still work
        }
      }

      // If sync is true, fetch, sync, and return posts from database with status
      if (sync === 'true') {
        const authToken = req.headers.authorization || null;
        
        // First, fetch posts from Instagram to get the media IDs
        const result = await InstagramOAuthService.getInstagramMedia(accessToken, {
          limit: parseInt(limit)
        });

        // Sync posts to database (this will create/update posts and auto-link transactions)
        const syncResult = await InstagramOAuthService.syncInstagramPosts(
          userId,
          accountId,
          accessToken,
          parseInt(limit),
          authToken
        );

        // Get the synced posts from database with their status and transaction links
        const platformPostIds = result.data.map(post => post.id);
        const syncedPostsQuery = `
          SELECT sp.*, 
                 sa.platform_user_id, sa.username, sa.display_name,
                 pl.name as platform_name, pl.display_name as platform_display_name
          FROM social_posts sp
          JOIN social_accounts sa ON sp.social_account_id = sa.id
          JOIN social_platforms pl ON sa.platform_id = pl.id
          WHERE sp.social_account_id = $1
            AND sp.platform_post_id = ANY($2::text[])
          ORDER BY sp.published_at DESC
        `;
        
        const syncedPostsResult = await pool.query(syncedPostsQuery, [
          accountId,
          platformPostIds
        ]);

        return res.status(StatusCodes.OK).json({
          success: true,
          data: {
            posts: syncedPostsResult.rows,
            sync: {
              total: syncResult.total,
              created: syncResult.created,
              updated: syncResult.updated,
              autoLinked: syncResult.autoLinked
            },
            pagination: {
              limit: parseInt(limit),
              count: syncedPostsResult.rows.length
            }
          },
          message: 'Instagram posts fetched, synced, and returned with status'
        });
      }

      // If sync is false, just fetch from Instagram API (original behavior)
      const result = await InstagramOAuthService.getInstagramMedia(accessToken, {
        limit: parseInt(limit)
      });

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          posts: result.data,
          pagination: result.paging,
          summary: result.summary
        },
        message: 'Instagram posts fetched successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync Instagram posts to database
   * POST /api/social/instagram/sync-posts
   */
  static async syncInstagramPosts(req, res, next) {
    try {
      const userId = req.user.id;
      const { accountId, maxPosts = 100 } = req.body;
      const pool = getPool();

      if (!accountId) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Account ID is required');
      }

      // Get social account and verify it belongs to the user
      const accountResult = await pool.query(
        `SELECT sa.*, sp.name as platform_name 
         FROM social_accounts sa
         JOIN social_platforms sp ON sa.platform_id = sp.id
         WHERE sa.id = $1 AND sa.user_id = $2 AND sa.is_connected = true`,
        [accountId, userId]
      );

      if (accountResult.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Social account not found or not connected');
      }

      const account = accountResult.rows[0];

      if (account.platform_name !== 'instagram') {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'This endpoint is only for Instagram accounts');
      }

      if (!account.access_token) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Access token not found for this account');
      }

      // Check if token is expired and refresh if needed
      let accessToken = account.access_token;
      if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
        try {
          const refreshedToken = await InstagramOAuthService.refreshToken(accessToken);
          accessToken = refreshedToken.accessToken;

          // Update token in database
          await pool.query(
            'UPDATE social_accounts SET access_token = $1, token_expires_at = $2, updated_at = NOW() WHERE id = $3',
            [
              refreshedToken.accessToken,
              new Date(Date.now() + refreshedToken.expiresIn * 1000),
              accountId
            ]
          );
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          // Continue with existing token, might still work
        }
      }

      // Sync posts to database
      // Pass auth token for service-to-service calls
      const authToken = req.headers.authorization || null;
      const syncResult = await InstagramOAuthService.syncInstagramPosts(
        userId,
        accountId,
        accessToken,
        parseInt(maxPosts),
        authToken
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: syncResult,
        message: 'Instagram posts synced successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
