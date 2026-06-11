'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { setAuth, isAuthenticated } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex bg-white">
      {/* ════════════════════════════════════════════════
          LEFT: Full-bleed logo panel (desktop only)
          ════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-[#0a2540] p-12">
        <Image
          src="/icon.png"
          alt="Logo MANTIS PPHSE"
          width={768}
          height={768}
          priority
          className="h-auto w-full max-w-full object-contain"
        />
      </div>

      {/* ════════════════════════════════════════════════
          RIGHT: Branding + login form
          ════════════════════════════════════════════════ */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Compact logo (mobile only) */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Image src="/icon.png" alt="Logo MANTIS PPHSE" width={96} height={96} priority className="h-24 w-24 object-contain" />
          </div>

          {/* Brand heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0a2540] sm:text-4xl">MANTIS PPHSE</h1>
            <p className="mt-2 text-sm text-gray-500">Sistem Manajemen Pemeliharaan &amp; PPHSE — PT KTI</p>
            <h2 className="mt-8 text-xl font-bold tracking-tight text-gray-900">Masuk ke akun Anda</h2>
            <p className="mt-1 text-sm text-gray-500">Gunakan NIK dan password yang terdaftar.</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 animate-in fade-in slide-in-from-top-1 duration-300">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="nik" className="mb-1.5 block text-sm font-semibold text-gray-700">
                NIK
              </label>
              <input
                id="nik"
                type="text"
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="Masukkan NIK Anda"
                autoComplete="username"
                inputMode="numeric"
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#0a2540] focus:outline-none focus:ring-2 focus:ring-[#0a2540]/15"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 pr-11 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#0a2540] focus:outline-none focus:ring-2 focus:ring-[#0a2540]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-700"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a2540] py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0d2f52] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Memproses…
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>



          <p className="mt-4 text-center text-xs text-gray-400">MANTIS PPHSE &middot; PT KTI</p>
        </div>
      </div>
    </div>
  );
}
