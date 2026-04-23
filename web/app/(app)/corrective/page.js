"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  RefreshCw,
  Upload,
  FileSpreadsheet,
  Inbox,
  AlertCircle,
  AlertTriangle,
  FileText,
  Wrench,
  CheckCircle2,
  Trash2,
  Edit2,
  Activity,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const APPROVAL_LABELS = {
  pending: "Menunggu Approval",
  approved: "Sudah Disetujui",
  rejected: "Ditolak",
};

const APPROVAL_COLORS = {
  pending: "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200",
};

const NOTIF_STATUS_LABELS = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

const NOTIF_STATUS_COLORS = {
  submitted: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  approved: "bg-green-100 text-green-700 hover:bg-green-100",
  rejected: "bg-red-100 text-red-600 hover:bg-red-100",
};

const SAP_STATUS_LABELS = {
  baru_import: "Tugas Baru",
  eksekusi: "Eksekusi",
  menunggu_review_kadis_pp: "Review Kadis PP",
  menunggu_review_kadis_pelapor: "Review Pelapor",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

const SAP_STATUS_COLORS = {
  baru_import: "bg-gray-100 text-gray-600 hover:bg-gray-100",
  eksekusi: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  menunggu_review_kadis_pp: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  menunggu_review_kadis_pelapor:
    "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  selesai: "bg-green-100 text-green-700 hover:bg-green-100",
  ditolak: "bg-red-100 text-red-600 hover:bg-red-100",
};

const SAP_SPK_STEPS = [
  { label: "Baru", key: "baru_import" },
  { label: "Eksekusi", key: "eksekusi" },
  { label: "Review Kadis PP", key: "menunggu_review_kadis_pp" },
  { label: "Review Pelapor", key: "menunggu_review_kadis_pelapor" },
  { label: "Selesai", key: "selesai" },
];

function fmtDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ value, colorMap, labelMap }) {
  const colorClass = colorMap?.[value] || "bg-gray-100 text-gray-600";
  const label = labelMap?.[value] || value || "-";
  return (
    <Badge
      className={cn(
        "px-2 py-0.5 text-xs font-semibold border-transparent",
        colorClass,
      )}
    >
      {label}
    </Badge>
  );
}

