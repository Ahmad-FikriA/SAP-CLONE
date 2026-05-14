'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Briefcase, CalendarDays, CalendarOff, Crosshair, Loader2, MapPin, Plus,
  Trash2, User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createSupervisiJob } from '@/lib/supervisi-service';

const GROUP_SUPERVISI_PERPIPAAN = 'Group supervisi Sipil dan Perpipaan';
const GROUP_SUPERVISI_MEKATRONIK = 'Group supervisi Mekanikal Elektrik dan Instrumen';
const GROUP_SUPERVISI_INSPEKSI = 'Group inspeksi';

const GROUP_OPTIONS = [
  GROUP_SUPERVISI_PERPIPAAN,
  GROUP_SUPERVISI_MEKATRONIK,
  GROUP_SUPERVISI_INSPEKSI,
];

const PIC_OPTIONS_BY_GROUP = {
  [GROUP_SUPERVISI_PERPIPAAN]: ['Deni Yuniardi', 'Yoyon Sutrisno'],
  [GROUP_SUPERVISI_MEKATRONIK]: ['Ibrohim', 'Agus Miftakh'],
  [GROUP_SUPERVISI_INSPEKSI]: ['Rangga Pramana Putra', 'Usep Supriatna'],
};

function createLocation() {
  const id = String(Date.now() + Math.floor(Math.random() * 1000));
  return {
    id,
    namaArea: '',
    latitude: '',
    longitude: '',
    radius: '100',
    capturedAt: null,
    isCapturing: false,
  };
}

function emptyForm() {
  return {
    namaKerja: '',
    nomorJo: '',
    nilaiPekerjaan: '',
    pelaksana: '',
    waktuMulai: '',
    waktuBerakhir: '',
    namaPengawas: '',
    picSupervisi: '',
    radiusExemptionEnabled: false,
    radiusExemptionStartDate: '',
    radiusExemptionEndDate: '',
    radiusExemptionReason: '',
    locations: [],
  };
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 19);
}

function formatRupiahInput(value) {
  const digits = digitsOnly(value);
  if (!digits) return '';
  return new Intl.NumberFormat('id-ID').format(Number(digits));
}

function toFiniteNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRadius(value) {
  const parsed = toFiniteNumber(value);
  if (parsed == null) return 100;
  return Math.min(Math.max(parsed, 1), 300);
}

function hasGps(location) {
  return (
    toFiniteNumber(location.latitude) != null &&
    toFiniteNumber(location.longitude) != null
  );
}

function toIsoCoordinate(value) {
  const parsed = toFiniteNumber(value);
  return parsed == null ? '' : String(Number(parsed.toFixed(7)));
}

function buildPayload(form, saveAsDraft) {
  const locations = form.locations
    .filter(hasGps)
    .map((location) => ({
      id: String(location.id),
      namaArea: location.namaArea.trim() || null,
      latitude: Number(toIsoCoordinate(location.latitude)),
      longitude: Number(toIsoCoordinate(location.longitude)),
      radius: normalizeRadius(location.radius),
    }));

  const firstLocation = locations[0] || null;
  const rawNilai = digitsOnly(form.nilaiPekerjaan);

  return {
    namaKerja: form.namaKerja.trim(),
    nomorJo: form.nomorJo.trim(),
    nilaiPekerjaan: rawNilai || null,
    pelaksana: form.pelaksana.trim() || null,
    waktuMulai: form.waktuMulai || null,
    waktuBerakhir: form.waktuBerakhir || null,
    namaPengawas: form.namaPengawas || null,
    picSupervisi: form.picSupervisi || null,
    status: saveAsDraft ? 'draft' : 'active',
    locations,
    latitude: firstLocation?.latitude ?? null,
    longitude: firstLocation?.longitude ?? null,
    radius: firstLocation?.radius ?? null,
    namaArea: firstLocation?.namaArea ?? null,
    radiusExemptionStartDate: form.radiusExemptionEnabled
      ? form.radiusExemptionStartDate || null
      : null,
    radiusExemptionEndDate: form.radiusExemptionEnabled
      ? form.radiusExemptionEndDate || null
      : null,
    radiusExemptionReason:
      form.radiusExemptionEnabled && form.radiusExemptionReason.trim()
        ? form.radiusExemptionReason.trim()
        : null,
  };
}

