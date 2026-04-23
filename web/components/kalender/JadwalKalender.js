'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Color config per jenis event
const EVENT_STYLES = {
  // Inspeksi types
  rutin:     { chip: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500',    label: 'Rutin'     },
  k3:        { chip: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'K3'        },
  // Supervisi
  supervisi: { chip: 'bg-purple-100 text-purple-700', dot: 'bg-purple-600', label: 'Supervisi' },
};

function getEventStyle(event) {
  if (event.source === 'supervisi') return EVENT_STYLES.supervisi;
  return EVENT_STYLES[event.type] || { chip: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', label: event.type || '?' };
}

function toDateOnly(str) {
  if (!str) return null;
  return str.slice(0, 10);
}

function eventCoversDate(ev, dateStr) {
  const start = toDateOnly(ev.scheduledDate);
  const end   = toDateOnly(ev.scheduledEndDate) || start;
  if (!start) return false;
  return dateStr >= start && dateStr <= end;
}

const ACTIVE_STATUSES_INSPEKSI  = new Set(['scheduled', 'in_progress']);
const ACTIVE_STATUSES_SUPERVISI = new Set(['active']);

/**
 * JadwalKalender — kalender terpadu untuk Inspeksi + Supervisi.
 *
 * Props:
 *   inspeksiSchedules : array  — dari fetchInspeksiSchedules()
 *   supervisiJobs     : array  — dari fetchSupervisiJobs()
 *   filter            : 'all' | 'inspeksi' | 'supervisi'
 *   onViewDetail      : (event) => void
 */
export function JadwalKalender({ inspeksiSchedules = [], supervisiJobs = [], filter = 'all', onViewDetail }) {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [popup, setPopup] = useState(null);
  const popupRef = useRef(null);

  // ── Gabungkan & format events ─────────────────────────────────────────────
  const inspeksiEvents = inspeksiSchedules
    .filter((s) => ACTIVE_STATUSES_INSPEKSI.has(s.status))
    .map((s) => ({
      ...s,
      id:     s.id,
      source: 'inspeksi',
      // field sudah ada: title, type, status, scheduledDate, scheduledEndDate, assignedTo, location
    }));

  const supervisiEvents = supervisiJobs
    .filter((j) => ACTIVE_STATUSES_SUPERVISI.has(j.status))
    .map((j) => ({
      id:               `sv_${j.id}`,
      title:            j.namaKerja || j.nomorJo || '(tanpa nama)',
      type:             'supervisi',
      source:           'supervisi',
      status:           j.status,
      scheduledDate:    j.waktuMulai,
      scheduledEndDate: j.waktuBerakhir,
      assignedTo:       j.picSupervisi,
      location:         j.namaArea,
      nomorJo:          j.nomorJo,
      _raw:             j,
    }));

  const allEvents = [
    ...(filter !== 'supervisi' ? inspeksiEvents  : []),
    ...(filter !== 'inspeksi'  ? supervisiEvents : []),
  ];

  // ── Calendar grid helpers ──────────────────────────────────────────────────
  function buildCalendarDays() {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }

  function toStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function getEventsForDay(d) {
    if (!d) return [];
    const dateStr = toStr(d);
    return allEvents.filter((ev) => eventCoversDate(ev, dateStr));
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1);
    setPopup(null);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1);
    setPopup(null);
  }
  function goToday() {
    const n = new Date();
    setYear(n.getFullYear()); setMonth(n.getMonth()); setPopup(null);
  }

  const days = buildCalendarDays();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  function handleDayClick(d, e) {
    const events = getEventsForDay(d);
    if (events.length === 0) { setPopup(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ dateStr: toStr(d), events, rect });
  }

  return (
    <div className="relative">
      {/* ── Header navigasi bulan ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <h3 className="text-base font-bold text-gray-800 w-44 text-center">
            {MONTH_NAMES[month]} {year}
          </h3>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Legenda */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-500">
            {filter !== 'supervisi' && (
              <>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Rutin</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />K3</span>
              </>
            )}
            {filter !== 'inspeksi' && (
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-600" />Supervisi</span>
            )}
          </div>
          <button
            onClick={goToday}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium transition-colors"
          >
            Hari ini
          </button>
        </div>
      </div>

      {/* ── Label hari ── */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* ── Grid kalender ── */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden">
        {days.map((d, i) => {
          const events    = getEventsForDay(d);
          const dateStr   = d ? toStr(d) : null;
          const isToday   = dateStr === todayStr;

          return (
            <div
              key={i}
              className={`
                bg-white min-h-[88px] p-2 flex flex-col gap-1 transition-colors
                ${d ? 'cursor-pointer hover:bg-purple-50/30' : 'cursor-default'}
                ${isToday ? 'bg-blue-50' : ''}
              `}
              onClick={d ? (e) => handleDayClick(d, e) : undefined}
            >
              {d && (
                <>
                  <span className={`
                    text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full self-end
                    ${isToday ? 'bg-[#0a2540] text-white' : 'text-gray-700'}
                  `}>
                    {d}
                  </span>

                  {events.slice(0, 3).map((ev) => {
                    const style = getEventStyle(ev);
                    return (
                      <div
                        key={ev.id}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate ${style.chip}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    );
                  })}
                  {events.length > 3 && (
                    <span className="text-[10px] text-gray-400 font-semibold pl-1">
                      +{events.length - 3} lainnya
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pop-up card event ── */}
      {popup && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setPopup(null)} />
          <div
            ref={popupRef}
            className="fixed z-40 bg-white border border-gray-200 rounded-2xl shadow-2xl w-80 overflow-hidden"
            style={{
              top:  Math.min(popup.rect.bottom + 8, window.innerHeight - 360),
              left: Math.min(popup.rect.left,       window.innerWidth  - 340),
            }}
          >
            {/* Header popup */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jadwal Aktif</p>
                <p className="text-sm font-bold text-gray-800">
                  {new Date(popup.dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={() => setPopup(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Daftar event */}
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {popup.events.map((ev) => {
                const style = getEventStyle(ev);
                return (
                  <div key={ev.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${style.chip.split(' ')[1]}`}>
                        {style.label}
                      </span>
                      {/* Badge source */}
                      <span className={`ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        ev.source === 'supervisi'
                          ? 'bg-purple-50 text-purple-600'
                          : 'bg-blue-50 text-blue-600'
                      }`}>
                        {ev.source === 'supervisi' ? 'Supervisi' : 'Inspeksi'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{ev.title}</p>
                    {ev.assignedTo && (
                      <p className="text-xs text-gray-400 mt-0.5">👤 {ev.assignedTo}</p>
                    )}
                    {ev.location && (
                      <p className="text-xs text-gray-400">📍 {ev.location}</p>
                    )}
                    <button
                      onClick={() => { setPopup(null); onViewDetail && onViewDetail(ev); }}
                      className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Eye size={11} /> Lihat Detail
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
