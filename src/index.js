// src/index.js
const { logger, createLogger } = require('./logger');
const { requestLoggerMiddleware, errorLoggerMiddleware } = require('./middleware');
const { createRequestLogger } = require('./middleware/request-logger');
const { createErrorLogger } = require('./middleware/error-logger');
const RequestContext = require('./context');
const { SEVERITYLEVEL, CONTENT_LIMITS, setConfigOverrides, getConfigValue } = require('./config/constants');
const { sanitizeHeaders, sanitizeBody } = require('./utils/sanitizers');
const { enableConsoleOverride, disableConsoleOverride } = require('./utils/console-override');

const toRawMessage = (payload) => {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch (_e) {
    return String(payload);
  }
};

const createRawLogger = () => {
  const rawLogger = {
    trace: (...args) => console.debug(...args.map(toRawMessage)),
    debug: (...args) => console.debug(...args.map(toRawMessage)),
    info: (...args) => console.log(...args.map(toRawMessage)),
    warn: (...args) => console.warn(...args.map(toRawMessage)),
    error: (...args) => console.error(...args.map(toRawMessage)),
    fatal: (...args) => console.error(...args.map(toRawMessage)),
    child: () => rawLogger,
  };
  return rawLogger;
};

const configure = (options = {}) => {
  setConfigOverrides(options);
  const logRegister = Number(getConfigValue('LOG_REGISTER', '5'));
  const isRawMode = !Number.isNaN(logRegister) && logRegister === 1;
  const isRegisterTwoMode = !Number.isNaN(logRegister) && logRegister === 2;

  if (isRawMode) {
    const rawLogger = createRawLogger();
    return {
      logger: rawLogger,
      requestLoggerMiddleware: (req, res, next) => next(),
      errorLoggerMiddleware: (error, req, res, next) => next(error),
      RequestContext,
      enableConsoleOverride: () => {},
      disableConsoleOverride,
    };
  }

  const configuredLogger = createLogger();
  const configuredRequestLoggerMiddleware = createRequestLogger({
    logger: configuredLogger,
    omitRequestPayloadInResponse: isRegisterTwoMode,
  });
  const configuredErrorLoggerMiddleware = isRegisterTwoMode
    ? (error, req, res, next) => next(error)
    : createErrorLogger({ logger: configuredLogger });
  return {
    logger: configuredLogger,
    requestLoggerMiddleware: configuredRequestLoggerMiddleware,
    errorLoggerMiddleware: configuredErrorLoggerMiddleware,
    RequestContext,
    enableConsoleOverride: () => enableConsoleOverride(configuredLogger),
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