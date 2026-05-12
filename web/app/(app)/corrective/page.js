"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Upload,
  Inbox,
  FileText,
  CheckCircle2,
  Trash2,
  LayoutDashboard,
  Plus,
  Download,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { canCreate, canDelete, getUser } from "@/lib/auth";

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
import { usePagination, PaginationControls } from "./_components/Pagination";

export default function CorrectivePage() {
  const [user, setUser] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isExportMode, setIsExportMode] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [selectedExportIds, setSelectedExportIds] = useState([]);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [highlightCheckboxes, setHighlightCheckboxes] = useState(false);
  const highlightTimeout = useRef(null);

  const triggerHighlightCheckboxes = () => {
    setHighlightCheckboxes(true);
    if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
    highlightTimeout.current = setTimeout(() => {
      setHighlightCheckboxes(false);
    }, 10000);
  };

  useEffect(() => {
    setIsMounted(true);
    setUser(getUser());
  }, []);

  const isPlanner =
    isMounted &&
    (user?.role === "admin" ||
      (user?.group && user.group.toLowerCase().includes("perencanaan")));

  const isKadisPp =
    isMounted &&
    (user?.role === "admin" ||
      (user?.role === "kadis" && user?.dinas?.toLowerCase().includes("pusat perawatan")));

  const data = useCorrective();
  const {
    requests,
    spks: rawSpks,
    history: rawHistory,
    equipment,
    functionalLocations,
    loading,
    filteredRequests,
    filterApprovalStatus,
    setFilterApprovalStatus,
    filterSpkStatus,
    setFilterSpkStatus,
    loadAll,
    uploadExcel,
    confirmBulkInsert,
    submitManualSpk,
    approvePlannerAction,
    rejectPlannerAction,
    updateSapNumberAction,
    approveKadisPpAction,
    rejectKadisPpAction,
    approveKadisPelaporAction,
    rejectKadisPelaporAction,
    deleteRequestAction,
    deleteAllRequestsAction,
    deleteSpkAction,
    deleteAllSpksAction,
    uploadHistoryExcelAction,
    adminUpdateStatusAction,
    updateSapSpkAction,
    exportHistoryAction,
  } = data;

  // Kadis non-PP: only see their own SPKs based on notification.kadisPelaporId
  const isKadisNonPp =
    isMounted &&
    user?.role === "kadis" &&
    !(user?.dinas?.toLowerCase().includes("pusat perawatan"));

  const spks = isKadisNonPp
    ? rawSpks.filter((s) => s.notification?.kadisPelaporId === user.id)
    : rawSpks;
  const history = useMemo(() => {
    let result = isKadisNonPp
      ? rawHistory.filter((s) => s.notification?.kadisPelaporId === user.id)
      : rawHistory;

    if (exportStartDate) {
      result = result.filter(h => {
        const d = h.created_at ? h.created_at.slice(0, 10) : "";
        return d && d >= exportStartDate;
      });
    }
    if (exportEndDate) {
      result = result.filter(h => {
        const d = h.created_at ? h.created_at.slice(0, 10) : "";
        return d && d <= exportEndDate;
      });
    }
    return result;
  }, [rawHistory, exportStartDate, exportEndDate, isKadisNonPp, user?.id]);

  const [filterWorkCenter, setFilterWorkCenter] = useState("");

  // Apply work center filter on SPKs
  const filteredSpks = filterWorkCenter
    ? spks.filter((s) => (s.work_center || "").toLowerCase().startsWith(filterWorkCenter.toLowerCase()))
    : spks;

  const [tab, setTab] = useState("requests");

  // Pagination
  const [reqPage, setReqPage] = useState(1);
  const [spkPage, setSpkPage] = useState(1);
  const [histPage, setHistPage] = useState(1);

  // Reset page when filters/tab change
  useEffect(() => { setSpkPage(1); }, [filterWorkCenter, filterSpkStatus]);
  useEffect(() => { 
    setReqPage(1); 
    setSpkPage(1); 
    setHistPage(1); 

    // Reset export mode if navigating away
    setIsExportMode(false);
    setSelectedExportIds([]);
    setExportStartDate("");
    setExportEndDate("");
    setHighlightCheckboxes(false);
  }, [tab]);

  const reqPag = usePagination(filteredRequests, reqPage, setReqPage);
  const spkPag = usePagination(filteredSpks, spkPage, setSpkPage);
  const histPag = usePagination(history, histPage, setHistPage);

  // Detail dialogs
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedSpk, setSelectedSpk] = useState(null);

  // Upload Excel
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [skippedData, setSkippedData] = useState(null);
  const [savingExcel, setSavingExcel] = useState(false);
  const fileInputRef = useRef(null);
  const fileInputHistoryRef = useRef(null);

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
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmState(null);
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

  async function handleHistoryFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadHistoryExcelAction(file);
    } catch (err) {
      toast.error(err.message || "Terjadi kesalahan saat upload history");
    } finally {
      setUploading(false);
      if (fileInputHistoryRef.current) fileInputHistoryRef.current.value = "";
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
    setApproveSapState({
      id: req.id,
      isEdit: true,
      initialValue: req.sapOrderNumber || "",
    });
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
        if (!notes || !notes.trim())
          throw new Error("Alasan penolakan wajib diisi");
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
      async () => {
        await approveKadisPpAction(orderNumber);
      },
    );
  }

  function triggerRejectKadisPp(orderNumber) {
    confirmAction(
      "Tolak Pekerjaan (Kadis PP)",
      `Masukkan alasan mengapa pekerjaan SPK ${orderNumber} ditolak:`,
      async (notes) => {
        if (!notes || !notes.trim())
          throw new Error("Alasan penolakan wajib diisi");
        await rejectKadisPpAction(orderNumber, notes);
      },
      true,
    );
  }

  // ── Approve / Reject Kadis Pelapor ───────────────────────────────────────
  function triggerApproveKadisPelapor(orderNumber) {
    confirmAction(
      "Setujui Pekerjaan (Kadis Pelapor)",
      `Anda yakin pekerjaan untuk SPK ${orderNumber} telah selesai sesuai harapan?`,
      async () => {
        await approveKadisPelaporAction(orderNumber);
      },
    );
  }

  function triggerRejectKadisPelapor(orderNumber) {
    confirmAction(
      "Tolak Pekerjaan (Kadis Pelapor)",
      `Masukkan alasan mengapa pekerjaan SPK ${orderNumber} ditolak:`,
      async (notes) => {
        if (!notes || !notes.trim())
          throw new Error("Alasan penolakan wajib diisi");
        await rejectKadisPelaporAction(orderNumber, notes);
      },
      true,
    );
  }

  // ── Delete Handlers ─────────────────────────────────────────────────────
  function handleDeleteAllRequests() {
    confirmAction(
      "Hapus Semua Notifikasi",
      "Anda yakin ingin menghapus SELURUH data notifikasi yang belum dibuat SPK?",
      async () => {
        await deleteAllRequestsAction();
      },
    );
  }

  function handleDeleteRequest(id) {
    confirmAction(
      "Hapus Notifikasi",
      `Anda yakin ingin menghapus notifikasi ${id}?`,
      async () => {
        await deleteRequestAction(id);
      },
    );
  }

  function handleDeleteAllSpks() {
    confirmAction(
      "Hapus Semua SPK SAP",
      "Anda yakin ingin menghapus SELURUH data SPK SAP aktif dan riwayat?",
      async () => {
        await deleteAllSpksAction();
      },
    );
  }

  function handleDeleteSpk(orderNumber) {
    confirmAction(
      "Hapus SPK SAP",
      `Anda yakin ingin menghapus SPK ${orderNumber}?`,
      async () => {
        await deleteSpkAction(orderNumber);
      },
    );
  }

  // ── Tabs ────────────────────────────────────────────────────────────────
  const TABS = [
    {
      key: "requests",
      label: "Notifikasi",
      icon: Inbox,
      count: filteredRequests.length,
    },
    {
      key: "spk",
      label: "SPK Aktif (SAP)",
      icon: FileText,
      count: spks.length,
    },
    {
      key: "history",
      label: "History",
      icon: CheckCircle2,
      count: history.length,
    },
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
              {isPlanner ? "Corrective Planner" : "Corrective"}
            </h2>
          </div>
          <p className="text-slate-500 text-sm ml-9">
            Kelola laporan notifikasi dan integrasikan ekspor SPK dari SAP.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
          />
          {canCreate("corrective") && isPlanner && (
            <Button
              variant="outline"
              className="shadow-md bg-white hover:bg-slate-50 border-slate-200"
              onClick={() => setShowManualForm(true)}
            >
              <Plus size={16} className="mr-2" /> Create Manual
            </Button>
          )}
          {canCreate("corrective") && isPlanner && (
            <Button
              variant="default"
              className="shadow-md bg-blue-600 hover:bg-blue-700"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={16} className="mr-2" />
              {uploading ? "Mengunggah..." : "Import SAP"}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={loadAll}
            disabled={loading}
            className="shrink-0 bg-white shadow-sm hover:bg-slate-50"
          >
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
                  isActive
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50",
                )}
              >
                <Icon
                  size={16}
                  className={isActive ? "text-blue-600" : "text-slate-400"}
                />
                {t.label}
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-semibold ml-1",
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-200 text-slate-600",
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {tab === "requests" &&
            filteredRequests.length > 0 &&
            canDelete("corrective") && (
              <Button
                variant="destructive"
                className="shadow-sm"
                onClick={handleDeleteAllRequests}
              >
                <Trash2 size={16} className="mr-2" /> Hapus Semua
              </Button>
            )}
          {tab === "spk" && (
            <>
              <select
                value={filterWorkCenter}
                onChange={(e) => setFilterWorkCenter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              >
                <option value="">Semua Work Center</option>
                <option value="E">Elektrik</option>
                <option value="M">Mekanik</option>
                <option value="S">Sipil</option>
                <option value="O">Otomasi</option>
              </select>
              <select
                value={filterSpkStatus}
                onChange={(e) => setFilterSpkStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              >
                <option value="">Semua Status SPK</option>
                <option value="baru_import">Tugas Baru</option>
                <option value="eksekusi">Eksekusi</option>
                <option value="menunggu_review_kadis_pp">Review Kadis PP</option>
                <option value="menunggu_review_kadis_pelapor">
                  Review Pelapor
                </option>
              </select>
            </>
          )}
          {tab === "history" && isPlanner && (
            <div className="flex items-center gap-2">
              {isExportMode ? (
                <>
                  <Popover>
                    <PopoverTrigger
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-[140px] justify-start text-left font-normal bg-white h-10",
                        !exportStartDate && "text-slate-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {exportStartDate ? format(new Date(exportStartDate), "dd MMM yyyy", { locale: idLocale }) : <span>Tgl Mulai</span>}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={exportStartDate ? new Date(exportStartDate) : undefined}
                        onSelect={(date) => setExportStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-sm text-slate-500">s/d</span>
                  <Popover>
                    <PopoverTrigger
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-[140px] justify-start text-left font-normal bg-white h-10",
                        !exportEndDate && "text-slate-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {exportEndDate ? format(new Date(exportEndDate), "dd MMM yyyy", { locale: idLocale }) : <span>Tgl Akhir</span>}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={exportEndDate ? new Date(exportEndDate) : undefined}
                        onSelect={(date) => setExportEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    className="shadow-md bg-white border-slate-200"
                    onClick={() => {
                      setIsExportMode(false);
                      setSelectedExportIds([]);
                      setExportStartDate("");
                      setExportEndDate("");
                      setHighlightCheckboxes(false);
                    }}
                  >
                    Batal
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "shadow-md border-green-200 text-green-700 transition-all",
                      selectedExportIds.length === 0 
                        ? "opacity-50 cursor-not-allowed bg-slate-50" 
                        : "bg-white hover:bg-green-50"
                    )}
                    disabled={exportingExcel}
                    onClick={async () => {
                      if (selectedExportIds.length === 0) {
                        toast.error("Pilih minimal satu data terlebih dahulu!");
                        triggerHighlightCheckboxes();
                        return;
                      }
                      setExportingExcel(true);
                      try {
                        await exportHistoryAction(selectedExportIds);
                        setIsExportMode(false);
                        setSelectedExportIds([]);
                        setExportStartDate("");
                        setExportEndDate("");
                        setHighlightCheckboxes(false);
                      } catch (e) {
                        // error handled in action
                      } finally {
                        setExportingExcel(false);
                      }
                    }}
                  >
                    <Download size={16} className="mr-2" /> {exportingExcel ? "Mengekspor..." : "Export Excel"}
                  </Button>
                </>
              ) : (
                <>
                  <input
                    type="file"
                    ref={fileInputHistoryRef}
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={handleHistoryFileUpload}
                  />
                  {user?.role === "admin" && (
                    <Button
                      variant="outline"
                      className="shadow-md bg-white hover:bg-slate-50 border-slate-200"
                      onClick={() => fileInputHistoryRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload size={16} className="mr-2" />
                      {uploading ? "Mengunggah..." : "Import History TECO"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="shadow-md bg-white hover:bg-green-50 border-green-200 text-green-700"
                    onClick={() => setIsExportMode(true)}
                  >
                    <Download size={16} className="mr-2" /> Mode Export Excel
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div
        key={`${tab}-${isExportMode}-${exportStartDate}-${exportEndDate}-${filterSpkStatus}-${filterApprovalStatus}-${filterWorkCenter}`}
        className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        {tab === "requests" && (
          <>
            <RequestsTable
              loading={loading}
              filteredRequests={reqPag.paginatedItems}
              onSelectRequest={setSelectedRequest}
              onApprovePlanner={triggerApprovePlanner}
              onEditSapNumber={triggerEditSapNumber}
              onDeleteRequest={handleDeleteRequest}
            />
            <PaginationControls page={reqPag.safePage} totalPages={reqPag.totalPages} totalItems={reqPag.totalItems} onPageChange={setReqPage} />
          </>
        )}
        {tab === "spk" && (
          <>
            <SpkTable
              loading={loading}
              spks={spkPag.paginatedItems}
              equipment={equipment}
              functionalLocations={functionalLocations}
              isKadisPp={isKadisPp}
              userId={user?.id}
              userNik={user?.nik}
              userRole={user?.role}
              onSelectSpk={setSelectedSpk}
              onApproveKadisPp={triggerApproveKadisPp}
              onRejectKadisPp={triggerRejectKadisPp}
              onApproveKadisPelapor={triggerApproveKadisPelapor}
              onRejectKadisPelapor={triggerRejectKadisPelapor}
              onDeleteSpk={handleDeleteSpk}
            />
            <PaginationControls page={spkPag.safePage} totalPages={spkPag.totalPages} totalItems={spkPag.totalItems} onPageChange={setSpkPage} />
          </>
        )}
        {tab === "history" && (
          <>
            <HistoryTable
              loading={loading}
              history={histPag.paginatedItems}
              fullHistory={history}
              equipment={equipment}
              onSelectSpk={setSelectedSpk}
              onDeleteSpk={handleDeleteSpk}
              isExportMode={isExportMode}
              selectedExportIds={selectedExportIds}
              setSelectedExportIds={setSelectedExportIds}
              highlightCheckboxes={highlightCheckboxes}
            />
            <PaginationControls page={histPag.safePage} totalPages={histPag.totalPages} totalItems={histPag.totalItems} onPageChange={setHistPage} />
          </>
        )}
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <RequestDetailDialog
        selectedRequest={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onApprovePlanner={triggerApprovePlanner}
        onRejectPlanner={triggerRejectPlanner}
        userRole={user?.role}
        onAdminUpdateStatus={adminUpdateStatusAction}
      />

      <ApproveSapDialog
        state={approveSapState}
        onClose={() => setApproveSapState(null)}
        onConfirm={confirmApproveSap}
        confirming={confirming}
      />

      <SpkDetailDialog
        selectedSpk={selectedSpk}
        equipment={equipment}
        functionalLocations={functionalLocations}
        onClose={() => setSelectedSpk(null)}
        isKadisPp={isKadisPp}
        userId={user?.id}
        userNik={user?.nik}
        userRole={user?.role}
        userGroup={user?.group}
        onApproveKadisPp={triggerApproveKadisPp}
        onRejectKadisPp={triggerRejectKadisPp}
        onApproveKadisPelapor={triggerApproveKadisPelapor}
        onRejectKadisPelapor={triggerRejectKadisPelapor}
        onUpdateSpk={updateSapSpkAction}
      />

      <ExcelPreviewDialog
        previewData={previewData}
        skippedData={skippedData}
        savingExcel={savingExcel}
        onClose={() => {
          setPreviewData(null);
          setSkippedData(null);
        }}
        onConfirm={handleConfirmUpload}
      />

      <ManualCreateDialog
        open={showManualForm}
        onClose={() => setShowManualForm(false)}
        onSubmit={submitManualSpk}
      />

      {/* Confirm Dialog */}
      <Dialog
        open={!!confirmState}
        onOpenChange={(o) => !o && setConfirmState(null)}
      >
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
            <Button
              variant="ghost"
              onClick={() => setConfirmState(null)}
              disabled={confirmBusy}
            >
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
