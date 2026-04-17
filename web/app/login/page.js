'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAuth, isAuthenticated } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/');
    }
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik: nik.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'NIK atau password salah.');
        return;
      }
      setAuth(data.token, data.user);
      router.replace('/');
    } catch {
      setError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1B3A5C] mb-3">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <div className="text-xl font-bold text-[#1B3A5C]">KTI SmartCare</div>
          <div className="text-sm text-gray-500 mt-0.5">Preventive Maintenance System</div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="text-base font-bold text-gray-900 mb-0.5">Masuk ke akun Anda</div>
          <div className="text-sm text-gray-500 mb-6">Gunakan NIK dan password yang terdaftar</div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-700 mb-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">NIK</label>
              <input
                type="text"
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="Masukkan NIK Anda"
                autoComplete="username"
                inputMode="numeric"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#1B3A5C] focus:ring-2 focus:ring-[#1B3A5C]/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#1B3A5C] focus:ring-2 focus:ring-[#1B3A5C]/20 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#1B3A5C] text-white text-sm font-semibold rounded-lg hover:bg-[#14304f] active:bg-[#0e2540] disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1"
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-xs text-gray-400">KTI SmartCare &copy; 2026</p>
      </div>
    </div>
  );
}
