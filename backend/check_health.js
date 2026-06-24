const axios = require('axios');
const logger = require('./src/utils/logger');

async function checkHealth() {
    logger.info('Checking Backend Health directly...');
    const start = Date.now();
    try {
        const response = await axios.get('http://localhost:3001/api/market/health');
        logger.info(`Response Time: ${Date.now() - start}ms`);
        logger.info(`Status: ${JSON.stringify(response.data)}`);
    } catch (e) {
        logger.error(`Backend Health Check Failed: ${e.message}`);
    }
}

checkHealth();
