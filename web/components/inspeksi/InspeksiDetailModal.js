'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { INSPEKSI_STATUS_META, resolveInspeksiTypeLabel } from '@/lib/inspeksi-service';
import {
  FileText, User, MapPin, Calendar, Tag, AlertCircle, CheckCircle,
  XCircle, Clock, Wrench, ClipboardList, Camera, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  rutin:     { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  k3:        { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  supervisi: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

const STATUS_CONFIG = {
  scheduled:          { Icon: Clock,        className: 'bg-amber-50 text-amber-700 border border-amber-200'   },
  in_progress:        { Icon: AlertCircle,  className: 'bg-blue-50 text-blue-700 border border-blue-200'      },
  completed:          { Icon: CheckCircle,  className: 'bg-green-50 text-green-700 border border-green-200'   },
  cancelled:          { Icon: XCircle,      className: 'bg-gray-100 text-gray-500 border border-gray-200'     },
  submitted:          { Icon: Clock,        className: 'bg-amber-50 text-amber-700 border border-amber-200'   },
  approved:           { Icon: CheckCircle,  className: 'bg-green-50 text-green-700 border border-green-200'   },
  rejected:           { Icon: XCircle,      className: 'bg-red-50 text-red-600 border border-red-200'         },
  revisions_required: { Icon: AlertTriangle,className: 'bg-orange-50 text-orange-700 border border-orange-200'},
};

const REPORT_STATUS_LABEL = {
  draft:              'Draft',
  submitted:          'Menunggu Persetujuan',
  approved:           'Disetujui',
  rejected:           'Ditolak',
  revisions_required: 'Perlu Revisi',
};

function StatusPill({ status }) {
  const meta   = INSPEKSI_STATUS_META[status] || {};
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  const { Icon } = config;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.className}`}>
      <Icon size={12} />
      {meta.label || status}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{children}</p>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-gray-500" />
      </div>
      <div>
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/** Tampilkan satu kartu laporan hasil. */
function ReportCard({ report, index }) {
  const [expanded, setExpanded] = useState(index === 0);

  const config       = STATUS_CONFIG[report.status] || STATUS_CONFIG.submitted;
  const { Icon }     = config;
  const statusLabel  = REPORT_STATUS_LABEL[report.status] || report.status?.toUpperCase();
  const tools        = Array.isArray(report.tools) ? report.tools : [];
  const photos       = Array.isArray(report.photos) ? report.photos : [];
  const attachments  = Array.isArray(report.attachments)
    ? report.attachments.map((path) => String(path || '').trim()).filter(Boolean)
    : [];
  const toFileUrl = (path) => path.startsWith('http')
    ? path
    : `${process.env.NEXT_PUBLIC_API_URL || ''}/${path.replace(/^\/+/, '')}`;
  const fileName = (path) => {
    const cleanPath = path.split('?')[0];
    const segments = cleanPath.split(/[\\/]/).filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] || 'Lampiran');
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* ── Header kartu (selalu terlihat) ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.className}`}>
            <Icon size={10} />
            {statusLabel}
          </span>
          <span className="text-xs text-gray-500 truncate">
            {report.inspectorName || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-400">
            {report.submittedAt
              ? formatDate(report.submittedAt)
              : report.createdAt
                ? formatDate(report.createdAt)
                : '—'}
          </span>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {/* ── Body kartu (expand/collapse) ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">

          {/* Baris meta: inspektor & tanggal submit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Inspektor</p>
              <div className="flex items-center gap-1.5">
                <User size={13} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-800 font-medium">{report.inspectorName || '—'}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Tanggal Submit</p>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-800 font-medium">
                  {report.submittedAt
                    ? new Date(report.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '—'}
                </span>
              </div>
            </div>

            {/* Kriteria */}
            {report.kriteria && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Kriteria</p>
                <div className="flex items-center gap-1.5">
                  <Tag size={13} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-800 font-medium">{report.kriteria}</span>
                </div>
              </div>
            )}
          </div>

          {/* Alat yang digunakan */}
          {tools.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Alat yang Digunakan</p>
              <div className="flex flex-wrap gap-1.5">
                {tools.map((tool, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium"
                  >
                    <Wrench size={9} />
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Temuan dan kondisi */}
          <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Temuan &amp; Kondisi</p>

            {/* Temuan */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Temuan</p>
              {report.findings ? (
                <p className="text-sm text-gray-700 leading-relaxed">{report.findings}</p>
              ) : (
                <p className="text-xs text-gray-400 italic">Tidak ada temuan dicatat</p>
              )}
            </div>

            {/* Ada kerusakan */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Ada Kerusakan</p>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  report.hasKerusakan
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {report.hasKerusakan ? (
                  <><AlertTriangle size={11} /> Ya — Ada Kerusakan</>
                ) : (
                  <><CheckCircle size={11} /> Tidak Ada Kerusakan</>
                )}
              </span>
              {report.hasKerusakan && report.kerusakanDetail && (
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{report.kerusakanDetail}</p>
              )}
            </div>

            {/* Dokumentasi (foto) */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Dokumentasi{photos.length > 0 ? ` (${photos.length})` : ''}
              </p>
              {photos.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Tidak ada dokumentasi foto</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((ph) => {
                    const src = ph.photoPath?.startsWith('http')
                      ? ph.photoPath
                      : `${process.env.NEXT_PUBLIC_API_URL || ''}/${ph.photoPath}`;
                    return (
                      <a
                        key={ph.id}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors group"
                        title={ph.caption || 'Foto dokumentasi'}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={ph.caption || 'dokumentasi'}
                          className="w-full h-24 object-cover group-hover:opacity-90 transition-opacity"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div
                          className="hidden w-full h-24 bg-gray-100 items-center justify-center"
                          style={{ display: 'none' }}
                        >
                          <Camera size={20} className="text-gray-400" />
                        </div>
                        {ph.caption && (
                          <p className="px-1.5 py-1 text-[10px] text-gray-500 truncate">{ph.caption}</p>
                        )}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {attachments.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Lampiran Dokumen ({attachments.length})
              </p>
              <div className="space-y-1.5">
                {attachments.map((path, i) => {
                  const src = toFileUrl(path);
                  return (
                    <a
                      key={`${path}-${i}`}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      <FileText size={13} className="text-gray-400 shrink-0" />
                      <span className="truncate">{fileName(path)}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catatan approval (jika ada) */}
          {report.approvalNotes && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mb-0.5">
                Catatan Persetujuan
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{report.approvalNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────────────────
const SCROLLBAR_STYLE = `
  .modal-custom-scroll {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }
  .modal-custom-scroll::-webkit-scrollbar {
    width: 5px;
  }
  .modal-custom-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .modal-custom-scroll::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 99px;
  }
  .modal-custom-scroll::-webkit-scrollbar-thumb:hover {
    background-color: #94a3b8;
  }
`;

export function InspeksiDetailModal({ schedule, open, onClose, usersMap = {} }) {
  const [reports,        setReports]   = useState([]);
  const [loadingReports, setLR]        = useState(false);
  const lastId = useRef(null);

  // Resolve NIK → nama
  function resolveNama(nik) {
    if (!nik) return '—';
    return usersMap[String(nik)] || nik;
  }

  useEffect(() => {
    if (!schedule || !open) return;
    if (lastId.current === schedule.id) return;
    lastId.current = schedule.id;

    setReports([]);
    setLR(true);
    apiGet(`/inspection/reports?scheduleId=${schedule.id}`)
      .then((d) => setReports(d?.data ?? []))
      .catch(() => setReports([]))
      .finally(() => setLR(false));
  }, [schedule, open]);

  if (!schedule) return null;

  const typeColor = TYPE_COLORS[schedule.type] || TYPE_COLORS.rutin;

  function handleOpenChange(val) {
    if (!val) {
      lastId.current = null;
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Inject scrollbar style sekali */}
      <style>{SCROLLBAR_STYLE}</style>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-0 modal-custom-scroll">

        {/* ── Header berwarna ── */}
        <div className="bg-[#0a2540] px-6 pt-6 pb-5 rounded-t-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <FileText size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeColor.bg} ${typeColor.text}`}>
                  {resolveInspeksiTypeLabel(schedule)}
                </span>
                {schedule.nomorPoJo && (
                  <span className="text-[10px] font-mono text-white/50">#{schedule.nomorPoJo}</span>
                )}
              </div>
              <DialogTitle className="text-white text-lg font-bold mt-1 leading-tight">
                {schedule.title}
              </DialogTitle>
              <div className="mt-2">
                <StatusPill status={schedule.status} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* ── 1. Deskripsi ── */}
          {schedule.notes && (
            <div>
              <SectionLabel>Deskripsi</SectionLabel>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-gray-700 leading-relaxed">{schedule.notes}</p>
              </div>
            </div>
          )}

          {/* ── 2. Info Pelapor & Informasi Utama ── */}
          <div>
            <SectionLabel>Informasi Utama</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={User}     label="Dibuat Oleh"      value={resolveNama(schedule.createdBy)} />
              <InfoRow icon={MapPin}   label="Lokasi"           value={schedule.location || '—'} />
              <InfoRow
                icon={Calendar}
                label="Tanggal Mulai"
                value={
                  schedule.scheduledDate
                    ? new Date(schedule.scheduledDate + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '—'
                }
              />
              <InfoRow
                icon={Calendar}
                label="Tanggal Selesai"
                value={
                  schedule.scheduledEndDate
                    ? new Date(schedule.scheduledEndDate + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '—'
                }
              />
              {schedule.kategoriTeknisi && (
                <InfoRow icon={Tag} label="Kategori Teknisi" value={schedule.kategoriTeknisi} />
              )}
              {schedule.kategoriK3 && (
                <InfoRow
                  icon={Tag}
                  label="Kategori K3"
                  value={schedule.kategoriK3 === 'manusia' ? 'Manusia (Perilaku/APD)' : 'Bangunan (Struktur/Fasilitas)'}
                />
              )}
            </div>
          </div>

          {/* ── Info Vendor ── */}
          {schedule.vendorInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Info Vendor</p>
              <p className="text-sm text-gray-700 leading-relaxed">{schedule.vendorInfo}</p>
            </div>
          )}

          {/* ── 6. Laporan Hasil ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={14} className="text-gray-400" />
              <SectionLabel>
                Laporan Hasil{!loadingReports && ` (${reports.length})`}
              </SectionLabel>
            </div>

            {loadingReports ? (
              <div className="text-xs text-gray-400 py-6 text-center">Memuat laporan...</div>
            ) : reports.length === 0 ? (
              <div className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">
                Belum ada laporan hasil untuk jadwal ini
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((r, i) => (
                  <ReportCard key={r.id} report={r} index={i} />
                ))}
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
