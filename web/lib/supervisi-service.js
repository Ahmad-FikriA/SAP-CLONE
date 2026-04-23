import { apiGet } from '@/lib/api';

/**
 * Ambil semua job supervisi dari backend.
 * @param {Object} params - Filter opsional: { status, createdBy, picSupervisi }
 */
export async function fetchSupervisiJobs(params = {}) {
  const query = new URLSearchParams();
  if (params.status)      query.set('status',      params.status);
  if (params.createdBy)   query.set('createdBy',   params.createdBy);
  if (params.picSupervisi) query.set('picSupervisi', params.picSupervisi);

  const qs = query.toString();
  const data = await apiGet(`/inspection/supervisi/jobs${qs ? `?${qs}` : ''}`);
  return data?.data ?? [];
}

/**
 * Ambil satu job supervisi by ID.
 * @param {number|string} id
 */
export async function fetchSupervisiJobById(id) {
  const data = await apiGet(`/inspection/supervisi/jobs/${id}`);
  return data?.data ?? null;
}

// ─── Status meta ─────────────────────────────────────────────────────────────

export const SUPERVISI_STATUS_META = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400',   mapColor: '#9CA3AF' },
  active:    { label: 'Aktif',      color: 'bg-green-100 text-green-700',  dot: 'bg-green-500',  mapColor: '#22C55E' },
  completed: { label: 'Selesai',    color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',   mapColor: '#3B82F6' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700',      dot: 'bg-red-500',    mapColor: '#EF4444' },
};

// ─── Helper: konversi SupervisiJob → event kalender ──────────────────────────

/**
 * Ubah array SupervisiJob menjadi format event yang kompatibel
 * dengan InspeksiCalendar / JadwalKalender.
 */
export function supervisiJobsToCalendarEvents(jobs = []) {
  return jobs.map((job) => ({
    id:              `sv_${job.id}`,
    title:           job.namaKerja || job.nomorJo || '(tanpa nama)',
    type:            'supervisi',           // untuk color-coding
    source:          'supervisi',
    status:          job.status,
    scheduledDate:   job.waktuMulai,
    scheduledEndDate: job.waktuBerakhir,
    assignedTo:      job.picSupervisi,
    location:        job.namaArea,
    // Field ekstra supervisi
    nomorJo:         job.nomorJo,
    pelaksana:       job.pelaksana,
    namaPengawas:    job.namaPengawas,
    nilaiPekerjaan:  job.nilaiPekerjaan,
    latitude:        job.latitude,
    longitude:       job.longitude,
    locations:       job.locations,
    _raw:            job,
  }));
}
