import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.NOTIFICATION_PORT || 4004);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100);

  // Database configuration
  const db = {
    host: process.env.NOTIFICATION_DB_HOST || '161.248.37.208',
    port: Number(process.env.NOTIFICATION_DB_PORT || 5432),
    database: process.env.NOTIFICATION_DB_NAME || 'postgres',
    user: process.env.NOTIFICATION_DB_USER || 'bp-user',
    password: process.env.NOTIFICATION_DB_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
    ssl: process.env.NOTIFICATION_DB_SSL === 'true',
    uri: process.env.NOTIFICATION_DB_URI
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
    from: process.env.SMTP_FROM || 'noreply@fluencepay.com',
    replyTo: process.env.SMTP_REPLY_TO || 'support@fluencepay.com'
  };

  // SMS configuration (Twilio)
  const sms = {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    enabled: process.env.SMS_ENABLED === 'true'
  };

  // Push notification configuration
  const push = {
    firebaseServerKey: process.env.FIREBASE_SERVER_KEY || '',
    enabled: process.env.PUSH_ENABLED === 'true'
  };

  // Service URLs
  const services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:4001',
    merchant: process.env.MERCHANT_SERVICE_URL || 'http://merchant-onboarding-service:4003',
    cashback: process.env.CASHBACK_SERVICE_URL || 'http://cashback-budget-service:4002'
  };

  // Notification settings
  const notification = {
    maxRetries: Number(process.env.NOTIFICATION_MAX_RETRIES || '3'),
    retryDelay: Number(process.env.NOTIFICATION_RETRY_DELAY || '300000'), // 5 minutes
    batchSize: Number(process.env.NOTIFICATION_BATCH_SIZE || '100'),
    processingInterval: Number(process.env.NOTIFICATION_PROCESSING_INTERVAL || '60000'), // 1 minute
    defaultTemplateLanguage: process.env.DEFAULT_TEMPLATE_LANGUAGE || 'en'
  };

  // Rate limiting for different notification types
  const rateLimits = {
    email: {
      windowMs: Number(process.env.EMAIL_RATE_LIMIT_WINDOW || '3600000'), // 1 hour
      max: Number(process.env.EMAIL_RATE_LIMIT_MAX || '100')
    },
    sms: {
      windowMs: Number(process.env.SMS_RATE_LIMIT_WINDOW || '3600000'), // 1 hour
      max: Number(process.env.SMS_RATE_LIMIT_MAX || '50')
    },
    push: {
      windowMs: Number(process.env.PUSH_RATE_LIMIT_WINDOW || '3600000'), // 1 hour
      max: Number(process.env.PUSH_RATE_LIMIT_MAX || '1000')
    }
  };

  return { 
    nodeEnv, 
    port, 
    db, 
    jwt, 
    email, 
    sms,
    push,
    services, 
    notification,
    rateLimits,
    rateLimitWindowMs, 
    rateLimitMax 
  };
}