function validateForm(form, saveAsDraft) {
  const errors = {};
  const requireFullForm = !saveAsDraft;

  if (!form.namaKerja.trim()) errors.namaKerja = 'Wajib diisi';
  if (!form.nomorJo.trim()) errors.nomorJo = 'Wajib diisi';

  if (requireFullForm) {
    if (!form.pelaksana.trim()) {
      errors.pelaksana = 'Wajib diisi saat jadwal diaktifkan';
    }
    if (!form.waktuMulai) errors.waktuMulai = 'Waktu mulai wajib diisi';
    if (!form.waktuBerakhir) errors.waktuBerakhir = 'Waktu berakhir wajib diisi';
    if (form.waktuMulai && form.waktuBerakhir && form.waktuBerakhir < form.waktuMulai) {
      errors.waktuBerakhir = 'Tanggal akhir tidak boleh lebih awal';
    }
    if (!form.namaPengawas) errors.namaPengawas = 'Group supervisi wajib dipilih';
    if (!form.picSupervisi) errors.picSupervisi = 'PIC supervisi wajib dipilih';

    if (form.locations.length === 0) {
      errors.locations = 'Minimal 1 lokasi dengan titik GPS wajib ditambahkan';
    } else if (form.locations.some((location) => !hasGps(location))) {
      errors.locations = 'Setiap lokasi wajib punya titik GPS';
    }
  }

  if (form.radiusExemptionEnabled) {
    if (!form.radiusExemptionStartDate) {
      errors.radiusExemptionStartDate = 'Tanggal mulai wajib diisi';
    }
    if (!form.radiusExemptionEndDate) {
      errors.radiusExemptionEndDate = 'Tanggal akhir wajib diisi';
    }
    if (
      form.radiusExemptionStartDate &&
      form.radiusExemptionEndDate &&
      form.radiusExemptionEndDate < form.radiusExemptionStartDate
    ) {
      errors.radiusExemptionEndDate = 'Tanggal akhir tidak boleh lebih awal';
    }
  }

  return errors;
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{children}</p>;
}

function SectionTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#0a2540]">{icon}</span>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {title}
      </p>
    </div>
  );
}

