"use client";

import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { FileText, Trash2 } from "lucide-react";
import { canUpdate, canDelete } from "@/lib/auth";
import { SAP_STATUS_COLORS, SAP_STATUS_LABELS } from "./constants";
import { CorrectiveStatusBadge, EmptyState, fmtDate } from "./ui-primitives";
import { cn } from "@/lib/utils";

export function SpkTable({
  loading, spks,
  onSelectSpk, onApproveKadisPp, onRejectKadisPp, onDeleteSpk,
}) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/80">
        <TableRow>
          <TableHead>Order Number</TableHead>
          <TableHead>Equipment & Lokasi</TableHead>
          <TableHead>Jam / Pekerja</TableHead>
          <TableHead>Status Sistem</TableHead>
          <TableHead>Status SAP</TableHead>
          <TableHead className="text-right pr-16">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={6} className="h-24 text-center text-slate-400">
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
          spks.map((spk) => {
            const isNeedReview = spk.status === "menunggu_review_kadis_pp";
            return (
              <TableRow
                key={spk.order_number}
                className={cn(
                  "cursor-pointer transition-colors",
                  isNeedReview ? "bg-amber-50/60 hover:bg-amber-100/60" : "hover:bg-slate-50/80"
                )}
                onClick={() => onSelectSpk(spk)}
              >
                <TableCell className="font-mono text-xs font-semibold text-slate-800">
                  <div className="flex items-center gap-2">
                    {spk.order_number}
                    {isNeedReview && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Butuh Approval Kadis PP" />
                    )}
                  </div>
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
                  <CorrectiveStatusBadge
                    value={spk.status}
                    colorMap={SAP_STATUS_COLORS}
                    labelMap={SAP_STATUS_LABELS}
                  />
                </TableCell>
                <TableCell>
                  {spk.sys_status ? (
                    <span className={cn(
                      "text-[10px] font-bold font-mono tracking-tight px-1.5 py-0.5 rounded border",
                      isNeedReview ? "bg-amber-100 border-amber-200 text-amber-700" : "bg-slate-100 border-slate-200 text-slate-500"
                    )} title={spk.sys_status}>
                      {spk.sys_status.length > 9 ? spk.sys_status.substring(0, 9) + "....." : spk.sys_status}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end items-center gap-1">
                    {isNeedReview && canUpdate('corrective') ? (
                      <Button
                        size="sm"
                        className="h-8 shadow-sm bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => onSelectSpk(spk)}
                      >
                        Review Eksekusi
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shadow-sm"
                        onClick={() => onSelectSpk(spk)}
                      >
                        Detail
                      </Button>
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
