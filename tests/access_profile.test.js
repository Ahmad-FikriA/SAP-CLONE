'use strict';

const {
  buildAccessProfile,
  applyWebPermissionsToAccessProfile,
} = require('../src/services/accessProfile');

describe('Access profile permission bridge', () => {
  const inspectionPlanner = {
    nik: '10000262',
    name: 'Imam Muttaqin',
    role: 'kadis',
    dinas: 'Inpeksi & Supervisi',
    divisi: 'Inpeksi & Supervisi',
    group: '',
  };

  it('removes inspection and supervisi app access when web read permissions are missing', () => {
    const profile = applyWebPermissionsToAccessProfile(
      buildAccessProfile(inspectionPlanner),
      { dashboard: ['R'] },
    );

    expect(profile.modules).not.toContain('inspection');
    expect(profile.modules).not.toContain('supervisi');
    expect(profile.flags.isInspectionPlanner).toBe(false);
    expect(profile.flags.isInspectionApprover).toBe(false);
    expect(profile.flags.canAccessSupervisi).toBe(false);
    expect(profile.flags.canManageSupervisiJobs).toBe(false);
  });

  it('keeps only the app modules allowed by matching web read permissions', () => {
    const profile = applyWebPermissionsToAccessProfile(
      buildAccessProfile(inspectionPlanner),
      { inspeksi: ['R'] },
    );

    expect(profile.modules).toContain('inspection');
    expect(profile.modules).not.toContain('supervisi');
    expect(profile.flags.isInspectionPlanner).toBe(true);
    expect(profile.flags.canAccessSupervisi).toBe(false);
  });

  it('keeps admin aligned with backend supervisi privileges', () => {
    const profile = buildAccessProfile({
      nik: 'admin-codex',
      name: 'Admin Codex',
      role: 'admin',
    });

    expect(profile.modules).toContain('supervisi');
    expect(profile.flags.canAccessSupervisi).toBe(true);
    expect(profile.flags.canManageSupervisiJobs).toBe(true);
  });
});
