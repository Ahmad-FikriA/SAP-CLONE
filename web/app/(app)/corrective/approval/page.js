'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  RefreshCw, CheckCircle, Clock, ChevronRight, ImageIcon, X, XCircle, 
  Search, ShieldAlert, CheckSquare, Wrench, AlertTriangle, Eye, ShieldCheck,
  User as UserIcon, Calendar, Package, Cpu, Lightbulb, ClipboardCheck
} from 'lucide-react';
import { cn, getMediaUrl } from '@/lib/utils';
import { useCorrective } from '../_hooks/useCorrective';
import { SAP_STATUS_COLORS, SAP_STATUS_LABELS, SAP_SPK_STEPS } from '../_components/constants';
import { CorrectiveStatusBadge } from '../_components/ui-primitives';

// Helper for formatting actual vs planned times
function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

export default function CorrectiveApprovalPage() {
  const [user, setUser] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedSpk, setSelectedSpk] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('pending'); // 'pending' | 'approved' | 'rejected'
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [userMap, setUserMap] = useState({});

  const data = useCorrective();
  const {
    spks,
    history,
    equipment,
    functionalLocations,
    loading,
    loadAll,
    approveKadisPpAction,
    rejectKadisPpAction,
    approveKadisPelaporAction,
    rejectKadisPelaporAction,
  } = data;

  useEffect(() => {
    setIsMounted(true);
    setUser(getUser());
    
    // Load users map for human readable names
    apiGet('/users')
      .then(users => {
        setUserMap(Object.fromEntries(users.map(u => [u.id, u.name || u.nik])));
      })
      .catch(() => {});
  }, []);

  // Strict Kadis PP indicator
  const isKadisPp = useMemo(() => {
    if (!user) return false;
    return user.role === 'admin' || 
      (user.role === 'kadis' && user.dinas?.toLowerCase().includes('pusat perawatan'));
  }, [user]);

  // Discipline mapping for Kasie work center filter
  const kasiePrefixes = useMemo(() => {
    if (!user || user.role !== 'kasie' || !user.group) return [];
    const prefixes = [];
    const grp = user.group;
    if (grp.includes('Elektrik')) prefixes.push('E');
    if (grp.includes('Otomasi')) prefixes.push('O');
    if (grp.includes('Mekanik')) prefixes.push('M');
    if (grp.includes('Sipil')) prefixes.push('S');
    return prefixes;
  }, [user]);

  // Main filter function based on roles & discipline
  const filteredList = useMemo(() => {
    if (!user) return [];
    
    // 1. Get raw list based on view mode (pending vs historical)
    let rawList = [];
    if (viewMode === 'pending') {
      rawList = spks.filter(s => 
        s.status === 'menunggu_review_kadis_pp' || 
        s.status === 'menunggu_review_kadis_pelapor'
      );
    } else if (viewMode === 'rejected') {
      rawList = history.filter(s => s.status === 'ditolak');
    }

    // 2. Filter by search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      rawList = rawList.filter(s => 
        s.order_number?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.short_text?.toLowerCase().includes(q) ||
        s.equipment_name?.toLowerCase().includes(q)
      );
    }

    // 3. Strict targeted filtering
    if (user.role === 'admin') {
      // Admins see everything
      return rawList;
    }

    if (user.role === 'kadis') {
      if (isKadisPp) {
        // Kadis PP: Awaiting review Kadis PP (in pending)
        if (viewMode === 'pending') {
          return rawList.filter(s => s.status === 'menunggu_review_kadis_pp');
        }
        return rawList; // historical Kadis PP sees everything completed/rejected
      } else {
        // Kadis Pelapor: Awaiting review Kadis Pelapor reported by them
        return rawList.filter(s => s.notification?.kadisPelaporId === user.id);
      }
    }

    if (user.role === 'kasie') {
      // Kasie: Read-only, only see SPKs belonging to their work center group
      if (kasiePrefixes.length > 0) {
        return rawList.filter(s => {
          const wcPrefix = (s.work_center || '').split('-')[0]?.charAt(0)?.toUpperCase();
          return kasiePrefixes.includes(wcPrefix);
        });
      }
      return []; // no group assigned, see nothing
    }

    if (user.role === 'kadiv') {
      // Kadiv: Read-only, sees everything
      return rawList;
    }

    // Default other roles (teknisi, petugas): Read-only, see everything
    return rawList;
  }, [spks, history, viewMode, searchQuery, user, isKadisPp, kasiePrefixes]);

  // Determine if current user can approve/reject the selected SPK
  const isApprover = useMemo(() => {
    if (!user || !selectedSpk) return false;
    if (user.role === 'admin') return true;
    
    if (selectedSpk.status === 'menunggu_review_kadis_pp' && isKadisPp) {
      return true;
    }

    if (
      selectedSpk.status === 'menunggu_review_kadis_pelapor' &&
      (user.role === 'kadis' && selectedSpk.notification?.kadisPelaporId === user.id)
    ) {
      return true;
    }

    return false;
  }, [user, selectedSpk, isKadisPp]);

  // Select list item handler
  const handleSelect = (spk) => {
    setSelectedSpk(spk);
  };

  // Approval handler
  const handleApprove = async () => {
    if (!selectedSpk) return;
    setApproving(true);
    try {
      if (selectedSpk.status === 'menunggu_review_kadis_pp') {
        await approveKadisPpAction(selectedSpk.order_number);
        toast.success('SPK Berhasil Disetujui (Kadis PP)');
      } else if (selectedSpk.status === 'menunggu_review_kadis_pelapor') {
        await approveKadisPelaporAction(selectedSpk.order_number);
        toast.success('SPK Berhasil Disetujui Selesai (Kadis Pelapor)');
      }
      setConfirmOpen(false);
      setSelectedSpk(null);
      await loadAll();
    } catch (e) {
      toast.error('Gagal menyetujui: ' + e.message);
    } finally {
      setApproving(false);
    }
  };

  // Rejection handler
  const handleReject = async () => {
    if (!selectedSpk) return;
    if (rejectionReason.trim().length < 10) {
      toast.error('Alasan penolakan minimal 10 karakter!');
      return;
    }
    setRejecting(true);
    try {
      if (selectedSpk.status === 'menunggu_review_kadis_pp') {
        await rejectKadisPpAction(selectedSpk.order_number, rejectionReason.trim());
        toast.success('Pekerjaan SPK Berhasil Ditolak ke Teknisi');
      } else if (selectedSpk.status === 'menunggu_review_kadis_pelapor') {
        await rejectKadisPelaporAction(selectedSpk.order_number, rejectionReason.trim());
        toast.success('Pekerjaan SPK Berhasil Ditolak ke Teknisi');
      }
      setRejectOpen(false);
      setRejectionReason('');
      setSelectedSpk(null);
      await loadAll();
    } catch (e) {
      toast.error('Gagal menolak: ' + e.message);
    } finally {
      setRejecting(false);
    }
  };

  // Count active items waiting specifically for the logged in Kadis (to show pulsing badge)
  const activeApprovalCount = useMemo(() => {
    if (!user || user.role === 'kasie' || user.role === 'kadiv' || user.role === 'teknisi' || user.role === 'petugas') return 0;
    return spks.filter(s => {
      if (user.role === 'admin') return s.status === 'menunggu_review_kadis_pp' || s.status === 'menunggu_review_kadis_pelapor';
      if (isKadisPp) return s.status === 'menunggu_review_kadis_pp';
      return s.status === 'menunggu_review_kadis_pelapor' && s.notification?.kadisPelaporId === user.id;
    }).length;
  }, [spks, user, isKadisPp]);

  if (!isMounted) return null;

  return (
    <div className="flex h-[calc(100vh-56px)] md:h-screen overflow-hidden bg-slate-50 text-slate-800">
      
      {/* ── Left Sidebar: SPK Lists ── */}
      <div className="w-96 shrink-0 border-r border-slate-200 flex flex-col bg-white shadow-md relative z-20">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-white flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-600 rounded-lg shadow-sm">
                <CheckSquare size={16} className="text-white" />
              </div>
              <h1 className="text-sm font-bold text-slate-800 tracking-tight uppercase">Persetujuan Corrective</h1>
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all border border-slate-200 bg-white"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
            </button>
          </div>
          
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari SPK, alat, deskripsi..."
              className="pl-9 bg-slate-50/50 border-slate-200 text-xs text-slate-800 focus-visible:ring-1 focus-visible:ring-blue-500/20 h-9"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-150 bg-slate-50/50 shrink-0 p-1.5 gap-1">
          {[
            { id: 'pending', label: 'Menunggu', badge: activeApprovalCount },
            { id: 'rejected', label: 'Ditolak' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setViewMode(t.id); setSelectedSpk(null); }}
              className={cn(
                'flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 relative',
                viewMode === t.id
                  ? 'text-slate-900 bg-white shadow-sm ring-1 ring-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
              )}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white custom-scrollbar">
          {loading ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2 text-xs">
              <RefreshCw className="animate-spin text-blue-600" size={24} />
              <span>Memuat data...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="p-3 bg-slate-50 rounded-full border border-slate-200">
                {viewMode === 'pending' ? <ShieldCheck className="text-slate-400" size={24} /> : <XCircle className="text-slate-400" size={24} />}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {viewMode === 'pending' ? 'Tidak ada antrean persetujuan' : viewMode === 'approved' ? 'Belum ada riwayat disetujui' : 'Tidak ada riwayat ditolak'}
              </p>
            </div>
          ) : (
            filteredList.map((spk) => {
              const isNeedReviewPp = spk.status === 'menunggu_review_kadis_pp';
              const isNeedReviewPelapor = spk.status === 'menunggu_review_kadis_pelapor';
              const active = selectedSpk?.order_number === spk.order_number;
              
              // Resolve matching name
              const wcPrefix = (spk.work_center || '').split('-')[0]?.charAt(0)?.toUpperCase();
              const categoryColorClass = 
                wcPrefix === 'E' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                wcPrefix === 'M' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                wcPrefix === 'S' ? 'bg-green-50 text-green-700 border-green-200' :
                'bg-purple-50 text-purple-700 border-purple-200';

              return (
                <button
                  key={spk.order_number}
                  onClick={() => handleSelect(spk)}
                  className={cn(
                    'w-full text-left px-4 py-3.5 hover:bg-slate-50/80 transition-all flex items-start gap-3 border-l-2 relative',
                    active
                      ? 'bg-slate-50 border-blue-600 shadow-sm'
                      : isNeedReviewPp && viewMode === 'pending'
                        ? 'border-amber-500 bg-amber-50/20 hover:bg-amber-50/40'
                        : isNeedReviewPelapor && viewMode === 'pending'
                          ? 'border-purple-500 bg-purple-50/20 hover:bg-purple-50/40'
                          : 'border-transparent hover:border-slate-200'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-mono font-bold text-slate-800 tracking-wider">
                        {spk.order_number}
                      </span>
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase", categoryColorClass)}>
                        {spk.work_center || 'CM'}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 truncate mb-1" title={spk.description}>
                      {spk.description || spk.short_text || '—'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mb-2">
                      {spk.equipment_name || 'No Equipment'}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <CorrectiveStatusBadge
                        value={spk.status}
                        colorMap={SAP_STATUS_COLORS}
                        labelMap={SAP_STATUS_LABELS}
                      />
                      <span className="text-[10px] text-slate-400 font-medium">
                        {spk.created_at ? fmtDate(spk.created_at) : '—'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-slate-300 mt-1 self-center" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Workspace: Detailed SPK view & Action Panel ── */}
      <div className="flex-1 flex flex-col bg-slate-50/60 overflow-y-auto relative z-10 custom-scrollbar">
        {!selectedSpk ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/20">
            <div className="max-w-md p-8 bg-white rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden flex flex-col items-center">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-5 shadow-inner">
                <ClipboardCheck className="text-blue-600 animate-pulse" size={40} />
              </div>
              <h2 className="text-base font-bold text-slate-800 mb-2">Workspace Persetujuan</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                Pilih salah satu Surat Perintah Kerja (SPK) Corrective dari daftar di panel kiri untuk melihat kelengkapan data aktual, foto dokumentasi, dan memproses persetujuan.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Action Bar Floating Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                  <h3 className="text-base font-extrabold font-mono text-slate-800 tracking-wider">SPK #{selectedSpk.order_number}</h3>
                  <CorrectiveStatusBadge
                    value={selectedSpk.status}
                    colorMap={SAP_STATUS_COLORS}
                    labelMap={SAP_STATUS_LABELS}
                  />
                </div>
                <p className="text-xs text-slate-500 font-medium">{selectedSpk.description || selectedSpk.short_text || '—'}</p>
              </div>

              {/* Action Buttons Panel */}
              <div className="flex items-center gap-2 shrink-0">
                {isApprover && viewMode === 'pending' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => { setRejectionReason(''); setRejectOpen(true); }}
                      disabled={approving || rejecting}
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs font-semibold h-9 px-4 rounded-xl transition-all"
                    >
                      <XCircle size={14} className="mr-1.5" />
                      Tolak
                    </Button>
                    <Button
                      onClick={() => setConfirmOpen(true)}
                      disabled={approving || rejecting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-9 px-4 rounded-xl shadow-md transition-all hover:shadow-emerald-950/20 border-none"
                    >
                      <CheckCircle size={14} className="mr-1.5" />
                      Setujui Selesai
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                    <ShieldAlert size={14} className="text-slate-400 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {viewMode !== 'pending' ? 'Riwayat' : 'Mode Lihat Saja'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Stepper Progress Visualizer */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Pipeline Alur Kerja SPK</div>
              <div className="flex items-center w-full relative max-w-2xl mx-auto flex-wrap gap-y-4">
                {SAP_SPK_STEPS.map((step, i) => {
                  const currentIdx = SAP_SPK_STEPS.findIndex(s => s.key === selectedSpk.status);
                  const done = i < currentIdx || selectedSpk.status === 'selesai';
                  const active = i === currentIdx && selectedSpk.status !== 'selesai';
                  return (
                    <div key={step.key} className="flex-1 relative flex flex-col items-center min-w-[70px]">
                      {i !== 0 && (
                        <div className={cn(
                          "absolute top-3.5 left-[-50%] w-full h-[2px] -z-10 transition-all duration-300",
                          done || active ? "bg-blue-500" : "bg-slate-100"
                        )} />
                      )}
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold ring-4 ring-white transition-all duration-300 z-10 shadow-sm",
                        done 
                          ? "bg-blue-600 text-white" 
                          : active 
                            ? "bg-blue-500 text-white ring-blue-100 animate-pulse border border-blue-600" 
                            : "bg-slate-50 text-slate-400 border border-slate-200"
                      )}>
                        {done ? <CheckCircle size={12} /> : i + 1}
                      </div>
                      <span className={cn(
                        "text-[9px] mt-2 font-bold text-center tracking-tight",
                        active ? "text-blue-600 font-extrabold" : done ? "text-slate-700" : "text-slate-400"
                      )}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Read-only Alert for non-kadis */}
            {!isApprover && viewMode === 'pending' && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-amber-800 font-bold text-xs">Akses Lihat Saja (Read-Only)</h4>
                  <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                    Anda melihat SPK ini sebagai peninjau ({user?.role === 'kasie' ? `Kasie ${user?.group || ''}` : user?.role}). Hanya Kepala Dinas (Kadis) target yang dituju yang dapat menyetujui atau menolak pekerjaan ini.
                  </p>
                </div>
              </div>
            )}

            {/* 3 Column Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Left Column: Lokasi & Peralatan */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3.5 pb-2 border-b border-slate-100 flex items-center gap-1.5">
                    <Wrench size={13} className="text-blue-600" /> Lokasi & Peralatan
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Nama Peralatan</span>
                      <span className="text-xs font-bold text-slate-800 block">{selectedSpk.equipment_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Lokasi Fungsional</span>
                      <span className="text-xs font-bold font-mono text-slate-700 block">{selectedSpk.functional_location || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Location SAP</span>
                      <span className="text-xs text-slate-600 block">{selectedSpk.location || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Cost Center</span>
                      <span className="text-xs text-slate-600 block">{selectedSpk.cost_center || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Column: Perencanaan SAP */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3.5 pb-2 border-b border-slate-100 flex items-center gap-1.5">
                    <Cpu size={13} className="text-indigo-600" /> Perencanaan SAP
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Estimasi Jam Kerja</span>
                      <span className="text-xs font-bold text-slate-800 block">
                        {selectedSpk.dur_plan || 0} {selectedSpk.normal_dur_un || 'Jam'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Jumlah Pekerja Rencana</span>
                      <span className="text-xs font-bold text-slate-800 block">
                        {selectedSpk.num_of_work || 0} Orang
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Control Key / Activity</span>
                      <span className="text-xs text-slate-600 block">{selectedSpk.ctrl_key || '—'} / {selectedSpk.activity || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Maint. Activ. Type</span>
                      <span className="text-xs text-slate-600 block">{selectedSpk.maint_activ_type || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Jadwal & Aktual SAP */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3.5 pb-2 border-b border-slate-100 flex items-center gap-1.5">
                    <Calendar size={13} className="text-purple-600" /> Jadwal & Aktual SAP
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Tgl Diminta Dikerjakan</span>
                      <span className="text-xs text-slate-800 font-medium block">
                        {selectedSpk.notification?.requiredStart || selectedSpk.notification?.requiredEnd
                          ? `${fmtDate(selectedSpk.notification.requiredStart)} s/d ${fmtDate(selectedSpk.notification.requiredEnd)}`
                          : '—'
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Waktu Eksekusi Mulai</span>
                      <span className="text-xs text-slate-700 block">
                        {selectedSpk.work_start ? fmtDate(selectedSpk.work_start) : '—'} &middot; {selectedSpk.start_time || ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Waktu Eksekusi Selesai</span>
                      <span className="text-xs text-slate-700 block">
                        {selectedSpk.work_finish ? fmtDate(selectedSpk.work_finish) : '—'} &middot; {selectedSpk.finish_time || ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Total Jam Aktual</span>
                      <span className="text-xs text-emerald-600 font-bold block">
                        {selectedSpk.total_actual_hour || selectedSpk.dur_act || 0} Jam (Aktual)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Grid: Pelapor vs Pelaksana */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Profile Card: Dilaporkan Oleh */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex gap-4 items-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <UserIcon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Dilaporkan Oleh (Kadis Pelapor)</span>
                  <p className="text-sm font-bold text-slate-800 truncate">{selectedSpk.notification?.kadisPelapor?.name || selectedSpk.report_by || '—'}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5 uppercase tracking-wider font-semibold">
                    {selectedSpk.notification?.kadisPelapor?.dinas || 'Kadis'} &middot; {selectedSpk.notification?.kadisPelapor?.divisi || 'PELAPOR'}
                  </p>
                </div>
              </div>

              {/* Profile Card: Tim Eksekutor */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex gap-4 items-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Wrench size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Tim Pelaksana Pekerjaan</span>
                  <p className="text-sm font-bold text-slate-800 truncate">{selectedSpk.executor?.name || selectedSpk.execution_name || '—'}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5 uppercase tracking-wider font-semibold">
                    NIK: {selectedSpk.execution_nik || '—'} &middot; {selectedSpk.executor?.group || 'TEKNISI'}
                  </p>
                </div>
              </div>
            </div>

            {/* ── All Detail Photos Gallery ── */}
            {(selectedSpk.notification?.photo1 || selectedSpk.notification?.photo2 || selectedSpk.photo_before || selectedSpk.photo_after) && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest pb-3.5 border-b border-slate-100 flex items-center gap-2">
                  <ImageIcon size={14} className="text-blue-600" /> Galeri Dokumentasi Lapangan Lengkap
                </h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                  
                  {/* Photo 1 (Reporter) */}
                  {selectedSpk.notification?.photo1 && (
                    <div className="bg-slate-50/50 p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-between min-h-[190px]">
                      <div 
                        onClick={() => setLightboxImage(getMediaUrl(selectedSpk.notification.photo1))}
                        className="relative group rounded-xl overflow-hidden cursor-pointer w-full aspect-square border border-slate-250 bg-white"
                      >
                        <img 
                          src={getMediaUrl(selectedSpk.notification.photo1)} 
                          alt="Temuan 1" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <Eye className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 mt-2 block text-center uppercase tracking-wide">Temuan Awal 1</span>
                    </div>
                  )}

                  {/* Photo 2 (Reporter) */}
                  {selectedSpk.notification?.photo2 && (
                    <div className="bg-slate-50/50 p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-between min-h-[190px]">
                      <div 
                        onClick={() => setLightboxImage(getMediaUrl(selectedSpk.notification.photo2))}
                        className="relative group rounded-xl overflow-hidden cursor-pointer w-full aspect-square border border-slate-250 bg-white"
                      >
                        <img 
                          src={getMediaUrl(selectedSpk.notification.photo2)} 
                          alt="Temuan 2" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <Eye className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 mt-2 block text-center uppercase tracking-wide">Temuan Awal 2</span>
                    </div>
                  )}

                  {/* Photo Before (Technician) */}
                  {selectedSpk.photo_before && (
                    <div className="bg-slate-50/50 p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-between min-h-[190px]">
                      <div 
                        onClick={() => setLightboxImage(getMediaUrl(selectedSpk.photo_before))}
                        className="relative group rounded-xl overflow-hidden cursor-pointer w-full aspect-square border border-slate-250 bg-white"
                      >
                        <img 
                          src={getMediaUrl(selectedSpk.photo_before)} 
                          alt="Sebelum Kerja" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <Eye className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 mt-2 block text-center uppercase tracking-wide">Sebelum Kerja</span>
                    </div>
                  )}

                  {/* Photo After (Technician) */}
                  {selectedSpk.photo_after && (
                    <div className="bg-slate-50/50 p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-between min-h-[190px]">
                      <div 
                        onClick={() => setLightboxImage(getMediaUrl(selectedSpk.photo_after))}
                        className="relative group rounded-xl overflow-hidden cursor-pointer w-full aspect-square border border-slate-250 bg-white"
                      >
                        <img 
                          src={getMediaUrl(selectedSpk.photo_after)} 
                          alt="Sesudah Kerja" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <Eye className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 mt-2 block text-center uppercase tracking-wide">Sesudah Kerja</span>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Execution Report Amber Box */}
            <div className="bg-amber-50/30 rounded-2xl border border-amber-200/60 p-6 shadow-sm space-y-4">
              <h4 className="text-xs font-extrabold text-amber-700 uppercase tracking-widest flex items-center gap-1.5 pb-2.5 border-b border-amber-100">
                <Lightbulb size={14} /> Laporan Hasil Eksekusi Aktual (Teknisi)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Pekerja Aktual</span>
                  <span className="text-xs font-bold text-slate-800 block">{selectedSpk.actual_personnel || 0} Orang</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Jam Aktual Kerja</span>
                  <span className="text-xs font-bold text-slate-800 block">{selectedSpk.actual_work || 0} Jam</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Reason Variance Code</span>
                  <span className="text-xs font-semibold text-slate-600 block font-mono">{selectedSpk.reason_of_var || '—'}</span>
                </div>
              </div>
              
              <div className="space-y-3 pt-3 border-t border-amber-100/60">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Uraian / Deskripsi Catatan Hasil Kerja</span>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap shadow-inner">
                    {selectedSpk.job_result_description || '—'}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Material yang Digunakan (Deskripsi)</span>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed min-h-[46px]">
                      {selectedSpk.actual_materials || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Alat Kerja (Tools) Terpakai</span>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed min-h-[46px]">
                      {selectedSpk.actual_tools || '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Planned Materials Table Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-3.5 border-b border-slate-100 flex items-center gap-2">
                <Package size={14} className="text-blue-600" /> Suku Cadang & Material Terencana (SAP)
                {selectedSpk.spkMaterials?.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-600 font-bold border border-blue-200">
                    {selectedSpk.spkMaterials.length} Item
                  </span>
                )}
              </h4>
              
              {selectedSpk.spkMaterials?.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Kode</th>
                        <th className="px-4 py-3">Nama Material</th>
                        <th className="px-4 py-3 text-center">Qty Pakai</th>
                        <th className="px-4 py-3 text-center">UoM</th>
                        <th className="px-4 py-3 text-center">Stok Gudang</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSpk.spkMaterials.map((sm) => (
                        <tr key={sm.id} className="hover:bg-slate-50/55 text-slate-600">
                          <td className="px-4 py-3 font-mono font-bold text-slate-500">{sm.material?.materialCode || sm.material?.material_code || "—"}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{sm.material?.name || "—"}</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-600">{Number(sm.quantityUsed || sm.quantity_used || 0)}</td>
                          <td className="px-4 py-3 text-center text-slate-400 text-[10px] font-bold uppercase">{sm.material?.uom || "PCS"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                              Number(sm.material?.quantity ?? 0) > 0 
                                ? "bg-green-50 border-green-200 text-green-600" 
                                : "bg-red-50 border-red-200 text-red-600"
                            )}>
                              {Number(sm.material?.quantity ?? 0).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Tidak ada material terencana dari SAP untuk SPK ini
                </div>
              )}
            </div>

            {/* Rejection Log Catalogs */}
            {selectedSpk.rejection_note && (
              <div className="bg-red-50/30 border border-red-200/60 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldAlert size={14} /> Riwayat Penolakan Terakhir
                </span>
                <div className="bg-white p-4 rounded-xl border border-red-100 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded uppercase">
                      Ditolak
                    </span>
                    <span className="text-xs text-slate-500 font-semibold font-mono">
                      Oleh: {selectedSpk.rejected_by || 'Kadis'} &middot; {selectedSpk.rejected_at ? fmtDate(selectedSpk.rejected_at) : ''}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-red-800 leading-relaxed">
                    "{selectedSpk.rejection_note}"
                  </p>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Dialog Modals ── */}

      {/* 1. Approval Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm bg-white border border-slate-200 text-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-emerald-600" size={18} />
              Konfirmasi Persetujuan
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-slate-500 leading-relaxed">
              Apakah Anda yakin ingin menyetujui hasil perbaikan SPK <span className="font-mono font-bold text-slate-800">#{selectedSpk?.order_number}</span>? 
              Dengan menyetujui, Anda menyatakan bahwa pekerjaan telah diperiksa dan diselesaikan dengan baik sesuai standar operasional.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setConfirmOpen(false)} 
              disabled={approving}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200"
            >
              Batal
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={approving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold border-none"
            >
              {approving ? 'Menyetujui...' : 'Setujui Selesai'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Rejection Reasoning Modal */}
      <Dialog open={rejectOpen} onOpenChange={(open) => { setRejectOpen(open); if (!open) setRejectionReason(''); }}>
        <DialogContent className="max-w-sm bg-white border border-slate-200 text-slate-800">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="text-red-500" size={18} />
              Tolak Hasil Pekerjaan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 leading-relaxed">
              Anda menolak hasil pekerjaan SPK <span className="font-mono font-bold text-slate-800">#{selectedSpk?.order_number}</span>. 
              Berikan alasan penolakan yang rinci agar tim teknisi mengetahui bagian pekerjaan yang perlu diperbaiki kembali.
            </p>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                Alasan Penolakan <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Misal: Hasil vibrasi pompa masih di atas batas toleransi, harap periksa kembali alignment coupling..."
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-red-500/50"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400">Minimal 10 karakter</span>
                <span className={cn("text-[10px] font-bold", rejectionReason.trim().length >= 10 ? "text-green-600" : "text-red-500")}>
                  {rejectionReason.trim().length} karakter
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setRejectOpen(false)} 
              disabled={rejecting}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200"
            >
              Batal
            </Button>
            <Button 
              variant="destructive"
              onClick={handleReject} 
              disabled={rejecting || rejectionReason.trim().length < 10}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold border-none"
            >
              {rejecting ? 'Menolak...' : 'Kirim Penolakan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Image Lightbox Popover */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 bg-slate-900/60 hover:bg-slate-800/80 text-white rounded-full border border-slate-700 transition-all shrink-0 cursor-pointer"
          >
            <X size={20} />
          </button>
          <img 
            src={lightboxImage} 
            alt="Dokumentasi Rinci" 
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl border border-slate-700/30 shadow-2xl animate-in scale-in duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
}
