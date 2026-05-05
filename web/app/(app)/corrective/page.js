"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw, Upload, Inbox, FileText, CheckCircle2, Trash2,
  LayoutDashboard, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canCreate, canDelete } from "@/lib/auth";

import { useCorrective } from "./_hooks/useCorrective";
import { SummaryCards } from "./_components/SummaryCards";
import { RequestsTable } from "./_components/RequestsTable";
import { SpkTable } from "./_components/SpkTable";
import { HistoryTable } from "./_components/HistoryTable";
import { RequestDetailDialog } from "./_components/RequestDetailDialog";
import { SpkDetailDialog } from "./_components/SpkDetailDialog";
import { ApproveSapDialog } from "./_components/ApproveSapDialog";
import { ExcelPreviewDialog } from "./_components/ExcelPreviewDialog";
import { ManualCreateDialog } from "./_components/ManualCreateDialog";

export default function CorrectivePage() {
  const data = useCorrective();
  const {
    requests, spks, history, loading, filteredRequests,
    filterApprovalStatus, setFilterApprovalStatus,
    filterSpkStatus, setFilterSpkStatus,
    loadAll,
    uploadExcel, confirmBulkInsert, submitManualSpk,
    approvePlannerAction, rejectPlannerAction, updateSapNumberAction,
    approveKadisPpAction, rejectKadisPpAction,
    deleteRequestAction, deleteAllRequestsAction,
    deleteSpkAction, deleteAllSpksAction,
  } = data;

  const [tab, setTab] = useState("requests");

  // Detail dialogs
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedSpk, setSelectedSpk] = useState(null);

  // Upload Excel
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [skippedData, setSkippedData] = useState(null);
  const [savingExcel, setSavingExcel] = useState(false);
  const fileInputRef = useRef(null);

  // Approve SAP dialog
  const [approveSapState, setApproveSapState] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // Confirm dialog
  const [confirmState, setConfirmState] = useState(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Manual Create
  const [showManualForm, setShowManualForm] = useState(false);

  // ── Confirm Action Pattern ──────────────────────────────────────────────
  function confirmAction(title, message, onConfirm, withNotes = false) {
    setConfirmNotes("");
    setConfirmState({ title, message, withNotes, onConfirm });
  }

  async function runConfirm() {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.onConfirm(confirmNotes);
      setConfirmState(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmBusy(false);
    }
  }

  // ── Upload Excel Handlers ───────────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadExcel(file);
      setPreviewData(result.previewData);
      setSkippedData(result.skippedData);
    } catch (err) {
      toast.error(err.message || "Terjadi kesalahan saat upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleConfirmUpload() {
    if (!previewData || previewData.length === 0) return;
    setSavingExcel(true);
    try {
      await confirmBulkInsert(previewData);
      setPreviewData(null);
      setSkippedData(null);
    } catch (error) {
      toast.error(error.message || "Terjadi kesalahan saat menyimpan data");
    } finally {
      setSavingExcel(false);
    }
  }

  // ── Approve / Reject Planner ────────────────────────────────────────────
  function triggerApprovePlanner(id) {
    setApproveSapState({ id, isEdit: false, initialValue: "" });
  }

  function triggerEditSapNumber(req) {
    setApproveSapState({ id: req.id, isEdit: true, initialValue: req.sapOrderNumber || "" });
  }

  async function confirmApproveSap(sapNumber) {
    if (!/^\d{10}$/.test(sapNumber)) {
      toast.error("Nomor SAP harus 10 digit angka!");
      return;
    }
    setConfirming(true);
    try {
      if (approveSapState.isEdit) {
        await updateSapNumberAction(approveSapState.id, sapNumber);
      } else {
        await approvePlannerAction(approveSapState.id, sapNumber);
      }
      setApproveSapState(null);
    } catch (error) {
      toast.error(error.message || "Gagal memproses data");
    } finally {
      setConfirming(false);
    }
  }

  function triggerRejectPlanner(id) {
    confirmAction(
      "Tolak Laporan Notifikasi",
      `Silakan masukkan alasan penolakan untuk laporan ${id}. Alasan ini akan dikirimkan kepada pelapor.`,
      async (notes) => {
        if (!notes || !notes.trim()) throw new Error("Alasan penolakan wajib diisi");
        await rejectPlannerAction(id, notes);
        setSelectedRequest(null);
      },
      true,
    );
  }

  // ── Approve / Reject Kadis PP ───────────────────────────────────────────
  function triggerApproveKadisPp(orderNumber) {
    confirmAction(
      "Setujui Pekerjaan (Kadis PP)",
      `Anda yakin pekerjaan untuk SPK ${orderNumber} sudah selesai dengan baik?`,
      async () => { await approveKadisPpAction(orderNumber); },
    );
  }

  function triggerRejectKadisPp(orderNumber) {
    confirmAction(
      "Tolak Pekerjaan (Kadis PP)",
      `Masukkan alasan mengapa pekerjaan SPK ${orderNumber} ditolak:`,
      async (notes) => {
        if (!notes || !notes.trim()) throw new Error("Alasan penolakan wajib diisi");
        await rejectKadisPpAction(orderNumber, notes);
      },
      true,
    );
  }

  // ── Delete Handlers ─────────────────────────────────────────────────────
  function handleDeleteAllRequests() {
    confirmAction("Hapus Semua Notifikasi", "Anda yakin ingin menghapus SELURUH data notifikasi yang belum dibuat SPK?",
      async () => { await deleteAllRequestsAction(); });
  }

  function handleDeleteRequest(id) {
    confirmAction("Hapus Notifikasi", `Anda yakin ingin menghapus notifikasi ${id}?`,
      async () => { await deleteRequestAction(id); });
  }

  function handleDeleteAllSpks() {
    confirmAction("Hapus Semua SPK SAP", "Anda yakin ingin menghapus SELURUH data SPK SAP aktif dan riwayat?",
      async () => { await deleteAllSpksAction(); });
  }

  function handleDeleteSpk(orderNumber) {
    confirmAction("Hapus SPK SAP", `Anda yakin ingin menghapus SPK ${orderNumber}?`,
      async () => { await deleteSpkAction(orderNumber); });
  }

  // ── Tabs ────────────────────────────────────────────────────────────────
  const TABS = [
    { key: "requests", label: "Notifikasi", icon: Inbox, count: filteredRequests.length },
    { key: "spk", label: "SPK Aktif (SAP)", icon: FileText, count: spks.length },
    { key: "history", label: "History", icon: CheckCircle2, count: history.length },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <LayoutDashboard size={16} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              Corrective Planner
            </h2>
          </div>
          <p className="text-slate-500 text-sm ml-9">
            Kelola laporan notifikasi dan integrasikan ekspor SPK dari SAP.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          {canCreate('corrective') && (
            <Button variant="outline" className="shadow-md bg-white hover:bg-slate-50 border-slate-200" onClick={() => setShowManualForm(true)}>
              <Plus size={16} className="mr-2" /> Create Manual
            </Button>
          )}
          {canCreate('corrective') && (
            <Button variant="default" className="shadow-md bg-blue-600 hover:bg-blue-700" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload size={16} className="mr-2" />
              {uploading ? "Mengunggah..." : "Upload Excel SAP"}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={loadAll} disabled={loading} className="shrink-0 bg-white shadow-sm hover:bg-slate-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards requests={requests} spks={spks} />

      {/* Tabs & Filters */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="flex gap-1 overflow-x-auto w-full md:w-auto p-1 bg-slate-50 rounded-lg">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md whitespace-nowrap",
                  isActive ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50",
                )}
              >
                <Icon size={16} className={isActive ? "text-blue-600" : "text-slate-400"} />
                {t.label}
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold ml-1", isActive ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600")}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {tab === "requests" && filteredRequests.length > 0 && canDelete('corrective') && (
            <Button variant="destructive" className="shadow-sm" onClick={handleDeleteAllRequests}>
              <Trash2 size={16} className="mr-2" /> Hapus Semua
            </Button>
          )}
          {tab === "spk" && (
            <select value={filterSpkStatus} onChange={(e) => setFilterSpkStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
              <option value="">Semua Status SPK</option>
              <option value="baru_import">Tugas Baru</option>
              <option value="eksekusi">Eksekusi</option>
              <option value="menunggu_review_kadis_pp">Review Kadis PP</option>
              <option value="menunggu_review_kadis_pelapor">Review Pelapor</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div key={tab} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        {tab === "requests" && (
          <RequestsTable
            loading={loading} filteredRequests={filteredRequests}
            onSelectRequest={setSelectedRequest}
            onApprovePlanner={triggerApprovePlanner}
            onEditSapNumber={triggerEditSapNumber}
            onDeleteRequest={handleDeleteRequest}
          />
        )}
        {tab === "spk" && (
          <SpkTable
            loading={loading} spks={spks}
            onSelectSpk={setSelectedSpk}
            onApproveKadisPp={triggerApproveKadisPp}
            onRejectKadisPp={triggerRejectKadisPp}
            onDeleteSpk={handleDeleteSpk}
          />
        )}
        {tab === "history" && (
          <HistoryTable
            loading={loading} history={history}
            onSelectSpk={setSelectedSpk}
            onDeleteSpk={handleDeleteSpk}
          />
        )}
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <RequestDetailDialog
        selectedRequest={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onApprovePlanner={triggerApprovePlanner}
        onRejectPlanner={triggerRejectPlanner}
      />

      <ApproveSapDialog
        state={approveSapState}
        onClose={() => setApproveSapState(null)}
        onConfirm={confirmApproveSap}
        confirming={confirming}
      />

      <SpkDetailDialog
        selectedSpk={selectedSpk}
        onClose={() => setSelectedSpk(null)}
        onApproveKadisPp={triggerApproveKadisPp}
        onRejectKadisPp={triggerRejectKadisPp}
      />

      <ExcelPreviewDialog
        previewData={previewData} skippedData={skippedData} savingExcel={savingExcel}
        onClose={() => { setPreviewData(null); setSkippedData(null); }}
        onConfirm={handleConfirmUpload}
      />

      <ManualCreateDialog
        open={showManualForm}
        onClose={() => setShowManualForm(false)}
        onSubmit={submitManualSpk}
      />

      {/* Confirm Dialog */}
      <Dialog open={!!confirmState} onOpenChange={(o) => !o && setConfirmState(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{confirmState?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-slate-600">{confirmState?.message}</p>
            {confirmState?.withNotes && (
              <textarea
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Tambahkan catatan jika perlu..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50"
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmState(null)} disabled={confirmBusy}>
              Batal
            </Button>
            <Button onClick={runConfirm} disabled={confirmBusy}>
              {confirmBusy ? "Memproses..." : "Ya, Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
