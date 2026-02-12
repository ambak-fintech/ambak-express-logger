// src/utils/console-override.js
const { stringify } = require('safe-stable-stringify');
const { logger: defaultLogger } = require('../logger');
const RequestContext = require('../context');
const { formatJsonLog } = require('./formatters');
const { serializers } = require('./serializers');
const { SERVICE_NAME } = require('../config/constants');

const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
};

// Flag to prevent infinite recursion during serialization
let isSerializing = false;

const safeStringify = (arg) => {
    if (arg === null || arg === undefined) return String(arg);
    if (typeof arg !== 'object') return String(arg);

    // Prevent infinite recursion: if we're already serializing and hit an Error,
    // use a simple string representation instead of calling serializers.err()
    if (isSerializing && arg instanceof Error) {
        return `[Error: ${arg.message || 'Unknown error'}]`;
    }

    // Route known complex objects through your existing serializers
    if (arg instanceof Error) {
        isSerializing = true;
        try {
            return stringify(serializers.err(arg));
        } finally {
            isSerializing = false;
        }
    }
    if (arg.method && arg.headers && (arg.url || arg.originalUrl)) {
        return stringify(serializers.req(arg));
    }
    if (arg.statusCode !== undefined && typeof arg.getHeaders === 'function') {
        return stringify(serializers.res(arg));
    }

    // safe-stable-stringify handles circular refs, throwing getters,
    // BigInt, Proxy objects, etc.
    return stringify(arg);
};

const formatArgs = (...args) => {
    const message = args.map(safeStringify).join(' ');

    const context = RequestContext.get();

    const logData = {
        message,
        requestId: context?.requestId,
        traceId: context?.traceId,
        spanId: context?.spanId,
        service: SERVICE_NAME(),
        logSource: 'console',
        log_override: true
    };

    return formatJsonLog(logData);
};

const enableConsoleOverride = (activeLogger = defaultLogger) => {
    console.log = (...args) => activeLogger.info(formatArgs(...args));
    console.warn = (...args) => activeLogger.warn(formatArgs(...args));
    console.error = (...args) => {
        const formatted = formatArgs(...args);
        // Enrich with error details if a single Error was passed
        if (args.length === 1 && args[0] instanceof Error) {
            const err = args[0];
            Object.assign(formatted, {
                error: { name: err.name, message: err.message, stack: err.stack }
            });
        }
        activeLogger.error(formatted);
    };
};

const disableConsoleOverride = () => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
};

module.exports = { enableConsoleOverride, disableConsoleOverride };