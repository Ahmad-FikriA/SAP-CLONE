'use strict';

const request = require('supertest');
const app = require('../src/server');
const { getAuthToken } = require('./setup');
const User = require('../src/models/User');

describe('Admin Utility API Endpoints', () => {
  let adminToken;
  let nonAdminToken;
  let nonAdminUser;

  beforeAll(async () => {
    // Admin token is setup by tests/setup.js
    adminToken = await getAuthToken();

    // Create a non-admin user and get token
    const testNik = '999999';
    nonAdminUser = await User.create({
      id: testNik,
      nik: testNik,
      name: 'Test Non-Admin User',
      password: 'password123',
      role: 'planner', // not admin
      divisi: 'Perencanaan',
      group: 'perencanaan',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ nik: testNik, password: 'password123' });
    nonAdminToken = res.body.token;
  });

  afterAll(async () => {
    // Cleanup non-admin user
    if (nonAdminUser) {
      await nonAdminUser.destroy();
    }
  });

  describe('Authorization Gate checks', () => {
    it('should deny access to GET /api/utility/status for non-admin users', async () => {
      const res = await request(app)
        .get('/api/utility/status')
        .set('Authorization', `Bearer ${nonAdminToken}`);
      
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Akses ditolak');
    });

    it('should allow access to GET /api/utility/status for admin users', async () => {
      const res = await request(app)
        .get('/api/utility/status')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('dbStatus');
      expect(res.body).toHaveProperty('connections');
      expect(res.body).toHaveProperty('memory');
    });
  });

  describe('Utility Features checks', () => {
    it('should retrieve system logs successfully', async () => {
      const res = await request(app)
        .get('/api/utility/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });

    it('should execute administrative commands successfully via CLI', async () => {
      const res = await request(app)
        .post('/api/utility/command')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: '/version' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.output).toContain('Console API v1.4.2-Prod');
    });

    it('should manually register mock errors via CLI', async () => {
      // Trigger a mock error
      const mockErrRes = await request(app)
        .post('/api/utility/command')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: '/mock-error' });

      expect(mockErrRes.status).toBe(200);

      // Verify the log is now in the log list
      const logsRes = await request(app)
        .get('/api/utility/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      const hasMockError = logsRes.body.logs.some(l => l.level === 'ERROR' && l.message.includes('TypeError'));
      expect(hasMockError).toBe(true);
    });


    it('should export database table dynamically in json format', async () => {
      const res = await request(app)
        .get('/api/utility/export?tables=users&format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body).toHaveProperty('users');
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('should export database table dynamically in csv format', async () => {
      const res = await request(app)
        .get('/api/utility/export?tables=users&format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('should export database table dynamically in Excel (xlsx) format', async () => {
      const res = await request(app)
        .get('/api/utility/export?tables=users&format=xlsx')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheet');
    });
  });

  describe('Module-Based Bulk Operations', () => {
    it('should export data for a specific module', async () => {
      const res = await request(app)
        .get('/api/utility/module/export?module=supervisi')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body).toHaveProperty('SupervisiJob');
      expect(res.body).toHaveProperty('SupervisiVisit');
      expect(res.body).toHaveProperty('SupervisiAmend');
    });

    it('should reject invalid module export', async () => {
      const res = await request(app)
        .get('/api/utility/module/export?module=invalid_module')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should clear data for a specific module', async () => {
      const res = await request(app)
        .delete('/api/utility/module/clear?module=supervisi')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Berhasil menghapus');
    });

    it('should import data for a specific module', async () => {
      const payload = {
        SupervisiJob: [],
        SupervisiVisit: [],
        SupervisiAmend: []
      };

      const res = await request(app)
        .post('/api/utility/module/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ module: 'supervisi', data: payload });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Berhasil mengimpor');
    });
  });

  describe('Users Module Bulk Operations', () => {
    const testUsers = [
      {
        id: 'USR-BULK-001',
        nik: 'BULK001',
        name: 'Bulk Test User 1',
        role: 'teknisi',
        divisi: 'Engineering',
        dinas: 'Mekanik',
        group: 'mekanik',
      },
      {
        id: 'USR-BULK-002',
        nik: 'BULK002',
        name: 'Bulk Test User 2',
        role: 'teknisi',
        divisi: 'Engineering',
        dinas: 'Listrik',
        group: 'listrik',
      },
    ];

    // Cleanup test users after all tests
    afterAll(async () => {
      await User.destroy({ where: { id: ['USR-BULK-001', 'USR-BULK-002'] } });
    });

    it('should export users module data as JSON', async () => {
      const res = await request(app)
        .get('/api/utility/module/export?module=users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body).toHaveProperty('User');
      expect(Array.isArray(res.body.User)).toBe(true);
    });

    it('should strip password field from exported users', async () => {
      const res = await request(app)
        .get('/api/utility/module/export?module=users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Verify no user record has a password field
      for (const user of res.body.User) {
        expect(user).not.toHaveProperty('password');
      }
    });

    it('should import users module data with default password', async () => {
      const payload = {
        User: testUsers, // no password field → should default to 'password123'
      };

      const res = await request(app)
        .post('/api/utility/module/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ module: 'users', data: payload });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Berhasil mengimpor');

      // Verify users actually exist in DB
      const u1 = await User.findByPk('USR-BULK-001');
      expect(u1).not.toBeNull();
      expect(u1.name).toBe('Bulk Test User 1');

      const u2 = await User.findByPk('USR-BULK-002');
      expect(u2).not.toBeNull();
      expect(u2.name).toBe('Bulk Test User 2');
    });

    it('should re-import (upsert) users without error', async () => {
      const updatedUsers = testUsers.map(u => ({
        ...u,
        name: u.name + ' Updated',
      }));

      const res = await request(app)
        .post('/api/utility/module/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ module: 'users', data: { User: updatedUsers } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify name was updated (upsert)
      const u1 = await User.findByPk('USR-BULK-001');
      expect(u1.name).toBe('Bulk Test User 1 Updated');
    });

    it('should import with empty User array without error', async () => {
      const res = await request(app)
        .post('/api/utility/module/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ module: 'users', data: { User: [] } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should clear (delete) all users module data', async () => {
      // First insert a test user specifically for deletion
      await User.create({
        id: 'USR-DELETE-TEST',
        nik: 'DELTEST99',
        name: 'Delete Test',
        password: 'password123',
        role: 'teknisi',
        divisi: 'Test',
      });

      const res = await request(app)
        .delete('/api/utility/module/clear?module=users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Berhasil menghapus');

      // Verify the user is gone
      const deleted = await User.findByPk('USR-DELETE-TEST');
      expect(deleted).toBeNull();
    });
  });
});
