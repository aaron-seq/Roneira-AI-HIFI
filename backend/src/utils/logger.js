import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFileName = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFileName);

/**
 * Enhanced logging utility with multiple transports and formatting
 * Provides structured logging for better debugging and monitoring
 */
class ApplicationLogger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';
    this.logDirectory = process.env.LOG_DIRECTORY || path.join(process.cwd(), 'logs');
    
    this.initializeLogger();
  }

  initializeLogger() {
    // Custom format for structured logging
    const structuredFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, service = 'backend' }) => {
        const logEntry = {
          timestamp,
          level: level.toUpperCase(),
          service,
          message,
        };
        
        if (stack) {
          logEntry.stack = stack;
        }
        
        return JSON.stringify(logEntry);
      })
    );

    // Console format for development
    const developmentConsoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level}]: ${message}`;
      })
    );

    const transportsList = [
      new winston.transports.Console({
        level: this.logLevel,
        format: process.env.NODE_ENV === 'production' ? structuredFormat : developmentConsoleFormat
      })
    ];

    // Add file transports in production or when explicitly enabled
    if (this.enableFileLogging || process.env.NODE_ENV === 'production') {
      transportsList.push(
        new winston.transports.File({
          filename: path.join(this.logDirectory, 'application-error.log'),
          level: 'error',
          format: structuredFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(this.logDirectory, 'application-combined.log'),
          format: structuredFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );
    }

    this.winstonLogger = winston.createLogger({
      level: this.logLevel,
      format: structuredFormat,
      defaultMeta: {
        service: 'roneira-backend'
      },
      transports: transportsList,
      exitOnError: false
    });
  }

  /**
   * Log info level message
   */
  info(message, metadata = {}) {
    this.winstonLogger.info(message, metadata);
  }

  /**
   * Log warning level message
   */
  warn(message, metadata = {}) {
    this.winstonLogger.warn(message, metadata);
  }

  /**
   * Log error level message
   */
  error(message, errorDetails = null, metadata = {}) {
    const logData = { ...metadata };
    
    if (errorDetails) {
      logData.error = {
        message: errorDetails.message,
        stack: errorDetails.stack,
        name: errorDetails.name
      };
    }
    
    this.winstonLogger.error(message, logData);
  }

  /**
   * Log debug level message
   */
  debug(message, metadata = {}) {
    this.winstonLogger.debug(message, metadata);
  }
}

// Create and export singleton logger instance
export const logger = new ApplicationLogger();