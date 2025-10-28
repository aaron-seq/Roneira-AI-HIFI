# Roneira AI HIFI — High-Impact Finance Intelligence Platform

Roneira AI HIFI is a production-grade financial analytics framework engineered for robust machine learning forecasting, advanced price-volume momentum analytics, and comprehensive portfolio intelligence in institutional or retail trading environments.

## Objectives
- Deliver reliable, reproducible market predictions using advanced ML and calculus-based analytics
- Maintain clear separation between user interface, API gateway, and ML inference logic for scalable deployments
- Ensure painless local, Docker, and cloud onboarding on free and paid hosting platforms

## Architecture
```
frontend (React + Vite + TS)
│ REST/HTTPS
▼
backend (Node.js + Express + TS)  ←→  ml-service (Flask, scikit-learn, pandas)
            │                                │
            ├─ PostgreSQL (portfolio, auth)  └─ Redis (market/cache)
```

### Core Services
- **Frontend**: React 18 + TypeScript, TanStack Query, TailwindCSS (Vite build)
- **API**: Express + TypeScript, Zod validation, Helmet/CORS, rate limiting
- **ML**: Flask, scikit-learn, pandas, yfinance, custom indicator engine
- **Data Plane**: PostgreSQL (OLTP), Redis (caching)
- **Operations**: Docker (multi-stage), GitHub Actions, Prometheus/Grafana (optional)

## Feature Set

### Machine Learning Predictions
- RandomForest-based regression with engineered technical features
- Model caching and cold-start mitigation for consistent response times
- Deterministic training seed and repeatable runs for backtesting validation

### PDM Strategy Analytics (Derivatives-Based)
- Price velocity (df/dt), curvature (d²f/dt²), and volume sensitivity (df/dV)
- Signal strength scoring, ATR-based stop levels, and confidence metrics
- Institutional momentum detection through calculus-driven analysis

### Technical Indicators
- SMA/EMA, RSI, MACD, Bollinger Bands via optimized, vectorized pipelines
- Custom implementations avoiding system-level compilation dependencies
- Batch processing capabilities for multiple ticker analysis

### Portfolio Intelligence
- Position CRUD operations with real-time portfolio valuation
- Performance metrics including drawdown analysis and volatility profiling
- Risk assessment with correlation matrices and position sizing algorithms

### Reliability & Operations
- Comprehensive health endpoints with dependency status checking
- Structured logging with configurable levels and request tracing
- Graceful shutdowns, backpressure handling, and circuit breaker patterns
- Container health checks, resource limits, and security hardening

## Environment URLs
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001  
- **ML Service**: http://localhost:5000
- **Health Checks**: /health on backend and ML service

## Getting Started

### Prerequisites
- Node.js >= 18
- Python >= 3.11
- Docker and Docker Compose (optional but recommended)

### Local Development Setup
1. **Clone and bootstrap**
   ```bash
   git clone https://github.com/aaron-seq/Roneira-AI-HIFI.git
   cd Roneira-AI-HIFI
   cp .env.example .env
   cp frontend/.env.example frontend/.env.local
   cp backend/.env.example backend/.env
   cp ml-service/.env.example ml-service/.env
   ```

2. **Install dependencies**
   ```bash
   cd frontend && npm ci
   cd ../backend && npm ci
   cd ../ml-service && pip install -r requirements.txt
   ```

3. **Run services (separate terminals)**
   ```bash
   # Terminal 1: Frontend
   cd frontend && npm run dev
   
   # Terminal 2: Backend
   cd backend && npm run dev
   
   # Terminal 3: ML Service
   cd ml-service && gunicorn --bind 0.0.0.0:5000 enhanced_app:app
   ```

### Docker Deployment (All Services)
```bash
# Development environment
docker-compose up --build

# Production environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Configuration

### Frontend Environment Variables
- `VITE_API_BASE_URL`: Backend API base URL (default: http://localhost:3001)
- `VITE_APP_NAME`: Application display name
- `VITE_APP_VERSION`: Version identifier for UI display

### Backend Environment Variables
- `PORT`: Server port (default: 3001)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis endpoint for caching
- `ML_SERVICE_URL`: ML service endpoint (e.g., http://ml-service:5000)
- `JWT_SECRET`: Secret key for JWT token signing

### ML Service Environment Variables
- `FLASK_ENV`: Environment mode (development|production)
- `HUGGING_FACE_API_KEY`: Optional API key for sentiment analysis models
- `GUNICORN_WORKERS`: Number of worker processes for production

## API Surface

### Prediction Endpoints
```bash
# Single ticker prediction
POST /api/predict
{
  "ticker": "AAPL",
  "days": 1,
  "include_pdm": true
}

# Batch predictions (max 10 tickers)
POST /api/batch_predict
{
  "tickers": ["AAPL", "GOOGL", "MSFT"]
}
```

### PDM Strategy Endpoints
```bash
# Scan for PDM opportunities
GET /api/pdm_scan

