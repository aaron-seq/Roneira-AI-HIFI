import axios from 'axios';

const API_URL = 'http://127.0.0.1:3001/api/portfolio/demo-user';

async function testPortfolio() {
    try {
        console.log('1. Adding Stock to Portfolio...');
        const addResponse = await axios.post(`${API_URL}/update`, {
            ticker: 'TEST_STOCK',
            shares: 10,
            price: 150.50,
            action: 'add'
        });
        console.log('Add Response:', addResponse.data.success ? 'Success' : 'Failed');

        console.log('2. Fetching Portfolio...');
        const getResponse = await axios.get(API_URL);
        const portfolio = getResponse.data.data;
        console.log('Portfolio Items:', portfolio);

        if (portfolio.some((p: any) => p.ticker === 'TEST_STOCK')) {
            console.log('✅ Verification Successful: Stock found in portfolio');
        } else {
            console.error('❌ Verification Failed: Stock not found');
            process.exit(1);
        }

    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    }
}

testPortfolio();
