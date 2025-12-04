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
     * @param {boolean} awsFormat - If true, generate trace ID in AWS X-Ray format
     * @returns {TraceContext}
     */
    static generateNew(awsFormat = false) {
        const context = new TraceContext();
        
        if (awsFormat) {
            // Generate AWS X-Ray format: 1-{timestamp}-{traceId}
            const epochSeconds = Math.floor(Date.now() / 1000);
            const hexTimestamp = epochSeconds.toString(16).padStart(8, '0').toLowerCase();
            const traceIdHex = crypto.randomBytes(12).toString('hex').toLowerCase(); // 24 hex chars
            context.traceId = `1-${hexTimestamp}-${traceIdHex}`;
        } else {
            // Generate standard W3C format (32 hex chars)
            context.traceId = crypto.randomBytes(16).toString('hex');
        }
        
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
     * Parse AWS X-Amzn-Trace-Id header
     * @param {string} header - x-amzn-trace-id header value
     * @returns {TraceContext}
     */
    static parseAwsTraceId(header) {
        const context = new TraceContext();
        
        if (!header) {
            return TraceContext.generateNew();
        }

        try {
            // Format: Root=1-{timestamp}-{traceId};Parent={spanId};Sampled={0|1}
            // Example: Root=1-69313ce7-190b8f6099d578eaf1f561bc;Parent=745315306bfc9ca3;Sampled=1
            
            // Remove quotes if present
            header = header.replace(/^["']|["']$/g, '');
            
            const parts = header.split(';');
            let rootPart = '';
            let parentPart = '';
            let sampled = '1';

            for (const part of parts) {
                const trimmed = part.trim();
                if (trimmed.startsWith('Root=')) {
                    rootPart = trimmed.substring(5); // Remove 'Root='
                } else if (trimmed.startsWith('Parent=')) {
                    parentPart = trimmed.substring(7); // Remove 'Parent='
                } else if (trimmed.startsWith('Sampled=')) {
                    sampled = trimmed.substring(8); // Remove 'Sampled='
                }
            }

            if (!rootPart) {
                return TraceContext.generateNew();
            }

            // Extract trace ID from Root format: 1-{timestamp}-{traceId}
            // The trace ID is the last 24 hex chars after the second dash
            const rootParts = rootPart.split('-');
            if (rootParts.length >= 3) {
                // Full AWS trace ID format: 1-{timestamp}-{traceId}
                // Store the full AWS format as traceId
                context.traceId = rootPart; // Keep as 1-{timestamp}-{traceId} format
            } else {
                // Fallback: use the rootPart as-is
                context.traceId = rootPart;
            }

            // Extract span ID from Parent
            if (parentPart) {
                // AWS span ID is 16 hex chars, convert to our format (8 bytes = 16 hex)
                context.spanId = parentPart.replace(/[^0-9a-f]/gi, '').slice(0, 16).padStart(16, '0').toLowerCase();
            } else {
                context.spanId = crypto.randomBytes(8).toString('hex');
            }

            context.traceFlags = (sampled === '0' ? '00' : '01');

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