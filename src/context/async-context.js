// src/context/async-context.js
const { AsyncLocalStorage } = require('async_hooks');

/**
 * AsyncLocalStorage instance for maintaining context across async operations
 * This allows us to track request context throughout the lifetime of a request
 */
const asyncLocalStorage = new AsyncLocalStorage();

module.exports = asyncLocalStorage;