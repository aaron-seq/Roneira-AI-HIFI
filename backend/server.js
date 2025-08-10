// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;
const ML_SERVICE_URL = 'http://127.0.0.1:5000/predict'; // URL of your Python ML service

app.use(cors());
app.use(express.json());

// --- Mock Database ---
// In a real app, you would use a database like MongoDB or PostgreSQL
const users = {
  'admin': { password: 'aaron1234', name: 'Aaron' },
  'user1': { password: 'password1', name: 'User One' }
};
const auditLog = [
  { user: 'user_alpha', timestamp: '2025-08-09 23:45:12', stock: 'RELIANCE.NS' },
  { user: 'user_beta', timestamp: '2025-08-09 23:42:05', stock: 'NVDA' },
];

// --- API Endpoints ---

// Login Endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username].password === password) {
    console.log(`Login successful for user: ${username}`);
    res.json({ success: true, user: { username, name: users[username].name } });
  } else {
    console.log(`Login failed for user: ${username}`);
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Audit Log Endpoint
app.get('/api/auditlog', (req, res) => {
  // In a real app, you'd check if the user is an admin
  res.json(auditLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

// Prediction Endpoint
app.post('/api/predict', async (req, res) => {
  const { stock, timeline, user } = req.body;

  if (!stock || !timeline || !user) {
    return res.status(400).json({ message: 'Missing required fields: stock, timeline, user' });
  }

  // Add to audit log
  const newLogEntry = { user: user.username, timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19), stock };
  auditLog.unshift(newLogEntry);
  console.log('New audit log entry:', newLogEntry);

  try {
    // Call the Python ML service
    console.log(`Forwarding prediction request for ${stock} to ML service...`);
    const mlResponse = await axios.post(ML_SERVICE_URL, {
      stock_symbol: stock,
      prediction_timeline: timeline
    });

    // Return the prediction from the ML service
    res.json(mlResponse.data);

  } catch (error) {
    console.error("Error calling ML service:", error.message);
    // Fallback to mock data if ML service fails
    res.status(500).json({
        priceTarget: 215.50,
        confidenceScore: 85,
        marketValueTarget: '220.00 - 225.00',
        indicators: { shortTerm: 'Strong Buy', longTerm: 'Buy' },
        peerComparison: [
            { name: 'Peer A', valuation: 'High', durability: 'High', momentum: 'Medium' },
            { name: 'Peer B', valuation: 'Medium', durability: 'High', momentum: 'High' },
        ],
    });
  }
});


app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
