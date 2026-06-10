export const APPROVAL_LABELS = {
  pending: "Menunggu Approval",
  approved: "Sudah Disetujui",
  rejected: "Ditolak",
};

export const APPROVAL_COLORS = {
  pending: "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200",
};

export const NOTIF_STATUS_LABELS = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export const NOTIF_STATUS_COLORS = {
  submitted: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  approved: "bg-green-100 text-green-700 hover:bg-green-100",
  rejected: "bg-red-100 text-red-600 hover:bg-red-100",
};

export const SAP_STATUS_LABELS = {
  baru_import: "Tugas Baru",
  eksekusi: "Eksekusi",
  menunggu_review_kadis_pp: "Review Kadis PP",
  menunggu_review_kadis_pelapor: "Review Pelapor",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

export const SAP_STATUS_COLORS = {
  baru_import: "bg-gray-100 text-gray-600 hover:bg-gray-100",
  eksekusi: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  menunggu_review_kadis_pp: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  menunggu_review_kadis_pelapor:
    "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  selesai: "bg-green-100 text-green-700 hover:bg-green-100",
  ditolak: "bg-red-100 text-red-600 hover:bg-red-100",
};

export const SAP_SPK_STEPS = [
  { label: "Baru", key: "baru_import" },
  { label: "Eksekusi", key: "eksekusi" },
  { label: "Review Kadis PP", key: "menunggu_review_kadis_pp" },
  { label: "Review Pelapor", key: "menunggu_review_kadis_pelapor" },
  { label: "Selesai", key: "selesai" },
];
