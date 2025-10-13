import express from 'express';
import { StatusCodes } from 'http-status-codes';
import axios from 'axios';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { createApiResponse } from '../utils/responseFormatter.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = express.Router();

/**
 * @route   GET /
 * @desc    Basic health check endpoint
 * @access  Public
 */
router.get('/', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Roneira Financial Intelligence Backend',
    version: '2.0.0',
    environment: config.server.environment,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100
    },
    nodeVersion: process.version
  };

  res.status(StatusCodes.OK).json(createApiResponse(healthStatus));
});

/**
 * @route   GET /detailed
 * @desc    Comprehensive health check including dependencies
 * @access  Public
 */
router.get('/detailed', asyncWrapper(async (req, res) => {
  const startTime = Date.now();
  
  const healthChecks = {
    backend: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: 0
    },
    mlService: {
      status: 'unknown',
      responseTime: null,
      url: config.mlService.url
    }
  };

  // Check ML Service health
  try {
    const mlServiceStartTime = Date.now();
    const mlServiceResponse = await axios.get(`${config.mlService.url}/health`, {
      timeout: 5000
    });
    
    healthChecks.mlService = {
      status: 'healthy',
      responseTime: Date.now() - mlServiceStartTime,
      url: config.mlService.url,
      version: mlServiceResponse.data?.version || 'unknown'
    };
  } catch (error) {
    healthChecks.mlService = {
      status: 'unhealthy',
      responseTime: null,
      url: config.mlService.url,
      error: error.message,
      errorCode: error.code || 'UNKNOWN'
    };
  }

  // Overall system health
  const overallStatus = Object.values(healthChecks).every(check => check.status === 'healthy') 
    ? 'healthy' 
    : 'degraded';

  healthChecks.backend.responseTime = Date.now() - startTime;

  const detailedHealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: 'Roneira Financial Intelligence Backend',
    version: '2.0.0',
    environment: config.server.environment,
    uptime: process.uptime(),
    system: {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100,
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    dependencies: healthChecks
  };

  const statusCode = overallStatus === 'healthy' ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
  
  if (overallStatus !== 'healthy') {
    logger.warn('System health check returned degraded status', { healthChecks });
  }

  res.status(statusCode).json(createApiResponse(detailedHealthStatus));
}));

/**
 * @route   GET /readiness
 * @desc    Kubernetes readiness probe endpoint
 * @access  Public
 */
router.get('/readiness', asyncWrapper(async (req, res) => {
  try {
    // Check if ML service is reachable
    await axios.get(`${config.mlService.url}/health`, { timeout: 3000 });
    
    res.status(StatusCodes.OK).json(
      createApiResponse({
        status: 'ready',
        timestamp: new Date().toISOString(),
        message: 'Service is ready to accept traffic'
      })
    );
  } catch (error) {
    logger.error('Readiness check failed', error);
    
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json(
      createApiResponse(null, false, 'Service not ready', {
        reason: 'ML service unavailable',
        timestamp: new Date().toISOString()
      })
    );
  }
}));

/**
 * @route   GET /liveness
 * @desc    Kubernetes liveness probe endpoint
 * @access  Public
 */
router.get('/liveness', (req, res) => {
  res.status(StatusCodes.OK).json(
    createApiResponse({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  );
});

export default router;