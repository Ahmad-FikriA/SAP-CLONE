'use strict';

const { expectSuccess, expectArray, expectObject, authRequest } = require('./setup');

describe('📄 Lembar Kerja API Tests', () => {
  let testLkNumber = null;

  describe('GET /api/lk', () => {
    it('should list all Lembar Kerja', async () => {
      const response = await authRequest('get', '/lk');
      const lks = expectArray(response);
      
      if (lks.length > 0) {
        lks.forEach(lk => {
          expect(lk).toHaveProperty('lkNumber');
          expect(lk).toHaveProperty('category');
          expect(lk).toHaveProperty('status');
          expect(lk).toHaveProperty('spkModels');
          expect(Array.isArray(lk.spkModels)).toBe(true);
        });
      }
      
      console.log(`  ✓ Listed ${lks.length} Lembar Kerja`);
    });

    it('should filter LK by category', async () => {
      const response = await authRequest('get', '/lk?category=Listrik');
      const lks = expectArray(response);
      
      lks.forEach(lk => {
        expect(lk.category).toBe('Listrik');
      });
      
      console.log(`  ✓ Filtered ${lks.length} Listrik LK`);
    });
  });

  describe('GET /api/lk/:lkNumber', () => {
    it('should get single LK with SPK details', async () => {
      const listResponse = await authRequest('get', '/lk');
      const lks = expectArray(listResponse);
      
      if (lks.length === 0) {
        console.log('  ⚠ Skipping: No LK available');
        return;
      }

      const lkNumber = lks[0].lkNumber;
      const response = await authRequest('get', `/lk/${lkNumber}`);
      const body = expectObject(response);
      
      expect(body.lkNumber).toBe(lkNumber);
      expect(body).toHaveProperty('spkModels');
      
      console.log('  ✓ Retrieved LK details:', lkNumber);
    });

    it('should return 404 for non-existent LK', async () => {
      const response = await authRequest('get', '/lk/LK-NONEXISTENT');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Non-existent LK returns 404');
    });
  });

  describe('POST /api/lk', () => {
    it('should create new Lembar Kerja', async () => {
      const timestamp = Date.now();
      const newLk = {
        lkNumber: `TEST-LK-${timestamp}`,
        category: 'Mekanik',
        status: 'pending',
        lembarKe: 1,
        totalLembar: 1,
        periodeStart: '2026-03-01T00:00:00.000Z',
        periodeEnd: '2026-03-31T23:59:59.000Z',
        spkModels: ['SPK-2026-001'],
      };

      const response = await authRequest('post', '/lk').send(newLk);
      const body = expectObject(response, 201);
      
      expect(body.lkNumber).toBe(newLk.lkNumber);
      expect(body.category).toBe(newLk.category);
      
      testLkNumber = body.lkNumber;
      console.log('  ✓ Created new LK:', testLkNumber);
    });

    it('should reject duplicate LK number', async () => {
      if (!testLkNumber) {
        console.log('  ⚠ Skipping: No test LK created');
        return;
      }

      const response = await authRequest('post', '/lk').send({
        lkNumber: testLkNumber,
        category: 'Mekanik',
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Duplicate LK number rejected');
    });
  });

  describe('PUT /api/lk/:lkNumber', () => {
    it('should update existing LK', async () => {
      if (!testLkNumber) {
        console.log('  ⚠ Skipping: No test LK created');
        return;
      }

      const response = await authRequest('put', `/lk/${testLkNumber}`)
        .send({
          evaluasi: 'Updated evaluation text',
        });

      const body = expectObject(response);
      expect(body.evaluasi).toBe('Updated evaluation text');
      
      console.log('  ✓ Updated LK:', testLkNumber);
    });
  });

  describe('POST /api/lk/:lkNumber/submit', () => {
    it('should submit Lembar Kerja', async () => {
      if (!testLkNumber) {
        console.log('  ⚠ Skipping: No test LK created');
        return;
      }

      const response = await authRequest('post', `/lk/${testLkNumber}/submit`)
        .send({
          evaluasi: 'Final evaluation for submission',
        });

      expectSuccess(response);
      console.log('  ✓ Submitted LK:', testLkNumber);
    });
  });

  describe('DELETE /api/lk/:lkNumber', () => {
    it('should delete LK', async () => {
      if (!testLkNumber) {
        console.log('  ⚠ Skipping: No test LK created');
        return;
      }

      const response = await authRequest('delete', `/lk/${testLkNumber}`);
      expectSuccess(response);
      
      console.log('  ✓ Deleted LK:', testLkNumber);
    });
  });
});
