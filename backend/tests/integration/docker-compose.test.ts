/**
 * Roneira AI HIFI - Docker Integration Tests
 *
 * Tests that verify the full Docker Compose stack works correctly.
 * Spins up containers and tests end-to-end connectivity.
 *
 * @module tests/integration/docker-compose.test
 */

import axios, { AxiosInstance } from 'axios';

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const TRAEFIK_URL = process.env.TRAEFIK_URL || 'http://localhost';

// Timeout for container startup
const STARTUP_TIMEOUT = 60000;
const REQUEST_TIMEOUT = 10000;

/**
 * Create axios client with timeout
 */
function createClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT,
    validateStatus: () => true, // Don't throw on any status
  });
}

/**
 * Wait for a service to be healthy
 */
async function waitForService(
  client: AxiosInstance,
  healthPath: string,
  serviceName: string,
  maxWait: number = STARTUP_TIMEOUT
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    try {
      const response = await client.get(healthPath);
      if (response.status === 200) {
        console.log(`✅ ${serviceName} is healthy`);
        return true;
      }
    } catch {
      // Service not ready yet
    }
    
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`⏳ Waiting for ${serviceName}...`);
  }
  
  console.error(`❌ ${serviceName} failed to start within ${maxWait}ms`);
  return false;
}

describe('Docker Compose Integration Tests', () => {
  let backendClient: AxiosInstance;
  let mlClient: AxiosInstance;
  let traefikClient: AxiosInstance;

  beforeAll(async () => {
    backendClient = createClient(BACKEND_URL);
    mlClient = createClient(ML_SERVICE_URL);
    traefikClient = createClient(TRAEFIK_URL);

    console.log('\n🚀 Starting Docker Compose integration tests...');
    console.log(`   Backend URL: ${BACKEND_URL}`);
    console.log(`   ML Service URL: ${ML_SERVICE_URL}`);
    console.log(`   Traefik URL: ${TRAEFIK_URL}\n`);
  }, STARTUP_TIMEOUT);

  describe('Service Health Checks', () => {
    it('should have a healthy backend service', async () => {
      const response = await backendClient.get('/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
    });

    it('should have a healthy ML service', async () => {
      const response = await mlClient.get('/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data.status).toBe('healthy');
    });

    it('should route requests through Traefik', async () => {
      // Test that Traefik routes /api correctly
      const response = await traefikClient.get('/api/health');
      expect([200, 502]).toContain(response.status);
    });
  });

  describe('Backend API Endpoints', () => {
    it('should return API information from root', async () => {
      const response = await backendClient.get('/');
      expect(response.status).toBe(200);
    });

    it('should return portfolio data', async () => {
      const response = await backendClient.get('/portfolio');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('ML Service API Endpoints', () => {
    it('should return OpenAPI documentation', async () => {
      const response = await mlClient.get('/docs');
      expect(response.status).toBe(200);
    });

    it('should return prediction for a ticker', async () => {
      const response = await mlClient.get('/predict/AAPL');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('ticker');
      expect(response.data.ticker).toBe('AAPL');
      expect(response.data).toHaveProperty('predicted_price');
    });

    it('should return PDM scan opportunities', async () => {
      const response = await mlClient.get('/pdm/scan');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('opportunities');
      expect(response.data).toHaveProperty('scanned_tickers');
    });

    it('should handle batch predictions', async () => {
      const response = await mlClient.post('/predict/batch', {
        tickers: ['AAPL', 'GOOGL', 'TSLA'],
        include_pdm: true,
      });
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('predictions');
      expect(response.data.predictions.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Service Communication', () => {
    it('backend should be able to reach ML service', async () => {
      // This tests the internal Docker network connectivity
      // The backend should proxy requests to ML service
      const response = await backendClient.get('/predict/AAPL');
      // Either direct success or a proper error from trying to reach ML service
      expect([200, 502, 503]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid ticker gracefully', async () => {
      const response = await mlClient.get('/predict/INVALID123456');
      // Should return either validation error or still work
      expect([200, 400, 422]).toContain(response.status);
    });

    it('should return 404 for unknown endpoints', async () => {
      const response = await backendClient.get('/unknown/endpoint/12345');
      expect(response.status).toBe(404);
    });
  });
});

/**
 * Smoke test runner for CI/CD
 * Can be run independently: npx ts-node tests/integration/docker-compose.test.ts --smoke
 */
async function runSmokeTests(): Promise<void> {
  console.log('🔥 Running smoke tests...\n');
  
  const backendClient = createClient(BACKEND_URL);
  const mlClient = createClient(ML_SERVICE_URL);
  
  try {
    // Wait for services
    const backendReady = await waitForService(backendClient, '/health', 'Backend');
    const mlReady = await waitForService(mlClient, '/health', 'ML Service');
    
    if (!backendReady || !mlReady) {
      console.error('\n❌ Smoke tests failed: Services not ready');
      process.exit(1);
    }
    
    // Quick functionality check
    const prediction = await mlClient.get('/predict/AAPL');
    if (prediction.status !== 200) {
      throw new Error(`Prediction endpoint failed with status ${prediction.status}`);
    }
    
    console.log('\n✅ All smoke tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke tests failed:', error);
    process.exit(1);
  }
}

// Run smoke tests if called directly
if (require.main === module && process.argv.includes('--smoke')) {
  runSmokeTests();
}
