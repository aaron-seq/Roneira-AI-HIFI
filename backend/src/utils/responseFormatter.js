/**
 * Standardized API response formatter
 * Ensures consistent response structure across all endpoints
 */

/**
 * Creates a standardized API response object
 * @param {*} data - The response data
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - Optional message describing the response
 * @param {object} metadata - Optional additional metadata
 * @returns {object} Formatted API response
 */
export function createApiResponse(data = null, success = true, message = null, metadata = {}) {
  const response = {
    success,
    timestamp: new Date().toISOString(),
    data,
  };

  if (message) {
    response.message = message;
  }

  if (Object.keys(metadata).length > 0) {
    response.metadata = metadata;
  }

  return response;
}

/**
 * Creates a success response
 * @param {*} data - The response data
 * @param {string} message - Optional success message
 * @param {object} metadata - Optional additional metadata
 * @returns {object} Formatted success response
 */
export function createSuccessResponse(data, message = null, metadata = {}) {
  return createApiResponse(data, true, message, metadata);
}

/**
 * Creates an error response
 * @param {string} message - Error message
 * @param {object} errorDetails - Optional error details
 * @param {*} data - Optional error data
 * @returns {object} Formatted error response
 */
export function createErrorResponse(message, errorDetails = {}, data = null) {
  return createApiResponse(data, false, message, errorDetails);
}

/**
 * Creates a paginated response
 * @param {Array} items - Array of items
 * @param {number} totalCount - Total number of items
 * @param {number} page - Current page number
 * @param {number} pageSize - Number of items per page
 * @param {object} additionalMetadata - Optional additional metadata
 * @returns {object} Formatted paginated response
 */
export function createPaginatedResponse(items, totalCount, page, pageSize, additionalMetadata = {}) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return createApiResponse(items, true, null, {
    pagination: {
      currentPage: page,
      pageSize,
      totalPages,
      totalCount,
      hasNextPage,
      hasPreviousPage,
    },
    ...additionalMetadata,
  });
}