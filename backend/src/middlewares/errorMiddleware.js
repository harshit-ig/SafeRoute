/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // If status code is already set, use it, otherwise default to 500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  console.error(`Error: ${err.message}`);
  console.error(`Stack: ${err.stack}`);
  
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

/**
 * Async handler to avoid try-catch blocks in route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler }; 