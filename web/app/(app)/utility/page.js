"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Terminal as TerminalIcon,
  Download,
  Upload,
  Trash2,
  Copy,
  Database,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  HardDrive,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Eye,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

// Initial mock logs
const INITIAL_LOGS = [
  { timestamp: "2026-06-11 10:01:05", level: "INFO", source: "DB", message: "Connection to MySQL database established successfully." },
  { timestamp: "2026-06-11 10:02:18", level: "INFO", source: "SERVER", message: "MANTIS API Server starting on port 3000..." },
  { timestamp: "2026-06-11 10:02:19", level: "INFO", source: "SERVER", message: "Environment: production. Node version: v20.11.0." },
  { timestamp: "2026-06-11 10:05:45", level: "WARN", source: "AUTH", message: "Failed login attempt for NIK: 2210009. Invalid credentials." },
  { timestamp: "2026-06-11 10:10:12", level: "INFO", source: "CRON", message: "Supervisi visit scheduler run completed. 0 expired schedules updated." },
  { timestamp: "2026-06-11 10:15:33", level: "ERROR", source: "SAP", message: "Failed to parse SPK Confirmation: Order '2020202025' not found in database." },
  { timestamp: "2026-06-11 10:20:01", level: "DEBUG", source: "DB", message: "SELECT * FROM `sap_spk_corrective` WHERE `status` = 'selesai' LIMIT 10 (12ms)" },
  { timestamp: "2026-06-11 10:24:19", level: "INFO", source: "EXCEL", message: "History Excel parse completed: 42 records processed, 0 errors." },
];

const MOCK_MESSAGES = [
  { level: "INFO", source: "DB", message: "Query cached: SELECT `id`, `name` FROM `users` WHERE `role` = 'teknisi'" },
  { level: "DEBUG", source: "DB", message: "UPDATE `notifications` SET `status` = 'spk_created' WHERE `sap_order_number` = '2020202021'" },
  { level: "WARN", source: "SERVER", message: "Memory usage exceeded 75% threshold (Current: 78.4% / 6.27GB)" },
  { level: "INFO", source: "CRON", message: "Daily K3 inspection reminder broadcasted to 8 recipients." },
  { level: "ERROR", source: "AUTH", message: "JWT verification failed: TokenExpiredError: jwt expired at 2026-06-11 10:25:00" },
  { level: "INFO", source: "SAP", message: "Successfully synced confirmation confirmation_number: 0000752247 with SAP ERP Gateway." },
  { level: "ERROR", source: "DB", message: "Deadlock found when trying to get lock; try restarting transaction in bulk create." },
];

