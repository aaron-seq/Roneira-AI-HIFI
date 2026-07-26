# Roneira AI HIFI — High-Impact Finance Intelligence Platform

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/aaron-seq/Roneira-AI-HIFI/ci.yml?branch=main)](https://github.com/aaron-seq/Roneira-AI-HIFI/actions)

*A production-grade financial analytics framework engineered for robust machine learning forecasting, advanced price-volume momentum analytics, and comprehensive portfolio intelligence in institutional or retail trading environments.*

[**Live Demo**](https://roneira-ai-hifi.vercel.app) • [**Architecture**](ARCHITECTURE.md) • [**Deployment**](DEPLOYMENT.md) • [**Contributing**](CONTRIBUTING.md)

</div>

## Table of Contents

<details>
<summary>Click to expand navigation</summary>

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Technology Stack](#architecture--technology-stack)
- [UI Components & Features](#ui-components--features)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Performance & Optimizations](#performance--optimizations)
- [Security Implementation](#security-implementation)
- [Testing Strategy](#testing-strategy)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Monitoring & Observability](#monitoring--observability)
- [Roadmap](#roadmap)
- [Support & Community](#support--community)
- [License](#license)

</details>

## Overview

Roneira AI HIFI represents the convergence of advanced machine learning, real-time financial data processing, and institutional-grade analytics in a comprehensive financial intelligence platform. Built with modern microservices architecture, the platform delivers:

- **Precision ML Forecasting**: RandomForest-based regression models with engineered technical features
- **Real-time Analytics**: Live market data processing with sub-second latency
- **Portfolio Intelligence**: Advanced risk assessment and correlation analysis
- **Scalable Infrastructure**: Container-native architecture for seamless scaling

### Core Objectives

<table>
<tr>
<td>

**Reliability** 
- Reproducible ML predictions
- Deterministic model training
- Comprehensive error handling

</td>
<td>

**Scalability** 
- Microservices architecture
- Container orchestration
- Auto-scaling capabilities

</td>
<td>

**Performance**
- Sub-second API responses
- Optimized data pipelines
- Intelligent caching layers

</td>
</tr>
</table>

## Key Features

### Machine Learning & Analytics

<details>
<summary><strong>Advanced ML Predictions</strong></summary>

- **Multi-Model Ensemble**: RandomForest, XGBoost, and LSTM models for different prediction horizons
- **Feature Engineering**: 50+ technical indicators with vectorized computation
- **Model Versioning**: MLOps pipeline with A/B testing capabilities
- **Backtesting Framework**: Historical performance validation with walk-forward analysis
- **Confidence Intervals**: Probabilistic predictions with uncertainty quantification

</details>

<details>
<summary><strong>PDM Strategy Analytics</strong></summary>

- **Price Derivatives**: Velocity (df/dt) and acceleration (d²f/dt²) calculations
- **Volume Analysis**: Volume-weighted price movements and momentum detection
- **Signal Generation**: Multi-timeframe confluence analysis
- **Risk Management**: ATR-based position sizing and stop-loss automation
- **Performance Metrics**: Sharpe ratio, maximum drawdown, and win-rate analytics

</details>

<details>
<summary><strong>Technical Analysis Suite</strong></summary>

- **Core Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic
- **Advanced Patterns**: Candlestick recognition, support/resistance levels
- **Custom Indicators**: Proprietary momentum and volatility measures
- **Multi-Timeframe**: Synchronized analysis across different time horizons
- **Alert System**: Real-time notifications for signal triggers

</details>

### Portfolio Management

<details>
<summary><strong>Intelligent Portfolio Analytics</strong></summary>

- **Real-time Valuation**: Live portfolio tracking with P&L calculations
- **Risk Assessment**: VaR calculations, correlation matrices, beta analysis
- **Performance Attribution**: Sector, geographic, and style factor analysis
- **Rebalancing Algorithms**: Automated portfolio optimization
- **Tax Optimization**: Harvest loss tracking and wash sale rule compliance

</details>

## Architecture & Technology Stack

> For the full C4-style component breakdown, data flow diagrams, and guardrails, see [ARCHITECTURE.md](./ARCHITECTURE.md). This section is a summary.

```mermaid
graph TB
    subgraph "Next.js App (src/) — Vercel"
        UI[React 19 UI<br/>App Router]
        API[Route Handlers<br/>/api/predict, /api/market-data,<br/>/api/news, /api/stocks/search]
        RQ[TanStack Query Cache]
    end

    subgraph "ML Service (ml/) — Railway/Render"
        MLAPI[FastAPI + Uvicorn]
        Models[RandomForest / Technical /<br/>PVD Momentum / Ensemble<br/>+ artifact-backed LSTM & GAN]
    end

    subgraph "Supabase"
        Auth[Auth<br/>email/password]
        Postgres[(Postgres<br/>users, portfolio, watchlist,<br/>audit_log, predictions)]
        RLS[Row Level Security]
    end

    subgraph "External Data"
        TwelveData[Twelve Data<br/>primary quotes/history]
        YFinance[yfinance<br/>fallback, via ml/]
        NewsAPI[NewsAPI / Finnhub]
    end

    UI --> API
    API --> RQ
    API -->|private, server-to-server| MLAPI
    MLAPI --> Models
    API --> Auth
    API --> Postgres
    Postgres --- RLS
    API --> TwelveData
    MLAPI --> YFinance
    API --> NewsAPI
```

### Core Services Matrix

| Service | Technology | Purpose | Deploys to |
|---------|------------|---------|-------------|
| **Web app** | Next.js 16 (App Router) + React 19 + TypeScript | UI, SSR/streaming, and API route handlers (BFF) | Vercel |
| **ML service** | Python + FastAPI + Uvicorn | Prediction inference (RandomForest, Technical, PVD Momentum, Ensemble, artifact-backed LSTM/GAN) | Railway / Render |
| **Auth & DB** | Supabase (Postgres + Auth + RLS) | Users, portfolio, watchlist, audit log, prediction history | Supabase-hosted |
| **State/cache (client)** | TanStack Query + Zustand | Client-side data fetching cache and UI state | Bundled with web app |
| **Rate limiting** | Upstash Redis (configured dependency) | API route abuse prevention | Upstash-hosted |

`frontend/`, `backend/`, and `ml-service/` are earlier implementations (Vite/React, Express, Flask) kept only as reference material — they are not built, tested, or deployed. See [Repository Layout](#repository-layout) below.

## UI Components & Features

### Dynamic Interface Components

<table>
<tr>
<td width="50%">

#### Core UI Components

**Navigation System**
- Responsive sidebar with collapsible menu
- Breadcrumb navigation with dynamic routing
- Global search with autocomplete
- User profile dropdown with settings

**Dashboard Components**
- Real-time metric cards with animations
- Interactive charts with zooming/panning
- Customizable widget layouts
- Dark/light theme toggle

**Data Visualization**
- Candlestick charts with volume overlays
- Technical indicator overlays
- Portfolio allocation pie charts
- Performance comparison line charts

</td>
<td width="50%">

#### Interactive Features

**Prediction Interface**
- Multi-ticker symbol search with fuzzy matching
- Prediction horizon slider (1-30 days)
- Confidence interval visualization
- Historical accuracy metrics

**Portfolio Management**
- Drag-and-drop position management
- Real-time P&L calculations
- Risk metrics dashboard
- Alert configuration panels

**Analysis Tools**
- Interactive backtesting interface
- Strategy parameter optimization
- Performance attribution breakdowns
- Correlation heatmaps

</td>
</tr>
</table>

### Component Architecture

```
src/components/
├── ui/            # Reusable primitives (buttons, inputs, skeletons, command palette)
├── auth/           # Login/signup forms
├── charts/          # lightweight-charts / recharts wrappers (PredictionChart, etc.)
├── prediction/       # ML prediction surface (SignalMeter, ConfidenceRing, ...)
└── shared/          # Cross-page layout and shared widgets
```

### Advanced UI Features

**Progressive Web App (PWA)**
- Offline functionality with service workers
- Push notifications for alerts
- App-like experience on mobile devices
- Background sync for data updates

**Real-time Updates**
- WebSocket connections for live data
- Optimistic UI updates
- Conflict resolution for concurrent edits
- Automatic reconnection handling

**Accessibility & Performance**
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Lazy loading with intersection observers
- Code splitting for optimal bundle sizes

## Repository Layout

This repository contains both the **active product** and older implementations
kept for reference. Contribute to the canonical paths only.

| Path | Status | What it is |
|------|--------|-----------|
| `src/` | **Canonical** | The Next.js application (UI + API route handlers). This is what deploys to Vercel — see `vercel.json`. |
| `ml/` | **Canonical** | The FastAPI ML service (LSTM, GAN, Random Forest, PDM momentum, ensemble). |
| `supabase/` | **Canonical** | Database schema and migrations. |
| `frontend/` | Legacy | Earlier Vite/React client. Not built, tested, or deployed. |
| `backend/` | Legacy | Earlier Express API gateway. Not built, tested, or deployed. |
| `ml-service/` | Legacy | Earlier Flask/FastAPI ML service. Not built, tested, or deployed. |
| `realtime/` | Legacy | Socket.IO tick service built against the legacy Vite frontend (CORS defaults to `localhost:5173`). Nothing in `src/` calls it and it isn't wired into CI. |

CI (`.github/workflows/ci.yml`) validates the canonical surfaces only. The
legacy trees are retained as reference material and intentionally do not gate
merges. See `task.md` for the authoritative statement of canonical paths.

> **Working on a fix?** If an issue names a file under `frontend/`, `backend/`,
> or `ml-service/`, check whether the behaviour still exists under `src/` or
> `ml/` — that is where the change usually belongs.

## Getting Started

### Prerequisites Checklist

- [ ] **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- [ ] **Python** >= 3.11 ([Download](https://python.org/))
- [ ] **Docker** & Docker Compose ([Download](https://docker.com/))
- [ ] **Git** for version control
- [ ] **PostgreSQL** 15+ (optional for local development)
- [ ] **Redis** 7+ (optional for local development)

### Quick Start (5 minutes)

<details>
<summary><strong>1. Clone and Setup</strong></summary>

```bash
# Clone the repository
git clone https://github.com/aaron-seq/Roneira-AI-HIFI.git
cd Roneira-AI-HIFI

# Copy the environment template and fill in your values
cp .env.example .env.local

# Install web dependencies
npm ci
```

At minimum you need the Supabase variables in `.env.local` for auth and
persistence; market-data API keys are optional and the app degrades gracefully
without them. See [Configuration](#configuration) for the full list.

</details>

<details>
<summary><strong>2. Run the web app</strong></summary>

```bash
npm run dev        # http://localhost:3000
```

The Next.js app serves both the UI and its API route handlers
(`/api/predict`, `/api/market-data`, `/api/news`, `/api/stocks/search`, ...).
It is fully usable on its own — the ML service is only required for live
model-backed predictions.

</details>

<details>
<summary><strong>3. Run the ML service (optional)</strong></summary>

```bash
cd ml
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000   # or: npm run ml:dev
```

Point the web app at it with `NEXT_PUBLIC_ML_BACKEND_URL=http://localhost:8000`.
The FastAPI service stays private behind the Next.js API routes.

**Model artifacts:** LSTM and GAN load bundled artifacts from
`ml/artifacts/generated` at startup and degrade gracefully when the artifacts
(or TensorFlow) are unavailable. Generate them with `npm run train:ml`.

</details>

<details>
<summary><strong>4. Verify your setup</strong></summary>

```bash
npm run lint
npm run type-check
npm run test:web
npm run build

cd ml && python -m pytest tests -q
```

These are exactly the checks CI runs.

</details>

### Development Workflow

```mermaid
gitGraph
    commit id: "Initial setup"
    branch feature/new-indicator
    checkout feature/new-indicator
    commit id: "Add RSI calculation"
    commit id: "Add tests"
    commit id: "Update docs"
    checkout main
    merge feature/new-indicator
    commit id: "Release v1.1.0"
```

## Configuration

### Environment Variables Reference

<details open>
<summary><strong>Frontend Configuration</strong></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3001` | Backend API endpoint |
| `VITE_WS_URL` | `ws://localhost:3001` | WebSocket server URL |
| `VITE_APP_NAME` | `Roneira AI HIFI` | Application display name |
| `VITE_APP_VERSION` | `3.0.0` | Version identifier |
| `VITE_SENTRY_DSN` | - | Error tracking DSN |
| `VITE_ANALYTICS_ID` | - | Google Analytics ID |

</details>

<details>
<summary><strong>Backend Configuration</strong></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server listening port |
| `NODE_ENV` | `development` | Runtime environment |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `REDIS_URL` | - | Redis connection string |
| `JWT_SECRET` | - | JWT signing secret |
| `ML_SERVICE_URL` | `http://localhost:5000` | ML service endpoint |
| `RATE_LIMIT_WINDOW` | `900000` | Rate limit window (15min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |

</details>

<details>
<summary><strong>ML Service Configuration</strong></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `development` | Flask environment |
| `MODEL_CACHE_TTL` | `3600` | Model cache TTL (seconds) |
| `FEATURE_CACHE_SIZE` | `1000` | Feature cache size |
| `HUGGING_FACE_API_KEY` | - | HF API key for sentiment |
| `ALPHA_VANTAGE_API_KEY` | - | Market data API key |
| `GUNICORN_WORKERS` | `4` | Production worker count |

</details>

## API Documentation

### RESTful API Endpoints

<details>
<summary><strong>Prediction Endpoints</strong></summary>

#### POST `/api/v1/predict`
Single ticker price prediction with ML models.

**Request Body:**
```json
{
  "ticker": "AAPL",
  "days": 5,
  "models": ["randomforest", "xgboost"],
  "include_pdm": true,
  "confidence_level": 0.95
}
```

**Response:**
```json
{
  "predictions": [
    {
      "date": "2024-01-15",
      "price": 185.42,
      "confidence_interval": [180.15, 190.69],
      "probability": 0.78
    }
  ],
  "model_metrics": {
    "accuracy": 0.82,
    "mae": 2.34,
    "rmse": 3.67
  },
  "pdm_signals": {
    "momentum": "bullish",
    "strength": 0.65
  }
}
```

#### POST `/api/v1/batch-predict`
Batch prediction for multiple tickers (max 10).

**Rate Limits:** 30 requests/minute per API key

</details>

<details>
<summary><strong>Portfolio Endpoints</strong></summary>

#### GET `/api/v1/portfolio/:userId`
Retrieve user portfolio with real-time valuations.

#### POST `/api/v1/portfolio/:userId/positions`
Add or update portfolio positions.

#### GET `/api/v1/portfolio/:userId/analytics`
Portfolio performance analytics and risk metrics.

</details>

<details>
<summary><strong>PDM Strategy Endpoints</strong></summary>

#### GET `/api/v1/pdm/scan`
Scan markets for PDM opportunities.

#### POST `/api/v1/pdm/backtest`
Run historical PDM strategy backtests.

</details>

### GraphQL Schema (Beta)

```graphql
type Query {
  predictions(
    tickers: [String!]!
    days: Int = 1
    models: [ModelType!]
  ): [Prediction!]!
  
  portfolio(userId: ID!): Portfolio
  
  marketData(
    ticker: String!
    range: TimeRange!
  ): [OHLCV!]!
}

type Prediction {
  ticker: String!
  predictions: [PricePoint!]!
  confidence: Float!
  modelMetrics: ModelMetrics!
}
```

## Performance & Optimizations

### Frontend Optimizations

<table>
<tr>
<td>

**Bundle Optimization**
- Tree shaking with Vite
- Dynamic imports for routes
- Code splitting by features
- Asset compression (Brotli/Gzip)

**Runtime Performance**
- React.memo for expensive components
- useMemo/useCallback for computations
- Virtual scrolling for large lists
- Intersection observer for lazy loading

</td>
<td>

**Caching Strategy**
- TanStack Query with stale-while-revalidate
- Service worker for offline assets
- CDN edge caching for static resources
- Browser cache optimization

**Network Optimization**
- Request deduplication
- Batch API calls where possible
- WebSocket for real-time data
- HTTP/2 server push

</td>
</tr>
</table>

### Backend Optimizations

```typescript
// Connection Pooling Example
const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,                    // Maximum pool size
  min: 5,                     // Minimum pool size
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout connection attempts after 2s
});

// Redis Caching Strategy
const cacheStrategy = {
  market_data: { ttl: 60 },     // 1 minute for market data
  predictions: { ttl: 3600 },   // 1 hour for ML predictions
  portfolio: { ttl: 300 },      // 5 minutes for portfolio data
};
```

### ML Service Optimizations

- **Vectorized Operations**: NumPy/Pandas for batch processing
- **Model Caching**: LRU cache with intelligent eviction
- **Feature Pipelines**: Efficient data transformation chains
- **GPU Acceleration**: CUDA support for training workloads

## Security Implementation

### Multi-Layer Security Architecture

```mermaid
graph LR
    subgraph "Edge Layer"
        CDN[CDN/WAF]
        TLS[TLS 1.3]
    end
    
    subgraph "Application Layer"
        CORS[CORS Policy]
        CSP[Content Security Policy]
        JWT[JWT Authentication]
        RBAC[Role-Based Access]
    end
    
    subgraph "Data Layer"
        Encrypt[Data Encryption]
        Audit[Audit Logging]
        Backup[Encrypted Backups]
    end
    
    CDN --> CORS
    CORS --> JWT
    JWT --> Encrypt
```

### Security Features

<details>
<summary><strong>Authentication & Authorization</strong></summary>

- **JWT Tokens**: Stateless authentication with refresh token rotation
- **OAuth 2.0**: Social login integration (Google, GitHub)
- **Multi-Factor Authentication**: TOTP and SMS-based 2FA
- **Role-Based Access Control**: Granular permissions system
- **Session Management**: Secure session handling with Redis

</details>

<details>
<summary><strong>Data Protection</strong></summary>

- **Encryption at Rest**: AES-256 database encryption
- **Encryption in Transit**: TLS 1.3 for all communications
- **API Security**: Rate limiting, request validation, CORS policies
- **Input Sanitization**: XSS prevention and SQL injection protection
- **Audit Logging**: Comprehensive security event logging

</details>

<details>
<summary><strong>Infrastructure Security</strong></summary>

- **Container Security**: Non-root users, minimal base images
- **Network Segmentation**: Private subnets and security groups
- **Secrets Management**: HashiCorp Vault integration
- **Vulnerability Scanning**: Automated dependency and container scanning
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.

</details>

## Testing Strategy

### Comprehensive Test Coverage

<table>
<tr>
<td width="33%">

**Unit Tests**
- **Frontend**: Vitest + React Testing Library
- **Backend**: Jest + Supertest
- **ML Service**: pytest + unittest

Target: >90% code coverage

</td>
<td width="33%">

**Integration Tests**
- API endpoint testing
- Database integration tests
- ML model validation
- WebSocket connection tests

Target: >80% integration coverage

</td>
<td width="34%">

**E2E Tests**
- **Playwright** for cross-browser testing
- User workflow automation
- Performance regression testing
- Visual regression testing

Target: Critical user paths covered

</td>
</tr>
</table>

### Test Execution

```bash
# Web (Next.js) — unit tests
npm run test:web

# Web — watch mode while developing
npm run test:watch

# Static analysis
npm run lint
npm run type-check

# Production build (catches build-time-only errors)
npm run build

# ML service tests
cd ml && python -m pytest tests -q
# or, from the repo root:
npm run test:ml
```

Together these are the launch verification suite defined in `task.md`, and they
are precisely what the `Web CI` and `ML CI` jobs run on every pull request.

### CI/CD Pipeline

`.github/workflows/ci.yml` is the only workflow. It runs four jobs:

| Job | Steps |
|---|---|
| **Web CI** | `npm ci` → `npm run lint` → `npm run type-check` → `npm run test:web` → `npm run build` |
| **ML CI** | install `ml/requirements.txt` → `python -m pytest tests -q` (working dir `ml/`) |
| **Security Scan** | Trivy vulnerability scan → upload SARIF to the GitHub Security tab |
| **Deployment Readiness** | verify deployment files and that `.env.example` exists |

There is no coverage upload and no E2E job; don't infer either from this README.
`npm run test:coverage` and `npm run test:e2e` do not exist as scripts.

## Deployment

### Deployment Strategies

<details>
<summary><strong>Development Deployment</strong></summary>

**Docker Compose (Local)**
```bash
# Start all services
docker-compose up --build

# Scale specific services
docker-compose up --scale ml-service=3

# View service logs
docker-compose logs -f backend
```

**Environment-specific configs**
- Development: Hot reloading, debug logs, test databases
- Staging: Production-like with synthetic data
- Production: Optimized builds, monitoring, real data

</details>

</details>

<details>
<summary><strong>Cloud Deployment</strong></summary>

**Vercel Deployment (Frontend)**
1. **Root Directory**: Set "Root Directory" to `frontend` in Vercel project settings.
2. **Build Command**: `npm run build` (or `vite build`)
3. **Output Directory**: `dist`
4. **Environment Variables**: Add `legacy-peer-deps=true` (handled automatically by `.npmrc`).

**Free Tier Platforms**
- **Frontend**: Vercel, Netlify, GitHub Pages
- **Backend**: Railway, Render, Fly.io
- **Database**: Supabase, PlanetScale, Neon
- **Cache**: Upstash Redis, Redis Cloud

**Production Platforms**
- **Kubernetes**: AWS EKS, Google GKE, Azure AKS
- **Serverless**: AWS Lambda, Google Cloud Functions
- **Platform-as-a-Service**: Heroku, Railway (paid tiers)

</details>

<details>
<summary><strong>Infrastructure as Code</strong></summary>

**Terraform Configuration**
```hcl
# AWS EKS Cluster Example
resource "aws_eks_cluster" "roneira_cluster" {
  name     = "roneira-ai-hifi"
  role_arn = aws_iam_role.cluster_role.arn
  version  = "1.28"

  vpc_config {
    subnet_ids = [
      aws_subnet.private_1.id,
      aws_subnet.private_2.id
    ]
    endpoint_private_access = true
    endpoint_public_access  = true
  }
}
```

**Kubernetes Manifests**
```yaml
# ML Service Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ml-service
  template:
    metadata:
      labels:
        app: ml-service
    spec:
      containers:
      - name: ml-service
        image: roneira/ml-service:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

</details>

### Production Infrastructure Status

#### Current Live Deployment

All services are deployed and operational on their respective platforms:

| Service | Platform | Status | URL | Cost |
|---------|----------|--------|-----|------|
| **Frontend** | Vercel | 🟢 Live | [roneira-ai-hifi.vercel.app](https://roneira-ai-hifi.vercel.app) | Free |
| **Backend** | Render | 🟢 Live | [roneira-ai-hifi.onrender.com](https://roneira-ai-hifi.onrender.com) | Free |
| **ML Service** | Render | 🟢 Live | [roneira-ai-hifi-ml-service.onrender.com](https://roneira-ai-hifi-ml-service.onrender.com) | Free |

#### Service Health Endpoints

```bash
# Backend Health Check
curl https://roneira-ai-hifi.onrender.com/health
# Response: {"success":true,"ml_service_status":"healthy","service_status":"healthy"...}

# ML Service Health Check  
curl https://roneira-ai-hifi-ml-service.onrender.com/health
# Response: {"status":"healthy","models_cached":0,"timestamp":"2025-12-07T07:53:08.956957"}
```

#### ML Service Migration (December 2025)

**Migration: Railway → Render**

The ML service was successfully migrated from Railway to Render on December 7, 2025, due to Railway trial expiration.

**Migration Details:**
- **Previous Platform**: Railway (Trial expired)
- **New Platform**: Render (Free tier, Docker-based)
- **Migration Date**: December 7, 2025
- **Downtime**: < 5 minutes during environment variable update
- **Service URL Change**: 
  - Old: `https://roneira-ai-hifi-production.up.railway.app`
  - New: `https://roneira-ai-hifi-ml-service.onrender.com`

**Configuration:**
```yaml
# ML Service Render Configuration
Service Name: Roneira-AI-HIFI-ML-Service
Runtime: Docker
Root Directory: ml-service
Branch: main
Environment Variables:
  PORT: 5000
  FLASK_ENV: production
Instance Type: Free (512 MB RAM, 0.1 CPU)
```

**Post-Migration Updates:**
1. ✅ Backend `ML_SERVICE_URL` environment variable updated
2. ✅ Backend service auto-redeployed with new configuration
3. ✅ Health checks verified on both services
4. ✅ Frontend continues to communicate via backend proxy

#### Service Architecture Flow

```
┌─────────────────┐
│   Frontend      │
│   (Vercel)      │
│                 │
│ React + Vite    │
└────────┬────────┘
         │ HTTPS
         │ VITE_API_URL
         ▼
┌─────────────────┐
│   Backend       │
│   (Render)      │
│                 │
│ Node.js/Express │
└────────┬────────┘
         │ HTTPS
         │ ML_SERVICE_URL
         ▼
┌─────────────────┐
│  ML Service     │
│   (Render)      │
│                 │
│ Python/Flask    │
└─────────────────┘
```

#### Free Tier Limitations

⚠️ **Important**: Both Render services (Backend & ML) use free tier with the following characteristics:

- **Cold Start Delay**: Services spin down after 15 minutes of inactivity
- **Wake-up Time**: First request after spin-down may take 50+ seconds
- **Recommended**: Consider upgrading to paid tier for production workloads requiring consistent response times

**Workaround**: Implement a cron job to ping health endpoints every 10 minutes to keep services warm.



### Deployment Checklist

- [ ] **Environment Variables**: All secrets configured
- [ ] **Database Migrations**: Schema updates applied
- [ ] **SSL Certificates**: TLS configured and validated
- [ ] **Monitoring**: Observability stack deployed
- [ ] **Backup Strategy**: Data backup procedures in place
- [ ] **Load Testing**: Performance validated under load
- [ ] **Security Scan**: Vulnerability assessment completed
- [ ] **Rollback Plan**: Deployment rollback procedure tested

## Contributing

We welcome contributions from the community! Please see our [Contributing Guide](CONTRIBUTING.md) for detailed information on:

- Development workflow and branching strategy
- Code style guidelines and linting rules
- Testing requirements and coverage goals
- Pull request process and review guidelines
- Commit message conventions

### Quick Contribution Steps

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Tools

```bash
# Setup development environment
npm run dev:setup

# Run linting and formatting
npm run lint:fix
npm run format

# Pre-commit hooks
npm run pre-commit

# Generate documentation
npm run docs:generate
```

## Monitoring & Observability

### Monitoring Stack

<table>
<tr>
<td width="50%">

**Application Monitoring**
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Jaeger**: Distributed tracing
- **Sentry**: Error tracking and performance monitoring

**Infrastructure Monitoring**
- **Node Exporter**: System metrics
- **cAdvisor**: Container metrics
- **Alertmanager**: Alert routing and notification
- **Uptime monitoring**: Service availability checks

</td>
<td width="50%">

**Key Metrics Dashboard**

```typescript
const keyMetrics = {
  api: {
    response_time: 'p99 < 500ms',
    error_rate: '< 0.1%',
    throughput: '1000 rps',
    availability: '99.9%'
  },
  ml: {
    prediction_latency: 'p95 < 2s',
    model_accuracy: '> 80%',
    cache_hit_rate: '> 90%',
    training_time: '< 10min'
  },
  database: {
    connection_pool: '< 80% utilized',
    query_time: 'p95 < 100ms',
    replication_lag: '< 1s'
  }
};
```

</td>
</tr>
</table>

### Alert Configuration

```yaml
# Prometheus Alert Rules
groups:
- name: roneira-alerts
  rules:
  - alert: HighAPILatency
    expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High API latency detected"
      
  - alert: MLServiceDown
    expr: up{job="ml-service"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "ML service is down"
```

## Roadmap

### Short-term Goals (Q1 2024)

- [ ] **Enhanced Authentication**: OAuth2 provider integration
- [ ] **Real-time Notifications**: WebSocket-based alert system
- [ ] **Mobile Optimization**: Progressive Web App improvements
- [ ] **API v2**: GraphQL endpoint with subscriptions
- [ ] **Advanced Charting**: Technical analysis drawing tools

### Medium-term Goals (Q2-Q3 2024)

- [ ] **Multi-asset Support**: Cryptocurrency and forex integration
- [ ] **Social Trading**: Copy trading and signal sharing
- [ ] **Advanced ML Models**: Transformer-based price prediction
- [ ] **Risk Management**: Advanced portfolio optimization
- [ ] **White-label Solution**: Customizable branding options

### Long-term Vision (Q4 2024+)

- [ ] **Institutional Features**: Prime brokerage integration
- [ ] **Regulatory Compliance**: MiFID II and SEC reporting
- [ ] **AI Assistant**: Natural language query interface
- [ ] **Blockchain Integration**: DeFi protocol connectivity
- [ ] **Global Expansion**: Multi-currency and localization

### Community Requests

Based on community feedback, we're prioritizing:
1. **Dark mode improvements** (In Progress)
2. **Mobile app development** (Planning)
3. **Integration with TradingView** (Research)
4. **Options trading support** (Research)

## Support & Community

### Getting Help

<table>
<tr>
<td width="50%">

**Documentation & Resources**
- [📚 Architecture](ARCHITECTURE.md)
- [🚀 Deployment](DEPLOYMENT.md)
- [🤝 Contributing](CONTRIBUTING.md)
- [🔗 ML API reference](http://localhost:8000/docs) — FastAPI auto-docs, served by the running `ml/` service

</td>
<td width="50%">

**Community & Support**
- [💬 Discord Community](https://discord.gg/roneira)
- [🐛 Issue Tracker](https://github.com/aaron-seq/Roneira-AI-HIFI/issues)
- [💡 Feature Requests](https://github.com/aaron-seq/Roneira-AI-HIFI/discussions)
- [📧 Enterprise Support](mailto:enterprise@roneira.com)

</td>
</tr>
</table>

### FAQ

<details>
<summary><strong>How accurate are the ML predictions?</strong></summary>

Our models achieve 80-85% directional accuracy on 1-day predictions and 70-75% on 5-day predictions. Accuracy varies by market conditions and asset volatility. Always combine predictions with fundamental analysis and risk management.

</details>

<details>
<summary><strong>What data sources are used?</strong></summary>

We integrate with multiple data providers including Alpha Vantage, Yahoo Finance, and Quandl for market data. News sentiment is sourced from various financial news APIs. All data is validated and normalized before processing.

</details>

<details>
<summary><strong>Is the platform suitable for institutional use?</strong></summary>

Yes, the platform is designed with institutional-grade features including API rate limiting, audit logging, compliance reporting, and enterprise authentication options. Contact us for custom institutional solutions.

</details>

<details>
<summary><strong>How do I contribute new ML models?</strong></summary>

Follow our [ML Model Contribution Guide](docs/ml-models.md). We welcome contributions of new algorithms, especially in the areas of sentiment analysis, alternative data integration, and risk modeling.

</details>

### Performance Benchmarks

```
Environment: AWS c5.4xlarge, PostgreSQL RDS, Redis ElastiCache

API Response Times:
├── Single prediction: 150ms (p99)
├── Batch prediction: 800ms (p99)
├── Portfolio analysis: 300ms (p99)
└── Market data: 50ms (p99)

ML Model Performance:
├── Feature engineering: 2.1s (10 tickers)
├── Prediction generation: 450ms (single ticker)
├── Model training: 8.5min (RandomForest)
└── Cache hit rate: 94.2%

Database Performance:
├── Connection pool utilization: 68%
├── Query response time: 45ms (p95)
├── Concurrent connections: 150
└── Replication lag: 0.3s
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-party Licenses

This project uses several open-source libraries. Key dependencies include:

- **React**: MIT License
- **Node.js**: MIT License  
- **Python/Flask**: BSD License
- **PostgreSQL**: PostgreSQL License
- **Redis**: BSD License
- **TensorFlow**: Apache 2.0 License

For a complete list of dependencies and their licenses, see [LICENSES.md](LICENSES.md).

---

<div align="center">

**Built with precision engineering for institutional-grade financial intelligence**

[🚀 **Get Started**](#quick-start) • [🌟 **Star on GitHub**](https://github.com/aaron-seq/Roneira-AI-HIFI)

*© 2026 Roneira Enterprises AI. All rights reserved.*

</div>
