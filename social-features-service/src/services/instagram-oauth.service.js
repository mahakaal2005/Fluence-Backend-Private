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
   * Generate Instagram OAuth authorization URL
   * Supports two methods:
   * 1. Instagram Graph API with Business Login (default) - Direct Instagram login, NO Facebook required
   * 2. Instagram Graph API with Facebook Login - Requires Facebook Page connection
   * @param {string} redirectUri - The redirect URI after authorization
   * @param {string} state - Optional state parameter for security
   * @param {boolean} useFacebookLogin - Use Facebook Login (default: false - uses Instagram Business Login)
   * @returns {string} OAuth authorization URL
   */
  static generateAuthUrl(redirectUri, state = null, useFacebookLogin = false) {
    const config = getConfig();
    const { appId, appSecret } = config.platforms.instagram;

    if (!appId || !appSecret) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Instagram OAuth not configured. Please set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET environment variables.'
      );
    }

    if (useFacebookLogin) {
      // Instagram Graph API with Facebook Login - Requires Facebook Page connection
      const baseUrl = 'https://www.facebook.com/v18.0/dialog/oauth';
      
      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
        response_type: 'code',
        ...(state && { state })
      });

      return `${baseUrl}?${params.toString()}`;
    } else {
      // Instagram Graph API with Business Login for Instagram (DEFAULT)
      // Users log in with Instagram credentials directly - NO Facebook required
      // Note: OAuth authorization uses api.instagram.com, API calls use graph.instagram.com
      const baseUrl = 'https://api.instagram.com/oauth/authorize';
      
      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        scope: 'instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights',
        response_type: 'code',
        ...(state && { state })
      });

      return `${baseUrl}?${params.toString()}`;
    }
  }

  /**
   * Exchange authorization code for access token
   * Supports Instagram Graph API with Business Login (default) and Facebook Login
   * @param {string} code - Authorization code from Instagram
   * @param {string} redirectUri - The redirect URI used in authorization
   * @param {boolean} useFacebookLogin - Use Facebook Login (default: false - uses Instagram Business Login)
   * @returns {Promise<Object>} Token response with access_token, token_type, expires_in
   */
  static async exchangeCodeForToken(code, redirectUri, useFacebookLogin = false) {
    const config = getConfig();
    const { appId, appSecret } = config.platforms.instagram;

    if (!appId || !appSecret) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Instagram OAuth not configured'
      );
    }

    try {
      if (useFacebookLogin) {
        // Instagram Graph API with Facebook Login - Facebook token exchange
        const tokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token';
        const tokenResponse = await axios.post(tokenUrl, null, {
          params: {
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code: code
          }
        });

        const { access_token, token_type, expires_in } = tokenResponse.data;

        if (!access_token) {
          throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to obtain access token');
        }

        return {
          accessToken: access_token,
          tokenType: token_type || 'bearer',
          expiresIn: expires_in || 3600
        };
      } else {
        // Instagram Graph API with Business Login - Direct Instagram token exchange
        // Note: Initial token exchange uses api.instagram.com, then exchange for long-lived at graph.instagram.com
        const tokenUrl = 'https://api.instagram.com/oauth/access_token';
        const tokenResponse = await axios.post(tokenUrl, null, {
          params: {
            client_id: appId,
            client_secret: appSecret,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code: code
          }
        });

        const { access_token, user_id } = tokenResponse.data;

        if (!access_token) {
          throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to obtain access token');
        }

        return {
          accessToken: access_token,
          userId: user_id,
          tokenType: 'bearer',
          expiresIn: 3600 // Short-lived token, will be exchanged for long-lived
        };
      }
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
   * Supports Instagram Graph API with Business Login (default) and Facebook Login
   * @param {string} shortLivedToken - Short-lived access token
   * @param {boolean} useFacebookLogin - Use Facebook Login (default: false - uses Instagram Business Login)
   * @returns {Promise<Object>} Long-lived token with expires_in
   */
  static async getLongLivedToken(shortLivedToken, useFacebookLogin = false) {
    const config = getConfig();
    const { appId, appSecret } = config.platforms.instagram;

    try {
      if (useFacebookLogin) {
        // Instagram Graph API with Facebook Login - Facebook token exchange
        const tokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token';
        const response = await axios.get(tokenUrl, {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortLivedToken
          }
        });

        const { access_token, expires_in } = response.data;
        return {
          accessToken: access_token,
          expiresIn: expires_in || 5184000 // 60 days default
        };
      } else {
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
      }
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
   * Get Instagram user's pages (required to get Instagram Business Account)
   * @param {string} accessToken - Facebook access token
   * @returns {Promise<Array>} List of pages
   */
  static async getUserPages(accessToken) {
    try {
      const response = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token,instagram_business_account'
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Error getting user pages:', error.response?.data || error.message);
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        error.response?.data?.error?.message || 'Failed to get user pages'
      );
    }
  }

  /**
   * Get Instagram Business Account ID from a page
   * @param {string} pageId - Facebook Page ID
   * @param {string} pageAccessToken - Page access token
   * @returns {Promise<string|null>} Instagram Business Account ID
   */
  static async getInstagramBusinessAccount(pageId, pageAccessToken) {
    try {
      const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
        params: {
          access_token: pageAccessToken,
          fields: 'instagram_business_account'
        }
      });

      return response.data.instagram_business_account?.id || null;
    } catch (error) {
      console.error('Error getting Instagram Business Account:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get Instagram user profile
   * Supports Instagram Graph API with Business Login (default) and Facebook Login
   * @param {string} instagramAccountId - Instagram Account ID or 'me'
   * @param {string} accessToken - Access token
   * @param {boolean} useFacebookLogin - Use Facebook Login (default: false - uses Instagram Business Login)
   * @returns {Promise<Object>} Instagram user profile
   */
  static async getInstagramProfile(instagramAccountId, accessToken, useFacebookLogin = false) {
    try {
      if (useFacebookLogin) {
        // Instagram Graph API with Facebook Login - Get Business Account profile
        const response = await axios.get(`https://graph.instagram.com/${instagramAccountId}`, {
          params: {
            access_token: accessToken,
            fields: 'id,username,account_type,media_count'
          }
        });

        return {
          id: response.data.id,
          username: response.data.username,
          accountType: response.data.account_type,
          mediaCount: response.data.media_count || 0
        };
      } else {
        // Instagram Graph API with Business Login - Get user profile using 'me'
        const response = await axios.get('https://graph.instagram.com/me', {
          params: {
            access_token: accessToken,
            fields: 'id,username,account_type,media_count'
          }
        });

        return {
          id: response.data.id,
          username: response.data.username,
          accountType: response.data.account_type || 'BUSINESS',
          mediaCount: response.data.media_count || 0
        };
      }
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
   * Supports Instagram Graph API with Business Login (default) and Facebook Login
   * @param {string} code - Authorization code
   * @param {string} redirectUri - Redirect URI
   * @param {string} userId - User ID
   * @param {boolean} useFacebookLogin - Use Facebook Login (default: false - uses Instagram Business Login)
   * @returns {Promise<Object>} Connected social account
   */
  static async connectInstagramAccount(code, redirectUri, userId, useFacebookLogin = false) {
    try {
      // Step 1: Exchange code for short-lived token
      const tokenData = await this.exchangeCodeForToken(code, redirectUri, useFacebookLogin);
      const shortLivedToken = tokenData.accessToken;
      const instagramUserId = tokenData.userId; // From Instagram Business Login

      // Step 2: Get long-lived token
      const longLivedTokenData = await this.getLongLivedToken(shortLivedToken, useFacebookLogin);
      const accessToken = longLivedTokenData.accessToken;
      const expiresIn = longLivedTokenData.expiresIn;

      let instagramAccountId = null;
      let username = null;
      let displayName = null;
      let finalAccessToken = accessToken; // Default to long-lived token

      if (useFacebookLogin) {
        // Instagram Graph API - Requires Facebook Page connection
        // Step 3: Get user's pages to find Instagram Business Account
        const pages = await this.getUserPages(accessToken);
        
        if (pages.length === 0) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            'No Facebook pages found. Please create a Facebook Page and connect it to an Instagram Business Account.'
          );
        }

        // Find page with Instagram Business Account
        let pageAccessToken = null;

        for (const page of pages) {
          if (page.instagram_business_account) {
            instagramAccountId = page.instagram_business_account.id;
            pageAccessToken = page.access_token;
            displayName = page.name;
            break;
          }
        }

        if (!instagramAccountId) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            'No Instagram Business Account found. Please connect your Instagram account to a Facebook Page.'
          );
        }

        // Step 4: Get Instagram profile
        const profile = await this.getInstagramProfile(instagramAccountId, pageAccessToken, true);
        username = profile.username || username;
        // Use page access token for Graph API
        finalAccessToken = pageAccessToken;
      } else {
        // Instagram Graph API with Business Login - Direct Instagram authentication
        // Step 3: Get Instagram profile using 'me' endpoint
        const profile = await this.getInstagramProfile('me', accessToken, false);
        instagramAccountId = profile.id;
        username = profile.username;
        displayName = profile.username;
        finalAccessToken = accessToken; // Use the long-lived token
      }

      // Step 5: Get platform ID
      const platformId = await this.getInstagramPlatformId();

      // Step 6: Calculate token expiration
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // Step 7: Save or update social account
      const pool = getPool();
      const existingAccount = await pool.query(
        'SELECT * FROM social_accounts WHERE user_id = $1 AND platform_id = $2',
        [userId, platformId]
      );

      if (existingAccount.rows.length > 0) {
        // Update existing account
        const updatedAccount = await pool.query(
          `UPDATE social_accounts 
           SET platform_user_id = $3, username = $4, display_name = $5, 
               access_token = $6, token_expires_at = $7, 
               is_connected = true, last_sync_at = NOW(), updated_at = NOW()
           WHERE user_id = $1 AND platform_id = $2 
           RETURNING *`,
          [userId, platformId, instagramAccountId, username, displayName || username, finalAccessToken, tokenExpiresAt]
        );

        return updatedAccount.rows[0];
      } else {
        // Create new account
        const newAccount = await pool.query(
          `INSERT INTO social_accounts (
            user_id, platform_id, platform_user_id, username, display_name, 
            access_token, token_expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [userId, platformId, instagramAccountId, username, displayName || username, finalAccessToken, tokenExpiresAt]
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

