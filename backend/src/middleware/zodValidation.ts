/**
 * Roneira AI HIFI - Zod Validation Middleware
 *
 * Provides request validation middleware using Zod schemas.
 * Validates request body, query parameters, and route parameters
 * before reaching route handlers.
 *
 * @module middleware/zodValidation
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import logger from '../utils/logger';

/**
 * Validation target types
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validation error response format
 */
interface ValidationErrorResponse {
  success: false;
  error: {
    type: 'VALIDATION_ERROR';
    message: string;
    details: {
      field: string;
      message: string;
      code: string;
    }[];
  };
}

/**
 * Format Zod errors into a consistent response structure
 */
function formatZodErrors(error: ZodError): ValidationErrorResponse {
  const details = error.errors.map((err) => ({
    field: err.path.join('.') || 'root',
    message: err.message,
    code: err.code,
  }));

  return {
    success: false,
    error: {
      type: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details,
    },
  };
}

/**
 * Create validation middleware for a specific Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param target - What part of the request to validate (body, query, params)
 * @returns Express middleware function
 *
 * @example
 * const createUserSchema = z.object({
 *   email: z.string().email(),
 *   name: z.string().min(2)
 * });
 *
 * router.post('/users', validate(createUserSchema, 'body'), createUser);
 */
export function validate<T extends ZodSchema>(schema: T, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const dataToValidate = req[target];

    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const errorResponse = formatZodErrors(result.error);

      logger.warn('Request validation failed', {
        path: req.path,
        method: req.method,
        target,
        errors: errorResponse.error.details,
      });

      res.status(400).json(errorResponse);
      return;
    }

    // Replace request data with validated and transformed data
    (req as Record<string, unknown>)[target] = result.data;
    next();
  };
}

/**
 * Validate multiple targets at once
 *
 * @param schemas - Object mapping targets to their schemas
 * @returns Express middleware function
 *
 * @example
 * router.get('/stocks/:ticker',
 *   validateAll({
 *     params: z.object({ ticker: z.string().regex(/^[A-Z]+$/) }),
 *     query: z.object({ days: z.coerce.number().optional() })
 *   }),
 *   getStockData
 * );
 */
export function validateAll(
  schemas: Partial<Record<ValidationTarget, ZodSchema>>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: { target: ValidationTarget; error: ZodError }[] = [];

    for (const [target, schema] of Object.entries(schemas) as [ValidationTarget, ZodSchema][]) {
      if (!schema) continue;

      const dataToValidate = req[target];
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        errors.push({ target, error: result.error });
      } else {
        (req as Record<string, unknown>)[target] = result.data;
      }
    }

    if (errors.length > 0) {
      const allDetails = errors.flatMap(({ target, error }) =>
        error.errors.map((err) => ({
          field: `${target}.${err.path.join('.')}` || target,
          message: err.message,
          code: err.code,
        }))
      );

      const errorResponse: ValidationErrorResponse = {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: allDetails,
        },
      };

      logger.warn('Request validation failed', {
        path: req.path,
        method: req.method,
        errors: allDetails,
      });

      res.status(400).json(errorResponse);
      return;
    }

    next();
  };
}

// =====================================================
// PREDEFINED SCHEMAS FOR COMMON API ENDPOINTS
// =====================================================

/**
 * Stock ticker validation schema
 */
export const TickerSchema = z
  .string()
  .min(1, 'Ticker symbol is required')
  .max(10, 'Ticker symbol too long')
  .regex(/^[A-Z0-9.^-]+$/i, 'Invalid ticker symbol format')
  .transform((val) => val.toUpperCase());

/**
 * Stock prediction request schema
 */
export const StockPredictionRequestSchema = z.object({
  ticker: TickerSchema,
  days: z.coerce.number().int().min(1).max(30).optional().default(7),
  include_pdm: z.boolean().optional().default(true),
});

/**
 * Batch prediction request schema
 */
export const BatchPredictionRequestSchema = z.object({
  tickers: z.array(TickerSchema).min(1).max(10),
  include_pdm: z.boolean().optional().default(true),
});

/**
 * PDM backtest request schema
 */
export const PDMBacktestRequestSchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
});

/**
 * Portfolio update request schema
 */
export const PortfolioUpdateSchema = z.object({
  holdings: z.array(
    z.object({
      ticker: TickerSchema,
      shares: z.number().positive('Shares must be positive'),
      avgCost: z.number().nonnegative('Average cost must be non-negative'),
      purchaseDate: z.string().optional(),
      notes: z.string().optional(),
    })
  ),
});

/**
 * Query parameter schema for stock ticker routes
 */
export const StockTickerParamsSchema = z.object({
  ticker: TickerSchema,
});

/**
 * Prediction query parameters schema
 */
export const PredictionQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional(),
  include_pdm: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type StockPredictionRequest = z.infer<typeof StockPredictionRequestSchema>;
export type BatchPredictionRequest = z.infer<typeof BatchPredictionRequestSchema>;
export type PDMBacktestRequest = z.infer<typeof PDMBacktestRequestSchema>;
export type PortfolioUpdate = z.infer<typeof PortfolioUpdateSchema>;
