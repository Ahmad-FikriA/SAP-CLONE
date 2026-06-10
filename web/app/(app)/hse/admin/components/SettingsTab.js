"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { cn, getMediaUrl } from "@/lib/utils";
import { apiPut, apiFetch, apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Clock,
  Save,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  Upload,
  Loader2,
  X,
} from "lucide-react";

export default function SettingsTab({ settings, fetchSettings }) {
  const [totalKaryawan, setTotalKaryawan] = useState(
    settings?.totalKaryawan || 280,
  );
  const [jamPerHari, setJamPerHari] = useState(settings?.jamKerjaPerHari || 8);
  const [hariPerBulan, setHariPerBulan] = useState(
    settings?.hariKerjaPerBulan || 20,
  );
  const [jumlahFatality, setJumlahFatality] = useState(
    settings?.jumlahFatality || 0,
  );
  const [jamKerjaTanpaKecelakaan, setJamKerjaTanpaKecelakaan] = useState(
    settings?.jamKerjaTanpaKecelakaan || 0,
  );
  const [bannerTitle1, setBannerTitle1] = useState(
    settings?.bannerTitle1 || "Zero Accident Strategy"
  );
  const [bannerTitle2, setBannerTitle2] = useState(
    settings?.bannerTitle2 || "Safety First, Always."
  );
  const [bannerDescription, setBannerDescription] = useState(
    settings?.bannerDescription || "Data kinerja keselamatan kerja yang diagregasi berdasarkan standar formulasi pelaporan insiden internasional."
  );
  const [bannerSlides, setBannerSlides] = useState([]);

  // Modal and slide states
  const [isAddSlideOpen, setIsAddSlideOpen] = useState(false);
  const [newSlideTitle, setNewSlideTitle] = useState("");
  const [newSlideSubtitle, setNewSlideSubtitle] = useState("");
  const [newSlideFile, setNewSlideFile] = useState(null);
  const [newSlidePreview, setNewSlidePreview] = useState("");
  const [uploadingSlide, setUploadingSlide] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setTotalKaryawan(settings.totalKaryawan || 280);
      setJamPerHari(settings.jamKerjaPerHari || 8);
      setHariPerBulan(settings.hariKerjaPerBulan || 20);
      setJumlahFatality(settings.jumlahFatality || 0);
      setJamKerjaTanpaKecelakaan(settings.jamKerjaTanpaKecelakaan || 0);
      setBannerTitle1(settings.bannerTitle1 || "Zero Accident Strategy");
      setBannerTitle2(settings.bannerTitle2 || "Safety First, Always.");
      setBannerDescription(settings.bannerDescription || "Data kinerja keselamatan kerja yang diagregasi berdasarkan standar formulasi pelaporan insiden internasional.");
      
      let slides = [];
      if (settings.bannerSlides) {
        try {
          slides = typeof settings.bannerSlides === 'string'
            ? JSON.parse(settings.bannerSlides)
            : settings.bannerSlides;
        } catch (e) {
          console.error("Error parsing initial slides", e);
        }
      }
      setBannerSlides(Array.isArray(slides) ? slides : []);
    }
  }, [settings]);

  const jamPerBulan = jamPerHari * hariPerBulan;
  const totalJamKerjaTahun = totalKaryawan * jamPerBulan * 12;

  const handleAddSlide = async () => {
    if (!newSlideFile) {
      toast.error("Silakan pilih file gambar");
      return;
    }
    if (!newSlideTitle) {
      toast.error("Judul slide wajib diisi");
      return;
    }
    
    setUploadingSlide(true);
    try {
      const fd = new FormData();
      fd.append("image", newSlideFile);
      
      const res = await apiUpload("/k3-settings/banner-image", fd);
      if (res && res.success) {
        const newSlide = {
          id: Date.now().toString(),
          path: res.path,
          title: newSlideTitle,
          subtitle: newSlideSubtitle
        };
        
        setBannerSlides((prev) => [...prev, newSlide]);
        toast.success("Gambar berhasil di-upload!");
        
        setNewSlideTitle("");
        setNewSlideSubtitle("");
        setNewSlideFile(null);
        if (newSlidePreview) URL.revokeObjectURL(newSlidePreview);
        setNewSlidePreview("");
        setIsAddSlideOpen(false);
      } else {
        throw new Error(res?.message || "Upload gagal");
      }
    } catch (e) {
      toast.error("Gagal mengupload gambar: " + e.message);
    } finally {
      setUploadingSlide(false);
    }
  };

  const handleDeleteSlide = async (indexToDelete) => {
    const slide = bannerSlides[indexToDelete];
    if (!slide) return;
    
    if (!window.confirm("Apakah Anda yakin ingin menghapus slide ini?")) return;
    
    try {
      if (slide.path) {
        await apiFetch("/k3-settings/banner-image", {
          method: "DELETE",
          body: JSON.stringify({ path: slide.path })
        });
      }
    } catch (e) {
      console.warn("Server file delete failed, removing from list anyway", e);
    }
    
    setBannerSlides((prev) => prev.filter((_, idx) => idx !== indexToDelete));
    toast.success("Slide dihapus");
  };

  const moveSlide = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= bannerSlides.length) return;
    setBannerSlides((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut("/k3-settings", {
        totalKaryawan,
        jamKerjaPerHari: jamPerHari,
        hariKerjaPerBulan: hariPerBulan,
        jumlahFatality,
        jamKerjaTanpaKecelakaan,
        bannerTitle1,
        bannerTitle2,
        bannerDescription,
        bannerSlides,
      });
      await fetchSettings();
      toast.success("Pengaturan berhasil disimpan");
    } catch (e) {
      toast.error("Gagal menyimpan: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-blue-400" />
          <h3 className="font-semibold text-sm uppercase tracking-wider text-blue-300">
            Ringkasan Konfigurasi
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Total Karyawan",
              value: totalKaryawan.toLocaleString(),
              suffix: "orang",
            },
            { label: "Jam Kerja/Hari", value: jamPerHari, suffix: "jam" },
            { label: "Hari Kerja/Bulan", value: hariPerBulan, suffix: "hari" },
            {
              label: "Total Jam Kerja/Tahun",
              value: totalJamKerjaTahun.toLocaleString(),
              suffix: "jam",
            },
            {
              label: "Jumlah Fatality",
              value: jumlahFatality,
              suffix: jumlahFatality > 0 ? "Ada" : "Tidak Ada",
            },
            {
              label: "Jam Kerja Aman",
              value: jamKerjaTanpaKecelakaan.toLocaleString(),
              suffix: "jam",
            },
          ].map((item, idx) => (
            <div key={idx} className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{item.label}</span>
              <div className="text-lg font-bold mt-1 text-slate-100">{item.value}</div>
              <span className="text-[10px] text-slate-500 font-medium">{item.suffix}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Banner & Slideshow Config */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">
            Konfigurasi Banner Utama K3
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Sesuaikan teks banner selamat datang dan gambar slideshow di sebelah kanan dashboard utama.
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Judul Baris 1 (Putih/Utama)
                  </label>
                  <span className={cn(
                    "text-[10px] font-medium",
                    bannerTitle1.length > 30 ? "text-rose-500 font-bold" : "text-slate-400"
                  )}>
                    {bannerTitle1.length}/35 karakter
                  </span>
                </div>
                <Input
                  type="text"
                  value={bannerTitle1}
                  onChange={(e) => setBannerTitle1(e.target.value.slice(0, 35))}
                  placeholder="cth. Zero Accident Strategy"
                  className="h-10 text-sm font-medium text-slate-800"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Judul Baris 2 (Highlight Merah)
                  </label>
                  <span className={cn(
                    "text-[10px] font-medium",
                    bannerTitle2.length > 30 ? "text-rose-500 font-bold" : "text-slate-400"
                  )}>
                    {bannerTitle2.length}/35 karakter
                  </span>
                </div>
                <Input
                  type="text"
                  value={bannerTitle2}
                  onChange={(e) => setBannerTitle2(e.target.value.slice(0, 35))}
                  placeholder="cth. Safety First, Always."
                  className="h-10 text-sm font-medium text-slate-800"
                />
              </div>
            </div>
            
            <div className="flex flex-col h-full space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Deskripsi Banner
                </label>
                <span className={cn(
                  "text-[10px] font-medium",
                  bannerDescription.length > 130 ? "text-rose-500 font-bold" : "text-slate-400"
                )}>
                  {bannerDescription.length}/140 karakter
                </span>
              </div>
              <textarea
                value={bannerDescription}
                onChange={(e) => setBannerDescription(e.target.value.slice(0, 140))}
                placeholder="Tulis deskripsi singkat..."
                rows={2}
                className="w-full text-sm border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-slate-300 resize-none flex-1"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Slides / Carousel Manager */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Slide Carousel K3
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Daftar gambar slideshow di banner kanan. Maksimal 5 slide.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={bannerSlides.length >= 5}
                onClick={() => setIsAddSlideOpen(true)}
                className="gap-1.5 h-8 text-xs rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Plus size={14} />
                Tambah Slide
              </Button>
            </div>

            {bannerSlides.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
                <Upload size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">Menggunakan Slide Default (Bawaan)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Belum ada slide kustom. 5 slide ilustrasi bawaan K3 akan ditampilkan di dashboard.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {bannerSlides.map((slide, idx) => (
                  <div
                    key={slide.id || idx}
                    className="relative rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow transition-all group bg-white flex flex-col"
                  >
                    <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                      <img
                        src={getMediaUrl(slide.path)}
                        alt={slide.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 to-transparent p-2 pt-6 text-white z-10">
                        <p className="text-[10px] font-bold truncate leading-tight">{slide.title}</p>
                        <p className="text-[8px] text-white/70 truncate mt-0.5 leading-none">{slide.subtitle || '-'}</p>
                      </div>
                    </div>
                    
                    {/* Controls */}
                    <div className="flex items-center justify-between p-1.5 border-t border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveSlide(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-white disabled:opacity-30 text-slate-500 hover:text-slate-700 transition-colors"
                          title="Geser Kiri"
                        >
                          <ChevronLeft size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSlide(idx, 1)}
                          disabled={idx === bannerSlides.length - 1}
                          className="p-1 rounded hover:bg-white disabled:opacity-30 text-slate-500 hover:text-slate-700 transition-colors"
                          title="Geser Kanan"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(idx)}
                        className="p-1 rounded hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors"
                        title="Hapus Slide"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">
            Konfigurasi Jam Kerja & Karyawan
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Nilai ini digunakan sebagai variabel rumus metrik K3 (NMRR, SOR,
            TRIR, LTIFR) di dashboard.
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Users size={14} className="text-slate-400" />
                Jumlah Karyawan
              </label>
              <Input
                type="number"
                value={totalKaryawan}
                onChange={(e) => setTotalKaryawan(Number(e.target.value) || 0)}
                min={1}
                className="h-11 text-lg font-semibold"
              />
              <p className="text-[11px] text-slate-400">
                Termasuk karyawan tetap & outsourcing
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                Jam Kerja per Hari
              </label>
              <Input
                type="number"
                value={jamPerHari}
                onChange={(e) => setJamPerHari(Number(e.target.value) || 0)}
                min={1}
                max={24}
                className="h-11 text-lg font-semibold"
              />
              <p className="text-[11px] text-slate-400">Standar: 8 jam/hari</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                Hari Kerja per Bulan
              </label>
              <Input
                type="number"
                value={hariPerBulan}
                onChange={(e) => setHariPerBulan(Number(e.target.value) || 0)}
                min={1}
                max={31}
                className="h-11 text-lg font-semibold"
              />
              <p className="text-[11px] text-slate-400">
                Bisa disesuaikan (shift, weekends)
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-400" />
                Jumlah Fatality
              </label>
              <Input
                type="number"
                value={jumlahFatality}
                onChange={(e) => setJumlahFatality(Number(e.target.value) || 0)}
                min={0}
                className="h-11 text-lg font-semibold"
              />
              <p className="text-[11px] text-slate-400">
                Status otomatis:{" "}
                <strong
                  className={
                    jumlahFatality > 0 ? "text-rose-600" : "text-emerald-600"
                  }
                >
                  {jumlahFatality > 0 ? "Ada" : "Tidak Ada"}
                </strong>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" />
                Jam Kerja Aman (Tanpa Kecelakaan)
              </label>
              <Input
                type="number"
                value={jamKerjaTanpaKecelakaan}
                onChange={(e) =>
                  setJamKerjaTanpaKecelakaan(Number(e.target.value) || 0)
                }
                min={0}
                className="h-11 text-lg font-semibold text-emerald-700"
              />
              <p className="text-[11px] text-slate-400">
                Tampil di banner dashboard utama
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle
              size={16}
              className="text-amber-500 mt-0.5 shrink-0"
            />
            <div className="text-xs text-amber-700 space-y-1">
              <p className="font-semibold">Catatan Penting</p>
              <p>
                Perubahan nilai ini akan langsung mempengaruhi perhitungan
                metrik K3 di dashboard HSE Command Center (NMRR, SOR, TRIR,
                LTIFR).
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 px-6 h-10"
            >
              <Save size={15} />
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog: Tambah Slide Banner */}
      <Dialog open={isAddSlideOpen} onOpenChange={setIsAddSlideOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload size={18} className="text-blue-600" />
              Tambah Slide Banner Baru
            </DialogTitle>
            <DialogDescription>
              Upload file gambar dan isi detail keterangan untuk ditambahkan ke slideshow banner.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-3">
            {/* Image Upload Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Pilih File Gambar
              </label>
              
              {newSlidePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-[4/3]">
                  <img
                    src={newSlidePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNewSlideFile(null);
                      URL.revokeObjectURL(newSlidePreview);
                      setNewSlidePreview("");
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => document.getElementById("slide-file-input").click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100/50 hover:border-slate-300 transition-all cursor-pointer"
                >
                  <Upload size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-600 font-medium">Klik untuk memilih gambar</p>
                  <p className="text-[10px] text-slate-400 mt-1">Format: JPG, PNG, WEBP (Maks. 2MB)</p>
                  <input
                    id="slide-file-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error("Ukuran file maksimal 2MB");
                          return;
                        }
                        setNewSlideFile(file);
                        setNewSlidePreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Input Keterangan */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Judul Slide (maks. 50 karakter)
              </label>
              <Input
                type="text"
                value={newSlideTitle}
                onChange={(e) => setNewSlideTitle(e.target.value.slice(0, 50))}
                placeholder="cth. Safety Briefing Harian"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Subtitle Slide (maks. 80 karakter)
              </label>
              <Input
                type="text"
                value={newSlideSubtitle}
                onChange={(e) => setNewSlideSubtitle(e.target.value.slice(0, 80))}
                placeholder="cth. Komitmen keselamatan dimulai dari awal hari kerja"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setNewSlideTitle("");
                setNewSlideSubtitle("");
                setNewSlideFile(null);
                if (newSlidePreview) URL.revokeObjectURL(newSlidePreview);
                setNewSlidePreview("");
                setIsAddSlideOpen(false);
              }}
              disabled={uploadingSlide}
            >
              Batal
            </Button>
            <Button
              onClick={handleAddSlide}
              disabled={uploadingSlide || !newSlideFile || !newSlideTitle}
              className="gap-2"
            >
              {uploadingSlide ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Plus size={15} />
                  Tambah Slide
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
