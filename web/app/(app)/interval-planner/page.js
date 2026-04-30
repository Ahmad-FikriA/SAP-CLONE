'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { canCreate, canUpdate, canDelete } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const INTERVALS = ['1wk', '2wk', '3wk', '4wk', '8wk', '12wk', '16wk', '24wk'];

function getISOWeekDateRange(week, year) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Mon);
  start.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

function fmtShort(d) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function getWeeksInYear(year) {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const day = dec28.getUTCDay() || 7;
  const thu = new Date(dec28);
  thu.setUTCDate(dec28.getUTCDate() + (4 - day));
  return thu.getUTCFullYear() === year ? 53 : 52;
}

function getMonthLabel(d) {
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function getCurrentWeek() {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const diff = Math.floor((now - jan4) / 86400000) + (jan4Day - 1);
  return Math.min(53, Math.max(1, Math.ceil((diff + 1) / 7)));
}

function cellKey(year, week, interval) {
  return `${year}-${week}-${interval}`;
}

function buildYears() {
  const now = new Date().getFullYear();
  return Array.from({ length: 13 }, (_, i) => now - 2 + i);
}

export default function IntervalPlannerPage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [savedSet, setSavedSet] = useState({});
  const [currentSet, setCurrentSet] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingYearChange = useRef(null);
  const years = buildYears();

  const isDirty = useCallback(() => {
    const sk = Object.keys(savedSet).sort().join(',');
    const ck = Object.keys(currentSet).sort().join(',');
    return sk !== ck;
  }, [savedSet, currentSet]);

  const countDiff = useCallback(() => {
    const toAdd = Object.keys(currentSet).filter((k) => !savedSet[k]);
    const toRemove = Object.keys(savedSet).filter((k) => !currentSet[k]);
    return { toAdd, toRemove };
  }, [savedSet, currentSet]);

  async function loadYear(y) {
    setLoading(true);
    try {
      const data = await apiGet(`/preventive-schedule/year?year=${y}`);
      const set = {};
      for (const row of data.schedule || []) {
        for (const iv of row.intervals || []) {
          set[cellKey(y, row.week, iv)] = true;
        }
      }
      setSavedSet(set);
      setCurrentSet({ ...set });
    } catch (e) {
      toast.error('Gagal memuat: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadYear(year);
    const handler = (e) => {
      if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCell(y, week, interval) {
    const key = cellKey(y, week, interval);
    setCurrentSet((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = true;
      return next;
    });
  }

  function tryChangeYear(newYear) {
    if (isDirty()) {
      if (!window.confirm('Ada perubahan yang belum disimpan. Ganti tahun akan membuang perubahan tersebut. Lanjutkan?')) return;
    }
    setYear(newYear);
  }

  async function saveChanges() {
    if (!isDirty()) return;
    setSaving(true);
    const { toAdd, toRemove } = countDiff();
    const allChanges = [
      ...toAdd.map((k) => ({ key: k, active: true })),
      ...toRemove.map((k) => ({ key: k, active: false })),
    ];
    let failed = 0;
    const newSaved = { ...savedSet };
    for (const change of allChanges) {
      const parts = change.key.split('-');
      const y = parseInt(parts[0], 10);
      const w = parseInt(parts[1], 10);
      const iv = parts.slice(2).join('-');
      try {
        await apiPost('/preventive-schedule/toggle', { year: y, week: w, interval: iv });
        if (change.active) newSaved[change.key] = true;
        else delete newSaved[change.key];
      } catch { failed++; }
    }
    setSavedSet(newSaved);
    setSaving(false);
    if (failed > 0) toast.error(`${failed} perubahan gagal disimpan.`);
    else toast.success('Jadwal berhasil disimpan');
  }

  function discardChanges() {
    if (!isDirty()) return;
    if (!window.confirm('Buang semua perubahan yang belum disimpan?')) return;
    setCurrentSet({ ...savedSet });
  }

  async function autoFill() {
    if (isDirty()) {
      if (!window.confirm('Ada perubahan yang belum disimpan. Auto-fill akan menimpa tampilan saat ini. Lanjutkan?')) return;
    } else {
      if (!window.confirm(`Auto-fill jadwal ${year} menggunakan formula (week-1) % N = 0?\nIni menimpa jadwal yang ada di database.`)) return;
    }
    try {
      await apiPost('/preventive-schedule/generate', { year, overwrite: true });
      await loadYear(year);
      toast.success(`Jadwal ${year} berhasil di-generate dari formula`);
    } catch (e) { toast.error('Gagal generate: ' + e.message); }
  }

  async function clearAll() {
    if (!window.confirm(`Hapus SEMUA jadwal tahun ${year}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await apiDelete(`/preventive-schedule?year=${year}`);
      setSavedSet({});
      setCurrentSet({});
      toast.success(`Jadwal ${year} berhasil dihapus`);
    } catch (e) { toast.error('Gagal menghapus: ' + e.message); }
  }

  // Build grid rows
  const totalWeeks = getWeeksInYear(year);
  const currentWeek = year === thisYear ? getCurrentWeek() : -1;

  const rows = [];
  let lastMonth = null;
  for (let w = 1; w <= totalWeeks; w++) {
    const { start, end } = getISOWeekDateRange(w, year);
    const monthLabel = getMonthLabel(start);
    if (monthLabel !== lastMonth) {
      lastMonth = monthLabel;
      rows.push({ type: 'month', label: monthLabel, key: 'month-' + monthLabel });
    }
    rows.push({ type: 'week', week: w, start, end, key: 'week-' + w });
  }

  // Stats
  const counts = {};
  INTERVALS.forEach((iv) => { counts[iv] = 0; });
  Object.keys(currentSet).forEach((key) => {
    if (!key.startsWith(`${year}-`)) return;
    const rest = key.slice((`${year}-`).length);
    const iv = rest.slice(rest.indexOf('-') + 1);
    if (counts[iv] !== undefined) counts[iv]++;
  });

  const dirty = isDirty();
  const { toAdd, toRemove } = dirty ? countDiff() : { toAdd: [], toRemove: [] };
  const diffLabel = [toAdd.length > 0 && `+${toAdd.length} diaktifkan`, toRemove.length > 0 && `-${toRemove.length} dinonaktifkan`].filter(Boolean).join(', ');

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Interval Planner</h2>
          <p className="text-sm text-gray-500">Jadwal preventive maintenance per tahun</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={year} onChange={(e) => tryChangeYear(parseInt(e.target.value))}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {canCreate('interval-planner') && (
            <Button variant="outline" size="sm" onClick={autoFill}>Auto-fill formula</Button>
          )}
          {canDelete('interval-planner') && (
            <Button variant="outline" size="sm" onClick={clearAll} className="text-red-600 border-red-200 hover:bg-red-50">Hapus semua</Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        {INTERVALS.map((iv) => (
          <span key={iv} className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
            <strong>{iv}</strong> {counts[iv]} minggu
          </span>
        ))}
      </div>

      {/* Unsaved bar */}
      {dirty && canUpdate('interval-planner') && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <span className="text-amber-700 font-medium flex-1">Perubahan belum disimpan: {diffLabel}</span>
          <Button size="sm" variant="ghost" onClick={discardChanges} className="text-gray-500">Buang</Button>
          <Button size="sm" onClick={saveChanges} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Memuat jadwal...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border-b border-gray-200 w-16">Minggu</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border-b border-gray-200 w-36">Tanggal</th>
                {INTERVALS.map((iv) => (
                  <th key={iv} className="px-2 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 w-14">{iv}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                if (row.type === 'month') {
                  return (
                    <tr key={row.key} className="bg-blue-50">
                      <td colSpan={2 + INTERVALS.length} className="px-3 py-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                const { week, start, end } = row;
                const isCurrent = week === currentWeek;
                return (
                  <tr key={row.key} className={cn('border-b border-gray-100', isCurrent && 'bg-yellow-50')}>
                    <td className={cn('px-3 py-1.5 font-semibold', isCurrent ? 'text-yellow-700' : 'text-gray-700')}>{week}</td>
                    <td className="px-3 py-1.5 text-gray-500">{fmtShort(start)} – {fmtShort(end)}</td>
                    {INTERVALS.map((iv) => {
                      const key = cellKey(year, week, iv);
                      const active = !!currentSet[key];
                      const changed = !!currentSet[key] !== !!savedSet[key];
                      return (
                        <td key={iv} className="px-1 py-1.5 text-center">
                          <button
                            onClick={() => canUpdate('interval-planner') && toggleCell(year, week, iv)}
                            className={cn(
                              'w-8 h-6 rounded text-[10px] font-semibold transition-colors',
                              active
                                ? changed ? 'bg-blue-500 text-white ring-2 ring-blue-300' : 'bg-blue-600 text-white'
                                : changed ? 'bg-red-100 text-red-400 ring-2 ring-red-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            )}
                          >
                            {active ? '✓' : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
