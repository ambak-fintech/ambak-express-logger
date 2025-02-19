// src/middleware/error-logger.js
const { logger: baseLogger } = require('../logger');
const RequestContext = require('../context');
const { serializers } = require('../utils/serializers');
const { formatJsonLog } = require('../utils/formatters');

/**
 * Create error logger middleware with custom options
 * @param {object} options - Configuration options
 * @returns {function} Express error middleware
 */
const createErrorLogger = (options = {}) => {
    const {
        logger = baseLogger,
        logStackTrace = true,
        includeBody = false,
        getErrorContext,
        baseLogData = {},
        ...otherOptions
    } = options;

    return (err, req, res, next) => {
        const context = RequestContext.get();
        
        // Build error metadata
        const errorMetadata = {
            msg: err.message || 'Request error',
            error: {
                type: err.type || err.name,
                message: err.message,
                code: err.code,
                statusCode: err.status || err.statusCode || 500,
                ...(logStackTrace && { stack: err.stack }),
                ...(err.details && { details: err.details }),
            },
            requestId: context?.requestId,
            traceId: context?.traceId,
            spanId: context?.spanId,
            path: req.path,
            method: req.method,
            logSource: 'exception',
            statusCode: err.status || err.statusCode || 500,
            ...baseLogData
        };

        // Include request body if configured
        if (includeBody && req.body) {
            errorMetadata.requestBody = serializers.req(req).request_payload;
        }

        // Get additional error context if provided
        if (getErrorContext) {
            const additionalContext = getErrorContext(err, req);
            Object.assign(errorMetadata, additionalContext);
        }

        // Format and log the error
        const formattedError = formatJsonLog(errorMetadata);
        logger.error(formattedError);

        next(err);
    };
};

// Export default middleware and factory function
module.exports = {
    errorLoggerMiddleware: createErrorLogger(),
    createErrorLogger
};