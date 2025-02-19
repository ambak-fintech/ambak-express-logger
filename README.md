# Express Logger

A comprehensive logging middleware for Express applications with distributed tracing support. This package provides structured logging, request/response tracking, error handling, and distributed tracing capabilities.

## Features

- Request/Response logging with customizable sanitization
- Distributed tracing support (W3C Trace Context and Cloud Trace)
- Context propagation across async operations
- Error logging middleware
- Configurable log formats (JSON/Pretty)
- Sensitive data redaction
- Performance metrics
- Cloud-friendly logging format

## Installation

```bash
npm install @ambak/express-logger
```

## Quick Start

```javascript
const express = require('express');
const { configure } = require('@ambak/express-logger');
const logger = configure({
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    SERVICE_NAME: 'SERVICE_NAME',
    PROJECT_ID: 'PROJECT_ID',
    LOG_FORMAT: process.env.LOG_FORMAT || 'json',
    LOGGER_SENSITIVE_FIELDS: process.env.LOGGER_SENSITIVE_FIELDS,
    LOGGER_SENSITIVE_HEADERS: process.env.LOGGER_SENSITIVE_HEADERS
});
logger.enableConsoleOverride();
const app = express();

// Add request logging middleware
app.use(logger.requestLoggerMiddleware);

// Your routes here
app.get('/', (req, res) => {
  req.log.info('Hello World!');
  res.send('Hello World!');
});

// Add error logging middleware (should be last)
app.use(logger.errorLoggerMiddleware);

app.listen(3000, () => {
  logger.info('Server started on port 3000');
});
```

## Configuration

The logger can be configured through environment variables:

```env
LOG_LEVEL=info                    # Logging level (trace, debug, info, warn, error, fatal)
LOG_FORMAT=json                   # Log format (json, pretty)
PROJECT_ID=my-project            # Project ID for cloud logging
LOGGER_SENSITIVE_HEADERS=auth,key # Comma-separated list of sensitive headers
```

## API Reference

### Logger

The base logger instance provides standard logging levels:

```javascript
logger.trace('Trace message');
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
logger.fatal('Fatal message');
```

### Request Context

Access request-scoped context in your routes:

```javascript
app.get('/api', (req, res) => {
  const context = req.log.context;
  // Access traceId, spanId, requestId
});
```

### Middleware

- `requestLoggerMiddleware`: Logs incoming requests and outgoing responses
- `errorLoggerMiddleware`: Logs uncaught errors with stack traces