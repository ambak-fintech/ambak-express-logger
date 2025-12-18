const { SEVERITY_LEVEL, SERVICE_NAME } = require('../config/constants');
const { getConfigValue } = require('../config/constants');
const { randomBytes } = require('crypto');
const convertToAwsXRayTraceId = (traceId, timestamp = null) => {
    if (!traceId) return null;
    
    if (typeof traceId === 'string' && /^1-[0-9a-f]{8}-[0-9a-f]{24}$/i.test(traceId)) {
        return traceId;
    }
    
    if (typeof traceId === 'string' && traceId.startsWith('Root=')) {
        return traceId.replace('Root=', '');
    }
    
    const epochSeconds = timestamp 
        ? Math.floor(new Date(timestamp).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
    
    const hexTimestamp = epochSeconds.toString(16).padStart(8, '0').toLowerCase();
    
    const traceIdStr = typeof traceId === 'string' ? traceId : traceId.toString(16);
    const traceIdHex = traceIdStr.replace(/[^0-9a-f]/gi, '').slice(0, 24).padStart(24, '0').toLowerCase();
    
    return `1-${hexTimestamp}-${traceIdHex}`;
};

const generateXAmznTraceId = (traceId, spanId, sampled = true) => {
    if (!traceId) return null;
    
    const awsTraceId = (typeof traceId === 'string' && /^1-[0-9a-f]{8}-[0-9a-f]{24}$/i.test(traceId))
        ? traceId
        : convertToAwsXRayTraceId(traceId);
    
    if (!awsTraceId) return null;
    
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

    const logType = object.LOG_TYPE || object.logType || getConfigValue('LOG_TYPE', 'gcp');
    
    if (logType !== 'aws') {
        return object;
    }


    const {
        pid, hostname, level, levelNumber, time, timestamp,
        msg, message, severity, requestId, service,
        traceId, spanId,
        method, url, path, params, remoteAddress, headers, request_payload,
        httpRequest, response,
        type, target_service, instance, region, account_id,
        ...rest
    } = object;
    
    const levelToSeverity = {
        10: 'DEBUG',  
        20: 'DEBUG',  
        30: 'INFO',   
        40: 'WARNING', 
        50: 'ERROR',   
        60: 'CRITICAL' 
    };

    const result = {};
    
    if (severity) {
        result.severity = severity;
    } else if (level !== undefined) {
        result.severity = levelToSeverity[level] || SEVERITY_LEVEL['info'] || 'INFO';
    } else {
        result.severity = 'INFO';
    }
    
    if (level !== undefined) {
        result.level = level;
    }
    
    result.timestamp = timestamp || time || new Date().toISOString();
    
    if (type) {
        result.type = type;
    }
    else{
        result.type = 'console_log';
    }
    
    // Preserve message across AWS formatting. The rest of the logger pipeline uses `messageKey: 'message'`,
    // and console override produces `message`, not `msg`.
    const effectiveMessage = (typeof msg === 'string' && msg.length > 0)
        ? msg
        : (typeof message === 'string' && message.length > 0 ? message : null);
    if (effectiveMessage) {
        result.message = effectiveMessage;
    }
    
    if (service) {
        result.service = service;
    }
    
    if (pid !== undefined) {
        result.pid = pid;
    }
    
    if (hostname) {
        result.hostname = hostname;
    }
    
    const finalRequestId = requestId || rest?.requestId || object.requestId;
    result.requestId = (finalRequestId && finalRequestId !== '' && finalRequestId !== null && finalRequestId !== undefined) 
        ? finalRequestId 
        : randomBytes(16).toString('hex').slice(0, 8);
    
    if (rest && rest.requestId) {
        delete rest.requestId;
    }
    
    if (traceId) {
        const awsTraceId = convertToAwsXRayTraceId(traceId, result.timestamp);
        result.traceId = awsTraceId; // Replace traceId with AWS format
        result['x-amzn-trace-id'] = generateXAmznTraceId(awsTraceId, spanId);
        result.sampled = true;
    }
    
    if (spanId) {
        result.spanId = spanId.replace(/[^0-9a-f]/gi, '').slice(0, 16).padStart(16, '0').toLowerCase();
    }
    
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
    
    if (response) {
        result.response = response;
    }
    
    const serviceName = service;
    // result.aws = {
    //     cloudwatch: {
    //         log_group: `/aws/service/${serviceName}`,
    //         log_stream: instance || 'instance-1',
    //         region: region || process.env.AWS_REGION,
    //         account_id: account_id || process.env.AWS_ACCOUNT_ID
    //     }
    // };
    
    const allowedExtraFields = ['response', 'message', 'logLevel',];
    
    Object.keys(rest).forEach(key => {
        if (!key.startsWith('logging.googleapis.com/') &&
            key !== 'resource' &&
            key !== 'levelNumber' &&
            key !== 'time' &&
            key !== 'msg' &&
            key !== 'message' &&
            key !== 'httpRequest' &&
            key !== 'LOG_TYPE' &&
            key !== 'logType' &&
            !result.hasOwnProperty(key) &&
            allowedExtraFields.includes(key)) {
            result[key] = rest[key];
        }
    });
    
    Object.keys(result).forEach(key => {
        if (key.startsWith('logging.googleapis.com/')) {
            delete result[key];
        }
    });
    
    delete result.time;
    
    return result;
};

module.exports = {
    formatAwsLog
};

