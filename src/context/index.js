// src/context/index.js
const asyncLocalStorage = require('./async-context');
const TraceContext = require('./trace-context');
const crypto = require('crypto');

/**
 * RequestContext class for maintaining request-scoped context
 */
class RequestContext {
    constructor() {
        this.requestId = '';
        this.traceContext = null;
        this.startTime = process.hrtime();
        this.metadata = new Map();
    }

    /**
     * Get current request context from async storage
     * @returns {RequestContext}
     */
    static get() {
        return asyncLocalStorage.getStore() || new RequestContext();
    }

    /**
     * Create a new context from request
     * @param {Express.Request} req - Express request object
     * @returns {RequestContext}
     */
    static create(req) {
        const context = new RequestContext();
        const { getConfigValue } = require('../config/constants');
    
        // Generate or get request ID
        context.requestId = req.headers['x-request-id'] || 
                          crypto.randomBytes(16).toString('hex').slice(0, 8);
    
        // Check LOG_TYPE to determine which trace format to use
        const logType = getConfigValue('LOG_TYPE', 'gcp');
        
        // Try AWS X-Amzn-Trace-Id first if LOG_TYPE is 'aws'
        let traceContext;
        if (logType === 'aws') {
            if (req.headers['x-amzn-trace-id']) {
                traceContext = TraceContext.parseAwsTraceId(req.headers['x-amzn-trace-id']);
            } else {
                // Generate new AWS-formatted trace ID if no header present
                traceContext = TraceContext.generateNew(true);
            }
        } else if (req.headers['x-cloud-trace-context']) {
            traceContext = TraceContext.parseCloudTrace(req.headers['x-cloud-trace-context']);
        } else if (req.headers.traceparent) {
            traceContext = TraceContext.parseTraceParent(req.headers.traceparent);
        } else {
            traceContext = TraceContext.generateNew(false);
        }
    
        // Parse tracestate if present
        traceContext.parseTraceState(req.headers.tracestate);
        context.traceContext = traceContext;
    
        return context;
    }

    // Get trace ID for logging
    get traceId() {
        return this.traceContext?.traceId || '';
    }

    // Get span ID for logging
    get spanId() {
        return this.traceContext?.spanId || '';
    }

    /**
     * Get elapsed time in milliseconds
     * @returns {string}
     */
    getElapsedMs() {
        const diff = process.hrtime(this.startTime);
        return (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    }

    /**
     * Add trace headers to outgoing requests
     * @param {object} headers - Headers object to add trace context to
     * @returns {object}
     */
    addTraceHeaders(headers = {}) {
        const { getConfigValue } = require('../config/constants');
        const logType = getConfigValue('LOG_TYPE', 'gcp');

        if (this.traceContext) {
            if (logType === 'aws') {
                headers['x-amzn-trace-id'] = this.traceContext.toAwsTraceId();
            } else {
                headers.traceparent = this.traceContext.toTraceParent();

                const tracestate = this.traceContext.toTraceState();
                if (tracestate) {
                    headers.tracestate = tracestate;
                }

                headers['x-cloud-trace-context'] = this.traceContext.toCloudTrace();
            }
        }

        headers['x-request-id'] = this.requestId;

        return headers;
    }

    /**
     * Create context for outgoing requests
     * @returns {RequestContext}
     */
    createChildContext() {
        const childContext = new RequestContext();
        childContext.requestId = this.requestId;
        
        if (this.traceContext) {
            childContext.traceContext = this.traceContext.createChildSpan();
        } else {
            childContext.traceContext = TraceContext.generateNew();
        }
    
        return childContext;
    }

    /**
     * Set custom metadata
     * @param {string} key 
     * @param {any} value 
     */
    setMetadata(key, value) {
        this.metadata.set(key, value);
    }

    /**
     * Get custom metadata
     * @param {string} key 
     * @returns {any}
     */
    getMetadata(key) {
        return this.metadata.get(key);
    }
}

module.exports = RequestContext;