"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete, apiUpload } from "@/lib/api";

export function useCorrective() {
  const [requests, setRequests] = useState([]);
  const [spks, setSpks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterApprovalStatus, setFilterApprovalStatus] = useState("");
  const [filterSpkStatus, setFilterSpkStatus] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqData, sapSpkRes] = await Promise.all([
        apiGet("/corrective/requests"),
        apiGet("/corrective/sap-spk"),
      ]);
      setRequests(Array.isArray(reqData) ? reqData.filter(r => r.approvalStatus === "pending" || r.approvalStatus === "rejected") : []);

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

  const filteredRequests = useMemo(() => {
    const filtered = filterApprovalStatus
      ? requests.filter((r) => r.approvalStatus === filterApprovalStatus)
      : requests;

    return [...filtered].sort((a, b) => {
      if (a.approvalStatus === "pending" && b.approvalStatus !== "pending") return -1;
      if (a.approvalStatus !== "pending" && b.approvalStatus === "pending") return 1;
      return (
        new Date(b.notificationDate || b.submittedAt || 0) -
        new Date(a.notificationDate || a.submittedAt || 0)
      );
    });
  }, [requests, filterApprovalStatus]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function uploadExcel(file) {
    const formData = new FormData();
    formData.append("excelFile", file);
    const resData = await apiUpload("/corrective/sap-spk/upload-excel", formData);
    if (resData.status === "success") {
      toast.success(resData.message);
      return resData.data;
    }
    throw new Error(resData.message || "Gagal mengupload file");
  }

  async function confirmBulkInsert(spkRows) {
    const data = await apiPost("/corrective/sap-spk/bulk-insert", { spks: spkRows });
    if (data.status === "success") {
      toast.success(data.message);
      await loadAll();
      return data;
    }
    throw new Error(data.message || "Gagal menyimpan data");
  }

  async function submitManualSpk(formData) {
    await apiPost("/corrective/sap-spk/manual", formData);
    toast.success("SPK Manual berhasil dibuat");
    await loadAll();
  }

  async function approvePlannerAction(id, sapOrderNumber) {
    await apiPost(`/corrective/requests/${id}/approve-planner`, { sapOrderNumber });
    toast.success("Laporan berhasil diterima");
    await loadAll();
  }

  async function rejectPlannerAction(id, rejectionReason) {
    await apiPost(`/corrective/requests/${id}/reject-planner`, { rejectionReason });
    toast.success("Laporan berhasil ditolak");
    await loadAll();
  }

  async function updateSapNumberAction(id, sapOrderNumber) {
    await apiPost(`/corrective/requests/${id}/update-sap-number`, { sapOrderNumber });
    toast.success("Nomor SAP berhasil diperbarui");
    await loadAll();
  }

  async function approveKadisPpAction(orderNumber) {
    await apiPost(`/corrective/sap-spk/${orderNumber}/approve-kadis-pp`, {});
    toast.success("Berhasil disetujui");
    await loadAll();
  }

  async function rejectKadisPpAction(orderNumber, rejectionNote) {
    await apiPost(`/corrective/sap-spk/${orderNumber}/reject-kadis-pp`, { rejection_note: rejectionNote });
    toast.success("Berhasil ditolak");
    await loadAll();
  }

  async function approveKadisPelaporAction(orderNumber) {
    await apiPost(`/corrective/sap-spk/${orderNumber}/approve-kadis-pelapor`, {});
    toast.success("Berhasil disetujui oleh Pelapor");
    await loadAll();
  }

  async function rejectKadisPelaporAction(orderNumber, rejectionNote) {
    await apiPost(`/corrective/sap-spk/${orderNumber}/reject-kadis-pelapor`, { rejection_note: rejectionNote });
    toast.success("Berhasil ditolak oleh Pelapor");
    await loadAll();
  }

  async function deleteRequestAction(id) {
    await apiDelete(`/corrective/requests/${id}`);
    toast.success("Berhasil dihapus");
    await loadAll();
  }

  async function deleteAllRequestsAction() {
    await apiDelete("/corrective/requests");
    toast.success("Berhasil dihapus");
    await loadAll();
  }

  async function deleteSpkAction(orderNumber) {
    const data = await apiDelete(`/corrective/sap-spk/${orderNumber}`);
    toast.success(data?.message || "Berhasil dihapus");
    await loadAll();
  }

  async function deleteAllSpksAction() {
    const data = await apiDelete("/corrective/sap-spk");
    toast.success(data?.message || "Berhasil dihapus");
    await loadAll();
  }

  return {
    requests, spks, history, loading, filteredRequests,
    filterApprovalStatus, setFilterApprovalStatus,
    filterSpkStatus, setFilterSpkStatus,
    loadAll,
    uploadExcel, confirmBulkInsert, submitManualSpk,
    approvePlannerAction, rejectPlannerAction, updateSapNumberAction,
    approveKadisPpAction, rejectKadisPpAction,
    approveKadisPelaporAction, rejectKadisPelaporAction,
    deleteRequestAction, deleteAllRequestsAction,
    deleteSpkAction, deleteAllSpksAction,
  };
}
