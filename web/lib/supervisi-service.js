import { apiGet, apiPost, apiDelete, apiPut, apiUpload, apiFetch } from '@/lib/api';

/**
 * Ambil semua job supervisi dari backend.
 * @param {Object} params - Filter opsional: { status, createdBy, picSupervisi }
 */
export async function fetchSupervisiJobs(params = {}) {
  const query = new URLSearchParams();
  if (params.status)      query.set('status',      params.status);
  if (params.createdBy)   query.set('createdBy',   params.createdBy);
  if (params.picSupervisi) query.set('picSupervisi', params.picSupervisi);
  if (params.dateFrom)    query.set('dateFrom',    params.dateFrom);
  if (params.dateTo)      query.set('dateTo',      params.dateTo);

  const qs = query.toString();
  const data = await apiGet(`/inspection/supervisi/jobs${qs ? `?${qs}` : ''}`);
  return data?.data ?? [];
}

/**
 * Ambil arsip job supervisi dengan pagination server-side.
 * @param {Object} params - { page, limit, q, status, dateFrom, dateTo }
 */
export async function fetchSupervisiJobArchive(params = {}) {
  const query = new URLSearchParams();
  query.set('archive', 'true');
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.createdBy) query.set('createdBy', params.createdBy);
  if (params.picSupervisi) query.set('picSupervisi', params.picSupervisi);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);

  const data = await apiGet(`/inspection/supervisi/jobs?${query.toString()}`);
  const items = data?.data ?? [];
  return {
    items,
    meta: data?.meta ?? {
      page: Number(params.page) || 1,
      limit: Number(params.limit) || items.length || 20,
      total: items.length,
      totalPages: 1,
    },
  };
}

/**
 * Ambil satu job supervisi by ID.
 * @param {number|string} id
 */
export async function fetchSupervisiJobById(id) {
  const data = await apiGet(`/inspection/supervisi/jobs/${id}`);
  return data?.data ?? null;
}

/**
 * Buat pekerjaan supervisi baru.
 * Payload mengikuti form app: informasi pekerjaan, jadwal, personel,
 * multi-lokasi, dan pengecualian radius.
 * @param {Object} payload
 */
export async function createSupervisiJob(payload) {
  const data = await apiPost('/inspection/supervisi/jobs', payload);
  return data?.data ?? data;
}

/**
 * Perbarui (edit) pekerjaan supervisi.
 * @param {number|string} id
 * @param {Object} payload
 */
export async function updateSupervisiJob(id, payload) {
  const data = await apiPut(`/inspection/supervisi/jobs/${id}`, payload);
  return data?.data ?? data;
}

/**
 * Hapus (permanent delete) satu job supervisi by ID.
 * Hanya untuk Scheduler dan biasanya hanya job draft.
 * @param {number|string} id
 */
export async function deleteSupervisiJob(id) {
  const data = await apiDelete(`/inspection/supervisi/jobs/${id}`);
  return data;
}

/**
 * Batalkan satu job supervisi (set status=cancelled + alasan).
 * @param {number|string} id
 * @param {string} cancelReason  Alasan pembatalan (wajib, min. 5 karakter)
 */
export async function cancelSupervisiJob(id, cancelReason) {
  const data = await apiPut(`/inspection/supervisi/jobs/${id}`, {
    status: 'cancelled',
    cancelReason,
  });
  return data;
}

/**
 * Perbarui koordinat lokasi job supervisi dari peta web.
 * @param {number|string} id
 * @param {Object} payload - { locations, latitude, longitude, radius, namaArea }
 */
export async function updateSupervisiJobLocation(id, payload) {
  const data = await apiPut(`/inspection/supervisi/jobs/${id}`, payload);
  return data?.data ?? data;
}

export async function updateSupervisiRadiusExemption(id, payload) {
  const data = await apiPut(`/inspection/supervisi/jobs/${id}`, payload);
  return data?.data ?? data;
}

export async function fetchSupervisiAmends(jobId) {
  const data = await apiGet(`/inspection/supervisi/jobs/${jobId}/amends`);
  return data?.data ?? [];
}

export async function createSupervisiAmend(jobId, formData) {
  const data = await apiUpload(`/inspection/supervisi/jobs/${jobId}/amends`, formData);
  return data?.data ?? data;
}

export async function updateSupervisiAmend(jobId, amendId, formData) {
  const data = await apiFetch(`/inspection/supervisi/jobs/${jobId}/amends/${amendId}`, {
    method: 'PUT',
    body: formData,
  });
  return data?.data ?? data;
}

export async function deleteSupervisiAmend(jobId, amendId) {
  const data = await apiDelete(`/inspection/supervisi/jobs/${jobId}/amends/${amendId}`);
  return data;
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
