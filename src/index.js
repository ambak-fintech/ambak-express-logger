// src/index.js
const { logger } = require('./logger');
const { requestLoggerMiddleware, errorLoggerMiddleware } = require('./middleware');
const RequestContext = require('./context');
const { SEVERITYLEVEL, CONTENT_LIMITS, setConfigOverrides } = require('./config/constants');
const { sanitizeHeaders, sanitizeBody } = require('./utils/sanitizers');
const { enableConsoleOverride, disableConsoleOverride } = require('./utils/console-override');

const configure = (options = {}) => {
  setConfigOverrides(options);
  return {
    logger,
    requestLoggerMiddleware,
    errorLoggerMiddleware,
    RequestContext,
    enableConsoleOverride,
    disableConsoleOverride
  };
};

module.exports = {
  configure,
  logger,
  requestLoggerMiddleware,
  errorLoggerMiddleware,
  RequestContext,
  SEVERITYLEVEL,
  CONTENT_LIMITS,
  sanitizeHeaders,
  sanitizeBody,
  enableConsoleOverride,
  disableConsoleOverride
};