# Roneira AI HIFI - High-Impact Finance Intelligence (v2.0.0)

**Enhanced Financial Intelligence Platform with PDM Strategy Integration**

Advanced AI-powered financial analytics platform combining traditional machine learning with innovative Price-Volume Derivatives Momentum strategy for institutional momentum detection.

## Overview

Roneira AI HIFI is a sophisticated financial intelligence platform that integrates traditional ML models with a calculus-driven Price-Volume Derivatives Momentum (PDM) Strategy for capturing institutional momentum in equity markets.

### Key Features

- **Advanced ML Predictions**: LSTM and ensemble models for accurate stock price forecasting
- **PDM Strategy Engine**: Calculus-based momentum detection using derivatives of price and volume
- **Real-Time Analytics**: Live market data with 20+ technical indicators
- **Portfolio Intelligence**: Comprehensive portfolio management and performance tracking
- **Technical Analysis**: Professional-grade charting and pattern recognition
- **Risk Management**: Volatility-adjusted stop losses and position sizing
- **Modern Architecture**: Microservices with TypeScript, React, Python, and Docker

## PDM Strategy - Mathematical Framework

The Price-Volume Derivatives Momentum Strategy uses calculus to detect institutional trading activity:

### Core Derivatives

1. **df/dt (Price Velocity)** - Captures directional momentum with minimal lag
2. **d²f/dt² (Price Curvature)** - Detects acceleration/deceleration in trends  
3. **df/dV (Volume Sensitivity)** - Measures price responsiveness to volume changes

### Strategy Performance (Apr-Oct 2025)
- **Strategy Return**: +42.8%
- **NIFTY 50 Benchmark**: +7.1%
- **Outperformance**: +35.7%
- **Max Positions**: 25
- **Universe**: NIFTY 500 (liquidity filtered)

## Architecture

```
┌─────────────┐ ┌───────────────┐ ┌─────────────┐
│  Frontend   │ │   Backend     │ │ ML Service  │
│ (React TS)  │◄┤ (Node TS)   ├►│(Python/PDM) │
└─────────────┘ └───────────────┘ └─────────────┘
       │                │              │
┌──────────────────────────────────────────────┐
│ ┌───────────┐ ┌───────┐ ┌─────────────┐ │
│ │PostgreSQL │ │ Redis │ │   Nginx     │ │
│ └───────────┘ └───────┘ └─────────────┘ │
└──────────────────────────────────────────────┘
```

## Tech Stack

### Frontend
- **React 18+** with TypeScript and Vite
- **Tailwind CSS** for styling
- **Zustand** for state management
- **TanStack Query** for data fetching
- **Recharts** for data visualization
- **Framer Motion** for animations

### Backend
- **Node.js 18+** with Express and TypeScript
- **Helmet** and **CORS** for security
- **Rate limiting** and validation
- **Zod** for request validation

### ML Service
- **Python 3.11+** with Flask
- **scikit-learn** and **pandas** for ML
- **yfinance** for market data
- **Custom PDM Strategy Engine**

### Infrastructure
- **Docker & Docker Compose**
- **PostgreSQL** for data storage
- **Redis** for caching
- **Nginx** for reverse proxy (production)

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose (recommended)
- Git

### 1. Clone and Setup

```bash
git clone https://github.com/aaron-seq/Roneira-AI-HIFI.git
cd Roneira-AI-HIFI

# Copy environment files
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env
```

### 2. Environment Configuration

Edit the `.env` files with your configuration:

```bash
# Backend (.env)
DATABASE_URL=postgresql://user:password@localhost:5432/roneira_hifi
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
ML_SERVICE_URL=http://localhost:5000

# ML Service (.env)
FLASK_ENV=development
HUGGING_FACE_API_KEY=your_hf_key_here
REDIS_URL=redis://localhost:6379

# Frontend (.env.local)
VITE_API_BASE_URL=http://localhost:3001
VITE_APP_NAME=Roneira AI HIFI
VITE_APP_VERSION=2.0.0
```

### 3. Run with Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Service URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- ML Service: http://localhost:5000
- Health Check: http://localhost:3001/health

### 4. Manual Setup (Development)

```bash
# Install dependencies
npm run install-all

# Start PostgreSQL and Redis
# (using Docker or local installation)

# Start ML Service
cd ml-service
pip install -r requirements.txt
flask run --port=5000

# Start Backend (new terminal)
cd backend
npm run dev

# Start Frontend (new terminal)
cd frontend
npm run dev
```

