'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const APPROVAL_LABELS = {
  pending: 'Proses',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  menunggu_review_awal_kadis_pp: 'Review PP',
  spk_issued: 'SPK Issued',
  eksekusi: 'Eksekusi',
  menunggu_review_kadis_pp: 'Proses TTP',
  menunggu_review_kadis_pelapor: 'Proses TTP',
};

const APPROVAL_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  menunggu_review_awal_kadis_pp: 'bg-blue-100 text-blue-700',
  spk_issued: 'bg-purple-100 text-purple-700',
  eksekusi: 'bg-orange-100 text-orange-700',
  menunggu_review_kadis_pp: 'bg-blue-100 text-blue-700',
  menunggu_review_kadis_pelapor: 'bg-blue-100 text-blue-700',
};

const STATUS_LABELS = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  draft: 'Draft',
  eksekusi: 'Eksekusi',
  awaiting_kadis_pusat: 'Review Kadis PP',
  awaiting_kadis_pelapor: 'Review Pelapor',
  completed: 'Selesai',
};

const STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  draft: 'bg-gray-100 text-gray-600',
  eksekusi: 'bg-orange-100 text-orange-700',
  awaiting_kadis_pusat: 'bg-purple-100 text-purple-700',
  awaiting_kadis_pelapor: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
};

