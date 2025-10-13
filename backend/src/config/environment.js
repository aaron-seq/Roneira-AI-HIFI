import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

/**
 * Application configuration with environment variable validation
 * Uses human-readable variable names and provides sensible defaults
 */
const environmentConfiguration = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT, 10) || 3001,
    environment: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
  },

  // Machine Learning service configuration
  mlService: {
    url: process.env.ML_SERVICE_URL || 'http://localhost:5000',
    timeout: parseInt(process.env.ML_SERVICE_TIMEOUT, 10) || 30000,
    retryAttempts: parseInt(process.env.ML_SERVICE_RETRY_ATTEMPTS, 10) || 3,
    retryDelay: parseInt(process.env.ML_SERVICE_RETRY_DELAY, 10) || 1000,
  },

  // CORS configuration
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:5173', 'https://vercel.app'],
  },

  // Security configuration
  security: {
    rateLimitWindowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 10) || 15,
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    enableHelmet: process.env.ENABLE_HELMET !== 'false',
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
  },

  // Cache configuration
  cache: {
    defaultTtlSeconds: parseInt(process.env.CACHE_DEFAULT_TTL_SECONDS, 10) || 300,
    predictionTtlSeconds: parseInt(process.env.CACHE_PREDICTION_TTL_SECONDS, 10) || 180,
    stockDataTtlSeconds: parseInt(process.env.CACHE_STOCK_DATA_TTL_SECONDS, 10) || 600,
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
    logDirectory: process.env.LOG_DIRECTORY || './logs',
  },

  // API configuration
  api: {
    version: 'v1',
    enableSwagger: process.env.ENABLE_SWAGGER !== 'false',
    maxBatchPredictions: parseInt(process.env.MAX_BATCH_PREDICTIONS, 10) || 10,
    requestSizeLimit: process.env.REQUEST_SIZE_LIMIT || '10mb',
  },
};

/**
 * Validates required environment variables
 */
function validateEnvironmentConfiguration() {
  const requiredVariables = [];
  const missingVariables = requiredVariables.filter(variable => !process.env[variable]);
  
  if (missingVariables.length > 0) {
    logger.error(`Missing required environment variables: ${missingVariables.join(', ')}`);
    process.exit(1);
  }

  // Validate numeric configurations
  const numericValidations = [
    { key: 'server.port', value: environmentConfiguration.server.port, min: 1, max: 65535 },
    { key: 'mlService.timeout', value: environmentConfiguration.mlService.timeout, min: 1000, max: 120000 },
    { key: 'security.rateLimitMaxRequests', value: environmentConfiguration.security.rateLimitMaxRequests, min: 1, max: 10000 },
  ];

  numericValidations.forEach(({ key, value, min, max }) => {
    if (isNaN(value) || value < min || value > max) {
      logger.error(`Invalid configuration for ${key}: ${value}. Must be between ${min} and ${max}.`);
      process.exit(1);
    }
  });

  logger.info('Environment configuration validated successfully');
}

// Validate configuration on module load
validateEnvironmentConfiguration();

export { environmentConfiguration as config };