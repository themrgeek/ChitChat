/**
 * Standardized API response utilities
 */

class APIResponse {
  /**
   * Create a success response
   * @param {*} data - Response data
   * @param {Object} metadata - Additional metadata
   * @param {number} statusCode - HTTP status code
   * @returns {Object} Formatted response
   */
  static success(data = null, metadata = {}, statusCode = 200) {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      },
      statusCode
    };
  }

  /**
   * Create an error response
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} details - Additional error details
   * @returns {Object} Formatted error response
   */
  static error(message, statusCode = 500, details = {}) {
    return {
      success: false,
      error: message,
      details,
      metadata: {
        timestamp: new Date().toISOString()
      },
      statusCode
    };
  }

  /**
   * Create a validation error response
   * @param {Object} validationErrors - Validation errors object
   * @returns {Object} Formatted validation error response
   */
  static validationError(validationErrors) {
    return this.error('Validation failed', 400, {
      type: 'validation_error',
      fields: validationErrors
    });
  }

  /**
   * Create an authentication error response
   * @param {string} message - Specific auth error message
   * @returns {Object} Formatted auth error response
   */
  static authError(message = 'Authentication required') {
    return this.error(message, 401, {
      type: 'authentication_error'
    });
  }

  /**
   * Create a forbidden error response
   * @param {string} message - Specific forbidden error message
   * @returns {Object} Formatted forbidden error response
   */
  static forbidden(message = 'Access denied') {
    return this.error(message, 403, {
      type: 'authorization_error'
    });
  }

  /**
   * Create a not found error response
   * @param {string} resource - Resource type that was not found
   * @returns {Object} Formatted not found error response
   */
  static notFound(resource = 'Resource') {
    return this.error(`${resource} not found`, 404, {
      type: 'not_found_error'
    });
  }

  /**
   * Send response to Express res object
   * @param {Object} res - Express response object
   * @param {Object} response - Formatted response object
   */
  static send(res, response) {
    const { statusCode, ...responseBody } = response;
    return res.status(statusCode).json(responseBody);
  }
}

/**
 * Service result wrapper for internal service communication
 */
class ServiceResult {
  constructor(success = false, data = null, error = null, message = '') {
    this.success = success;
    this.data = data;
    this.error = error;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static success(data, message = '') {
    return new ServiceResult(true, data, null, message);
  }

  static failure(error, message = '', data = null) {
    return new ServiceResult(false, data, error, message);
  }

  /**
   * Convert to API response format
   * @returns {Object} API response
   */
  toAPIResponse() {
    if (this.success) {
      return APIResponse.success(this.data, { message: this.message });
    } else {
      return APIResponse.error(this.message || this.error?.message || 'Service error');
    }
  }
}

module.exports = {
  APIResponse,
  ServiceResult
};
