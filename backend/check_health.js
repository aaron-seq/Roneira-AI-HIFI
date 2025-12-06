const axios = require('axios');

async function checkHealth() {
    console.log('Checking Backend Health directly...');
    const start = Date.now();
    try {
        const response = await axios.get('http://localhost:3001/api/market/health');
        console.log(`Response Time: ${Date.now() - start}ms`);
        console.log('Status:', response.data);
    } catch (e) {
        console.log('Backend Health Check Failed:', e.message);
    }
}

checkHealth();
