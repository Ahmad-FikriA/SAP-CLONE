'use strict';

const { expectSuccess, expectArray, expectObject, authRequest, validateResponse } = require('./setup');

describe('👥 Users API Tests', () => {
  let testUserId = null;

  describe('GET /api/users', () => {
    it('should list all users', async () => {
      const response = await authRequest('get', '/users');
      const users = expectArray(response, 1);
      
      // Validate user structure
      users.forEach(user => {
        validateResponse(user, {
          id: 'string',
          nik: 'string',
          name: 'string',
          role: 'string',
        });
        // Password should not be exposed
        expect(user).not.toHaveProperty('password');
      });
      
      console.log(`  ✓ Listed ${users.length} users`);
    });

    it('should filter users by role', async () => {
      const response = await authRequest('get', '/users?role=admin');
      const users = expectArray(response);
      
      users.forEach(user => {
        expect(user.role).toBe('admin');
      });
      
      console.log(`  ✓ Filtered ${users.length} admin users`);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const newUser = {
        id: `TEST-${Date.now()}`,
        nik: `testnik_${Date.now()}`,
        password: 'testpass123',
        name: 'Test User',
        role: 'teknisi',
        email: 'test@example.com',
        divisi: 'Test Divisi'
      };

      const response = await authRequest('post', '/users')
        .send(newUser);

      const body = expectObject(response, 201);
      expect(body.id).toBe(newUser.id);
      expect(body.nik).toBe(newUser.nik);
      expect(body.name).toBe(newUser.name);
      expect(body.role).toBe(newUser.role);
      expect(body).not.toHaveProperty('password');
      
      testUserId = body.id;
      console.log('  ✓ Created new user:', body.nik);
    });

    it('should reject duplicate nik', async () => {
      const response = await authRequest('post', '/users')
        .send({
          id: `TEST-${Date.now() + 1}`,
          nik: '100001', // Existing username
          password: 'testpass123',
          name: 'Duplicate User',
          role: 'teknisi',
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Duplicate username rejected');
    });

    it('should reject missing required fields', async () => {
      const response = await authRequest('post', '/users')
        .send({
          name: 'Incomplete User',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Missing required fields rejected');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update existing user', async () => {
      if (!testUserId) {
        console.log('  ⚠ Skipping: No test user created');
        return;
      }

      const response = await authRequest('put', `/users/${testUserId}`)
        .send({
          name: 'Updated Test User',
          email: 'updated@example.com',
        });

      const body = expectObject(response);
      expect(body.name).toBe('Updated Test User');
      expect(body.email).toBe('updated@example.com');
      
      console.log('  ✓ Updated user:', testUserId);
    });

    it('should reject update for non-existent user', async () => {
      const response = await authRequest('put', '/users/NONEXISTENT')
        .send({
          name: 'Should Not Update',
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Non-existent user update rejected');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user', async () => {
      if (!testUserId) {
        console.log('  ⚠ Skipping: No test user created');
        return;
      }

      const response = await authRequest('delete', `/users/${testUserId}`);
      expectSuccess(response);
      
      console.log('  ✓ Deleted user:', testUserId);
    });

    it('should reject delete for non-existent user', async () => {
      const response = await authRequest('delete', '/users/NONEXISTENT');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Non-existent user delete rejected');
    });
  });

  describe('POST /api/users/bulk-delete', () => {
    it('should bulk delete users', async () => {
      // Create test users first
      const testUsers = [];
      for (let i = 0; i < 3; i++) {
        const newUser = {
          id: `BULK-${Date.now()}-${i}`,
          nik: `bulkuser_${Date.now()}_${i}`,
          password: 'testpass123',
          name: `Bulk Test User ${i}`,
          role: 'teknisi',
          divisi: 'Test Divisi'
        };
        
        const createResponse = await authRequest('post', '/users').send(newUser);
        if (createResponse.status === 201) {
          testUsers.push(createResponse.body.id);
        }
      }

      if (testUsers.length === 0) {
        console.log('  ⚠ Skipping: Could not create test users');
        return;
      }

      const response = await authRequest('post', '/users/bulk-delete')
        .send({ ids: testUsers });

      const body = expectSuccess(response);
      expect(body.message).toContain(testUsers.length.toString());
      
      console.log(`  ✓ Bulk deleted ${testUsers.length} users`);
    });

    it('should reject bulk delete without ids', async () => {
      const response = await authRequest('post', '/users/bulk-delete')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Missing ids rejected for bulk delete');
    });
  });
});
