"use client";

import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { FileText, Trash2, Pencil } from "lucide-react";
import { canUpdate, canDelete } from "@/lib/auth";
import { SAP_STATUS_COLORS, SAP_STATUS_LABELS } from "./constants";
import { CorrectiveStatusBadge, EmptyState, fmtDate, SkeletonRows } from "./ui-primitives";
import { cn } from "@/lib/utils";

export function SpkTable({
  loading, spks, equipment = [], functionalLocations = [],
  isKadisPp, userId, userNik, userRole,
  onSelectSpk, onApproveKadisPp, onRejectKadisPp,
  onApproveKadisPelapor, onRejectKadisPelapor, onDeleteSpk,
  isPlanner, onEditSpk,
}) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/80">
        <TableRow>
          <TableHead className="w-[120px] max-w-[120px] pr-3">Order No.</TableHead>
          <TableHead>Deskripsi</TableHead>
          <TableHead>Equipment & Lokasi</TableHead>
          <TableHead>Jam / Pekerja</TableHead>
          <TableHead>Status Sistem</TableHead>
          <TableHead className="text-right pr-16">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <SkeletonRows cols={6} rows={5} />
        ) : spks.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="h-48 text-center">
              <EmptyState icon={FileText} text="Belum ada SPK aktif" />
            </TableCell>
          </TableRow>
        ) : (
          spks.map((spk) => {
            const isNeedReviewPp = spk.status === "menunggu_review_kadis_pp";
            const isNeedReviewPelapor = spk.status === "menunggu_review_kadis_pelapor";
            const isMyReport = spk.notification?.kadisPelaporId === userId || spk.notification?.kadis_pelapor_id === userId;
            const canReviewPelapor = isNeedReviewPelapor && (userRole === "admin" || isMyReport);
            const canReviewPp = isNeedReviewPp && isKadisPp;

            // Mapping raw codes to human-readable names
            const equipmentItem = equipment.find(e => 
              String(e.equipmentId || e.equipment_id).trim() === String(spk.equipment_name).trim()
            );
            const equipmentDisplayName = equipmentItem 
              ? (equipmentItem.equipmentName || equipmentItem.equipment_name) 
              : spk.equipment_name;

            const flItem = functionalLocations.find(f => 
              String(f.funcLocId || f.func_loc_id).trim() === String(spk.functional_location).trim()
            );
            const flDisplayName = flItem ? flItem.description : spk.functional_location;
            
            return (
              <TableRow
                key={spk.order_number}
                className={cn(
                  "cursor-pointer transition-colors",
                  isNeedReviewPp ? "bg-amber-50/60 hover:bg-amber-100/60" :
                  isNeedReviewPelapor ? "bg-purple-50/60 hover:bg-purple-100/60" :
                  "hover:bg-slate-50/80"
                )}
                onClick={() => onSelectSpk(spk)}
              >
                <TableCell className="font-mono text-xs font-semibold text-slate-800 w-[120px] max-w-[120px] pr-3">
                  <div className="flex items-center gap-2">
                    {spk.order_number}
                    {(isNeedReviewPp || isNeedReviewPelapor) && (
                      <span className={cn(
                        "w-2 h-2 rounded-full animate-pulse",
                        isNeedReviewPelapor ? "bg-purple-500" : "bg-amber-500"
                      )} title={isNeedReviewPelapor ? "Butuh Approval Pelapor" : "Butuh Approval Kadis PP"} />
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[150px] pr-6">
                  <div
                    className="text-xs text-slate-600 line-clamp-2 whitespace-normal break-words"
                    title={spk.description}
                  >
                    {spk.description || "—"}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <div
                    className="font-medium text-slate-800 truncate"
                    title={equipmentDisplayName}
                  >
                    {equipmentDisplayName || "—"}
                  </div>
                  <div
                    className="text-[11px] text-slate-500 truncate"
                    title={flDisplayName}
                  >
                    {flDisplayName || "—"}
                  </div>
                </TableCell>
                <TableCell>
                  {["menunggu_review_kadis_pelapor", "selesai"].includes(spk.status) ? (
                    <>
                      <div className="text-xs font-bold text-blue-700">
                        {spk.actual_work || 0} Jam / {spk.actual_personnel || 0} Orang
                      </div>
                      <div className="text-[10px] text-blue-500/80 mt-0.5 uppercase tracking-tight font-bold">
                        Actual
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-slate-700">
                        {spk.dur_plan || 0} Jam / {spk.num_of_work || 0} Orang
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-tight font-bold">
                        Planned
                      </div>
                    </>
                  )}
                </TableCell>
                <TableCell>
                  <CorrectiveStatusBadge
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
                    {canReviewPp ? (
                      <Button
                        size="sm"
                        className="h-8 shadow-sm bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => onSelectSpk(spk)}
                      >
                        Review Kadis PP
                      </Button>
                    ) : canReviewPelapor ? (
                      <Button
                        size="sm"
                        className="h-8 shadow-sm bg-purple-500 hover:bg-purple-600 text-white"
                        onClick={() => onSelectSpk(spk)}
                      >
                        Review Pelapor
                      </Button>
                    ) : (
                      <>
                        {isPlanner && !spk.sys_status?.toUpperCase().includes("TECO") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 shadow-sm"
                            onClick={() => onEditSpk(spk)}
                          >
                            <Pencil size={14} className="mr-1.5" />
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shadow-sm"
                          onClick={() => onSelectSpk(spk)}
                        >
                          Detail
                        </Button>
                      </>
                    )}
                    {canDelete('corrective') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => onDeleteSpk(spk.order_number)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
