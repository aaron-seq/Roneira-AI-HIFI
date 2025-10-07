# Roneira AI HIFI – High-Impact Finance Intelligence

Roneira AI HIFI is an advanced, AI-powered finance analytics platform designed to drive smarter investment decisions, portfolio intelligence, and real-time financial insights for businesses and individuals alike.

---

## Key Features

- **AI-Enhanced Stock Price Prediction:**  
  State-of-the-art machine learning models (LSTM, ensemble, sentiment) for accurate market forecasting  
- **Comprehensive Portfolio Management:**  
  Performance analytics, risk scoring, rebalancing, and benchmarking against global indices  
- **Real-Time Analytics Dashboard:**  
  Live data streaming, 20+ technical indicators, and news sentiment integration  
- **Enterprise-Grade Security & Auth:**  
  JWT authentication, CORS controls, role-based access, API key management  
- **Modern UI/UX:**  
  Sleek React interface with dark mode, mobile-first design, and interactive visualizations  
- **Scalable Architecture:**  
  Separate Node.js backend, Python ML service, cloud databases, Redis caching  
- **DevOps Ready:**  
  Docker, Docker Compose, Kubernetes, Prometheus monitoring, Grafana dashboards  
- **Cloud-First Deployment:**  
  Optimized for Vercel (frontend), Railway/Render (backend), and managed database/cloud services

---

## System Architecture

```

    ┌─────────────┐      ┌───────────────┐      ┌─────────────┐
    │  Frontend   │<────>│   Backend     │<────>│ ML Service  │
    │  (React)    │      │ (Node/Express)│      │ (Python/Flask)
    └─────────────┘      └───────────────┘      └─────────────┘
           │                   │                     │
     ┌──────────────┐    ┌────────────┐       ┌─────────────┐
     │ PostgreSQL   │    │  Redis     │       │   Nginx     │
     └──────────────┘    └────────────┘       └─────────────┘
    
```
---

## Tech Stack

- **Frontend:** React 18+, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query, Framer Motion
- **Backend:** Node.js 18+, Express, TypeScript, Prisma ORM, PostgreSQL, Redis, JWT, Socket.io, Bull
- **ML Service:** Python 3.11+, Flask, TensorFlow, PyTorch, scikit-learn, pandas, NumPy
- **DevOps:** Docker, Docker Compose, Kubernetes, Nginx, Prometheus, Grafana, Sentry

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (recommended)

### 1. Clone and Setup

```

git clone https://github.com/aaronseq12/Portofolio-and-Stock-Price-Predictor.git
cd Portofolio-and-Stock-Price-Predictor

cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env

```
> **Edit all `.env` files with your database credentials, API keys, email, and secrets.**

### 2. Run with Docker (Recommended)

```

docker-compose up -d
docker-compose logs -f

```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:3001](http://localhost:3001)
- ML Service: [http://localhost:5000](http://localhost:5000)

---

## Cloud Deployment

**Frontend:**  
Deploy `frontend/` to [Vercel](https://vercel.com), set environment variables using the Vercel dashboard.

**Backend & ML:**  
Deploy `/backend` and `/ml-service` to Railway, Render, or Fly.io for persistent Node.js/Python hosting.

**Database/Redis:**  
Use managed cloud services (e.g., Supabase/ElephantSQL for PostgreSQL, Upstash for Redis).

**Connecting Services:**  
Update your frontend’s `.env.local` and backend/ML `.env` files with the deployed URLs and credentials.

---

## Security by Design

- JWT authentication and refresh tokens
- Rate limiting and brute-force protection
- Robust input validation and Prisma ORM for SQL injection protection
- CORS configuration, encrypted secrets, and API key management

---

## Monitoring & Observability

- Health checks for every service
- Real-time Prometheus metrics and Grafana dashboards
- Integrated logging and error tracking with Sentry

---

## Testing

**Frontend:**  
`cd frontend && yarn test`

**Backend:**  
`cd backend && yarn test && yarn test:integration`

**ML Service:**  
`cd ml-service && pytest`

---

## API Documentation

- **Swagger/OpenAPI:**  
  - DEV: `http://localhost:3001/api-docs`
  - PROD: `https://your-domain.com/api-docs`

---

## 🤝 Contributing

1. Fork this repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push and open a Pull Request

---

## 📄 License

MIT License ([LICENSE](./LICENSE))

---

## Enterprise Support & Contact

For custom analytics, business integration, white-label deployment, or technical support,  
reach out to the Roneira AI HIFI team.

---

**Build finance intelligence that works for you—fast, secure, and AI-powered with Roneira AI HIFI.**
```

