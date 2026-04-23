import { apiGet } from '@/lib/api';

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

  const qs = query.toString();
  const data = await apiGet(`/inspection/schedules${qs ? `?${qs}` : ''}`);
  return data?.data ?? [];
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
 * Mapping status backend → label display + badge variant
 */
export const INSPEKSI_STATUS_META = {
  scheduled:   { label: 'Terjadwal',  variant: 'scheduled',   isAktif: true  },
  in_progress: { label: 'Berjalan',   variant: 'in_progress', isAktif: true  },
  completed:   { label: 'Selesai',    variant: 'completed',   isAktif: false },
  cancelled:   { label: 'Dibatalkan', variant: 'cancelled',   isAktif: false },
};

export const INSPEKSI_TYPE_LABELS = {
  rutin:     'Rutin',
  k3:        'K3',
  supervisi: 'Supervisi',
};
