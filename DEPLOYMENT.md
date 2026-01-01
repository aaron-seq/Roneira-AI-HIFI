# Roneira AI HIFI - Deployment Guide

## Production Deployment Options

This guide covers deploying Roneira AI HIFI to Railway, Render, and Vercel.

---

## Option 1: Railway (Recommended)

Railway is the easiest option for full-stack deployments with databases.

### Prerequisites
- Railway account: https://railway.app
- GitHub repository connected

### Steps

1. **Connect Repository**
   ```bash
   # Push your code to GitHub
   git push origin main
   ```

2. **Create New Project on Railway**
   - Go to https://railway.app/new
   - Select "Deploy from GitHub repo"
   - Choose your Roneira-AI-HIFI repository

3. **Add Services**
   Railway will detect your `docker-compose.yml` and deploy services automatically.
   
   Or manually add:
   - **PostgreSQL** (from Railway templates)
   - **Redis** (from Railway templates)
   - **Backend** (Node.js service)
   - **ML Service** (Python service)
   - **Frontend** (Static site or Node.js)

4. **Set Environment Variables**
   In Railway Dashboard > Settings > Variables:

   ```bash
   # Database (Railway provides this automatically for PostgreSQL)
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   
   # Redis
   REDIS_URL=${{Redis.REDIS_URL}}
   
   # API Keys (Required - Get your own keys)
   ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
   HUGGING_FACE_API_KEY=your_hugging_face_token
   TWELVE_DATA_API_KEY=your_twelve_data_key
   
   # Frontend Environment
   VITE_API_BASE_URL=https://your-backend.railway.app
   VITE_ML_API_BASE_URL=https://your-ml-service.railway.app
   VITE_TWELVE_DATA_API_KEY=your_twelve_data_key
   
   # Application
   NODE_ENV=production
   CORS_ORIGIN=https://your-frontend.railway.app
   ```

5. **Deploy**
   Railway auto-deploys on push to main branch.

### Railway Cost
- **Free tier**: $5 credit/month, limited hours
- **Pro**: $20/month (recommended for production)

---

## Option 2: Render

Render is great for separate service deployments.

### Prerequisites
- Render account: https://render.com
- GitHub repository connected

### Steps

1. **Create PostgreSQL Database**
   - Dashboard > New > PostgreSQL
   - Name: `roneira-db`
   - Copy the Internal Database URL

2. **Create Redis Instance**
   - Dashboard > New > Redis
   - Name: `roneira-cache`
   - Copy the Internal Redis URL

3. **Deploy ML Service**
   - Dashboard > New > Web Service
   - Connect GitHub repo
   - Settings:
     - Name: `roneira-ml-service`
     - Root Directory: `ml-service`
     - Runtime: `Python 3.11`
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `python main.py`
   - Environment Variables:
     ```
     ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
     HUGGING_FACE_API_KEY=your_hugging_face_token
     PORT=8000
     ```

4. **Deploy Backend**
   - Dashboard > New > Web Service
   - Settings:
     - Name: `roneira-backend`
     - Root Directory: `backend`
     - Runtime: `Node`
     - Build Command: `npm install && npm run build`
     - Start Command: `node dist/server.js`
   - Environment Variables:
     ```
     DATABASE_URL=<your-postgres-internal-url>
     REDIS_URL=<your-redis-internal-url>
     ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
     ML_SERVICE_URL=https://roneira-ml-service.onrender.com
     NODE_ENV=production
     PORT=3001
     ```

5. **Deploy Frontend**
   - Dashboard > New > Static Site
   - Settings:
     - Name: `roneira-frontend`
     - Root Directory: `frontend`
     - Build Command: `npm install && npm run build`
     - Publish Directory: `dist`
   - Environment Variables:
     ```
     VITE_API_BASE_URL=https://roneira-backend.onrender.com
     VITE_ML_API_BASE_URL=https://roneira-ml-service.onrender.com
     VITE_TWELVE_DATA_API_KEY=your_twelve_data_key
     ```

### Render Cost
- **Free tier**: 750 hours/month, spins down after 15 min inactivity
- **Starter**: $7/service/month (recommended)

---

## Option 3: Vercel (Frontend) + Railway (Backend/ML)

Best for static frontend with serverless functions.

### Steps

1. **Deploy Frontend to Vercel**
   ```bash
   cd frontend
   npx vercel
   ```
   
   Set Environment Variables in Vercel Dashboard:
   ```
   VITE_API_BASE_URL=https://your-backend.railway.app
   VITE_ML_API_BASE_URL=https://your-ml-service.railway.app
   VITE_TWELVE_DATA_API_KEY=your_twelve_data_key
   ```

2. **Deploy Backend/ML to Railway**
   Follow Railway steps above for backend and ML service.

---

## Environment Variables Reference

### Required for All Services

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `ALPHA_VANTAGE_API_KEY` | Stock market data | https://www.alphavantage.co/support/#api-key |
| `HUGGING_FACE_API_KEY` | Sentiment analysis | https://huggingface.co/settings/tokens |
| `DATABASE_URL` | PostgreSQL connection | From provider |
| `REDIS_URL` | Redis connection | From provider |

### Frontend Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API URL |
| `VITE_ML_API_BASE_URL` | ML Service URL |
| `VITE_TWELVE_DATA_API_KEY` | Your Twelve Data API key |

### Backend Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `ML_SERVICE_URL` | ML Service internal URL |
| `CORS_ORIGIN` | Frontend URL |

### ML Service Variables

| Variable | Description |
|----------|-------------|
| `PORT` | `8000` |
| `FLASK_ENV` | `production` |

---

## Database Setup

### Initial Migration

After deploying, run database migrations:

```bash
# For Railway
railway run npm run migrate

# For Render (via SSH console)
cd backend && npm run migrate
```

### TimescaleDB Extension (Optional)

If using TimescaleDB features, enable the extension:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

---

## Health Check URLs

After deployment, verify services are running:

- **Frontend**: `https://your-frontend.domain.com`
- **Backend**: `https://your-backend.domain.com/health`
- **ML Service**: `https://your-ml-service.domain.com/health`

---

## Troubleshooting

### Common Issues

1. **ML Service fails to start**
   - Ensure `yfinance` is in `requirements.txt`
   - Check Python version is 3.11+
   - Verify all environment variables are set

2. **Database connection fails**
   - Check `DATABASE_URL` format
   - Ensure PostgreSQL service is running
   - Verify SSL mode for production

3. **CORS errors**
   - Set `CORS_ORIGIN` to your frontend URL
   - Include both http and https if needed

4. **API rate limits**
   - Alpha Vantage free tier: 5 calls/minute
   - Consider upgrading for production traffic

---

## Monitoring

### Recommended Tools

- **Railway**: Built-in logs and metrics
- **Render**: Built-in logs
- **Sentry**: Error tracking (add `SENTRY_DSN` env var)
- **Datadog**: Full APM (optional)

---

## CI/CD

The repository includes GitHub Actions for:

- Linting and type checking
- Unit tests
- Docker builds
- Security scanning

Configure these secrets in GitHub:
- `RAILWAY_TOKEN` (for Railway deployments)
- `RENDER_DEPLOY_HOOK` (for Render deployments)
- `VERCEL_TOKEN` (for Vercel deployments)
