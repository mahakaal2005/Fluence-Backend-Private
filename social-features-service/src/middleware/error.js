import { StatusCodes, getReasonPhrase } from 'http-status-codes';

export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message || getReasonPhrase(statusCode));
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFoundHandler(req, res) {
  // Log the request for debugging
  console.log('Route not found:', req.method, req.path, req.originalUrl);
  res.status(StatusCodes.NOT_FOUND).json({ 
    success: false,
    error: 'Route not found',
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl
  });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ 
      success: false,
      error: err.message, 
      details: err.details 
    });
    return;
  }
  
  // Log full error in development, sanitized in production
  if (process.env.NODE_ENV === 'production') {
    console.error('Unhandled error:', err.message);
    // In production, you'd send to logging service (e.g., Sentry, CloudWatch)
  } else {
    console.error('Unhandled error:', err);
  }
  
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message 
  });
}