export function SupervisiJobFormDialog({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [savingMode, setSavingMode] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setErrors({});
      setSavingMode(null);
    }
  }, [open]);

  const picOptions = useMemo(
    () => PIC_OPTIONS_BY_GROUP[form.namaPengawas] || [],
    [form.namaPengawas],
  );

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function addLocation() {
    setForm((prev) => ({
      ...prev,
      locations: [...prev.locations, createLocation()],
    }));
    setErrors((prev) => ({ ...prev, locations: undefined }));
  }

  function updateLocation(index, patch) {
    setForm((prev) => ({
      ...prev,
      locations: prev.locations.map((location, i) => (
        i === index ? { ...location, ...patch } : location
      )),
    }));
    setErrors((prev) => ({ ...prev, locations: undefined }));
  }

  function removeLocation(index) {
    setForm((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index),
    }));
  }

  async function captureGps(index) {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung pengambilan GPS.');
      return;
    }

    updateLocation(index, { isCapturing: true });
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        });
      });

      updateLocation(index, {
        latitude: position.coords.latitude.toFixed(7),
        longitude: position.coords.longitude.toFixed(7),
        capturedAt: new Date().toISOString(),
        isCapturing: false,
      });
      toast.success('Titik GPS berhasil diambil.');
    } catch (err) {
      updateLocation(index, { isCapturing: false });
      toast.error(err?.message || 'Tidak bisa mengambil lokasi GPS.');
    }
  }

  async function submit(saveAsDraft) {
    const nextErrors = validateForm(form, saveAsDraft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(
        saveAsDraft
          ? 'Minimal nama pekerjaan dan nomor JO wajib diisi untuk draft.'
          : 'Lengkapi semua field wajib termasuk titik GPS di setiap lokasi.',
      );
      return;
    }

    const mode = saveAsDraft ? 'draft' : 'active';
    setSavingMode(mode);
    try {
      const savedJob = await createSupervisiJob(buildPayload(form, saveAsDraft));
      toast.success(
        saveAsDraft
          ? 'Draft supervisi berhasil disimpan.'
          : 'Pekerjaan supervisi berhasil dibuat.',
      );
      onSaved?.(savedJob);
      onOpenChange?.(false);
    } catch (err) {
      toast.error(err?.message || 'Gagal menyimpan pekerjaan supervisi.');
    } finally {
      setSavingMode(null);
    }
  }

  const isSaving = savingMode != null;

  return (
    <Dialog open={open} onOpenChange={(value) => !isSaving && onOpenChange?.(value)}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2 text-[#0a2540]">
            <Briefcase size={18} /> Tambah Jadwal Supervisi
          </DialogTitle>
          <p className="text-sm text-slate-500">
            Form ini mengikuti isian tambah jadwal supervisi di app.
          </p>
        </DialogHeader>

        <div className="max-h-[calc(92vh-150px)] overflow-y-auto px-6 py-5 space-y-7">
          <section className="space-y-4">
            <SectionTitle icon={<Briefcase size={15} />} title="Informasi Pekerjaan" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Nama Pekerjaan" required error={errors.namaKerja}>
                <input
                  value={form.namaKerja}
                  onChange={(event) => updateField('namaKerja', event.target.value)}
                  placeholder="Contoh: Pengawasan Pembangunan Reservoir"
                  className="sv-input"
                  disabled={isSaving}
                />
              </FormField>
              <FormField label="Nomor JO" required error={errors.nomorJo}>
                <input
                  value={form.nomorJo}
                  onChange={(event) => updateField('nomorJo', event.target.value)}
                  placeholder="Contoh: JO-2026-0012"
                  className="sv-input"
                  disabled={isSaving}
                />
              </FormField>
              <FormField label="Nilai Pekerjaan">
                <div className="flex rounded-xl border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <span className="px-3 py-2.5 text-sm font-semibold text-slate-500">Rp</span>
                  <input
                    value={form.nilaiPekerjaan}
                    onChange={(event) => updateField('nilaiPekerjaan', formatRupiahInput(event.target.value))}
                    placeholder="Contoh: 1.500.000.000"
                    inputMode="numeric"
                    className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                    disabled={isSaving}
                  />
                </div>
              </FormField>
              <FormField label="Pelaksana Pekerjaan (Vendor)" required error={errors.pelaksana}>
                <input
                  value={form.pelaksana}
                  onChange={(event) => updateField('pelaksana', event.target.value)}
                  placeholder="Contoh: PT. Maju Bersama Konstruksi"
                  className="sv-input"
                  disabled={isSaving}
                />
              </FormField>
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={<CalendarDays size={15} />} title="Jadwal Pekerjaan" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Waktu Mulai" required error={errors.waktuMulai}>
                <input
                  type="date"
                  value={form.waktuMulai}
                  onChange={(event) => {
                    updateField('waktuMulai', event.target.value);
                    if (form.waktuBerakhir && form.waktuBerakhir < event.target.value) {
                      updateField('waktuBerakhir', '');
                    }
                  }}
                  className="sv-input"
                  disabled={isSaving}
                />
              </FormField>
              <FormField label="Waktu Berakhir" required error={errors.waktuBerakhir}>
                <input
                  type="date"
                  min={form.waktuMulai || undefined}
                  value={form.waktuBerakhir}
                  onChange={(event) => updateField('waktuBerakhir', event.target.value)}
                  className="sv-input"
                  disabled={isSaving}
                />
              </FormField>
            </div>
            {form.waktuMulai && form.waktuBerakhir && form.waktuBerakhir >= form.waktuMulai && (
              <p className="inline-flex rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                Durasi: {Math.round((new Date(form.waktuBerakhir) - new Date(form.waktuMulai)) / 86400000) + 1} hari
              </p>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle icon={<MapPin size={15} />} title="Lokasi Survey Proyek" />
              <Button type="button" variant="outline" size="sm" onClick={addLocation} disabled={isSaving}>
                <Plus size={13} /> Tambah Lokasi
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Planner wajib mengambil GPS di setiap titik lokasi proyek. Eksekutor harus melapor dari semua titik lokasi setiap harinya.
            </p>
            <FieldError>{errors.locations}</FieldError>
            <div className="space-y-3">
              {form.locations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada lokasi ditambahkan. Klik "Tambah Lokasi" untuk menambah titik GPS proyek.
                </div>
              ) : form.locations.map((location, index) => (
                <div key={location.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-slate-700">Lokasi {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => removeLocation(index)}
                      disabled={isSaving}
                      aria-label={`Hapus lokasi ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField label="Nama Area">
                      <input
                        value={location.namaArea}
                        onChange={(event) => updateLocation(index, { namaArea: event.target.value })}
                        placeholder={`Lokasi ${index + 1}`}
                        className="sv-input bg-white"
                        disabled={isSaving}
                      />
                    </FormField>
                    <FormField label="Radius Laporan (meter)">
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={location.radius}
                        onChange={(event) => updateLocation(index, { radius: event.target.value })}
                        onBlur={() => updateLocation(index, { radius: String(normalizeRadius(location.radius)) })}
                        className="sv-input bg-white"
                        disabled={isSaving}
                      />
                    </FormField>
                    <FormField label="Latitude">
                      <input
                        value={location.latitude}
                        onChange={(event) => updateLocation(index, { latitude: event.target.value })}
                        onBlur={() => updateLocation(index, { latitude: toIsoCoordinate(location.latitude) })}
                        placeholder="-6.013500"
                        className="sv-input bg-white font-mono"
                        disabled={isSaving}
                      />
                    </FormField>
                    <FormField label="Longitude">
                      <input
                        value={location.longitude}
                        onChange={(event) => updateLocation(index, { longitude: event.target.value })}
                        onBlur={() => updateLocation(index, { longitude: toIsoCoordinate(location.longitude) })}
                        placeholder="106.021900"
                        className="sv-input bg-white font-mono"
                        disabled={isSaving}
                      />
                    </FormField>
                  </div>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <Button
                      type="button"
                      className="bg-teal-700 hover:bg-teal-800 text-white"
                      onClick={() => captureGps(index)}
                      disabled={isSaving || location.isCapturing}
                    >
                      {location.isCapturing ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
                      {hasGps(location) ? 'Perbarui GPS' : 'Ambil GPS'}
                    </Button>
                    {hasGps(location) && (
                      <span className="text-xs font-mono text-slate-500">
                        {Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}
                      </span>
                    )}
                    {location.capturedAt && (
                      <span className="text-xs text-slate-400">
                        Terakhir diambil {new Date(location.capturedAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={<CalendarOff size={15} />} title="Pengecualian Radius" />
            <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  checked={form.radiusExemptionEnabled}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      radiusExemptionEnabled: checked,
                      radiusExemptionStartDate: checked ? prev.radiusExemptionStartDate : '',
                      radiusExemptionEndDate: checked ? prev.radiusExemptionEndDate : '',
                      radiusExemptionReason: checked ? prev.radiusExemptionReason : '',
                    }));
                    setErrors((prev) => ({
                      ...prev,
                      radiusExemptionStartDate: undefined,
                      radiusExemptionEndDate: undefined,
                    }));
                  }}
                  disabled={isSaving}
                />
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Nonaktifkan kewajiban radius
                  </span>
                  <span className="block text-xs leading-relaxed text-slate-500">
                    {form.radiusExemptionEnabled
                      ? 'Eksekutor bisa submit hadir tanpa validasi radius pada rentang tanggal ini.'
                      : 'Eksekutor tetap wajib submit hadir dari dalam radius lokasi.'}
                  </span>
                </span>
              </label>

              {form.radiusExemptionEnabled && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField label="Mulai Nonaktif" required error={errors.radiusExemptionStartDate}>
                      <input
                        type="date"
                        value={form.radiusExemptionStartDate}
                        onChange={(event) => updateField('radiusExemptionStartDate', event.target.value)}
                        className="sv-input bg-white"
                        disabled={isSaving}
                      />
                    </FormField>
                    <FormField label="Akhir Nonaktif" required error={errors.radiusExemptionEndDate}>
                      <input
                        type="date"
                        min={form.radiusExemptionStartDate || undefined}
                        value={form.radiusExemptionEndDate}
                        onChange={(event) => updateField('radiusExemptionEndDate', event.target.value)}
                        className="sv-input bg-white"
                        disabled={isSaving}
                      />
                    </FormField>
                  </div>
                  <FormField label="Alasan">
                    <textarea
                      rows={3}
                      value={form.radiusExemptionReason}
                      onChange={(event) => updateField('radiusExemptionReason', event.target.value)}
                      placeholder="Contoh: area kerja sulit mendapat sinyal GPS selama pekerjaan emergency."
                      className="sv-input min-h-[88px] resize-none bg-white"
                      disabled={isSaving}
                    />
                  </FormField>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={<User size={15} />} title="Personel Supervisi" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Group Supervisi" required error={errors.namaPengawas}>
                <select
                  value={form.namaPengawas}
                  onChange={(event) => {
                    const group = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      namaPengawas: group,
                      picSupervisi: PIC_OPTIONS_BY_GROUP[group]?.includes(prev.picSupervisi)
                        ? prev.picSupervisi
                        : '',
                    }));
                    setErrors((prev) => ({ ...prev, namaPengawas: undefined, picSupervisi: undefined }));
                  }}
                  className="sv-input"
                  disabled={isSaving}
                >
                  <option value="">Pilih group supervisi</option>
                  {GROUP_OPTIONS.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="PIC Supervisi" required error={errors.picSupervisi}>
                <select
                  value={form.picSupervisi}
                  onChange={(event) => updateField('picSupervisi', event.target.value)}
                  className="sv-input"
                  disabled={isSaving || !form.namaPengawas}
                >
                  <option value="">
                    {form.namaPengawas ? 'Pilih PIC supervisi' : 'Pilih group supervisi lebih dulu'}
                  </option>
                  {picOptions.map((pic) => (
                    <option key={pic} value={pic}>{pic}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <p className="text-xs text-slate-500">
              {form.namaPengawas
                ? 'Tugas supervisi akan dikirim ke personal PIC yang dipilih.'
                : 'PIC hanya bisa dipilih setelah group supervisi ditentukan.'}
            </p>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => submit(true)}
            disabled={isSaving}
          >
            {savingMode === 'draft' ? <Loader2 size={14} className="animate-spin" /> : null}
            Simpan Draft
          </Button>
          <Button
            type="button"
            className="bg-[#0a2540] text-white hover:bg-[#0d3154]"
            onClick={() => submit(false)}
            disabled={isSaving}
          >
            {savingMode === 'active' ? <Loader2 size={14} className="animate-spin" /> : null}
            Buat Jadwal
          </Button>
        </DialogFooter>

        <style jsx>{`
          .sv-input {
            width: 100%;
            border-radius: 0.75rem;
            border: 1px solid rgb(226 232 240);
            background: rgb(248 250 252);
            padding: 0.625rem 0.75rem;
            font-size: 0.875rem;
            color: rgb(51 65 85);
            outline: none;
          }
          .sv-input::placeholder {
            color: rgb(148 163 184);
          }
          .sv-input:focus {
            border-color: rgb(59 130 246 / 0.55);
            box-shadow: 0 0 0 3px rgb(59 130 246 / 0.18);
          }
          .sv-input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, required = false, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      <FieldError>{error}</FieldError>
    </label>
  );
}
