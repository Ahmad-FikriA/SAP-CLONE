'use strict';

const { expectSuccess, expectObject, validateResponse, TEST_CONFIG } = require('./setup');

describe('🔐 Authentication API Tests', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post(`${TEST_CONFIG.BASE_URL}/auth/login`)
        .send({
          username: 'admin_01',
          password: 'password123',
        });

      const body = expectObject(response, ['token', 'user']);
      
      // Validate token structure
      expect(body.token).toBeTruthy();
      expect(typeof body.token).toBe('string');
      expect(body.token.length).toBeGreaterThan(10);
      
      // Validate user structure
      validateResponse(body.user, {
        id: 'string',
        name: 'string',
        username: 'string',
        role: 'string',
        email: 'string',
      });
      
      console.log('  ✓ Login with valid credentials works');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post(`${TEST_CONFIG.BASE_URL}/auth/login`)
        .send({
          username: 'admin_01',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Invalid credentials rejected');
    });

    it('should reject missing credentials', async () => {
      const response = await request(app)
        .post(`${TEST_CONFIG.BASE_URL}/auth/login`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Missing credentials rejected');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post(`${TEST_CONFIG.BASE_URL}/auth/login`)
        .send({
          username: 'nonexistent_user',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Non-existent user rejected');
    });
  });

  describe('Protected Routes Authentication', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get(`${TEST_CONFIG.BASE_URL}/users`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Routes without token rejected');
    });

    it('should reject requests with invalid token format', async () => {
      const response = await request(app)
        .get(`${TEST_CONFIG.BASE_URL}/users`)
        .set('Authorization', 'InvalidToken');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Invalid token format rejected');
    });

    it('should reject requests with malformed bearer token', async () => {
      const response = await request(app)
        .get(`${TEST_CONFIG.BASE_URL}/users`)
        .set('Authorization', 'Bearer invalid_token_here');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Malformed bearer token rejected');
    });
  });
});
