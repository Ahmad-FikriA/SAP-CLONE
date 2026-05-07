"use client";

import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { CheckCircle2, Trash2 } from "lucide-react";
import { canDelete } from "@/lib/auth";
import { SAP_STATUS_COLORS, SAP_STATUS_LABELS } from "./constants";
import { CorrectiveStatusBadge, EmptyState, fmtDate, SkeletonRows } from "./ui-primitives";

export function HistoryTable({ loading, history, equipment = [], onSelectSpk, onDeleteSpk }) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/80">
        <TableRow>
          <TableHead>Order Number</TableHead>
          <TableHead>Equipment</TableHead>
          <TableHead>Status Sistem</TableHead>
          <TableHead>Status SAP</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <SkeletonRows cols={5} rows={5} />
        ) : history.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="h-48 text-center">
              <EmptyState icon={CheckCircle2} text="Belum ada riwayat SPK" />
            </TableCell>
          </TableRow>
        ) : (
          history.map((spk) => {
            const equipmentItem = equipment.find(e => 
              String(e.equipmentId || e.equipment_id).trim() === String(spk.equipment_name).trim()
            );
            const equipmentDisplayName = equipmentItem 
              ? (equipmentItem.equipmentName || equipmentItem.equipment_name) 
              : spk.equipment_name;

            return (
              <TableRow
                key={spk.order_number}
                className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                onClick={() => onSelectSpk(spk)}
              >
                <TableCell className="font-mono text-xs font-semibold text-slate-800">
                  {spk.order_number}
                </TableCell>
                <TableCell className="text-slate-600 truncate max-w-[200px]" title={equipmentDisplayName}>
                  {equipmentDisplayName || "—"}
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
                  <span className="text-[10px] font-bold font-mono tracking-tight px-1.5 py-0.5 rounded border bg-slate-100 border-slate-200 text-slate-500" title={spk.sys_status}>
                    {spk.sys_status.length > 9 ? spk.sys_status.substring(0, 9) + "....." : spk.sys_status}
                  </span>
                ) : "—"}
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
                    onClick={() => onSelectSpk(spk)}
                  >
                    Detail
                  </Button>
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
