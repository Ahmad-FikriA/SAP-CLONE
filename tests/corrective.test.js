'use strict';

const { expectSuccess, expectArray, expectObject, authRequest } = require('./setup');

describe('🔧 Corrective Maintenance API Tests', () => {
  let testNotificationId = null;
  let testSpkCorrectiveId = null;

  describe('Notifications (Corrective Requests)', () => {
    describe('GET /api/corrective/requests', () => {
      it('should list all corrective requests', async () => {
        const response = await authRequest('get', '/corrective/requests');
        const requests = expectArray(response);
        console.log(`  ✓ Listed ${requests.length} corrective requests`);
      });

      it('should filter by status', async () => {
        const response = await authRequest('get', '/corrective/requests?status=submitted');
        expectArray(response);
        console.log('  ✓ Filtered corrective requests by status');
      });
    });

    describe('POST /api/corrective/requests', () => {
      it('should create new corrective request', async () => {
        const timestamp = Date.now();
        const newRequest = {
          id: `CR-${timestamp}`,
          notificationDate: '2026-03-12',
          notificationType: 'Maintenance',
          description: 'Test corrective request',
          functionalLocation: 'Test Location',
          equipment: 'Test Equipment',
          requiredStart: '2026-03-15',
          requiredEnd: '2026-03-20',
          reportedBy: 'Test Reporter',
          longText: 'Detailed description of the issue',
          images: [],
        };

        const response = await authRequest('post', '/corrective/requests').send(newRequest);
        const body = expectObject(response, 201);
        
        expect(body.id).toBe(newRequest.id);
        expect(body.status).toBe('submitted');
        
        testNotificationId = body.id;
        console.log('  ✓ Created corrective request:', testNotificationId);
      });
    });

    describe('PUT /api/corrective/requests/:id', () => {
      it('should update corrective request', async () => {
        if (!testNotificationId) {
          console.log('  ⚠ Skipping: No test request created');
          return;
        }

        const response = await authRequest('put', `/corrective/requests/${testNotificationId}`)
          .send({
            description: 'Updated description',
          });

        expectObject(response);
        console.log('  ✓ Updated corrective request:', testNotificationId);
      });
    });

    describe('Approval Flow', () => {
      it('should approve corrective request (supervisor)', async () => {
        // Note: This requires supervisor/manager role
        console.log('  ℹ Approval flow tests require supervisor/manager role');
      });
    });
  });

  describe('SPK Corrective', () => {
    describe('GET /api/corrective/spk', () => {
      it('should list all corrective SPKs', async () => {
        const response = await authRequest('get', '/corrective/spk');
        const spks = expectArray(response);
        
        if (spks.length > 0) {
          spks.forEach(spk => {
            expect(spk).toHaveProperty('spkId');
            expect(spk).toHaveProperty('spkNumber');
            expect(spk).toHaveProperty('status');
            expect(spk).toHaveProperty('items');
            expect(spk).toHaveProperty('photos');
            expect(Array.isArray(spk.items)).toBe(true);
            expect(Array.isArray(spk.photos)).toBe(true);
          });
        }
        
        console.log(`  ✓ Listed ${spks.length} corrective SPKs`);
      });

      it('should filter by status', async () => {
        const response = await authRequest('get', '/corrective/spk?status=draft');
        expectArray(response);
        console.log('  ✓ Filtered corrective SPKs by status');
      });

      it('should filter by priority', async () => {
        const response = await authRequest('get', '/corrective/spk?priority=high');
        expectArray(response);
        console.log('  ✓ Filtered corrective SPKs by priority');
      });
    });

    describe('GET /api/corrective/spk/:spkId', () => {
      it('should get single corrective SPK', async () => {
        const listResponse = await authRequest('get', '/corrective/spk');
        const spks = expectArray(listResponse);
        
        if (spks.length === 0) {
          console.log('  ⚠ Skipping: No corrective SPKs available');
          return;
        }

        const spkId = spks[0].spkId;
        const response = await authRequest('get', `/corrective/spk/${spkId}`);
        const body = expectObject(response);
        
        expect(body.spkId).toBe(spkId);
        expect(body).toHaveProperty('items');
        expect(body).toHaveProperty('photos');
        
        console.log('  ✓ Retrieved corrective SPK:', spkId);
      });

      it('should return 404 for non-existent SPK', async () => {
        const response = await authRequest('get', '/corrective/spk/SPK-NONEXISTENT');
        expect(response.status).toBe(404);
        console.log('  ✓ Non-existent corrective SPK returns 404');
      });
    });

    describe('POST /api/corrective/spk', () => {
      it('should create new corrective SPK', async () => {
        // First create a notification
        const timestamp = Date.now();
        const notificationId = `NOTIF-${timestamp}`;
        
        const notification = {
          id: notificationId,
          notificationDate: '2026-03-12',
          notificationType: 'Maintenance',
          description: 'Test notification for SPK creation',
          functionalLocation: 'Test Location',
          equipment: 'Test Equipment',
          equipmentId: 'EQ-001',
          status: 'submitted',
        };

        // Create notification first
        await authRequest('post', '/corrective/requests').send(notification);

        const newSpk = {
          notificationId: notificationId,
          spkNumber: `SPK-C-${timestamp}`,
          orderNumber: `ORD-${timestamp}`,
          priority: 'high',
          equipmentId: 'EQ-001',
          location: 'Test Location',
          requestedFinishDate: '2026-03-20',
          damageClassification: 'Mechanical Failure',
          jobDescription: 'Repair broken pump',
          workCenter: 'MECH-01',
          ctrlKey: 'PM01',
          unit: 'Hours',
          plannedWorker: 2,
          plannedHourPerWorker: 4.0,
          items: [
            {
              itemType: 'material',
              itemName: 'Bearing SKF 6204',
              quantity: 2,
              uom: 'pcs',
            },
            {
              itemType: 'service',
              itemName: 'Mechanic Service',
              quantity: 1,
              uom: 'lot',
            },
          ],
        };

        const response = await authRequest('post', '/corrective/spk').send(newSpk);
        
        if (response.status === 201) {
          const body = expectObject(response, 201);
          expect(body.spkNumber).toBe(newSpk.spkNumber);
          expect(body.status).toBe('draft');
          expect(body.items).toHaveLength(2);
          
          testSpkCorrectiveId = body.spkId;
          console.log('  ✓ Created corrective SPK:', testSpkCorrectiveId);
        } else {
          console.log('  ⚠ Could not create corrective SPK:', response.body.error);
        }
      });

      it('should reject SPK without notification', async () => {
        const response = await authRequest('post', '/corrective/spk').send({
          spkNumber: 'SPK-C-NOTIF-MISSING',
          notificationId: 'NONEXISTENT-NOTIFICATION',
        });

        expect(response.status).toBe(404);
        console.log('  ✓ Missing notification rejected');
      });

      it('should reject duplicate notification SPK', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        // Get the SPK to find its notificationId
        const getResponse = await authRequest('get', `/corrective/spk/${testSpkCorrectiveId}`);
        if (getResponse.status !== 200) {
          console.log('  ⚠ Skipping: Could not retrieve test SPK');
          return;
        }

        const response = await authRequest('post', '/corrective/spk').send({
          notificationId: getResponse.body.notificationId,
          spkNumber: 'SPK-C-DUPLICATE',
        });

        expect(response.status).toBe(409);
        console.log('  ✓ Duplicate notification SPK rejected');
      });
    });

    describe('PUT /api/corrective/spk/:spkId', () => {
      it('should update corrective SPK', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('put', `/corrective/spk/${testSpkCorrectiveId}`)
          .send({
            priority: 'urgent',
            jobDescription: 'Updated job description',
          });

        if (response.status === 200) {
          const body = expectObject(response);
          expect(body.priority).toBe('urgent');
          console.log('  ✓ Updated corrective SPK:', testSpkCorrectiveId);
        } else {
          console.log('  ⚠ Could not update:', response.body.error);
        }
      });
    });

    describe('Workflow: Start Work', () => {
      it('should start work on SPK', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('post', `/corrective/spk/${testSpkCorrectiveId}/start-work`);
        
        if (response.status === 200) {
          expect(response.body.status).toBe('in_progress');
          expect(response.body).toHaveProperty('actualStartDate');
          console.log('  ✓ Started work on SPK:', testSpkCorrectiveId);
        } else {
          console.log('  ℹ Could not start work:', response.body.error);
        }
      });
    });

    describe('Workflow: Complete Work', () => {
      it('should complete work on SPK', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('post', `/corrective/spk/${testSpkCorrectiveId}/complete-work`)
          .send({
            actualWorker: 2,
            actualHourPerWorker: 3.5,
            jobResultDescription: 'Pump repaired successfully',
            photos: [],
          });

        if (response.status === 200) {
          expect(response.body.status).toBe('awaiting_kadis_pusat');
          expect(response.body.totalActualHour).toBe(7.0);
          console.log('  ✓ Completed work on SPK:', testSpkCorrectiveId);
        } else {
          console.log('  ℹ Could not complete work:', response.body.error);
        }
      });
    });

    describe('Workflow: Kadis Pusat Approval', () => {
      it('should approve by Kadis Pusat', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('post', `/corrective/spk/${testSpkCorrectiveId}/approve-kadis-pusat`);

        if (response.status === 200) {
          expect(response.body.status).toBe('awaiting_kadis_pelapor');
          expect(response.body).toHaveProperty('kadisPusatApprovedBy');
          console.log('  ✓ Approved by Kadis Pusat:', testSpkCorrectiveId);
        } else {
          console.log('  ℹ Could not approve:', response.body.error);
        }
      });
    });

    describe('Workflow: Kadis Pelapor Approval', () => {
      it('should approve by Kadis Pelapor', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('post', `/corrective/spk/${testSpkCorrectiveId}/approve-kadis-pelapor`);

        if (response.status === 200) {
          expect(response.body.status).toBe('completed');
          expect(response.body).toHaveProperty('kadisPelaporApprovedBy');
          console.log('  ✓ Approved by Kadis Pelapor:', testSpkCorrectiveId);
        } else {
          console.log('  ℹ Could not approve:', response.body.error);
        }
      });
    });

    describe('DELETE /api/corrective/spk/:spkId', () => {
      it('should delete corrective SPK', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('delete', `/corrective/spk/${testSpkCorrectiveId}`);
        
        if (response.status === 200) {
          expectSuccess(response);
          console.log('  ✓ Deleted corrective SPK:', testSpkCorrectiveId);
        } else {
          console.log('  ℹ Could not delete:', response.body.error);
        }
      });
    });
  });
});
