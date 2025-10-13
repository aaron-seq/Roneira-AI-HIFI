/**
 * Async wrapper utility to handle async/await errors in Express routes
 * Eliminates the need for try-catch blocks in every route handler
 */

/**
 * Wraps an async function to catch any errors and pass them to Express error handler
 * @param {Function} asyncFunction - The async function to wrap
 * @returns {Function} Express middleware function
 */
export function asyncWrapper(asyncFunction) {
  return (request, response, next) => {
    Promise.resolve(asyncFunction(request, response, next))
      .catch(next);
  };
}

/**
 * Alternative async wrapper with additional error context
 * @param {Function} asyncFunction - The async function to wrap
 * @param {string} operationName - Name of the operation for logging
 * @returns {Function} Express middleware function
 */
export function asyncWrapperWithContext(asyncFunction, operationName = 'Unknown') {
  return (request, response, next) => {
    Promise.resolve(asyncFunction(request, response, next))
      .catch(error => {
        // Add context to the error
        error.operationName = operationName;
        error.requestId = request.id || 'unknown';
        error.timestamp = new Date().toISOString();
        next(error);
      });
  };
}