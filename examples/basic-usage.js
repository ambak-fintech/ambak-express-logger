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

// Example route that uses the logger
app.get('/', (req, res) => {
    // Access request-scoped logger
    req.log.info('Processing request');
    
    // Add your own context
    req.log.info({
        action: 'process',
        details: { processed: true }
    });
    
    res.json({ message: 'Hello World!' });
});

// Example error route
app.get('/error', () => {
    throw new Error('Something went wrong');
});

// Add error logging middleware (should be after routes)
app.use(logger.errorLoggerMiddleware);

// Use the base logger for application-level logs
logger.info('Server starting...');

app.listen(3000, () => {
    logger.info('Server started on port 3000');
});