#!/bin/bash

# 🚀 Roneira AI HIFI - Quick Deployment Script
# This script helps you deploy the application to free services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "🚀 RONEIRA AI HIFI - DEPLOYMENT WIZARD"
    echo "=========================================="
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    # Check if git is installed
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install git first."
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --is-inside-work-tree &> /dev/null; then
        print_error "This is not a git repository. Please run from your project root."
        exit 1
    fi
    
    print_step "Prerequisites check completed"
}

setup_environment_files() {
    echo -e "${BLUE}Setting up environment files...${NC}"
    
    # Frontend environment
    if [ ! -f "frontend/.env.local" ]; then
        cat > frontend/.env.local << EOF
# Frontend Environment Variables
# Update these with your deployed service URLs

# API URLs (Update after backend deployment)
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ML_API_URL=http://localhost:8000

# Feature flags
REACT_APP_ENABLE_REALTIME=true
REACT_APP_ENABLE_NOTIFICATIONS=true

# Optional: Analytics
REACT_APP_GA_TRACKING_ID=
EOF
        print_step "Created frontend/.env.local"
    else
        print_warning "frontend/.env.local already exists"
    fi
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cat > backend/.env << EOF
# Backend Environment Variables
# Update these with your actual service credentials

# Port
PORT=5000

# Database (Update with Supabase URL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/roneira_db

# ML Service URL (Update after ML service deployment)
ML_SERVICE_URL=http://localhost:8000

# JWT Secret (Generate a secure secret)
JWT_SECRET=your-super-secret-jwt-key-change-this

# API Keys (Optional)
ALPHA_VANTAGE_API_KEY=demo

# CORS Origins (Update with your frontend URL)
ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
EOF
        print_step "Created backend/.env"
    else
        print_warning "backend/.env already exists"
    fi
    
    # ML Service environment
    if [ ! -f "ml-service/.env" ]; then
        cat > ml-service/.env << EOF
# ML Service Environment Variables

# Port
PORT=8000

# Optional: Hugging Face API for better sentiment analysis
# Get free API key from https://huggingface.co/settings/tokens
HUGGING_FACE_API_KEY=

# Optional: Alpha Vantage API (5 calls/min free)
# Get free API key from https://www.alphavantage.co/support/#api-key
ALPHA_VANTAGE_API_KEY=demo

# Flask settings
FLASK_ENV=production
EOF
        print_step "Created ml-service/.env"
    else
        print_warning "ml-service/.env already exists"
    fi
}

create_railway_configs() {
    echo -e "${BLUE}Creating Railway deployment configs...${NC}"
    
    # Railway config for ML service
    if [ ! -f "ml-service/railway.toml" ]; then
        cat > ml-service/railway.toml << EOF
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 enhanced_app:app"
restartPolicyType = "always"

[env]
PORT = 5000
FLASK_ENV = "production"
EOF
        print_step "Created ml-service/railway.toml"
    fi
    
    # Railway config for backend
    if [ ! -f "backend/railway.toml" ]; then
        cat > backend/railway.toml << EOF
[build]
builder = "herokuish"

[deploy]
startCommand = "npm start"
restartPolicyType = "always"

[env]
PORT = 5000
NODE_ENV = "production"
EOF
        print_step "Created backend/railway.toml"
    fi
}

create_vercel_config() {
    echo -e "${BLUE}Creating Vercel deployment config...${NC}"
    
    if [ ! -f "frontend/vercel.json" ]; then
        cat > frontend/vercel.json << EOF
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-Requested-With, Content-Type, Authorization"
        }
      ]
    }
  ]
}
EOF
        print_step "Created frontend/vercel.json"
    fi
}

show_deployment_instructions() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "🎯 DEPLOYMENT INSTRUCTIONS"
    echo "=========================================="
    echo -e "${NC}"
    
    echo -e "${GREEN}1. DATABASE (Supabase - FREE)${NC}"
    echo "   • Go to https://supabase.com"
    echo "   • Create new project"
    echo "   • Run the SQL schema from deployment/railway-deploy.md"
    echo "   • Copy the DATABASE_URL to your backend/.env"
    echo ""
    
    echo -e "${GREEN}2. ML SERVICE (Railway - FREE)${NC}"
    echo "   • Go to https://railway.app"
    echo "   • New Project → Deploy from GitHub"
    echo "   • Select your repository"
    echo "   • Set Root Directory: ml-service"
    echo "   • Copy the ML service URL to backend/.env"
    echo ""
    
    echo -e "${GREEN}3. BACKEND (Railway - FREE)${NC}"
    echo "   • Create another Railway service"
    echo "   • Set Root Directory: backend"
    echo "   • Add environment variables from backend/.env"
    echo "   • Copy the backend URL to frontend/.env.local"
    echo ""
    
    echo -e "${GREEN}4. FRONTEND (Vercel - FREE)${NC}"
    echo "   • Go to https://vercel.com"
    echo "   • New Project → Import Git Repository"
    echo "   • Set Root Directory: frontend"
    echo "   • Add environment variables from frontend/.env.local"
    echo ""
    
    echo -e "${GREEN}5. FREE ML APIs (Optional)${NC}"
    echo "   • Hugging Face: https://huggingface.co/settings/tokens"
    echo "   • Alpha Vantage: https://www.alphavantage.co/support/#api-key"
    echo ""
    
    echo -e "${YELLOW}📖 For detailed instructions, see: deployment/railway-deploy.md${NC}"
    echo ""
    
    echo -e "${BLUE}💡 Pro Tips:${NC}"
    echo "   • Deploy in order: Database → ML Service → Backend → Frontend"
    echo "   • Update environment variables after each deployment"
    echo "   • Test each service individually before moving to the next"
    echo "   • Use the health check endpoints to verify deployments"
    echo ""
}

commit_changes() {
    echo -e "${BLUE}Committing deployment files...${NC}"
    
    git add .
    git commit -m "Add deployment configurations and environment files" || print_warning "No changes to commit"
    
    print_step "Changes committed to git"
}

main() {
    print_header
    
    check_prerequisites
    setup_environment_files
    create_railway_configs
    create_vercel_config
    commit_changes
    show_deployment_instructions
    
    echo -e "${GREEN}"
    echo "=========================================="
    echo "✅ DEPLOYMENT SETUP COMPLETE!"
    echo "=========================================="
    echo -e "${NC}"
    echo "Your project is now ready for deployment to free services."
    echo "Follow the deployment instructions above to get your app live!"
    echo ""
    echo "Happy deploying! 🚀"
}

# Run the main function
main