# Run strategy backtest
POST /api/pdm_backtest
{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

### Portfolio Management
```bash
# Get user portfolio
GET /api/portfolio/:userId

# Update portfolio positions
POST /api/portfolio/:userId/update
{
  "positions": [...]
}
```

## Performance Optimizations

### Frontend
- Code splitting via React.lazy for reduced initial bundle size
- React Query caching tuned for low-latency refetches and stale-while-revalidate
- Asset compression and prefetch hints for critical resources
- Service worker implementation for offline capability

### Backend
- Response compression middleware with configurable thresholds
- PostgreSQL connection pooling with optimized pool sizing
- Redis-backed rate limiting with sliding window algorithms
- Efficient JSON serialization and streaming for large responses

### ML Service
- Vectorized indicator computation using pandas and numpy operations
- Model caching with LRU eviction and selective retrain strategies
- Batch processing optimization for multiple ticker requests
- Memory-efficient feature engineering pipelines

## Security Implementation

### HTTP Security
- Helmet middleware for security headers (CSP, HSTS, X-Frame-Options)
- CORS configuration with strict origin allowlisting
- TLS termination at edge with certificate automation

### Authentication & Authorization
- JWT tokens with configurable expiration and refresh strategies
- bcrypt password hashing with adaptive cost factors
- Rate limiting with progressive backoff for brute force protection

### Input Validation
- Comprehensive request validation using Zod schemas
- SQL injection prevention through parameterized queries
- XSS protection via input sanitization and output encoding

### Container Security
- Non-root user execution in all containers
- Resource quotas and health check gates
- Network segmentation with isolated service communications

## Testing Strategy

### Frontend Testing
```bash
cd frontend
npm run test           # Unit tests with Vitest
npm run test:coverage  # Coverage reporting
npm run test:e2e       # End-to-end tests with Playwright
```

### Backend Testing
```bash
cd backend
npm run test                # Unit and integration tests
npm run test:watch         # Watch mode for development
npm run test:integration   # Integration tests with test database
```

### ML Service Testing
```bash
cd ml-service
pytest --cov=.                    # Unit tests with coverage
pytest --benchmark                # Performance benchmarks
python -m pytest tests/           # Full test suite
```

## Contributing

We welcome contributions that improve correctness, performance, and developer experience. Please follow the workflow below.

### Branching Strategy
- **main**: Protected branch, release-ready code
- **develop**: Integration branch for next release features
- **feature/**: Short-lived branches for single-purpose changes

### Pull Request Workflow
1. **Fork and Branch**: Create feature branch from main or develop
2. **Implement Changes**: Keep scope focused on one logical change per PR
3. **Add Tests**: Ensure new/changed behavior is covered by tests
4. **Run Quality Checks**: Execute linters, type-checkers, and test suites locally
5. **Update Documentation**: Update README or API docs for behavior changes
6. **Submit PR**: Provide clear description with motivation and context

### Code Style Guidelines

#### TypeScript (Frontend/Backend)
- Enable strict mode with explicit types at module boundaries
- Use descriptive, domain-relevant variable names (e.g., `priceVelocity`, `portfolioSnapshot`)
- Prefer pure functions where possible; isolate side effects
- Return typed error objects with actionable context

#### Python (ML Service)
- Follow PEP 8 with Black formatting
- Use type hints for function signatures and return values
- Implement comprehensive error handling with structured logging
- Optimize for vectorized operations using pandas/numpy

#### General Principles
- Functions should be small, composable, and testable
- Validate inputs at boundaries using Zod/pydantic patterns
- Include meaningful commit messages in imperative mood
- Reference issues using `Fixes #issue` or `Refs #issue`

### Review Guidelines
- Verify correctness through code inspection and test execution
- Discuss performance and complexity tradeoffs explicitly
- Suggest alternatives when rejecting changes
- Ensure backward compatibility or document breaking changes

## Detailed Maintainer Notes

### Recent Production Improvements
- PostCSS configuration added for TailwindCSS compilation
- Backend Dockerfile added for production containerization
- ML service Dockerfile updated with Python-based health checks
- TA-Lib replaced with pure Python libraries for free hosting compatibility
- CI/CD pipeline introduced for automated lint, tests, and builds
- Production Docker Compose override added with resource limits and networks

### Architecture Decisions
- Microservices separation for independent scaling and deployments
- React/TypeScript for UI reliability, Flask for ML ergonomics, PostgreSQL/Redis for data plane
- Defense-in-depth security with validation, auth, container hardening
- Multi-layer caching strategy with invalidation rules

## Roadmap

### Short Term
- Authentication flows (registration, login, refresh tokens)
- Portfolio persistence and reporting
- Interactive API documentation

### Medium Term
- Backtesting UI with parameter sweeping
- WebSocket streaming for live data
- Advanced risk and correlation analytics

### Long Term
- gRPC low-latency inference path
- Canary and blue/green deployment support
- Advanced ML ensembles and feature pipelines

## Deployment Platforms

### Free Tier Hosting
- Frontend: Vercel, Netlify
- Backend: Railway, Render
- ML Service: Railway, Render
- Database: Supabase, ElephantSQL; Redis: Upstash

### Production Hosting
- Orchestration: Kubernetes, Docker Swarm
- Cloud: AWS ECS, Google Cloud Run, Azure Container Instances
- Monitoring: Prometheus + Grafana, DataDog, New Relic

## License

MIT License - see LICENSE for full terms and conditions.

## Support

- Issues: GitHub Issues for bug reports and feature requests
- Discussions: GitHub Discussions for questions and community support
- Documentation: API documentation will be under `/docs`
- Enterprise: Contact for custom implementations and enterprise support

Built with precision engineering for institutional-grade financial intelligence.