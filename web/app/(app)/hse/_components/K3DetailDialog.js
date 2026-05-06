'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  User, 
  Calendar, 
  AlertTriangle, 
  Eye, 
  CheckCircle2, 
  Clock,
  ShieldCheck,
  ClipboardCheck
} from "lucide-react";

const STATUS_CONFIG = {
  menunggu_review_kadiv_pelapor: { label: 'Review Pelapor', color: 'bg-amber-100 text-amber-700' },
  menunggu_review_kadiv_pphse: { label: 'Review Kadiv', color: 'bg-amber-100 text-amber-700' },
  menunggu_validasi_kadiv_pphse: { label: 'Validasi PPHSE', color: 'bg-blue-100 text-blue-700' },
  menunggu_validasi_kadis_hse: { label: 'Validasi HSE', color: 'bg-amber-100 text-amber-700' },
  menunggu_tindakan_hse: { label: 'Tindakan HSE', color: 'bg-blue-100 text-blue-700' },
  menunggu_verifikasi_investigasi: { label: 'Verifikasi Investigasi', color: 'bg-indigo-100 text-indigo-700' },
  menunggu_validasi_kadiv: { label: 'Validasi Kadiv', color: 'bg-purple-100 text-purple-700' },
  menunggu_validasi_hasil_kadis_hse: { label: 'Validasi Hasil', color: 'bg-indigo-100 text-indigo-700' },
  menunggu_validasi_akhir_kadiv_pphse: { label: 'Verifikasi Akhir', color: 'bg-purple-100 text-purple-700' },
  selesai: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
  disetujui: { label: 'Disetujui', color: 'bg-emerald-100 text-emerald-700' },
  ditolak: { label: 'Ditolak', color: 'bg-rose-100 text-rose-700' },
  ditolak_kadiv_pphse: { label: 'Ditolak Kadiv', color: 'bg-rose-100 text-rose-700' },
  ditolak_kadis_hse: { label: 'Ditolak HSE', color: 'bg-rose-100 text-rose-700' },
  investigasi_ditolak_kadis_hse: { label: 'Investigasi Ditolak', color: 'bg-rose-100 text-rose-700' },
  investigasi_ditolak_kadiv: { label: 'Investigasi Ditolak', color: 'bg-rose-100 text-rose-700' },
  perbaikan_ditolak_pphse: { label: 'Perbaikan Ditolak', color: 'bg-rose-100 text-rose-700' },
};

function formatStatus(status) {
  if (!status) return { label: '-', color: 'bg-slate-100 text-slate-600' };
  const config = STATUS_CONFIG[status];
  if (config) return config;
  
  const label = status.replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace('Hse', 'HSE')
    .replace('Pphse', 'PPHSE');
    
  return { label, color: 'bg-slate-100 text-slate-600' };
}

export function K3DetailDialog({ report, open, onOpenChange }) {
  if (!report) return null;

  const status = formatStatus(report.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        {/* Header - Fixed */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-50 bg-white">
          <div className="flex items-center gap-2 text-rose-600 mb-1">
            <ShieldCheck size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">K3 Safety Inspection</span>
          </div>
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Detail Laporan Temuan</DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-500">
            {report.reportNumber} • Dilaporkan pada {report.createdAt ? new Date(report.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
          </DialogDescription>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-6">
          {/* Header Info */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 font-black shadow-sm flex-shrink-0">
                {report.pelapor?.name ? report.pelapor.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div>
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">{report.kategori}</p>
                <p className="text-sm font-bold text-slate-900">{report.pelapor?.name || 'Anonim'}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 uppercase tracking-wider font-bold opacity-70">
                  {report.pelapor?.role || '-'} • {report.pelapor?.divisi || '-'}
                </p>
              </div>
            </div>
            <Badge className={cn("border-none px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm", status.color)}>
              {status.label}
            </Badge>
          </div>

          {/* Deskripsi */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <ClipboardCheck size={14} />
              <h4 className="text-[10px] font-black uppercase tracking-widest">Deskripsi Temuan</h4>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium pl-2 italic">
                "{report.deskripsi}"
              </p>
            </div>
          </div>

          {/* Lokasi (jika ada) */}
          {report.lokasi && (
             <div className="grid grid-cols-1 gap-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi Temuan</h4>
                <p className="text-sm font-bold text-slate-700">{report.lokasi}</p>
             </div>
          )}

          {/* Dokumentasi Laporan Awal */}
          {report.foto && report.foto.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Eye size={14} />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Dokumentasi Visual</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {report.foto.map((f, i) => (
                  <div key={i} className="group relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm aspect-video bg-slate-100">
                    <img 
                      src={`${process.env.NEXT_PUBLIC_API_URL}/${f}`} 
                      alt={`Foto Temuan ${i+1}`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-300"></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hasil Perbaikan (Jika Ada) */}
          {(report.tindakanPerbaikan || (report.fotoPerbaikan && report.fotoPerbaikan.length > 0)) && (
            <div className="space-y-4 pt-4 border-t border-slate-100 mt-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={16} />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Tindakan Perbaikan</h4>
              </div>
              
              {report.tindakanPerbaikan && (
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                  <p className="text-sm text-slate-700 leading-relaxed font-bold pl-2">
                    {report.tindakanPerbaikan}
                  </p>
                </div>
              )}

              {report.fotoPerbaikan && report.fotoPerbaikan.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {report.fotoPerbaikan.map((f, i) => (
                    <div key={i} className="group relative rounded-2xl overflow-hidden border border-emerald-100 shadow-sm aspect-video bg-emerald-50/30">
                      <img 
                        src={`${process.env.NEXT_PUBLIC_API_URL}/${f}`} 
                        alt={`Foto Perbaikan ${i+1}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-emerald-900/5 group-hover:bg-transparent transition-colors duration-300"></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Catatan Validasi (Jika Ada) */}
          {report.catatanKadivPphse && (
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Catatan Validasi</h4>
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
                <p className="text-sm text-rose-700 leading-relaxed pl-2 font-black">
                  "{report.catatanKadivPphse}"
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-10 pt-6 pb-10 flex items-center justify-end bg-slate-50/50">
          <Button 
            variant="outline"
            className="px-8 font-bold rounded-xl border-slate-200 bg-white hover:bg-slate-50 hover:text-rose-600 transition-all shadow-sm"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
