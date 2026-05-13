'use client';

import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  MapPin,
  UserRound,
  X,
} from 'lucide-react';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const EVENT_STYLES = {
  inspeksi: {
    chip: 'bg-blue-50 text-blue-700 border-blue-100',
    dot: 'bg-blue-500',
    label: 'Inspeksi',
  },
  supervisi: {
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    dot: 'bg-emerald-500',
    label: 'Supervisi',
  },
};

const ACTIVE_STATUSES_INSPEKSI = new Set(['scheduled', 'in_progress']);
const ACTIVE_STATUSES_SUPERVISI = new Set(['active']);

function getEventStyle(event) {
  return event.source === 'supervisi' ? EVENT_STYLES.supervisi : EVENT_STYLES.inspeksi;
}

function toDateOnly(str) {
  if (!str) return null;
  return String(str).slice(0, 10);
}

function eventCoversDate(ev, dateStr) {
  const start = toDateOnly(ev.scheduledDate);
  const end = toDateOnly(ev.scheduledEndDate) || start;
  if (!start) return false;
  return dateStr >= start && dateStr <= end;
}

function formatPopupDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getSupervisiLocation(job) {
  if (Array.isArray(job?.locations) && job.locations.length > 0) {
    return job.locations[0]?.namaArea || job.namaArea || null;
  }
  return job?.namaArea || null;
}

export function JadwalKalender({
  inspeksiSchedules = [],
  supervisiJobs = [],
  filter = 'all',
  onViewDetail,
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [popup, setPopup] = useState(null);

  const inspeksiEvents = inspeksiSchedules
    .filter((s) => ACTIVE_STATUSES_INSPEKSI.has(s.status))
    .map((s) => ({
      ...s,
      id: s.id,
      source: 'inspeksi',
      type: 'inspeksi',
    }));

  const supervisiEvents = supervisiJobs
    .filter((j) => ACTIVE_STATUSES_SUPERVISI.has(j.status))
    .map((j) => ({
      id: `sv_${j.id}`,
      title: j.namaKerja || j.nomorJo || '(tanpa nama)',
      type: 'supervisi',
      source: 'supervisi',
      status: j.status,
      scheduledDate: j.waktuMulai,
      scheduledEndDate: j.waktuBerakhir,
      assignedTo: j.picSupervisi,
      location: getSupervisiLocation(j),
      nomorJo: j.nomorJo,
      _raw: j,
    }));

  const allEvents = [
    ...(filter !== 'supervisi' ? inspeksiEvents : []),
    ...(filter !== 'inspeksi' ? supervisiEvents : []),
  ];

  function buildCalendarDays() {
    const firstDay = new Date(year, month, 1).getDay();
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
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
    setPopup(null);
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
    setPopup(null);
  }

  function goToday() {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setPopup(null);
  }

  function handleDayClick(day, event) {
    const events = getEventsForDay(day);
    if (events.length === 0) {
      setPopup(null);
      return;
    }
    setPopup({
      dateStr: toStr(day),
      events,
      rect: event.currentTarget.getBoundingClientRect(),
    });
  }

  const days = buildCalendarDays();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft size={17} />
          </button>
          <h3 className="text-base font-bold text-slate-900 w-48 text-center">
            {MONTH_NAMES[month]} {year}
          </h3>
          <button
            onClick={nextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <button
          onClick={goToday}
          className="inline-flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold transition-colors"
        >
          <CalendarDays size={14} />
          Hari ini
        </button>
      </div>

      <div className="grid grid-cols-7 bg-slate-100 border border-slate-200 border-b-0 rounded-t-lg overflow-hidden">
        {DAY_LABELS.map((day) => (
          <div key={day} className="py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-b-lg overflow-hidden">
        {days.map((day, index) => {
          const events = getEventsForDay(day);
          const dateStr = day ? toStr(day) : null;
          const isToday = dateStr === todayStr;

          return (
            <div
              key={index}
              className={`
                bg-white min-h-[72px] sm:min-h-[100px] md:min-h-[112px] p-1 sm:p-2 flex flex-col gap-1 transition-colors
                ${day ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default bg-slate-50/60'}
                ${isToday ? 'ring-2 ring-inset ring-blue-500/70' : ''}
              `}
              onClick={day ? (e) => handleDayClick(day, e) : undefined}
            >
              {day && (
                <>
                  <span className={`
                    text-xs font-bold w-7 h-7 flex items-center justify-center rounded-lg self-end
                    ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700 bg-slate-50'}
                  `}>
                    {day}
                  </span>

                  <div className="space-y-1 mt-1">
                    {events.slice(0, 3).map((ev) => {
                      const style = getEventStyle(ev);
                      return (
                        <div
                          key={ev.id}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-semibold truncate ${style.chip}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    })}
                    {events.length > 3 && (
                      <span className="block text-[10px] text-slate-400 font-semibold pl-1">
                        +{events.length - 3} lainnya
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {popup && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setPopup(null)} />
          {/* Mobile: bottom sheet / Desktop: anchored popup */}
          <div
            className="fixed z-40 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden"
            style={typeof window !== 'undefined' && window.innerWidth < 640
              ? { bottom: 0, left: 0, right: 0, maxHeight: '70vh', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
              : {
                  top: Math.min(popup.rect.bottom + 8, window.innerHeight - 360),
                  left: Math.min(popup.rect.left, window.innerWidth - 340),
                  width: '320px',
                }
            }
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jadwal Aktif</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{formatPopupDate(popup.dateStr)}</p>
              </div>
              <button
                onClick={() => setPopup(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                aria-label="Tutup daftar jadwal"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {popup.events.map((ev) => {
                const style = getEventStyle(ev);
                return (
                  <div key={ev.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${style.chip}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{ev.title}</p>
                    {ev.assignedTo && (
                      <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                        <UserRound size={12} />
                        {ev.assignedTo}
                      </p>
                    )}
                    {ev.location && (
                      <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <MapPin size={12} />
                        {ev.location}
                      </p>
                    )}
                    <button
                      onClick={() => {
                        setPopup(null);
                        onViewDetail?.(ev);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Eye size={12} />
                      Lihat Detail
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
