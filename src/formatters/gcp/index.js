/**
 * GCP Cloud Logging Formatter
 */

const { PROJECT_ID, SERVICE_NAME, LOGGER_CONSTANTS } = require('../../config/constants');
const { extractCommonFields } = require('../shared/field-cleaner');

const getEffectiveLoggerName = (logSource) => {
    switch (logSource) {
        case 'exception':
            return LOGGER_CONSTANTS.ERROR_LOGGER_NAME;
        case 'console':
            return LOGGER_CONSTANTS.CONSOLE_LOGGER_NAME;
        default:
            return LOGGER_CONSTANTS.API_LOGGER_NAME;
    }
};

const getCloudLogName = (projectId = PROJECT_ID, loggerName) => {
    if (!projectId) return loggerName;
    return `projects/${projectId}/logs/${loggerName}`;
};

const getResourceLabels = (projectId = PROJECT_ID, loggerName) => {
    return {
        project_id: projectId,
        logger_name: loggerName,
    };
};

/**
 * Format GCP log entry
 */
const formatGcpLog = (log, options = {}) => {
    if (!log) return log;
    
    const fields = extractCommonFields(log);
    const projectId = log.projectId || options.projectId || PROJECT_ID;
    const loggerName = getEffectiveLoggerName(log.logSource);
    const includeResource = options.includeResource !== false;
    const includeTrace = options.includeTrace !== false;
    
    const formatted = {
        ...(fields.system.time && { time: fields.system.time }),
        ...(fields.context.service && { service: fields.context.service }),
        ...(fields.context.traceId && { traceId: fields.context.traceId }),
        ...(fields.context.spanId && { spanId: fields.context.spanId }),
        ...(includeTrace && fields.context.traceId && projectId && {
            'logging.googleapis.com/trace': `projects/${projectId}/traces/${fields.context.traceId}`
        }),
        ...(fields.context.spanId && {
            'logging.googleapis.com/spanId': fields.context.spanId
        }),
        ...(includeResource && {
            'logging.googleapis.com/logName': getCloudLogName(projectId, loggerName),
            'logging.googleapis.com/labels': {
                ...(fields.context.requestId && { requestId: fields.context.requestId }),
                ...(fields.context.service && { service: fields.context.service || SERVICE_NAME() }),
                logName: getCloudLogName(projectId, loggerName),
            },
            resource: {
                type: 'global',
                labels: getResourceLabels(projectId, loggerName),
            },
        }),
        ...fields.rest
    };
    
    // Clean up httpRequest - remove unwanted fields
    if (formatted.httpRequest) {
        const cleanHttpRequest = {
            ...(formatted.httpRequest.requestMethod && { requestMethod: formatted.httpRequest.requestMethod }),
            ...(formatted.httpRequest.requestUrl && { requestUrl: formatted.httpRequest.requestUrl }),
            ...(formatted.httpRequest.remoteIp && { remoteIp: formatted.httpRequest.remoteIp }),
            ...(formatted.httpRequest.requestSize && { requestSize: formatted.httpRequest.requestSize }),
            ...(formatted.httpRequest.userAgent && { userAgent: formatted.httpRequest.userAgent }),
        };
        formatted.httpRequest = cleanHttpRequest;
    }
    
    // Add source location if available
    if (log.sourceLocation) {
        formatted['logging.googleapis.com/sourceLocation'] = log.sourceLocation;
    }
    
    // Add operation data if available
    if (log.operation) {
        formatted['logging.googleapis.com/operation'] = log.operation;
    }
    
    // Keep request_payload as is (not in request object)
    // Remove request object if it exists
    delete formatted.request;
    
    // Clean up unwanted fields
    delete formatted.pid;
    delete formatted.hostname;
    delete formatted.level;
    delete formatted.levelNumber;
    delete formatted.requestId;
    delete formatted.type;
    delete formatted.target_service;
    delete formatted.method;
    delete formatted.url;
    delete formatted.path;
    delete formatted.remoteAddress;
    delete formatted.headers;
    delete formatted.params;
    delete formatted.query_params;
    delete formatted.sourceLocation;
    delete formatted.operation;
    
    return formatted;
};

module.exports = {
    formatGcpLog,
    getCloudLogName,
    getResourceLabels
};

