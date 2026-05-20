'use strict';

const {
  buildAccessProfile,
  applyWebPermissionsToAccessProfile,
} = require('../src/services/accessProfile');

describe('Access profile permissions', () => {
  const appAccess = {
    preventive: true,
    corrective: true,
    inspection: true,
    supervisi: true,
    k3_safety: true,
  };

  const userWithRole = (role, permissions = { _app: appAccess }) => ({
    nik: `codex-${role}`,
    name: `Codex ${role}`,
    role,
    dinas: 'Inspeksi & Supervisi',
    divisi: 'Pusat Perawatan & HSE',
    group: 'Supervisi',
    permissions,
  });

  const userOutsideInspection = (role, permissions = { _app: appAccess }) => ({
    nik: `codex-outside-${role}`,
    name: `Codex Outside ${role}`,
    role,
    dinas: 'Pusat Perawatan',
    divisi: 'PPHSE',
    group: 'Elektrik',
    permissions,
  });

  it('keeps app access independent from web read permissions', () => {
    const inspectionPlanner = userWithRole('kadis');
    const profile = applyWebPermissionsToAccessProfile(
      buildAccessProfile(inspectionPlanner),
      { dashboard: ['R'] },
    );

    expect(profile.modules).toContain('inspection');
    expect(profile.modules).toContain('supervisi');
    expect(profile.flags.isInspectionPlanner).toBe(true);
    expect(profile.flags.isInspectionApprover).toBe(true);
    expect(profile.flags.canAccessSupervisi).toBe(true);
    expect(profile.flags.canManageSupervisiJobs).toBe(true);
  });

  it('respects the Flutter/App module toggles stored in permissions._app', () => {
    const profile = buildAccessProfile(userWithRole('kadis', {
      _app: { ...appAccess, inspection: true, supervisi: false },
      inspeksi: ['R'],
      supervisi: ['R'],
    }));
    expect(profile.modules).toContain('inspection');
    expect(profile.modules).not.toContain('supervisi');
    expect(profile.flags.isInspectionPlanner).toBe(true);
    expect(profile.flags.canAccessSupervisi).toBe(false);
    expect(profile.flags.canManageSupervisiJobs).toBe(false);
  });

  it('keeps Kadis Pusat Perawatan as inspection reporter and denies supervisi', () => {
    const profile = buildAccessProfile(userOutsideInspection('kadis'));

    expect(profile.modules).toContain('inspection');
    expect(profile.modules).not.toContain('supervisi');
    expect(profile.flags.canAccessInspection).toBe(true);
    expect(profile.flags.isInspectionPlanner).toBe(false);
    expect(profile.flags.isInspectionApprover).toBe(false);
    expect(profile.flags.isInspectionExecutor).toBe(false);
    expect(profile.flags.canAccessSupervisi).toBe(false);
    expect(profile.flags.isSupervisiScheduler).toBe(false);
    expect(profile.flags.isSupervisiDenied).toBe(true);
  });

  it('keeps Kadiv PPHSE as supervisi monitor outside the inspection unit', () => {
    const profile = buildAccessProfile({
      ...userOutsideInspection('kadiv'),
      divisi: 'PPHSE',
    });

    expect(profile.modules).toContain('supervisi');
    expect(profile.flags.canAccessSupervisi).toBe(true);
    expect(profile.flags.isSupervisiMonitor).toBe(true);
    expect(profile.flags.isSupervisiScheduler).toBe(false);
    expect(profile.flags.isSupervisiExecutor).toBe(false);
  });

  it('denies supervisi for Kadiv outside PPHSE and inspection unit', () => {
    const profile = buildAccessProfile({
      ...userOutsideInspection('kadiv'),
      divisi: 'Operasi',
    });

    expect(profile.modules).not.toContain('supervisi');
    expect(profile.flags.canAccessSupervisi).toBe(false);
    expect(profile.flags.isSupervisiMonitor).toBe(false);
  });

  it.each([
    ['kadiv', { monitor: true, planner: false, approver: false, executor: false, scheduler: false }],
    ['kadis', { monitor: false, planner: true, approver: true, executor: false, scheduler: true }],
    ['kasie', { monitor: false, planner: false, approver: false, executor: true, scheduler: false }],
    ['petugas', { monitor: false, planner: false, approver: false, executor: true, scheduler: false }],
    ['teknisi', { monitor: false, planner: false, approver: false, executor: true, scheduler: false }],
  ])('maps %s to the Inspeksi and Supervisi operational role', (role, expected) => {
    const profile = buildAccessProfile(userWithRole(role));

    expect(profile.modules).toEqual(expect.arrayContaining(['inspection', 'supervisi']));
    expect(profile.flags.isInspectionMonitor).toBe(expected.monitor);
    expect(profile.flags.isInspectionPlanner).toBe(expected.planner);
    expect(profile.flags.isInspectionApprover).toBe(expected.approver);
    expect(profile.flags.isInspectionExecutor).toBe(expected.executor);
    expect(profile.flags.isSupervisiMonitor).toBe(expected.monitor);
    expect(profile.flags.isSupervisiScheduler).toBe(expected.scheduler);
    expect(profile.flags.isSupervisiExecutor).toBe(expected.executor);
    expect(profile.flags.canAccessSupervisi).toBe(true);
    expect(profile.flags.canManageSupervisiJobs).toBe(expected.scheduler);
    expect(profile.flags.canSubmitSupervisiVisit).toBe(expected.executor);
  });
});
