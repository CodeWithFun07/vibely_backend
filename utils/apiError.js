class ApiError extends Error {
  constructor(statusCode, message, stack) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
