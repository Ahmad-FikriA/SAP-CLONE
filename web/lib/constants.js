export const CATEGORIES = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];

/**
 * Kadis (Head of Division) area assignments.
 * `funcLocPrefixes` are level-2 functional location IDs that each Kadis covers.
 * Used by: Import SPK print signature, Generate SPK, approval routing.
 */
export const KADIS_AREAS = [
  {
    id: 'kadis_krenceng',
    label: 'Kadis Krenceng',
    description: 'WTP Krenceng',
    funcLocPrefixes: ['A-A2-01'],        // WTP Krenceng (incl. Decanter)
  },
  {
    id: 'kadis_airbaku',
    label: 'Kadis Air Baku',
    description: 'PS I Cidanau, Waduk',
    funcLocPrefixes: ['A-A1-01', 'A-A1-03'], // PS I Cidanau, Waduk Nadra Krenceng
  },
  {
    id: 'kadis_cipasauran_cidanau',
    label: 'Kadis Cipasauran/Cidanau',
    description: 'WTP Cidanau, Cipasauran',
    funcLocPrefixes: ['A-A1-02', 'A-A2-09'], // Bendung Cipasauran, WTP Cidanau
  },
  {
    id: 'kadis_keamanan',
    label: 'Kadis Keamanan',
    description: 'Pos Keamanan',
    funcLocPrefixes: ['A-A1-01-006', 'A-A1-02-006', 'A-A1-03-004'], // Pos Keamanan at each site
  },
];


export const CATEGORY_COLORS = {
  Mekanik: { bg: '#0070D222', text: '#0070D2' },
  Listrik: { bg: '#E67E2222', text: '#E67E22' },
  Sipil: { bg: '#27AE6022', text: '#27AE60' },
  Otomasi: { bg: '#8E44AD22', text: '#8E44AD' },
};

export const CATEGORY_MARKER_COLORS = {
  Mekanik: '#0070D2',
  Listrik: '#E67E22',
  Sipil: '#27AE60',
  Otomasi: '#8E44AD',
};

export const INTERVALS = ['1wk', '2wk', '4wk', '8wk', '12wk', '16wk', '24wk'];

export const ROLES = ['teknisi', 'planner', 'kasie', 'kadis', 'admin'];

export const ROLE_COLORS = {
  teknisi:    '#0070D2',
  planner:    '#6610f2',
  kasie:      '#0891B2',
  kadis:      '#0D9488',

  admin:      '#BB0000',
};

export const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'On Progress',
  completed: 'Selesai',
  approved: 'Disetujui',
  awaiting_kasie: 'Menunggu Kasie',
  awaiting_kadis_perawatan: 'Menunggu Kadis Perawatan',
  awaiting_kadis: 'Menunggu Kadis',
  error: 'Error',
  submitted: 'Submitted',
  spk_created: 'SPK Created',
  eksekusi: 'Eksekusi',
  closed: 'Closed',
  rejected: 'Ditolak',
  draft: 'Draft',
  awaiting_kadis_pusat: 'Menunggu Kadis Pusat',
  awaiting_kadis_pelapor: 'Menunggu Kadis Pelapor',
  // Inspection Schedule statuses
  scheduled: 'Terjadwal',
  cancelled: 'Dibatalkan',
};

export const STATUS_VARIANTS = {
  pending: 'pending',       // yellow
  in_progress: 'in_progress', // blue
  completed: 'completed',
  approved: 'completed',
  awaiting_kasie: 'in_progress',
  awaiting_kadis_perawatan: 'in_progress',
  awaiting_kadis: 'in_progress',
  error: 'error',
  submitted: 'pending',
  spk_created: 'in_progress',
  eksekusi: 'in_progress',
  closed: 'completed',
  rejected: 'error',
  draft: 'pending',
  awaiting_kadis_pusat: 'in_progress',
  awaiting_kadis_pelapor: 'in_progress',
  // Inspection Schedule statuses
  scheduled: 'pending',
  cancelled: 'error',
};

export const GEOJSON_FEATURE_COLORS = {
  building: '#6B7280',
  industrial: '#D97706',
  road: '#374151',
  railway: '#78350F',
  water: '#3B82F6',
  reservoir: '#60A5FA',
};
