'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, Loader2, Repeat } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getUser } from '@/lib/auth';
import {
  createInspeksiSchedule,
  createRecurringInspeksiSchedules,
  fetchNextInspeksiSpkNumber,
} from '@/lib/inspeksi-service';

const PERIODE_OPTIONS = ['1 Bulan', '2 Bulan', '3 Bulan', '6 Bulan', '1 Tahun'];

const PERIODE_TO_RECURRING_TYPE = {
  '1 Bulan': 'monthly',
  '2 Bulan': 'bimonthly',
  '3 Bulan': 'quarterly',
  '6 Bulan': 'semester',
  '1 Tahun': 'yearly',
};

function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateValue, days) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return toDateInputValue(d);
}

function initialForm() {
  const start = toDateInputValue(new Date());
  return {
    nomorPoJo: '',
    location: '',
    title: '',
    isRecurringEnabled: false,
    selectedPeriode: PERIODE_OPTIONS[2],
    scheduledDate: start,
    scheduledEndDate: addDays(start, 365),
  };
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{children}</p>;
}

function FormLabel({ children }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {children}
    </label>
  );
}

function TextField({ value, onChange, placeholder, readOnly = false, disabled = false }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 read-only:text-slate-500"
    />
  );
}

function DateField({ label, value, min, max, onChange }) {
  return (
    <div className="space-y-2">
      <FormLabel>{label}</FormLabel>
      <div className="relative">
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
        <CalendarDays
          size={17}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0a2540]"
        />
      </div>
    </div>
  );
}

