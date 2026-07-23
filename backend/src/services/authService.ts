/**
 * Roneira AI HIFI - Backend API Authentication Service
 *
 * Real JWT-based authentication backed by bcrypt-hashed credentials
 * (public.api_credentials), replacing the previous stub endpoints that
 * returned success without validating anything.
 *
 * @module services/authService
 */
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import database from './databaseService';
import logger from '../utils/logger';

const BCRYPT_SALT_ROUNDS = 12;
const TOKEN_EXPIRY: SignOptions['expiresIn'] = '1h';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthTokenPayload {
  sub: string; // credential id
  username: string;
  role: string;
}

export interface AuthResult {
  token: string;
  expiresIn: string;
  user: { id: string; username: string; role: string };
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AuthError('Authentication is not configured on this server', 503);
  }
  return secret;
}

function validateCredentialsShape(username: string, password: string): void {
  if (!username || !USERNAME_PATTERN.test(username)) {
    throw new AuthError(
      'Username must be 3-32 characters (letters, numbers, underscore, dot, hyphen)',
      400
    );
  }
  if (!password || password.length < 8) {
    throw new AuthError('Password must be at least 8 characters', 400);
  }
}

export async function register(username: string, password: string): Promise<AuthResult> {
  validateCredentialsShape(username, password);

  if (!database.isAvailable()) {
    throw new AuthError('Authentication service is temporarily unavailable', 503);
  }

  const existing = await database.getCredentialByUsername(username);
  if (existing) {
    throw new AuthError('Username is already taken', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const credential = await database.createCredential(username, passwordHash, 'user');

  logger.info(`New API credential registered: ${credential.username}`);

  return issueToken(credential.id, credential.username, credential.role);
}

export async function login(username: string, password: string): Promise<AuthResult> {
  if (!username || !password) {
    throw new AuthError('Username and password are required', 400);
  }

  if (!database.isAvailable()) {
    throw new AuthError('Authentication service is temporarily unavailable', 503);
  }

  const credential = await database.getCredentialByUsername(username);
  if (!credential) {
    // Constant-shape response: don't reveal whether the username exists.
    await bcrypt.compare(password, '$2a$12$invalidsaltinvalidsaltinvalidsal.');
    throw new AuthError('Invalid username or password', 401);
  }

  if (credential.lockedUntil && new Date(credential.lockedUntil) > new Date()) {
    throw new AuthError('Account temporarily locked due to repeated failed logins', 423);
  }

  const passwordMatches = await bcrypt.compare(password, credential.passwordHash);
  if (!passwordMatches) {
    await database.recordFailedLogin(username, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES);
    logger.warn(`Failed login attempt for username: ${username}`);
    throw new AuthError('Invalid username or password', 401);
  }

  await database.resetFailedLogins(username);
  logger.info(`Successful login: ${credential.username}`);

  return issueToken(credential.id, credential.username, credential.role);
}

function issueToken(id: string, username: string, role: string): AuthResult {
  const payload: AuthTokenPayload = { sub: id, username, role };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });

  return {
    token,
    expiresIn: TOKEN_EXPIRY as string,
    user: { id, username, role },
  };
}

export function verifyToken(token: string): AuthTokenPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
  } catch (error) {
    throw new AuthError(
      error instanceof Error && error.name === 'TokenExpiredError'
        ? 'Token has expired'
        : 'Invalid authentication token',
      401
    );
  }
}
