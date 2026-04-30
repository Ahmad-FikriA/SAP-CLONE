'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  LayoutDashboard, 
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  User,
  Calendar,
  Eye,
  Activity,
  Zap,
  Award,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  ClipboardCheck,
  AlertOctagon,
  HeartPulse,
  Flame,
  Stethoscope,
  Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'active', label: 'Laporan Aktif', icon: Activity },
  { key: 'history', label: 'Riwayat', icon: CheckCircle2 },
];

const METRICS = [
  { 
    id: 'nmrr', 
    title: 'NMRR', 
    subtitle: 'Near Miss Reporting Rate', 
    value: '12.5%', 
    icon: AlertTriangle, 
    color: 'bg-blue-500', 
    light: 'bg-blue-50',
    text: 'text-blue-600'
  },
  { 
    id: 'sor', 
    title: 'SOR', 
    subtitle: 'Safety Observation Rate', 
    value: '45.2%', 
    icon: Eye, 
    color: 'bg-emerald-500', 
    light: 'bg-emerald-50',
    text: 'text-emerald-600'
  },
  { 
    id: 'cacr', 
    title: 'CACR', 
    subtitle: 'Corrective Action Closure', 
    value: '88.0%', 
    icon: ClipboardCheck, 
    color: 'bg-violet-500', 
    light: 'bg-violet-50',
    text: 'text-violet-600'
  },
  { 
    id: 'trir', 
    title: 'TRIR', 
    subtitle: 'Total Recordable Incident Rate', 
    value: '0.42', 
    icon: HeartPulse, 
    color: 'bg-amber-500', 
    light: 'bg-amber-50',
    text: 'text-amber-600'
  },
  { 
    id: 'ltifr', 
    title: 'LTIFR', 
    subtitle: 'Loss Time Injury Frequency', 
    value: '0.00', 
    icon: Stethoscope, 
    color: 'bg-indigo-500', 
    light: 'bg-indigo-50',
    text: 'text-indigo-600'
  },
  { 
    id: 'fatality', 
    title: 'Fatality Rate', 
    subtitle: 'Kematian Akibat Kerja', 
    value: '0', 
    icon: AlertOctagon, 
    color: 'bg-rose-500', 
    light: 'bg-rose-50',
    text: 'text-rose-600'
  },
];

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
  
  // Fallback formatting
  const label = status.replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace('Hse', 'HSE')
    .replace('Pphse', 'PPHSE');
    
  return { label, color: 'bg-slate-100 text-slate-600' };
}

