import axios from 'axios';

async function diagnose() {
    console.log('--- Diagnosing Roneira AI HIFI Services ---');

    // 1. Check ML Service Direct
    console.log('\n1. Checking ML Service (Port 5000)...');
    try {
        const health = await axios.get('http://127.0.0.1:5000/health');
        console.log('✅ ML Service Healthy:', health.data.service_status);

        // Try a direct prediction (mock payload if needed, or simple GET if GET is supported for testing)
        // Assuming POST for prediction based on context, but let's try a simple prediction if possible
        // Note: The user said "prediction not working", usually implies the flow Backend -> ML Service
    } catch (error) {
        console.error('❌ ML Service Unreachable:', error.message);
    }

    // 2. Check Backend Proxy
    console.log('\n2. Checking Backend API (Port 3001)...');
    try {
        const health = await axios.get('http://127.0.0.1:3001/api/market/health');
        console.log('✅ Backend Service Healthy:', health.data.status);
    } catch (error) {
        console.error('❌ Backend Service Unreachable:', error.message);
    }

    // 3. Test Prediction Flow (Backend -> ML Service)
    console.log('\n3. Testing Full Prediction Flow (Backend -> ML)...');
    try {
        // Attempting a prediction for AAPL
        const response = await axios.post('http://127.0.0.1:3001/api/predict', {
            symbol: 'AAPL',
            days: 30
        });
        console.log('✅ Prediction Success:', JSON.stringify(response.data).substring(0, 100) + '...');
    } catch (error) {
        console.error('❌ Prediction Failed:', error.response ? error.response.data : error.message);
    }
}

diagnose();
