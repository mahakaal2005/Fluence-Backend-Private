import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.SOCIAL_FEATURES_PORT || 4007);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100);

  // Database configuration
  const db = {
    host: process.env.SOCIAL_DB_HOST || '161.248.37.208',
    port: Number(process.env.SOCIAL_DB_PORT || 5432),
    database: process.env.SOCIAL_DB_NAME || 'postgres',
    user: process.env.SOCIAL_DB_USER || 'bp-user',
    password: process.env.SOCIAL_DB_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
    ssl: process.env.SOCIAL_DB_SSL === 'true',
    uri: process.env.SOCIAL_DB_URI
  };

  // JWT configuration
  const jwt = {
    secret: process.env.JWT_SECRET || (nodeEnv === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'change_me'),
    expiresIn: process.env.JWT_EXPIRES_IN || (nodeEnv === 'production' ? '1h' : '1d')
  };

  // Service URLs
  const services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://161.248.37.235:4001',
    points: process.env.POINTS_SERVICE_URL || 'http://161.248.37.235:4005',
    referral: process.env.REFERRAL_SERVICE_URL || 'http://161.248.37.235:4006',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://161.248.37.235:4004',
    merchant: process.env.MERCHANT_ONBOARDING_SERVICE_URL || 'http://161.248.37.235:4003'
  };

  // Social media configuration
  const social = {
    maxPostsPerDay: Number(process.env.SOCIAL_MAX_POSTS_PER_DAY || 10),
    maxMediaPerPost: Number(process.env.SOCIAL_MAX_MEDIA_PER_POST || 10),
    postContentMaxLength: Number(process.env.SOCIAL_POST_CONTENT_MAX_LENGTH || 280),
    autoVerificationEnabled: process.env.SOCIAL_AUTO_VERIFICATION === 'true',
    verificationTimeoutHours: Number(process.env.SOCIAL_VERIFICATION_TIMEOUT_HOURS || 24),
    engagementTrackingEnabled: process.env.SOCIAL_ENGAGEMENT_TRACKING === 'true',
    analyticsRetentionDays: Number(process.env.SOCIAL_ANALYTICS_RETENTION_DAYS || 365)
  };

  // Social platform configurations
  const platforms = {
    facebook: {
      appId: process.env.FACEBOOK_APP_ID || '',
      appSecret: process.env.FACEBOOK_APP_SECRET || '',
      apiVersion: process.env.FACEBOOK_API_VERSION || 'v18.0'
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID || '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
      apiVersion: process.env.TWITTER_API_VERSION || '2'
    },
    instagram: {
      appId: process.env.INSTAGRAM_APP_ID || '',
      appSecret: process.env.INSTAGRAM_APP_SECRET || '',
      apiVersion: process.env.INSTAGRAM_API_VERSION || 'v1'
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      apiVersion: process.env.LINKEDIN_API_VERSION || 'v2'
    },
    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY || '',
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      apiVersion: process.env.TIKTOK_API_VERSION || 'v1'
    }
  };

  // Reward configuration
  const rewards = {
    postCreationPoints: Number(process.env.SOCIAL_POST_CREATION_POINTS || 10),
    likePoints: Number(process.env.SOCIAL_LIKE_POINTS || 1),
    sharePoints: Number(process.env.SOCIAL_SHARE_POINTS || 2),
    commentPoints: Number(process.env.SOCIAL_COMMENT_POINTS || 3),
    milestonePoints: Number(process.env.SOCIAL_MILESTONE_POINTS || 100),
    bonusPoints: Number(process.env.SOCIAL_BONUS_POINTS || 50),
    milestoneThreshold: Number(process.env.SOCIAL_MILESTONE_THRESHOLD || 10), // 10 posts
    bonusThreshold: Number(process.env.SOCIAL_BONUS_THRESHOLD || 50) // 50 posts
  };

  // Campaign configuration
  const campaign = {
    maxActiveCampaigns: Number(process.env.SOCIAL_MAX_ACTIVE_CAMPAIGNS || 5),
    defaultCampaignDuration: Number(process.env.SOCIAL_DEFAULT_CAMPAIGN_DURATION_DAYS || 30),
    autoStartCampaigns: process.env.SOCIAL_AUTO_START_CAMPAIGNS === 'true',
    autoEndCampaigns: process.env.SOCIAL_AUTO_END_CAMPAIGNS === 'true'
  };

  return { 
    nodeEnv, 
    port, 
    db, 
    jwt, 
    services, 
    social,
    platforms,
    rewards,
    campaign,
    rateLimitWindowMs, 
    rateLimitMax 
  };
}

