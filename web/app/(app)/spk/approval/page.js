'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { formatDate } from '@/lib/date-utils';
import { STATUS_LABELS, CATEGORY_COLORS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RefreshCw, CheckCircle, Clock, ChevronRight, ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

// Strip trailing /api so we get the server root (e.g. https://pphsekti.devlabfortirta.cloud)
const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');

function detectMeasurementUnit(operationText) {
  if (!operationText) return null;
  const t = operationText;
  const l = t.toLowerCase();
  if (t.includes('°C') || t.includes('ºC')) return '°C';
  if (t.includes('mm/s')) return 'mm/s';
  if (t.includes('m3/h')) return 'm3/h';
  if (/bar/i.test(t)) return 'bar';
  if (t.includes('NTU')) return 'NTU';
  if (t.includes('pH')) return 'pH';
  if (/\bOhm\b/i.test(t)) return 'Ohm';
  if (/[.\s]\s*%/.test(t)) return '%';
  if (/[.(]\s*A\s*[).]|\.\.\s*A\b/.test(t)) return 'A';
  if (/[.(]\s*V\s*[).]|\.\.\s*V\b/.test(t)) return 'V';
  if (l.includes('temperatur') || l.includes('suhu')) return '°C';
  if (l.includes('vibrasi') || l.includes('vibration')) return 'mm/s';
  if (l.includes('tekanan') || l.includes('pressure')) return 'bar';
  if (l.includes('ampere') || l.includes('arus')) return 'A';
  if (l.includes('tegangan') || l.includes('voltage')) return 'V';
  if (l.includes('turbid') || l.includes('kekeruhan')) return 'NTU';
  return null;
}

const PENDING_STATUSES = {
  kasie:         ['awaiting_kasie'],
  kepala_seksi:  ['awaiting_kasie'],
  supervisor:    ['awaiting_kasie'],
  kadis:         ['awaiting_kadis_perawatan', 'awaiting_kadis'],
  admin:         ['awaiting_kasie', 'awaiting_kadis_perawatan', 'awaiting_kadis'],
};

// Maps user.group (DB value) → SPK category (DB value) for kasie discipline filtering.
// Note: the Elektrik discipline stores group='Elektrik' but category='Listrik' — all others are identity.
const GROUP_TO_CATEGORY = {
  Mekanik: 'Mekanik',
  Elektrik: 'Listrik',
  Sipil: 'Sipil',
  Otomasi: 'Otomasi',
};

const KASIE_ROLES = new Set(['kasie', 'kepala_seksi', 'supervisor']);

const STATUS_COLORS = {
  awaiting_kasie:              'bg-amber-100 text-amber-700',
  awaiting_kadis_perawatan:    'bg-blue-100 text-blue-700',
  awaiting_kadis:              'bg-purple-100 text-purple-700',
};

function approveEndpoint(status) {
  if (status === 'awaiting_kasie')           return 'approve-kasie';
  if (status === 'awaiting_kadis_perawatan') return 'approve-kadis-perawatan';
  if (status === 'awaiting_kadis')           return 'approve-kadis';
  return null;
}

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{label}</span>;
}

