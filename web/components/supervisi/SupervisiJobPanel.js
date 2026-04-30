'use client';

import { X, MapPin, User, Calendar, Briefcase, Hash, DollarSign, Eye } from 'lucide-react';
import { SUPERVISI_STATUS_META } from '@/lib/supervisi-service';

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtRupiah(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
}

/**
 * SupervisiJobPanel — slide-in side panel dari kanan yang menampilkan
 * detail lengkap satu SupervisiJob ketika marker di peta diklik.
 *
 * Props:
 *   job       : object | null  — job yang dipilih
 *   onClose   : () => void
 */
export function SupervisiJobPanel({ job, onClose }) {
  if (!job) return null;

  const meta    = SUPERVISI_STATUS_META[job.status] || SUPERVISI_STATUS_META.draft;
  const hasMaps = job.locations && Array.isArray(job.locations) && job.locations.length > 0;

  // Compute effectiveEndDate
  const effectiveEndDate = job.amends && job.amends.length > 0 
    ? job.amends[job.amends.length - 1].amendBerakhir 
    : job.waktuBerakhir;

  let sisaHari = null;
  if (effectiveEndDate) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const end = new Date(effectiveEndDate + 'T00:00:00');
    sisaHari = Math.round((end - today) / (1000 * 60 * 60 * 24));
  }

  return (
    <>
      {/* Backdrop transparan untuk close saat klik luar */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        style={{ zIndex: 500 }}
        onClick={onClose}
      />

      {/* Side panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right" style={{ zIndex: 600 }}>
        {/* Header */}
        <div className="bg-[#0a2540] text-white px-5 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
            <Eye size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">Detail Job Supervisi</p>
            <h2 className="text-sm font-bold leading-snug truncate">{job.namaKerja || '(tanpa nama)'}</h2>
            <p className="text-xs text-white/60 mt-0.5">{job.nomorJo}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status badge */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>

          {job.status === 'active' && sisaHari !== null && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              sisaHari < 0 ? 'bg-red-50 text-red-700 border border-red-200' :
              sisaHari === 0 ? 'bg-orange-50 text-orange-700 border border-orange-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {sisaHari < 0 ? `Terlambat ${Math.abs(sisaHari)} Hari` :
               sisaHari === 0 ? 'Hari Ini Terakhir' :
               `Sisa ${sisaHari} Hari`}
            </span>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Info utama */}
          <div className="px-5 py-4 space-y-4">

            {/* Nomor JO */}
            <Row Icon={Hash} label="Nomor JO">
              <span className="font-mono text-sm font-semibold text-gray-800">{job.nomorJo || '—'}</span>
            </Row>

            {/* Pelaksana (kontraktor) */}
            <Row Icon={Briefcase} label="Pelaksana">
              {job.pelaksana || '—'}
            </Row>

            {/* PIC Supervisi */}
            <Row Icon={User} label="PIC Supervisi">
              {job.picSupervisi || '—'}
            </Row>

            {/* Pengawas / Group */}
            <Row Icon={User} label="Pengawas">
              {job.namaPengawas || '—'}
            </Row>

            {/* Periode */}
            <Row Icon={Calendar} label="Periode">
              <span>
                {fmt(job.waktuMulai)}
                {' — '}
                {fmt(effectiveEndDate)}
              </span>
            </Row>

            {/* Nilai pekerjaan */}
            <Row Icon={DollarSign} label="Nilai Pekerjaan">
              {fmtRupiah(job.nilaiPekerjaan)}
            </Row>

            {/* Lokasi utama */}
            <Row Icon={MapPin} label="Lokasi Utama">
              {job.namaArea || '—'}
              {job.latitude && job.longitude ? (
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                  {parseFloat(job.latitude).toFixed(6)}, {parseFloat(job.longitude).toFixed(6)}
                </p>
              ) : null}
            </Row>
          </div>

          {/* Multi-lokasi */}
          {hasMaps && (
            <div className="px-5 pb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Titik Lokasi ({job.locations.length})
              </p>
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
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.22s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
      `}</style>
    </>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────
function Row({ Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
        <div className="text-sm text-gray-700">{children}</div>
      </div>
    </div>
  );
}
