// server/jest.config.js
// Jest configuration for NovaPOS backend tests.

require('dotenv').config({ path: '.env.test' });

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: [
        '**/backend/**/*.test.js',
    ],
    testTimeout: 30000,
    forceExit: true,
    detectOpenHandles: true,
    verbose: true,
};