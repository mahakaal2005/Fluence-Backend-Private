import { StatusCodes, getReasonPhrase } from 'http-status-codes';

export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message || getReasonPhrase(statusCode));
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFoundHandler(_req, res) {
  res.status(StatusCodes.NOT_FOUND).json({ error: 'Not Found' });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }
  
  // Handle database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    console.error('Database connection error:', err.message);
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ 
      error: 'Database service unavailable',
      message: 'Unable to connect to database. Please try again later.'
    });
    return;
  }
  
  // Handle database unique constraint violations
  if (err.code === '23505') {
    const constraint = err.constraint || '';
    let errorMessage = 'Duplicate entry';
    
    if (constraint.includes('phone')) {
      errorMessage = 'Phone number already exists';
    } else if (constraint.includes('email')) {
      errorMessage = 'Email already exists';
    } else if (err.detail?.includes('phone')) {
      errorMessage = 'Phone number already taken';
    } else if (err.detail?.includes('email')) {
      errorMessage = 'Email already taken';
    }
    
    res.status(StatusCodes.CONFLICT).json({ 
      error: errorMessage
    });
    return;
  }
  
  // Handle query timeout errors
  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    console.error('Database query timeout:', err.message);
    res.status(StatusCodes.REQUEST_TIMEOUT).json({ 
      error: 'Request timeout',
      message: 'The request took too long to process. Please try again.'
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
  
  // Ensure response hasn't been sent
  if (!res.headersSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message 
    });
  }
}

