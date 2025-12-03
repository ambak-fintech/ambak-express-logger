/**
 * AWS X-Ray Trace ID utilities
 */

/**
 * Convert trace ID to AWS X-Ray format: Root=1-{timestamp}-{traceId}
 */
const convertToAwsXRayTraceId = (traceId, timestamp = null) => {
    if (!traceId) return null;
    
    // If already in Root= format, return as is
    if (typeof traceId === 'string' && traceId.startsWith('Root=')) {
        return traceId;
    }
    
    // Get timestamp (Unix epoch in seconds)
    const epochSeconds = timestamp 
        ? Math.floor(new Date(timestamp).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
    
    // Convert to 8-char hex (lowercase)
    const hexTimestamp = epochSeconds.toString(16).padStart(8, '0').toLowerCase();
    
    // Extract first 24 chars of traceId (AWS X-Ray uses 96-bit = 24 hex chars)
    const traceIdStr = typeof traceId === 'string' ? traceId : traceId.toString(16);
    const traceIdHex = traceIdStr.replace(/[^0-9a-f]/gi, '').slice(0, 24).padStart(24, '0').toLowerCase();
    
    return `Root=1-${hexTimestamp}-${traceIdHex}`;
};

/**
 * Generate X-Amzn-Trace-Id header value
 */
const generateXAmznTraceId = (traceId, spanId, sampled = true) => {
    if (!traceId) return null;
    
    const awsTraceId = convertToAwsXRayTraceId(traceId);
    if (!awsTraceId) return null;
    
    const parts = [awsTraceId];
    if (spanId) {
        parts.push(`Parent=${spanId}`);
    }
    parts.push(`Sampled=${sampled ? '1' : '0'}`);
    
    return parts.join(';');
};

module.exports = {
    convertToAwsXRayTraceId,
    generateXAmznTraceId
};

