'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { RefreshCw, Upload, FileSpreadsheet, Inbox, AlertCircle, FileText, Wrench, CheckCircle2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const APPROVAL_LABELS = {
  pending: 'Proses',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

const APPROVAL_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  approved: 'bg-green-100 text-green-700 hover:bg-green-100',
  rejected: 'bg-red-100 text-red-600 hover:bg-red-100',
};

const NOTIF_STATUS_LABELS = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

const NOTIF_STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  approved: 'bg-green-100 text-green-700 hover:bg-green-100',
  rejected: 'bg-red-100 text-red-600 hover:bg-red-100',
};

const SAP_STATUS_LABELS = {
  baru_import: 'Tugas Baru',
  eksekusi: 'Eksekusi',
  menunggu_review_kadis_pp: 'Review Kadis PP',
  menunggu_review_kadis_pelapor: 'Review Pelapor',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
};

const SAP_STATUS_COLORS = {
  baru_import: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
  eksekusi: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  menunggu_review_kadis_pp: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
  menunggu_review_kadis_pelapor: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
  selesai: 'bg-green-100 text-green-700 hover:bg-green-100',
  ditolak: 'bg-red-100 text-red-600 hover:bg-red-100',
};

const SAP_SPK_STEPS = [
  { label: 'Baru', key: 'baru_import' },
  { label: 'Eksekusi', key: 'eksekusi' },
  { label: 'Review Kadis PP', key: 'menunggu_review_kadis_pp' },
  { label: 'Review Pelapor', key: 'menunggu_review_kadis_pelapor' },
  { label: 'Selesai', key: 'selesai' },
];

function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ value, colorMap, labelMap }) {
  const colorClass = colorMap?.[value] || 'bg-gray-100 text-gray-600';
  const label = labelMap?.[value] || value || '-';
  return (
    <Badge className={cn("px-2 py-0.5 text-xs font-semibold border-transparent", colorClass)}>
      {label}
    </Badge>
  );
}

