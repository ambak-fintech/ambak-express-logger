//src/logger/base-logger.js
const pino = require('pino');
const RequestContext = require('../context');
const { LOG_LEVELS, LOG_LEVEL, SERVICE_NAME, getConfigValue, resolveLogLevel, resolveLogRegister } = require('../config/constants');
const transport = require('./transport');
const { formatters } = require('../utils/formatters');
const { serializers } = require('../utils/serializers');

/**
 * Create a contextual logger that automatically includes request context
 */
const LOG_METHODS = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

const createContextualLogger = (baseLogger) => {
    return new Proxy(baseLogger, {
        get: (target, property) => {
            // Only intercept the 6 log-level methods
            if (LOG_METHODS.has(property)) {
                return (...args) => {
                    const context = RequestContext.get();
                    const logData = typeof args[0] === 'string'
                        ? { message: args[0], ...(args[1] || {}) }
                        : { ...(args[0] || {}) };

                    const enrichedData = {
                        ...logData,
                        requestId: context?.requestId,
                        traceId: context?.traceId,
                        spanId: context?.spanId,
                        service: SERVICE_NAME(),
                        LOG_TYPE: logData.LOG_TYPE || getConfigValue('LOG_TYPE', 'gcp')
                    };

                    return target[property](enrichedData);
                };
            }

            // Wrap child() so the returned child logger is also contextual
            if (property === 'child') {
                return (bindings, ...rest) => {
                    const childLogger = target.child(bindings, ...rest);
                    return createContextualLogger(childLogger);
                };
            }

            // Everything else passes through untouched
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
    const configuredLogLevel = resolveLogLevel(getConfigValue('LOG_LEVEL', LOG_LEVEL || 'info'));
    const effectiveLogLevel = resolveLogRegister(getConfigValue('LOG_REGISTER', '5'), configuredLogLevel);
    
    return {
        level: effectiveLogLevel,
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

const HANDLER_REGISTERED = Symbol.for('logger.processHandlersRegistered');

const registerProcessHandlers = (loggerInstance) => {
    if (global[HANDLER_REGISTERED]) return;
    global[HANDLER_REGISTERED] = true;

    process.on('uncaughtException', (err) => {
        loggerInstance.fatal({
            msg: 'Uncaught exception',
            error: err
        });
        // Give pino time to flush, then exit
        setTimeout(() => process.exit(1), 1000);
    });

    process.on('unhandledRejection', (err) => {
        loggerInstance.error({
            msg: 'Unhandled rejection',
            error: err
        });
    });
};

// Create default logger instance
const logger = createLogger();
registerProcessHandlers(logger);

module.exports = {
    logger,
    createLogger
};