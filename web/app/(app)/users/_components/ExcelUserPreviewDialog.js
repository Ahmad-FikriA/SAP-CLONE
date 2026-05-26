"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { 
  FileSpreadsheet, AlertTriangle, Users, CheckCircle2, AlertCircle, Info, Sparkles 
} from "lucide-react";

export function ExcelUserPreviewDialog({
  previewData, skippedData, savingExcel,
  onClose, onConfirm,
}) {
  const [activeTab, setActiveTab] = useState("ready");

  // Automatically switch tab if one list is empty
  useEffect(() => {
    if (previewData?.length === 0 && skippedData?.length > 0) {
      setActiveTab("skipped");
    } else {
      setActiveTab("ready");
    }
  }, [previewData, skippedData]);

  // Role Badge Styling Generator
  const getRoleBadge = (role) => {
    const r = (role || "").toLowerCase().trim();
    const colors = {
      teknisi: { bg: "bg-blue-50/80 border-blue-200/60 text-blue-700", label: "Teknisi" },
      petugas: { bg: "bg-sky-50/80 border-sky-200/60 text-sky-700", label: "Petugas" },
      kasie:   { bg: "bg-cyan-50/80 border-cyan-200/60 text-cyan-700", label: "Kasie" },
      kadis:   { bg: "bg-teal-50/80 border-teal-200/60 text-teal-700", label: "Kadis" },
      kadiv:   { bg: "bg-purple-50/80 border-purple-200/60 text-purple-700", label: "Kadiv" },
      admin:   { bg: "bg-rose-50/80 border-rose-200/60 text-rose-700", label: "Admin" },
    };
    const config = colors[r] || { bg: "bg-slate-50 border-slate-200 text-slate-600", label: role || "-" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} transition-colors duration-150`}>
        {config.label}
      </span>
    );
  };

  return (
    <Dialog
      open={!!previewData || !!skippedData}
      onOpenChange={(open) => {
        if (!open && !savingExcel) onClose();
      }}
    >
      <DialogContent className="max-w-[95vw] md:max-w-[85vw] lg:max-w-[75vw] max-h-[85vh] flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200/60 shadow-2xl rounded-2xl p-0">
        
        {/* Header Section */}
        <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white/50 shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2.5 text-slate-800">
            <div className="p-2 bg-blue-50 rounded-xl border border-blue-100/50">
              <FileSpreadsheet className="text-blue-600 w-5 h-5 animate-pulse" />
            </div>
            <span>Preview Data Import User</span>
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1.5 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" />
            <span>Silakan tinjau data sebelum menyimpan ke database. NIK duplikat akan disaring secara otomatis.</span>
          </p>
        </DialogHeader>

        {/* Tab System Controls */}
        <div className="flex border-b border-slate-100 bg-slate-50/40 px-6 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("ready")}
            className={`flex items-center gap-2 py-3.5 px-4 border-b-2 font-medium text-sm transition-all duration-200 ${
              activeTab === "ready"
                ? "border-emerald-500 text-emerald-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CheckCircle2 size={16} className={activeTab === "ready" ? "text-emerald-500" : "text-slate-400"} />
            <span>Siap Diimport</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono transition-colors ${
              activeTab === "ready"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-200/70 text-slate-600"
            }`}>
              {previewData?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("skipped")}
            className={`flex items-center gap-2 py-3.5 px-4 border-b-2 font-medium text-sm transition-all duration-200 ${
              activeTab === "skipped"
                ? "border-amber-500 text-amber-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertTriangle size={16} className={activeTab === "skipped" ? "text-amber-500 animate-bounce" : "text-slate-400"} />
            <span>Terlewati / Sudah Terdaftar</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono transition-colors ${
              activeTab === "skipped"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-200/70 text-slate-600"
            }`}>
              {skippedData?.length || 0}
            </span>
          </button>
        </div>
        
        {/* Main Body Section */}
        <div className="flex-1 overflow-auto p-6 flex flex-col bg-slate-50/20">
          
          {/* TAB 1: Siap Diimport */}
          {activeTab === "ready" && (
            previewData?.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white border border-dashed border-slate-200 rounded-xl">
                <div className="p-4 bg-slate-50 rounded-full border border-slate-100">
                  <Users size={32} className="stroke-1.5 text-slate-400" />
                </div>
                <p className="text-sm font-medium">Tidak ada data user baru untuk ditambahkan.</p>
              </div>
            ) : (
              <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col flex-1">
                <div className="overflow-x-auto overflow-y-auto max-h-[46vh] scrollbar-thin w-full">
                  <Table className="w-full border-collapse">
                    <TableHeader className="bg-slate-50/90 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-100">
                      <TableRow>
                        <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 w-[140px]">NIK</TableHead>
                        <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 min-w-[200px]">Nama</TableHead>
                        <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 w-[150px]">Jabatan (Role)</TableHead>
                        <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 min-w-[160px]">Seksi/Group</TableHead>
                        <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 min-w-[160px]">Dinas</TableHead>
                        <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 min-w-[180px]">Divisi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, i) => (
                        <TableRow key={i} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/80">
                          <TableCell className="font-mono text-sm font-bold text-slate-800 px-5 py-3.5">
                            {row.nik}
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-slate-900 px-5 py-3.5">
                            {row.name || "-"}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-center sm:text-left">
                            {getRoleBadge(row.role)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 px-5 py-3.5">
                            {row.group || <span className="text-slate-300">-</span>}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 px-5 py-3.5">
                            {row.dinas || <span className="text-slate-300">-</span>}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 px-5 py-3.5">
                            {row.divisi || <span className="text-slate-300">-</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          )}

          {/* TAB 2: Terlewati / Sudah Terdaftar */}
          {activeTab === "skipped" && (
            skippedData?.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white border border-dashed border-slate-200 rounded-xl">
                <div className="p-4 bg-emerald-50 rounded-full border border-emerald-100">
                  <CheckCircle2 size={32} className="stroke-1.5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-emerald-800">Luar biasa! Tidak ada data yang terlewati/duplikat.</p>
              </div>
            ) : (
              <div className="flex flex-col flex-1 gap-4">
                {/* Custom warning alert */}
                <div className="bg-amber-50/80 border border-amber-200/70 p-4 rounded-xl flex items-start gap-3.5 shadow-sm backdrop-blur-sm shrink-0">
                  <AlertCircle className="text-amber-500 w-5.5 h-5.5 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-800">
                      Perhatian: Ada Data Terlewati ({skippedData.length} User)
                    </h4>
                    <p className="text-sm text-amber-700/90 mt-1 leading-relaxed">
                      NIK dari baris-baris ini sudah terdaftar di database atau memiliki NIK duplikat di dalam file Excel. Data ini dilewati secara otomatis untuk mencegah tumpang tindih informasi.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col flex-1">
                  <div className="overflow-x-auto overflow-y-auto max-h-[38vh] scrollbar-thin w-full">
                    <Table className="w-full border-collapse">
                      <TableHeader className="bg-slate-50/90 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-100">
                        <TableRow>
                          <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 w-[140px]">NIK</TableHead>
                          <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 min-w-[200px]">Nama</TableHead>
                          <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 w-[150px]">Jabatan (Role)</TableHead>
                          <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 min-w-[160px]">Seksi/Group</TableHead>
                          <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 min-w-[160px]">Dinas</TableHead>
                          <TableHead className="whitespace-nowrap font-bold text-slate-700 px-5 py-3 min-w-[180px]">Divisi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {skippedData.map((row, i) => (
                          <TableRow key={i} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/80 bg-slate-50/20">
                            <TableCell className="font-mono text-sm font-bold text-amber-700 px-5 py-3.5">
                              {row.nik}
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-slate-800 px-5 py-3.5">
                              {row.name || "-"}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-center sm:text-left">
                              {getRoleBadge(row.role)}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 px-5 py-3.5">
                              {row.group || <span className="text-slate-300">-</span>}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 px-5 py-3.5">
                              {row.dinas || <span className="text-slate-300">-</span>}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 px-5 py-3.5">
                              {row.divisi || <span className="text-slate-300">-</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )
          )}

        </div>
        
        {/* Footer Actions */}
        <DialogFooter className="px-6 pt-4 pb-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={savingExcel}
            className="border-slate-200 hover:bg-slate-100 hover:text-slate-800"
          >
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={savingExcel || previewData?.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.98] transition-transform duration-100"
          >
            {savingExcel ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Menyimpan...</span>
              </span>
            ) : (
              <span>Simpan Data ({previewData?.length || 0} User)</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
