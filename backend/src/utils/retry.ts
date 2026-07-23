/**
 * Exponential-backoff retry helper for flaky upstream calls (ML service,
 * external market data APIs). Only retries errors that look transient -
 * network failures and 5xx responses - never 4xx client errors.
 */
import logger from './logger';

export interface RetryOptions {
  /** Max attempts including the first try (default 4 -> 3 retries) */
  attempts?: number;
  /** Base delay in ms; actual delay is base * 2^(attempt-1) (default 100ms) */
  baseDelayMs?: number;
  /** Name used for logging */
  name?: string;
  /** Override to decide whether a given error should trigger a retry */
  shouldRetry?: (error: unknown) => boolean;
}

interface AxiosLikeError {
  code?: string;
  response?: { status?: number };
}

function isAxiosLikeError(error: unknown): error is AxiosLikeError {
  return typeof error === 'object' && error !== null;
}

export function defaultShouldRetry(error: unknown): boolean {
  if (!isAxiosLikeError(error)) return false;

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    return true;
  }

  const status = error.response?.status;
  return typeof status === 'number' && status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn` with exponential backoff retries (100ms, 200ms, 400ms, ... by default).
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const name = options.name ?? 'operation';
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === attempts;
      if (isLastAttempt || !shouldRetry(error)) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(
        `${name} failed (attempt ${attempt}/${attempts}), retrying in ${delay}ms: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