## API Endpoints

### Stock Prediction
```http
POST /api/predict
{
  "ticker": "AAPL",
  "days": 1,
  "include_pdm": true
}
```

### PDM Strategy
```http
GET /api/pdm_scan          # Scan for PDM opportunities
POST /api/pdm_backtest     # Run strategy backtest
```

### Portfolio Management
```http
GET /api/portfolio/:userId     # Get portfolio
POST /api/portfolio/:userId/update  # Update holdings
```

## Testing

### Run All Tests
```bash
# Frontend tests
cd frontend && npm run test

# Backend tests
cd backend && npm run test && npm run test:integration

# ML Service tests
cd ml-service && pytest --cov=app --cov-report=html
```

### Test Coverage
- Frontend: Jest + React Testing Library
- Backend: Jest + Supertest
- ML Service: pytest + coverage

## Deployment

### Free Hosting Options

**Frontend (Vercel)**
```bash
cd frontend
npm run build
vercel --prod
```

**Backend & ML (Railway/Render)**
- Deploy `/backend` and `/ml-service` separately
- Configure environment variables
- Update frontend API URLs

**Database**
- PostgreSQL: Supabase, ElephantSQL
- Redis: Upstash, Redis Cloud

### Production Configuration

```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Project Structure

```
Roneira-AI-HIFI/
├── frontend/           # React TypeScript frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── store/         # Zustand state management
│   │   ├── services/      # API services
│   │   └── config/        # Configuration
│   └── package.json
├── backend/            # Node.js TypeScript backend
│   ├── server.ts       # Main server file
│   ├── tsconfig.json   # TypeScript config
│   └── package.json
├── ml-service/         # Python ML service
│   ├── app.py          # Main Flask app
│   ├── pdm_strategy_engine.py  # PDM strategy
│   ├── test_ml_service.py      # Tests
│   └── requirements.txt
├── docker-compose.yml  # Docker services
└── README.md
```

## Recent Updates (v2.0.0)

### New Features
- **PDM Strategy Engine**: Calculus-based momentum detection
- **Enhanced UI/UX**: Modern React components with TypeScript
- **Microservices Architecture**: Separate frontend, backend, and ML services
- **Comprehensive Testing**: Unit, integration, and coverage testing
- **Production Ready**: Docker, monitoring, and deployment configurations

### Technical Improvements
- **Humanized Code**: Clear variable and function names throughout
- **Type Safety**: Full TypeScript implementation
- **Error Handling**: Comprehensive error boundaries and validation
- **Performance**: Optimized queries, caching, and lazy loading
- **Security**: Helmet, CORS, rate limiting, and input validation

### Removed
- Unused Jupyter notebooks
- Duplicate Docker files
- Legacy code and dependencies
- Outdated configuration files

## Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Commit** your changes: `git commit -am 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/your-feature`
5. **Submit** a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow existing code style and naming conventions
- Add tests for new features
- Update documentation as needed
- Use clear, technical comments without emojis

## Documentation

- **API Documentation**: Available at `/api/docs` when running
- **Component Storybook**: `npm run storybook` (planned)
- **Technical Docs**: See `/docs` folder (planned)

## Security

- **Authentication**: JWT tokens with refresh mechanism
- **Rate Limiting**: API request throttling
- **Input Validation**: Zod schema validation
- **CORS Configuration**: Controlled cross-origin requests
- **Environment Variables**: Secure configuration management

## Performance

- **Caching**: Redis for ML predictions and market data
- **Database**: Optimized PostgreSQL queries with indexes
- **Frontend**: React Query for efficient data fetching
- **Compression**: Gzip compression for API responses
- **CDN Ready**: Static asset optimization

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Wizzer Trading Platform** for PDM strategy inspiration
- **Yahoo Finance** for market data API
- **Hugging Face** for sentiment analysis models
- **Open Source Community** for amazing libraries and tools

## Contact & Support

**Author**: Aaron Sequeira  
**Email**: aaronsequeira12@gmail.com  
**Company**: Roneira AI  
**LinkedIn**: [Connect](https://linkedin.com/in/aaron-sequeira)  

For enterprise support, custom analytics, or business partnerships, please reach out to the Roneira AI team.

---

**Built for the financial community | Roneira AI HIFI v2.0.0**