'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';
import { canUpdate } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { ALL_PAGES, TEMPLATE_ROLES, TEMPLATE_ROLE_LABELS } from '@/lib/constants';

const OPS = ['C', 'R', 'U', 'D'];
const OP_LABELS = { C: 'Buat', R: 'Lihat', U: 'Edit', D: 'Hapus' };

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

  function toggle(role, pageKey, op) {
    const current = templates[role]?.[pageKey] || [];
    const next = current.includes(op) ? current.filter((o) => o !== op) : [...current, op];
    setTemplates({ ...templates, [role]: { ...templates[role], [pageKey]: next } });
  }

  function setRowOps(role, pageKey, ops) {
    setTemplates({ ...templates, [role]: { ...templates[role], [pageKey]: ops } });
  }

  function selectAllCRUD(role) {
    const all = {};
    ALL_PAGES.forEach((p) => { all[p.key] = [...OPS]; });
    setTemplates({ ...templates, [role]: all });
  }

  function clearAll(role) {
    setTemplates({ ...templates, [role]: {} });
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

  const rolePerms = templates[activeRole] || {};
  const pagesWithRead = ALL_PAGES.filter((p) => Array.isArray(rolePerms[p.key]) && rolePerms[p.key].includes('R')).length;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Pengaturan Akses Role</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Tentukan hak akses CRUD per halaman untuk setiap role. Berlaku saat user login ulang.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saving || loading || !canUpdate('settings')} className="gap-1.5">
          <Save size={13} />
          {saving ? 'Menyimpan...' : 'Simpan Semua'}
        </Button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TEMPLATE_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRole(r)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeRole === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {TEMPLATE_ROLE_LABELS[r]}
            <span className="ml-1.5 text-xs text-gray-400">{pagesWithRead}/{ALL_PAGES.length}</span>
          </button>
        ))}
      </div>

      {/* CRUD grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">
            Hak akses untuk <span className="text-blue-600">{TEMPLATE_ROLE_LABELS[activeRole]}</span>
          </span>
          <div className="flex gap-3">
            <button onClick={() => selectAllCRUD(activeRole)} className="text-xs text-blue-600 hover:underline">Semua CRUD</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => clearAll(activeRole)} className="text-xs text-gray-400 hover:underline">Hapus Semua</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
          <span><span className="font-bold">C</span> = Create — menambah data baru</span>
          <span><span className="font-bold">R</span> = Read — melihat / membuka halaman</span>
          <span><span className="font-bold">U</span> = Update — mengubah data yang ada</span>
          <span><span className="font-bold">D</span> = Delete — menghapus data</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">Halaman</th>
                  {OPS.map((op) => (
                    <th key={op} className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
                      {op} <span className="text-gray-400 normal-case font-normal">({OP_LABELS[op]})</span>
                    </th>
                  ))}
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Aksi Baris</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ALL_PAGES.map((page) => {
                  const pageOps = Array.isArray(rolePerms[page.key]) ? rolePerms[page.key] : [];
                  const hasAll = OPS.every((o) => pageOps.includes(o));
                  return (
                    <tr key={page.key} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700 text-sm font-medium">{page.label}</td>
                      {OPS.map((op) => (
                        <td key={op} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={pageOps.includes(op)}
                            onChange={() => toggle(activeRole, page.key, op)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => setRowOps(activeRole, page.key, hasAll ? [] : [...OPS])}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {hasAll ? 'Bersihkan' : 'Semua'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Perubahan berlaku saat user login ulang. User dengan hak akses kustom (diatur per-user di halaman Users) tidak terpengaruh oleh template ini.
      </p>
    </div>
  );
}
