import { StatusCodes } from 'http-status-codes';
import { ApiError } from './error.js';

/**
 * Verify JWT token from auth service
 */
export function verifyAuthToken() {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authorization token required');
      }

      // In a real implementation, you would verify the JWT token
      // For now, we'll extract user info from the token (this is a simplified approach)
      // In production, you should verify the token signature and expiration

      try {
        // This is a simplified approach - in production, use proper JWT verification
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

        if (!payload.sub || !payload.email) {
          throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token payload');
        }

        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role || 'user'
        };

        next();
      } catch (jwtError) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token format');
      }
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Require admin role
 */
export function requireAdmin() {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required'));
    }

    if (req.user.role !== 'admin') {
      return next(new ApiError(StatusCodes.FORBIDDEN, 'Admin access required'));
    }

    next();
  };
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export function optionalAuth() {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (token) {
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

          if (payload.sub && payload.email) {
            req.user = {
              id: payload.sub,
              email: payload.email,
              role: payload.role || 'user'
            };
          }
        } catch (jwtError) {
          // Ignore invalid tokens in optional auth
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Verify service-to-service authentication using API key
 * This allows internal microservices to call the notification service
 */
export function verifyServiceAuth() {
  return async (req, res, next) => {
    try {
      const serviceApiKey = req.headers['x-service-api-key'] || req.headers['x-service-key'];
      const expectedKey = process.env.SERVICE_API_KEY || 'internal-service-key';

      if (!serviceApiKey || serviceApiKey !== expectedKey) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Service authentication required');
      }

      // Mark as service request
      req.isServiceRequest = true;
      next();
    } catch (err) {
      next(err);
    }
  };
}