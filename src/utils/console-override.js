// src/utils/console-override.js
const { logger } = require('../logger');

// Store original console methods
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
};

/**
 * Format multiple arguments into a single message
 * This handles cases like: console.log('User:', user, 'Action:', action)
 */
const formatArgs = (...args) => {
    return args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return '[Complex Object]';
            }
        }
        return String(arg);
    }).join(' ');
};

/**
 * Override console methods with logger
 */
const enableConsoleOverride = () => {
    // Override console.log -> logger.info
    console.log = (...args) => {
        logger.info(formatArgs(...args));
    };

    // Override console.warn -> logger.warn
    console.warn = (...args) => {
        logger.warn(formatArgs(...args));
    };

    // Override console.error -> logger.error
    console.error = (...args) => {
        logger.error(formatArgs(...args));
    };
};

/**
 * Restore original console methods if needed
 */
const disableConsoleOverride = () => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
};

module.exports = {
    enableConsoleOverride,
    disableConsoleOverride
};