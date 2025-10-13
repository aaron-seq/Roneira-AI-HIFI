import { StatusCodes } from 'http-status-codes';
import { logger } from '../utils/logger.js';
import { createErrorResponse } from '../utils/responseFormatter.js';
import { config } from '../config/environment.js';

/**
 * Global error handling middleware
 * Catches all unhandled errors and returns consistent error responses
 */
export function errorHandler(error, request, response, next) {
  // Log the error with context
  logger.error('Unhandled error occurred', error, {
    method: request.method,
    url: request.url,
    userAgent: request.get('User-Agent'),
    ip: request.ip,
    body: request.body,
    params: request.params,
    query: request.query
  });

  // Default error response
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'An internal server error occurred';
  let errorDetails = {};

  // Handle specific error types
  if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation failed';
    errorDetails.validationErrors = error.details || error.message;
  } else if (error.name === 'CastError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Invalid data format';
    errorDetails.field = error.path;
    errorDetails.value = error.value;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Unauthorized access';
  } else if (error.name === 'ForbiddenError') {
    statusCode = StatusCodes.FORBIDDEN;
    message = 'Access forbidden';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = StatusCodes.SERVICE_UNAVAILABLE;
    message = 'External service temporarily unavailable';
  } else if (error.code === 'ETIMEDOUT') {
    statusCode = StatusCodes.GATEWAY_TIMEOUT;
    message = 'Request timeout - please try again';
  } else if (error.type === 'entity.parse.failed') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Invalid JSON in request body';
  } else if (error.type === 'entity.too.large') {
    statusCode = StatusCodes.REQUEST_TOO_LONG;
    message = 'Request payload too large';
  }

  // Add error tracking ID for debugging
  const errorTrackingId = generateErrorTrackingId();
  errorDetails.trackingId = errorTrackingId;
  errorDetails.timestamp = new Date().toISOString();

  // Include stack trace in development mode only
  if (config.server.isDevelopment && error.stack) {
    errorDetails.stack = error.stack;
  }

  // Add retry information for temporary errors
  if (statusCode >= 500 && statusCode < 600) {
    errorDetails.retryAfter = '30 seconds';
    errorDetails.temporary = true;
  }

  // Send error response
  response.status(statusCode).json(
    createErrorResponse(message, errorDetails)
  );

  // Log error with tracking ID for correlation
  logger.error(`Error handled with tracking ID: ${errorTrackingId}`, {
    statusCode,
    message,
    originalError: error.message,
    trackingId: errorTrackingId
  });
}

/**
 * Generate a unique error tracking ID
 * @returns {string} Unique tracking ID
 */
function generateErrorTrackingId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${randomPart}`;
}