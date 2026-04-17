'use client';

import { WidgetSummary, WidgetPreventive, WidgetCorrective } from './_widgets';
import { getUser } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    setUser(getUser());
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Selamat pagi' : hour < 17 ? 'Selamat siang' : 'Selamat sore');
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {greeting}{user?.name ? `, ${user.name}` : ''}. Berikut ringkasan sistem hari ini.
        </p>
      </div>

      {/* KPI summary row — spans full width */}
      <WidgetSummary />

      {/* Module widgets grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WidgetPreventive />
        <WidgetCorrective />
        {/* Team adds their widget components here ↓ */}
      </div>
    </div>
  );
}
