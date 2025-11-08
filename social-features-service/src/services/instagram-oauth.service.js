import axios from 'axios';
import { getConfig } from '../config/index.js';
import { getPool } from '../config/database.js';
import { ApiError } from '../middleware/error.js';
import { StatusCodes } from 'http-status-codes';

export class InstagramOAuthService {
  /**
   * Get Instagram platform ID from database
   */
  static async getInstagramPlatformId() {
    const pool = getPool();
    const result = await pool.query(
      "SELECT id FROM social_platforms WHERE name = 'instagram' LIMIT 1"
    );
    if (result.rows.length === 0) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Instagram platform not configured');
    }
    return result.rows[0].id;
  }

  /**
   * Normalize redirect URI to ensure consistency
   * Removes query parameters and fragments (not allowed in redirect URI configuration)
   * Preserves path structure including trailing slashes as they must match dashboard config
   * @param {string} redirectUri - The redirect URI to normalize
   * @returns {string} Normalized redirect URI
   */
  static normalizeRedirectUri(redirectUri) {
    if (!redirectUri) {
      return redirectUri;
    }
    
    try {
      const url = new URL(redirectUri);
      // Preserve pathname as-is (including trailing slashes) - must match dashboard exactly
      // Only remove query and hash (they're not allowed in redirect URI configuration)
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch (error) {
      // If URL parsing fails, return as-is
      return redirectUri;
    }
  }

  /**
   * Generate Instagram OAuth authorization URL
   * Uses Instagram Graph API with Business Login - Direct Instagram login, NO Facebook required
   * @param {string} redirectUri - The redirect URI after authorization
   * @param {string} state - Optional state parameter for security
   * @returns {string} OAuth authorization URL
   */
  static generateAuthUrl(redirectUri, state = null) {
    const config = getConfig();
    const { appId, appSecret } = config.platforms.instagram;

    if (!appId || !appSecret) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Instagram OAuth not configured. Please set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET environment variables.'
      );
    }

    // Normalize redirect URI to ensure consistency
    const normalizedRedirectUri = this.normalizeRedirectUri(redirectUri);

    // Instagram Graph API with Business Login
    // OAuth authorization uses www.instagram.com, API calls use graph.instagram.com
    // Using new scope values (instagram_business_*) as per Instagram Business Login documentation
    const baseUrl = 'https://www.instagram.com/oauth/authorize';
    
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: normalizedRedirectUri,
      scope: 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages',
      response_type: 'code',
      ...(state && { state })
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * Uses Instagram Graph API with Business Login
   * @param {string} code - Authorization code from Instagram
   * @param {string} redirectUri - The redirect URI used in authorization
   * @returns {Promise<Object>} Token response with access_token, token_type, expires_in
   */
  static async exchangeCodeForToken(code, redirectUri) {
    const config = getConfig();
    const { appId, appSecret } = config.platforms.instagram;

    if (!appId || !appSecret) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Instagram OAuth not configured'
      );
    }

    try {
      // Instagram Graph API with Business Login - Direct Instagram token exchange
      // Note: Initial token exchange uses api.instagram.com, then exchange for long-lived at graph.instagram.com
      // Using form data (application/x-www-form-urlencoded) as per Instagram API documentation
      const tokenUrl = 'https://api.instagram.com/oauth/access_token';
      const formData = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code
      });
      
      const tokenResponse = await axios.post(tokenUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Response format: { "data": [{ "access_token": "...", "user_id": "...", "permissions": "..." }] }
      const responseData = tokenResponse.data;
      let access_token, user_id;
      
      if (responseData.data && Array.isArray(responseData.data) && responseData.data.length > 0) {
        // New format with data array
        access_token = responseData.data[0].access_token;
        user_id = responseData.data[0].user_id;
      } else {
        // Fallback to direct format (for backward compatibility)
        access_token = responseData.access_token;
        user_id = responseData.user_id;
      }

      if (!access_token) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to obtain access token');
      }

      return {
        accessToken: access_token,
        userId: user_id,
        tokenType: 'bearer',
        expiresIn: 3600 // Short-lived token, will be exchanged for long-lived
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        error.response?.data?.error?.message || error.response?.data?.error_message || 'Failed to exchange authorization code for access token'
      );
    }
  }

  /**
   * Exchange short-lived token for long-lived token
   * Uses Instagram Graph API with Business Login
   * @param {string} shortLivedToken - Short-lived access token
   * @returns {Promise<Object>} Long-lived token with expires_in
   */
  static async getLongLivedToken(shortLivedToken) {
    const config = getConfig();
    const { appId, appSecret } = config.platforms.instagram;

    try {
      // Instagram Graph API with Business Login - Exchange for long-lived token (60 days)
      const tokenUrl = 'https://graph.instagram.com/access_token';
      const response = await axios.get(tokenUrl, {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: appSecret,
          access_token: shortLivedToken
        }
      });

      const { access_token, token_type, expires_in } = response.data;
      return {
        accessToken: access_token,
        tokenType: token_type || 'bearer',
        expiresIn: expires_in || 5184000 // 60 days default
      };
    } catch (error) {
      console.error('Error getting long-lived token:', error.response?.data || error.message);
      // If long-lived token exchange fails, return the short-lived token
      return {
        accessToken: shortLivedToken,
        expiresIn: 3600
      };
    }
  }

  /**
   * Get Instagram user profile
   * Uses Instagram Graph API with Business Login
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} Instagram user profile
   */
  static async getInstagramProfile(accessToken) {
    try {
      // Instagram Graph API with Business Login - Get user profile using 'me'
      // Fetch comprehensive profile data including all available fields
      const response = await axios.get('https://graph.instagram.com/me', {
        params: {
          access_token: accessToken,
          fields: 'id,user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count'
        }
      });

      // Handle response format - Instagram API may return data in array format or object format
      const data = Array.isArray(response.data.data) && response.data.data.length > 0 
        ? response.data.data[0] 
        : response.data;

      return {
        id: data.id, // App-scoped ID
        userId: data.user_id || data.id, // Instagram professional account ID (fallback to id if user_id not available)
        username: data.username,
        name: data.name || null,
        accountType: data.account_type || 'BUSINESS',
        profilePictureUrl: data.profile_picture_url || null,
        followersCount: data.followers_count || 0,
        followsCount: data.follows_count || 0,
        mediaCount: data.media_count || 0
      };
    } catch (error) {
      console.error('Error getting Instagram profile:', error.response?.data || error.message);
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        error.response?.data?.error?.message || 'Failed to get Instagram profile'
      );
    }
  }

  /**
   * Complete Instagram OAuth flow and connect account
   * Uses Instagram Graph API with Business Login
   * @param {string} code - Authorization code
   * @param {string} redirectUri - Redirect URI
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Connected social account
   */
  static async connectInstagramAccount(code, redirectUri, userId) {
    try {
      // Step 1: Exchange code for short-lived token
      const tokenData = await this.exchangeCodeForToken(code, redirectUri);
      const shortLivedToken = tokenData.accessToken;

      // Step 2: Get long-lived token
      const longLivedTokenData = await this.getLongLivedToken(shortLivedToken);
      const accessToken = longLivedTokenData.accessToken;
      const expiresIn = longLivedTokenData.expiresIn;

      // Step 3: Get Instagram profile using 'me' endpoint
      const profile = await this.getInstagramProfile(accessToken);
      console.log('Instagram profile data retrieved:', {
        id: profile.id,
        userId: profile.userId,
        username: profile.username,
        name: profile.name,
        accountType: profile.accountType,
        profilePictureUrl: profile.profilePictureUrl,
        followersCount: profile.followersCount,
        followsCount: profile.followsCount,
        mediaCount: profile.mediaCount
      });
      
      // Extract profile data
      const instagramAccountId = profile.id; // App-scoped ID (stored as platform_user_id)
      const instagramUserId = profile.userId; // Instagram professional account ID
      const username = profile.username;
      const displayName = profile.name || profile.username; // Use name if available, otherwise username
      const name = profile.name || null;
      const accountType = profile.accountType || 'BUSINESS';
      const profilePictureUrl = profile.profilePictureUrl || null;
      const followersCount = profile.followersCount || 0;
      const followsCount = profile.followsCount || 0;
      const mediaCount = profile.mediaCount || 0;

      // Step 4: Get platform ID
      const platformId = await this.getInstagramPlatformId();

      // Step 5: Calculate token expiration
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // Step 6: Save or update social account
      const pool = getPool();
      const existingAccount = await pool.query(
        'SELECT * FROM social_accounts WHERE user_id = $1 AND platform_id = $2',
        [userId, platformId]
      );

      if (existingAccount.rows.length > 0) {
        // Update existing account with all profile fields
        const updatedAccount = await pool.query(
          `UPDATE social_accounts 
           SET platform_user_id = $3, instagram_user_id = $4, username = $5, display_name = $6, 
               name = $7, account_type = $8, profile_picture_url = $9, 
               followers_count = $10, follows_count = $11, media_count = $12,
               access_token = $13, token_expires_at = $14, 
               is_connected = true, last_sync_at = NOW(), updated_at = NOW()
           WHERE user_id = $1 AND platform_id = $2 
           RETURNING *`,
          [userId, platformId, instagramAccountId, instagramUserId, username, displayName, name, 
           accountType, profilePictureUrl, followersCount, followsCount, mediaCount, 
           accessToken, tokenExpiresAt]
        );

        return updatedAccount.rows[0];
      } else {
        // Create new account with all profile fields
        const newAccount = await pool.query(
          `INSERT INTO social_accounts (
            user_id, platform_id, platform_user_id, instagram_user_id, username, display_name, 
            name, account_type, profile_picture_url, followers_count, follows_count, media_count,
            access_token, token_expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
          [userId, platformId, instagramAccountId, instagramUserId, username, displayName, name,
           accountType, profilePictureUrl, followersCount, followsCount, mediaCount,
           accessToken, tokenExpiresAt]
        );

        return newAccount.rows[0];
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      console.error('Error connecting Instagram account:', error);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to connect Instagram account'
      );
    }
  }

  /**
   * Refresh Instagram access token if expired
   * @param {string} currentToken - Current access token
   * @returns {Promise<Object>} New token data
   */
  static async refreshToken(currentToken) {
    try {
      // Instagram long-lived tokens can be refreshed
      const response = await axios.get('https://graph.instagram.com/refresh_access_token', {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: currentToken
        }
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in || 5184000
      };
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Failed to refresh Instagram access token'
      );
    }
  }

  /**
   * Get Instagram user media/posts
   * Uses Instagram Graph API with Business Login
   * @param {string} accessToken - Access token
   * @param {Object} options - Optional parameters (limit, after cursor for pagination)
   * @returns {Promise<Object>} Instagram media/posts with pagination
   */
  static async getInstagramMedia(accessToken, options = {}) {
    try {
      const { limit = 25, after = null } = options;
      
      // Instagram Graph API - Get user media using 'me/media' endpoint
      const params = {
        access_token: accessToken,
        fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,thumbnail_url',
        limit: limit
      };

      if (after) {
        params.after = after;
      }

      const response = await axios.get('https://graph.instagram.com/me/media', { params });

      // Transform Instagram media to a more usable format
      const media = (response.data.data || []).map(item => ({
        id: item.id,
        caption: item.caption || '',
        mediaType: item.media_type || 'IMAGE', // IMAGE, VIDEO, CAROUSEL_ALBUM
        mediaUrl: item.media_url || null,
        thumbnailUrl: item.thumbnail_url || null,
        permalink: item.permalink || null,
        timestamp: item.timestamp || null,
        likeCount: item.like_count || 0,
        commentsCount: item.comments_count || 0
      }));

      return {
        data: media,
        paging: response.data.paging || null,
        summary: {
          total: media.length,
          hasMore: !!response.data.paging?.next
        }
      };
    } catch (error) {
      console.error('Error getting Instagram media:', error.response?.data || error.message);
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        error.response?.data?.error?.message || 'Failed to get Instagram media'
      );
    }
  }

  /**
   * Get all Instagram user media/posts with pagination
   * Fetches all pages of media
   * @param {string} accessToken - Access token
   * @param {number} maxPosts - Maximum number of posts to fetch (default: 100)
   * @returns {Promise<Array>} Array of all Instagram media/posts
   */
  static async getAllInstagramMedia(accessToken, maxPosts = 100) {
    try {
      const allMedia = [];
      let after = null;
      let hasMore = true;
      const limit = 25; // Instagram API max per page

      while (hasMore && allMedia.length < maxPosts) {
        const result = await this.getInstagramMedia(accessToken, {
          limit: Math.min(limit, maxPosts - allMedia.length),
          after: after
        });

        allMedia.push(...result.data);

        if (result.paging && result.paging.next && allMedia.length < maxPosts) {
          // Extract cursor from next URL
          const nextUrl = new URL(result.paging.next);
          after = nextUrl.searchParams.get('after');
          hasMore = true;
        } else {
          hasMore = false;
        }

        // Add a small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return allMedia.slice(0, maxPosts);
    } catch (error) {
      console.error('Error getting all Instagram media:', error);
      throw error;
    }
  }

  /**
   * Extract Instagram mentions from post caption
   * @param {string} caption - Post caption
   * @returns {Array<string>} Array of Instagram usernames (without @)
   */
  static extractMentions(caption) {
    if (!caption) return [];
    // Match @mentions in Instagram format
    const mentionRegex = /@([a-zA-Z0-9._]+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(caption)) !== null) {
      mentions.push(match[1].toLowerCase());
    }
    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Find and link post to transaction based on merchant tag
   * @param {string} userId - User ID
   * @param {string} postId - Post ID
   * @param {Array<string>} mentions - Array of Instagram usernames
   * @param {Date} publishedAt - Post published timestamp
   * @returns {Promise<string|null>} Transaction ID if linked, null otherwise
   */
  static async autoLinkPostToTransaction(userId, postId, mentions, publishedAt, authToken = null) {
    if (!mentions || mentions.length === 0) {
      console.log(`[AUTO-LINK] No mentions found in post ${postId}`);
      return null;
    }

    const pool = getPool();
    
    try {
      console.log(`[AUTO-LINK] Starting auto-link for post ${postId}`);
      console.log(`[AUTO-LINK] User ID: ${userId}, Mentions: ${mentions.join(', ')}, Published: ${publishedAt}`);
      
      // Get merchant service URL from config
      const { getConfig } = await import('../config/index.js');
      const config = getConfig();
      const merchantServiceUrl = config.services?.merchant || process.env.MERCHANT_ONBOARDING_SERVICE_URL || 'http://localhost:4003';
      
      console.log(`[AUTO-LINK] Using merchant service URL: ${merchantServiceUrl}`);

      // Find merchants by instagram_id
      const merchantIds = [];
      for (const mention of mentions) {
        try {
          console.log(`[AUTO-LINK] Looking up merchant for @${mention}`);
          
          // This is a public endpoint - do NOT include auth token to avoid admin checks
          const merchantResponse = await fetch(
            `${merchantServiceUrl}/api/profiles/by-instagram/${encodeURIComponent(mention)}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (merchantResponse.ok) {
            const merchantData = await merchantResponse.json();
            if (merchantData.success && merchantData.data?.id) {
              console.log(`[AUTO-LINK] Found merchant: ${merchantData.data.id} (${merchantData.data.businessName})`);
              merchantIds.push(merchantData.data.id);
            } else {
              console.log(`[AUTO-LINK] Merchant response OK but no data for @${mention}`);
            }
          } else {
            const errorText = await merchantResponse.text();
            console.log(`[AUTO-LINK] Merchant lookup failed for @${mention}: ${merchantResponse.status} - ${errorText}`);
          }
        } catch (err) {
          console.error(`[AUTO-LINK] Error fetching merchant for @${mention}:`, err.message);
        }
      }

      if (merchantIds.length === 0) {
        console.log(`[AUTO-LINK] No merchants found for mentions: ${mentions.join(', ')}`);
        return null;
      }

      // Check if post is within last 24 hours
      const now = new Date();
      const postAge = now.getTime() - publishedAt.getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (postAge > twentyFourHours) {
        console.log(`[AUTO-LINK] Post ${postId} is older than 24 hours (${Math.round(postAge / (60 * 60 * 1000))} hours old), skipping auto-link`);
        return null;
      }

      // Find pending cashback transactions for these merchants and user
      // Look for transactions created in the last 24 hours (within 24h window from now)
      const timeWindowStart = new Date(now);
      timeWindowStart.setHours(timeWindowStart.getHours() - 24);

      console.log(`[AUTO-LINK] Post is within 24 hours. Searching for transactions created in last 24 hours (between ${timeWindowStart.toISOString()} and ${now.toISOString()})`);

      // Try to query cashback_transactions directly if in same database
      // Otherwise, we'll need to query points_transactions by reference_id
      let matchingTransactionId = null;
      
      try {
        // First, try to find cashback transactions directly (if in same DB)
        // Look for transactions created in the last 24 hours for these merchants
        const cashbackQuery = `
          SELECT ct.id, ct.created_at, ct.merchant_id, ct.status
          FROM cashback_transactions ct
          WHERE ct.customer_id = $1
            AND ct.merchant_id = ANY($2::uuid[])
            AND ct.status = 'pending'
            AND ct.created_at >= $3
            AND ct.created_at <= $4
          ORDER BY ct.created_at DESC
          LIMIT 1
        `;
        
        const cashbackResult = await pool.query(cashbackQuery, [
          userId,
          merchantIds,
          timeWindowStart, // 24 hours ago
          now // Current time
        ]);

        if (cashbackResult.rows.length > 0) {
          matchingTransactionId = cashbackResult.rows[0].id;
          console.log(`[AUTO-LINK] Found cashback transaction: ${matchingTransactionId}`);
        } else {
          console.log(`[AUTO-LINK] No cashback transactions found, trying points_transactions...`);
          
          // If no cashback transaction found, try to find via points_transactions
          // Points transactions have reference_id that should match cashback transaction ID
          // We need to find points transactions for this user that need social posts (created in last 24 hours)
          const pointsQuery = `
            SELECT pt.reference_id, pt.created_at
            FROM points_transactions pt
            WHERE pt.user_id = $1
              AND pt.social_post_required = true
              AND pt.social_post_made = false
              AND pt.status = 'pending'
              AND pt.created_at >= $2
              AND pt.created_at <= $3
            ORDER BY pt.created_at DESC
            LIMIT 10
          `;
          
          const pointsResult = await pool.query(pointsQuery, [
            userId,
            timeWindowStart, // 24 hours ago
            now // Current time
          ]);

          if (pointsResult.rows.length > 0) {
            // For each reference_id, check if it's a cashback transaction for one of our merchants
            for (const ptRow of pointsResult.rows) {
              if (ptRow.reference_id) {
                // Try to verify this is a cashback transaction for one of our merchants
                const verifyQuery = `
                  SELECT id FROM cashback_transactions
                  WHERE id = $1 AND merchant_id = ANY($2::uuid[])
                `;
                const verifyResult = await pool.query(verifyQuery, [ptRow.reference_id, merchantIds]);
                
                if (verifyResult.rows.length > 0) {
                  matchingTransactionId = ptRow.reference_id;
                  console.log(`[AUTO-LINK] Found transaction via points_transactions: ${matchingTransactionId}`);
                  break;
                }
              }
            }
          }
        }
      } catch (dbError) {
        console.error(`[AUTO-LINK] Database query error:`, dbError.message);
        // If direct DB query fails, might be in different database - try API approach
        console.log(`[AUTO-LINK] Falling back to API approach...`);
        
        // Fallback: Query points_transactions by user and check reference_id
        // This assumes points_transactions is in the same DB as social_posts
        try {
          const fallbackQuery = `
            SELECT reference_id, created_at
            FROM points_transactions
            WHERE user_id = $1
              AND social_post_required = true
              AND social_post_made = false
              AND status = 'pending'
              AND created_at >= $2
              AND created_at <= $3
            ORDER BY created_at DESC
            LIMIT 5
          `;
          
          const fallbackResult = await pool.query(fallbackQuery, [
            userId,
            timeWindowStart, // 24 hours ago
            now // Current time
          ]);

          if (fallbackResult.rows.length > 0) {
            // Use the most recent one (we can't verify merchant without API call, but this is better than nothing)
            matchingTransactionId = fallbackResult.rows[0].reference_id;
            console.log(`[AUTO-LINK] Using fallback transaction: ${matchingTransactionId}`);
          }
        } catch (fallbackError) {
          console.error(`[AUTO-LINK] Fallback query also failed:`, fallbackError.message);
        }
      }

      // If we found a matching transaction, link it
      if (matchingTransactionId) {
        console.log(`[AUTO-LINK] Linking post ${postId} to transaction ${matchingTransactionId}`);
        
        // Update post with transaction ID
        await pool.query(
          `UPDATE social_posts 
           SET original_transaction_id = $1, status = 'pending_review', updated_at = NOW()
           WHERE id = $2`,
          [matchingTransactionId, postId]
        );

        // Update points_transactions to mark social_post_made
        try {
          const pointsUpdateResult = await pool.query(
            `UPDATE points_transactions 
             SET social_post_made = true, updated_at = NOW()
             WHERE reference_id = $1 AND social_post_made = false`,
            [matchingTransactionId.toString()]
          );
          
          if (pointsUpdateResult.rowCount > 0) {
            console.log(`[AUTO-LINK] Updated ${pointsUpdateResult.rowCount} point transaction(s) to set social_post_made = true`);
          } else {
            console.log(`[AUTO-LINK] No points transactions updated (may already be marked or not found)`);
          }
        } catch (err) {
          console.error(`[AUTO-LINK] Error updating points transaction:`, err.message);
          // Don't fail the sync if this fails
        }

        console.log(`[AUTO-LINK] ✅ Successfully auto-linked post ${postId} to transaction ${matchingTransactionId}`);
        return matchingTransactionId;
      } else {
        console.log(`[AUTO-LINK] ❌ No matching transaction found for post ${postId}`);
      }

      return null;
    } catch (error) {
      console.error(`[AUTO-LINK] ❌ Error in autoLinkPostToTransaction:`, error);
      console.error(`[AUTO-LINK] Error stack:`, error.stack);
      return null; // Don't fail the sync if auto-linking fails
    }
  }

  /**
   * Sync Instagram posts to database
   * Fetches posts from Instagram and saves/updates them in the database
   * @param {string} userId - User ID
   * @param {string} socialAccountId - Social account ID
   * @param {string} accessToken - Instagram access token
   * @param {number} maxPosts - Maximum number of posts to sync (default: 100)
   * @returns {Promise<Object>} Sync result with counts
   */
  static async syncInstagramPosts(userId, socialAccountId, accessToken, maxPosts = 100, authToken = null) {
    try {
      const pool = getPool();
      
      // Fetch all media from Instagram
      const media = await this.getAllInstagramMedia(accessToken, maxPosts);
      
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let autoLinked = 0;

      for (const item of media) {
        // Determine post type based on media type
        let postType = 'image';
        if (item.mediaType === 'VIDEO') {
          postType = 'video';
        } else if (item.mediaType === 'CAROUSEL_ALBUM') {
          postType = 'image'; // Carousel albums are treated as images
        }

        // Prepare media URLs array
        const mediaUrls = [];
        if (item.mediaUrl) {
          mediaUrls.push(item.mediaUrl);
        }
        if (item.thumbnailUrl && item.thumbnailUrl !== item.mediaUrl) {
          mediaUrls.push(item.thumbnailUrl);
        }

        // Parse timestamp
        const publishedAt = item.timestamp ? new Date(item.timestamp) : new Date();

        // Check if post is within last 24 hours (only process recent posts for auto-linking)
        const now = new Date();
        const postAge = now.getTime() - publishedAt.getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const isRecentPost = postAge <= twentyFourHours;

        // Extract mentions from caption
        const mentions = this.extractMentions(item.caption);
        console.log(`[SYNC] Post ${item.id}: Caption="${item.caption?.substring(0, 100)}...", Mentions=[${mentions.join(', ')}], Published: ${publishedAt.toISOString()}, Age: ${Math.round(postAge / (60 * 60 * 1000))} hours, Recent: ${isRecentPost}`);

        // Check if post already exists
        const existingPost = await pool.query(
          'SELECT id, original_transaction_id FROM social_posts WHERE social_account_id = $1 AND platform_post_id = $2',
          [socialAccountId, item.id]
        );

        if (existingPost.rows.length > 0) {
          const postId = existingPost.rows[0].id;
          const existingTransactionId = existingPost.rows[0].original_transaction_id;

          // Update existing post
          await pool.query(
            `UPDATE social_posts 
             SET content = $1, media_urls = $2, post_type = $3,
                 likes_count = $4, comments_count = $5,
                 published_at = $6, updated_at = NOW()
             WHERE id = $7`,
            [
              item.caption,
              mediaUrls,
              postType,
              item.likeCount,
              item.commentsCount,
              publishedAt,
              postId
            ]
          );

          // Try to auto-link if not already linked and post is within last 24 hours
          if (!existingTransactionId && mentions.length > 0 && isRecentPost) {
            const linkedTransactionId = await this.autoLinkPostToTransaction(
              userId,
              postId,
              mentions,
              publishedAt,
              authToken
            );
            if (linkedTransactionId) {
              autoLinked++;
            }
          } else if (!isRecentPost && mentions.length > 0) {
            console.log(`[SYNC] Post ${postId} is older than 24 hours, skipping auto-link`);
          }

          updated++;
        } else {
          // Create new post
          const newPost = await pool.query(
            `INSERT INTO social_posts (
              user_id, social_account_id, platform_post_id, content, media_urls,
              post_type, status, published_at, likes_count, comments_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [
              userId,
              socialAccountId,
              item.id,
              item.caption,
              mediaUrls,
              postType,
              'published', // Posts from Instagram are already published
              publishedAt,
              item.likeCount,
              item.commentsCount
            ]
          );

          const postId = newPost.rows[0].id;

          // Try to auto-link based on merchant tags (only for posts in last 24 hours)
          if (mentions.length > 0 && isRecentPost) {
            const linkedTransactionId = await this.autoLinkPostToTransaction(
              userId,
              postId,
              mentions,
              publishedAt,
              authToken
            );
            if (linkedTransactionId) {
              autoLinked++;
            }
          } else if (!isRecentPost && mentions.length > 0) {
            console.log(`[SYNC] Post ${postId} is older than 24 hours, skipping auto-link`);
          }

          created++;
        }
      }

      // Update last_sync_at for the social account
      await pool.query(
        'UPDATE social_accounts SET last_sync_at = NOW() WHERE id = $1',
        [socialAccountId]
      );

      return {
        total: media.length,
        created,
        updated,
        skipped,
        autoLinked
      };
    } catch (error) {
      console.error('Error syncing Instagram posts:', error);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to sync Instagram posts'
      );
    }
  }
}

