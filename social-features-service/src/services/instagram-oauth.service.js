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
}

