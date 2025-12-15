// src/utils/formatters.js
const { 
  LOG_FORMAT, 
  PROJECT_ID, 
  LOGGER_NAME, 
  SEVERITY_LEVEL ,
  SERVICE_NAME,
  LOGGER_CONSTANTS,
  getConfigValue
} = require('../config/constants');
const { formatAwsLog } = require('./aws-formatter');


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
* Get cloud logging name
* @param {string} projectId - Google Cloud project ID
* @param {string} loggerName - Logger name
* @returns {string} Full log name
*/
const getCloudLogName = (projectId = PROJECT_ID, loggerName = LOGGER_NAME) => {
  if (!projectId) return loggerName;
  return `projects/${projectId}/logs/${loggerName}`;
};

/**
* Get cloud resource labels
* @param {string} projectId - Google Cloud project ID 
* @param {string} loggerName - Logger name
* @returns {object} Resource labels
*/
const getResourceLabels = (projectId = PROJECT_ID, loggerName = LOGGER_NAME) => {
  return {
      project_id: projectId,
      logger_name: loggerName,
  };
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
      // Check LOG_TYPE - if AWS, don't add GCP-specific fields
      const logType = getConfigValue('LOG_TYPE', 'gcp');
      
      if (logType === 'aws') {
          // For AWS, only return basic fields
          return {
              pid: bindings.pid,
              hostname: bindings.hostname,
          };
      }
      
      // For GCP, return GCP-specific fields (currently commented out, but structure is here)
      return {
            pid: bindings.pid,
            hostname: bindings.hostname,
            // 'logging.googleapis.com/logName': getCloudLogName(),
            // resource: {
            //     type: 'global',
            //     labels: getResourceLabels(),
            // },
      };
  },

  log: (object) => {
      // Check LOG_TYPE - if AWS, remove unwanted fields that Pino might have added
      const logType = object.LOG_TYPE || object.logType || getConfigValue('LOG_TYPE', 'gcp');
      
      if (logType === 'aws') {
          const { severity, time, ...cleaned } = object;
          return cleaned;
      }
      
      const {
          pid, hostname, level, time, msg, 
          severity, requestId, service, ...rest
      } = object;

      return rest;
  }
};

/**
* Check if JSON format is enabled
* @returns {boolean}
*/
const isJsonFormat = () => LOG_FORMAT === 'json';

/**
* Format log entry for cloud logging
* @param {object} log - Log entry to format
* @param {object} options - Formatting options
* @returns {object} Formatted log entry
*/
const formatJsonLog = (log, options = {}) => {
  if (!log) return log;
  
  const logType = log.LOG_TYPE || log.logType || getConfigValue('LOG_TYPE', 'gcp');
  
  if (logType === 'aws') {
      return formatAwsLog(log);
  }
  
  const {
      projectId = PROJECT_ID,
      includeResource = true,
      includeTrace = true,
  } = options;
  
  const formatted = {
      severity: SEVERITY_LEVEL[log.level || 'info'] || 'DEFAULT',
      
      // Add trace information if available
      ...(includeTrace && log.traceId && {
          'logging.googleapis.com/trace': projectId 
              ? `projects/${projectId}/traces/${log.traceId}`
              : log.traceId,
          'logging.googleapis.com/spanId': log.spanId
      }),
      
      // Add resource information if enabled
      ...(includeResource && {
            'logging.googleapis.com/logName': getCloudLogName(
                projectId,
                getEffectiveLoggerName(log.logSource)
            ),
            'logging.googleapis.com/labels': {
                requestId: log.requestId,
                service: SERVICE_NAME(),
                logName: getCloudLogName(projectId),
            },
            resource: {
                type: 'global',
                labels: getResourceLabels(projectId, getEffectiveLoggerName(log.logSource)),
            },

      }),
      
      // Add source location if available
      ...(log.sourceLocation && {
          'logging.googleapis.com/sourceLocation': log.sourceLocation
      }),
      
      // Add operation data if available
      ...(log.operation && {
          'logging.googleapis.com/operation': log.operation
      }),
      
      // Add HTTP request data if available
      ...(log.httpRequest && {
          'logging.googleapis.com/httpRequest': log.httpRequest
      }),
      
      // Include remaining log data
      ...log
  };

  // Clean up duplicate fields
  delete formatted.pid;
  delete formatted.hostname;
  delete formatted.requestId;
  delete formatted.service;
  delete formatted.traceId;
  delete formatted.spanId;
  delete formatted.sourceLocation;
  delete formatted.operation;
  
  return formatted;
};

module.exports = { 
  formatters,
  isJsonFormat,
  formatJsonLog,
  getCloudLogName,
  getResourceLabels
};