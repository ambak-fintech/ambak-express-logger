/**
 * Convert trace ID to AWS X-Ray format: 1-{timestamp}-{traceId} (without Root=)
 */
const convertToAwsXRayTraceId = (traceId, timestamp = null) => {
    if (!traceId) return null;
    
    // If already in 1-{hex}-{hex} format, return as is
    if (typeof traceId === 'string' && /^1-[0-9a-f]{8}-[0-9a-f]{24}$/i.test(traceId)) {
        return traceId;
    }
    
    // If in Root= format, extract the trace ID part
    if (typeof traceId === 'string' && traceId.startsWith('Root=')) {
        return traceId.replace('Root=', '');
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
    
    return `1-${hexTimestamp}-${traceIdHex}`;
};

/**
 * Generate X-Amzn-Trace-Id header value
 */
const generateXAmznTraceId = (traceId, spanId, sampled = true) => {
    if (!traceId) return null;
    
    const awsTraceId = convertToAwsXRayTraceId(traceId);
    if (!awsTraceId) return null;
    
    // Format spanId to 16-char hex (lowercase)
    const spanIdHex = spanId 
        ? spanId.replace(/[^0-9a-f]/gi, '').slice(0, 16).padStart(16, '0').toLowerCase()
        : null;
    
    const parts = [`Root=${awsTraceId}`];
    if (spanIdHex) {
        parts.push(`Parent=${spanIdHex}`);
    }
    parts.push(`Sampled=${sampled ? '1' : '0'}`);
    
    return parts.join(';');
};

const formatAwsLog = (object) => {
    if (!object || typeof object !== 'object') {
        return object;
    }

    // Check LOG_TYPE environment variable or from object
    const { getConfigValue } = require('../config/constants');
    const logType = object.LOG_TYPE || object.logType || getConfigValue('LOG_TYPE', 'gcp');
    
    // If LOG_TYPE is not 'aws', return object as-is (for GCP or other types)
    if (logType !== 'aws') {
        return object;
    }

    // Import SEVERITY_LEVEL for severity mapping
    const { SEVERITY_LEVEL, SERVICE_NAME } = require('../config/constants');

    const {
        pid, hostname, level, levelNumber, time, timestamp,
        msg, severity, requestId, service,
        traceId, spanId,
        method, url, path, params, remoteAddress, headers, request_payload,
        httpRequest, response,
        type, target_service, instance, region, account_id,
        ...rest
    } = object;
    
    // Map numeric levels to severity strings
    const levelToSeverity = {
        10: 'DEBUG',  // trace
        20: 'DEBUG',  // debug
        30: 'INFO',   // info
        40: 'WARNING', // warn
        50: 'ERROR',   // error
        60: 'CRITICAL' // fatal
    };
    
    // Build result object with only expected fields in correct order
    const result = {};
    
    // 1. severity (required)
    if (severity) {
        result.severity = severity;
    } else if (level !== undefined) {
        result.severity = levelToSeverity[level] || SEVERITY_LEVEL['info'] || 'INFO';
    } else {
        result.severity = 'INFO';
    }
    
    // 2. level
    if (level !== undefined) {
        result.level = level;
    }
    
    // 3. timestamp
    result.timestamp = timestamp || time || new Date().toISOString();
    
    // 4. type
    if (type) {
        result.type = type;
    }
    
    // 5. service
    if (service) {
        result.service = service;
    }
    
    // 6. pid
    if (pid !== undefined) {
        result.pid = pid;
    }
    
    // 7. hostname
    if (hostname) {
        result.hostname = hostname;
    }
    
    // 8. requestId
    if (requestId) {
        result.requestId = requestId;
    }
    
    // 9. traceId (convert to AWS X-Ray format and replace original)
    if (traceId) {
        const awsTraceId = convertToAwsXRayTraceId(traceId, result.timestamp);
        result.traceId = awsTraceId; // Replace traceId with AWS format
        result['x-amzn-trace-id'] = generateXAmznTraceId(traceId, spanId);
        result.sampled = true;
    }
    
    // 10. spanId (format to 16-char hex and replace original)
    if (spanId) {
        result.spanId = spanId.replace(/[^0-9a-f]/gi, '').slice(0, 16).padStart(16, '0').toLowerCase();
    }
    
    // 11. Request fields at root level
    const requestMethod = method || httpRequest?.requestMethod;
    const requestUrl = url || path || httpRequest?.requestUrl;
    const requestPath = path || (httpRequest?.requestUrl ? (() => {
        try {
            const urlObj = new URL(httpRequest.requestUrl);
            return urlObj.pathname;
        } catch {
            return httpRequest.requestUrl;
        }
    })() : null);
    const requestParams = params;
    const requestRemoteAddress = remoteAddress || httpRequest?.remoteIp;
    const requestHeaders = headers || httpRequest?.headers;
    const requestPayload = request_payload || httpRequest?.requestBody;
    
    if (requestMethod) result.method = requestMethod;
    if (requestUrl) result.url = requestUrl;
    if (requestPath) result.path = requestPath;
    if (requestParams !== undefined) result.params = requestParams;
    if (requestRemoteAddress) result.remoteAddress = requestRemoteAddress;
    if (requestHeaders) result.headers = requestHeaders;
    if (requestPayload) result.request_payload = requestPayload;
    if (target_service) result.target_service = target_service;
    
    // 12. response (if present)
    if (response) {
        result.response = response;
    }
    
    // 13. AWS CloudWatch structure with snake_case
    const serviceName = service || SERVICE_NAME();
    result.aws = {
        cloudwatch: {
            log_group: `/aws/service/${serviceName}`,
            log_stream: instance || 'instance-1',
            region: region || process.env.AWS_REGION || 'ap-south-1',
            account_id: account_id || process.env.AWS_ACCOUNT_ID || '123456789012'
        }
    };
    
    // Only add other fields that are explicitly allowed (like response body, etc.)
    // But exclude all GCP fields and unwanted fields
    const allowedExtraFields = ['response']; // Add any other allowed fields here
    
    Object.keys(rest).forEach(key => {
        // Skip GCP fields, internal fields, and fields we've already handled
        if (!key.startsWith('logging.googleapis.com/') &&
            key !== 'resource' &&
            key !== 'levelNumber' &&
            key !== 'time' &&
            key !== 'msg' &&
            key !== 'httpRequest' &&
            key !== 'LOG_TYPE' &&
            key !== 'logType' &&
            !result.hasOwnProperty(key) &&
            allowedExtraFields.includes(key)) {
            result[key] = rest[key];
        }
    });
    
    // Final cleanup - explicitly remove all GCP fields and unwanted fields that might have been added
    // Do this multiple times to catch fields added at different stages
    // Note: traceId and spanId are NOT removed - they're replaced with AWS format values
    const fieldsToRemove = [
        'time',
        'logging.googleapis.com/logName',
        'logging.googleapis.com/trace',
        'logging.googleapis.com/spanId',
        'logging.googleapis.com/labels',
        'logging.googleapis.com/sourceLocation',
        'logging.googleapis.com/operation',
        'logging.googleapis.com/httpRequest',
        'resource',
        'levelNumber',
        'msg',
        'httpRequest',
        'LOG_TYPE',
        'logType'
    ];
    
    // Remove fields multiple times to ensure they're gone
    for (let i = 0; i < 3; i++) {
        fieldsToRemove.forEach(field => {
            if (result.hasOwnProperty(field)) {
                delete result[field];
            }
        });
    }
    
    // Also remove any fields that start with 'logging.googleapis.com/'
    Object.keys(result).forEach(key => {
        if (key.startsWith('logging.googleapis.com/')) {
            delete result[key];
        }
    });
    
    // Final pass - remove time one more time (in case it was added back)
    // Note: traceId and spanId are kept - they contain AWS format values
    delete result.time;
    
    return result;
};

module.exports = {
    formatAwsLog
};