export default function HseDashboardPage() {
  const [tab, setTab] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedReport, setSelectedReport] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationAction, setValidationAction] = useState(null);
  const [staffList, setStaffList] = useState([]);
  
  const [jenisTindakan, setJenisTindakan] = useState('perbaikan_langsung');
  const [assignedTo, setAssignedTo] = useState('');
  const [catatanValidasi, setCatatanValidasi] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = getUser();
  const role = (currentUser?.role || '').toLowerCase();
  const divisi = (currentUser?.divisi || '').toLowerCase();
  
  const isKadisHse = (role.includes('kadis') || role.includes('kepala dinas')) && (divisi.includes('pphse') || divisi.includes('hse'));
  const isKadivPphse = (role.includes('kadiv') || role.includes('kepala divisi')) && (divisi.includes('pphse') || divisi.includes('hse'));

  const openDetail = (report) => {
    setSelectedReport(report);
    setJenisTindakan('perbaikan_langsung');
    setAssignedTo('');
    setCatatanValidasi('');
    setIsDetailOpen(true);
  };

  const openValidation = (action) => {
    setValidationAction(action);
    setIsValidationOpen(true);
  };

  const submitValidation = async () => {
    if (!selectedReport || !validationAction) return;
    
    setIsSubmitting(true);
    try {
      if (selectedReport.status === 'menunggu_validasi_kadis_hse' || selectedReport.status === 'menunggu_validasi_kadiv_pphse') {
        if (validationAction === 'approve' && !assignedTo) {
          toast.error("Silakan pilih staf yang ditugaskan");
          setIsSubmitting(false);
          return;
        }
        await apiPut(`/k3-safety/${selectedReport.id}/validasi-awal`, {
          action: validationAction,
          catatanValidasi,
          assignedTo,
          jenisTindakan
        });
      } else if (selectedReport.status === 'menunggu_validasi_akhir_kadiv_pphse') {
        await apiPut(`/k3-safety/${selectedReport.id}/validasi-akhir`, {
          action: validationAction,
          catatan: catatanValidasi
        });
      } else if (selectedReport.status === 'menunggu_validasi_hasil_kadis_hse') {
        await apiPut(`/k3-safety/${selectedReport.id}/validasi-hasil`, {
          action: validationAction,
          catatan: catatanValidasi
        });
      } else if (selectedReport.status === 'menunggu_verifikasi_investigasi') {
        await apiPut(`/k3-safety/${selectedReport.id}/verifikasi-investigasi`, {
          action: validationAction,
          catatan: catatanValidasi
        });
      } else if (selectedReport.status === 'menunggu_validasi_kadiv') {
        await apiPut(`/k3-safety/${selectedReport.id}/validasi-investigasi-kadiv`, {
          action: validationAction,
          kadivType: 'pphse',
          catatan: catatanValidasi
        });
      }
      
      toast.success(`Laporan berhasil di${validationAction === 'approve' ? 'setujui' : 'tolak'}`);
      setIsValidationOpen(false);
      setIsDetailOpen(false);
      loadReports();
    } catch (e) {
      toast.error(e.message || "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  async function loadReports() {
    setLoading(true);
    try {
      const res = await apiGet('/k3-safety');
      setReports(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadStaff() {
    try {
      const res = await apiGet('/users');
      const usersArray = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : []);
      const hseStaff = usersArray.filter(u => 
        u.dinas?.toLowerCase().includes('hse') && 
        !u.role?.toLowerCase().includes('kadis') &&
        !u.role?.toLowerCase().includes('kadiv')
      );
      setStaffList(hseStaff);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadReports();
    loadStaff();
  }, []);

  const filteredReports = reports.filter(r => {
    const matchesSearch = 
      r.reportNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.kategori?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (tab === 'active') return matchesSearch && r.status !== 'selesai' && !r.status.includes('ditolak');
    if (tab === 'history') return matchesSearch && (r.status === 'selesai' || r.status.includes('ditolak'));
    return matchesSearch;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-600 rounded-xl shadow-lg shadow-rose-200">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              HSE Command Center
            </h2>
          </div>
          <p className="text-slate-500 text-sm ml-12">
            Monitoring kinerja K3 dan manajemen insiden secara real-time.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={loadReports} 
            disabled={loading}
            className="bg-white shadow-sm"
          >
            <RefreshCw size={16} className={cn("mr-2", loading && "animate-spin")} />
            Segarkan
          </Button>
          <Button className="bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-100">
            Export Report
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 text-sm font-semibold transition-all rounded-xl",
                isActive 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon size={16} className={isActive ? "text-rose-600" : "text-slate-400"} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Performance Banner */}
          <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-2xl">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="mb-4 bg-rose-500/20 text-rose-300 border-none px-3 py-1 text-[10px] uppercase tracking-widest font-bold">
                  HSE Performance
                </Badge>
                <h1 className="text-3xl md:text-4xl font-extrabold mb-4 tracking-tight leading-tight">
                  Zero Accident Strategy <br />
                  <span className="text-rose-500">Safety First, Always.</span>
                </h1>
                <p className="text-slate-400 text-sm md:text-base max-w-md leading-relaxed mb-8">
                  Data kinerja keselamatan kerja yang diagregasi berdasarkan standar formulasi pelaporan insiden internasional.
                </p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-bold text-white">284</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Hari Tanpa Insiden</p>
                  </div>
                  <div className="w-px h-10 bg-slate-800" />
                  <div>
                    <p className="text-2xl font-bold text-rose-500">98%</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Kepatuhan Prosedur</p>
                  </div>
                </div>
              </div>
              <div className="hidden md:flex justify-end">
                <div className="w-64 h-64 bg-rose-600/10 rounded-full flex items-center justify-center relative">
                   <div className="absolute inset-0 animate-pulse bg-rose-500/20 rounded-full blur-3xl" />
                   <TrendingUp size={120} className="text-rose-500 relative z-10" />
                </div>
              </div>
            </div>
            
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 blur-[100px] -mr-48 -mt-48 rounded-full" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[100px] -ml-32 -mb-32 rounded-full" />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {METRICS.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.id} className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div className={cn("p-3 rounded-2xl transition-colors", m.light)}>
                      <Icon size={24} className={m.text} />
                    </div>
                    <p className={cn("text-xs font-bold uppercase tracking-widest", m.text)}>{m.id}</p>
                  </div>
                  <div>
                    <p className="text-3xl font-black text-slate-900 mb-1">{m.value}</p>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{m.subtitle}</p>
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <TrendingUp size={10} className="text-emerald-500" /> +2.4% vs last month
                    </span>
                    <button className="text-slate-400 hover:text-rose-600 transition-colors">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(tab === 'active' || tab === 'history') && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input 
                placeholder="Cari nomor laporan, kategori, atau deskripsi..." 
                className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="rounded-xl h-11 px-4">
                <Filter size={16} className="mr-2" /> Filter
              </Button>
              <Button variant="outline" className="rounded-xl h-11 px-4">
                <Calendar size={16} className="mr-2" /> Semua Waktu
              </Button>
            </div>
          </div>

          {/* Reports Grid */}
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <RefreshCw className="animate-spin text-rose-600" size={32} />
              <p className="text-slate-500 font-medium">Memuat data laporan...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-white py-20 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <FileText size={40} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Tidak Ada Data</h3>
              <p className="text-slate-500 max-w-sm text-sm">
                Belum ada data laporan K3 yang ditemukan untuk kriteria ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredReports.map((report) => {
                const status = formatStatus(report.status);
                const hasPhotos = report.foto && report.foto.length > 0;
                
                return (
                  <div 
                    key={report.id} 
                    className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-rose-100 transition-all duration-300 flex flex-col"
                  >
                    <div className="p-6 space-y-5 flex-1">
                      {/* Header Card */}
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">
                            {report.kategori || 'K3 INCIDENT'}
                          </p>
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            {report.reportNumber}
                            <ExternalLink size={12} className="text-slate-300 group-hover:text-rose-500 transition-colors" />
                          </h3>
                        </div>
                        <Badge className={cn("border-none px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg", status.color)}>
                          {status.label}
                        </Badge>
                      </div>

                      {/* Content */}
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-100 group-hover:border-rose-100 transition-colors">
                          {hasPhotos ? (
                            <img 
                              src={`${process.env.NEXT_PUBLIC_API_URL}/${report.foto[0]}`} 
                              alt="K3 Report" 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileText size={24} className="text-slate-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed italic">
                            "{report.deskripsi || 'Tidak ada deskripsi'}"
                          </p>
                          <div className="mt-3 flex flex-wrap gap-y-2 gap-x-4 items-center">
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                              <User size={12} className="text-slate-300" />
                              {report.pelapor?.name || 'Unknown'}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                              <Calendar size={12} className="text-slate-300" />
                              {report.createdAt ? new Date(report.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Task Info */}
                      {report.petugasHse && (
                        <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50 flex items-center gap-3">
                           <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                              <Wrench size={14} />
                           </div>
                           <div className="min-w-0">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Ditugaskan</p>
                              <p className="text-xs font-bold text-slate-700 truncate">{report.petugasHse.name}</p>
                           </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Card */}
                    <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center group-hover:bg-rose-50/20 transition-colors">
                      <p className="text-[10px] font-bold text-slate-400">Terakhir Update: {report.updatedAt ? new Date(report.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(report)} className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs gap-2">
                        Detail Laporan <ChevronRight size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail & Action Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Laporan K3</DialogTitle>
            <DialogDescription>
              {selectedReport?.reportNumber} - Dilaporkan pada {selectedReport?.createdAt ? new Date(selectedReport.createdAt).toLocaleDateString('id-ID') : '-'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-6 py-4">
              {/* Header Info */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold flex-shrink-0">
                    {selectedReport.pelapor?.name ? selectedReport.pelapor.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-1">{selectedReport.kategori}</p>
                    <p className="text-sm font-bold text-slate-900">{selectedReport.pelapor?.name || 'Unknown'}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 uppercase tracking-wider font-medium">
                      {selectedReport.pelapor?.role || '-'} • {selectedReport.pelapor?.dinas || '-'} • {selectedReport.pelapor?.divisi || '-'}
                    </p>
                  </div>
                </div>
                <Badge className={cn("border-none px-3 py-1 text-xs", formatStatus(selectedReport.status).color)}>
                  {formatStatus(selectedReport.status).label}
                </Badge>
              </div>

              {/* Deskripsi */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deskripsi Laporan</h4>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                  <p className="text-sm text-slate-700 leading-relaxed pl-2">
                    "{selectedReport.deskripsi}"
                  </p>
                </div>
              </div>

              {/* Dokumentasi Laporan Awal */}
              {selectedReport.foto && selectedReport.foto.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Foto Temuan Awal</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedReport.foto.map((f, i) => (
                      <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                        <img 
                          src={`${process.env.NEXT_PUBLIC_API_URL}/${f}`} 
                          alt={`Foto Awal ${i+1}`} 
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300"></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hasil Perbaikan (Jika Ada) */}
              {(selectedReport.tindakanPerbaikan || (selectedReport.fotoPerbaikan && selectedReport.fotoPerbaikan.length > 0)) && (
                <div className="space-y-4 pt-4 border-t border-slate-100 mt-4">
                  <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Hasil Perbaikan / Tindakan</h4>
                  
                  {selectedReport.tindakanPerbaikan && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                      <p className="text-sm text-slate-700 leading-relaxed pl-2">
                        "{selectedReport.tindakanPerbaikan}"
                      </p>
                    </div>
                  )}

                  {selectedReport.fotoPerbaikan && selectedReport.fotoPerbaikan.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      {selectedReport.fotoPerbaikan.map((f, i) => (
                        <div key={i} className="group relative rounded-xl overflow-hidden border border-emerald-200 shadow-sm">
                          <img 
                            src={`${process.env.NEXT_PUBLIC_API_URL}/${f}`} 
                            alt={`Foto Perbaikan ${i+1}`} 
                            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                          <div className="absolute inset-0 bg-emerald-900/10 group-hover:bg-transparent transition-colors duration-300"></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Catatan Penolakan / Validasi */}
              {selectedReport.catatanKadivPphse && (
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider">Catatan Validasi / Penolakan</h4>
                  <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                    <p className="text-sm text-rose-700 leading-relaxed pl-2 font-medium">
                      "{selectedReport.catatanKadivPphse}"
                    </p>
                  </div>
                </div>
              )}

              {/* Form Validasi dihapus dari sini dan dipindahkan ke Dialog terpisah */}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Tutup
            </Button>
            
            {/* Action Buttons for Validasi Awal */}
            {(isKadisHse || isKadivPphse) && (selectedReport?.status === 'menunggu_validasi_kadis_hse' || selectedReport?.status === 'menunggu_validasi_kadiv_pphse') && (
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  onClick={() => openValidation('reject')} 
                >
                  Tolak Laporan
                </Button>
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                  onClick={() => openValidation('approve')} 
                >
                  Setujui & Tugaskan
                </Button>
              </div>
            )}

            {/* Action Buttons for Validasi Hasil Perbaikan & Investigasi (Kadis HSE) */}
            {isKadisHse && (selectedReport?.status === 'menunggu_validasi_hasil_kadis_hse' || selectedReport?.status === 'menunggu_verifikasi_investigasi') && (
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  onClick={() => openValidation('reject')} 
                >
                  Tolak Hasil
                </Button>
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                  onClick={() => openValidation('approve')} 
                >
                  Terima & Validasi
                </Button>
              </div>
            )}

            {/* Action Buttons for Validasi Akhir (Kadiv PPHSE) */}
            {isKadivPphse && (selectedReport?.status === 'menunggu_validasi_akhir_kadiv_pphse' || selectedReport?.status === 'menunggu_validasi_kadiv') && (
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  onClick={() => openValidation('reject')} 
                >
                  Tolak
                </Button>
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                  onClick={() => openValidation('approve')} 
                >
                  Setujui Selesai
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Dialog (Nested/Secondary Popup) */}
      <Dialog open={isValidationOpen} onOpenChange={setIsValidationOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className={validationAction === 'approve' ? "text-emerald-700" : "text-rose-700"}>
            <DialogTitle>{validationAction === 'approve' ? 'Setujui Laporan' : 'Tolak Laporan'}</DialogTitle>
            <DialogDescription>
              {validationAction === 'approve' 
                ? 'Pilih tindak lanjut dan tugaskan staf untuk menyelesaikan masalah ini.' 
                : 'Berikan alasan mengapa laporan ini ditolak.'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-5">
            {validationAction === 'approve' && (selectedReport?.status === 'menunggu_validasi_kadis_hse' || selectedReport?.status === 'menunggu_validasi_kadiv_pphse') && (
              <>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Jenis Tindakan</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={cn(
                      "cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center text-center gap-2",
                      jenisTindakan === 'perbaikan_langsung' ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-200 hover:bg-slate-50"
                    )}>
                      <input 
                        type="radio" 
                        className="sr-only" 
                        name="jenisTindakan" 
                        value="perbaikan_langsung" 
                        checked={jenisTindakan === 'perbaikan_langsung'} 
                        onChange={(e) => setJenisTindakan(e.target.value)} 
                      />
                      <ShieldCheck size={28} className={jenisTindakan === 'perbaikan_langsung' ? "text-emerald-600" : "text-slate-400"} />
                      <span className={cn("text-xs font-bold", jenisTindakan === 'perbaikan_langsung' ? "text-emerald-700" : "text-slate-600")}>Perbaikan<br/>Langsung</span>
                    </label>
                    <label className={cn(
                      "cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center text-center gap-2",
                      jenisTindakan === 'investigasi' ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-amber-200 hover:bg-slate-50"
                    )}>
                      <input 
                        type="radio" 
                        className="sr-only" 
                        name="jenisTindakan" 
                        value="investigasi" 
                        checked={jenisTindakan === 'investigasi'} 
                        onChange={(e) => setJenisTindakan(e.target.value)} 
                      />
                      <Search size={28} className={jenisTindakan === 'investigasi' ? "text-amber-600" : "text-slate-400"} />
                      <span className={cn("text-xs font-bold", jenisTindakan === 'investigasi' ? "text-amber-700" : "text-slate-600")}>Investigasi<br/>Lanjut</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tugaskan Ke (Staf HSE)</label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger className="w-full h-12 rounded-xl">
                      <SelectValue placeholder="Pilih staf yang bertugas..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map(staff => (
                        <SelectItem key={staff.id} value={staff.id}>{staff.name} - {staff.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {validationAction === 'reject' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Catatan (Wajib)
                </label>
                <textarea
                  value={catatanValidasi}
                  onChange={(e) => setCatatanValidasi(e.target.value)}
                  placeholder="Masukkan alasan penolakan laporan..."
                  className="w-full h-28 p-4 rounded-xl border border-slate-200 text-sm transition-all focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-slate-50 focus:bg-white"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4 border-slate-100">
            <Button variant="ghost" onClick={() => setIsValidationOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button 
              className={cn(
                "text-white",
                validationAction === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
              )}
              onClick={submitValidation}
              disabled={isSubmitting || (validationAction === 'approve' && !assignedTo && selectedReport?.status !== 'menunggu_validasi_akhir_kadiv_pphse') || (validationAction === 'reject' && !catatanValidasi.trim())}
            >
              {isSubmitting ? 'Memproses...' : 'Konfirmasi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
