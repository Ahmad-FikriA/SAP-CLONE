"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { FileSpreadsheet, AlertTriangle, AlertCircle } from "lucide-react";
import { EmptyState } from "./ui-primitives";

export function ExcelPreviewDialog({
  previewData, skippedData, savingExcel,
  onClose, onConfirm,
}) {
  return (
    <Dialog
      open={!!previewData}
      onOpenChange={(open) => {
        if (!open && !savingExcel) onClose();
      }}
    >
      <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-[85vw] max-h-[85vh] flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200/60 shadow-2xl rounded-2xl p-0">
        <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white/50">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600" />
            Preview Data Excel SAP
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
                    <TableHead className="whitespace-nowrap">Order Number</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[250px]">Deskripsi</TableHead>
                    <TableHead className="whitespace-nowrap">System Status</TableHead>
                    <TableHead className="whitespace-nowrap">Work Center</TableHead>
                    <TableHead className="whitespace-nowrap">Jam Pekerja (Planned)</TableHead>
                    <TableHead className="whitespace-nowrap">Maint. Activ. Type</TableHead>
                    <TableHead className="whitespace-nowrap">Location</TableHead>
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
          <Button variant="ghost" onClick={onClose} disabled={savingExcel}>
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={savingExcel || previewData?.length === 0}
          >
            {savingExcel ? "Menyimpan..." : "Simpan Data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
