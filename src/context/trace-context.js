// src/context/trace-context.js
const crypto = require('crypto');

/**
 * TraceContext class for handling distributed tracing
 * Supports both W3C Trace Context and Google Cloud Trace formats
 */
class TraceContext {
    constructor() {
        this.version = '00';
        this.traceId = '';
        this.spanId = '';
        this.traceFlags = '01';  // Sampling enabled by default
        this.traceState = new Map();
    }

    /**
     * Generate a new trace context
     * @returns {TraceContext}
     */
    static generateNew() {
        const context = new TraceContext();
        context.traceId = crypto.randomBytes(16).toString('hex');
        context.spanId = crypto.randomBytes(8).toString('hex');
        return context;
    }

    /**
     * Parse W3C trace parent header
     * @param {string} header - traceparent header value
     * @returns {TraceContext}
     */
    static parseTraceParent(header) {
        const context = new TraceContext();
        
        if (!header) {
            return TraceContext.generateNew();
        }

        try {
            // Format: version-traceId-spanId-flags
            const parts = header.split('-');
            if (parts.length !== 4) {
                return TraceContext.generateNew();
            }

            const [version, traceId, spanId, flags] = parts;

            // Validate format
            if (!/^[0-9a-f]{2}$/.test(version) ||
                !/^[0-9a-f]{32}$/.test(traceId) ||
                !/^[0-9a-f]{16}$/.test(spanId) ||
                !/^[0-9a-f]{2}$/.test(flags)) {
                return TraceContext.generateNew();
            }

            context.version = version;
            context.traceId = traceId;
            context.spanId = crypto.randomBytes(8).toString('hex');
            context.traceFlags = flags;

            return context;
        } catch (error) {
            return TraceContext.generateNew();
        }
    }

    /**
     * Parse Google Cloud Trace header
     * @param {string} header - x-cloud-trace-context header value
     * @returns {TraceContext}
     */
    static parseCloudTrace(header) {
        const context = new TraceContext();
        
        if (!header) {
            return TraceContext.generateNew();
        }
    
        try {
            // Format: TRACE_ID/SPAN_ID;o=TRACE_TRUE
            const [traceSpan, options] = header.split(';o=');
            const [traceId] = traceSpan.split('/');
    
            if (!traceId) {
                return TraceContext.generateNew();
            }
    
            // Pad trace ID if needed (GCP uses shorter trace IDs)
            context.traceId = traceId.padStart(32, '0');
            context.spanId = crypto.randomBytes(8).toString('hex');
            context.traceFlags = (options === '0' ? '00' : '01');
    
            return context;
        } catch (error) {
            return TraceContext.generateNew();
        }
    }

    /**
     * Parse tracestate header
     * @param {string} header - tracestate header value
     */
    parseTraceState(header) {
        if (!header) return;

        try {
            // Format: vendor1=value1,vendor2=value2
            const pairs = header.split(',');
            for (const pair of pairs) {
                const [key, value] = pair.trim().split('=');
                if (key && value) {
                    this.traceState.set(key, value);
                }
            }
        } catch (error) {
            // Invalid tracestate header, ignore
        }
    }

    /**
     * Convert to W3C traceparent format
     * @returns {string}
     */
    toTraceParent() {
        return `${this.version}-${this.traceId}-${this.spanId}-${this.traceFlags}`;
    }

    /**
     * Convert to tracestate format
     * @returns {string}
     */
    toTraceState() {
        return Array.from(this.traceState.entries())
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
    }

    /**
     * Convert to Google Cloud Trace format
     * @returns {string}
     */
    toCloudTrace() {
        const isTraced = this.traceFlags === '01';
        return `${this.traceId}/${this.spanId};o=${isTraced ? '1' : '0'}`;
    }

    /**
     * Create a child span context
     * @returns {TraceContext}
     */
    createChildSpan() {
        const childContext = new TraceContext();
        childContext.version = this.version;
        childContext.traceId = this.traceId;
        childContext.spanId = crypto.randomBytes(8).toString('hex');
        childContext.traceFlags = this.traceFlags;
        childContext.traceState = new Map(this.traceState);
        return childContext;
    }
}

module.exports = TraceContext;