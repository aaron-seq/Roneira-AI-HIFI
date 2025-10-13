import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';
import { config } from './config/environment.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { setupSwagger } from './config/swagger.js';
import stockPredictionRoutes from './routes/stockPrediction.js';
import healthRoutes from './routes/health.js';
import { gracefulShutdown } from './utils/gracefulShutdown.js';

const app = express();
const PORT = config.server.port;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// API documentation
setupSwagger(app);

// Health check routes (no rate limiting)
app.use('/health', healthRoutes);

// API routes
app.use('/api/v1', stockPredictionRoutes);

// Legacy API routes (for backward compatibility)
app.use('/api', stockPredictionRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Roneira Financial Intelligence Backend Server`);
  logger.info(`📡 Server running on port ${PORT}`);
  logger.info(`🔗 ML Service URL: ${config.mlService.url}`);
  logger.info(`🌐 CORS Origins: ${config.cors.allowedOrigins.join(', ')}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  logger.info(`🛡️  Security headers enabled`);
  logger.info(`⚡ Performance optimizations active`);
});

// Graceful shutdown handling
gracefulShutdown(server);

export default app;