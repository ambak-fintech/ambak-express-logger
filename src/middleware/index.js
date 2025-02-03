//src/middleware/index.js
const { 
  requestLoggerMiddleware,
  createRequestLogger
} = require('./request-logger');

const {
  errorLoggerMiddleware,
  createErrorLogger
} = require('./error-logger');

module.exports = {
  requestLoggerMiddleware,
  createRequestLogger,
  errorLoggerMiddleware,
  createErrorLogger
};