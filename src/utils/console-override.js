// src/utils/console-override.js
const { logger } = require('../logger');
const RequestContext = require('../context');
const { formatJsonLog } = require('./formatters');
const { SERVICE_NAME } = require('../config/constants');

const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
};

const formatArgs = (...args) => {
    // Format all arguments into a message string
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return '[Complex Object]';
            }
        }
        return String(arg);
    }).join(' ');

    // Get current request context
    const context = RequestContext.get();
    
    // Create base log object with context
    const logData = {
        message,
        requestId: context?.requestId,
        traceId: context?.traceId,
        spanId: context?.spanId,
        service: SERVICE_NAME(),
        logSource: 'console',
        log_override: true
    };

    // Format the log object using the same formatter as request logs
    return formatJsonLog(logData);
};

const enableConsoleOverride = () => {
    console.log = (...args) => {
        logger.info(formatArgs(...args));
    };

    console.warn = (...args) => {
        logger.warn(formatArgs(...args));
    };

    console.error = (...args) => {
        logger.error(formatArgs(...args));
    };
};

const disableConsoleOverride = () => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
};

module.exports = {
    enableConsoleOverride,
    disableConsoleOverride
};