export default function CorrectivePage() {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [spks, setSpks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterNotifStatus, setFilterNotifStatus] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('');
  const [filterSpkStatus, setFilterSpkStatus] = useState('');

  // Detail dialogs
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedSpk, setSelectedSpk] = useState(null);

  // Upload Excel
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Confirm dialog
  const [confirmState, setConfirmState] = useState(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqData, sapSpkRes] = await Promise.all([
        apiGet(`/corrective/requests${filterNotifStatus ? `?status=${filterNotifStatus}` : ''}`),
        apiGet('/corrective/sap-spk'),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      
      const allSpks = Array.isArray(sapSpkRes?.data) ? sapSpkRes.data : [];
      let filteredSpks = allSpks;
      if (filterSpkStatus) {
        filteredSpks = allSpks.filter(s => s.status === filterSpkStatus);
      }

      setSpks(filteredSpks.filter((s) => s.status !== 'selesai' && s.status !== 'ditolak'));
      setHistory(allSpks.filter((s) => s.status === 'selesai' || s.status === 'ditolak'));
    } catch (e) {
      toast.error('Gagal memuat data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [filterNotifStatus, filterSpkStatus]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const filteredRequests = filterApprovalStatus
    ? requests.filter((r) => r.approvalStatus === filterApprovalStatus)
    : requests;

  function confirmAction(title, message, onConfirm, withNotes = false) {
    setConfirmNotes('');
    setConfirmState({ title, message, withNotes, onConfirm });
  }

  async function runConfirm() {
    if (!confirmState) return;
    setConfirming(true);
    try {
      await confirmState.onConfirm(confirmNotes);
      setConfirmState(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirming(false);
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('excelFile', file);
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/corrective/sap-spk/upload-excel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(data.message);
        loadAll();
      } else {
        toast.error(data.message || 'Gagal mengupload file');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan saat upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  async function approvePlanner(id) {
    confirmAction('Terima Laporan', 'Terima dan setujui laporan ini?', async () => {
      await apiPost(`/corrective/requests/${id}/approve-planner`);
      toast.success('Laporan berhasil diterima!');
      setSelectedRequest(null);
      loadAll();
    });
  }

  async function deleteAllRequests() {
    confirmAction('Hapus Semua Notifikasi', 'Anda yakin ingin menghapus SELURUH data notifikasi yang belum dibuat SPK?', async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/corrective/requests`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Berhasil dihapus');
        loadAll();
      } else {
        toast.error(data.error || 'Gagal menghapus');
      }
    });
  }

  async function deleteRequest(id) {
    confirmAction('Hapus Notifikasi', `Anda yakin ingin menghapus notifikasi ${id}?`, async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/corrective/requests/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Berhasil dihapus');
        loadAll();
      } else {
        toast.error(data.error || 'Gagal menghapus');
      }
    });
  }

  async function deleteAllSpks() {
    confirmAction('Hapus Semua SPK SAP', 'Anda yakin ingin menghapus SELURUH data SPK SAP aktif dan riwayat?', async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/corrective/sap-spk`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(data.message);
        loadAll();
      } else {
        toast.error(data.message || 'Gagal menghapus');
      }
    });
  }

  async function deleteSpk(order_number) {
    confirmAction('Hapus SPK SAP', `Anda yakin ingin menghapus SPK ${order_number}?`, async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/corrective/sap-spk/${order_number}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(data.message);
        loadAll();
      } else {
        toast.error(data.message || 'Gagal menghapus');
      }
    });
  }

  const TABS = [
    { key: 'requests', label: 'Notifikasi', icon: Inbox, count: filteredRequests.length },
    { key: 'spk', label: 'SPK Aktif (SAP)', icon: FileText, count: spks.length },
    { key: 'history', label: 'History', icon: CheckCircle2, count: history.length },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Corrective Planner</h2>
          <p className="text-slate-500 mt-1 text-sm">Kelola laporan notifikasi dan integrasikan ekspor SPK dari SAP.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload} 
          />
          {tab === 'spk' && spks.length > 0 && (
            <Button variant="destructive" className="shadow-sm" onClick={deleteAllSpks}>
              <Trash2 size={16} className="mr-2" />
              Hapus Semua
            </Button>
          )}
          {tab === 'history' && history.length > 0 && (
            <Button variant="destructive" className="shadow-sm" onClick={deleteAllSpks}>
              <Trash2 size={16} className="mr-2" />
              Hapus Semua
            </Button>
          )}
          <Button variant="default" className="shadow-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <FileSpreadsheet size={16} className="mr-2" />
            {uploading ? 'Mengunggah...' : 'Upload Excel SAP'}
          </Button>
          <Button variant="outline" size="icon" onClick={loadAll} disabled={loading} className="shrink-0 bg-white shadow-sm">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Segmented Tabs & Filters */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="flex gap-1 overflow-x-auto w-full md:w-auto p-1 bg-slate-50 rounded-lg">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md whitespace-nowrap',
                  isActive ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                )}>
                <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                {t.label}
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold ml-1',
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600')}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        
        {/* Dynamic Filters based on active tab */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {tab === 'requests' && filteredRequests.length > 0 && (
            <Button variant="destructive" className="shadow-sm" onClick={deleteAllRequests}>
              <Trash2 size={16} className="mr-2" />
              Hapus Semua
            </Button>
          )}
          {tab === 'requests' && (
            <>
              <select value={filterNotifStatus} onChange={(e) => setFilterNotifStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                <option value="">Semua Status Laporan</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={filterApprovalStatus} onChange={(e) => setFilterApprovalStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                <option value="">Semua Approval</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </>
          )}
          {tab === 'spk' && (
            <select value={filterSpkStatus} onChange={(e) => setFilterSpkStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
              <option value="">Semua Status SPK</option>
              <option value="baru_import">Baru</option>
              <option value="eksekusi">Eksekusi</option>
              <option value="menunggu_review_kadis_pp">Review Kadis PP</option>
              <option value="menunggu_review_kadis_pelapor">Review Pelapor</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {tab === 'requests' && (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-[100px]">ID Laporan</TableHead>
                <TableHead>Info Waktu & Pelapor</TableHead>
                <TableHead>Lokasi & Equipment</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Status & Approval</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-slate-400">Memuat data...</TableCell></TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-48 text-center"><EmptyState icon={Inbox} text="Belum ada laporan notifikasi" /></TableCell></TableRow>
              ) : filteredRequests.map((req) => (
                <TableRow key={req.id} className="cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => setSelectedRequest(req)}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-700">{req.id}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-800">{fmtDate(req.notificationDate || req.submittedAt)}</div>
                    <div className="text-xs text-slate-500">{req.reportedBy || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-800 truncate max-w-[200px]" title={req.equipment}>{req.equipment || '—'}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]" title={req.functionalLocation}>{req.functionalLocation || '—'}</div>
                  </TableCell>
                  <TableCell className="text-slate-600">{req.notificationType || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5 items-start">
                      <StatusBadge value={req.status} colorMap={NOTIF_STATUS_COLORS} labelMap={NOTIF_STATUS_LABELS} />
                      <StatusBadge value={req.approvalStatus} colorMap={APPROVAL_COLORS} labelMap={APPROVAL_LABELS} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end items-center gap-1">
                      {req.status === 'submitted' && req.approvalStatus === 'pending' ? (
                        <Button size="sm" className="h-8 shadow-sm" onClick={() => approvePlanner(req.id)}>Terima</Button>
                      ) : (
                        <Button variant="outline" size="sm" className="h-8 shadow-sm" onClick={() => setSelectedRequest(req)}>Detail</Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => deleteRequest(req.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {tab === 'spk' && (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Tanggal Posting</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Jam / Pekerja</TableHead>
                <TableHead>Status SAP</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-slate-400">Memuat data...</TableCell></TableRow>
              ) : spks.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-48 text-center"><EmptyState icon={FileText} text="Belum ada SPK aktif" /></TableCell></TableRow>
              ) : spks.map((spk) => (
                <TableRow key={spk.order_number} className="cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => setSelectedSpk(spk)}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-800">{spk.order_number}</TableCell>
                  <TableCell className="text-slate-600 font-medium">{fmtDate(spk.posting_date)}</TableCell>
                  <TableCell className="text-slate-600 truncate max-w-[200px]" title={spk.equipment_name}>{spk.equipment_name || '—'}</TableCell>
                  <TableCell>
                     <div className="flex items-center gap-2 text-slate-600">
                        <span className="flex items-center gap-1 text-xs"><Wrench size={12}/> {spk.actual_personnel || 0} org</span>
                        <span className="flex items-center gap-1 text-xs"><AlertCircle size={12}/> {spk.total_actual_hour || 0} jam</span>
                     </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={spk.status} colorMap={SAP_STATUS_COLORS} labelMap={SAP_STATUS_LABELS} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 shadow-sm" onClick={() => setSelectedSpk(spk)}>Detail</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => deleteSpk(spk.order_number)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {tab === 'history' && (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Tanggal Posting</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Status SAP</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-slate-400">Memuat data...</TableCell></TableRow>
              ) : history.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-48 text-center"><EmptyState icon={CheckCircle2} text="Belum ada riwayat SPK" /></TableCell></TableRow>
              ) : history.map((spk) => (
                <TableRow key={spk.order_number} className="cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => setSelectedSpk(spk)}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-800">{spk.order_number}</TableCell>
                  <TableCell className="text-slate-600 font-medium">{fmtDate(spk.posting_date)}</TableCell>
                  <TableCell className="text-slate-600 truncate max-w-[200px]">{spk.equipment_name || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge value={spk.status} colorMap={SAP_STATUS_COLORS} labelMap={SAP_STATUS_LABELS} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 shadow-sm" onClick={() => setSelectedSpk(spk)}>Detail</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => deleteSpk(spk.order_number)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 rounded-2xl gap-0">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
            <div>
              <DialogTitle className="text-lg text-slate-800">Detail Laporan Notifikasi</DialogTitle>
              <div className="text-sm font-mono text-slate-500 mt-1">{selectedRequest?.id}</div>
            </div>
            <div className="flex gap-2">
              <StatusBadge value={selectedRequest?.status} colorMap={NOTIF_STATUS_COLORS} labelMap={NOTIF_STATUS_LABELS} />
              <StatusBadge value={selectedRequest?.approvalStatus} colorMap={APPROVAL_COLORS} labelMap={APPROVAL_LABELS} />
            </div>
          </div>
          
          {selectedRequest && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section title="Informasi Peralatan">
                  <Row label="Functional Location" value={selectedRequest.functionalLocation} />
                  <Row label="Equipment" value={selectedRequest.equipment} />
                  <Row label="Work Center" value={selectedRequest.workCenter} />
                  <Row label="Tipe Notifikasi" value={selectedRequest.notificationType} />
                </Section>
                <Section title="Waktu & Pelapor">
                  <Row label="Tanggal Lapor" value={fmtDate(selectedRequest.notificationDate || selectedRequest.submittedAt)} />
                  <Row label="Dilaporkan Oleh" value={selectedRequest.reportedBy} />
                  <Row label="Target Mulai" value={fmtDate(selectedRequest.requiredStart)} />
                  <Row label="Target Selesai" value={fmtDate(selectedRequest.requiredEnd)} />
                </Section>
              </div>

              <Section title="Deskripsi Kerusakan">
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
                  <p className="font-semibold text-slate-800 mb-2">{selectedRequest.description || 'Tanpa judul'}</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{selectedRequest.longText || 'Tidak ada deskripsi panjang.'}</p>
                </div>
              </Section>

              {(selectedRequest.images || []).length > 0 && (
                <Section title="Foto Lapangan">
                  <div className="flex flex-wrap gap-3">
                    {selectedRequest.images.filter(Boolean).map((p, i) => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
                      const src = p.startsWith('http') ? p : p.startsWith('uploads/') ? `${baseUrl}/${p}` : `${baseUrl}/uploads/${p}`;
                      return (
                        <img key={i} src={src} alt={`Attachment ${i+1}`} onClick={() => window.open(src, '_blank')}
                          className="w-28 h-28 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:shadow-md transition-all hover:scale-105" />
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>
          )}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0">
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Tutup</Button>
            {selectedRequest?.status === 'submitted' && selectedRequest?.approvalStatus === 'pending' && (
              <Button onClick={() => { setSelectedRequest(null); approvePlanner(selectedRequest.id); }} className="shadow-sm">Terima Laporan</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SPK Detail Dialog */}
      <Dialog open={!!selectedSpk} onOpenChange={(o) => !o && setSelectedSpk(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 rounded-2xl gap-0">
          <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 sticky top-0 z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <DialogTitle className="text-lg text-slate-800">Detail SPK SAP</DialogTitle>
                <div className="text-sm font-mono text-slate-500 mt-1">{selectedSpk?.order_number}</div>
              </div>
              <StatusBadge value={selectedSpk?.status} colorMap={SAP_STATUS_COLORS} labelMap={SAP_STATUS_LABELS} />
            </div>

            {/* Progress Stepper */}
            <div className="flex items-center w-full relative">
              {SAP_SPK_STEPS.map((step, i) => {
                const currentIdx = SAP_SPK_STEPS.findIndex((s) => s.key === selectedSpk?.status);
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <div key={step.key} className="flex-1 relative flex flex-col items-center">
                    {/* Line Connector */}
                    {i !== 0 && (
                       <div className={cn("absolute top-3 left-[-50%] w-full h-[2px] -z-10", done || active ? "bg-blue-500" : "bg-slate-200")} />
                    )}
                    {/* Circle */}
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-slate-50 transition-colors z-10", 
                      done ? "bg-blue-500 text-white" : 
                      active ? "bg-blue-600 text-white ring-blue-100" : "bg-slate-200 text-slate-400"
                    )}>
                      {done ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    {/* Label */}
                    <span className={cn("text-[10px] sm:text-xs mt-2 font-medium text-center absolute top-7 w-24", 
                      active ? "text-blue-700" : done ? "text-slate-700" : "text-slate-400"
                    )}>{step.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="h-6"></div>{/* spacing for absolute labels */}
          </div>
          
          {selectedSpk && (
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section title="Data Utama SAP">
                  <Row label="Order Number" value={<span className="font-mono">{selectedSpk.order_number}</span>} />
                  <Row label="Deskripsi" value={selectedSpk.description} />
                  <Row label="Status SAP" value={selectedSpk.sys_status} />
                  <Row label="Work Center" value={selectedSpk.work_center} />
                </Section>
                <Section title="Lokasi & Tanggal">
                  <Row label="Equipment" value={selectedSpk.equipment_name} />
                  <Row label="Functional Loc" value={selectedSpk.functional_location} />
                  <Row label="Tgl Posting" value={fmtDate(selectedSpk.posting_date)} />
                  <Row label="Plan Duration" value={`${selectedSpk.dur_plan || 0} ${selectedSpk.normal_dur_un || ''}`} />
                </Section>
              </div>

              {/* Execution Results */}
              {(selectedSpk.actual_materials || selectedSpk.actual_tools || selectedSpk.job_result_description || selectedSpk.photo_before || selectedSpk.photo_after) && (
                <div className="bg-orange-50/50 rounded-2xl border border-orange-100/50 p-5">
                   <h4 className="text-sm font-bold text-orange-800 mb-4 flex items-center gap-2">
                     <Wrench size={16} /> Laporan Eksekusi Teknisi
                   </h4>
                   
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <MetricCard label="Pekerja Aktual" value={`${selectedSpk.actual_personnel || 0} Orang`} />
                      <MetricCard label="Jam Aktual" value={`${selectedSpk.total_actual_hour || 0} Jam`} />
                      <MetricCard label="Eksekutor NIK" value={selectedSpk.execution_nik || '-'} className="col-span-2 md:col-span-2" />
                   </div>

                   <div className="space-y-4 text-sm text-slate-700">
                      <div>
                        <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Material yang Digunakan</strong>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">{selectedSpk.actual_materials || '-'}</div>
                      </div>
                      <div>
                        <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Tools yang Digunakan</strong>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">{selectedSpk.actual_tools || '-'}</div>
                      </div>
                      <div>
                        <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Catatan Hasil Kerja</strong>
                        <div className="bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">{selectedSpk.job_result_description || '-'}</div>
                      </div>
                   </div>

                   {(selectedSpk.photo_before || selectedSpk.photo_after) && (
                     <div className="mt-6 pt-6 border-t border-orange-200/50">
                        <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-3">Foto Dokumentasi</strong>
                        <div className="flex flex-wrap gap-4">
                          {selectedSpk.photo_before && (
                            <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-block">
                              <img 
                                src={`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_before}`} 
                                onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_before}`, '_blank')}
                                className="w-36 h-36 object-cover rounded-lg cursor-zoom-in hover:opacity-90" 
                                alt="Before" 
                              />
                              <span className="text-xs font-semibold text-slate-600 block text-center mt-2">Kondisi Awal</span>
                            </div>
                          )}
                          {selectedSpk.photo_after && (
                            <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-block">
                              <img 
                                src={`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_after}`} 
                                onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_after}`, '_blank')}
                                className="w-36 h-36 object-cover rounded-lg cursor-zoom-in hover:opacity-90" 
                                alt="After" 
                              />
                              <span className="text-xs font-semibold text-slate-600 block text-center mt-2">Kondisi Akhir</span>
                            </div>
                          )}
                        </div>
                     </div>
                   )}
                </div>
              )}
            </div>
          )}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end sticky bottom-0">
            <Button variant="outline" onClick={() => setSelectedSpk(null)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmState} onOpenChange={(o) => !o && setConfirmState(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{confirmState?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-slate-600">{confirmState?.message}</p>
            {confirmState?.withNotes && (
              <textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Tambahkan catatan jika perlu..." rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50" />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmState(null)} disabled={confirming}>Batal</Button>
            <Button onClick={runConfirm} disabled={confirming}>{confirming ? 'Memproses...' : 'Ya, Lanjutkan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">{title}</h4>
      <div className="space-y-2.5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
      <span className="text-xs font-medium text-slate-500 w-full sm:w-32 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-medium break-words">{value || '-'}</span>
    </div>
  );
}

function MetricCard({ label, value, className }) {
  return (
    <div className={cn("bg-white p-3 rounded-xl border border-slate-200 shadow-sm", className)}>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center text-slate-400 py-8">
      <Icon size={48} strokeWidth={1} className="mb-3 text-slate-300" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}
