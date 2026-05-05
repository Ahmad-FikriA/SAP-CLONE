"use client";

import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { FileText, Trash2 } from "lucide-react";
import { canUpdate, canDelete } from "@/lib/auth";
import { EmptyState, fmtDate } from "./ui-primitives";

export function SpkTable({
  loading, spks,
  onSelectSpk, onApproveKadisPp, onRejectKadisPp, onDeleteSpk,
}) {
  return (
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
          spks.map((spk) => (
            <TableRow
              key={spk.order_number}
              className="cursor-pointer hover:bg-slate-50/80 transition-colors"
              onClick={() => onSelectSpk(spk)}
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
                  {spk.status === "menunggu_review_kadis_pp" && canUpdate('corrective') && (
                    <>
                      <Button
                        size="sm"
                        className="h-8 shadow-sm bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => onApproveKadisPp(spk.order_number)}
                      >
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 shadow-sm"
                        onClick={() => onRejectKadisPp(spk.order_number)}
                      >
                        Tolak
                      </Button>
                    </>
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
          ))
        )}
      </TableBody>
    </Table>
  );
}
