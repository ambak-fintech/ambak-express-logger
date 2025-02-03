// __tests__/unit/sanitizers.test.js
const { 
    sanitizeHeaders, 
    sanitizeBody,
    sanitizeValue
} = require('../../src/utils/sanitizers');

describe('Sanitizers', () => {
    describe('sanitizeHeaders', () => {
        it('should redact sensitive headers', () => {
            const headers = {
                'authorization': 'Bearer token123',
                'x-api-key': 'secret-key',
                'content-type': 'application/json',
                'user-agent': 'test-agent'
            };

            const sanitized = sanitizeHeaders(headers);
            expect(sanitized.authorization).toBe('[REDACTED]');
            expect(sanitized['x-api-key']).toBe('[REDACTED]');
            expect(sanitized['content-type']).toBe('application/json');
            expect(sanitized['user-agent']).toBe('test-agent');
        });

        it('should handle empty or invalid input', () => {
            expect(sanitizeHeaders(null)).toEqual({});
            expect(sanitizeHeaders(undefined)).toEqual({});
            expect(sanitizeHeaders({})).toEqual({});
        });
    });

    describe('sanitizeBody', () => {
        it('should redact sensitive fields in objects', () => {
            const body = {
                username: 'test',
                password: 'secret123',
                email: 'test@example.com',
                data: {
                    creditCard: '4111-1111-1111-1111'
                }
            };

            const sanitized = sanitizeBody(body);
            expect(sanitized.username).toBe('test');
            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.email).toBe('[REDACTED]');
            expect(sanitized.data.creditCard).toBe('[REDACTED]');
        });

        it('should handle arrays', () => {
            const array = [
                { password: 'secret' },
                { token: '12345' }
            ];

            const sanitized = sanitizeBody(array);
            expect(sanitized[0].password).toBe('[REDACTED]');
            expect(sanitized[1].token).toBe('[REDACTED]');
        });

        it('should handle nested objects and arrays', () => {
            const complex = {
                user: {
                    credentials: {
                        password: 'secret123',
                        token: '12345'
                    },
                    profile: {
                        name: 'John',
                        email: 'john@example.com'
                    }
                },
                settings: [
                    { apiKey: 'sensitive' },
                    { public: true }
                ]
            };

            const sanitized = sanitizeBody(complex);
            
            // Test nested object sanitization
            expect(sanitized.user).toBeDefined();
            expect(sanitized.user.credentials).toBeDefined();
            expect(sanitized.user.credentials.password).toBe('[REDACTED]');
            expect(sanitized.user.credentials.token).toBe('[REDACTED]');
            
            // Test non-sensitive fields remain unchanged
            expect(sanitized.user.profile.name).toBe('John');
            expect(sanitized.user.profile.email).toBe('[REDACTED]');
            
            // Test array of objects
            expect(sanitized.settings).toBeDefined();
            expect(sanitized.settings[0].apiKey).toBe('[REDACTED]');
            expect(sanitized.settings[1].public).toBe(true);
        });

        it('should handle null and undefined values', () => {
            const data = {
                nullField: null,
                undefinedField: undefined,
                emptyString: '',
                password: 'secret'
            };

            const sanitized = sanitizeBody(data);
            expect(sanitized.nullField).toBeNull();
            expect(sanitized.undefinedField).toBeUndefined();
            expect(sanitized.emptyString).toBe('');
            expect(sanitized.password).toBe('[REDACTED]');
        });

        it('should handle edge cases', () => {
            const edge = {
                nested: {
                    deep: {
                        deeper: {
                            password: 'secret'
                        }
                    }
                },
                emptyObject: {},
                emptyArray: [],
                mixedArray: [
                    { password: 'secret' },
                    null,
                    undefined,
                    { normal: 'value' }
                ]
            };

            const sanitized = sanitizeBody(edge);
            expect(sanitized.nested.deep.deeper.password).toBe('[REDACTED]');
            expect(sanitized.emptyObject).toEqual({});
            expect(sanitized.emptyArray).toEqual([]);
            expect(sanitized.mixedArray[0].password).toBe('[REDACTED]');
            expect(sanitized.mixedArray[1]).toBeNull();
            expect(sanitized.mixedArray[2]).toBeUndefined();
            expect(sanitized.mixedArray[3].normal).toBe('value');
        });
    });
});