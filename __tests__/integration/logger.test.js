// __tests__/integration/logger.test.js
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { createRequestLogger, createErrorLogger } = require('../../src/middleware');
const RequestContext = require('../../src/context');

describe('Logger Integration', () => {
  let app;
  let logMessages;
  let mockLogger;

  beforeEach(() => {
    // Reset messages
    logMessages = [];

    // Create mock logger
    mockLogger = {
      info: jest.fn(msg => logMessages.push({ level: 'info', msg })),
      warn: jest.fn(msg => logMessages.push({ level: 'warn', msg })),
      error: jest.fn(msg => logMessages.push({ level: 'error', msg })),
      child: jest.fn(() => mockLogger)
    };

    // Create express app
    app = express();
    app.use(express.json());
    app.use(createRequestLogger({
      logger: mockLogger,
      logResponseBody: true,
      excludePaths: ['/health']
    }));
    app.use(createErrorLogger({ logger: mockLogger }));
  });

  describe('Request Logging', () => {
    it('should attach logger to request and log requests', async () => {
      // Setup route
      app.get('/test', (req, res) => {
        expect(req.log).toBeDefined();
        expect(typeof req.log.info).toBe('function');
        req.log.info('test message');
        res.json({ success: true });
      });

      // Make request
      await request(app)
        .get('/test')
        .expect(200)
        .expect('Content-Type', /json/);

      // Verify logging
      expect(mockLogger.child).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
      expect(logMessages.some(log => log.msg === 'test message')).toBe(true);
    });
  });

  describe('Error Logging', () => {
    it('should log errors', async () => {
      const testError = new Error('test error');
  
      app.get('/error', () => {
        throw testError;
      });
  
      await request(app)
        .get('/error')
        .expect(500);
  
      expect(mockLogger.error).toHaveBeenCalled();
  
      const errorLog = logMessages.find(log =>
        log.level === 'error' &&
        (
          log.msg.response?.body?.includes('test error')  // Check if error is in the response body
        )
      );
  
      expect(errorLog).toBeDefined();
    });
  });

  describe('Context', () => {
    it('should maintain request context', async () => {
      let capturedContext;

      app.get('/context', (req, res) => {
        capturedContext = RequestContext.get();
        res.json({ success: true });
      });

      await request(app)
        .get('/context')
        .expect(200);

      expect(capturedContext).toBeDefined();
      expect(capturedContext.requestId).toBeDefined();
      expect(typeof capturedContext.requestId).toBe('string');
    });

    it('should propagate trace context', async () => {
      let capturedContext;

      app.get('/trace', (req, res) => {
        capturedContext = RequestContext.get();
        res.json({ success: true });
      });

      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      await request(app)
        .get('/trace')
        .set('traceparent', `00-${traceId}-0000000000000000-01`)
        .expect(200);

      expect(capturedContext.traceId).toBe(traceId);
    });
  });

  describe('Path Exclusion', () => {
    it('should not log excluded paths', async () => {
      app.get('/health', (_, res) => res.json({ status: 'ok' }));

      await request(app)
        .get('/health')
        .expect(200);

      expect(logMessages.length).toBe(0);
    });
  });
});
