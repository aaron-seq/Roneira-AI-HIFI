const request = require('supertest');
const Server = require('../src/server');

const server = new Server();
const app = server.get_application();

describe('Health Check', () => {
  it('should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
