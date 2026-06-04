"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiGet, apiPut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Undo2, HelpCircle, ShieldCheck, AlertTriangle } from "lucide-react";

const STATUS_PREV_STEP_MAP = {
  'menunggu_tindakan_hse': 'menunggu_validasi_kadis_hse',
  'menunggu_validasi_hasil_kadis_hse': 'menunggu_tindakan_hse',
  'perbaikan_ditolak_pphse': 'menunggu_tindakan_hse',
  'perbaikan_ditolak_kadis_hse': 'menunggu_validasi_hasil_kadis_hse',
  'menunggu_validasi_akhir_kadiv_pphse': 'menunggu_validasi_hasil_kadis_hse',
  'perbaikan_ditolak_kadiv_pphse': 'menunggu_validasi_akhir_kadiv_pphse',
  'menunggu_verifikasi_investigasi': 'menunggu_tindakan_hse',
  'investigasi_ditolak_kadis_hse': 'menunggu_verifikasi_investigasi',
  'menunggu_validasi_kadiv': 'menunggu_verifikasi_investigasi',
  'investigasi_ditolak_kadiv': 'menunggu_validasi_kadiv',
};

const STATUS_MAP = {
  menunggu_validasi_kadis_hse: {
    label: "Menunggu Validasi Kadis HSE",
    color: "bg-amber-100 text-amber-700",
  },
  menunggu_validasi_kadiv_pphse: {
    label: "Menunggu Validasi Kadiv PPHSE",
    color: "bg-amber-100 text-amber-700",
  },
  menunggu_tindakan_hse: {
    label: "Menunggu Tindakan HSE",
    color: "bg-blue-100 text-blue-700",
  },
  menunggu_validasi_hasil_kadis_hse: {
    label: "Menunggu Validasi Hasil Kadis",
    color: "bg-purple-100 text-purple-700",
  },
  menunggu_validasi_akhir_kadiv_pphse: {
    label: "Menunggu Validasi Akhir Kadiv",
    color: "bg-purple-100 text-purple-700",
  },
  menunggu_verifikasi_investigasi: {
    label: "Verifikasi Investigasi",
    color: "bg-indigo-100 text-indigo-700",
  },
  menunggu_validasi_kadiv: {
    label: "Validasi Kadiv (Investigasi)",
    color: "bg-purple-100 text-purple-700",
  },
  ditolak_kadis_hse: {
    label: "Ditolak Kadis HSE",
    color: "bg-rose-100 text-rose-700",
  },
  ditolak: {
    label: "Ditolak",
    color: "bg-rose-100 text-rose-700",
  },
  perbaikan_ditolak_pphse: {
    label: "Perbaikan Ditolak PPHSE",
    color: "bg-rose-100 text-rose-700",
  },
  perbaikan_ditolak_kadis_hse: {
    label: "Perbaikan Ditolak Kadis HSE",
    color: "bg-rose-100 text-rose-700",
  },
  perbaikan_ditolak_kadiv_pphse: {
    label: "Perbaikan Ditolak Kadiv PPHSE",
    color: "bg-rose-100 text-rose-700",
  },
  investigasi_ditolak_kadis_hse: {
    label: "Investigasi Ditolak Kadis HSE",
    color: "bg-rose-100 text-rose-700",
  },
  investigasi_ditolak_kadiv: {
    label: "Investigasi Ditolak Kadiv",
    color: "bg-rose-100 text-rose-700",
  },
  selesai: {
    label: "Selesai",
    color: "bg-emerald-100 text-emerald-700",
  },
};

