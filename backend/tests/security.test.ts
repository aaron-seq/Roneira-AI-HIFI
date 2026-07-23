import request from 'supertest';
import axios from 'axios';
import Server from '../src/server';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Regression test for information-disclosure fix: the ML service proxy
 * handlers must never forward raw upstream error payloads (stack traces,
 * internal hostnames, credentials) back to the client.
 */
describe('ML service error handling does not disclose internal details', () => {
  const server = new Server();
  const app = server.get_application();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('does not leak upstream error payloads from /api/predict', async () => {
    const sensitiveData = {
      error: 'Database connection failed',
      stack: 'Error: Database connection failed\n    at PredictionService (/app/ml/service.py:123)',
      internal_config: { db_url: 'postgres://user:password@internal-db:5432/ml' },
    };

    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: sensitiveData },
    });

    const response = await request(app).post('/api/predict').send({ ticker: 'AAPL' });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('Database connection failed');
    expect(JSON.stringify(response.body)).not.toContain('postgres://');
    expect(JSON.stringify(response.body)).not.toContain('internal_config');
  });

  it('does not leak upstream error payloads from /api/batch_predict', async () => {
    const sensitiveData = {
      error: 'Batch processing failed for node worker-7',
      debug_info: { worker_id: 'worker-7', internal_ip: '10.0.0.45' },
    };

    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 502, data: sensitiveData },
    });

    const response = await request(app)
      .post('/api/batch_predict')
      .send({ tickers: ['AAPL', 'MSFT'] });

    expect(response.status).toBe(502);
    expect(JSON.stringify(response.body)).not.toContain('worker-7');
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.45');
  });

  it('returns 503 (not a hang) when the ML service is unreachable', async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      code: 'ECONNREFUSED',
    });

    const response = await request(app).post('/api/predict').send({ ticker: 'AAPL' });

    expect(response.status).toBe(503);
  });
});
