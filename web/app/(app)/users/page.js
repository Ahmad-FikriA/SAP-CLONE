'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { RoleBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ROLES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { UserPlus, Trash2, Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

const EMPTY_FORM = { id: '', nik: '', name: '', role: '', email: '', dinas: '', divisi: '', group: '', password: 'password123', allowedPages: null };


export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  // Client-side filtered list — instant, no extra API calls
  const q = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (q && ![
      u.nik, u.name, u.divisi, u.dinas, u.group, u.email
    ].some((f) => (f || '').toLowerCase().includes(q))) return false;
    return true;
  });

  useEffect(() => { load(); }, [roleFilter]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet('/users' + (roleFilter ? `?role=${roleFilter}` : ''));
      setUsers(data);
      setSelected([]);
    } catch (e) {
      toast.error('Gagal memuat: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  }

  function openEdit(u) {
    setEditingId(u.id);
    setForm({ ...EMPTY_FORM, ...u, password: '', allowedPages: u.allowedPages ?? null });
    setPanelOpen(true);
  }

  async function saveUser() {
    const { nik, name, role, divisi } = form;
    if (!nik || !name || !role || !divisi) {
      toast.error('NIK, Nama, Jabatan, dan Divisi wajib diisi.');
      return;
    }
    const body = { ...form, id: form.id || `USR-${Math.floor(Math.random() * 100000)}` };
    if (editingId && !body.password) delete body.password;
    try {
      if (editingId) {
        await apiPut(`/users/${editingId}`, body);
        toast.success(`User ${nik} diperbarui`);
      } else {
        await apiPost('/users', body);
        toast.success(`User ${nik} ditambahkan`);
      }
      setPanelOpen(false);
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete() {
    try {
      await apiDelete(`/users/${deleteTarget.id}`);
      toast.success(`User ${deleteTarget.nik} dihapus`);
      setDeleteTarget(null);
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleBulkDelete() {
    try {
      await apiPost('/users/bulk-delete', { ids: selected });
      toast.success(`${selected.length} user berhasil dihapus`);
      setBulkDeleteOpen(false);
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleResetPassword() {
    try {
      await apiPut(`/users/${resetTarget.id}`, { password: 'password123' });
      toast.success(`Password ${resetTarget.nik} direset`);
      setResetTarget(null);
    } catch (e) { toast.error(e.message); }
  }

  function exportExcel() {
    if (!users.length) { toast.error('Tidak ada data'); return; }
    const data = users.map((u, i) => ({ No: i + 1, NIK: u.nik, Nama: u.name, Jabatan: u.role, Dinas: u.dinas || '-', Divisi: u.divisi || '-', Group: u.group || '-', Email: u.email || '-' }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, `Data_Users_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function toggleSelect(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleAll(checked) {
    setSelected(checked ? filteredUsers.map((u) => u.id) : []);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Users</h2>
          <p className="text-sm text-gray-500">
            {filteredUsers.length !== users.length
              ? <>{filteredUsers.length} <span className="text-gray-400">dari {users.length}</span> user</>
              : <>{users.length} user terdaftar</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw size={13} /></Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5"><Download size={13} /> Export</Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5"><UserPlus size={14} /> Tambah User</Button>
        </div>
      </div>

      {/* Filters + search + bulk bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIK, divisi..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Role filter */}
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Semua Role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>

        {selected.length > 0 && (
          <div className="flex items-center gap-2 ml-auto bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
            <span className="text-sm text-red-700 font-medium">{selected.length} dipilih</span>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="gap-1 h-7 text-xs">
              <Trash2 size={12} /> Hapus
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="pl-4 pr-2 py-3 w-8">
                <input type="checkbox" checked={selected.length === filteredUsers.length && filteredUsers.length > 0}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="rounded border-gray-300" />
              </th>
              {['NIK', 'Nama', 'Role', 'Dinas', 'Divisi', 'Group', 'Email', 'Password', 'Aksi'].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                {users.length === 0 ? 'Tidak ada data' : 'Tidak ada user yang cocok dengan pencarian'}
              </td></tr>
            ) : filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="pl-4 pr-2 py-3">
                  <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleSelect(u.id)}
                    className="rounded border-gray-300" />
                </td>
                <td className="px-3 py-3 font-semibold text-gray-800">{u.nik}</td>
                <td className="px-3 py-3 text-gray-700">{u.name}</td>
                <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-3 py-3 text-gray-500 text-xs">{u.dinas || '-'}</td>
                <td className="px-3 py-3 text-gray-500 text-xs">{u.divisi || '-'}</td>
                <td className="px-3 py-3 text-gray-500 text-xs">{u.group || '-'}</td>
                <td className="px-3 py-3 text-gray-500 text-xs">{u.email || '-'}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400 tracking-widest text-base leading-none">••••••</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                      onClick={() => setResetTarget(u)}>Reset</Button>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(u)}>Edit</Button>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => setDeleteTarget(u)}>Hapus</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit panel */}
      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit User' : 'Tambah User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="NIK *" value={form.nik} onChange={(v) => setForm({ ...form, nik: v })} placeholder="Masukkan NIK" />
              <Field label="Nama Lengkap *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Nama lengkap" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Jabatan (Role) *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Pilih role...</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="user@kti.co.id" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dinas" value={form.dinas} onChange={(v) => setForm({ ...form, dinas: v })} placeholder="Opsional" />
              <Field label="Divisi *" value={form.divisi} onChange={(v) => setForm({ ...form, divisi: v })} placeholder="Nama divisi" />
            </div>
            <Field label="Group" value={form.group} onChange={(v) => setForm({ ...form, group: v })} placeholder="Opsional" />
            {!editingId && (
              <Field label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="password123" />
            )}

            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              Akses halaman diatur per role di <a href="/settings" className="text-blue-600 hover:underline">Pengaturan Akses</a>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPanelOpen(false)}>Batal</Button>
            <Button onClick={saveUser}>{editingId ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus user ${deleteTarget?.nik}?`} description="Aksi ini tidak dapat diurungkan."
        onConfirm={handleDelete} confirmLabel="Hapus" destructive />

      <ConfirmDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}
        title={`Hapus ${selected.length} user?`} description="Aksi ini tidak dapat diurungkan."
        onConfirm={handleBulkDelete} confirmLabel="Hapus Semua" destructive />

      <ConfirmDialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}
        title={`Reset password ${resetTarget?.nik}?`} description='Password akan direset ke "password123".'
        onConfirm={handleResetPassword} confirmLabel="Reset" />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
    </div>
  );
}