export default function RevertStepTab() {
  const [reports, setReports] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reverting, setReverting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      const res = await apiGet("/k3-safety");
      setReports(res.data || []);
    } catch (e) {
      toast.error("Gagal mengambil laporan K3: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const targetPrevStatus = selectedReport ? STATUS_PREV_STEP_MAP[selectedReport.status] : null;
  const targetLabel = targetPrevStatus ? (STATUS_MAP[targetPrevStatus]?.label || targetPrevStatus) : '';

  const handleRevert = async () => {
    if (!selectedReport) return;
    setReverting(true);
    try {
      await apiPut(`/k3-safety/${selectedReport.id}/revert-step`, {});
      toast.success(`Status berhasil dimundurkan ke "${targetLabel}"`);
      setConfirmOpen(false);
      setSelectedReport(null);
      await fetchReports();
    } catch (e) {
      toast.error("Gagal memundurkan status: " + e.message);
    } finally {
      setReverting(false);
    }
  };

  const activeReports = reports.filter(
    (r) => r.status !== "selesai" && r.status !== "menunggu_validasi_kadis_hse" && STATUS_PREV_STEP_MAP[r.status]
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Info */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <HelpCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Apa itu Mundurkan Tahapan?</p>
          <p>
            Fitur ini digunakan untuk mengembalikan tahapan persetujuan/proses laporan K3 sebanyak 1 langkah ke belakang. 
            Hal ini berguna jika terjadi kesalahan pengisian tindakan, kesalahan penugasan, atau jika ingin merevisi keputusan persetujuan sebelumnya.
          </p>
        </div>
      </div>

      {/* Reports in pipeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Daftar Laporan yang Dapat Dimundurkan
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeReports.length} laporan aktif yang bisa dimundurkan
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {activeReports.length} Laporan
          </Badge>
        </div>

        {activeReports.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            <ShieldCheck size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">
              Tidak ada laporan yang dapat dimundurkan
            </p>
            <p className="text-xs mt-1">
              Semua laporan berada pada tahap awal atau sudah selesai.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeReports.map((report) => {
              const statusInfo = STATUS_MAP[report.status] || {
                label: report.status,
                color: "bg-slate-100 text-slate-600",
              };
              return (
                <div
                  key={report.id}
                  className="px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-slate-500">
                          {report.reportNumber}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {report.kategori}
                        </Badge>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            statusInfo.color,
                          )}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 line-clamp-1">
                        {report.deskripsi}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                        <span>
                          Pelapor:{" "}
                          <strong className="text-slate-600">
                            {report.pelapor?.name || "-"}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Tindakan:{" "}
                          <strong className="text-slate-600">
                            {report.jenisTindakan === "perbaikan_langsung"
                              ? "Perbaikan Langsung"
                              : report.jenisTindakan === "investigasi"
                              ? "Investigasi"
                              : "Belum Ditentukan"}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(report.createdAt).toLocaleDateString(
                            "id-ID",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 shrink-0"
                      onClick={() => {
                        setSelectedReport(report);
                        setConfirmOpen(true);
                      }}
                    >
                      <Undo2 size={13} />
                      Mundurkan
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 size={18} className="text-amber-600" />
              Konfirmasi Mundurkan Tahapan
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="text-sm text-slate-600">
                  Anda akan memundurkan tahapan laporan ini 1 langkah ke belakang ke tahap{" "}
                  <strong>&quot;{targetLabel}&quot;</strong>.
                </p>
                {selectedReport && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                    <p>
                      <span className="text-slate-400">No:</span>{" "}
                      <strong>{selectedReport.reportNumber}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Kategori:</span>{" "}
                      {selectedReport.kategori}
                    </p>
                    <p>
                      <span className="text-slate-400">Status saat ini:</span>{" "}
                      {STATUS_MAP[selectedReport.status]?.label || selectedReport.status}
                    </p>
                  </div>
                )}
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle
                    size={14}
                    className="text-amber-500 mt-0.5 shrink-0"
                  />
                  <p className="text-xs text-amber-700">
                    Tindakan ini akan memundurkan alur persetujuan ke tahap sebelumnya. Anda dapat memundurkannya kembali jika diperlukan.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={reverting}
            >
              Batal
            </Button>
            <Button
              onClick={handleRevert}
              disabled={reverting}
              className="bg-amber-600 hover:bg-amber-700 gap-1.5"
            >
              <Undo2 size={14} />
              {reverting ? "Memproses..." : "Ya, Mundurkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
