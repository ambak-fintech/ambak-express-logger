const express = require('express');
const { 
    logger, 
    requestLoggerMiddleware, 
    errorLoggerMiddleware 
} = require('@ambak/express-logger');

const app = express();

// Add request logging middleware
app.use(requestLoggerMiddleware);

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
app.use(errorLoggerMiddleware);

// Use the base logger for application-level logs
logger.info('Server starting...');

app.listen(3000, () => {
    logger.info('Server started on port 3000');
});