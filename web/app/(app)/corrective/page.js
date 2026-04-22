'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RefreshCw, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const APPROVAL_LABELS = {
  pending: 'Proses',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

const APPROVAL_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

// Notification Status
const NOTIF_STATUS_LABELS = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

const NOTIF_STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

// SAP SPK Status
const SAP_STATUS_LABELS = {
  baru_import: 'Tugas Baru',
  eksekusi: 'Eksekusi',
  menunggu_review_kadis_pp: 'Review Kadis PP',
  menunggu_review_kadis_pelapor: 'Review Pelapor',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
};

const SAP_STATUS_COLORS = {
  baru_import: 'bg-gray-100 text-gray-600',
  eksekusi: 'bg-orange-100 text-orange-700',
  menunggu_review_kadis_pp: 'bg-purple-100 text-purple-700',
  menunggu_review_kadis_pelapor: 'bg-indigo-100 text-indigo-700',
  selesai: 'bg-green-100 text-green-700',
  ditolak: 'bg-red-100 text-red-600',
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

function Badge({ value, colorMap, labelMap }) {
  const color = colorMap?.[value] || 'bg-gray-100 text-gray-600';
  const label = labelMap?.[value] || value || '-';
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{label}</span>;
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
  const [confirmState, setConfirmState] = useState(null); // { title, message, withNotes, onConfirm }
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

  function confirm(title, message, onConfirm, withNotes = false) {
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
        headers: {
          'Authorization': `Bearer ${token}`
        },
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

  // Actions
  async function approvePlanner(id) {
    confirm('Terima Laporan', 'Terima dan setujui laporan ini?', async () => {
      await apiPost(`/corrective/requests/${id}/approve-planner`);
      toast.success('Laporan berhasil diterima!');
      setSelectedRequest(null);
      loadAll();
    });
  }

  // NOTE: Kadis PP / Kadis Pelapor approvals for SapSpkCorrective can be added here
  // similar to how they were handled before, if the API supports it.
  // For now, we will display them.

  const TABS = [
    { key: 'requests', label: 'Notifikasi', count: filteredRequests.length },
    { key: 'spk', label: 'SPK Aktif (SAP)', count: spks.length },
    { key: 'history', label: 'History', count: history.length },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Corrective Planner</h2>
          <p className="text-sm text-gray-500">Manajemen laporan dan integrasi SAP SPK corrective</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload} 
          />
          <Button variant="default" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={16} className="mr-2" />
            {uploading ? 'Mengunggah...' : 'Upload Excel SAP'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
            <span className={cn('ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold',
              tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab: Requests */}
      {tab === 'requests' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select value={filterNotifStatus} onChange={(e) => setFilterNotifStatus(e.target.value)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Semua Status</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={filterApprovalStatus} onChange={(e) => setFilterApprovalStatus(e.target.value)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Semua Approval</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['ID', 'Tanggal / Pelapor', 'Equipment / Lokasi', 'Tipe', 'Deskripsi', 'Status', 'Approval', 'Aksi'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : filteredRequests.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Tidak ada laporan ditemukan</td></tr>
                ) : filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRequest(req)}>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-800">{req.id}</td>
                    <td className="px-3 py-3">
                      <div className="text-xs text-gray-700">{fmtDate(req.notificationDate || req.submittedAt)}</div>
                      <div className="text-xs text-gray-400">{req.reportedBy || ''}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-xs text-gray-700">{req.equipment || '—'}</div>
                      <div className="text-xs text-gray-400">{req.functionalLocation || '—'}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{req.notificationType || '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-600 max-w-[180px] truncate">{req.description || '—'}</td>
                    <td className="px-3 py-3">
                      <Badge value={req.status} colorMap={NOTIF_STATUS_COLORS} labelMap={NOTIF_STATUS_LABELS} />
                    </td>
                    <td className="px-3 py-3">
                      <Badge value={req.approvalStatus} colorMap={APPROVAL_COLORS} labelMap={APPROVAL_LABELS} />
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {req.status === 'submitted' && req.approvalStatus === 'pending' && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => approvePlanner(req.id)}>Terima</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Active SPKs */}
      {tab === 'spk' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select value={filterSpkStatus} onChange={(e) => setFilterSpkStatus(e.target.value)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Semua Status</option>
              <option value="baru_import">Baru</option>
              <option value="eksekusi">Eksekusi</option>
              <option value="menunggu_review_kadis_pp">Review Kadis PP</option>
              <option value="menunggu_review_kadis_pelapor">Review Pelapor</option>
            </select>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Order Number', 'Tgl Posting', 'Equipment', 'Pekerja', 'Total Jam', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : spks.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Belum ada SPK aktif</td></tr>
                ) : spks.map((spk) => (
                  <tr key={spk.order_number} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSpk(spk)}>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-800">{spk.order_number}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">{fmtDate(spk.posting_date)}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">{spk.equipment_name || '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">{spk.actual_personnel || '-'}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">{spk.total_actual_hour || '-'}</td>
                    <td className="px-3 py-3">
                      <Badge value={spk.status} colorMap={SAP_STATUS_COLORS} labelMap={SAP_STATUS_LABELS} />
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                       <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedSpk(spk)}>Detail</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Order Number', 'Tgl Posting', 'Equipment', 'Status', 'Aksi'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Belum ada riwayat SPK</td></tr>
              ) : history.map((spk) => (
                <tr key={spk.order_number} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSpk(spk)}>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-800">{spk.order_number}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{fmtDate(spk.posting_date)}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{spk.equipment_name || '—'}</td>
                  <td className="px-3 py-3"><Badge value={spk.status} colorMap={SAP_STATUS_COLORS} labelMap={SAP_STATUS_LABELS} /></td>
                  <td className="px-3 py-3">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedSpk(spk); }}>Detail</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Notifikasi</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 text-sm">
              <Section title="Status">
                <Row label="Notification ID"><span className="font-mono font-semibold">{selectedRequest.id}</span></Row>
                <Row label="Status"><Badge value={selectedRequest.status} colorMap={NOTIF_STATUS_COLORS} labelMap={NOTIF_STATUS_LABELS} /></Row>
                <Row label="Approval"><Badge value={selectedRequest.approvalStatus} colorMap={APPROVAL_COLORS} labelMap={APPROVAL_LABELS} /></Row>
              </Section>
              <Section title="Informasi Peralatan">
                <Row label="Functional Location">{selectedRequest.functionalLocation || '-'}</Row>
                <Row label="Equipment">{selectedRequest.equipment || '-'}</Row>
                <Row label="Work Center">{selectedRequest.workCenter || '-'}</Row>
              </Section>
              <Section title="Deskripsi Kerusakan">
                <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                  <p className="font-semibold text-gray-800 mb-1">{selectedRequest.description || 'Tanpa judul'}</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{selectedRequest.longText || '-'}</p>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-600">
                  <span>Target Mulai: <strong>{fmtDate(selectedRequest.requiredStart)}</strong></span>
                  <span>Target Selesai: <strong>{fmtDate(selectedRequest.requiredEnd)}</strong></span>
                </div>
              </Section>
              {(selectedRequest.images || []).length > 0 && (
                <Section title="Foto Lapangan">
                  <div className="flex flex-wrap gap-2">
                    {selectedRequest.images.filter(Boolean).map((p, i) => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
                      const src = p.startsWith('http') ? p : p.startsWith('uploads/') ? `${baseUrl}/${p}` : `${baseUrl}/uploads/${p}`;
                      return (
                        <img key={i} src={src} alt="Photo" onClick={() => window.open(src, '_blank')}
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80" />
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedRequest(null)}>Tutup</Button>
            {selectedRequest?.status === 'submitted' && selectedRequest?.approvalStatus === 'pending' && (
              <Button onClick={() => { setSelectedRequest(null); approvePlanner(selectedRequest.id); }}>Terima Laporan</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SPK Detail Dialog */}
      <Dialog open={!!selectedSpk} onOpenChange={(o) => !o && setSelectedSpk(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail SPK SAP</DialogTitle>
          </DialogHeader>
          {selectedSpk && (
            <div className="space-y-4 text-sm">
              {/* Status flow */}
              <div className="flex items-center gap-1 flex-wrap">
                {SAP_SPK_STEPS.map((step, i) => {
                  const currentIdx = SAP_SPK_STEPS.findIndex((s) => s.key === selectedSpk.status);
                  const done = i < currentIdx;
                  const active = i === currentIdx;
                  return (
                    <div key={step.key} className="flex items-center gap-1">
                      <span className={cn('px-2 py-1 rounded text-xs font-semibold',
                        done ? 'bg-green-100 text-green-700' :
                        active ? 'bg-blue-600 text-white' :
                        'bg-gray-100 text-gray-400')}>
                        {step.label}
                      </span>
                      {i < SAP_SPK_STEPS.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                    </div>
                  );
                })}
              </div>
              <Section title="Informasi Utama">
                <Row label="Order Number"><span className="font-mono font-semibold">{selectedSpk.order_number}</span></Row>
                <Row label="Work Center">{selectedSpk.work_center || '-'}</Row>
                <Row label="Deskripsi">{selectedSpk.description || '-'}</Row>
                <Row label="Equipment">{selectedSpk.equipment_name || '-'}</Row>
                <Row label="Functional Loc">{selectedSpk.functional_location || '-'}</Row>
                <Row label="Status SAP">{selectedSpk.sys_status || '-'}</Row>
              </Section>
              
              {(selectedSpk.actual_materials || selectedSpk.actual_tools || selectedSpk.job_result_description) && (
                <Section title="Hasil Eksekusi Teknisi">
                  <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-orange-500">
                    <Row label="Pekerja Aktual">{selectedSpk.actual_personnel || 0} orang</Row>
                    <Row label="Jam Aktual">{selectedSpk.total_actual_hour || 0} jam</Row>
                    <div className="mt-2 text-xs text-gray-600">
                      <strong>Material:</strong> {selectedSpk.actual_materials || '-'}<br/>
                      <strong>Tools:</strong> {selectedSpk.actual_tools || '-'}<br/>
                      <strong>Deskripsi:</strong> {selectedSpk.job_result_description || '-'}
                    </div>
                  </div>
                </Section>
              )}

              {(selectedSpk.photo_before || selectedSpk.photo_after) && (
                <Section title="Foto Eksekusi">
                  <div className="flex flex-wrap gap-2">
                    {selectedSpk.photo_before && (
                      <div className="text-center">
                        <span className="text-xs text-gray-500 mb-1 block">Before</span>
                        <img 
                          src={`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_before}`} 
                          onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_before}`, '_blank')}
                          className="w-32 h-32 object-cover rounded-lg border border-gray-200 cursor-pointer" 
                          alt="Before" 
                        />
                      </div>
                    )}
                    {selectedSpk.photo_after && (
                      <div className="text-center">
                        <span className="text-xs text-gray-500 mb-1 block">After</span>
                        <img 
                          src={`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_after}`} 
                          onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_after}`, '_blank')}
                          className="w-32 h-32 object-cover rounded-lg border border-gray-200 cursor-pointer" 
                          alt="After" 
                        />
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedSpk(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmState} onOpenChange={(o) => !o && setConfirmState(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmState?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">{confirmState?.message}</p>
          {confirmState?.withNotes && (
            <textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)}
              placeholder="Catatan..." rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 mt-2" />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmState(null)} disabled={confirming}>Batal</Button>
            <Button onClick={runConfirm} disabled={confirming}>{confirming ? 'Memproses...' : 'Konfirmasi'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
      <div className="space-y-1.5 pl-1">{children}</div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-xs text-gray-800">{children}</span>
    </div>
  );
}
