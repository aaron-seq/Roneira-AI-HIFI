/**
 * Roneira AI HIFI - Backend Authentication Service
 *
 * The frontend authenticates users directly against Supabase Auth. Rather than
 * running a second, parallel credential store, the backend simply *verifies*
 * the Supabase-issued JWT that the client already holds. This keeps a single
 * user model: the token's `sub` claim is the Supabase `auth.users` id, which is
 * exactly the value `public.users.id` / `public.portfolio_holdings.user_id`
 * reference - so an authenticated request maps straight onto the row-level
 * ownership checks and the portfolio FK.
 *
 * @module services/authService
 */
import jwt from 'jsonwebtoken';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Decoded identity extracted from a verified Supabase access token.
 * - `sub` is the Supabase user UUID (== public.users.id).
 * - `role` is the application role (admin/user), read from Supabase custom
 *   claims (app_metadata.role / user_metadata.role); it is NOT the built-in
 *   Postgres `role` claim (which is always `authenticated` for logged-in users).
 */
export interface AuthTokenPayload {
  sub: string;
  email?: string;
  role: string;
}

interface SupabaseJwtClaims {
  sub?: string;
  email?: string;
  app_metadata?: { role?: string };
  user_metadata?: { role?: string };
}

function getSupabaseJwtSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    // Missing configuration is a server problem, not a client auth failure.
    throw new AuthError('Authentication is not configured on this server', 503);
  }
  return secret;
}

/**
 * Verify a Supabase-issued access token (HS256, signed with the project's
 * JWT secret) and extract the caller's identity.
 *
 * @throws {AuthError} 401 if the token is missing/invalid/expired, 503 if the
 *   server is not configured with SUPABASE_JWT_SECRET.
 */
export function verifyToken(token: string): AuthTokenPayload {
  let claims: SupabaseJwtClaims;
  try {
    claims = jwt.verify(token, getSupabaseJwtSecret(), { algorithms: ['HS256'] }) as SupabaseJwtClaims;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      error instanceof Error && error.name === 'TokenExpiredError'
        ? 'Token has expired'
        : 'Invalid authentication token',
      401
    );
  }

  if (!claims.sub) {
    throw new AuthError('Token is missing a subject claim', 401);
  }

  const role = claims.app_metadata?.role || claims.user_metadata?.role || 'user';

  return { sub: claims.sub, email: claims.email, role };
}
