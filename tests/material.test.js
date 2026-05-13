const request = require('supertest');
const app = require('../src/server');
const { Material, User } = require('../src/models/associations');
const { authRequest, expectSuccess, expectObject } = require('./setup');

describe('Material API', () => {
  let adminToken;
  let testMaterial;

  beforeAll(async () => {
    // Get token for an admin user (assuming seed exists)
    const admin = await User.findOne({ where: { role: 'admin' } });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ nik: admin.nik, password: 'password' }); // Adjust if default password is different
    adminToken = loginRes.body.token;

    // Clear materials before tests
    await Material.destroy({ where: {}, truncate: true });
  });

  it('should create a new material', async () => {
    const res = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        materialCode: 'TEST-MAT-001',
        name: 'Test Material',
        quantity: 10,
        price: 5000,
        cabinetCode: 'TEST-CAB'
      });

    expectSuccess(res, 201);
    expectObject(res, ['materialCode', 'name', 'quantity', 'price', 'cabinetCode']);
    testMaterial = res.body.data;
  });

  it('should get all materials', async () => {
    const res = await request(app)
      .get('/api/materials')
      .set('Authorization', `Bearer ${adminToken}`);

    expectSuccess(res, 200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should filter materials by search', async () => {
    const res = await request(app)
      .get('/api/materials?search=Test')
      .set('Authorization', `Bearer ${adminToken}`);

    expectSuccess(res, 200);
    expect(res.body.data.some(m => m.name === 'Test Material')).toBe(true);
  });

  it('should update a material', async () => {
    const res = await request(app)
      .put(`/api/materials/${testMaterial.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Test Material',
        quantity: 15
      });

    expectSuccess(res, 200);
    expect(res.body.data.name).toBe('Updated Test Material');
    expect(res.body.data.quantity).toBe(15);
  });

  it('should delete a material', async () => {
    const res = await request(app)
      .delete(`/api/materials/${testMaterial.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expectSuccess(res, 200);
    
    const deleted = await Material.findByPk(testMaterial.id);
    expect(deleted).toBeNull();
  });
});