export function InspeksiScheduleFormDialog({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loadingSpk, setLoadingSpk] = useState(false);
  const [saving, setSaving] = useState(false);

  const minStartDate = useMemo(() => addDays(toDateInputValue(new Date()), -365), []);

  useEffect(() => {
    if (!open) return;

    const nextForm = initialForm();
    setForm(nextForm);
    setErrors({});
    setLoadingSpk(true);

    fetchNextInspeksiSpkNumber()
      .then((nextSpk) => {
        setForm((current) => ({
          ...current,
          nomorPoJo: nextSpk || '',
        }));
      })
      .catch((error) => {
        toast.error('Gagal mengambil nomor SPK: ' + error.message);
      })
      .finally(() => setLoadingSpk(false));
  }, [open]);

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
  }

  function handleStartDateChange(value) {
    if (!value) return;
    setForm((current) => ({
      ...current,
      scheduledDate: value,
      scheduledEndDate:
        current.scheduledEndDate && current.scheduledEndDate >= value
          ? current.scheduledEndDate
          : value,
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.scheduledDate;
      delete next.scheduledEndDate;
      return next;
    });
  }

  function validate() {
    const nextErrors = {};
    if (!form.nomorPoJo.trim()) nextErrors.nomorPoJo = 'No. SPK wajib diisi.';
    if (!form.title.trim()) nextErrors.title = 'Objek inspeksi wajib diisi.';
    if (!form.scheduledDate) nextErrors.scheduledDate = 'Tanggal mulai wajib diisi.';
    if (!form.scheduledEndDate) nextErrors.scheduledEndDate = 'Tanggal berakhir wajib diisi.';
    if (form.scheduledDate && form.scheduledEndDate && form.scheduledEndDate < form.scheduledDate) {
      nextErrors.scheduledEndDate = 'Tanggal berakhir tidak boleh lebih awal.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    const user = getUser();
    const baseSchedule = {
      type: 'rutin',
      title: form.title.trim(),
      location: form.location.trim() || null,
      scheduledDate: form.scheduledDate,
      createdBy: user?.name || user?.nik || '',
      triggerSource: 'planner',
      nomorPoJo: form.nomorPoJo.trim(),
    };

    setSaving(true);
    try {
      let created;
      if (form.isRecurringEnabled) {
        created = await createRecurringInspeksiSchedules({
          baseSchedule: {
            ...baseSchedule,
            kategoriTeknisi: 'Umum',
          },
          recurringType: PERIODE_TO_RECURRING_TYPE[form.selectedPeriode] || 'monthly',
          startDate: form.scheduledDate,
          endDate: form.scheduledEndDate,
        });
        toast.success(`${created.length} jadwal inspeksi berulang berhasil dibuat.`);
      } else {
        created = await createInspeksiSchedule({
          ...baseSchedule,
          scheduledEndDate: form.scheduledEndDate,
          intervalPeriod: form.selectedPeriode,
        });
        toast.success('Jadwal inspeksi berhasil dibuat.');
      }

      onSaved?.(created);
      onOpenChange?.(false);
    } catch (error) {
      toast.error('Gagal menyimpan jadwal: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange?.(nextOpen)}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto p-0" showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-[#0a2540]"
                onClick={() => onOpenChange?.(false)}
                disabled={saving}
              >
                <ArrowLeft size={18} />
              </Button>
              <DialogTitle className="text-lg font-bold text-[#0a2540]">
                Buat Jadwal Pekerjaan
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-5 py-5">
            <div className="space-y-2">
              <FormLabel>No. SPK</FormLabel>
              <div className="relative">
                <TextField
                  value={loadingSpk ? 'Mengambil nomor SPK...' : form.nomorPoJo}
                  placeholder="Contoh: SPK-2026-001"
                  readOnly
                  disabled={loadingSpk}
                />
                {loadingSpk && (
                  <Loader2
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                  />
                )}
              </div>
              <FieldError>{errors.nomorPoJo}</FieldError>
            </div>

            <div className="space-y-2">
              <FormLabel>Lokasi</FormLabel>
              <TextField
                value={form.location}
                onChange={(value) => updateForm({ location: value })}
                placeholder="Contoh: WTP Bojong Renged"
              />
            </div>

            <div className="space-y-2">
              <FormLabel>Objek Inspeksi</FormLabel>
              <TextField
                value={form.title}
                onChange={(value) => updateForm({ title: value })}
                placeholder="Contoh: Inspeksi panel pompa utama"
              />
              <FieldError>{errors.title}</FieldError>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={form.isRecurringEnabled}
              onClick={() => updateForm({ isRecurringEnabled: !form.isRecurringEnabled })}
              className={`w-full rounded-xl border p-4 text-left transition ${
                form.isRecurringEnabled
                  ? 'border-[#0a2540]/30 bg-[#0a2540]/5'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    form.isRecurringEnabled
                      ? 'bg-[#0a2540]/10 text-[#0a2540]'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Repeat size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-slate-800">
                    Periode Inspeksi
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {form.isRecurringEnabled
                      ? 'Jadwal akan dibuat otomatis berulang'
                      : 'Jadwal sekali (non-berulang)'}
                  </span>
                </span>
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    form.isRecurringEnabled ? 'bg-[#0a2540]' : 'bg-slate-400'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                      form.isRecurringEnabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </span>
              </div>
            </button>

            {form.isRecurringEnabled && (
              <div className="space-y-2">
                <FormLabel>Periode Inspeksi</FormLabel>
                <select
                  value={form.selectedPeriode}
                  onChange={(event) => updateForm({ selectedPeriode: event.target.value })}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {PERIODE_OPTIONS.map((periode) => (
                    <option key={periode} value={periode}>
                      Setiap {periode}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DateField
              label="Tanggal Mulai"
              value={form.scheduledDate}
              min={minStartDate}
              max="2032-12-31"
              onChange={handleStartDateChange}
            />
            <FieldError>{errors.scheduledDate}</FieldError>

            <DateField
              label="Tanggal Berakhir"
              value={form.scheduledEndDate}
              min={form.scheduledDate}
              max="2032-12-31"
              onChange={(value) => updateForm({ scheduledEndDate: value })}
            />
            <FieldError>{errors.scheduledEndDate}</FieldError>
          </div>

          <DialogFooter className="mx-0 mb-0 px-5 py-4">
            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-[#0a2540] text-white hover:bg-[#0d3152] sm:w-full"
              disabled={saving || loadingSpk}
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Simpan Jadwal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
