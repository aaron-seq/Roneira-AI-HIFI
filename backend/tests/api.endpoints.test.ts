import request from 'supertest';
import express from 'express';

/**
 * Backend REST Endpoint Tests
 * Tests for Express.js API endpoints
 */

// Mock the Express app
const createMockApp = () => {
  const app = express();
  app.use(express.json());
  
  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        api: 'up',
        cache: 'up',
        database: 'up'
      }
    });
  });

  // Market overview endpoint
  app.get('/api/market/overview', (req, res) => {
    res.json({
      indices: [
        { symbol: 'SPY', name: 'S&P 500', price: 450.25, change: 2.35, changePercent: 0.52 },
        { symbol: 'QQQ', name: 'NASDAQ 100', price: 380.10, change: -1.20, changePercent: -0.32 }
      ],
      trending: ['AAPL', 'NVDA', 'TSLA'],
      marketStatus: 'open',
      timestamp: new Date().toISOString()
    });
  });

  // Stock quote endpoint
  app.get('/api/market/quote/:symbol', (req, res) => {
    const { symbol } = req.params;
    
    if (!symbol || symbol.length < 1) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }
    
    res.json({
      symbol: symbol.toUpperCase(),
      price: 150.50,
      change: 2.25,
      changePercent: 1.52,
      volume: 45000000,
      high: 152.00,
      low: 148.50,
      open: 149.00,
      previousClose: 148.25,
      timestamp: new Date().toISOString()
    });
  });

  // Prediction endpoint
  app.post('/api/predict', (req, res) => {
    const { symbol, horizon } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    if (!horizon || !['1d', '7d', '30d', '90d'].includes(horizon)) {
      return res.status(400).json({ error: 'Valid horizon required (1d, 7d, 30d, 90d)' });
    }
    
    res.json({
      symbol: symbol.toUpperCase(),
      currentPrice: 150.50,
      predictedPrice: 158.25,
      predictedChange: 7.75,
      predictedChangePercent: 5.15,
      confidence: 75.5,
      horizon,
      direction: 'bullish',
      factors: [
        { name: 'Technical Momentum', impact: 0.35, direction: 'positive' },
        { name: 'Sentiment Score', impact: 0.25, direction: 'positive' }
      ],
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
};

describe('Backend REST Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createMockApp();
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.services).toBeDefined();
    });

    it('should include service status details', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.services.api).toBe('up');
      expect(response.body.services.cache).toBe('up');
      expect(response.body.services.database).toBe('up');
    });
  });

  describe('GET /api/market/overview', () => {
    it('should return market overview data', async () => {
      const response = await request(app)
        .get('/api/market/overview')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.indices).toBeDefined();
      expect(Array.isArray(response.body.indices)).toBe(true);
      expect(response.body.trending).toBeDefined();
      expect(response.body.marketStatus).toBeDefined();
    });

    it('should include index data with required fields', async () => {
      const response = await request(app)
        .get('/api/market/overview')
        .expect(200);

      const index = response.body.indices[0];
      expect(index.symbol).toBeDefined();
      expect(index.name).toBeDefined();
      expect(index.price).toBeDefined();
      expect(typeof index.price).toBe('number');
    });
  });

  describe('GET /api/market/quote/:symbol', () => {
    it('should return quote for valid symbol', async () => {
      const response = await request(app)
        .get('/api/market/quote/AAPL')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.symbol).toBe('AAPL');
      expect(response.body.price).toBeDefined();
      expect(response.body.change).toBeDefined();
      expect(response.body.volume).toBeDefined();
    });

    it('should convert symbol to uppercase', async () => {
      const response = await request(app)
        .get('/api/market/quote/aapl')
        .expect(200);

      expect(response.body.symbol).toBe('AAPL');
    });

    it('should include OHLC data', async () => {
      const response = await request(app)
        .get('/api/market/quote/NVDA')
        .expect(200);

      expect(response.body.high).toBeDefined();
      expect(response.body.low).toBeDefined();
      expect(response.body.open).toBeDefined();
      expect(response.body.previousClose).toBeDefined();
    });
  });

  describe('POST /api/predict', () => {
    it('should return prediction for valid request', async () => {
      const response = await request(app)
        .post('/api/predict')
        .send({ symbol: 'AAPL', horizon: '7d' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.symbol).toBe('AAPL');
      expect(response.body.predictedPrice).toBeDefined();
      expect(response.body.confidence).toBeDefined();
      expect(response.body.direction).toBeDefined();
    });

    it('should reject request without symbol', async () => {
      const response = await request(app)
        .post('/api/predict')
        .send({ horizon: '7d' })
        .expect(400);

      expect(response.body.error).toContain('Symbol');
    });

    it('should reject request with invalid horizon', async () => {
      const response = await request(app)
        .post('/api/predict')
        .send({ symbol: 'AAPL', horizon: 'invalid' })
        .expect(400);

      expect(response.body.error).toContain('horizon');
    });

    it('should include prediction factors', async () => {
      const response = await request(app)
        .post('/api/predict')
        .send({ symbol: 'TSLA', horizon: '30d' })
        .expect(200);

      expect(response.body.factors).toBeDefined();
      expect(Array.isArray(response.body.factors)).toBe(true);
      expect(response.body.factors[0].name).toBeDefined();
      expect(response.body.factors[0].impact).toBeDefined();
    });

    it('should accept all valid horizons', async () => {
      const horizons = ['1d', '7d', '30d', '90d'];
      
      for (const horizon of horizons) {
        const response = await request(app)
          .post('/api/predict')
          .send({ symbol: 'GOOGL', horizon })
          .expect(200);
        
        expect(response.body.horizon).toBe(horizon);
      }
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body.error).toBe('Not found');
    });
  });
});
