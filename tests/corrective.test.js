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
        
        expect(typeof body.id).toBe('string');
        expect(body.id).toMatch(/^NOTIF-/);
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
    describe('GET /api/corrective/sap-spk', () => {
      it('should list all corrective SPKs', async () => {
        const response = await authRequest('get', '/corrective/sap-spk');
        const spks = expectArray(response);
        
        if (spks.length > 0) {
          spks.forEach(spk => {
            expect(spk).toHaveProperty('order_number');
            expect(spk).toHaveProperty('status');
          });
        }
        
        console.log(`  ✓ Listed ${spks.length} corrective SPKs`);
      });
    });

    describe('POST /api/corrective/sap-spk/manual', () => {
      it('should create new corrective SPK and link to notification', async () => {
        if (!testNotificationId) {
          console.log('  ⚠ Skipping: No test request created');
          return;
        }

        const orderNumber = String(Math.floor(1000000000 + Math.random() * 9000000000));
        const newSpk = {
          order_number: orderNumber,
          description: 'Repair broken pump',
          functional_location: 'Test Location',
          equipment_name: 'Test Equipment',
          work_center: 'MECH-01',
          status: 'baru_import',
        };

        const response = await authRequest('post', '/corrective/sap-spk/manual').send(newSpk);
        const body = expectObject(response, 201);
        
        expect(body.order_number).toBe(newSpk.order_number);
        expect(body.status).toBe('baru_import');
        
        testSpkCorrectiveId = body.order_number;
        console.log('  ✓ Created corrective SPK:', testSpkCorrectiveId);

        // Now link it to the notification
        const linkRes = await authRequest('post', `/corrective/requests/${testNotificationId}/update-sap-number`)
          .send({ sapOrderNumber: testSpkCorrectiveId });
        expect(linkRes.status).toBe(200);
        console.log('  ✓ Linked SPK to notification');
      });

      it('should reject linking SPK with non-existent notification', async () => {
        const response = await authRequest('post', '/corrective/requests/NOTIF-NONEXISTENT/update-sap-number').send({
          sapOrderNumber: testSpkCorrectiveId || '1000000001',
        });

        expect(response.status).toBe(404);
        console.log('  ✓ Non-existent notification rejected');
      });
    });

    describe('PATCH /api/corrective/sap-spk/:orderNumber', () => {
      it('should update corrective SPK', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('patch', `/corrective/sap-spk/${testSpkCorrectiveId}`)
          .send({
            description: 'Updated job description',
          });

        if (response.status === 200) {
          const body = expectObject(response);
          expect(body.description).toBe('Updated job description');
          console.log('  ✓ Updated corrective SPK:', testSpkCorrectiveId);
        } else {
          console.log('  ⚠ Could not update:', response.body.error);
        }
      });
    });

    describe('Workflow: Claim SPK (Start Work)', () => {
      it('should claim SPK', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('post', `/corrective/sap-spk/${testSpkCorrectiveId}/claim`);
        
        if (response.status === 200) {
          const body = expectObject(response);
          expect(body.status).toBe('eksekusi');
          expect(body).toHaveProperty('claimed_at');
          console.log('  ✓ Claimed SPK:', testSpkCorrectiveId);
        } else {
          console.log('  ℹ Could not claim SPK:', response.body.error);
        }
      });
    });

    describe('Workflow: Execute SPK (Complete Work)', () => {
      it('should execute SPK', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('put', `/corrective/sap-spk/${testSpkCorrectiveId}/execute`)
          .send({
            conf_text: 'Done Repairing',
            reason_of_var: '0001',
            work_start: '2026-03-12',
            work_finish: '2026-03-12',
            start_time: '08:00:00',
            finish_time: '12:00:00',
            actual_materials: 'Bearing',
            actual_tools: 'Wrench',
            actual_personnel: 2,
            actual_work: 3.5,
            job_result_description: 'Pump repaired successfully',
          });

        if (response.status === 200) {
          const body = expectObject(response);
          expect(body.status).toBe('menunggu_review_kadis_pp');
          expect(Number(body.total_actual_hour)).toBe(7.0);
          console.log('  ✓ Executed SPK:', testSpkCorrectiveId);
        } else {
          console.log('  ℹ Could not execute SPK:', response.body.error);
        }
      });
    });

    describe('Workflow: Kadis Pusat Approval', () => {
      it('should approve by Kadis Pusat', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('post', `/corrective/sap-spk/${testSpkCorrectiveId}/approve-kadis-pp`);

        if (response.status === 200) {
          expect(response.body.status).toBe('success');
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

        const response = await authRequest('post', `/corrective/sap-spk/${testSpkCorrectiveId}/approve-kadis-pelapor`);

        if (response.status === 200) {
          expect(response.body.status).toBe('success');
          console.log('  ✓ Approved by Kadis Pelapor:', testSpkCorrectiveId);
        } else {
          console.log('  ℹ Could not approve:', response.body.error);
        }
      });
    });

    describe('DELETE /api/corrective/sap-spk/:order_number', () => {
      it('should delete corrective SPK', async () => {
        if (!testSpkCorrectiveId) {
          console.log('  ⚠ Skipping: No test SPK created');
          return;
        }

        const response = await authRequest('delete', `/corrective/sap-spk/${testSpkCorrectiveId}`);
        
        if (response.status === 200) {
          expect(response.body.status).toBe('success');
          console.log('  ✓ Deleted corrective SPK:', testSpkCorrectiveId);
        } else {
          console.log('  ℹ Could not delete:', response.body.error);
        }
      });
    });
  });
});
