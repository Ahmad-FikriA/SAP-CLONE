'use strict';

const {
  getSupervisiAccess,
  isSupervisiExecutor,
  isSupervisiScheduler,
} = require('../src/controllers/inspection/supervisiAccess');

describe('Supervisi access rules', () => {
  it('keeps the scheduler role even when web supervisi read permission exists', () => {
    const user = {
      nik: '10000262',
      name: 'Imam Muttaqin',
      role: 'kadis',
      permissions: { supervisi: ['R'] },
    };

    expect(getSupervisiAccess(user).kind).toBe('scheduler');
    expect(isSupervisiScheduler(user)).toBe(true);
  });

  it('keeps an executor role even when web supervisi read permission exists', () => {
    const user = {
      nik: 'codex-ibrohim',
      name: 'Ibrohim',
      role: 'teknisi',
      group: 'Group supervisi Mekanikal Elektrik dan Instrumen',
      permissions: { supervisi: ['R'] },
    };

    expect(getSupervisiAccess(user).kind).toBe('executor');
    expect(isSupervisiExecutor(user)).toBe(true);
  });

  it('does not grant API supervisi monitor access from web read permission only', () => {
    const user = {
      nik: 'codex-viewer',
      name: 'Viewer Web',
      role: 'teknisi',
      group: 'Produksi',
      permissions: { supervisi: ['R'] },
    };

    expect(getSupervisiAccess(user).kind).toBe('none');
  });
});
