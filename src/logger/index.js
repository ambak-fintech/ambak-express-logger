//src/logger/index.js
const { logger, createLogger } = require('./base-logger');
const createTransport = require('./transport');

module.exports = {
    logger,
    createLogger,
    createTransport
};