export default function CorrectivePage() {
  const [tab, setTab] = useState("requests");
  const [requests, setRequests] = useState([]);
  const [spks, setSpks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterApprovalStatus, setFilterApprovalStatus] = useState("");
  const [filterSpkStatus, setFilterSpkStatus] = useState("");

  // Detail dialogs
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedSpk, setSelectedSpk] = useState(null);

  // Upload Excel
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [skippedData, setSkippedData] = useState(null);
  const [savingExcel, setSavingExcel] = useState(false);
  const fileInputRef = useRef(null);

  // Confirm dialog
  const [confirmState, setConfirmState] = useState(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqData, sapSpkRes] = await Promise.all([
        apiGet("/corrective/requests"),
        apiGet("/corrective/sap-spk"),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);

      const allSpks = Array.isArray(sapSpkRes?.data) ? sapSpkRes.data : [];
      let filteredSpks = allSpks;
      if (filterSpkStatus) {
        filteredSpks = allSpks.filter((s) => s.status === filterSpkStatus);
      }

      setSpks(
        filteredSpks.filter(
          (s) => s.status !== "selesai" && s.status !== "ditolak",
        ),
      );
      setHistory(
        allSpks.filter((s) => s.status === "selesai" || s.status === "ditolak"),
      );
    } catch (e) {
      toast.error("Gagal memuat data: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [filterSpkStatus]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const filteredRequests = (
    filterApprovalStatus
      ? requests.filter((r) => r.approvalStatus === filterApprovalStatus)
      : requests
  ).sort((a, b) => {
    // Priority 1: Pending (Menunggu Approval) always on top
    if (a.approvalStatus === "pending" && b.approvalStatus !== "pending")
      return -1;
    if (a.approvalStatus !== "pending" && b.approvalStatus === "pending")
      return 1;

    // Priority 2: Newest first
    return (
      new Date(b.notificationDate || b.submittedAt || 0) -
      new Date(a.notificationDate || a.submittedAt || 0)
    );
  });

  function confirmAction(title, message, onConfirm, withNotes = false) {
    setConfirmNotes("");
    setConfirmState({ title, message, withNotes, onConfirm });
  }

  async function runConfirm() {
    if (!confirmState) return;
    setConfirming(true);
    try {
      await confirmState.onConfirm(confirmNotes);
      setConfirmState(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirming(false);
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("excelFile", file);

      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : "";
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/corrective/sap-spk/upload-excel`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );
      const resData = await res.json();
      if (resData.status === "success") {
        toast.success(resData.message);
        setPreviewData(resData.data.previewData);
        setSkippedData(resData.data.skippedData);
      } else {
        toast.error(resData.message || "Gagal mengupload file");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewData || previewData.length === 0) return;
    setSavingExcel(true);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : "";
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/corrective/sap-spk/bulk-insert`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ spks: previewData }),
        },
      );
      const data = await res.json();
      if (data.status === "success") {
        toast.success(data.message);
        setPreviewData(null);
        setSkippedData(null);
        loadAll();
      } else {
        toast.error(data.message || "Gagal menyimpan data");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat menyimpan data");
    } finally {
      setSavingExcel(false);
    }
  };

  // Approve with SAP Flow
  const [approveSapState, setApproveSapState] = useState(null);
  const [sapOrderNumberInput, setSapOrderNumberInput] = useState("");

  function triggerApprovePlanner(id) {
    setSapOrderNumberInput("");
    setApproveSapState({ id, isEdit: false });
  }

  function triggerEditSapNumber(req) {
    setSapOrderNumberInput(req.sapOrderNumber || "");
    setApproveSapState({ id: req.id, isEdit: true });
  }

  function triggerRejectPlanner(id) {
    confirmAction(
      "Tolak Laporan Notifikasi",
      `Silakan masukkan alasan penolakan untuk laporan ${id}. Alasan ini akan dikirimkan kepada pelapor.`,
      async (notes) => {
        if (!notes || !notes.trim()) {
          throw new Error("Alasan penolakan wajib diisi");
        }
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : "";
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/corrective/requests/${id}/reject-planner`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ rejectionReason: notes }),
          },
        );
        const data = await res.json();
        if (res.ok) {
          toast.success("Laporan berhasil ditolak");
          loadAll();
          setSelectedRequest(null);
        } else {
          toast.error(data.error || "Gagal menolak laporan");
        }
      },
      true,
    );
  }

  async function confirmApproveSap() {
    if (!/^\d{10}$/.test(sapOrderNumberInput)) {
      toast.error("Nomor SAP harus 10 digit angka!");
      return;
    }

    setConfirming(true);
    try {
      const endpoint = approveSapState.isEdit
        ? `/corrective/requests/${approveSapState.id}/update-sap-number`
        : `/corrective/requests/${approveSapState.id}/approve-planner`;

      await apiPost(endpoint, {
        sapOrderNumber: sapOrderNumberInput,
      });

      toast.success(
        approveSapState.isEdit
          ? "Nomor SAP berhasil diperbarui"
          : "Laporan berhasil diterima",
      );
      setApproveSapState(null);
      loadAll();
    } catch (error) {
      toast.error(error.message || "Gagal memproses data");
    } finally {
      setConfirming(false);
    }
  }

  async function deleteAllRequests() {
    confirmAction(
      "Hapus Semua Notifikasi",
      "Anda yakin ingin menghapus SELURUH data notifikasi yang belum dibuat SPK?",
      async () => {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : "";
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/corrective/requests`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await res.json();
        if (res.ok) {
          toast.success(data.message || "Berhasil dihapus");
          loadAll();
        } else {
          toast.error(data.error || "Gagal menghapus");
        }
      },
    );
  }

  async function deleteRequest(id) {
    confirmAction(
      "Hapus Notifikasi",
      `Anda yakin ingin menghapus notifikasi ${id}?`,
      async () => {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : "";
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/corrective/requests/${id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await res.json();
        if (res.ok) {
          toast.success(data.message || "Berhasil dihapus");
          loadAll();
        } else {
          toast.error(data.error || "Gagal menghapus");
        }
      },
    );
  }

  async function deleteAllSpks() {
    confirmAction(
      "Hapus Semua SPK SAP",
      "Anda yakin ingin menghapus SELURUH data SPK SAP aktif dan riwayat?",
      async () => {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : "";
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/corrective/sap-spk`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await res.json();
        if (data.status === "success") {
          toast.success(data.message);
          loadAll();
        } else {
          toast.error(data.message || "Gagal menghapus");
        }
      },
    );
  }

  async function deleteSpk(order_number) {
    confirmAction(
      "Hapus SPK SAP",
      `Anda yakin ingin menghapus SPK ${order_number}?`,
      async () => {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : "";
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/corrective/sap-spk/${order_number}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await res.json();
        if (data.status === "success") {
          toast.success(data.message);
          loadAll();
        } else {
          toast.error(data.message || "Gagal menghapus");
        }
      },
    );
  }

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
      {/* Header Area */}
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
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
          />
          <Button
            variant="default"
            className="shadow-md bg-blue-600 hover:bg-blue-700"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={16} className="mr-2" />
            {uploading ? "Mengunggah..." : "Upload Excel SAP"}
          </Button>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Inbox size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Laporan
            </p>
            <p className="text-2xl font-extrabold text-slate-900 truncate">
              {requests.length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Butuh Approval
            </p>
            <p className="text-2xl font-extrabold text-slate-900 truncate">
              {requests.filter((r) => r.approvalStatus === "pending").length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <FileText size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              SPK Aktif
            </p>
            <p className="text-2xl font-extrabold text-slate-900 truncate">
              {spks.length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <Activity size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sedang Dikerjakan
            </p>
            <p className="text-2xl font-extrabold text-slate-900 truncate">
              {
                spks.filter(
                  (s) => s.status === "eksekusi" || s.sys_status?.includes("EXEC"),
                ).length
              }
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Tabs & Filters */}
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

        {/* Dynamic Filters based on active tab */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {tab === "requests" && filteredRequests.length > 0 && (
            <Button
              variant="destructive"
              className="shadow-sm"
              onClick={deleteAllRequests}
            >
              <Trash2 size={16} className="mr-2" />
              Hapus Semua
            </Button>
          )}
          {tab === "requests" && (
            <select
              value={filterApprovalStatus}
              onChange={(e) => setFilterApprovalStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
            >
              <option value="">Semua Status</option>
              <option value="pending">Menunggu Approval</option>
              <option value="approved">Sudah Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          )}
          {tab === "spk" && (
            <select
              value={filterSpkStatus}
              onChange={(e) => setFilterSpkStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            >
              <option value="">Semua Status SPK</option>
              <option value="baru_import">Baru</option>
              <option value="eksekusi">Eksekusi</option>
              <option value="menunggu_review_kadis_pp">Review Kadis PP</option>
              <option value="menunggu_review_kadis_pelapor">
                Review Pelapor
              </option>
            </select>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {tab === "requests" && (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead>ID Laporan</TableHead>
                <TableHead>Info Waktu & Pelapor</TableHead>
                <TableHead>Lokasi & Equipment</TableHead>
                <TableHead>No. SAP SPK</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-16">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-slate-400"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <EmptyState
                      icon={Inbox}
                      text="Belum ada laporan notifikasi"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    onClick={() => setSelectedRequest(req)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-slate-700">
                      {req.id}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-800">
                        {fmtDate(req.notificationDate || req.submittedAt)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {req.reportedBy || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="font-medium text-slate-800 truncate max-w-[200px]"
                        title={req.equipment}
                      >
                        {req.equipment || "—"}
                      </div>
                      <div
                        className="text-xs text-slate-500 truncate max-w-[200px]"
                        title={req.functionalLocation}
                      >
                        {req.functionalLocation || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 group">
                        <span className="font-mono text-xs text-slate-600">
                          {req.sapOrderNumber || "—"}
                        </span>
                        {req.approvalStatus === "approved" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerEditSapNumber(req);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-all"
                            title="Edit Nomor SAP"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        value={req.approvalStatus}
                        colorMap={APPROVAL_COLORS}
                        labelMap={APPROVAL_LABELS}
                      />
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shadow-sm"
                          onClick={() => setSelectedRequest(req)}
                        >
                          Detail
                        </Button>
                        {req.status === "submitted" &&
                          req.approvalStatus === "pending" && (
                            <Button
                              size="sm"
                              className="h-8 shadow-sm"
                              onClick={() => triggerApprovePlanner(req.id)}
                            >
                              Terima
                            </Button>
                          )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => deleteRequest(req.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {tab === "spk" && (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Tanggal Posting</TableHead>
                <TableHead>Equipment & Lokasi</TableHead>
                <TableHead>Jam / Pekerja</TableHead>
                <TableHead>Status SAP</TableHead>
                <TableHead className="text-right pr-16">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-slate-400"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : spks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <EmptyState icon={FileText} text="Belum ada SPK aktif" />
                  </TableCell>
                </TableRow>
              ) : (
                spks.map((spk) => (
                  <TableRow
                    key={spk.order_number}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    onClick={() => setSelectedSpk(spk)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-slate-800">
                      {spk.order_number}
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      {fmtDate(spk.posting_date)}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div
                        className="font-medium text-slate-800 truncate"
                        title={spk.equipment_name}
                      >
                        {spk.equipment_name || "—"}
                      </div>
                      <div
                        className="text-[11px] text-slate-500 truncate"
                        title={spk.functional_location}
                      >
                        {spk.functional_location || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-bold text-slate-700">
                        {spk.dur_plan || 0} Jam / {spk.num_of_work || 0} Orang
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-tight font-bold">
                        Planned
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-bold text-slate-700 font-mono tracking-tight leading-none">
                        {spk.sys_status || "—"}
                      </span>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shadow-sm"
                          onClick={() => setSelectedSpk(spk)}
                        >
                          Detail
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => deleteSpk(spk.order_number)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {tab === "history" && (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Tanggal Posting</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Status SAP</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-slate-400"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <EmptyState
                      icon={CheckCircle2}
                      text="Belum ada riwayat SPK"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                history.map((spk) => (
                  <TableRow
                    key={spk.order_number}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    onClick={() => setSelectedSpk(spk)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-slate-800">
                      {spk.order_number}
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      {fmtDate(spk.posting_date)}
                    </TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[200px]">
                      {spk.equipment_name || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        value={spk.status}
                        colorMap={SAP_STATUS_COLORS}
                        labelMap={SAP_STATUS_LABELS}
                      />
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shadow-sm"
                          onClick={() => setSelectedSpk(spk)}
                        >
                          Detail
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => deleteSpk(spk.order_number)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Request Detail Dialog */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={(o) => !o && setSelectedRequest(null)}
      >
        <DialogContent showCloseButton={false} className="max-w-[95vw] lg:max-w-[75vw] max-h-[90vh] overflow-hidden p-0 rounded-2xl gap-0">
          <div className="overflow-y-auto max-h-[90vh]">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-8 py-6 border-b border-slate-100 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Detail Laporan Notifikasi
                </DialogTitle>
                <div className="text-sm font-mono text-slate-400 mt-1">
                  {selectedRequest?.id}
                </div>
              </div>
              <div className="flex gap-2">
                <StatusBadge
                  value={selectedRequest?.approvalStatus}
                  colorMap={APPROVAL_COLORS}
                  labelMap={APPROVAL_LABELS}
                />
              </div>
            </div>
          </div>

          {selectedRequest && (
            <div className="p-8 space-y-8">
              {/* Row 1: Key info cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoCard
                  label="Notification ID"
                  value={selectedRequest.id}
                  mono
                />
                {selectedRequest.sapOrderNumber && (
                  <InfoCard
                    label="SAP Order Number"
                    value={selectedRequest.sapOrderNumber}
                    mono
                    className="bg-blue-50 border-blue-200"
                  />
                )}
                <InfoCard
                  label="Tipe Notifikasi"
                  value={selectedRequest.notificationType}
                />
                <InfoCard
                  label="Work Center"
                  value={selectedRequest.workCenter}
                />
                <InfoCard
                  label="Dilaporkan Oleh"
                  value={selectedRequest.reportedBy}
                />
              </div>

              {/* Row 2: Equipment & Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section title="Informasi Peralatan">
                  <Row label="Equipment" value={selectedRequest.equipment} />
                  <Row
                    label="Functional Location"
                    value={selectedRequest.functionalLocation}
                  />
                </Section>
                <Section title="Jadwal">
                  <Row
                    label="Tanggal Lapor"
                    value={fmtDate(
                      selectedRequest.notificationDate ||
                        selectedRequest.submittedAt,
                    )}
                  />
                  <Row
                    label="Target Mulai"
                    value={fmtDate(selectedRequest.requiredStart)}
                  />
                  <Row
                    label="Target Selesai"
                    value={fmtDate(selectedRequest.requiredEnd)}
                  />
                </Section>
              </div>

              {/* Row 3: Description */}
              <Section title="Deskripsi Kerusakan">
                <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100/50">
                  <p className="font-semibold text-slate-800 mb-2 text-base">
                    {selectedRequest.description || "Tanpa judul"}
                  </p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {selectedRequest.longText || "Tidak ada deskripsi panjang."}
                  </p>
                </div>
              </Section>

              {/* Row: Rejection Reason (if rejected) */}
              {selectedRequest.approvalStatus === "rejected" &&
                selectedRequest.rejectionReason && (
                  <Section title="Alasan Penolakan">
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-red-800 text-sm">
                      {selectedRequest.rejectionReason}
                    </div>
                  </Section>
                )}

              {/* Row 4: Photos */}
              {(selectedRequest.images || []).length > 0 && (
                <Section title="Foto Lapangan">
                  <div className="flex flex-wrap gap-4">
                    {selectedRequest.images.filter(Boolean).map((p, i) => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
                      const src = p.startsWith("http")
                        ? p
                        : p.startsWith("uploads/")
                          ? `${baseUrl}/${p}`
                          : `${baseUrl}/uploads/${p}`;
                      return (
                        <img
                          key={i}
                          src={src}
                          alt={`Attachment ${i + 1}`}
                          onClick={() => window.open(src, "_blank")}
                          className="w-36 h-36 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:shadow-lg transition-all hover:scale-105"
                        />
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>
          )}
          <div className="bg-slate-50/80 px-8 py-5 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0">
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Tutup
            </Button>
            {selectedRequest?.status === "submitted" &&
              selectedRequest?.approvalStatus === "pending" && (
                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    onClick={() => triggerRejectPlanner(selectedRequest.id)}
                    className="shadow-sm"
                  >
                    Tolak Laporan
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedRequest(null);
                      triggerApprovePlanner(selectedRequest.id);
                    }}
                    className="shadow-sm"
                  >
                    Terima Laporan
                  </Button>
                </div>
              )}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!approveSapState}
        onOpenChange={(o) => !o && setApproveSapState(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-md p-0 rounded-2xl overflow-hidden"
        >
          <div
            className={cn(
              "p-6 text-white text-center",
              approveSapState?.isEdit
                ? "bg-gradient-to-r from-slate-700 to-slate-600"
                : "bg-gradient-to-r from-blue-600 to-blue-500",
            )}
          >
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="text-white" size={24} />
            </div>
            <DialogTitle className="text-xl font-bold">
              {approveSapState?.isEdit ? "Update Nomor SAP" : "Terima Laporan"}
            </DialogTitle>
            <p className="text-blue-50/80 text-sm mt-1">
              {approveSapState?.isEdit
                ? "Sesuaikan nomor order SAP jika ada kesalahan"
                : "Masukkan nomor order SPK dari SAP untuk melanjutkan"}
            </p>
          </div>

          <div className="p-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  No. Order SPK SAP
                </label>
                <Input
                  placeholder="Masukkan 10 digit nomor SAP..."
                  value={sapOrderNumberInput}
                  onChange={(e) => setSapOrderNumberInput(e.target.value)}
                  maxLength={10}
                  className="h-12 text-lg font-mono tracking-widest text-center focus-visible:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 text-center">
                  Harus tepat 10 digit angka (0-9)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => setApproveSapState(null)}
                >
                  Batal
                </Button>
                <Button
                  className={cn(
                    "flex-1 h-11 shadow-md",
                    approveSapState?.isEdit
                      ? "bg-slate-800 hover:bg-slate-900"
                      : "bg-blue-600 hover:bg-blue-700",
                  )}
                  onClick={confirmApproveSap}
                  disabled={confirming}
                >
                  {confirming
                    ? "Memproses..."
                    : approveSapState?.isEdit
                      ? "Update"
                      : "Konfirmasi"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SPK Detail Dialog */}
      <Dialog
        open={!!selectedSpk}
        onOpenChange={(o) => !o && setSelectedSpk(null)}
      >
        <DialogContent showCloseButton={false} className="max-w-[95vw] lg:max-w-[80vw] max-h-[90vh] overflow-y-auto p-0 rounded-2xl gap-0">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-8 py-6 border-b border-slate-100 sticky top-0 z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Detail SPK SAP
                </DialogTitle>
                <div className="text-sm font-mono text-slate-400 mt-1">
                  {selectedSpk?.order_number}
                </div>
              </div>
              <StatusBadge
                value={selectedSpk?.status}
                colorMap={SAP_STATUS_COLORS}
                labelMap={SAP_STATUS_LABELS}
              />
            </div>

            {/* Progress Stepper */}
            <div className="flex items-center w-full relative max-w-xl mx-auto">
              {SAP_SPK_STEPS.map((step, i) => {
                const currentIdx = SAP_SPK_STEPS.findIndex(
                  (s) => s.key === selectedSpk?.status,
                );
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <div
                    key={step.key}
                    className="flex-1 relative flex flex-col items-center"
                  >
                    {i !== 0 && (
                      <div
                        className={cn(
                          "absolute top-3 left-[-50%] w-full h-[2px] -z-10",
                          done || active ? "bg-blue-500" : "bg-slate-200",
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-slate-50 transition-colors z-10",
                        done
                          ? "bg-blue-500 text-white"
                          : active
                            ? "bg-blue-600 text-white ring-blue-100"
                            : "bg-slate-200 text-slate-400",
                      )}
                    >
                      {done ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    <span
                      className={cn(
                        "text-xs mt-2 font-medium w-full text-center absolute top-8",
                        active
                          ? "text-blue-700"
                          : done
                            ? "text-slate-700"
                            : "text-slate-400",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="h-7"></div>
          </div>

          {selectedSpk && (
            <div className="p-8 space-y-8">
              {/* Row 1: 4-column grid for key info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoCard
                  label="Order Number"
                  value={selectedSpk.order_number}
                  mono
                />
                <InfoCard label="Status SAP" value={selectedSpk.sys_status} />
                <InfoCard label="Work Center" value={selectedSpk.work_center} />
                <InfoCard label="Control Key" value={selectedSpk.ctrl_key} />
              </div>

              {/* Row 2: Description full width */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard label="Deskripsi" value={selectedSpk.description} />
                <InfoCard label="Short Text" value={selectedSpk.short_text} />
              </div>

              {/* Row 3: Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Section title="Lokasi & Peralatan">
                  <Row label="Equipment" value={selectedSpk.equipment_name} />
                  <Row
                    label="Functional Loc"
                    value={selectedSpk.functional_location}
                  />
                  <Row label="Location" value={selectedSpk.location} />
                  <Row label="Cost Center" value={selectedSpk.cost_center} />
                </Section>
                <Section title="Perencanaan">
                  <Row
                    label="Jam Pekerja (Planned)"
                    value={`${selectedSpk.dur_plan || 0} ${selectedSpk.normal_dur_un || "Jam"} / ${selectedSpk.num_of_work || 0} Orang`}
                  />
                  <Row
                    label="Normal Duration"
                    value={`${selectedSpk.normal_dur || 0} ${selectedSpk.normal_dur_un || ""}`}
                  />
                  <Row
                    label="Unit for Work"
                    value={selectedSpk.unit_for_work}
                  />
                  <Row label="Activity" value={selectedSpk.activity} />
                  <Row
                    label="Maint. Activ. Type"
                    value={selectedSpk.maint_activ_type}
                  />
                </Section>
                <Section title="Jadwal & Aktual SAP">
                  <Row
                    label="Tgl Posting"
                    value={fmtDate(selectedSpk.posting_date)}
                  />
                  <Row
                    label="Work Start"
                    value={fmtDate(selectedSpk.work_start)}
                  />
                  <Row
                    label="Work Finish"
                    value={fmtDate(selectedSpk.work_finish)}
                  />
                  <Row label="Start Time" value={selectedSpk.start_time} />
                  <Row label="Finish Time" value={selectedSpk.finish_time} />
                  <Row
                    label="Durasi Aktual"
                    value={`${selectedSpk.dur_act || 0} ${selectedSpk.normal_dur_un || ""}`}
                  />
                  <Row
                    label="Actual Work"
                    value={`${selectedSpk.actual_work || 0} ${selectedSpk.unit_for_work || ""}`}
                  />
                </Section>
              </div>

              {/* Row 4: Additional info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoCard
                  label="Confirmation Text"
                  value={selectedSpk.conf_text}
                />
                <InfoCard
                  label="Confirm Number"
                  value={selectedSpk.confirm_number}
                />
                <InfoCard
                  label="Reason of Var"
                  value={selectedSpk.reason_of_var}
                />
                <InfoCard
                  label="Dilaporkan Oleh"
                  value={selectedSpk.report_by}
                />
              </div>

              {/* Execution Results */}
              {(selectedSpk.actual_materials ||
                selectedSpk.actual_tools ||
                selectedSpk.job_result_description ||
                selectedSpk.photo_before ||
                selectedSpk.photo_after) && (
                <div className="bg-orange-50/50 rounded-2xl border border-orange-100/50 p-5">
                  <h4 className="text-sm font-bold text-orange-800 mb-4 flex items-center gap-2">
                    <Wrench size={16} /> Laporan Eksekusi Teknisi
                  </h4>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard
                      label="Jam Pekerja (Planned)"
                      value={`${selectedSpk.dur_plan || 0} Jam / ${selectedSpk.num_of_work || 0} Org`}
                      className="bg-blue-50/50 border-blue-100"
                    />
                    <MetricCard
                      label="Pekerja Aktual"
                      value={`${selectedSpk.actual_personnel || 0} Orang`}
                    />
                    <MetricCard
                      label="Jam Aktual"
                      value={`${selectedSpk.total_actual_hour || 0} Jam`}
                    />
                    <MetricCard
                      label="Eksekutor NIK"
                      value={selectedSpk.execution_nik || "-"}
                      className="col-span-2 md:col-span-2"
                    />
                  </div>

                  <div className="space-y-4 text-sm text-slate-700">
                    <div>
                      <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
                        Material yang Digunakan
                      </strong>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        {selectedSpk.actual_materials || "-"}
                      </div>
                    </div>
                    <div>
                      <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
                        Tools yang Digunakan
                      </strong>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        {selectedSpk.actual_tools || "-"}
                      </div>
                    </div>
                    <div>
                      <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
                        Catatan Hasil Kerja
                      </strong>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">
                        {selectedSpk.job_result_description || "-"}
                      </div>
                    </div>
                  </div>

                  {(selectedSpk.photo_before || selectedSpk.photo_after) && (
                    <div className="mt-6 pt-6 border-t border-orange-200/50">
                      <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-3">
                        Foto Dokumentasi
                      </strong>
                      <div className="flex flex-wrap gap-4">
                        {selectedSpk.photo_before && (
                          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-block">
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_before}`}
                              onClick={() =>
                                window.open(
                                  `${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_before}`,
                                  "_blank",
                                )
                              }
                              className="w-36 h-36 object-cover rounded-lg cursor-zoom-in hover:opacity-90"
                              alt="Before"
                            />
                            <span className="text-xs font-semibold text-slate-600 block text-center mt-2">
                              Kondisi Awal
                            </span>
                          </div>
                        )}
                        {selectedSpk.photo_after && (
                          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-block">
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_after}`}
                              onClick={() =>
                                window.open(
                                  `${process.env.NEXT_PUBLIC_API_URL}/uploads/${selectedSpk.photo_after}`,
                                  "_blank",
                                )
                              }
                              className="w-36 h-36 object-cover rounded-lg cursor-zoom-in hover:opacity-90"
                              alt="After"
                            />
                            <span className="text-xs font-semibold text-slate-600 block text-center mt-2">
                              Kondisi Akhir
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end sticky bottom-0">
            <Button variant="outline" onClick={() => setSelectedSpk(null)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              disabled={confirming}
            >
              Batal
            </Button>
            <Button onClick={runConfirm} disabled={confirming}>
              {confirming ? "Memproses..." : "Ya, Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Excel Dialog */}
      <Dialog
        open={!!previewData}
        onOpenChange={(open) => {
          if (!open && !savingExcel) {
            setPreviewData(null);
            setSkippedData(null);
          }
        }}
      >
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-[85vw] max-h-[85vh] flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200/60 shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white/50">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="text-blue-600" /> Preview Data Excel
              SAP
            </DialogTitle>
            <p className="text-sm text-slate-500 mt-1">
              Ditemukan {previewData?.length || 0} baris SPK baru. Silakan
              periksa kembali sebelum menyimpan.
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-0 flex flex-col">
            {skippedData?.length > 0 && (
              <div className="m-4 mb-2 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                <AlertTriangle className="text-amber-500 w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-800">
                    Perhatian: Ada Data Terlewat ({skippedData.length} SPK)
                  </h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Order number dari baris-baris ini sudah pernah dimasukkan ke
                    database sehingga dilewati secara otomatis untuk mencegah
                    tumpang tindih data.
                  </p>
                </div>
              </div>
            )}

            {previewData?.some((r) => r.hasMatchedNotification === false) && (
              <div className="mx-4 mt-2 mb-2 bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                <AlertCircle className="text-blue-500 w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-blue-800">
                    Info: Ada SPK Tanpa Notifikasi
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    SPK dengan ikon{" "}
                    <AlertTriangle className="inline w-3 h-3 text-amber-500" />{" "}
                    tidak terhubung ke laporan notifikasi manapun di sistem. Ini
                    bisa terjadi karena SPK dibuat langsung di SAP tanpa laporan
                    dari web.
                  </p>
                </div>
              </div>
            )}

            {previewData?.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <EmptyState
                  icon={FileSpreadsheet}
                  text="Tidak ada data baru untuk ditambahkan."
                />
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 shadow-sm z-10">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        Order Number
                      </TableHead>
                      <TableHead className="whitespace-nowrap min-w-[250px]">
                        Deskripsi
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        System Status
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Work Center
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Jam Pekerja (Planned)
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Maint. Activ. Type
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Location
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData?.slice(0, 100).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {row.order_number}
                            {row.hasMatchedNotification === false && (
                              <div
                                title="Tidak ada laporan notifikasi yang terhubung dengan Order Number SPK ini"
                                className="text-amber-500 cursor-help"
                              >
                                <AlertTriangle size={14} />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]"
                          title={row.description}
                        >
                          {row.description || "-"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.sys_status || "-"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.work_center || "-"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.dur_plan || 0} {row.normal_dur_un || "Jam"} / {row.num_of_work || 0} Orang
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.maint_activ_type || "-"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.location || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {previewData?.length > 100 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-sm text-slate-500 bg-slate-50/50 italic py-3"
                        >
                          ... dan {previewData.length - 100} baris lainnya
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pt-4 pb-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => {
                setPreviewData(null);
                setSkippedData(null);
              }}
              disabled={savingExcel}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={savingExcel || previewData?.length === 0}
            >
              {savingExcel ? "Menyimpan..." : "Simpan Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col h-full">
      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
        {title}
      </h4>
      <div className="space-y-3 flex-1 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-slate-800 font-medium break-words">
        {value || "-"}
      </dd>
    </div>
  );
}

function MetricCard({ label, value, className }) {
  return (
    <div
      className={cn(
        "bg-white p-3 rounded-xl border border-slate-200 shadow-sm",
        className,
      )}
    >
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}

function InfoCard({ label, value, mono }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </div>
      <div
        className={cn(
          "text-sm text-slate-800 font-medium break-words",
          mono && "font-mono",
        )}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center text-slate-400 py-8">
      <Icon size={48} strokeWidth={1} className="mb-3 text-slate-300" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}
