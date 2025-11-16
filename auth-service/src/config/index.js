import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.PORT || 4001);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100);

  const pg = {
    uri: process.env.PG_URI,
    host: process.env.PG_HOST || '161.248.37.208',
    port: Number(process.env.PG_PORT || 5432),
    database: process.env.PG_DATABASE || 'postgres',
    user: process.env.PG_USER || 'bp-user',
    password: process.env.PG_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
    ssl: (process.env.PG_SSL || 'false').toLowerCase() === 'true'
  };

  const jwt = {
    secret: process.env.JWT_SECRET || (nodeEnv === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'change_me'),
    expiresIn: process.env.JWT_EXPIRES_IN || (nodeEnv === 'production' ? '1h' : '1d')
  };

  const msg91 = {
    authKey: process.env.MSG91_AUTH_KEY || '',
    senderId: process.env.MSG91_SENDER_ID || '',
    templateId: process.env.MSG91_TEMPLATE_ID || '',
    baseUrl: process.env.MSG91_BASE_URL || 'https://control.msg91.com',
    otpExpiryMinutes: Number(process.env.MSG91_OTP_EXPIRY_MINUTES || 10),
    defaultCountryCode: process.env.MSG91_DEFAULT_COUNTRY_CODE || '91'
  };

  // Service URLs
  const services = {
    merchant: process.env.MERCHANT_SERVICE_URL || 'http://merchant-onboarding-service:4003',
    social: process.env.SOCIAL_SERVICE_URL || 'http://social-features-service:4007',
    points: process.env.POINTS_WALLET_SERVICE_URL || 'http://points-wallet-service:4005',
    cashback: process.env.CASHBACK_BUDGET_SERVICE_URL || 'http://cashback-budget-service:4002',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4004'
  };

  return { nodeEnv, port, pg, jwt, msg91, services, rateLimitWindowMs, rateLimitMax };
}

