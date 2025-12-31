/**
 * Roneira AI HIFI - Environment Configuration Guard
 *
 * This module validates all required environment variables at application startup.
 * If any required variable is missing, the application will fail immediately with
 * a clear error message, preventing runtime failures.
 *
 * @module config/environment
 */

import { z } from 'zod';
import logger from '../utils/logger';

/**
 * Environment variables schema with validation rules
 */
const EnvironmentSchema = z.object({
  // Server Configuration
  PORT: z
    .string()
    .default('3001')
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database Configuration
  DATABASE_URL: z
    .string()
    .url()
    .optional()
    .describe('PostgreSQL/TimescaleDB connection URL'),

  // Redis Configuration
  REDIS_URL: z
    .string()
    .url()
    .optional()
    .describe('Redis cache connection URL'),

  // External Service URLs
  ML_SERVICE_URL: z
    .string()
    .url()
    .default('http://localhost:5000')
    .describe('ML Service base URL'),

  // External API Keys
  ALPHA_VANTAGE_API_KEY: z
    .string()
    .min(1, 'ALPHA_VANTAGE_API_KEY is required for stock data')
    .default('demo'),

  // CORS Configuration
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default('900000')
    .transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .default('100')
    .transform((val) => parseInt(val, 10)),
});

/**
 * Validated environment configuration type
 */
export type EnvironmentConfig = z.infer<typeof EnvironmentSchema>;

/**
 * Parse and validate environment variables
 * @throws {Error} If validation fails with detailed error messages
 */
function validateEnvironment(): EnvironmentConfig {
  const result = EnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    const errorMessage = `
╔════════════════════════════════════════════════════════════════════╗
║           ENVIRONMENT CONFIGURATION ERROR                         ║
╠════════════════════════════════════════════════════════════════════╣
║ The following environment variables are missing or invalid:       ║
╚════════════════════════════════════════════════════════════════════╝

${errorMessages}

Please ensure all required environment variables are set in your .env file
or system environment before starting the application.

See: backend/.env.example for reference
`;

    logger.error(errorMessage);
    throw new Error('Environment validation failed. See logs for details.');
  }

  return result.data;
}

/**
 * Validated environment configuration
 * This will throw immediately on import if validation fails
 */
export const env = validateEnvironment();

/**
 * Check if running in production mode
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Check if running in test mode
 */
export const isTest = env.NODE_ENV === 'test';

/**
 * Check if running in development mode
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Log current environment configuration (sanitized)
 */
export function logEnvironmentConfig(): void {
  const sanitized = {
    PORT: env.PORT,
    NODE_ENV: env.NODE_ENV,
    DATABASE_URL: env.DATABASE_URL ? '****configured****' : 'not set',
    REDIS_URL: env.REDIS_URL ? '****configured****' : 'not set',
    ML_SERVICE_URL: env.ML_SERVICE_URL,
    ALPHA_VANTAGE_API_KEY: env.ALPHA_VANTAGE_API_KEY === 'demo' ? 'demo' : '****configured****',
    CORS_ORIGIN: env.CORS_ORIGIN,
    RATE_LIMIT_WINDOW_MS: env.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS: env.RATE_LIMIT_MAX_REQUESTS,
  };

  logger.info('Environment configuration loaded:', sanitized);
}

export default env;