function CategoryBadge({ category }) {
  const style = CATEGORY_COLORS[category] || {};
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {category}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SpkApprovalPage() {
  const [user, setUser]       = useState(null);
  const [userMap, setUserMap] = useState({});
  const [spks, setSpks]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);     // selected SPK (list item)
  const [detail, setDetail]   = useState(null);        // { spk, submission }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [lightbox, setLightbox] = useState(null);      // photo path string

  useEffect(() => { setUser(getUser()); }, []);

  useEffect(() => {
    apiGet('/users').then(users => {
      setUserMap(Object.fromEntries(users.map(u => [u.id, u.name || u.nik])));
    }).catch(() => {});
  }, []);

  const load = useCallback(async (u) => {
    const role = u?.role;
    const statuses = PENDING_STATUSES[role];
    if (!statuses) { setSpks([]); setLoading(false); return; }

    // Kasie: only fetch SPKs matching their discipline
    if (KASIE_ROLES.has(role)) {
      const category = GROUP_TO_CATEGORY[String(u?.group || '').trim()];
      if (!category) { setSpks([]); setLoading(false); return; }

      setLoading(true);
      try {
        const data = await apiGet(`/spk?status=awaiting_kasie&category=${encodeURIComponent(category)}`);
        setSpks(data.sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0)));
      } catch (e) {
        toast.error('Gagal memuat daftar SPK: ' + e.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        statuses.map(s => apiGet(`/spk?status=${encodeURIComponent(s)}`))
      );
      const merged = results.flat().sort((a, b) =>
        new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0)
      );
      setSpks(merged);
    } catch (e) {
      toast.error('Gagal memuat daftar SPK: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load(user);
  }, [user, load]);

  async function selectSpk(spk) {
    setSelected(spk);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const [spkDetail, submissions] = await Promise.all([
        apiGet(`/spk/${encodeURIComponent(spk.spkNumber)}`),
        apiGet(`/submissions?spkNumber=${encodeURIComponent(spk.spkNumber)}`),
      ]);
      setDetail({ spk: spkDetail, submission: submissions?.[0] ?? null });
    } catch (e) {
      toast.error('Gagal memuat detail: ' + e.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleApprove() {
    if (!detail) return;
    const endpoint = approveEndpoint(detail.spk.status);
    if (!endpoint) { toast.error('Status tidak valid untuk persetujuan'); return; }

    setApproving(true);
    try {
      await apiPost(`/spk/${encodeURIComponent(detail.spk.spkNumber)}/${endpoint}`, {});
      toast.success('SPK berhasil disetujui');
      setConfirmOpen(false);
      setSelected(null);
      setDetail(null);
      await load(user);
    } catch (e) {
      toast.error('Gagal menyetujui: ' + e.message);
    } finally {
      setApproving(false);
    }
  }

  const canApprove = detail && !!approveEndpoint(detail.spk.status);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (user && !PENDING_STATUSES[user.role]) {
    return (
      <div className="p-10 text-center text-gray-500">
        Halaman ini hanya tersedia untuk Kasie, Kadis, atau Admin.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Left: SPK list ────────────────────────────────────────────────── */}
      <div className="w-96 shrink-0 border-r border-gray-200 flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Persetujuan SPK</h2>
            <p className="text-xs text-gray-400">{spks.length} SPK menunggu</p>
          </div>
          <button
            onClick={() => load(user)}
            disabled={loading}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loading ? (
            <div className="p-6 text-center text-gray-400 text-sm">Memuat...</div>
          ) : spks.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle size={32} className="mx-auto text-green-400 mb-2" />
              {KASIE_ROLES.has(user?.role) && !GROUP_TO_CATEGORY[String(user?.group || '').trim()] ? (
                <p className="text-sm text-gray-500">
                  Grup Anda belum dikonfigurasi.<br />
                  <span className="text-gray-400">Hubungi admin untuk mengatur grup Anda.</span>
                </p>
              ) : (
                <p className="text-sm text-gray-400">Tidak ada SPK yang perlu disetujui</p>
              )}
            </div>
          ) : (
            spks.map(spk => (
              <button
                key={spk.spkNumber}
                onClick={() => selectSpk(spk)}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3',
                  selected?.spkNumber === spk.spkNumber && 'bg-blue-50 border-l-2 border-blue-500'
                )}
              >
                <Clock size={15} className="mt-0.5 shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-semibold text-gray-700 truncate">
                      {spk.spkNumber}
                    </span>
                    <CategoryBadge category={spk.category} />
                  </div>
                  <p className="text-xs text-gray-500 truncate mb-1">
                    {spk.equipmentModels?.[0]?.equipmentName || '—'}
                  </p>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={spk.status} />
                    <span className="text-[10px] text-gray-400">
                      {spk.submittedAt ? formatDate(spk.submittedAt) : '—'}
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} className="shrink-0 text-gray-300 mt-1" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Detail panel ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <CheckCircle size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Pilih SPK dari daftar untuk melihat detail</p>
            </div>
          </div>
        ) : loadingDetail ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Memuat detail...
          </div>
        ) : detail ? (
          <DetailPanel
            detail={detail}
            canApprove={canApprove}
            onApprove={() => setConfirmOpen(true)}
            onPhotoClick={(path) => setLightbox(path)}
            userMap={userMap}
          />
        ) : null}
      </div>

      {/* ── Confirm dialog ────────────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Konfirmasi Persetujuan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Setujui SPK <span className="font-semibold font-mono">{detail?.spk?.spkNumber}</span>?
            Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={approving}>
              Batal
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? 'Menyetujui...' : 'Setujui'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Photo lightbox ────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X size={24} />
          </button>
          <img
            src={`${UPLOADS_BASE}/${lightbox.replace(/^\//, '')}`}
            alt="Foto lapangan"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ detail, canApprove, onApprove, onPhotoClick, userMap = {} }) {
  const { spk, submission } = detail;
  const activities = spk.activitiesModel || [];
  const results    = submission?.activityResultsModel || [];
  const photos     = submission?.photoPaths || [];

  // Merge activities with their results
  const resultMap = new Map(results.map(r => [r.activityNumber, r]));

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold font-mono text-gray-900">{spk.spkNumber}</h3>
              <CategoryBadge category={spk.category} />
              <StatusBadge status={spk.status} />
            </div>
            <p className="text-sm text-gray-500">{spk.description || '—'}</p>
          </div>
          {canApprove && (
            <Button onClick={onApprove} className="gap-2 shrink-0">
              <CheckCircle size={15} />
              Setujui SPK
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <Info label="Interval" value={spk.interval || '—'} />
          <Info label="Disubmit oleh" value={userMap[spk.submittedBy] || spk.submittedBy || '—'} />
          <Info label="Waktu Submit" value={formatDate(spk.submittedAt)} />
        </div>
      </div>

      {/* Equipment */}
      {spk.equipmentModels?.length > 0 && (
        <Section title="Equipment">
          <div className="divide-y divide-gray-100">
            {spk.equipmentModels.map(eq => (
              <div key={eq.equipmentId} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-800">{eq.equipmentName || eq.equipmentId}</span>
                  <span className="ml-2 text-xs text-gray-400 font-mono">{eq.functionalLocation}</span>
                </div>
                <span className="text-xs text-gray-400">{eq.plantName || '—'}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Activity Results */}
      <Section title={`Hasil Kegiatan (${activities.length} aktivitas)`}>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Tidak ada data aktivitas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Aktivitas</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Uraian Pekerjaan</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rencana</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Komentar Hasil</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nilai Ukur</th>
                  <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activities.map(act => {
                  const res = resultMap.get(act.activityNumber);
                  return (
                    <tr key={act.activityNumber} className="hover:bg-gray-50">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-500">{act.activityNumber}</td>
                      <td className="py-2 pr-4 text-gray-700">{act.operationText || '—'}</td>
                      <td className="py-2 pr-4 text-right text-gray-500">{act.durationPlan ? `${act.durationPlan} mnt` : '—'}</td>
                      <td className="py-2 pr-4 text-gray-600 max-w-[200px]">
                        {res?.resultComment || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-sm text-gray-700">
                        {res?.measurementValue != null ? (() => {
                          const unit = res.measurementUnit || detectMeasurementUnit(act.operationText);
                          return `${res.measurementValue}${unit ? ' ' + unit : ''}`;
                        })() : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2 text-center">
                        {res ? (
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-semibold',
                            res.isNormal ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          )}>
                            {res.isNormal ? 'Normal' : 'Tidak Normal'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Field Notes */}
      {submission && (
        <Section title="Catatan Lapangan">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Info label="Durasi Aktual" value={submission.durationActual != null ? `${submission.durationActual} menit` : '—'} />
            <Info
              label="Lokasi GPS"
              value={submission.latitude != null
                ? `${parseFloat(submission.latitude).toFixed(5)}, ${parseFloat(submission.longitude).toFixed(5)}`
                : '—'}
            />
            <Info label="Evaluasi" value={submission.evaluasi || '—'} />
          </div>
        </Section>
      )}

      {/* Photos */}
      <Section title={`Foto Lapangan (${photos.length})`}>
        {photos.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
            <ImageIcon size={16} /> Tidak ada foto
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {photos.map((path, i) => (
              <button
                key={i}
                onClick={() => onPhotoClick(path)}
                className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
              >
                <img
                  src={`${UPLOADS_BASE}/${path.replace(/^\//, '')}`}
                  alt={`Foto ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Approval History */}
      <Section title="Riwayat Persetujuan">
        <div className="space-y-2 text-sm">
          <ApprovalRow
            label="Submit"
            by={userMap[spk.submittedBy] || spk.submittedBy}
            at={spk.submittedAt}
            done={!!spk.submittedAt}
          />
          <ApprovalRow
            label={`Kasie ${spk.category || ''}`}
            by={userMap[spk.kasieApprovedBy] || spk.kasieApprovedBy}
            at={spk.kasieApprovedAt}
            done={!!spk.kasieApprovedAt}
          />
          <ApprovalRow
            label="Kadis Perawatan"
            by={userMap[spk.kadisPerawatanApprovedBy] || spk.kadisPerawatanApprovedBy}
            at={spk.kadisPerawatanApprovedAt}
            done={!!spk.kadisPerawatanApprovedAt}
          />
          <ApprovalRow
            label={`Kadis${spk.equipmentModels?.[0]?.plantName ? ` — ${spk.equipmentModels[0].plantName}` : ''}`}
            by={userMap[spk.kadisApprovedBy] || spk.kadisApprovedBy}
            at={spk.kadisApprovedAt}
            done={!!spk.kadisApprovedAt}
          />
        </div>
      </Section>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 break-words">{value}</p>
    </div>
  );
}

function ApprovalRow({ label, by, at, done }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className={cn(
        'w-4 h-4 rounded-full flex items-center justify-center shrink-0',
        done ? 'bg-green-500' : 'bg-gray-200'
      )}>
        {done && <CheckCircle size={10} className="text-white" />}
      </div>
      <span className="w-48 text-gray-600 font-medium">{label}</span>
      {done ? (
        <span className="text-gray-500">{by || '—'} · {formatDate(at)}</span>
      ) : (
        <span className="text-gray-300">Belum disetujui</span>
      )}
    </div>
  );
}
