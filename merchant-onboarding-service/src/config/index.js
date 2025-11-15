import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.MERCHANT_ONBOARDING_PORT || 4003);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100);

  // Database configuration
  const db = {
    host: process.env.MERCHANT_DB_HOST || '161.248.37.208',
    port: Number(process.env.MERCHANT_DB_PORT || 5432),
    database: process.env.MERCHANT_DB_NAME || 'postgres',
    user: process.env.MERCHANT_DB_USER || 'bp-user',
    password: process.env.MERCHANT_DB_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
    ssl: process.env.MERCHANT_DB_SSL === 'true',
    uri: process.env.MERCHANT_DB_URI
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
    auth: process.env.AUTH_SERVICE_URL || 'http://161.248.37.235:4001',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://161.248.37.235:4004',
    cashback: process.env.CASHBACK_SERVICE_URL || 'http://161.248.37.235:4003'
  };

  // Application settings
  const app = {
    adminApprovalSLA: Number(process.env.ADMIN_APPROVAL_SLA_HOURS || 48), // 48 hours SLA
    maxApplicationsPerUser: Number(process.env.MAX_APPLICATIONS_PER_USER || 3),
    supportedBusinessTypes: [
      // Updated to match Flutter app categories
      '🎨 Fashion & Beauty',
      '🍔 Food & Beverage',
      '🛒 Retail & Shopping',
      '💻 Electronics & Tech',
      '🏥 Health & Wellness',
      '🏠 Home & Lifestyle',
      '📚 Education & Books',
      '🎮 Entertainment & Gaming',
      '🚗 Automotive',
      '✈️ Travel & Tourism',
      '💪 Fitness & Sports',
      '🐾 Pets & Animals',
      '🔧 Services & Repair',
      '📱 Telecom & Mobile',
      '💎 Jewelry & Accessories',
      '🎭 Arts & Crafts',
      '🏗️ Construction & Hardware',
      '📦 Wholesale & Distribution',
      '🌱 Organic & Natural',
      '🎉 Events & Celebrations',
      // Keep legacy values for backward compatibility
      'retail', 'restaurant', 'service', 'ecommerce', 'other'
    ]
  };

  return {
    nodeEnv,
    port,
    db,
    jwt,
    email,
    services,
    app,
    rateLimitWindowMs,
    rateLimitMax
  };
}
