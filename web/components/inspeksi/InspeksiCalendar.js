'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';
import { INSPEKSI_STATUS_META, INSPEKSI_TYPE_LABELS } from '@/lib/inspeksi-service';
import { Button } from '@/components/ui/button';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const TYPE_DOT = {
  rutin:     'bg-blue-500',
  k3:        'bg-orange-500',
  supervisi: 'bg-purple-500',
};

const ACTIVE_STATUSES = new Set(['scheduled', 'in_progress']);

/** Ubah tanggal DATEONLY (YYYY-MM-DD) ke string ISO tanpa offset zone */
function toDateOnly(str) {
  if (!str) return null;
  return str.slice(0, 10); // "2026-04-25"
}

/** Apakah tanggal kalender (YYYY-MM-DD string) ada di rentang scheduledDate → scheduledEndDate */
function scheduleCoversDate(s, dateStr) {
  const start = toDateOnly(s.scheduledDate);
  const end   = toDateOnly(s.scheduledEndDate) || start;
  if (!start) return false;
  return dateStr >= start && dateStr <= end;
}

export function InspeksiCalendar({ schedules = [], onViewDetail }) {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  // Popup state
  const [popup, setPopup] = useState(null); // { dateStr, events, anchor }
  const popupRef = useRef(null);

  // Hanya jadwal AKTIF yang ditampilkan di kalender
  const activeSchedules = schedules.filter((s) => ACTIVE_STATUSES.has(s.status));

  // Buat grid hari dalam bulan
  function buildCalendarDays() {
    const firstDay  = new Date(year, month, 1).getDay(); // 0=Sun
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
    return activeSchedules.filter((s) => scheduleCoversDate(s, dateStr));
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setPopup(null);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
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
          <h3 className="text-base font-bold text-gray-800 w-40 text-center">
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
            {Object.entries(INSPEKSI_TYPE_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${TYPE_DOT[key] || 'bg-gray-400'}`} />
                {label}
              </span>
            ))}
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
          const hasEvents = events.length > 0;

          return (
            <div
              key={i}
              className={`
                bg-white min-h-[88px] p-2 flex flex-col gap-1 transition-colors
                ${d ? 'cursor-pointer hover:bg-blue-50/50' : 'cursor-default'}
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

                  {/* Event chips — maks 3 tampil, sisanya "+N" */}
                  {events.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className={`
                        flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate
                        ${ev.type === 'rutin' ? 'bg-blue-100 text-blue-700' : ''}
                        ${ev.type === 'k3' ? 'bg-orange-100 text-orange-700' : ''}
                        ${ev.type === 'supervisi' ? 'bg-purple-100 text-purple-700' : ''}
                        ${!['rutin','k3','supervisi'].includes(ev.type) ? 'bg-gray-100 text-gray-600' : ''}
                      `}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[ev.type] || 'bg-gray-400'}`} />
                      <span className="truncate">{ev.title}</span>
                    </div>
                  ))}
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
          {/* Overlay transparan untuk close saat klik di luar */}
          <div className="fixed inset-0 z-30" onClick={() => setPopup(null)} />

          <div
            ref={popupRef}
            className="fixed z-40 bg-white border border-gray-200 rounded-2xl shadow-2xl w-80 overflow-hidden"
            style={{
              // Posisikan popup: kalau lebih dari 60% dari kanan layar, flip ke kiri
              top: Math.min(popup.rect.bottom + 8, window.innerHeight - 340),
              left: Math.min(popup.rect.left, window.innerWidth - 340),
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
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
              {popup.events.map((ev) => (
                <div key={ev.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[ev.type] || 'bg-gray-400'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wide
                      ${ev.type === 'rutin' ? 'text-blue-600' : ''}
                      ${ev.type === 'k3' ? 'text-orange-600' : ''}
                      ${ev.type === 'supervisi' ? 'text-purple-600' : ''}
                    `}>
                      {INSPEKSI_TYPE_LABELS[ev.type] || ev.type}
                    </span>
                    <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full
                      ${ev.status === 'scheduled'   ? 'bg-amber-50 text-amber-700'  : ''}
                      ${ev.status === 'in_progress' ? 'bg-blue-50 text-blue-700'    : ''}
                    `}>
                      {INSPEKSI_STATUS_META[ev.status]?.label || ev.status}
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
                    onClick={() => { setPopup(null); onViewDetail(ev); }}
                    className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Eye size={11} /> Lihat Detail
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
