// src/logger/transport.js
const { LOG_FORMAT } = require('../config/constants');
const getTransport = () => ({
  target: LOG_FORMAT === 'pretty' ? 'pino-pretty' : 'pino/file',
  options: LOG_FORMAT === 'pretty' ? {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
    messageFormat: '[{time}] [{requestId}] [{type}] {msg}',
    levelFirst: true,
    sync: false
  } : {
    destination: process.stdout.fd,
    sync: false,
    mkdir: true,
    messageKey: 'message',
    timestamp: true,
    minLength: 1024,
    flushInterval: 100,
    worker: {
      idleTimeout: 1000,
      queueSize: 1024
    }
  }
});

module.exports = getTransport();