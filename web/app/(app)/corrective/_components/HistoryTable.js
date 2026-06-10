"use client";

import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { CheckCircle2, Trash2, Pencil } from "lucide-react";
import { canDelete } from "@/lib/auth";
import { SAP_STATUS_COLORS, SAP_STATUS_LABELS } from "./constants";
import { CorrectiveStatusBadge, EmptyState, fmtDate, SkeletonRows } from "./ui-primitives";
import { cn } from "@/lib/utils";

export function HistoryTable({ loading, history, fullHistory, equipment = [], functionalLocations = [], onSelectSpk, onDeleteSpk, isExportMode, selectedExportIds, setSelectedExportIds, highlightCheckboxes, isPlanner, onEditSpk }) {
  const datasetToSelect = fullHistory || history;
  const allSelected = datasetToSelect.length > 0 && selectedExportIds?.length === datasetToSelect.length;

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedExportIds(datasetToSelect.map((h) => h.order_number));
    else setSelectedExportIds([]);
  };

  const handleSelectRow = (e, orderNumber) => {
    e.stopPropagation();
    if (e.target.checked) setSelectedExportIds([...(selectedExportIds || []), orderNumber]);
    else setSelectedExportIds((selectedExportIds || []).filter((id) => id !== orderNumber));
  };

  const totalCols = isExportMode ? 7 : 6;

  return (
    <Table>
      <TableHeader className="bg-slate-50/80">
        <TableRow>
          {isExportMode && (
            <TableHead className="w-12 text-center">
              <div className={cn(
                "inline-flex p-1 rounded-md transition-all duration-300",
                highlightCheckboxes && "ring-2 ring-red-500 animate-pulse bg-red-50"
              )}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </TableHead>
          )}
          <TableHead className="w-[130px] max-w-[130px] pr-4">Order No.</TableHead>
          <TableHead>Deskripsi</TableHead>
          <TableHead>Equipment & Lokasi</TableHead>
          <TableHead className="w-[140px] max-w-[140px]">Work Start</TableHead>
          <TableHead className="w-[160px] max-w-[160px] pr-4">Status SAP</TableHead>
          <TableHead className="w-[190px] max-w-[190px] pr-6">
            <div className="text-right">Aksi</div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <SkeletonRows cols={totalCols} rows={5} />
        ) : history.length === 0 ? (
          <TableRow>
            <TableCell colSpan={totalCols} className="h-48 text-center">
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

            const flItem = functionalLocations.find(f => 
              String(f.funcLocId || f.func_loc_id).trim() === String(spk.functional_location).trim()
            );
            const flDisplayName = flItem ? flItem.description : spk.functional_location;

            const sysStatusParts = spk.sys_status ? spk.sys_status.trim().split(/\s+/) : [];
            const sysStatusFormatted = sysStatusParts.length > 3
              ? sysStatusParts.slice(0, 3).join(" ") + " ..."
              : spk.sys_status;

            return (
              <TableRow
                key={spk.order_number}
                className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                onClick={() => onSelectSpk(spk)}
              >
                {isExportMode && (
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedExportIds?.includes(spk.order_number) || false}
                      onChange={(e) => handleSelectRow(e, spk.order_number)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs font-semibold text-slate-800 w-[130px] max-w-[130px] pr-4">
                  {spk.order_number}
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
                <TableCell className="text-slate-600 font-medium text-xs w-[140px] max-w-[140px]">
                  {spk.work_start ? fmtDate(spk.work_start) : "—"}
                </TableCell>
              <TableCell className="w-[160px] max-w-[160px] pr-4">
                {spk.sys_status ? (
                  <span className="text-[10px] font-bold font-mono tracking-tight px-1.5 py-0.5 rounded border bg-slate-100 border-slate-200 text-slate-500" title={spk.sys_status}>
                    {sysStatusFormatted}
                  </span>
                ) : "—"}
              </TableCell>
              <TableCell
                className="text-right w-[190px] max-w-[190px] pr-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-end items-center gap-1">
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
