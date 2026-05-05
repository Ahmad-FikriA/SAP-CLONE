'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { INSPEKSI_STATUS_META, resolveInspeksiTypeLabel } from '@/lib/inspeksi-service';
import { FileText, User, MapPin, Calendar, Clock, Tag, AlertCircle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

const TYPE_COLORS = {
  rutin:     { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  k3:        { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  supervisi: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

const STATUS_CONFIG = {
  scheduled:   { Icon: Clock,        className: 'bg-amber-50 text-amber-700 border border-amber-200'   },
  in_progress: { Icon: AlertCircle,  className: 'bg-blue-50 text-blue-700 border border-blue-200'      },
  completed:   { Icon: CheckCircle,  className: 'bg-green-50 text-green-700 border border-green-200'   },
  cancelled:   { Icon: XCircle,      className: 'bg-gray-100 text-gray-500 border border-gray-200'     },
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

export function InspeksiDetailModal({ schedule, open, onClose }) {
  const [reports, setReports]       = useState([]);
  const [followUps, setFollowUps]   = useState([]);
  const [loadingReports, setLR]     = useState(false);
  const [loadingFollowUps, setLFU]  = useState(false);
  const lastId = useRef(null);

  useEffect(() => {
    if (!schedule || !open) return;
    if (lastId.current === schedule.id) return; // sudah di-load
    lastId.current = schedule.id;

    setReports([]);
    setFollowUps([]);

    setLR(true);
    apiGet(`/inspection/reports?scheduleId=${schedule.id}`)
      .then((d) => setReports(d?.data ?? []))
      .catch(() => setReports([]))
      .finally(() => setLR(false));

    setLFU(true);
    apiGet(`/inspection/follow-ups?scheduleId=${schedule.id}`)
      .then((d) => setFollowUps(d?.data ?? []))
      .catch(() => setFollowUps([]))
      .finally(() => setLFU(false));
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
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto p-0">
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
          {/* ── Info Utama ── */}
          <div>
            <SectionLabel>Informasi Utama</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow icon={User}     label="Dibuat Oleh"      value={schedule.createdBy} />
              <InfoRow icon={MapPin}   label="Lokasi"           value={schedule.location || '—'} />
              <InfoRow icon={Tag}      label="Unit Kerja"        value={schedule.unitKerja || '—'} />
              <InfoRow icon={Calendar} label="Tanggal Mulai"     value={schedule.scheduledDate ? new Date(schedule.scheduledDate + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
              <InfoRow icon={Calendar} label="Tanggal Selesai"   value={schedule.scheduledEndDate ? new Date(schedule.scheduledEndDate + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
              {schedule.kategoriTeknisi && (
                <InfoRow icon={Tag} label="Kategori Teknisi" value={schedule.kategoriTeknisi} />
              )}
              {schedule.kategoriK3 && (
                <InfoRow icon={Tag} label="Kategori K3" value={schedule.kategoriK3 === 'manusia' ? 'Manusia (Perilaku/APD)' : 'Bangunan (Struktur/Fasilitas)'} />
              )}
            </div>
          </div>

          {/* ── Catatan ── */}
          {(schedule.notes || schedule.vendorInfo) && (
            <div>
              <SectionLabel>Catatan & Informasi Tambahan</SectionLabel>
              <div className="space-y-3">
                {schedule.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Catatan</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{schedule.notes}</p>
                  </div>
                )}
                {schedule.vendorInfo && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Info Vendor</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{schedule.vendorInfo}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Laporan Hasil ── */}
          <div>
            <SectionLabel>Laporan Hasil {!loadingReports && `(${reports.length})`}</SectionLabel>
            {loadingReports ? (
              <div className="text-xs text-gray-400 py-3 text-center">Memuat laporan...</div>
            ) : reports.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-xl">
                Belum ada laporan hasil untuk jadwal ini
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div key={r.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${r.status === 'approved' ? 'bg-green-500' : r.status === 'rejected' ? 'bg-red-500' : 'bg-amber-400'}`} />
                        <span className="text-xs font-semibold text-gray-700">{r.status?.toUpperCase() || 'DRAFT'}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">{r.createdAt ? formatDate(r.createdAt) : '—'}</span>
                    </div>
                    {r.findings && (
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{r.findings}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Follow-up ── */}
          <div>
            <SectionLabel>Tindak Lanjut {!loadingFollowUps && `(${followUps.length})`}</SectionLabel>
            {loadingFollowUps ? (
              <div className="text-xs text-gray-400 py-3 text-center">Memuat tindak lanjut...</div>
            ) : followUps.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-xl">
                Belum ada tindak lanjut untuk jadwal ini
              </div>
            ) : (
              <div className="space-y-2">
                {followUps.map((fu) => (
                  <div key={fu.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700">{fu.title || 'Tindak Lanjut'}</span>
                      <span className="text-[10px] text-gray-400">{fu.createdAt ? formatDate(fu.createdAt) : '—'}</span>
                    </div>
                    {fu.description && (
                      <p className="text-sm text-gray-600 leading-relaxed">{fu.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                        ${fu.status === 'approved' ? 'bg-green-100 text-green-700' : fu.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {fu.status || 'pending'}
                      </span>
                      {fu.assignedTo && (
                        <span className="text-[10px] text-gray-400">→ {fu.assignedTo}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
