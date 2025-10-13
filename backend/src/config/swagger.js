import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { config } from './environment.js';
import { logger } from '../utils/logger.js';

/**
 * Swagger API documentation configuration
 * Automatically generates interactive API documentation
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Roneira Financial Intelligence API',
      version: '2.0.0',
      description: `
        **Advanced AI-powered Financial Intelligence Platform**
        
        This API provides sophisticated stock price predictions, portfolio analysis, and financial intelligence services powered by machine learning algorithms.
        
        ## Features
        - 🤖 AI-driven stock price predictions
        - 📊 Portfolio performance analysis
        - 🔄 Batch processing for multiple stocks
        - ⚡ High-performance caching
        - 🛡️ Enterprise-grade security
        - 📈 Real-time market data integration
        
        ## Getting Started
        1. Check the health endpoint to ensure the service is running
        2. Use the predict endpoint for individual stock predictions
        3. Use batch-predict for multiple stocks simultaneously
        
        ## Rate Limiting
        - 100 requests per 15 minutes per IP address
        - Batch predictions limited to 10 stocks per request
        
        ## Error Handling
        All endpoints return structured error responses with:
        - Error tracking ID for support
        - Detailed error messages
        - Suggested actions
      `,
      contact: {
        name: 'Aaron Sequeira',
        email: 'aaronsequeira12@gmail.com',
        url: 'https://github.com/aaron-seq/Roneira-AI-HIFI'
      },
      license: {
        name: 'MIT',
        url: 'https://github.com/aaron-seq/Roneira-AI-HIFI/blob/main/LICENSE'
      }
    },
    servers: [
      {
        url: config.server.isDevelopment ? `http://localhost:${config.server.port}` : 'https://your-production-domain.com',
        description: config.server.isDevelopment ? 'Development Server' : 'Production Server'
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check and system monitoring endpoints'
      },
      {
        name: 'Stock Predictions',
        description: 'AI-powered stock price prediction services'
      },
      {
        name: 'Portfolio',
        description: 'Portfolio analysis and management tools'
      }
    ],
    components: {
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'ISO 8601 timestamp of the response'
            },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)'
            },
            message: {
              type: 'string',
              description: 'Optional message providing additional context'
            },
            metadata: {
              type: 'object',
              description: 'Optional metadata (pagination, errors, etc.)'
            }
          },
          required: ['success', 'timestamp']
        },
        StockPrediction: {
          type: 'object',
          properties: {
            ticker: {
              type: 'string',
              description: 'Stock ticker symbol',
              example: 'AAPL'
            },
            companyName: {
              type: 'string',
              description: 'Company name',
              example: 'Apple Inc.'
            },
            currentPrice: {
              type: 'number',
              format: 'float',
              description: 'Current stock price',
              example: 150.25
            },
            predictedPrice: {
              type: 'number',
              format: 'float',
              description: 'Predicted stock price',
              example: 155.80
            },
            priceChange: {
              type: 'number',
              format: 'float',
              description: 'Absolute price change',
              example: 5.55
            },
            percentageChange: {
              type: 'number',
              format: 'float',
              description: 'Percentage price change',
              example: 3.69
            },
            predictionDays: {
              type: 'integer',
              description: 'Number of days predicted',
              example: 1
            },
            modelAccuracy: {
              type: 'number',
              format: 'float',
              description: 'Model accuracy score',
              example: 0.85
            },
            sentiment: {
              type: 'object',
              description: 'Market sentiment analysis'
            },
            technicalIndicators: {
              type: 'object',
              description: 'Technical analysis indicators'
            }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Validation failed'
            },
            metadata: {
              type: 'object',
              properties: {
                errors: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  example: ['Ticker symbol is required', 'Ticker symbol must be between 1 and 10 characters']
                }
              }
            }
          }
        },
        ServiceError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'The ML prediction service is currently unavailable'
            },
            metadata: {
              type: 'object',
              properties: {
                trackingId: {
                  type: 'string',
                  example: 'err_abc123_def456'
                },
                temporary: {
                  type: 'boolean',
                  example: true
                },
                retryAfter: {
                  type: 'string',
                  example: '30 seconds'
                }
              }
            }
          }
        }
      },
      parameters: {
        TickerParam: {
          name: 'ticker',
          in: 'path',
          required: true,
          description: 'Stock ticker symbol (1-10 characters)',
          schema: {
            type: 'string',
            pattern: '^[A-Za-z0-9.-]+$',
            minLength: 1,
            maxLength: 10
          },
          example: 'AAPL'
        }
      }
    }
  },
  apis: [
    './src/routes/*.js', // Path to route files with JSDoc comments
    './src/server.js'
  ]
};

// Generate swagger specification
const swaggerSpecification = swaggerJsdoc(swaggerOptions);

/**
 * Setup Swagger UI middleware
 * @param {Express} app - Express application instance
 */
export function setupSwagger(app) {
  if (!config.api.enableSwagger) {
    logger.info('Swagger documentation disabled');
    return;
  }

  const swaggerUiOptions = {
    explorer: true,
    swaggerOptions: {
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true
    },
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50 }
    `,
    customSiteTitle: 'Roneira Financial Intelligence API Documentation'
  };

  // Serve swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecification, swaggerUiOptions));
  
  // Serve raw swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecification);
  });

  logger.info('Swagger documentation available at /api-docs');
}