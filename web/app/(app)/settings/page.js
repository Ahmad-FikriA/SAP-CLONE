'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

const ALL_PAGES = [
  { key: 'dashboard',         label: 'Dashboard' },
  { key: 'spk',               label: 'SPK / Preventive' },
  { key: 'spk-approval',      label: 'Persetujuan SPK' },
  { key: 'corrective',        label: 'Corrective Planner' },
  { key: 'hse',               label: 'HSE Command Center' },
  { key: 'spk-import',        label: 'Import SAP' },
  { key: 'equipment',         label: 'Equipment' },
  { key: 'maps',              label: 'Maps' },
  { key: 'users',             label: 'Users' },
  { key: 'track-record',      label: 'Track Record' },
  { key: 'settings',          label: 'Pengaturan Akses' },
  { key: 'task-mapping',      label: 'Task Mapping' },
  { key: 'interval-planner',  label: 'Interval Planner' },
  { key: 'submissions',       label: 'Submissions' },
  { key: 'inspeksi',          label: 'Inspeksi' },
  { key: 'supervisi',         label: 'Supervisi' },
  { key: 'kalender',          label: 'Kalender Jadwal' },
];

const ROLES = ['teknisi', 'petugas', 'kasie', 'kadis', 'kadiv'];

const ROLE_LABELS = {
  teknisi: 'Teknisi',
  petugas: 'Petugas',
  kasie:   'Kasie',
  kadis:   'Kadis',
  kadiv:   'Kadiv',
};

export default function SettingsPage() {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [activeRole, setActiveRole] = useState('teknisi');

  useEffect(() => {
    apiGet('/settings/role-templates')
      .then((data) => setTemplates(data))
      .catch((e) => toast.error('Gagal memuat template: ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggle(role, key) {
    const current = templates[role] || [];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    setTemplates({ ...templates, [role]: next });
  }

  function selectAll(role) {
    setTemplates({ ...templates, [role]: ALL_PAGES.map((p) => p.key) });
  }

  function clearAll(role) {
    setTemplates({ ...templates, [role]: [] });
  }

  async function save() {
    setSaving(true);
    try {
      await apiPut('/settings/role-templates', templates);
      toast.success('Template disimpan. Berlaku saat user login ulang.');
    } catch (e) {
      toast.error('Gagal menyimpan: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const pages = templates[activeRole] || [];

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Pengaturan Akses Role</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tentukan halaman mana yang bisa diakses per role. Berlaku saat user login ulang.</p>
        </div>
        <Button size="sm" onClick={save} disabled={saving || loading} className="gap-1.5">
          <Save size={13} />
          {saving ? 'Menyimpan...' : 'Simpan Semua'}
        </Button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRole(r)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeRole === r
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {ROLE_LABELS[r]}
            <span className="ml-1.5 text-xs text-gray-400">
              {(templates[r] || []).length}/{ALL_PAGES.length}
            </span>
          </button>
        ))}
      </div>

      {/* Checkbox grid */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Halaman untuk <span className="text-blue-600">{ROLE_LABELS[activeRole]}</span>
          </span>
          <div className="flex gap-3">
            <button onClick={() => selectAll(activeRole)} className="text-xs text-blue-600 hover:underline">Pilih Semua</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => clearAll(activeRole)} className="text-xs text-gray-400 hover:underline">Hapus Semua</button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {ALL_PAGES.map((page) => {
              const checked = pages.includes(page.key);
              return (
                <label key={page.key} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(activeRole, page.key)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                  <span className={`text-sm ${checked ? 'text-gray-800' : 'text-gray-400'}`}>
                    {page.label}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Perubahan berlaku saat user login ulang. User yang sedang login tidak terpengaruh sampai sesi berikutnya.
      </p>
    </div>
  );
}
