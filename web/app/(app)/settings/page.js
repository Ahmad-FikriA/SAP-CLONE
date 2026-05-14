'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';
import { canUpdate } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw, Search, Users, ShieldCheck } from 'lucide-react';
import { ALL_PAGES, TEMPLATE_ROLES, TEMPLATE_ROLE_LABELS, ROLES, ROLE_COLORS } from '@/lib/constants';

const OPS = ['C', 'R', 'U', 'D'];
const OP_LABELS = { C: 'Buat', R: 'Lihat', U: 'Edit', D: 'Hapus' };

const APP_MODULES = [
  { key: 'preventive', label: 'Preventive / SPK' },
  { key: 'corrective', label: 'Corrective' },
  { key: 'inspection', label: 'Inspeksi' },
  { key: 'supervisi',  label: 'Supervisi' },
  { key: 'k3_safety',  label: 'K3 / Safety' },
];

const DEFAULT_APP_MODULES = { preventive: true, corrective: true, inspection: true, supervisi: false, k3_safety: true };

function omitAppKey(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => k !== '_app'));
}

// ── Per-User Tab ────────────────────────────────────────────────────────────

function PerUserTab({ templates }) {
  const [users, setUsers]               = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  // Web permissions
  const [draftPerms, setDraftPerms]         = useState({});
  const [resetToTemplate, setResetToTemplate] = useState(false);
  const [isDirty, setIsDirty]               = useState(false);
  const [saving, setSaving]                 = useState(false);
  // Flutter module access
  const [draftAppModules, setDraftAppModules]       = useState({ ...DEFAULT_APP_MODULES });
  const [resetAppToTemplate, setResetAppToTemplate] = useState(false);
  const [isAppDirty, setIsAppDirty]                 = useState(false);
  const [savingApp, setSavingApp]                   = useState(false);
  // UI
  const [rightTab, setRightTab] = useState('web');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    apiGet('/users')
      .then((data) => setUsers(Array.isArray(data) ? data : (data.data ?? [])))
      .catch((e) => toast.error('Gagal memuat users: ' + e.message))
      .finally(() => setLoadingUsers(false));
  }, []);

  function selectUser(u) {
    setSelectedUser(u);
    setResetToTemplate(false);
    setResetAppToTemplate(false);
    setIsDirty(false);
    setIsAppDirty(false);
    setRightTab('web');
    const base = omitAppKey(u.permissions ?? templates[u.role] ?? {});
    setDraftPerms(JSON.parse(JSON.stringify(base)));
    const templateApp = templates[u.role]?._app ?? DEFAULT_APP_MODULES;
    setDraftAppModules({ ...DEFAULT_APP_MODULES, ...(u.permissions?._app ?? templateApp) });
  }

  // ── Web handlers ──
  function toggleOp(pageKey, op) {
    setDraftPerms((prev) => {
      const cur = Array.isArray(prev[pageKey]) ? prev[pageKey] : [];
      const next = cur.includes(op) ? cur.filter((o) => o !== op) : [...cur, op];
      return { ...prev, [pageKey]: next };
    });
    setResetToTemplate(false);
    setIsDirty(true);
  }

  function setRowOps(pageKey, ops) {
    setDraftPerms((prev) => ({ ...prev, [pageKey]: ops }));
    setResetToTemplate(false);
    setIsDirty(true);
  }

  function handleReset() {
    const base = omitAppKey(templates[selectedUser.role] ?? {});
    setDraftPerms(JSON.parse(JSON.stringify(base)));
    setResetToTemplate(true);
    setIsDirty(true);
  }

  async function save() {
    if (!selectedUser || !isDirty) return;
    setSaving(true);
    try {
      const appSlice = selectedUser.permissions?._app;
      let perms;
      if (resetToTemplate) {
        perms = appSlice ? { _app: appSlice } : null;
      } else {
        perms = { ...draftPerms, ...(appSlice ? { _app: appSlice } : {}) };
      }
      await apiPut(`/users/${selectedUser.id}`, { permissions: perms });
      setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, permissions: perms } : u));
      setSelectedUser((u) => ({ ...u, permissions: perms }));
      setIsDirty(false);
      toast.success('Hak akses web disimpan. Berlaku saat user login ulang.');
    } catch (e) {
      toast.error('Gagal menyimpan: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Flutter handlers ──
  function toggleAppModule(moduleKey) {
    setDraftAppModules((prev) => ({ ...prev, [moduleKey]: !prev[moduleKey] }));
    setResetAppToTemplate(false);
    setIsAppDirty(true);
  }

  function handleResetApp() {
    const templateApp = templates[selectedUser.role]?._app ?? DEFAULT_APP_MODULES;
    setDraftAppModules({ ...DEFAULT_APP_MODULES, ...templateApp });
    setResetAppToTemplate(true);
    setIsAppDirty(true);
  }

  async function saveApp() {
    if (!selectedUser || !isAppDirty) return;
    setSavingApp(true);
    try {
      const webSlice = selectedUser.permissions ? omitAppKey(selectedUser.permissions) : null;
      let perms;
      if (resetAppToTemplate) {
        perms = webSlice && Object.keys(webSlice).length > 0 ? webSlice : null;
      } else {
        perms = { ...(webSlice || {}), _app: draftAppModules };
      }
      await apiPut(`/users/${selectedUser.id}`, { permissions: perms });
      setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, permissions: perms } : u));
      setSelectedUser((u) => ({ ...u, permissions: perms }));
      setIsAppDirty(false);
      toast.success('Akses Flutter disimpan. Berlaku saat user login ulang.');
    } catch (e) {
      toast.error('Gagal menyimpan: ' + e.message);
    } finally {
      setSavingApp(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      return u.name?.toLowerCase().includes(q) || u.nik?.includes(q) || u.dinas?.toLowerCase().includes(q);
    }
    return true;
  });

  const isCustom    = selectedUser?.permissions != null;
  const isAppCustom = selectedUser?.permissions?._app != null;

  return (
    <div className="flex h-full min-h-0 gap-0 border border-gray-200 rounded-xl overflow-hidden bg-white">

      {/* ── Left: User list ── */}
      <div className="w-64 shrink-0 border-r border-gray-200 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Cari nama / NIK..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          {/* Role filter pills */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setRoleFilter('')}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${!roleFilter ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              Semua
            </button>
            {ROLES.filter((r) => r !== 'admin').map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r === roleFilter ? '' : r)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  roleFilter === r ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={roleFilter === r ? { backgroundColor: ROLE_COLORS[r] } : {}}
              >
                {TEMPLATE_ROLE_LABELS[r] ?? r}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingUsers ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="p-4 text-xs text-gray-400 text-center">Tidak ada pengguna</p>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              const hasCustom = u.permissions != null;
              return (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors flex items-start gap-2 ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                        {u.name}
                      </p>
                      {hasCustom && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" title="Hak akses kustom" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="px-1.5 py-px rounded text-[10px] font-semibold text-white"
                        style={{ backgroundColor: ROLE_COLORS[u.role] ?? '#6B7280' }}
                      >
                        {TEMPLATE_ROLE_LABELS[u.role] ?? u.role}
                      </span>
                      <span className="text-[11px] text-gray-400 truncate">{u.nik}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-3 py-2 border-t border-gray-100 text-[11px] text-gray-400">
          {filteredUsers.length} pengguna
        </div>
      </div>

      {/* ── Right: Spreadsheet ── */}
      {!selectedUser ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
          <Users size={36} className="opacity-30" />
          <p className="text-sm">Pilih pengguna untuk melihat hak akses</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* User header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60 gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-800">{selectedUser.name}</p>
                  <span
                    className="px-2 py-px rounded text-[10px] font-semibold text-white"
                    style={{ backgroundColor: ROLE_COLORS[selectedUser.role] ?? '#6B7280' }}
                  >
                    {TEMPLATE_ROLE_LABELS[selectedUser.role] ?? selectedUser.role}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedUser.dinas ?? selectedUser.divisi ?? '—'}
                  {selectedUser.group ? ` · ${selectedUser.group}` : ''}
                </p>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${
                isCustom ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-gray-100 text-gray-500'
              }`}>
                <ShieldCheck size={11} />
                {isCustom ? 'Hak Akses Kustom' : `Menggunakan Template ${TEMPLATE_ROLE_LABELS[selectedUser.role] ?? selectedUser.role}`}
              </div>
            </div>
            {/* Action buttons — swap per rightTab */}
            <div className="flex items-center gap-2 shrink-0">
              {canUpdate('settings') && rightTab === 'web' && (
                <>
                  <button
                    onClick={handleReset}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                    Reset ke Template
                  </button>
                  <Button size="sm" onClick={save} disabled={!isDirty || saving} className="gap-1.5 h-8 text-xs">
                    <Save size={12} />
                    {saving ? 'Menyimpan...' : 'Simpan Web'}
                  </Button>
                </>
              )}
              {canUpdate('settings') && rightTab === 'flutter' && (
                <>
                  <button
                    onClick={handleResetApp}
                    disabled={savingApp}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                    Reset ke Template
                  </button>
                  <Button size="sm" onClick={saveApp} disabled={!isAppDirty || savingApp} className="gap-1.5 h-8 text-xs">
                    <Save size={12} />
                    {savingApp ? 'Menyimpan...' : 'Simpan App'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Right sub-tabs: Web | Flutter / App */}
          <div className="flex border-b border-gray-200 bg-white px-5 gap-1">
            <button
              onClick={() => setRightTab('web')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                rightTab === 'web' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Web
            </button>
            <button
              onClick={() => setRightTab('flutter')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                rightTab === 'flutter' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Flutter / App
              {isAppCustom && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" title="Akses app kustom" />}
            </button>
          </div>

          {rightTab === 'web' ? (
            <>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
                {OPS.map((op) => (
                  <span key={op}><span className="font-bold">{op}</span> = {OP_LABELS[op]}</span>
                ))}
              </div>

              {/* Spreadsheet table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-48 border-r border-gray-200">
                        Halaman
                      </th>
                      {OPS.map((op) => (
                        <th key={op} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-16 border-r border-gray-100">
                          {op}
                          <span className="block text-[10px] text-gray-400 font-normal normal-case">{OP_LABELS[op]}</span>
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_PAGES.map((page, idx) => {
                      const pageOps = Array.isArray(draftPerms[page.key]) ? draftPerms[page.key] : [];
                      const hasAll = OPS.every((o) => pageOps.includes(o));
                      return (
                        <tr
                          key={page.key}
                          className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
                        >
                          <td className="px-4 py-2 text-gray-700 text-sm font-medium border-r border-gray-200">
                            {page.label}
                          </td>
                          {OPS.map((op) => (
                            <td key={op} className="px-3 py-2 text-center border-r border-gray-100">
                              <input
                                type="checkbox"
                                checked={pageOps.includes(op)}
                                onChange={() => toggleOp(page.key, op)}
                                disabled={!canUpdate('settings')}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer disabled:cursor-default"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => setRowOps(page.key, hasAll ? [] : [...OPS])}
                              disabled={!canUpdate('settings')}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-40 disabled:no-underline"
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
            </>
          ) : (
            /* ── Flutter / App tab ── */
            <div className="flex-1 overflow-auto p-5">
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Akses Modul Flutter</p>
                <p className="text-xs text-gray-400">
                  Kontrol modul mana yang bisa diakses user ini di aplikasi Flutter.
                  {!isAppCustom && (
                    <span className="ml-1 text-gray-500">
                      Saat ini menggunakan template <strong>{TEMPLATE_ROLE_LABELS[selectedUser.role] ?? selectedUser.role}</strong>.
                    </span>
                  )}
                </p>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Modul
                      </th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
                        Akses
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {APP_MODULES.map((mod, idx) => {
                      const enabled = draftAppModules[mod.key] !== false;
                      return (
                        <tr
                          key={mod.key}
                          className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
                        >
                          <td className="px-4 py-3 text-gray-700 font-medium">{mod.label}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => canUpdate('settings') && toggleAppModule(mod.key)}
                              disabled={!canUpdate('settings')}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:cursor-default ${
                                enabled ? 'bg-blue-600' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                  enabled ? 'translate-x-4' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Perubahan berlaku saat user login ulang di aplikasi Flutter.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Template Role Tab ───────────────────────────────────────────────────────

function TemplateTab({ templates, setTemplates, loading, saving, onSave }) {
  const [activeRole, setActiveRole] = useState('teknisi');
  const rolePerms = templates[activeRole] || {};

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
    setTemplates({ ...templates, [role]: { ...(templates[role]?._app ? { _app: templates[role]._app } : {}), ...all } });
  }

  function clearAll(role) {
    setTemplates({ ...templates, [role]: { ...(templates[role]?._app ? { _app: templates[role]._app } : {}) } });
  }

  function toggleTemplateAppModule(role, moduleKey) {
    const current = templates[role]?._app ?? { ...DEFAULT_APP_MODULES };
    setTemplates({ ...templates, [role]: { ...templates[role], _app: { ...current, [moduleKey]: !current[moduleKey] } } });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* Role tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {TEMPLATE_ROLES.map((r) => {
            const rPerms = templates[r] || {};
            const count = ALL_PAGES.filter((p) => Array.isArray(rPerms[p.key]) && rPerms[p.key].includes('R')).length;
            return (
              <button
                key={r}
                onClick={() => setActiveRole(r)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeRole === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {TEMPLATE_ROLE_LABELS[r]}
                <span className="ml-1.5 text-xs text-gray-400">{count}/{ALL_PAGES.length}</span>
              </button>
            );
          })}
        </div>
        <Button size="sm" onClick={onSave} disabled={saving || loading || !canUpdate('settings')} className="gap-1.5">
          <Save size={13} />
          {saving ? 'Menyimpan...' : 'Simpan Template'}
        </Button>
      </div>

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
          {OPS.map((op) => (
            <span key={op}><span className="font-bold">{op}</span> = {OP_LABELS[op]}</span>
          ))}
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
      {/* Flutter module defaults for this role */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">
            Akses Modul Flutter — <span className="text-blue-600">{TEMPLATE_ROLE_LABELS[activeRole]}</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Modul</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Akses Default</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {APP_MODULES.map((mod) => {
                const appPerms = templates[activeRole]?._app ?? DEFAULT_APP_MODULES;
                const enabled = appPerms[mod.key] !== false;
                return (
                  <tr key={mod.key} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{mod.label}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggleTemplateAppModule(activeRole, mod.key)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          enabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Perubahan berlaku saat user login ulang. User dengan hak akses kustom (diatur per-user) tidak terpengaruh oleh template ini.
      </p>
    </div>
  );
}

// ── Page root ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab]   = useState('user');
  const [templates, setTemplates]   = useState({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    apiGet('/settings/role-templates')
      .then((data) => setTemplates(data))
      .catch((e) => toast.error('Gagal memuat template: ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  async function saveTemplates() {
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

  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Pengaturan Akses</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Kelola hak akses per pengguna atau atur template default per role.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('user')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'user' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={14} />
          Per Pengguna
        </button>
        <button
          onClick={() => setActiveTab('template')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'template' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck size={14} />
          Template Role
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'user' ? (
        <div className="flex-1 min-h-0" style={{ height: 'calc(100vh - 220px)' }}>
          <PerUserTab templates={templates} />
        </div>
      ) : (
        <TemplateTab
          templates={templates}
          setTemplates={setTemplates}
          loading={loading}
          saving={saving}
          onSave={saveTemplates}
        />
      )}
    </div>
  );
}
