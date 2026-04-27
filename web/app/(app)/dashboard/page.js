'use client';

import { WidgetSummary, WidgetPreventive, WidgetCorrective } from './_widgets';
import { getUser } from '@/lib/auth';
import { apiDelete } from '@/lib/api';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [greeting, setGreeting] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    setUser(getUser());
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Selamat pagi' : hour < 17 ? 'Selamat siang' : 'Selamat sore');
  }, []);

  const handleClearData = async () => {
    if (!confirm('PERINGATAN: Apakah Anda yakin ingin menghapus semua data percobaan Inspeksi dan Supervisi? Tindakan ini tidak dapat dibatalkan.')) return;
    
    setIsClearing(true);
    try {
      await apiDelete('/inspection/clear-dummy-data');
      alert('Berhasil: Semua data percobaan Inspeksi dan Supervisi telah dihapus.');
      window.location.reload();
    } catch (err) {
      alert('Gagal menghapus data: ' + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {greeting}{user?.name ? `, ${user.name}` : ''}. Berikut ringkasan sistem hari ini.
          </p>
        </div>
        {user?.role === 'admin' && (
          <button 
            onClick={handleClearData} 
            disabled={isClearing}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow text-sm font-medium disabled:opacity-50 flex items-center transition-colors"
          >
            {isClearing ? 'Menghapus...' : '🗑️ Hapus Data Percobaan (Inspeksi & Supervisi)'}
          </button>
        )}
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
