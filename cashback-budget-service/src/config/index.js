import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.CASHBACK_BUDGET_PORT || 4002);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100);

  // Database configuration
  const db = {
    host: process.env.CASHBACK_DB_HOST || '161.248.37.208',
    port: Number(process.env.CASHBACK_DB_PORT || 5432),
    database: process.env.CASHBACK_DB_NAME || 'postgres',
    user: process.env.CASHBACK_DB_USER || 'bp-user',
    password: process.env.CASHBACK_DB_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
    ssl: process.env.CASHBACK_DB_SSL === 'true',
    uri: process.env.CASHBACK_DB_URI
  };

  // JWT configuration
  const jwt = {
    secret: process.env.JWT_SECRET || (nodeEnv === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'change_me'),
    expiresIn: process.env.JWT_EXPIRES_IN || (nodeEnv === 'production' ? '1h' : '1d')
  };

  // Email configuration
  const email = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@fluencepay.com'
  };

  // Service URLs
  const services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
    merchant: process.env.MERCHANT_SERVICE_URL || 'http://localhost:4003',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4004',
    points: process.env.POINTS_WALLET_SERVICE_URL || 'http://localhost:4005'
  };

  // Financial settings
  const financial = {
    defaultCurrency: 'AED',
    maxCashbackPercentage: 100.00,
    minCashbackPercentage: 0.01,
    defaultAutoStopThreshold: 50.00,
    defaultAlertThreshold: 60.00,
    maxBudgetAmount: 1000000.00, // 1M AED
    minBudgetAmount: 100.00 // 100 AED
  };

  // Campaign settings
  const campaign = {
    maxCampaignDuration: 365, // days
    minCampaignDuration: 1, // day
    maxActiveCampaigns: 5,
    defaultCampaignName: 'Cashback Campaign'
  };

  return {
    nodeEnv,
    port,
    db,
    jwt,
    email,
    services,
    financial,
    campaign,
    rateLimitWindowMs,
    rateLimitMax
  };
}
