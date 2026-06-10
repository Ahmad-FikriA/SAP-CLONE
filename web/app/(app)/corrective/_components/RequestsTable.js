"use client";

import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Inbox, Edit2, Trash2 } from "lucide-react";
import { canUpdate, canDelete } from "@/lib/auth";
import { APPROVAL_COLORS, APPROVAL_LABELS, NOTIF_STATUS_COLORS, NOTIF_STATUS_LABELS } from "./constants";
import { CorrectiveStatusBadge, EmptyState, fmtDate, SkeletonRows } from "./ui-primitives";

export function RequestsTable({
  loading, filteredRequests,
  onSelectRequest, onApprovePlanner, onEditSapNumber, onDeleteRequest,
}) {
  return (
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
          <SkeletonRows cols={6} rows={5} />
        ) : filteredRequests.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="h-48 text-center">
              <EmptyState icon={Inbox} text="Belum ada laporan notifikasi" />
            </TableCell>
          </TableRow>
        ) : (
          filteredRequests.map((req) => (
            <TableRow
              key={req.id}
              className="cursor-pointer hover:bg-slate-50/80 transition-colors"
              onClick={() => onSelectRequest(req)}
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
                  {req.approvalStatus === "approved" && canUpdate('corrective') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSapNumber(req);
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
                <CorrectiveStatusBadge
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
                    onClick={() => onSelectRequest(req)}
                  >
                    Detail
                  </Button>
                  {req.status === "submitted" &&
                    req.approvalStatus === "pending" &&
                    canUpdate('corrective') && (
                      <Button
                        size="sm"
                        className="h-8 shadow-sm"
                        onClick={() => onApprovePlanner(req.id)}
                      >
                        Terima
                      </Button>
                    )}
                  {canDelete('corrective') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => onDeleteRequest(req.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
