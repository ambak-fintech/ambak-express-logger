// src/utils/sanitizers.js

const { getSensitiveFields, getSensitiveHeaders, CONTENT_LIMITS } = require('../config/constants');

/**
 * Regular expression patterns for identifying sensitive data formats
 */
const PATTERNS = {
    BASE64_IMAGE: /^data:image\/[^;]+;base64,[^"'\s)]+$/,
    BASE64_GENERIC: /^(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    IMAGE_URL: /\.(jpe?g|png|gif|svg|webp|bmp|ico)($|\?)/i,
    CREDIT_CARD: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
    SSN: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/,
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
};

// Memoization cache for frequently checked strings
const memoizedChecks = new Map();

/**
 * Sanitize image and base64 data
 * @param {string} value - The value to sanitize
 * @returns {string} - Sanitized value
 */
function sanitizeImageData(value) {
    if (typeof value !== 'string') return value;
    
    // Check memoization cache
    const cached = memoizedChecks.get(value);
    if (cached) return cached;
    
    let result = value;
    
    if (value.length > 100) {
        if (PATTERNS.BASE64_IMAGE.test(value) || PATTERNS.BASE64_GENERIC.test(value)) {
            result = '[BASE64 REDACTED]';
        } else if (PATTERNS.IMAGE_URL.test(value)) {
            result = '[IMAGE URL REDACTED]';
        }
    }
    
    // Cache the result (with size limit)
    if (memoizedChecks.size < 1000) {
        memoizedChecks.set(value, result);
    }
    
    return result;
}

/**
 * Sanitize a single value, checking for various sensitive data patterns
 * @param {string} key - The key of the value
 * @param {any} value - The value to sanitize
 * @param {Set} sensitiveFields - Set of sensitive field names
 * @returns {any} - Sanitized value
 */
function sanitizeValue(key, value, sensitiveFields) {
    if (sensitiveFields.has(key.toLowerCase())) {
        return '[REDACTED]';
    }

    if (!value || typeof value !== 'string') {
        return value;
    }

    // Check for sensitive patterns in longer strings
    if (value.length > 100) {
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('image') || value.startsWith('data:image/')) {
            return '[IMAGE DATA REDACTED]';
        }
        if (PATTERNS.BASE64_GENERIC.test(value)) {
            return '[BASE64 DATA REDACTED]';
        }
        if (PATTERNS.CREDIT_CARD.test(value)) {
            return '[CREDIT CARD REDACTED]';
        }
        if (PATTERNS.SSN.test(value)) {
            return '[SSN REDACTED]';
        }
        if (PATTERNS.EMAIL.test(value)) {
            return '[EMAIL REDACTED]';
        }
    }

    return sanitizeImageData(value);
}

/**
 * Recursively sanitize an object or array
 * @param {object|array} obj - The object or array to sanitize
 * @param {Set} sensitiveFields - Set of sensitive field names
 * @param {number} depth - Current recursion depth
 * @returns {object|array} - Sanitized object or array
 */
function sanitizeBody(obj, sensitiveFields = getSensitiveFields(), depth = 0) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    // Prevent excessive recursion
    if (depth >= CONTENT_LIMITS.JSON_DEPTH) {
        return '[MAX DEPTH EXCEEDED]';
    }

    // Handle arrays with length limit
    if (Array.isArray(obj)) {
        return obj
            .slice(0, CONTENT_LIMITS.ARRAY_LENGTH)
            .map(item => sanitizeBody(item, sensitiveFields, depth + 1));
    }

    // Handle objects
    return Object.entries(obj).reduce((acc, [key, value]) => {
        acc[key] = sanitizeValue(key, 
            typeof value === 'object' ? sanitizeBody(value, sensitiveFields, depth + 1) : value,
            sensitiveFields
        );
        return acc;
    }, {});
}

/**
 * Sanitize HTTP headers
 * @param {object} headers - The headers to sanitize
 * @param {Array} sensitiveHeaders - Array of sensitive header names
 * @returns {object} - Sanitized headers
 */
function sanitizeHeaders(headers = {}, sensitiveHeaders = getSensitiveHeaders()) {
    if (!headers || typeof headers !== 'object') {
        return {};
    }

    return Object.entries(headers).reduce((acc, [key, value]) => {
        acc[key] = sensitiveHeaders.includes(key.toLowerCase()) ? '[REDACTED]' : value;
        return acc;
    }, {});
}

module.exports = {
    sanitizeValue,
    sanitizeBody,
    sanitizeHeaders,
    sanitizeImageData,
    PATTERNS
};