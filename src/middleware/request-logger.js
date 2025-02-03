// src/middleware/request-logger.js
const { logger: baseLogger } = require('../logger');
const asyncLocalStorage = require('../context/async-context');
const RequestContext = require('../context');
const { serializers } = require('../utils/serializers');
const { sanitizeHeaders, sanitizeBody } = require('../utils/sanitizers');
const { formatJsonLog } = require('../utils/formatters');
const { shouldExcludePath, SERVICE_NAME } = require('../config/constants');

class RequestMetrics {
    constructor(startTime) {
        this.startTime = startTime;
    }

    getResponseTime() {
        const diff = process.hrtime(this.startTime);
        return parseFloat((diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2));
    }

    getLatencyObject(responseTime) {
        return {
            seconds: Math.floor(responseTime / 1000),
            nanos: (responseTime % 1000) * 1e6
        };
    }
}

class HttpLogger {
    static getLogLevel(statusCode) {
        if (!statusCode) return 'info';
        const category = Math.floor(statusCode / 100);
        return category === 5 ? 'error' : 
               category === 4 ? 'warn' : 
               'info';
    }

    static createBaseContext(req, options = {}) {
        const context = RequestContext.create(req);
        const baseLogData = {
            requestId: context.requestId,
            traceId: context.traceId,
            spanId: context.spanId,
            service: SERVICE_NAME(),
            ...options.baseLogData
        };
        return { context, baseLogData };
    }

    static createRequestLog(req, baseLogData, options = {}) {
        const serializedReq = serializers.req(req);

        return formatJsonLog({
            ...baseLogData,
            type: 'request',
            ...serializedReq,
            target_service: options.getTargetService?.(req) || 
                          req.path.split('/')[1] || 'unknown',
            httpRequest: this.createHttpRequestObject(req)
        });
    }

    static createHttpRequestObject(req, res = null, responseTime = null) {
        const requestObject = {
            requestMethod: req.method,
            requestUrl: req.originalUrl || req.url,
            protocol: req.protocol,
            remoteIp: req.ip || req.connection?.remoteAddress,
            requestSize: req.headers['content-length'],
            userAgent: req.headers['user-agent'],
            referer: req.headers.referer || req.headers.referrer
        };

        const payload = req.parsedBody || req.body || 
                       (req.httpRequest && req.httpRequest.requestBody);

        if (payload) {
            requestObject.requestBody = sanitizeBody(payload);
        }

        if (res) {
            requestObject.status = res.statusCode;
            requestObject.responseSize = res.getHeader('content-length');
            
            if (responseTime) {
                const metrics = new RequestMetrics(process.hrtime());
                requestObject.latency = metrics.getLatencyObject(responseTime);
            }
        }

        return requestObject;
    }

    static createResponseLog(req, res, responseTime, baseLogData, responseBody, options = {}) {
        return formatJsonLog({
            ...baseLogData,
            type: 'response',
            response: {
                statusCode: res.statusCode,
                response_time_ms: responseTime,
                headers: sanitizeHeaders(res.getHeaders()),
                body: responseBody && options.logResponseBody ? 
                      sanitizeBody(responseBody.toString('utf8')) : undefined,
            },
            httpRequest: this.createHttpRequestObject(req, res, responseTime)
        });
    }

    static setTraceHeaders(res, context) {
        if (!context.traceContext) return;

        const headers = {
            traceparent: context.traceContext.toTraceParent(),
            'x-cloud-trace-context': context.traceContext.toCloudTrace()
        };

        const tracestate = context.traceContext.toTraceState();
        if (tracestate) {
            headers.tracestate = tracestate;
        }

        Object.entries(headers).forEach(([key, value]) => {
            if (value) res.setHeader(key, value);
        });
    }
}

class ResponseInterceptor {
    constructor(res, req, baseLogData, options = {}) {
        this.res = res;
        this.req = req;
        this.baseLogData = baseLogData;
        this.options = options;
        this.chunks = [];
        this.metrics = new RequestMetrics(process.hrtime());
        
        this.writeInterceptor = this.writeInterceptor.bind(this);
        this.endInterceptor = this.endInterceptor.bind(this);
    }

    setup() {
        const originalWrite = this.res.write.bind(this.res);
        const originalEnd = this.res.end.bind(this.res);

        this._originalWrite = originalWrite;
        this._originalEnd = originalEnd;

        this.res.write = this.writeInterceptor;
        this.res.end = this.endInterceptor;

        return this;
    }

    writeInterceptor(chunk, encoding, callback) {
        if (chunk && this.options.logResponseBody) {
            this.chunks.push(Buffer.from(chunk));
        }
        return this._originalWrite(chunk, encoding, callback);
    }

    endInterceptor(chunk, encoding, callback) {
        if (chunk && this.options.logResponseBody) {
            this.chunks.push(Buffer.from(chunk));
        }

        const responseTime = this.metrics.getResponseTime();
        const responseBody = this.chunks.length > 0 ? Buffer.concat(this.chunks) : null;
        
        const level = HttpLogger.getLogLevel(this.res.statusCode);
        const responseLog = HttpLogger.createResponseLog(
            this.req, 
            this.res, 
            responseTime, 
            this.baseLogData,
            responseBody,
            this.options
        );

        this.req.log[level](responseLog);

        // Cleanup
        this.res.write = this._originalWrite;
        this.res.end = this._originalEnd;
        
        return this._originalEnd(chunk, encoding, callback);
    }
}

/**
 * Create request logger middleware with custom options
 * @param {object} options - Configuration options
 * @returns {function} Express middleware
 */
const createRequestLogger = (options = {}) => {
    const {
        logger = baseLogger,
        excludePaths = [],
        logResponseBody = true,
        getTargetService,
        baseLogData = {},
        ...otherOptions
    } = options;

    return (req, res, next) => {
        if (shouldExcludePath(req.path, excludePaths)) {
            return next();
        }

        const { context, baseLogData: contextLogData } = HttpLogger.createBaseContext(req, {
            baseLogData,
            ...otherOptions
        });
        
        return asyncLocalStorage.run(context, () => {
            try {
                // Attach logger to request
                req.log = logger.child(contextLogData);

                // Log initial request
                const requestLog = HttpLogger.createRequestLog(req, contextLogData, {
                    getTargetService,
                    ...otherOptions
                });
                req.log.info(requestLog);

                // Set trace headers
                HttpLogger.setTraceHeaders(res, context);

                // Setup response interceptor
                new ResponseInterceptor(res, req, contextLogData, {
                    logResponseBody,
                    ...otherOptions
                }).setup();

                next();
            } catch (error) {
                logger.error({
                    ...contextLogData,
                    msg: 'Error in request logger middleware',
                    error: serializers.err(error)
                });
                next(error);
            }
        });
    };
};

// Export default middleware and factory function
module.exports = {
    requestLoggerMiddleware: createRequestLogger(),
    createRequestLogger
};