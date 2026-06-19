import axios from 'axios';

async function checkHealth() {
    try {
        await axios.get('http://127.0.0.1:5000/health');
    } catch (error) {
        console.error('Health Check Failed:', error);
    }
}

checkHealth();
