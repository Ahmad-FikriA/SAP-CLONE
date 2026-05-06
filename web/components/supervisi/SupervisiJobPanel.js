'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  MapPin, User, Calendar, Briefcase, Hash, DollarSign, Eye,
  BarChart2, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  AlertCircle, Clock, FileText, Image as ImageIcon, Pencil, ExternalLink,
  Download, AlertTriangle,
} from 'lucide-react';
import { SUPERVISI_STATUS_META } from '@/lib/supervisi-service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildMediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  // path sudah dalam format /uploads/supervisi/xxx
  return `${API_URL}${path}`;
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtShort(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtRupiah(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(val);
}

function parseDate(str) {
  if (!str) return null;
  return new Date(str + 'T00:00:00');
}

function inclusiveDays(start, end) {
  if (!start || !end) return 0;
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e || e < s) return 0;
  return Math.round((e - s) / 86400000) + 1;
}

function groupVisitsByDate(visits = []) {
  const map = {};
  for (const v of visits) {
    const d = (v.visitDate || '').split('T')[0];
    if (!d) continue;
    if (!map[d]) map[d] = [];
    map[d].push(v);
  }
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

function filenameFromPath(path) {
  return (path || '').split('/').pop() || 'dokumen';
}

// ─── Main Modal (centered, like InspeksiDetailModal) ─────────────────────────
export function SupervisiJobPanel({ job, onClose }) {
  const open = !!job;

  function handleOpenChange(val) {
    if (!val) onClose();
  }

  if (!job) return null;

  const meta    = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;
  const hasMaps = Array.isArray(job.locations) && job.locations.length > 0;
  const visits  = Array.isArray(job.visits) ? job.visits : [];
  const amends  = Array.isArray(job.amends)  ? job.amends  : [];

  const effectiveEndDate = amends.length > 0
    ? amends[amends.length - 1].amendBerakhir
    : job.waktuBerakhir;

  let sisaHari = null;
  if (effectiveEndDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end   = new Date(effectiveEndDate + 'T00:00:00');
    sisaHari    = Math.round((end - today) / 86400000);
  }

  // ── Progress stats ───────────────────────────────────────────────────────────
  const locCount  = hasMaps ? job.locations.length : 1;
  const totalHari = inclusiveDays(job.waktuMulai, effectiveEndDate);

  const visitsByDate = {};
  for (const v of visits) {
    const d = (v.visitDate || '').split('T')[0];
    if (!d || v.isDraft) continue;
    visitsByDate[d] = (visitsByDate[d] ?? 0) + 1;
  }
  const hariDiisi     = Object.values(visitsByDate).filter(c => c >= locCount).length;
  const finalVisits   = visits.filter(v => !v.isDraft);
  const hadirCount    = finalVisits.filter(v => v.status === 'hadir').length;
  const tidakHadirCount = finalVisits.filter(v => v.status !== 'hadir').length;
  const draftCount    = visits.filter(v => v.isDraft).length;
  const progress      = totalHari > 0 ? Math.min(hariDiisi / totalHari, 1) : 0;
  const progressPct   = Math.round(progress * 100);
  const progressColor = progress >= 0.8 ? '#16a34a' : progress >= 0.5 ? '#d97706' : '#1e40af';

  const grouped = groupVisitsByDate(visits);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <style>{`
        .sv-modal-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .sv-modal-scroll::-webkit-scrollbar { width: 5px; }
        .sv-modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .sv-modal-scroll::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 99px;
        }
        .sv-modal-scroll::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
      `}</style>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 sv-modal-scroll">

        {/* ── Header ── */}
        <div className="bg-[#0a2540] px-6 pt-6 pb-5 rounded-t-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Eye size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">
                Detail Job Supervisi
              </p>
              <DialogTitle className="text-white text-lg font-bold mt-0.5 leading-tight">
                {job.namaKerja || '(tanpa nama)'}
              </DialogTitle>
              <p className="text-xs font-mono text-white/50 mt-1">{job.nomorJo}</p>
              {/* Status + sisa hari */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
                {job.status === 'active' && sisaHari !== null && (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    sisaHari < 0
                      ? 'bg-red-900/40 text-red-200 border border-red-700'
                      : sisaHari === 0
                      ? 'bg-orange-900/40 text-orange-200 border border-orange-700'
                      : 'bg-blue-900/40 text-blue-200 border border-blue-700'
                  }`}>
                    {sisaHari < 0
                      ? `Terlambat ${Math.abs(sisaHari)} Hari`
                      : sisaHari === 0 ? 'Hari Ini Terakhir'
                      : `Sisa ${sisaHari} Hari`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-6">

          {/* ── Alasan Pembatalan (jika dibatalkan) ── */}
          {job.status === 'cancelled' && job.cancelReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-red-500">Alasan Pembatalan</p>
              </div>
              <p className="text-sm text-red-700 leading-relaxed">{job.cancelReason}</p>
            </div>
          )}

          {/* ── Informasi Pekerjaan ── */}
          <SectionWrap title="Informasi Pekerjaan" icon={<Briefcase size={13} />}>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow Icon={Hash}        label="Nomor JO"        value={<span className="font-mono font-semibold">{job.nomorJo || '—'}</span>} />
              <InfoRow Icon={Briefcase}   label="Pelaksana"       value={job.pelaksana} />
              <InfoRow Icon={User}        label="PIC Supervisi"   value={job.picSupervisi} />
              <InfoRow Icon={User}        label="Pengawas"        value={job.namaPengawas} />
              <InfoRow
                Icon={Calendar}
                label="Periode"
                value={`${fmt(job.waktuMulai)} — ${fmt(effectiveEndDate)}`}
              />
              <InfoRow Icon={DollarSign}  label="Nilai Pekerjaan" value={fmtRupiah(job.nilaiPekerjaan)} />
            </div>
          </SectionWrap>

          {/* ── Titik Lokasi ── */}
          {hasMaps && (
            <SectionWrap title={`Titik Lokasi (${job.locations.length})`} icon={<MapPin size={13} />}>
              <div className="space-y-2">
                {job.locations.map((loc, i) => (
                  <div key={loc.id || i} className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">{loc.namaArea || `Lokasi ${i + 1}`}</p>
                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                      {parseFloat(loc.latitude).toFixed(6)}, {parseFloat(loc.longitude).toFixed(6)}
                    </p>
                    <p className="text-[11px] text-gray-400">Radius: {loc.radius} m</p>
                  </div>
                ))}
              </div>
            </SectionWrap>
          )}

          {/* ── Riwayat Amend ── */}
          {amends.length > 0 && (
            <SectionWrap title="Riwayat Amend" icon={<Pencil size={13} />}>
              <div className="space-y-2">
                {amends.map((amend, i) => {
                  const isLast = i === amends.length - 1;
                  return (
                    <div
                      key={amend.id || i}
                      className={`rounded-xl px-3 py-2.5 border text-xs ${
                        isLast ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold ${isLast ? 'text-orange-700' : 'text-gray-600'}`}>
                          Amend {i + 1} — {amend.nomorAmend}
                        </span>
                        {isLast && (
                          <span className="bg-orange-200 text-orange-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            Terbaru
                          </span>
                        )}
                      </div>
                      <p className={isLast ? 'text-orange-600' : 'text-gray-500'}>
                        {fmtShort(amend.amendMulai)} → {fmtShort(amend.amendBerakhir)}
                      </p>
                      {Array.isArray(amend.documents) && amend.documents.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {amend.documents.map((doc, di) => (
                            <a
                              key={di}
                              href={buildMediaUrl(doc)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:underline"
                            >
                              <FileText size={10} />
                              {filenameFromPath(doc)}
                              <ExternalLink size={9} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionWrap>
          )}

          {/* ── Ringkasan Progress ── */}
          <SectionWrap title="Ringkasan Progress" icon={<BarChart2 size={13} />}>
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-500">Progress Kunjungan</span>
                <span className="text-xs font-bold" style={{ color: progressColor }}>
                  {progressPct}%
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, backgroundColor: progressColor }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                {hariDiisi} dari {totalHari} hari terlaporkan lengkap
              </p>
            </div>

            {/* Stat boxes */}
            <div className="grid grid-cols-4 gap-3">
              <StatBox icon={<CheckCircle2 size={16} />} label="Hadir"       value={hadirCount}                              color="#16a34a" bg="#f0fdf4" />
              <StatBox icon={<XCircle      size={16} />} label="Tidak Hadir" value={tidakHadirCount}                         color="#dc2626" bg="#fef2f2" />
              <StatBox icon={<Clock        size={16} />} label="Draft"       value={draftCount}                              color="#d97706" bg="#fffbeb" />
              <StatBox icon={<AlertCircle  size={16} />} label="Sisa Target" value={Math.max(0, totalHari - hariDiisi)} color="#1e40af" bg="#eff6ff" />
            </div>
          </SectionWrap>

          {/* ── Laporan Kunjungan ── */}
          <SectionWrap title="Laporan Kunjungan" icon={<FileText size={13} />}>
            {grouped.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                <FileText size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Belum ada laporan kunjungan</p>
              </div>
            ) : (
              <div className="space-y-2">
                {grouped.map(([date, dayVisits]) => (
                  <DayVisitCard
                    key={date}
                    date={date}
                    visits={dayVisits}
                    locCount={locCount}
                  />
                ))}
              </div>
            )}
          </SectionWrap>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function SectionWrap({ title, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[#0a2540]">{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
      </div>
      {children}
    </div>
  );
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────
function InfoRow({ Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={13} className="text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
        <div className="text-sm text-gray-700">{value}</div>
      </div>
    </div>
  );
}

// ─── StatBox ─────────────────────────────────────────────────────────────────
function StatBox({ icon, label, value, color, bg }) {
  return (
    <div className="rounded-xl px-2 py-3 flex flex-col items-center gap-1 text-center" style={{ background: bg }}>
      <span style={{ color }}>{icon}</span>
      <span className="text-xl font-bold leading-none" style={{ color }}>{value}</span>
      <span className="text-[10px] text-gray-500 leading-tight">{label}</span>
    </div>
  );
}

// ─── DayVisitCard (accordion) ─────────────────────────────────────────────────
function DayVisitCard({ date, visits, locCount }) {
  const [open, setOpen] = useState(false);

  const finalVisits    = visits.filter(v => !v.isDraft);
  const hadirCount     = finalVisits.filter(v => v.status === 'hadir').length;
  const anyTidakHadir  = finalVisits.some(v => v.status !== 'hadir');
  const anyDraft       = visits.some(v => v.isDraft);
  const allDone        = finalVisits.length >= locCount;

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  const headerColor = allDone ? (anyTidakHadir ? '#dc2626' : '#16a34a') : '#d97706';
  const borderColor = allDone ? (anyTidakHadir ? '#fecaca' : '#bbf7d0') : '#fed7aa';
  const bgColor     = allDone ? (anyTidakHadir ? '#fff5f5' : '#f0fdf4') : '#fffbeb';

  let statusLabel = '';
  if (locCount > 1) {
    statusLabel = `${finalVisits.length}/${locCount} lokasi`;
    if (hadirCount > 0) statusLabel += ` · ${hadirCount} hadir`;
    if (anyDraft) statusLabel += ' (ada draft)';
  } else {
    statusLabel = finalVisits.length > 0
      ? (hadirCount > 0 ? 'Hadir' : 'Tidak Hadir')
      : (anyDraft ? 'Draft' : 'Belum Ada Laporan');
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor, background: bgColor }}>
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        onClick={() => setOpen(p => !p)}
      >
        <span style={{ color: headerColor }}>
          {allDone
            ? (anyTidakHadir ? <XCircle size={16} /> : <CheckCircle2 size={16} />)
            : <Clock size={16} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-700 truncate">{dateLabel}</p>
          <p className="text-xs" style={{ color: headerColor }}>{statusLabel}</p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ color: headerColor, background: `${headerColor}20` }}
        >
          {allDone ? (anyTidakHadir ? 'Tidak Hadir' : 'Hadir') : (anyDraft ? 'Draft' : 'Pending')}
        </span>
        {open
          ? <ChevronUp size={14} className="text-gray-400 shrink-0" />
          : <ChevronDown size={14} className="text-gray-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor }}>
          {visits.map((visit, idx) => (
            <VisitDetailRow
              key={visit.id || idx}
              visit={visit}
              index={idx}
              isMultiLoc={locCount > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single visit detail row ──────────────────────────────────────────────────
function VisitDetailRow({ visit, index, isMultiLoc }) {
  const isHadir  = visit.status === 'hadir';
  const accent   = visit.isDraft ? '#d97706' : isHadir ? '#16a34a' : '#dc2626';
  const photos   = Array.isArray(visit.photos)    ? visit.photos    : [];
  const docs     = Array.isArray(visit.documents) ? visit.documents : [];

  return (
    <div
      className="rounded-xl p-3 space-y-2 text-xs"
      style={{
        background: visit.isDraft ? '#fffbeb' : isHadir ? '#f0fdf4' : '#fff5f5',
        border: `1px solid ${accent}30`,
      }}
    >
      {/* Location label */}
      {isMultiLoc && (
        <p className="font-bold text-[11px] text-gray-500">
          Lokasi {index + 1}{visit.locationId ? ` (${visit.locationId})` : ''}
        </p>
      )}

      {/* Status badge + submitter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[11px]"
          style={{ color: accent, background: `${accent}18` }}
        >
          {visit.isDraft ? '● DRAFT' : isHadir ? '✓ Hadir' : '✗ Tidak Hadir'}
        </span>
        {visit.submitterName && (
          <span className="text-gray-400 text-[11px]">oleh {visit.submitterName}</span>
        )}
        {visit.submittedAt && (
          <span className="text-gray-300 text-[10px] ml-auto">
            {new Date(visit.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Keterangan / alasan */}
      {visit.keterangan && (
        <p className="text-gray-600 text-[12px] leading-snug">{visit.keterangan}</p>
      )}
      {visit.alasanTidakHadir && (
        <p className="text-red-600 text-[12px] leading-snug">Alasan: {visit.alasanTidakHadir}</p>
      )}

      {/* GPS info */}
      {visit.jarakDariPusat != null && (
        <p className="flex items-center gap-1 text-gray-400 text-[11px]">
          <MapPin size={10} /> {Math.round(visit.jarakDariPusat)} m dari pusat
        </p>
      )}

      {/* ── Foto ── */}
      {photos.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
            Foto ({photos.length})
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {photos.map((p, i) => {
              const url = buildMediaUrl(p);
              const isVideo = url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.mov');
              return (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors group relative"
                  title="Klik untuk buka"
                >
                  {isVideo ? (
                    <div className="w-full h-16 bg-gray-200 flex items-center justify-center">
                      <span className="text-2xl">▶</span>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={url}
                      alt={`foto-${i + 1}`}
                      className="w-full h-16 object-cover group-hover:opacity-90 transition-opacity"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextSibling.style.display = 'flex';
                      }}
                    />
                  )}
                  <div
                    className="w-full h-16 bg-gray-100 items-center justify-center"
                    style={{ display: 'none' }}
                  >
                    <ImageIcon size={16} className="text-gray-400" />
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <ExternalLink size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Dokumen ── */}
      {docs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
            Dokumen ({docs.length})
          </p>
          <div className="space-y-1">
            {docs.map((doc, i) => {
              const url  = buildMediaUrl(doc);
              const name = filenameFromPath(doc);
              return (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <FileText size={13} className="text-blue-500 shrink-0" />
                  <span className="text-[11px] text-gray-700 truncate flex-1">{name}</span>
                  <Download size={10} className="text-gray-400 group-hover:text-blue-500 shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
