'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { isAuthenticated, canRead } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';

const ROUTE_ACCESS = [
  { prefix: '/spk/approval', key: 'spk-approval' },
  { prefix: '/spk/import', key: 'spk-import' },
  { prefix: '/equipment/mappings', key: 'task-mapping' },
  { prefix: '/users/track-record', key: 'track-record' },
  { prefix: '/dashboard', key: 'dashboard' },
  { prefix: '/spk', key: 'spk' },
  { prefix: '/corrective', key: 'corrective' },
  { prefix: '/users', key: 'users' },
  { prefix: '/equipment', key: 'equipment' },
  { prefix: '/maps', key: 'maps' },
  { prefix: '/interval-planner', key: 'interval-planner' },
  { prefix: '/submissions', key: 'submissions' },
  { prefix: '/hse', key: 'hse' },
  { prefix: '/inspeksi', key: 'inspeksi' },
  { prefix: '/supervisi', key: 'supervisi' },
  { prefix: '/kalender', key: 'kalender' },
  { prefix: '/settings', key: 'settings' },
  { prefix: '/material', key: 'material' },
];

function accessKeyForPath(pathname) {
  if (pathname === '/') return 'dashboard';
  const match = ROUTE_ACCESS.find(({ prefix }) => (
    pathname === prefix || pathname.startsWith(prefix + '/')
  ));
  return match?.key || null;
}

function AccessDenied() {
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-amber-200 bg-white px-6 py-5 shadow-sm">
        <p className="text-sm font-bold text-amber-700">Akses Ditolak</p>
        <p className="mt-1 text-sm text-slate-500">
          Akun ini tidak memiliki izin untuk membuka halaman tersebut.
        </p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessKey = accessKeyForPath(pathname);
  const denied = accessKey && !canRead(accessKey);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex h-full">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto bg-gray-50 pt-14 md:pt-0">
        {denied ? <AccessDenied /> : children}
      </main>
    </div>
  );
}
