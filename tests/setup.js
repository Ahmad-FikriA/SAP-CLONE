'use strict';

/**
 * Test Setup & Utilities
 * Run before each test file
 */

const request = require('supertest');
const app = require('../src/server');
const sequelize = require('../src/config/database');

// Global test utilities
global.request = request;
global.app = app;
global.sequelize = sequelize;

// Test configuration
const TEST_CONFIG = {
  BASE_URL: '/api',
  TIMEOUT: 30000,
  DEFAULT_USER: {
    username: 'admin_01',
    password: 'password123',
  },
};

// Test state
let authToken = null;
let testUser = null;

/**
 * Get or create auth token
 */
const getAuthToken = async () => {
  if (authToken) return authToken;

  const response = await request(app)
    .post(`${TEST_CONFIG.BASE_URL}/auth/login`)
    .send(TEST_CONFIG.DEFAULT_USER);

  if (response.status !== 200) {
    throw new Error(`Failed to authenticate: ${response.body.error}`);
  }

  authToken = response.body.token;
  testUser = response.body.user;
  return authToken;
};

/**
 * Get test user info
 */
const getTestUser = () => testUser;

/**
 * Make authenticated request
 */
const authRequest = (method, path) => {
  const req = request(app)[method](`${TEST_CONFIG.BASE_URL}${path}`);
  if (authToken) {
    req.set('Authorization', `Bearer ${authToken}`);
  }
  return req;
};

/**
 * Test response helper
 */
const expectSuccess = (response, expectedStatus = 200) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toBeDefined();
  
  // Check for error in response
  if (response.body.error) {
    throw new Error(`API returned error: ${response.body.error}`);
  }
  
  return response.body;
};

/**
 * Test response with array
 */
const expectArray = (response, minLength = 0) => {
  const body = expectSuccess(response);
  expect(Array.isArray(body)).toBe(true);
  if (minLength > 0) {
    expect(body.length).toBeGreaterThanOrEqual(minLength);
  }
  return body;
};

/**
 * Test response with object
 */
const expectObject = (response, statusOrFields = 200, requiredFields = []) => {
  // Handle both: expectObject(response, 201) and expectObject(response, ['id', 'name'])
  let expectedStatus = 200;
  let fields = requiredFields;
  
  if (typeof statusOrFields === 'number') {
    expectedStatus = statusOrFields;
  } else if (Array.isArray(statusOrFields)) {
    fields = statusOrFields;
  }
  
  const body = expectSuccess(response, expectedStatus);
  expect(typeof body).toBe('object');
  expect(Array.isArray(body)).toBe(false);
  
  fields.forEach(field => {
    expect(body).toHaveProperty(field);
  });
  
  return body;
};

/**
 * Log test results
 */
const logTest = (module, testName, status, details = '') => {
  const timestamp = new Date().toISOString();
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`[${timestamp}] ${icon} [${module}] ${testName} ${details}`);
};

/**
 * Validate API response structure
 */
const validateResponse = (body, schema) => {
  const errors = [];
  
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in body)) {
      errors.push(`Missing field: ${key}`);
      continue;
    }
    
    const actualType = Array.isArray(body[key]) ? 'array' : typeof body[key];
    if (actualType !== type && type !== 'any') {
      errors.push(`Type mismatch for ${key}: expected ${type}, got ${actualType}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation errors:\n${errors.join('\n')}`);
  }
  
  return true;
};

// Setup before all tests
beforeAll(async () => {
  // Wait for database connection
  await sequelize.authenticate();
  
  // Get auth token
  await getAuthToken();
  
  console.log('\n🧪 Starting API Tests...\n');
}, TEST_CONFIG.TIMEOUT);

// Cleanup after all tests
afterAll(async () => {
  await sequelize.close();
  console.log('\n✅ API Tests Completed\n');
});

// Reset auth token before each test
beforeEach(() => {
  // Keep the token for subsequent tests
});

module.exports = {
  TEST_CONFIG,
  getAuthToken,
  getTestUser,
  authRequest,
  expectSuccess,
  expectArray,
  expectObject,
  logTest,
  validateResponse,
};
