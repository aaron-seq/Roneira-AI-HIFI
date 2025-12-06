import axios from 'axios';

async function checkHealth() {
    try {
        const response = await axios.get('http://127.0.0.1:5000/health');
        console.log('Health Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Health Check Failed:', error);
    }
}

checkHealth();
