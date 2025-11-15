import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.POINTS_WALLET_PORT || 4005);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100);

  // Database configuration
  const db = {
    host: process.env.POINTS_DB_HOST || '161.248.37.208',
    port: Number(process.env.POINTS_DB_PORT || 5432),
    database: process.env.POINTS_DB_NAME || 'postgres',
    user: process.env.POINTS_DB_USER || 'bp-user',
    password: process.env.POINTS_DB_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
    ssl: process.env.POINTS_DB_SSL === 'true',
    uri: process.env.POINTS_DB_URI
  };

  // JWT configuration
  const jwt = {
    secret: process.env.JWT_SECRET || (nodeEnv === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'change_me'),
    expiresIn: process.env.JWT_EXPIRES_IN || (nodeEnv === 'production' ? '1h' : '1d')
  };

  // Service URLs
  const services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://161.248.37.235:4001',
    referral: process.env.REFERRAL_SERVICE_URL || 'http://161.248.37.235:4006',
    social: process.env.SOCIAL_SERVICE_URL || 'http://161.248.37.235:4007',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://161.248.37.235:4004'
  };

  // Points system configuration
  const points = {
    defaultExpirationDays: Number(process.env.POINTS_DEFAULT_EXPIRATION_DAYS || 365),
    maxPointsPerTransaction: Number(process.env.POINTS_MAX_PER_TRANSACTION || 10000),
    minPointsForRedemption: Number(process.env.POINTS_MIN_REDEMPTION || 100),
    maxPointsForRedemption: Number(process.env.POINTS_MAX_REDEMPTION || 50000),
    autoExpirationEnabled: process.env.POINTS_AUTO_EXPIRATION === 'true',
    expirationWarningDays: Number(process.env.POINTS_EXPIRATION_WARNING_DAYS || 30),
    socialPostRequired: process.env.POINTS_SOCIAL_POST_REQUIRED === 'true',
    timeBufferHours: Number(process.env.POINTS_TIME_BUFFER_HOURS || 24)
  };

  // Wallet configuration
  const wallet = {
    maxBalance: Number(process.env.WALLET_MAX_BALANCE || 100000),
    minBalance: Number(process.env.WALLET_MIN_BALANCE || 0),
    autoRedemptionEnabled: process.env.WALLET_AUTO_REDEMPTION === 'true',
    autoRedemptionThreshold: Number(process.env.WALLET_AUTO_REDEMPTION_THRESHOLD || 1000),
    transferEnabled: process.env.WALLET_TRANSFER_ENABLED === 'true',
    maxTransferAmount: Number(process.env.WALLET_MAX_TRANSFER_AMOUNT || 5000)
  };

  // Financial settings
  const financial = {
    currency: process.env.FINANCIAL_CURRENCY || 'AED',
    pointsToCurrencyRate: Number(process.env.POINTS_TO_CURRENCY_RATE || 0.01), // 1 point = 0.01 AED
    maxDailyEarnings: Number(process.env.MAX_DAILY_EARNINGS || 1000),
    maxDailyRedemptions: Number(process.env.MAX_DAILY_REDEMPTIONS || 5000),
    auditRetentionDays: Number(process.env.AUDIT_RETENTION_DAYS || 2555) // 7 years
  };

  return { 
    nodeEnv, 
    port, 
    db, 
    jwt, 
    services, 
    points,
    wallet,
    financial,
    rateLimitWindowMs, 
    rateLimitMax 
  };
}
