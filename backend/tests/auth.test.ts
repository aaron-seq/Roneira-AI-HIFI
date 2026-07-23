import request from 'supertest';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = 'test-supabase-jwt-secret-value-1234567890';

// The secret must be present before the auth service reads it. verifyToken
// reads process.env at call time, so setting it here is sufficient.
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET;

// eslint-disable-next-line @typescript-eslint/no-var-requires
import Server from '../src/server';

const server = new Server();
const app = server.get_application();

const USER_ID = '11111111-1111-4111-8111-111111111111';

function signSupabaseToken(sub: string, role?: string): string {
  const payload: Record<string, unknown> = { sub, email: 'user@example.com' };
  if (role) payload.app_metadata = { role };
  return jwt.sign(payload, TEST_JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

describe('Portfolio route auth (Supabase JWT verification)', () => {
  it('rejects a request with no Authorization header (401)', async () => {
    const res = await request(app).get(`/api/portfolio/${USER_ID}`);
    expect(res.status).toBe(401);
  });

  it('rejects an invalid/garbage token (401)', async () => {
    const res = await request(app)
      .get(`/api/portfolio/${USER_ID}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects a token whose subject does not match the :user_id (403)', async () => {
    const token = signSupabaseToken('22222222-2222-4222-8222-222222222222');
    const res = await request(app)
      .get(`/api/portfolio/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('accepts a valid token whose subject matches the :user_id', async () => {
    const token = signSupabaseToken(USER_ID);
    const res = await request(app)
      .get(`/api/portfolio/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    // No DATABASE_URL in tests -> in-memory fallback, still authorized.
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows an admin token to read another user\'s portfolio', async () => {
    const token = signSupabaseToken('33333333-3333-4333-8333-333333333333', 'admin');
    const res = await request(app)
      .get(`/api/portfolio/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
