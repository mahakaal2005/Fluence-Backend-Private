import { StatusCodes } from 'http-status-codes';
import { ApiError } from './error.js';

/**
 * Verify JWT token from auth service
 */
export function verifyAuthToken() {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || '';
      let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      
      if (!token) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authorization token required');
      }

      // Trim whitespace from token (common issue)
      token = token.trim();

      // In a real implementation, you would verify the JWT token
      // For now, we'll extract user info from the token (this is a simplified approach)
      // In production, you should verify the token signature and expiration
      
      try {
        // Validate JWT format (should have 3 parts separated by dots)
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.error('❌ [AUTH] Invalid JWT format - expected 3 parts, got:', parts.length);
          throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token format - JWT must have 3 parts');
        }

        // Decode payload (handle URL-safe base64)
        let payloadPart = parts[1];
        // Add padding if needed for base64
        while (payloadPart.length % 4) {
          payloadPart += '=';
        }
        
        // Convert URL-safe base64 to standard base64 if needed
        payloadPart = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        
        const payload = JSON.parse(Buffer.from(payloadPart, 'base64').toString());
        
        // Debug logging
        console.log('📝 [AUTH] Token payload decoded:', { 
          sub: payload.sub, 
          email: payload.email, 
          role: payload.role,
          exp: payload.exp,
          iat: payload.iat
        });
        
        if (!payload.sub || !payload.email) {
          console.error('❌ [AUTH] Invalid payload - missing sub or email:', payload);
          throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token payload - missing required fields');
        }

        // Check token expiration
        if (payload.exp && payload.exp < Date.now() / 1000) {
          console.error('❌ [AUTH] Token expired. Exp:', new Date(payload.exp * 1000), 'Now:', new Date());
          throw new ApiError(StatusCodes.UNAUTHORIZED, 'Token expired');
        }

        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role || 'user'
        };

        console.log('✅ [AUTH] User authenticated:', { id: req.user.id, email: req.user.email, role: req.user.role });
        next();
      } catch (jwtError) {
        console.error('❌ [AUTH] JWT parse error:', jwtError.message);
        console.error('   Token preview:', token.substring(0, 50) + '...');
        if (jwtError instanceof ApiError) {
          throw jwtError;
        }
        throw new ApiError(StatusCodes.UNAUTHORIZED, `Invalid token format: ${jwtError.message}`);
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
      let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      
      if (token) {
        try {
          token = token.trim();
          const parts = token.split('.');
          if (parts.length === 3) {
            let payloadPart = parts[1];
            // Add padding if needed
            while (payloadPart.length % 4) {
              payloadPart += '=';
            }
            // Convert URL-safe base64 to standard base64
            payloadPart = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
            
            const payload = JSON.parse(Buffer.from(payloadPart, 'base64').toString());
            
            // Check expiration
            if (payload.exp && payload.exp >= Date.now() / 1000 && payload.sub && payload.email) {
              req.user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role || 'user'
              };
            }
          }
        } catch (jwtError) {
          // Ignore invalid tokens in optional auth
          console.log('⚠️ [AUTH] Optional auth token parse failed (ignored):', jwtError.message);
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
