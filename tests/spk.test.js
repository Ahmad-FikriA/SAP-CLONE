'use strict';

const { expectSuccess, expectArray, expectObject, authRequest } = require('./setup');

describe('📋 Preventive SPK API Tests', () => {
  let testSpkNumber = null;

  describe('GET /api/spk', () => {
    it('should list all SPKs', async () => {
      const response = await authRequest('get', '/spk');
      const spks = expectArray(response);
      
      if (spks.length > 0) {
        // Validate SPK structure
        spks.forEach(spk => {
          expect(spk).toHaveProperty('spkNumber');
          expect(spk).toHaveProperty('description');
          expect(spk).toHaveProperty('category');
          expect(spk).toHaveProperty('status');
          expect(spk).toHaveProperty('equipmentModels');
          expect(spk).toHaveProperty('activitiesModel');
          expect(Array.isArray(spk.equipmentModels)).toBe(true);
          expect(Array.isArray(spk.activitiesModel)).toBe(true);
        });
      }
      
      console.log(`  ✓ Listed ${spks.length} SPKs`);
    });

    it('should filter SPKs by category', async () => {
      const response = await authRequest('get', '/spk?category=Mekanik');
      const spks = expectArray(response);
      
      spks.forEach(spk => {
        expect(spk.category).toBe('Mekanik');
      });
      
      console.log(`  ✓ Filtered ${spks.length} Mekanik SPKs`);
    });
  });

  describe('GET /api/spk/:spkNumber', () => {
    it('should get single SPK with details', async () => {
      // First get list to find an existing SPK
      const listResponse = await authRequest('get', '/spk');
      const spks = expectArray(listResponse);
      
      if (spks.length === 0) {
        console.log('  ⚠ Skipping: No SPKs available');
        return;
      }

      const spkNumber = spks[0].spkNumber;
      const response = await authRequest('get', `/spk/${spkNumber}`);
      const body = expectObject(response);
      
      expect(body.spkNumber).toBe(spkNumber);
      expect(body).toHaveProperty('equipmentModels');
      expect(body).toHaveProperty('activitiesModel');
      
      console.log('  ✓ Retrieved SPK details:', spkNumber);
    });

    it('should return 404 for non-existent SPK', async () => {
      const response = await authRequest('get', '/spk/SPK-NONEXISTENT');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Non-existent SPK returns 404');
    });
  });

  describe('POST /api/spk', () => {
    it('should create new SPK', async () => {
      const timestamp = Date.now();
      const newSpk = {
        spkNumber: `TEST-SPK-${timestamp}`,
        description: 'Test SPK for automated testing',
        interval: '1 Bulan',
        category: 'Mekanik',
        status: 'pending',
        equipmentModels: [
          {
            equipmentId: 'EQ-001',
            equipmentName: 'Test Equipment',
            functionalLocation: 'Test Location',
          },
        ],
        activitiesModel: [
          {
            activityNumber: 'ACT-001',
            operationText: 'Test operation',
            durationPlan: 1.0,
          },
        ],
      };

      const response = await authRequest('post', '/spk').send(newSpk);
      const body = expectObject(response, 201);
      
      expect(body.spkNumber).toBe(newSpk.spkNumber);
      expect(body.description).toBe(newSpk.description);
      expect(body.category).toBe(newSpk.category);
      expect(body.status).toBe(newSpk.status);
      expect(body.equipmentModels).toHaveLength(1);
      expect(body.activitiesModel).toHaveLength(1);
      
      testSpkNumber = body.spkNumber;
      console.log('  ✓ Created new SPK:', testSpkNumber);
    });

    it('should reject duplicate SPK number', async () => {
      if (!testSpkNumber) {
        console.log('  ⚠ Skipping: No test SPK created');
        return;
      }

      const response = await authRequest('post', '/spk').send({
        spkNumber: testSpkNumber,
        description: 'Duplicate SPK',
        category: 'Mekanik',
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Duplicate SPK number rejected');
    });

    it('should reject SPK without required fields', async () => {
      const response = await authRequest('post', '/spk').send({
        description: 'SPK without number',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Missing required fields rejected');
    });
  });

  describe('PUT /api/spk/:spkNumber', () => {
    it('should update existing SPK', async () => {
      if (!testSpkNumber) {
        console.log('  ⚠ Skipping: No test SPK created');
        return;
      }

      const response = await authRequest('put', `/spk/${testSpkNumber}`)
        .send({
          description: 'Updated test SPK description',
          status: 'in_progress',
        });

      const body = expectObject(response);
      expect(body.description).toBe('Updated test SPK description');
      expect(body.status).toBe('in_progress');
      
      console.log('  ✓ Updated SPK:', testSpkNumber);
    });

    it('should reject update for non-existent SPK', async () => {
      const response = await authRequest('put', '/spk/SPK-NONEXISTENT')
        .send({
          description: 'Should not update',
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Non-existent SPK update rejected');
    });
  });

  describe('POST /api/spk/:spkNumber/submit', () => {
    it('should submit SPK', async () => {
      if (!testSpkNumber) {
        console.log('  ⚠ Skipping: No test SPK created');
        return;
      }

      const response = await authRequest('post', `/spk/${testSpkNumber}/submit`)
        .send({
          durationActual: 2.5,
          activityResultsModel: [
            {
              activityNumber: 'ACT-001',
              resultComment: 'Test result',
              isNormal: true,
              isVerified: true,
              durationActual: 1.0,
            },
          ],
          photoPaths: [],
          evaluasi: 'Test evaluation',
          latitude: -6.1751,
          longitude: 106.8650,
        });

      expectSuccess(response);
      expect(response.body).toHaveProperty('submissionId');
      
      console.log('  ✓ Submitted SPK:', testSpkNumber);
    });
  });

  describe('POST /api/spk/:spkNumber/sync', () => {
    it('should sync SPK to SAP (mock)', async () => {
      // Get an existing SPK
      const listResponse = await authRequest('get', '/spk');
      const spks = expectArray(listResponse);
      
      if (spks.length === 0) {
        console.log('  ⚠ Skipping: No SPKs available');
        return;
      }

      const spkNumber = spks[0].spkNumber;
      const response = await authRequest('post', `/spk/${spkNumber}/sync`);
      
      expectSuccess(response);
      expect(response.body).toHaveProperty('syncedAt');
      
      console.log('  ✓ Synced SPK to SAP (mock):', spkNumber);
    });
  });

  describe('DELETE /api/spk/:spkNumber', () => {
    it('should delete SPK', async () => {
      if (!testSpkNumber) {
        console.log('  ⚠ Skipping: No test SPK created');
        return;
      }

      const response = await authRequest('delete', `/spk/${testSpkNumber}`);
      expectSuccess(response);
      
      console.log('  ✓ Deleted SPK:', testSpkNumber);
    });

    it('should reject delete for non-existent SPK', async () => {
      const response = await authRequest('delete', '/spk/SPK-NONEXISTENT');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Non-existent SPK delete rejected');
    });
  });

  describe('POST /api/spk/bulk-delete', () => {
    it('should bulk delete SPKs', async () => {
      // Create test SPKs
      const testSpks = [];
      const timestamp = Date.now();
      
      for (let i = 0; i < 3; i++) {
        const newSpk = {
          spkNumber: `BULK-SPK-${timestamp}-${i}`,
          description: `Bulk test SPK ${i}`,
          category: 'Mekanik',
          status: 'pending',
        };
        
        const createResponse = await authRequest('post', '/spk').send(newSpk);
        if (createResponse.status === 201) {
          testSpks.push(createResponse.body.spkNumber);
        }
      }

      if (testSpks.length === 0) {
        console.log('  ⚠ Skipping: Could not create test SPKs');
        return;
      }

      const response = await authRequest('post', '/spk/bulk-delete')
        .send({ ids: testSpks });

      const body = expectSuccess(response);
      expect(body.message).toContain(testSpks.length.toString());
      
      console.log(`  ✓ Bulk deleted ${testSpks.length} SPKs`);
    });

    it('should reject bulk delete without ids', async () => {
      const response = await authRequest('post', '/spk/bulk-delete').send({});
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      console.log('  ✓ Missing ids rejected for bulk delete');
    });
  });
});
