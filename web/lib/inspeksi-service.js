import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

/**
 * Ambil daftar jadwal inspeksi dari backend.
 * @param {Object} params - Filter opsional: { status, type, assignedTo, createdBy }
 */
export async function fetchInspeksiSchedules(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);
  if (params.assignedTo) query.set('assignedTo', params.assignedTo);
  if (params.createdBy) query.set('createdBy', params.createdBy);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);

  const qs = query.toString();
  const data = await apiGet(`/inspection/schedules${qs ? `?${qs}` : ''}`);
  return data?.data ?? [];
}

/**
 * Ambil arsip jadwal inspeksi dengan pagination server-side.
 * @param {Object} params - { page, limit, q, status, type, dateFrom, dateTo }
 */
export async function fetchInspeksiScheduleArchive(params = {}) {
  const query = new URLSearchParams();
  query.set('archive', 'true');
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);
  if (params.assignedTo) query.set('assignedTo', params.assignedTo);
  if (params.createdBy) query.set('createdBy', params.createdBy);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);

  const data = await apiGet(`/inspection/schedules?${query.toString()}`);
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
 * Ambil nomor SPK inspeksi berikutnya dari backend.
 */
export async function fetchNextInspeksiSpkNumber() {
  const data = await apiGet('/inspection/schedules/next-spk');
  return data?.data?.nextSpk ?? '';
}

/**
 * Buat jadwal inspeksi sekali jalan.
 * @param {Object} payload
 */
export async function createInspeksiSchedule(payload) {
  const data = await apiPost('/inspection/schedules', payload);
  return data?.data ?? null;
}

/**
 * Buat jadwal inspeksi berulang.
 * @param {Object} payload - { baseSchedule, recurringType, startDate, endDate }
 */
export async function createRecurringInspeksiSchedules(payload) {
  const data = await apiPost('/inspection/schedules/recurring', payload);
  return data?.data ?? [];
}

/**
 * Hapus jadwal inspeksi berdasarkan ID.
 * @param {number} id
 */
export async function deleteInspeksiSchedule(id) {
  return apiDelete(`/inspection/schedules/${id}`);
}

/**
 * Ambil laporan hasil inspeksi untuk satu schedule tertentu.
 * @param {number} scheduleId
 */
export async function fetchInspeksiReports(scheduleId) {
  const data = await apiGet(`/inspection/reports?scheduleId=${scheduleId}`);
  return data?.data ?? [];
}

/**
 * Setujui laporan inspeksi.
 * @param {number} reportId
 * @param {Object} payload - { notes?, assignedTechnician?, kategoriTeknisi?, deadline? }
 */
export async function approveInspeksiReport(reportId, payload = {}) {
  const data = await apiPut(`/inspection/reports/${reportId}/approve`, payload);
  return data?.data ?? null;
}

/**
 * Tolak atau kembalikan laporan inspeksi untuk revisi.
 * @param {number} reportId
 * @param {Object} payload - { notes }
 */
export async function rejectInspeksiReport(reportId, payload = {}) {
  const data = await apiPut(`/inspection/reports/${reportId}/reject`, payload);
  return data?.data ?? null;
}

/**
 * Ambil follow-up untuk satu schedule tertentu.
 * @param {number} scheduleId
 */
export async function fetchInspeksiFollowUps(scheduleId) {
  const data = await apiGet(`/inspection/follow-ups?scheduleId=${scheduleId}`);
  return data?.data ?? [];
}

/**
 * Ambil detail satu schedule inspeksi by ID.
 * @param {number} id
 */
export async function fetchInspeksiScheduleById(id) {
  const data = await apiGet(`/inspection/schedules/${id}`);
  return data?.data ?? null;
}

/**
 * Ambil daftar user untuk mapping NIK → nama eksekutor.
 * @returns {Promise<Record<string, string>>} Map nik → name
 */
export async function fetchInspeksiUsersMap() {
  try {
    const data = await apiGet('/users');
    const users = data?.data ?? data ?? [];
    const map = {};
    for (const u of users) {
      if (u.nik) map[String(u.nik)] = u.name || u.nik;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Mapping status backend → label display + badge variant
 */
export const INSPEKSI_STATUS_META = {
  scheduled:   { label: 'Terjadwal',  variant: 'scheduled',   isAktif: true  },
  in_progress: { label: 'Berjalan',   variant: 'in_progress', isAktif: true  },
  completed:   { label: 'Selesai',    variant: 'completed',   isAktif: false },
  cancelled:   { label: 'Dibatalkan', variant: 'cancelled',   isAktif: false },
};

export const INSPEKSI_TYPE_LABELS = {
  rutin: 'Rutin',
  inspeksi: 'Inspeksi',
  k3: 'K3',
  supervisi: 'Supervisi',
};

/**
 * Resolve label tipe berdasarkan data schedule:
 * - Ada userRequest (dari laporan/permintaan) → 'Inspeksi'
 * - Rutin tanpa request → 'Rutin'
 * - K3, Supervisi → sesuai type
 */
export function resolveInspeksiTypeLabel(schedule) {
  if (schedule.userRequest || schedule.triggerSource === 'user_darurat') {
    return INSPEKSI_TYPE_LABELS.inspeksi;
  }
  return INSPEKSI_TYPE_LABELS[schedule.type] || schedule.type;
}
