/**
 * Roneira AI HIFI - Auth Middleware
 *
 * Verifies the `Authorization: Bearer <token>` header on protected routes
 * and attaches the decoded identity to `req.auth`. Replaces unauthenticated
 * access to sensitive endpoints (e.g. portfolio management).
 *
 * @module middleware/authMiddleware
 */
import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthError, AuthTokenPayload } from '../services/authService';
import { sendError } from '../utils/response';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(response, 'Authentication required', 401);
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    request.auth = verifyToken(token);
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      sendError(response, error.message, error.statusCode);
    } else {
      sendError(response, 'Authentication failed', 401);
    }
  }
}

/**
 * Ensures the authenticated user matches the `:user_id` route param, or is
 * an admin. Must run after `requireAuth`.
 */
export function requireSelfOrAdmin(request: Request, response: Response, next: NextFunction): void {
  const routeUserId = request.params.user_id;

  if (!request.auth) {
    sendError(response, 'Authentication required', 401);
    return;
  }

  if (request.auth.role !== 'admin' && request.auth.sub !== routeUserId) {
    sendError(response, 'You do not have access to this resource', 403);
    return;
  }

  next();
}

/**
 * Restricts a route to admin-role tokens. Must run after `requireAuth`.
 */
export function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  if (!request.auth) {
    sendError(response, 'Authentication required', 401);
    return;
  }

  if (request.auth.role !== 'admin') {
    sendError(response, 'Admin access required', 403);
    return;
  }

  next();
}