const SPK_STEPS = [
  { label: 'Draft', key: 'draft' },
  { label: 'Eksekusi', key: 'eksekusi' },
  { label: 'Review Kadis PP', key: 'awaiting_kadis_pusat' },
  { label: 'Review Pelapor', key: 'awaiting_kadis_pelapor' },
  { label: 'Selesai', key: 'completed' },
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

const EMPTY_SPK_FORM = {
  notificationId: '', orderNumber: '', priority: 'medium',
  equipmentId: '', location: '', requestedFinishDate: '',
  jobDescription: '', workCenter: 'mechanical',
  plannedWorker: 1, plannedHourPerWorker: 1,
};

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
  const [filterSpkPriority, setFilterSpkPriority] = useState('');

  // Detail dialogs
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedSpk, setSelectedSpk] = useState(null);

  // SPK create/edit panel
  const [spkPanelOpen, setSpkPanelOpen] = useState(false);
  const [spkForm, setSpkForm] = useState(EMPTY_SPK_FORM);
  const [savingSpk, setSavingSpk] = useState(false);

  // Confirm dialog
  const [confirmState, setConfirmState] = useState(null); // { title, message, withNotes, onConfirm }
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqData, spkData, histData] = await Promise.all([
        apiGet(`/corrective/requests${filterNotifStatus ? `?status=${filterNotifStatus}` : ''}`),
        apiGet(`/corrective/spk${buildSpkQuery()}`),
        apiGet('/corrective/spk/history'),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      setSpks(Array.isArray(spkData) ? spkData : []);
      setHistory(Array.isArray(histData) ? histData : []);
    } catch (e) {
      toast.error('Gagal memuat data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [filterNotifStatus, filterSpkStatus, filterSpkPriority]); // eslint-disable-line react-hooks/exhaustive-deps

  function buildSpkQuery() {
    const p = new URLSearchParams();
    if (filterSpkStatus) p.set('status', filterSpkStatus);
    if (filterSpkPriority) p.set('priority', filterSpkPriority);
    return p.toString() ? `?${p}` : '';
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  // Client-side approval filter
  const filteredRequests = filterApprovalStatus
    ? requests.filter((r) => r.approvalStatus === filterApprovalStatus)
    : requests;

  const activeSpks = spks.filter((s) => s.status !== 'completed' && s.status !== 'rejected');

  // Confirm helper
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

  // Actions
  async function approvePlanner(id) {
    confirm('Terima Laporan', 'Terima dan setujui laporan ini? Status akan berubah menjadi "Approved" dan siap dibuatkan SPK.', async () => {
      await apiPost(`/corrective/requests/${id}/approve-planner`);
      toast.success('Laporan berhasil diterima!');
      setSelectedRequest(null);
      loadAll();
    });
  }

  async function approveKadisPP(id) {
    confirm('Approve Review Awal Kadis PP', 'SPK akan disetujui dan statusnya berubah menjadi "SPK Issued". Lanjutkan?', async () => {
      await apiPost(`/corrective/requests/${id}/approve`);
      toast.success('SPK berhasil disetujui oleh Kadis PP!');
      setSelectedRequest(null);
      loadAll();
    });
  }

  async function rejectKadisPP(id) {
    confirm('Tolak Review Awal Kadis PP', 'SPK akan ditolak. Mohon berikan catatan alasan penolakan:', async (notes) => {
      await apiPost(`/corrective/requests/${id}/reject`, { notes });
      toast.success('SPK ditolak oleh Kadis PP.');
      setSelectedRequest(null);
      loadAll();
    }, true);
  }

  async function approveSpkKadisPusat(spkId) {
    confirm('Approve Kadis PP', 'Lanjutkan penyetujuan SPK?', async () => {
      await apiPost(`/corrective/spk/${spkId}/approve-kadis-pusat`);
      toast.success('SPK Disetujui');
      setSelectedSpk(null);
      loadAll();
    });
  }

  async function approveSpkKadisPelapor(spkId) {
    confirm('Approve Final', 'Selesaikan dan tutup SPK?', async () => {
      await apiPost(`/corrective/spk/${spkId}/approve-kadis-pelapor`);
      toast.success('SPK Selesai');
      setSelectedSpk(null);
      loadAll();
    });
  }

  async function rejectSpk(spkId) {
    confirm('Tolak SPK', 'Alasan penolakan:', async (notes) => {
      await apiPost(`/corrective/spk/${spkId}/reject`, { notes });
      toast.success('SPK Ditolak');
      setSelectedSpk(null);
      loadAll();
    }, true);
  }

  function openSpkPanel(req) {
    setSpkForm({
      ...EMPTY_SPK_FORM,
      notificationId: req.id,
      equipmentId: req.equipment || '',
      location: req.functionalLocation || '',
      jobDescription: [req.description, req.longText].filter(Boolean).join('\n'),
      workCenter: req.workCenter || 'mechanical',
    });
    setSelectedRequest(null);
    setSpkPanelOpen(true);
  }

  async function saveSpk() {
    const { notificationId, priority, equipmentId, jobDescription } = spkForm;
    if (!notificationId || !priority || !equipmentId || !jobDescription) {
      toast.error('Notifikasi, prioritas, equipment, dan deskripsi wajib diisi.');
      return;
    }
    setSavingSpk(true);
    try {
      await apiPost('/corrective/spk', {
        ...spkForm,
        plannedWorker: parseInt(spkForm.plannedWorker) || 1,
        plannedHourPerWorker: parseFloat(spkForm.plannedHourPerWorker) || 1,
      });
      toast.success('SPK berhasil dibuat');
      setSpkPanelOpen(false);
      loadAll();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingSpk(false);
    }
  }

  const TABS = [
    { key: 'requests', label: 'Notifikasi', count: filteredRequests.length },
    { key: 'spk', label: 'SPK Aktif', count: activeSpks.length },
    { key: 'history', label: 'History', count: history.length },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Corrective Planner</h2>
          <p className="text-sm text-gray-500">Manajemen laporan dan SPK corrective maintenance</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </Button>
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
              <option value="menunggu_review_awal_kadis_pp">Review Kadis PP</option>
              <option value="spk_issued">SPK Issued</option>
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
                      <Badge value={req.status} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} />
                    </td>
                    <td className="px-3 py-3">
                      <Badge value={req.approvalStatus} colorMap={APPROVAL_COLORS} labelMap={APPROVAL_LABELS} />
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {req.status === 'submitted' && req.approvalStatus === 'pending' && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => approvePlanner(req.id)}>Terima</Button>
                        )}
                        {req.status === 'approved' && !req.spkId && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => openSpkPanel(req)}>Generate SPK</Button>
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
              <option value="draft">Draft</option>
              <option value="eksekusi">Eksekusi</option>
              <option value="awaiting_kadis_pusat">Review Kadis PP</option>
              <option value="awaiting_kadis_pelapor">Review Pelapor</option>
            </select>
            <select value={filterSpkPriority} onChange={(e) => setFilterSpkPriority(e.target.value)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Semua Prioritas</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['SPK Number', 'Order Number', 'Dibuat', 'Equipment', 'Prioritas', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : activeSpks.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Belum ada SPK aktif</td></tr>
                ) : activeSpks.map((spk) => (
                  <tr key={spk.spkId} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSpk(spk)}>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-800">{spk.spkNumber || spk.spkId}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">{spk.orderNumber || '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">{fmtDate(spk.createdDate)}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">{spk.equipmentId || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 capitalize">{spk.priority || '—'}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge value={spk.status} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} />
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {spk.status === 'awaiting_kadis_pusat' && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => approveSpkKadisPusat(spk.spkId)}>Approve</Button>
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

      {/* Tab: History */}
      {tab === 'history' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['SPK Number', 'Dibuat', 'Equipment', 'Status', 'Aksi'].map((h) => (
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
                <tr key={spk.spkId} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSpk(spk)}>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-800">{spk.spkNumber || spk.spkId}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{fmtDate(spk.createdDate)}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{spk.equipmentId || '—'}</td>
                  <td className="px-3 py-3"><Badge value={spk.status} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} /></td>
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
                <Row label="Status"><Badge value={selectedRequest.status} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} /></Row>
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
                      const src = p.startsWith('/') ? p : '/' + p;
                      return (
                        <img key={i} src={src} alt="Photo" onClick={() => window.open(src, '_blank')}
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80" />
                      );
                    })}
                  </div>
                </Section>
              )}
              <Section title="Metadata">
                <Row label="Pelapor">{selectedRequest.reportedBy || '-'}</Row>
                <Row label="Waktu Lapor">{fmtDate(selectedRequest.notificationDate || selectedRequest.submittedAt)}</Row>
              </Section>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedRequest(null)}>Tutup</Button>
            {selectedRequest?.status === 'submitted' && selectedRequest?.approvalStatus === 'pending' && (
              <Button onClick={() => { setSelectedRequest(null); approvePlanner(selectedRequest.id); }}>Terima Laporan</Button>
            )}
            {selectedRequest?.status === 'approved' && !selectedRequest?.spkId && (
              <Button onClick={() => openSpkPanel(selectedRequest)}>Generate SPK</Button>
            )}
            {selectedRequest?.approvalStatus === 'menunggu_review_awal_kadis_pp' && (
              <>
                <Button variant="outline" className="text-red-600" onClick={() => { setSelectedRequest(null); rejectKadisPP(selectedRequest.id); }}>Tolak</Button>
                <Button onClick={() => { setSelectedRequest(null); approveKadisPP(selectedRequest.id); }}>Approve Kadis PP</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SPK Detail Dialog */}
      <Dialog open={!!selectedSpk} onOpenChange={(o) => !o && setSelectedSpk(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail SPK Corrective</DialogTitle>
          </DialogHeader>
          {selectedSpk && (
            <div className="space-y-4 text-sm">
              {/* Status flow */}
              <div className="flex items-center gap-1 flex-wrap">
                {SPK_STEPS.map((step, i) => {
                  const currentIdx = SPK_STEPS.findIndex((s) => s.key === selectedSpk.status);
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
                      {i < SPK_STEPS.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                    </div>
                  );
                })}
              </div>
              <Section title="Informasi Utama">
                <Row label="SPK Number"><span className="font-mono font-semibold">{selectedSpk.spkNumber || selectedSpk.spkId}</span></Row>
                <Row label="Work Center">{selectedSpk.workCenter || '-'}</Row>
                <Row label="Status"><Badge value={selectedSpk.status} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} /></Row>
              </Section>
              <Section title="Perencanaan Sumber Daya">
                <Row label="Pekerja">{selectedSpk.plannedWorker || 0} orang</Row>
                <Row label="Estimasi Jam">{selectedSpk.totalPlannedHour || 0} jam</Row>
              </Section>
              <Section title="Deskripsi Pekerjaan">
                <p className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed">{selectedSpk.jobDescription || '-'}</p>
              </Section>
              {selectedSpk.photos?.length > 0 && (
                <Section title="Foto Dokumentasi">
                  <div className="flex flex-wrap gap-2">
                    {selectedSpk.photos.map((p, i) => (
                      <img key={i} src={`/${p.photoPath}`} alt={p.photoType}
                        onClick={() => window.open(`/${p.photoPath}`, '_blank')}
                        className="w-24 h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80" />
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedSpk(null)}>Tutup</Button>
            {selectedSpk?.status === 'awaiting_kadis_pusat' && (
              <>
                <Button variant="outline" className="text-red-600" onClick={() => { setSelectedSpk(null); rejectSpk(selectedSpk.spkId); }}>Tolak</Button>
                <Button onClick={() => { setSelectedSpk(null); approveSpkKadisPusat(selectedSpk.spkId); }}>Setujui (Kadis PP)</Button>
              </>
            )}
            {selectedSpk?.status === 'awaiting_kadis_pelapor' && (
              <>
                <Button variant="outline" className="text-red-600" onClick={() => { setSelectedSpk(null); rejectSpk(selectedSpk.spkId); }}>Tolak</Button>
                <Button onClick={() => { setSelectedSpk(null); approveSpkKadisPelapor(selectedSpk.spkId); }}>Setujui (Pelapor)</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SPK Create Panel */}
      <Dialog open={spkPanelOpen} onOpenChange={setSpkPanelOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate SPK Corrective</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <SpkField label="Notification ID" value={spkForm.notificationId} onChange={(v) => setSpkForm((f) => ({ ...f, notificationId: v }))} disabled />
            <div className="grid grid-cols-2 gap-3">
              <SpkField label="Order Number" value={spkForm.orderNumber} onChange={(v) => setSpkForm((f) => ({ ...f, orderNumber: v }))} />
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Prioritas *</label>
                <select value={spkForm.priority} onChange={(e) => setSpkForm((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <SpkField label="Equipment ID *" value={spkForm.equipmentId} onChange={(v) => setSpkForm((f) => ({ ...f, equipmentId: v }))} />
            <SpkField label="Functional Location" value={spkForm.location} onChange={(v) => setSpkForm((f) => ({ ...f, location: v }))} />
            <SpkField label="Target Selesai" value={spkForm.requestedFinishDate} onChange={(v) => setSpkForm((f) => ({ ...f, requestedFinishDate: v }))} type="date" />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Work Center</label>
              <select value={spkForm.workCenter} onChange={(e) => setSpkForm((f) => ({ ...f, workCenter: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="mechanical">Mechanical</option>
                <option value="electrical">Electrical</option>
                <option value="civil">Civil</option>
                <option value="automation">Automation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Deskripsi Pekerjaan *</label>
              <textarea value={spkForm.jobDescription} onChange={(e) => setSpkForm((f) => ({ ...f, jobDescription: e.target.value }))}
                rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SpkField label="Jumlah Pekerja" value={spkForm.plannedWorker} onChange={(v) => setSpkForm((f) => ({ ...f, plannedWorker: v }))} type="number" />
              <SpkField label="Jam / Pekerja" value={spkForm.plannedHourPerWorker} onChange={(v) => setSpkForm((f) => ({ ...f, plannedHourPerWorker: v }))} type="number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSpkPanelOpen(false)}>Batal</Button>
            <Button onClick={saveSpk} disabled={savingSpk}>{savingSpk ? 'Menyimpan...' : 'Buat SPK'}</Button>
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

function SpkField({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-400" />
    </div>
  );
}
