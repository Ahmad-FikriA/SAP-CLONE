'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Save, Lock, User, Shield, Mail, Calendar, MapPin, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet, apiPut, apiUpload } from '@/lib/api';
import { toast } from 'sonner';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    role: '',
    dinas: '',
    divisi: '',
    tanggalLahir: '',
    alamat: '',
    noHp: '',
    fotoProfil: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Fetch initial profile data
  useEffect(() => {
    apiGet('/users/profile/me')
      .then((data) => {
        setProfileData({
          name: data.name || '',
          email: data.email || '',
          role: data.role || '',
          dinas: data.dinas || '',
          divisi: data.divisi || '',
          tanggalLahir: data.tanggalLahir || '',
          alamat: data.alamat || '',
          noHp: data.noHp || '',
          fotoProfil: data.fotoProfil || '',
        });
      })
      .catch((err) => toast.error('Gagal mengambil data profil: ' + err.message));
  }, []);

  const handleProfileSave = async () => {
    setLoading(true);
    try {
      const res = await apiPut('/users/profile/me', profileData);
      toast.success(res.message || 'Profil berhasil diperbarui');
    } catch (err) {
      toast.error('Gagal memperbarui: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSave = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('Konfirmasi kata sandi tidak cocok!');
    }
    
    setLoading(true);
    try {
      const res = await apiPut('/users/profile/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success(res.message || 'Kata sandi berhasil diubah');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error('Gagal mengubah sandi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size immediately (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    const t = toast.loading('Mengunggah foto...');
    try {
      const res = await apiUpload('/users/profile/photo', formData);
      setProfileData(prev => ({ ...prev, fotoProfil: res.fotoProfil }));
      toast.success('Foto profil berhasil diunggah', { id: t });
    } catch (err) {
      toast.error('Gagal mengunggah foto: ' + err.message, { id: t });
    }
    
    // Clear input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
            <User size={24} className="text-white w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          Pengaturan Akun
        </h1>
        <p className="text-slate-500 text-sm sm:text-base ml-12 sm:ml-[3.25rem]">
          Kelola informasi profil dan keamanan akun Anda.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 hide-scrollbar">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all whitespace-nowrap",
              activeTab === 'profile'
                ? "bg-white text-blue-700 shadow-sm border border-blue-100"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
            )}
          >
            <User size={18} className={activeTab === 'profile' ? "text-blue-600" : "text-slate-400"} />
            Profil Pengguna
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all whitespace-nowrap",
              activeTab === 'password'
                ? "bg-white text-blue-700 shadow-sm border border-blue-100"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
            )}
          >
            <Lock size={18} className={activeTab === 'password' ? "text-blue-600" : "text-slate-400"} />
            Keamanan Sandi
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {activeTab === 'profile' && (
            <div className="p-6 sm:p-8 animate-in slide-in-from-right-4 duration-300">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">Informasi Pribadi</h2>
                <p className="text-sm text-slate-500">Perbarui foto profil dan detail informasi Anda.</p>
              </div>

              {/* Profile Photo Upload */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-8 border-b border-slate-100">
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/jpg" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden relative">
                    {profileData.fotoProfil ? (
                      <img 
                        src={`${API_URL}/uploads/profiles/${profileData.fotoProfil}`} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
                        {profileData.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Camera size={24} className="text-white" />
                  </div>
                </div>
                <div className="text-center sm:text-left space-y-2">
                  <h3 className="font-semibold text-slate-900">Foto Profil</h3>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Disarankan gambar format JPG atau PNG, ukuran maksimal 2MB. Resolusi 1:1.
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs font-semibold rounded-lg"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Ubah Foto
                    </Button>
                    {profileData.fotoProfil && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg">
                        Hapus
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Forms */}
              <div className="pt-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        value={profileData.name}
                        readOnly
                        disabled
                        className="pl-10 h-11 bg-slate-100/50 text-slate-500 rounded-xl cursor-not-allowed border-slate-200 shadow-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        value={profileData.email}
                        onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                        className="pl-10 h-11 bg-slate-50 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      No HP
                      <span className="text-[10px] text-slate-400 font-normal lowercase">(Opsional)</span>
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        value={profileData.noHp}
                        onChange={(e) => setProfileData({...profileData, noHp: e.target.value})}
                        className="pl-10 h-11 bg-slate-50 rounded-xl"
                        placeholder="Contoh: 081234567890"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      Tanggal Lahir
                      <span className="text-[10px] text-slate-400 font-normal lowercase">(Opsional)</span>
                    </label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        type="date"
                        value={profileData.tanggalLahir}
                        onChange={(e) => setProfileData({...profileData, tanggalLahir: e.target.value})}
                        className="pl-10 h-11 bg-slate-50 rounded-xl text-slate-700 block w-full"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      Alamat
                      <span className="text-[10px] text-slate-400 font-normal lowercase">(Opsional)</span>
                    </label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
                      <textarea 
                        value={profileData.alamat}
                        onChange={(e) => setProfileData({...profileData, alamat: e.target.value})}
                        className="w-full pl-10 pr-3 py-2.5 min-h-[80px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm resize-none"
                        placeholder="Masukkan alamat lengkap Anda..."
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Role</label>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <Shield size={14} className="text-blue-500" />
                      {profileData.role}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Dinas</label>
                    <p className="text-sm font-semibold text-slate-800">{profileData.dinas}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Divisi</label>
                    <p className="text-sm font-semibold text-slate-800">{profileData.divisi}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end pt-5 border-t border-slate-100">
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-6 shadow-sm"
                  onClick={handleProfileSave}
                  disabled={loading}
                >
                  <Save size={16} className="mr-2" />
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="p-6 sm:p-8 animate-in slide-in-from-right-4 duration-300">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">Ubah Kata Sandi</h2>
                <p className="text-sm text-slate-500">Pastikan akun Anda menggunakan kata sandi yang kuat dan aman.</p>
              </div>

              <div className="space-y-5 max-w-lg">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kata Sandi Saat Ini</label>
                  <Input 
                    type="password"
                    placeholder="Masukkan kata sandi saat ini"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    className="h-11 bg-slate-50 rounded-xl"
                  />
                </div>
                
                <div className="pt-2 border-t border-slate-100 space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kata Sandi Baru</label>
                    <Input 
                      type="password"
                      placeholder="Masukkan kata sandi baru"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      className="h-11 bg-slate-50 rounded-xl"
                    />
                    <p className="text-[10px] text-slate-400 font-medium ml-1">Minimal 8 karakter, kombinasi huruf dan angka.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Konfirmasi Kata Sandi</label>
                    <Input 
                      type="password"
                      placeholder="Ulangi kata sandi baru"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      className="h-11 bg-slate-50 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end pt-5 border-t border-slate-100">
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-6 shadow-sm"
                  onClick={handlePasswordSave}
                  disabled={loading}
                >
                  <Save size={16} className="mr-2" />
                  {loading ? 'Menyimpan...' : 'Perbarui Sandi'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
