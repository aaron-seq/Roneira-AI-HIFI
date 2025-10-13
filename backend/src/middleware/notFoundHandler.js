import { StatusCodes } from 'http-status-codes';
import { logger } from '../utils/logger.js';
import { createErrorResponse } from '../utils/responseFormatter.js';

/**
 * 404 Not Found middleware
 * Handles requests to non-existent endpoints
 */
export function notFoundHandler(request, response, next) {
  const requestInfo = {
    method: request.method,
    url: request.url,
    userAgent: request.get('User-Agent') || 'Unknown',
    ip: request.ip,
    timestamp: new Date().toISOString()
  };

  logger.warn('404 - Endpoint not found', requestInfo);

  const availableEndpoints = {
    health: {
      basic: 'GET /health',
      detailed: 'GET /health/detailed',
      readiness: 'GET /health/readiness',
      liveness: 'GET /health/liveness'
    },
    api: {
      info: 'GET /api/v1',
      predict: 'POST /api/v1/predict',
      batchPredict: 'POST /api/v1/batch-predict',
      stockInfo: 'GET /api/v1/stock/:ticker'
    },
    documentation: 'GET /api-docs'
  };

  const helpfulMessage = getHelpfulMessage(request.url, request.method);

  response.status(StatusCodes.NOT_FOUND).json(
    createErrorResponse(
      `Endpoint not found: ${request.method} ${request.url}`,
      {
        suggestion: helpfulMessage,
        availableEndpoints,
        documentation: '/api-docs',
        requestedUrl: request.url,
        requestedMethod: request.method
      }
    )
  );
}

/**
 * Provide helpful suggestions based on the requested URL
 */
function getHelpfulMessage(requestedUrl, method) {
  const url = requestedUrl.toLowerCase();
  
  // Common mistyped endpoints
  if (url.includes('predict') && method === 'GET') {
    return 'The prediction endpoint requires POST method. Try: POST /api/v1/predict';
  }
  
  if (url.includes('health') && !url.startsWith('/health')) {
    return 'Health check endpoints are available at /health';
  }
  
  if (url.includes('api') && !url.includes('/api/')) {
    return 'API endpoints are available under /api/v1/';
  }
  
  if (url.includes('doc') || url.includes('swagger')) {
    return 'API documentation is available at /api-docs';
  }
  
  if (url === '/' || url === '') {
    return 'Try /health for health check or /api/v1 for API information';
  }
  
  // General suggestion
  return 'Check the available endpoints list or visit /api-docs for complete documentation';
}