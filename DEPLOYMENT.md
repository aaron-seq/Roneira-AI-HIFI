# 🚀 Free Deployment Guide - Roneira AI HIFI

Deploy your AI stock prediction platform using completely **FREE** hosting services.

## 📋 Prerequisites
- GitHub account
- [Vercel](https://vercel.com) account (Frontend)
- [Render](https://render.com) account (Backend)
- [Render](https://render.com) account (Backend & ML Service)
## 🏗️ Deployment Order

### 1️⃣ Deploy ML Service (Render)
1. **Sign up**: [render.com](https://render.com)2. **New Project** → **Deploy from GitHub**
3. **Select**: `aaronseq12/Roneira-AI-HIFI`
4. **Root Directory**: `ml-service`
5. **Environment Variables**:
   ```
   PORT=5000
   FLASK_ENV=production
   ```
6. **Save the URL**: `https://your-ml-service.onrender.com`
### 2️⃣ Deploy Backend (Render)

1. **Sign up**: [render.com](https://render.com)
2. **New** → **Web Service**
3. **Connect GitHub** → Select repo
4. **Root Directory**: `backend`
5. **Build Command**: `npm install`
6. **Start Command**: `npm start`
7. **Environment Variables**:
   ```
   NODE_ENV=production
   ML_SERVICE_URL=https://your-ml-service.onrender.com   CORS_ORIGIN=*
   ```
8. **Save the URL**: `https://your-backend.onrender.com`

### 3️⃣ Deploy Frontend (Vercel)

1. **Sign up**: [vercel.com](https://vercel.com)
2. **New Project** → **Import from GitHub**
3. **Root Directory**: `frontend`
4. **Environment Variables**:
   ```
   VITE_API_URL=https://your-backend.onrender.com
   ```
5. **Deploy!**

## ✅ Test Your Deployment

```bash
# Test health endpoints
curl https://your-backend.onrender.com/health
curl https://your-ml-service.onrender.com/health
# Test prediction
curl -X POST https://your-backend.onrender.com/api/predict \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL"}'
```

## 🔧 Environment Variables Summary

| Service | Variable | Value |
|---------|----------|-------|
| ML Service | `PORT` | `5000` |
| ML Service | `FLASK_ENV` | `production` |
| Backend | `NODE_ENV` | `production` |
| Backend | `ML_SERVICE_URL` | Your Render ML URL || Backend | `CORS_ORIGIN` | `*` (or specific domain) |
| Frontend | `VITE_API_URL` | Your Render backend URL |

## 💰 Cost: $0/month

- **Vercel**: 100GB bandwidth (free)
- **Render**: 750 hours/month (free) - Backend + ML Service
## 🆘 Troubleshooting

- **Cold starts**: First request may take 30 seconds
- **CORS errors**: Check `CORS_ORIGIN` variable
- **Build failures**: Verify `package.json` dependencies

---

🎉 **Success!** Your AI platform is now live and free!
