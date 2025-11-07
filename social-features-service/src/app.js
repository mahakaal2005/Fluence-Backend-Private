import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { getConfig } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

// Import routes
import socialRoutes from './routes/social.routes.js';
import adminSocialRoutes from './routes/admin-social.routes.js';
// import platformRoutes from './routes/platform.routes.js';
// import campaignRoutes from './routes/campaign.routes.js';

const app = express();
const config = getConfig();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, OAuth redirects, etc.)
    if (!origin) return callback(null, true);

    // Allow any localhost origin (for development)
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // Allow Instagram OAuth redirects (www.instagram.com, api.instagram.com)
    if (origin.includes('instagram.com') || origin.includes('facebook.com')) {
      return callback(null, true);
    }

    // Allow Cloudflare tunnel origins (for development)
    if (origin.includes('trycloudflare.com') || origin.includes('cfargotunnel.com')) {
      return callback(null, true);
    }

    // Allow configured frontend URL
    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl && origin.startsWith(frontendUrl)) {
      return callback(null, true);
    }

    // Block other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression
app.use(compression());

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'social-features-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/social', socialRoutes);
app.use('/api/admin/social', adminSocialRoutes);
// app.use('/api/platforms', platformRoutes);
// app.use('/api/campaigns', campaignRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'social-features-service',
    message: 'Social Features Service API',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      health: '/health',
      social: '/api/social',
      adminSocial: '/api/admin/social',
      platforms: '/api/platforms',
      campaigns: '/api/campaigns'
    }
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
