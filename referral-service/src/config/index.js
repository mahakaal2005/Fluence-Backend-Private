import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.REFERRAL_PORT || 4006);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100);

  // Database configuration
  const db = {
    host: process.env.REFERRAL_DB_HOST || '161.248.37.208',
    port: Number(process.env.REFERRAL_DB_PORT || 5432),
    database: process.env.REFERRAL_DB_NAME || 'postgres',
    user: process.env.REFERRAL_DB_USER || 'bp-user',
    password: process.env.REFERRAL_DB_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
    ssl: process.env.REFERRAL_DB_SSL === 'true',
    uri: process.env.REFERRAL_DB_URI
  };

  // JWT configuration
  const jwt = {
    secret: process.env.JWT_SECRET || (nodeEnv === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'change_me'),
    expiresIn: process.env.JWT_EXPIRES_IN || (nodeEnv === 'production' ? '1h' : '1d')
  };

  // Service URLs
  const services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:4001',
    points: process.env.POINTS_SERVICE_URL || 'http://points-wallet-service:4005',
    social: process.env.SOCIAL_SERVICE_URL || 'http://social-features-service:4007',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4004'
  };

  // Referral system configuration
  const referral = {
    defaultCampaignId: process.env.REFERRAL_DEFAULT_CAMPAIGN_ID || null,
    maxReferralsPerUser: Number(process.env.REFERRAL_MAX_PER_USER || 0), // 0 means unlimited
    maxTotalReferrals: Number(process.env.REFERRAL_MAX_TOTAL || 0), // 0 means unlimited
    referralCodeLength: Number(process.env.REFERRAL_CODE_LENGTH || 8),
    referralCodePrefix: process.env.REFERRAL_CODE_PREFIX || '',
    referralCodeSuffix: process.env.REFERRAL_CODE_SUFFIX || '',
    defaultExpirationDays: Number(process.env.REFERRAL_DEFAULT_EXPIRATION_DAYS || 365),
    autoExpirationEnabled: process.env.REFERRAL_AUTO_EXPIRATION === 'true',
    leaderboardUpdateInterval: Number(process.env.REFERRAL_LEADERBOARD_UPDATE_INTERVAL || 3600000), // 1 hour
    analyticsRetentionDays: Number(process.env.REFERRAL_ANALYTICS_RETENTION_DAYS || 365)
  };

  // Reward configuration
  const rewards = {
    signupRewardPoints: Number(process.env.REFERRAL_SIGNUP_REWARD_POINTS || 100),
    firstPurchaseRewardPoints: Number(process.env.REFERRAL_FIRST_PURCHASE_REWARD_POINTS || 200),
    milestoneRewardPoints: Number(process.env.REFERRAL_MILESTONE_REWARD_POINTS || 500),
    bonusRewardPoints: Number(process.env.REFERRAL_BONUS_REWARD_POINTS || 1000),
    milestoneThreshold: Number(process.env.REFERRAL_MILESTONE_THRESHOLD || 5), // 5 referrals
    bonusThreshold: Number(process.env.REFERRAL_BONUS_THRESHOLD || 10) // 10 referrals
  };

  // Campaign configuration
  const campaign = {
    maxActiveCampaigns: Number(process.env.REFERRAL_MAX_ACTIVE_CAMPAIGNS || 5),
    defaultCampaignDuration: Number(process.env.REFERRAL_DEFAULT_CAMPAIGN_DURATION_DAYS || 365),
    autoStartCampaigns: process.env.REFERRAL_AUTO_START_CAMPAIGNS === 'true',
    autoEndCampaigns: process.env.REFERRAL_AUTO_END_CAMPAIGNS === 'true'
  };

  return { 
    nodeEnv, 
    port, 
    db, 
    jwt, 
    services, 
    referral,
    rewards,
    campaign,
    rateLimitWindowMs, 
    rateLimitMax 
  };
}
