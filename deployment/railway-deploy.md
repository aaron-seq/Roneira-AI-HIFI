# 🚀 Free Deployment Guide - Roneira AI HIFI

## Overview
This guide helps you deploy the full-stack Roneira AI HIFI application using **100% free services**.

## 📋 Services Used

| Component | Service | Free Tier Limits | Cost |
|-----------|---------|------------------|------|
| **Frontend** | Vercel | 100GB bandwidth, 1000 deployments/month | FREE |
| **Backend** | Railway | 512MB RAM, 1GB disk, $5 credit/month | FREE |
| **ML Service** | Railway/Render | 512MB RAM, 1GB disk | FREE |
| **Database** | Supabase | 500MB storage, 50MB file uploads | FREE |
| **Cache** | Upstash Redis | 10,000 commands/day | FREE |
| **ML APIs** | Hugging Face | 15,000 requests/month | FREE |

---

## 🔧 Step 1: Database Setup (Supabase)

### 1.1 Create Supabase Project
1. Go to [Supabase](https://supabase.com)
2. Create new project
3. Note down:
   - Project URL
   - API Key (anon/public)
   - Database password

### 1.2 Database Schema
```sql
-- Create tables for portfolio management
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE portfolios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE portfolio_stocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portfolio_id UUID REFERENCES portfolios(id),
    ticker VARCHAR(10) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    purchase_price DECIMAL(10,2),
    purchase_date TIMESTAMP DEFAULT NOW()
);

CREATE TABLE predictions_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    prediction_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 Step 2: ML Service Deployment (Railway)

### 2.1 Deploy ML Service
1. **Fork/Clone** your repository
2. Go to [Railway.app](https://railway.app)
3. **New Project** → **Deploy from GitHub**
4. Select your repository
5. **Root Directory**: `/ml-service`

### 2.2 ML Service Environment Variables
```env
# Railway Auto-provided
PORT=5000

# Optional: Hugging Face API (for better sentiment analysis)
HUGGING_FACE_API_KEY=your_hf_token_here

# Optional: Alpha Vantage (5 calls/min free)
ALPHA_VANTAGE_API_KEY=demo

# Flask settings
FLASK_ENV=production
```

### 2.3 ML Service Dockerfile
```dockerfile
# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY enhanced_requirements.txt requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Start application
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "enhanced_app:app"]
```

---

## 🖥 Step 3: Backend Deployment (Railway)

### 3.1 Update Backend Dependencies
Update `backend/package.json`:
```json
{
  "name": "roneira-backend",
  "version": "2.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "axios": "^1.7.2",
    "pg": "^8.11.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1",
    "helmet": "^7.0.0",
    "rate-limiter-flexible": "^2.4.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": "18.x"
  }
}
```

### 3.2 Backend Environment Variables
```env
# Railway Auto-provided
PORT=3001

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres

# ML Service URL (Railway-provided)
ML_SERVICE_URL=https://your-ml-service.railway.app

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# API Keys (optional)
ALPHA_VANTAGE_API_KEY=demo

# CORS Origins
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
```

---

## 🎨 Step 4: Frontend Deployment (Vercel)

### 4.1 Frontend Environment Variables
Create `frontend/.env.local`:
```env
# API URLs
REACT_APP_API_URL=https://your-backend.railway.app
REACT_APP_ML_API_URL=https://your-ml-service.railway.app

# Feature flags
REACT_APP_ENABLE_REALTIME=true
REACT_APP_ENABLE_NOTIFICATIONS=true

# Optional: Analytics
REACT_APP_GA_TRACKING_ID=your-ga-id
```

### 4.2 Vercel Deployment Settings
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "framework": "vite"
}
```

---

## 🔗 Step 5: Free ML APIs Integration

### 5.1 Hugging Face (FREE)
- **15,000 requests/month**
- Sign up: [huggingface.co](https://huggingface.co)
- Generate API token
- Models used:
  - `ProsusAI/finbert` (Financial sentiment)
  - `microsoft/DialoGPT-medium` (Text generation)

### 5.2 Alpha Vantage (FREE)
- **5 API calls/minute**
- **500 calls/day**
- Sign up: [alphavantage.co](https://www.alphavantage.co/support/#api-key)

### 5.3 Yahoo Finance (FREE)
- No API key required
- Used via `yfinance` library
- Unlimited requests (within reasonable limits)

---

## ⚡ Step 6: Performance Optimizations

### 6.1 Caching Strategy
```python
# In ML service
from flask_caching import Cache

cache = Cache(config={'CACHE_TYPE': 'simple'})
cache.init_app(app)

@app.route('/predict')
@cache.cached(timeout=300)  # 5 minutes cache
def predict_with_cache():
    # Your prediction logic
    pass
```

### 6.2 Frontend Optimizations
```javascript
// React Query for data caching
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['prediction', ticker],
  queryFn: () => fetchPrediction(ticker),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

---

## 🔒 Step 7: Security Setup

### 7.1 Environment Variables
**Never commit sensitive data!** Use:
- Railway: Environment tab
- Vercel: Environment Variables in dashboard
- Supabase: API keys from dashboard

### 7.2 CORS Configuration
```javascript
// backend/server.js
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'https://your-app.vercel.app'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

---

## 📊 Step 8: Monitoring & Analytics

### 8.1 Free Monitoring Tools
- **Railway**: Built-in metrics
- **Vercel**: Analytics dashboard
- **Sentry**: Error tracking (free tier)
- **LogRocket**: Session recordings (1,000 sessions/month free)

### 8.2 Health Checks
```python
# ML Service health endpoint
@app.route('/health')
def health():
    return {
        'status': 'healthy',
        'models_loaded': len(model_cache),
        'timestamp': datetime.now().isoformat()
    }
```

---

## 🚀 Step 9: Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] Database schema created
- [ ] API keys obtained
- [ ] CORS origins updated

### Deploy Order
1. [ ] Database (Supabase)
2. [ ] ML Service (Railway)
3. [ ] Backend (Railway)
4. [ ] Frontend (Vercel)

### Post-deployment
- [ ] Test all API endpoints
- [ ] Verify ML predictions
- [ ] Check database connections
- [ ] Monitor error rates

---

## 🔗 Useful Links

- **Railway Dashboard**: https://railway.app/dashboard
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **Hugging Face Hub**: https://huggingface.co/models
- **Alpha Vantage**: https://www.alphavantage.co

---

## 🆘 Troubleshooting

### Common Issues
1. **ML Service Memory Limit**: Use lighter models or implement pagination
2. **Database Connection**: Check Supabase connection string format
3. **CORS Errors**: Verify allowed origins in backend
4. **API Rate Limits**: Implement caching and request throttling

### Performance Tips
1. **Enable compression** in Express
2. **Use React.lazy()** for code splitting
3. **Implement service worker** for caching
4. **Optimize images** and assets

---

**🎉 Congratulations!** Your Roneira AI HIFI app is now deployed using completely free services with enterprise-grade ML capabilities!