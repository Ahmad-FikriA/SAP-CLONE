'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';

export default function AppLayout({ children }) {
  const router = useRouter();

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
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
