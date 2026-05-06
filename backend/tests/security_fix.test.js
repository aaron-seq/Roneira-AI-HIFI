const express = require('express');
const axios = require('axios');
const request = require('supertest');

// We'll mock axios to simulate ML service errors
jest.mock('axios');

describe('Security Fix Verification - Information Disclosure', () => {
    let app;
    const ML_SERVICE_URL = 'http://localhost:5000';

    beforeAll(() => {
        // Simple version of the app for testing the error handler
        app = express();
        app.use(express.json());

        app.post('/api/predict', async (req, res) => {
            try {
                const { ticker, days = 1 } = req.body;
                const predictionResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
                    ticker: ticker.toUpperCase(),
                    days: days
                });
                res.status(200).json(predictionResponse.data);
            } catch (error) {
                if (error.response) {
                    return res.status(error.response.status).json({
                        error: 'The ML service returned an error while processing the request.'
                    });
                }
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        app.post('/api/batch_predict', async (req, res) => {
            try {
                const { tickers } = req.body;
                const predictionResponse = await axios.post(`${ML_SERVICE_URL}/batch_predict`, {
                    tickers: tickers.map(t => t.toUpperCase())
                });
                res.status(200).json(predictionResponse.data);
            } catch (error) {
                if (error.response) {
                    return res.status(error.response.status).json({
                        error: 'The ML service returned an error during batch processing.'
                    });
                }
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    });

    it('should not disclose raw ML service error details in /api/predict', async () => {
        const sensitiveData = {
            error: 'Database connection failed',
            stack: 'Error: Database connection failed\n    at PredictionService.predict (/app/ml/service.py:123)',
            internal_config: { db_url: 'postgres://user:password@internal-db:5432/ml' }
        };

        axios.post.mockRejectedValueOnce({
            response: {
                status: 500,
                data: sensitiveData
            }
        });

        const response = await request(app)
            .post('/api/predict')
            .send({ ticker: 'AAPL' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('The ML service returned an error while processing the request.');
        expect(response.body.details).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain('Database connection failed');
        expect(JSON.stringify(response.body)).not.toContain('postgres://');
    });

    it('should not disclose raw ML service error details in /api/batch_predict', async () => {
        const sensitiveData = {
            error: 'Batch processing failed for node worker-7',
            debug_info: { worker_id: 'worker-7', internal_ip: '10.0.0.45' }
        };

        axios.post.mockRejectedValueOnce({
            response: {
                status: 502,
                data: sensitiveData
            }
        });

        const response = await request(app)
            .post('/api/batch_predict')
            .send({ tickers: ['AAPL', 'MSFT'] });

        expect(response.status).toBe(502);
        expect(response.body.error).toBe('The ML service returned an error during batch processing.');
        expect(response.body.details).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain('worker-7');
        expect(JSON.stringify(response.body)).not.toContain('10.0.0.45');
    });
});
