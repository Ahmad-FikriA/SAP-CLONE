'use strict';

const {
  getSupervisiAccess,
  isSupervisiExecutor,
  isSupervisiScheduler,
} = require('../src/controllers/inspection/supervisiAccess');

describe('Supervisi access rules', () => {
  const appSupervisiOn = {
    _app: {
      preventive: true,
      corrective: true,
      inspection: true,
      supervisi: true,
      k3_safety: true,
    },
  };

  it('keeps the scheduler role even when web supervisi read permission exists', () => {
    const user = {
      nik: 'codex-kadis',
      name: 'Kadis Codex',
      role: 'kadis',
      permissions: { ...appSupervisiOn, supervisi: ['R'] },
    };

    expect(getSupervisiAccess(user).kind).toBe('scheduler');
    expect(isSupervisiScheduler(user)).toBe(true);
  });

  it('maps kasie, petugas, and teknisi with app supervisi access to executor', () => {
    for (const role of ['kasie', 'petugas', 'teknisi']) {
      const user = {
        nik: `codex-${role}`,
        name: `Executor ${role}`,
        role,
        group: 'Produksi',
        permissions: { ...appSupervisiOn, supervisi: ['R'] },
      };

      expect(getSupervisiAccess(user).kind).toBe('executor');
      expect(isSupervisiExecutor(user)).toBe(true);
    }
  });

  it('maps kadiv with app supervisi access to monitor', () => {
    const user = {
      nik: 'codex-kadiv',
      name: 'Kadiv Codex',
      role: 'kadiv',
      permissions: appSupervisiOn,
    };

    expect(getSupervisiAccess(user).kind).toBe('monitor');
  });

  it('does not grant API supervisi monitor access from web read permission only', () => {
    const user = {
      nik: 'codex-viewer',
      name: 'Viewer Web',
      role: 'teknisi',
      group: 'Produksi',
      permissions: { _app: { supervisi: false }, supervisi: ['R'] },
    };

    expect(getSupervisiAccess(user).kind).toBe('none');
  });

  it('grants monitor access for web reads when explicitly flagged as web client', () => {
    const user = {
      nik: 'codex-viewer',
      name: 'Viewer Web',
      role: 'teknisi',
      group: 'Produksi',
      permissions: { _app: { supervisi: false }, supervisi: ['R'] },
    };

    expect(getSupervisiAccess(user, { allowWebPermissionRead: true }).kind).toBe('monitor');
  });
});
