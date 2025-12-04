//src/logger/base-logger.js
const pino = require('pino');
const RequestContext = require('../context');
const { LOG_LEVELS, LOG_LEVEL, SERVICE_NAME } = require('../config/constants');
const transport = require('./transport');
const { formatters } = require('../utils/formatters');
const { serializers } = require('../utils/serializers');

/**
 * Create a contextual logger that automatically includes request context
 */
const createContextualLogger = (baseLogger) => {
    return new Proxy(baseLogger, {
        get: (target, property) => {
            if (typeof target[property] === 'function') {
                return (...args) => {
                    const context = RequestContext.get();
                    const logData = typeof args[0] === 'string' 
                        ? { message: args[0], ...args[1] || {} }
                        : args[0];
                    
                    const enrichedData = {
                        ...logData,
                        requestId: context?.requestId,
                        traceId: context?.traceId,
                        spanId: context?.spanId,
                        service: SERVICE_NAME(),
                        LOG_TYPE: logData.LOG_TYPE || require('../config/constants').getConfigValue('LOG_TYPE', 'gcp')
                    };

                    return target[property](enrichedData);
                };
            }
            return target[property];
        }
    });
};

/**
 * Create logger options
 */
const createLoggerOptions = (customOptions = {}) => {
    // Check LOG_TYPE - for AWS, don't use Pino's timestamp (we add our own 'timestamp' field)
    const { getConfigValue } = require('../config/constants');
    const logType = getConfigValue('LOG_TYPE', 'gcp');
    const timestamp = logType === 'aws' ? false : pino.stdTimeFunctions.isoTime;
    
    return {
        level: LOG_LEVEL,
        transport,
        messageKey: 'message',
        timestamp,
        formatters,
        serializers,
        ...customOptions
    };
};

/**
 * Create a new logger instance
 */
const createLogger = (options = {}) => {
    const loggerOptions = createLoggerOptions(options);
    const baseLogger = pino(loggerOptions);
    return createContextualLogger(baseLogger);
};

// Create default logger instance
const logger = createLogger();

// Setup global error handlers
process.on('uncaughtException', (err) => {
    logger.fatal({
        msg: 'Uncaught exception',
        error: err
    });
    // process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.error({
        msg: 'Unhandled rejection',
        error: err
    });
});

module.exports = {
    logger,
    createLogger
};