module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
      '/node_modules/',
      '/dist/',
      '/__tests__/',
      '/examples/'
  ],
  setupFilesAfterEnv: [
      '<rootDir>/__tests__/setup.js'
  ],
  testMatch: [
      '**/__tests__/**/*.test.js'
  ],
  moduleFileExtensions: ['js', 'json'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  silent: false,  // <--- Add this line to ensure console logs are printed
  coverageThreshold: {
      global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50
      }
  }
};