export default function UtilityPage() {
  const [logs, setLogs] = useState([]);
  const [logLevelFilter, setLogLevelFilter] = useState("ALL");
  
  // Modular Data Management States
  const [activeModuleTab, setActiveModuleTab] = useState("preventive");
  const [isModuleImporting, setIsModuleImporting] = useState(false);
  const [moduleImportProgress, setModuleImportProgress] = useState(0);
  const [isModuleExporting, setIsModuleExporting] = useState(false);
  const [moduleExportProgress, setModuleExportProgress] = useState(0);
  const [isModuleClearing, setIsModuleClearing] = useState(false);
  const [confirmClears, setConfirmClears] = useState({
    preventive: false,
    corrective: false,
    k3_hse: false,
    inspeksi: false,
    supervisi: false,
  });

  const [dbHealth, setDbHealth] = useState({
    status: "Loading...",
    connections: 0,
    memory: "0%",
    storage: "0GB / 0GB",
  });
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);

  const logsEndRef = useRef(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Fetch metrics on mount
  useEffect(() => {
    fetchHealth();
  }, []);

  // Live log polling from real backend
  useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      try {
        const res = await apiGet("/utility/logs");
        if (res && res.success && active) {
          setLogs(res.logs);
        }
      } catch (err) {
        console.error("Gagal mengambil log backend:", err);
      }
    };

    fetchLogs(); // initial call

    const interval = setInterval(fetchLogs, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Filter logs by level
  const filteredLogs = logs.filter((log) => {
    return logLevelFilter === "ALL" || log.level === logLevelFilter;
  });

  // Copy logs
  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Log berhasil disalin ke clipboard!");
  };


  // Fetch System Health Info from backend
  const fetchHealth = async () => {
    setIsRefreshingHealth(true);
    try {
      const res = await apiGet("/utility/status");
      if (res && res.success) {
        setDbHealth({
          status: res.dbStatus,
          connections: res.connections,
          memory: res.memory,
          storage: res.storage,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshingHealth(false);
    }
  };

  const handleRefreshHealth = () => {
    fetchHealth();
    toast.success("Statistik kesehatan sistem diperbarui.");
  };

  // Modular Export Handler
  const handleModuleExport = async (moduleName) => {
    if (isModuleExporting) return;
    setIsModuleExporting(true);
    setModuleExportProgress(15);
    try {
      setModuleExportProgress(45);
      const res = await apiGet(`/utility/module/export?module=${moduleName}`);
      setModuleExportProgress(75);
      
      const jsonStr = JSON.stringify(res, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `Mantis_Backup_${moduleName}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setModuleExportProgress(100);
      setTimeout(() => {
        setIsModuleExporting(false);
        toast.success(`Ekspor data modul '${moduleName}' berhasil diunduh!`, {
          description: "Format JSON tanpa data gambar.",
        });
      }, 300);
    } catch (err) {
      setIsModuleExporting(false);
      toast.error("Gagal melakukan ekspor data modul: " + err.message);
    }
  };

  // Modular Import Handler
  const handleModuleImport = async (moduleName, file) => {
    if (!file) return;
    if (isModuleImporting) return;
    setIsModuleImporting(true);
    setModuleImportProgress(15);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          setModuleImportProgress(40);
          const parsedData = JSON.parse(e.target.result);
          setModuleImportProgress(70);
          
          const res = await apiPost("/utility/module/import", {
            module: moduleName,
            data: parsedData,
          });

          if (res && res.success) {
            setModuleImportProgress(100);
            setTimeout(() => {
              setIsModuleImporting(false);
              toast.success(`Berhasil mengimpor data modul '${moduleName}'!`, {
                description: "Tabel-tabel database terkait berhasil diperbarui.",
              });
            }, 300);
          } else {
            throw new Error(res.error || "Gagal menyimpan data");
          }
        } catch (parseErr) {
          setIsModuleImporting(false);
          toast.error("File JSON tidak valid atau rusak: " + parseErr.message);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setIsModuleImporting(false);
      toast.error("Gagal membaca file: " + err.message);
    }
  };

  // Modular Clear Handler
  const handleModuleClear = async (moduleName) => {
    if (isModuleClearing) return;
    setIsModuleClearing(true);
    try {
      const res = await apiDelete(`/utility/module/clear?module=${moduleName}`);
      if (res && res.success) {
        toast.success(`Seluruh data modul '${moduleName}' berhasil dibersihkan!`);
        // Reset checkbox
        setConfirmClears((prev) => ({ ...prev, [moduleName]: false }));
      } else {
        throw new Error(res.error || "Gagal membersihkan data");
      }
    } catch (err) {
      toast.error("Gagal membersihkan data modul: " + err.message);
    } finally {
      setIsModuleClearing(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans text-slate-800">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="text-[#0a2540] animate-spin-slow w-7 h-7" style={{ animationDuration: "10s" }} />
            Admin Utility Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Konsol administrasi utama untuk pemantauan log sistem secara real-time, eksekusi perintah, dan manajemen database.
          </p>
        </div>
        <div className="flex gap-2 self-start md:self-auto">
          <Button
            onClick={handleRefreshHealth}
            variant="outline"
            disabled={isRefreshingHealth}
            className="bg-white border-slate-200 shadow-sm text-xs h-9"
          >
            <RefreshCw size={14} className={`mr-1.5 ${isRefreshingHealth ? "animate-spin" : ""}`} />
            Refresh Status
          </Button>
        </div>
      </div>

      {/* ── System Metrics Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 p-4 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Database size={48} className="text-emerald-800" />
          </div>
          <span className="text-[10px] font-bold text-emerald-800/80 uppercase tracking-widest block">Status DB</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-xl font-bold text-emerald-900">{dbHealth.status}</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <span className="text-[10px] text-emerald-700/70 block mt-1">MySQL 8.0.36 &middot; Running</span>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/60 p-4 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Cpu size={48} className="text-indigo-800" />
          </div>
          <span className="text-[10px] font-bold text-indigo-800/80 uppercase tracking-widest block">Aktif Koneksi</span>
          <span className="text-xl font-bold text-indigo-900 block mt-1">{dbHealth.connections} Client</span>
          <span className="text-[10px] text-indigo-700/70 block mt-1">Pool Status &middot; Optimal</span>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 p-4 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Layers size={48} className="text-amber-800" />
          </div>
          <span className="text-[10px] font-bold text-amber-800/80 uppercase tracking-widest block">RAM Server</span>
          <span className="text-xl font-bold text-amber-900 block mt-1">{dbHealth.memory}</span>
          <span className="text-[10px] text-amber-700/70 block mt-1">RAM Cache &middot; Heap Allocated</span>
        </div>

        <div className="bg-gradient-to-br from-slate-100 to-slate-200/80 border border-slate-300/60 p-4 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <HardDrive size={48} className="text-slate-800" />
          </div>
          <span className="text-[10px] font-bold text-slate-800/80 uppercase tracking-widest block">Penyimpanan</span>
          <span className="text-xl font-bold text-slate-900 block mt-1">{dbHealth.storage}</span>
          <span className="text-[10px] text-slate-700/70 block mt-1">Storage Sektor &middot; 28% Sisa</span>
        </div>
      </div>

      {/* ── Main Utilities Workspace ── */}
      {/* ── Log Monitor (Terminal View) ── */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col h-[520px]">
        {/* Terminal Header */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3.5 shrink-0 flex items-center gap-2">
          <TerminalIcon size={14} className="text-slate-400" />
          <span className="text-[11px] font-mono text-slate-400 font-semibold tracking-wider uppercase select-none">System Realtime Log Monitor</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
        </div>

        {/* Log Filters */}
        <div className="bg-slate-900/40 border-b border-slate-800 px-4 py-2 flex items-center shrink-0">
          <div className="flex flex-wrap gap-1">
            {["ALL", "ERROR", "WARN", "INFO", "DEBUG"].map((level) => {
              const count = level === "ALL" ? logs.length : logs.filter((l) => l.level === level).length;
              const colors = {
                ALL: "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white bg-slate-800/20 active:bg-slate-700",
                ERROR: "border-red-900/50 text-red-400 hover:bg-red-950/20 bg-red-950/5 hover:text-red-300",
                WARN: "border-amber-900/50 text-amber-400 hover:bg-amber-950/20 bg-amber-950/5 hover:text-amber-300",
                INFO: "border-sky-900/50 text-sky-400 hover:bg-sky-950/20 bg-sky-950/5 hover:text-sky-300",
                DEBUG: "border-purple-900/50 text-purple-400 hover:bg-purple-950/20 bg-purple-950/5 hover:text-purple-300",
              };
              const activeColors = {
                ALL: "bg-slate-700 text-white border-slate-500",
                ERROR: "bg-red-600 text-white border-red-500",
                WARN: "bg-amber-500 text-slate-950 border-amber-400",
                INFO: "bg-sky-500 text-slate-950 border-sky-400",
                DEBUG: "bg-purple-500 text-white border-purple-400",
              };
              const active = logLevelFilter === level;
              return (
                <button
                  key={level}
                  onClick={() => setLogLevelFilter(level)}
                  className={`px-2 py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                    active ? activeColors[level] : colors[level]
                  }`}
                >
                  {level} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Logs Output Box */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar font-mono text-xs select-text selection:bg-slate-800">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic text-[11px]">
              Tidak ada log yang cocok dengan filter pencarian.
            </div>
          ) : (
            filteredLogs.map((log, i) => {
              const badgeColors = {
                ERROR: "text-red-400 bg-red-950/40 border-red-900/40",
                WARN: "text-amber-400 bg-amber-950/40 border-amber-900/40",
                INFO: "text-sky-400 bg-sky-950/40 border-sky-900/40",
                DEBUG: "text-purple-400 bg-purple-950/40 border-purple-900/40",
              };
              return (
                <div key={i} className="flex items-start gap-2 text-slate-300 hover:bg-slate-900/40 py-0.5 rounded px-1 transition-colors">
                  <span className="text-slate-500 select-none shrink-0">[{log.timestamp}]</span>
                  <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded border uppercase shrink-0 ${badgeColors[log.level]}`}>
                    {log.level}
                  </span>
                  <span className="text-slate-400 font-bold shrink-0">[{log.source}]</span>
                  <span className="break-all whitespace-pre-wrap">{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Logs Actions Footer */}
        <div className="bg-slate-900/90 border-t border-slate-800 px-4 py-2.5 shrink-0 flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500">
            Menampilkan {filteredLogs.length} dari {logs.length} baris log
          </span>
          <div className="flex gap-2">
             <Button
               onClick={() => setLogs([])}
               variant="ghost"
               className="h-7 px-2.5 border border-slate-800 text-[10px] font-mono hover:bg-slate-800/40 text-slate-400 hover:text-white"
             >
               <Trash2 size={11} className="mr-1" /> Clear Screen
             </Button>
            <Button
              onClick={handleCopyLogs}
              variant="ghost"
              className="h-7 px-2.5 border border-slate-800 text-[10px] font-mono hover:bg-slate-800/40 text-slate-400 hover:text-white"
            >
              <Copy size={11} className="mr-1" /> Copy Logs
            </Button>
          </div>
        </div>
      </div>

      {/* ── Data Management & Integration ── */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-6 pt-4 border-t border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Database className="text-[#0a2540] w-5 h-5" />
            Data Management & Integration
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Manajemen pencadangan, pemulihan, dan penghapusan bulk data sistem yang dikelompokkan per modul operasional.
          </p>
        </div>

        {/* Tab Selectors */}
        <div className="flex flex-wrap gap-2 p-1 bg-slate-50 border border-slate-100 rounded-2xl">
          {[
            { id: "preventive", label: "Preventive", icon: Settings, color: "text-sky-600 bg-sky-50 border-sky-100" },
            { id: "corrective", label: "Corrective", icon: AlertTriangle, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
            { id: "k3_hse", label: "K3 / HSE", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            { id: "inspeksi", label: "Inspeksi", icon: Layers, color: "text-purple-600 bg-purple-50 border-purple-100" },
            { id: "supervisi", label: "Supervisi", icon: Cpu, color: "text-amber-600 bg-amber-50 border-amber-100" },
          ].map((tab) => {
            const active = activeModuleTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveModuleTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  active
                    ? "bg-[#0a2540] text-white shadow-sm font-bold scale-[1.02]"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white"
                }`}
              >
                <Icon size={14} className={active ? "text-white" : "text-slate-400"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          
          {/* Card 1: Import JSON */}
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Upload size={16} />
                </div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Bulk Import JSON</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Unggah file cadangan JSON untuk memulihkan data modul ini. Entri duplikat (dengan ID yang sama) akan dilewati secara otomatis.
              </p>

              {/* Upload zone */}
              <div className="border border-dashed border-slate-200 hover:border-indigo-400 bg-white rounded-xl p-4 text-center transition-colors cursor-pointer relative overflow-hidden group">
                <input
                  type="file"
                  accept=".json"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isModuleImporting}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleModuleImport(activeModuleTab, e.target.files[0]);
                    }
                  }}
                />
                <div className="space-y-1">
                  <div className="text-slate-400 group-hover:text-indigo-600 transition-colors flex justify-center">
                    <FileText size={18} />
                  </div>
                  <div className="text-[10px] font-semibold text-slate-600">Pilih file backup (.json)</div>
                </div>
              </div>

              {/* Progress bar */}
              {isModuleImporting && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[9px] font-semibold text-slate-500">
                    <span>Mengunggah & memproses...</span>
                    <span>{moduleImportProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1 rounded-full transition-all duration-150"
                      style={{ width: `${moduleImportProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="text-[9px] text-slate-400/80 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200/40">
              Format yang didukung: <strong>JSON</strong> (Maks. 50MB)
            </div>
          </div>

          {/* Card 2: Export JSON */}
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Download size={16} />
                </div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Bulk Export JSON</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Unduh seluruh data yang tersimpan pada modul ini ke dalam satu berkas cadangan JSON terkompresi.
              </p>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-[10px] text-emerald-800 flex items-start gap-1.5">
                <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                <span>Format cadangan ini mencakup relasi tabel dan siap digunakan untuk replikasi database.</span>
              </div>
            </div>

            <div className="space-y-2">
              {isModuleExporting && (
                <div className="space-y-1">
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-1 rounded-full transition-all duration-150"
                      style={{ width: `${moduleExportProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <Button
                onClick={() => handleModuleExport(activeModuleTab)}
                disabled={isModuleExporting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase h-9 rounded-xl transition-all"
              >
                {isModuleExporting ? "Mengekspor..." : "Ekspor Data JSON"}
              </Button>
            </div>
          </div>

          {/* Card 3: Danger Zone / Bulk Delete */}
          <div className="bg-red-50/20 border border-red-200/40 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                  <AlertTriangle size={16} />
                </div>
                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide">Danger Zone</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tindakan ini akan <strong>menghapus seluruh data</strong> terkait modul ini secara permanen dari database.
              </p>

              {/* Confirmation checkbox */}
              <label className="flex items-start gap-2 cursor-pointer select-none bg-white p-2.5 rounded-xl border border-red-100 shadow-sm">
                <input
                  type="checkbox"
                  checked={confirmClears[activeModuleTab] || false}
                  onChange={(e) => {
                    setConfirmClears({
                      ...confirmClears,
                      [activeModuleTab]: e.target.checked,
                    });
                  }}
                  className="rounded border-red-300 text-red-600 focus:ring-red-500/20 w-3.5 h-3.5 mt-0.5 cursor-pointer"
                />
                <span className="text-[10px] text-red-800 font-semibold leading-tight">
                  Saya sadar tindakan ini permanen dan tidak dapat dibatalkan.
                </span>
              </label>
            </div>

            <Button
              onClick={() => handleModuleClear(activeModuleTab)}
              disabled={isModuleClearing || !confirmClears[activeModuleTab]}
              className={`w-full font-bold text-xs uppercase h-9 rounded-xl transition-all ${
                confirmClears[activeModuleTab]
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-md"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isModuleClearing ? "Membersihkan..." : "Hapus Semua Data"}
            </Button>
          </div>

        </div>
      </div>

    </div>
  );
}
