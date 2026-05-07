'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../src/server');
const InspectionRequest = require('../src/models/InspectionRequest');
const InspectionSchedule = require('../src/models/InspectionSchedule');
const { InspectionReport } = require('../src/models/InspectionReport');
const SupervisiJob = require('../src/models/SupervisiJob');

describe('Inspection and Supervisi regressions', () => {
  const cleanup = {
    requestIds: [],
    reportIds: [],
    scheduleIds: [],
    jobIds: [],
  };

  const plannerToken = jwt.sign(
    {
      userId: '10000262',
      nik: '10000262',
      name: 'Imam Muttaqin',
      role: 'kadis',
      group: null,
      divisi: 'Inpeksi & Supervisi',
      dinas: 'Inpeksi & Supervisi',
    },
    process.env.JWT_SECRET || 'kti-mock-secret-dev',
  );

  afterEach(async () => {
    if (cleanup.reportIds.length > 0) {
      await InspectionReport.destroy({ where: { id: cleanup.reportIds } });
      cleanup.reportIds = [];
    }

    if (cleanup.requestIds.length > 0) {
      await InspectionRequest.destroy({ where: { id: cleanup.requestIds } });
      cleanup.requestIds = [];
    }

    if (cleanup.jobIds.length > 0) {
      await SupervisiJob.destroy({ where: { id: cleanup.jobIds } });
      cleanup.jobIds = [];
    }

    if (cleanup.scheduleIds.length > 0) {
      await InspectionSchedule.destroy({ where: { id: cleanup.scheduleIds } });
      cleanup.scheduleIds = [];
    }
  });

  it('rejects a pending inspection request', async () => {
    const pendingRequest = await InspectionRequest.create({
      judul: 'Codex Request Reject',
      lokasi: 'Unit Test',
      jenisInspeksi: 'rutin',
      kategoriInspeksi: 'sipil',
      asapMungkin: true,
      mediaPaths: [],
      requestedBy: '10000353',
      status: 'pending',
    });
    cleanup.requestIds.push(pendingRequest.id);

    const response = await request(app)
      .put(`/api/inspection/requests/${pendingRequest.id}/reject`)
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ notes: 'Regression reject request' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('rejected');
    expect(response.body.data.notes).toBe('Regression reject request');

    const reloaded = await InspectionRequest.findByPk(pendingRequest.id);
    expect(reloaded.status).toBe('rejected');
    expect(reloaded.approvedBy).toBe('10000262');
  });

  it('rejects a submitted inspection report and reopens its schedule', async () => {
    const schedule = await InspectionSchedule.create({
      type: 'rutin',
      title: 'Codex Reject Report Schedule',
      location: 'Unit Test',
      scheduledDate: '2026-04-23',
      createdBy: '10000262',
      assignedTo: '10000275',
      triggerSource: 'planner',
      status: 'completed',
    });
    cleanup.scheduleIds.push(schedule.id);

    const report = await InspectionReport.create({
      scheduleId: schedule.id,
      inspectorName: 'Agus Miftakh',
      inspectionDate: '2026-04-23',
      status: 'submitted',
      submittedBy: '10000275',
      submittedAt: new Date(),
    });
    cleanup.reportIds.push(report.id);

    const response = await request(app)
      .put(`/api/inspection/reports/${report.id}/reject`)
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ notes: 'Regression reject report' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(['revisions_required', 'rejected']).toContain(
      response.body.data.status,
    );
    expect(response.body.data.approvalNotes).toBe('Regression reject report');

    const reloadedReport = await InspectionReport.findByPk(report.id);
    const reloadedSchedule = await InspectionSchedule.findByPk(schedule.id);

    expect(['revisions_required', 'rejected']).toContain(
      reloadedReport.status,
    );
    expect(reloadedReport.approvedBy).toBe('10000262');
    expect(reloadedSchedule.status).toBe('in_progress');
  });

  it('creates a supervisi job when PIC matches the executor group in user data', async () => {
    const response = await request(app)
      .post('/api/inspection/supervisi/jobs')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({
        namaKerja: `Codex Supervisi ${Date.now()}`,
        nomorJo: `JO-CODEX-${Date.now()}`,
        nilaiPekerjaan: 1500000,
        pelaksana: 'Vendor Test',
        waktuMulai: '2026-04-23',
        waktuBerakhir: '2026-04-24',
        namaPengawas: 'Group supervisi Sipil dan Perpipaan',
        picSupervisi: 'Deni Yuniardi',
        latitude: -6.2,
        longitude: 106.8,
        radius: 100,
        namaArea: 'Lokasi Test',
        status: 'active',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.namaPengawas).toBe(
      'Group supervisi Sipil dan Perpipaan',
    );
    expect(response.body.data.picSupervisi).toBe('Deni Yuniardi');

    cleanup.jobIds.push(response.body.data.id);
  });

  it('updates supervisi job coordinates from the scheduler endpoint', async () => {
    const createResponse = await request(app)
      .post('/api/inspection/supervisi/jobs')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({
        namaKerja: `Codex Supervisi Location ${Date.now()}`,
        nomorJo: `JO-CODEX-LOC-${Date.now()}`,
        nilaiPekerjaan: 1500000,
        pelaksana: 'Vendor Test',
        waktuMulai: '2026-04-23',
        waktuBerakhir: '2026-04-24',
        namaPengawas: 'Group supervisi Sipil dan Perpipaan',
        picSupervisi: 'Deni Yuniardi',
        latitude: -6.2,
        longitude: 106.8,
        radius: 100,
        namaArea: 'Lokasi Test',
        locations: [
          {
            id: 'loc-a',
            namaArea: 'Lokasi Test',
            latitude: -6.2,
            longitude: 106.8,
            radius: 100,
          },
        ],
        status: 'active',
      });

    expect(createResponse.status).toBe(201);
    cleanup.jobIds.push(createResponse.body.data.id);

    const updateResponse = await request(app)
      .put(`/api/inspection/supervisi/jobs/${createResponse.body.data.id}`)
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({
        latitude: -6.2054321,
        longitude: 106.8123456,
        radius: 120,
        namaArea: 'Lokasi Geser',
        locations: [
          {
            id: 'loc-a',
            namaArea: 'Lokasi Geser',
            latitude: -6.2054321,
            longitude: 106.8123456,
            radius: 120,
          },
        ],
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(Number(updateResponse.body.data.latitude)).toBeCloseTo(-6.2054321, 6);
    expect(Number(updateResponse.body.data.longitude)).toBeCloseTo(106.8123456, 6);
    expect(updateResponse.body.data.locations).toHaveLength(1);
    expect(Number(updateResponse.body.data.locations[0].latitude)).toBeCloseTo(-6.2054321, 6);

    const reloaded = await SupervisiJob.findByPk(createResponse.body.data.id);
    expect(Number(reloaded.latitude)).toBeCloseTo(-6.2054321, 6);
    expect(Number(reloaded.longitude)).toBeCloseTo(106.8123456, 6);
    expect(reloaded.locations).toHaveLength(1);
    expect(Number(reloaded.locations[0].longitude)).toBeCloseTo(106.8123456, 6);
  });
});
