/**
 * Formatters index - routes to AWS or GCP formatters based on LOG_TYPE
 */

const { 
    SEVERITY_LEVEL,
    SERVICE_NAME,
    LOGGER_CONSTANTS,
    getConfigValue
} = require('../config/constants');
const { formatAwsLog } = require('./aws');
const { formatGcpLog, getCloudLogName, getResourceLabels } = require('./gcp');

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

/**
 * Get the current log type (AWS or GCP)
 */
const getLogType = () => {
    return getConfigValue('LOG_TYPE', 'gcp');
};

/**
 * Check if AWS format is enabled
 */
const isAwsFormat = () => {
    return getLogType() === 'aws';
};

/**
 * Pino formatters configuration
 */
const formatters = {
    level: (label, number) => {
        return {
            severity: SEVERITY_LEVEL[label] || 'DEFAULT',
            level: number
        };
    },

    bindings: (bindings) => {
        // Return empty bindings for AWS to prevent Pino from adding pid/hostname
        // Keep standard bindings for GCP
        if (isAwsFormat()) {
            return {};
        }
        return {
            pid: bindings.pid,
            hostname: bindings.hostname,
        };
    },

    log: (object) => {
        const logType = getLogType();
        
        if (logType === 'aws' || object._awsFormat === true) {
            return formatAwsLog(object);
        }
        
        // GCP format - remove level, pid, hostname
        const {
            pid, hostname, level, levelNumber, ...rest
        } = object;

        return rest;
    }
};

/**
 * Check if JSON format is enabled
 */
const isJsonFormat = () => {
    return getConfigValue('LOG_FORMAT', 'json') === 'json';
};

/**
 * Format log entry for cloud logging
 */
const formatJsonLog = (log, options = {}) => {
    if (!log) return log;
    
    const logType = options.LOG_TYPE || getLogType();
    
    if (logType === 'aws') {
        return formatAwsLog(log);
    }
    
    return formatGcpLog(log, options);
};

module.exports = { 
    formatters,
    isJsonFormat,
    formatJsonLog,
    getCloudLogName,
    getResourceLabels,
    getLogType,
    isAwsFormat
};

