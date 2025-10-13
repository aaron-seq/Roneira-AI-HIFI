import { logger } from './logger.js';

/**
 * Graceful shutdown utility for Express server
 * Ensures proper cleanup when the application terminates
 */
export function gracefulShutdown(server) {
  const shutdown = (signal) => {
    logger.info(`${signal} signal received, starting graceful shutdown`);
    
    // Set a timeout for forced shutdown
    const forceShutdownTimeout = setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000); // 30 seconds timeout

    // Close the server gracefully
    server.close((error) => {
      clearTimeout(forceShutdownTimeout);
      
      if (error) {
        logger.error('Error during server shutdown', error);
        process.exit(1);
      }
      
      logger.info('HTTP server closed successfully');
      
      // Perform additional cleanup tasks here
      performCleanupTasks()
        .then(() => {
          logger.info('Application shutdown completed successfully');
          process.exit(0);
        })
        .catch((cleanupError) => {
          logger.error('Error during cleanup', cleanupError);
          process.exit(1);
        });
    });
  };

  // Handle different termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon restart

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception - shutting down', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at Promise', {
      reason,
      promise
    });
    shutdown('UNHANDLED_REJECTION');
  });
}

/**
 * Perform cleanup tasks before shutdown
 * Add any cleanup logic here (database connections, cache cleanup, etc.)
 */
async function performCleanupTasks() {
  const cleanupTasks = [];
  
  // Add cleanup tasks here as needed
  // Example: close database connections, clear caches, etc.
  
  try {
    await Promise.all(cleanupTasks);
    logger.info('All cleanup tasks completed successfully');
  } catch (error) {
    logger.error('Error during cleanup tasks', error);
    throw error;
  }
}