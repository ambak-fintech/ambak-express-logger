// src/utils/serializers.js
const { sanitizeHeaders, sanitizeBody, CONTENT_LIMITS } = require('./sanitizers');

/**
 * Get content type from response object
 * @param {object} res - Response object
 * @returns {string} Content type
 */
const getContentType = (res) => {
    if (!res) return '';
    if (res.getHeaders) {
        return res.getHeaders()['content-type'] || '';
    }
    if (res._header) {
        const match = res._header.match(/content-type:\s*([^\r\n]+)/i);
        return match ? match[1] : '';
    }
    return '';
};

/**
 * Handle request body serialization based on content type
 * @param {object} req - Request object
 * @param {string} contentType - Content type
 * @returns {any} Serialized body
 */
const handleRequestBody = (req, contentType) => {
    const payload = req.parsedBody || req.request_payload || 
                   (req.httpRequest && req.httpRequest.requestBody) || 
                   req.body;
    
    if (!payload) return undefined;
    
    try {
        // Handle JSON and form data
        if (contentType.includes('application/json') || 
            contentType.includes('application/x-www-form-urlencoded')) {
            return sanitizeBody(payload);
        }
        
        // Handle multipart form data
        if (contentType.includes('multipart/form-data')) {
            const formDataInfo = {
                payload: sanitizeBody(payload),
                message: '[MULTIPART FORM DATA]',
                size: req.headers['content-length'],
                boundary: contentType.split('boundary=')[1]
            };
            return formDataInfo;
        }
        
        // Handle text content
        if (contentType.includes('text/')) {
            const stringBody = String(payload);
            return stringBody.length > CONTENT_LIMITS.STRING_RESPONSE
                ? `${stringBody.slice(0, CONTENT_LIMITS.STRING_RESPONSE)}... [TRUNCATED]`
                : stringBody;
        }
        
        // Handle other content types
        return `[${contentType.split(';')[0]} CONTENT]`;
    } catch (error) {
        return '[BODY SERIALIZATION ERROR]';
    }
};

/**
 * Pino serializers for various objects
 */
const serializers = {
    /**
     * Serialize request object
     * @param {object} req - Request object
     * @returns {object} Serialized request
     */
    req: (req) => {
        if (!req) return req;
        
        try {
            const contentType = req.headers?.['content-type'] || '';
            
            const serialized = {
                method: req.method,
                url: req.originalUrl || req.url,
                path: req.path,
                params: req.params,
                headers: sanitizeHeaders(req.headers),
                remoteAddress: req.ip || req.connection?.remoteAddress || 
                              req.socket?.remoteAddress || 'unknown'
            };

            // Add query parameters if present
            if (req.query && Object.keys(req.query).length > 0) {
                serialized.query_params = sanitizeBody(req.query);
            }

            // Add request payload
            const requestPayload = handleRequestBody(req, contentType);
            if (requestPayload) {
                serialized.request_payload = requestPayload;
            }

            // Handle file uploads
            if (req.files?.length > 0 || (req.file && Object.keys(req.file).length > 0)) {
                const files = req.files || [req.file];
                serialized.files = files.map(file => ({
                    fieldname: file.fieldname,
                    originalname: file.originalname,
                    encoding: file.encoding,
                    mimetype: file.mimetype,
                    size: file.size
                }));
            }

            return serialized;
        } catch (err) {
            return {
                error: 'Failed to serialize request',
                message: err.message
            };
        }
    },

    /**
     * Serialize response object
     * @param {object} res - Response object
     * @returns {object} Serialized response
     */
    res: (res) => {
        if (!res) return res;
        
        try {
            const raw = res.raw || res;
            const contentType = getContentType(raw);
            
            const serialized = {
                statusCode: raw.statusCode,
                responseTime: res.responseTime || 'N/A'
            };

            const body = res.body ?? raw.body;
            
            if (body !== undefined) {
                if (body === null) {
                    serialized.body = '[NO CONTENT]';
                } else if (typeof body === 'string' && !body) {
                    serialized.body = '[EMPTY STRING]';
                } else if (contentType.includes('application/json')) {
                    serialized.body = sanitizeBody(body);
                } else if (contentType.includes('text/') || 
                          contentType.includes('html') || 
                          typeof body === 'string') {
                    const stringBody = String(body);
                    serialized.body = stringBody.length > CONTENT_LIMITS.STRING_RESPONSE
                        ? `${stringBody.slice(0, CONTENT_LIMITS.STRING_RESPONSE)}... [TRUNCATED]`
                        : stringBody;
                } else if (contentType.includes('image/')) {
                    serialized.body = '[IMAGE CONTENT]';
                } else if (Buffer.isBuffer(body)) {
                    serialized.body = '[BUFFER CONTENT]';
                } else if (typeof body === 'object') {
                    serialized.body = sanitizeBody(body);
                } else {
                    serialized.body = String(body);
                }
            }

            if (res.error) {
                serialized.error = serializers.err(res.error);
            }

            return serialized;
        } catch (err) {
            return {
                error: 'Failed to serialize response',
                message: err.message
            };
        }
    },

    /**
     * Serialize error object
     * @param {Error} err - Error object
     * @returns {object} Serialized error
     */
    err: (err) => {
        if (!err) return err;
        console.log(err);
        try {
            return {
                type: err.type || err.name,
                message: err.message,
                code: err.code,
                stack: err.stack,
                statusCode: err.statusCode || err.status,
                ...(err.details && { details: err.details }),
                ...(err.context && { context: sanitizeBody(err.context) })
            };
        } catch (e) {
            return {
                error: 'Failed to serialize error',
                message: e.message
            };
        }
    }
};

module.exports = { serializers, getContentType };