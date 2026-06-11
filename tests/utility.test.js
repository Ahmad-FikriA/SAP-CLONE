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
});
