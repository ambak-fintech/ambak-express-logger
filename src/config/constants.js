// src/config/constants.js

let configOverrides = {};

const getConfigValue = (key, defaultValue) => {
  return configOverrides[key] || process.env[key] || defaultValue;
};

const EXCLUDED_PATHS = [
  '/health',
  '/metrics',
  '/*/health',
  '/*/metrics'
];

const shouldExcludePath = (path, customExclusions = []) => {
  const pathsToCheck = [...EXCLUDED_PATHS, ...customExclusions];
  return pathsToCheck.some(pattern => {
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace('*', '[^/]+');
      return new RegExp(`^${regexPattern}$`).test(path);
    }
    return path === pattern;
  });
};

const SEVERITY_LEVEL = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL'
};

const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

const DEFAULT_SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'authorization',
  'key',
  'secret',
  'credential',
  'creditcard',
  'credit_card',
  'cardnumber',
  'apikey',
  'phone',
  'email',
  'dob',
  'birth',
  'social'
]);

const DEFAULT_SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'token',
  'password'
];

const getSensitiveFields = () => {
  const envFields = getConfigValue('LOGGER_SENSITIVE_FIELDS');
  if (envFields) {
    return new Set([
      ...Array.from(DEFAULT_SENSITIVE_FIELDS),
      ...envFields.split(',').map(f => f.trim().toLowerCase())
    ]);
  }
  return DEFAULT_SENSITIVE_FIELDS;
};

const getSensitiveHeaders = () => {
  const envHeaders = getConfigValue('LOGGER_SENSITIVE_HEADERS');
  if (envHeaders) {
    return envHeaders.split(',').map(h => h.trim().toLowerCase());
  }
  return DEFAULT_SENSITIVE_HEADERS;
};

const setConfigOverrides = (overrides = {}) => {
  configOverrides = overrides;
};

module.exports = {
  LOG_LEVEL: getConfigValue('LOG_LEVEL', 'info'),
  LOG_FORMAT: getConfigValue('LOG_FORMAT', 'json'),
  PROJECT_ID: getConfigValue('PROJECT_ID', 'ambak-399309'),
  SERVICE_NAME: () => getConfigValue('SERVICE_NAME', 'express-app'),
  LOGGER_NAME: getConfigValue('LOGGER_NAME', 'api-logger'),
  TRACE_HEADER: 'x-cloud-trace-context',
  REQUEST_ID_HEADER: 'x-request-id',
  LOGGER_CONSTANTS: {
    API_LOGGER_NAME: 'api-logger',
    ERROR_LOGGER_NAME: 'error-logger',
    CONSOLE_LOGGER_NAME: 'console-logger'
  },
  getConfigValue,
  getSensitiveFields,
  getSensitiveHeaders,
  setConfigOverrides,
  
  EXCLUDED_PATHS,
  shouldExcludePath,
  SEVERITY_LEVEL,
  LOG_LEVELS,
  
  CONTENT_LIMITS: {
    STRING_RESPONSE: parseInt(getConfigValue('LOG_STRING_LIMIT', '1024')),
    JSON_DEPTH: parseInt(getConfigValue('LOG_JSON_DEPTH', '10')),
    ARRAY_LENGTH: parseInt(getConfigValue('LOG_ARRAY_LENGTH', '100'))
  }
};