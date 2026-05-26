"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { FileSpreadsheet, AlertTriangle, Users } from "lucide-react";

export function ExcelUserPreviewDialog({
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
      <DialogContent className="max-w-[95vw] md:max-w-[85vw] lg:max-w-[75vw] max-h-[85vh] flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200/60 shadow-2xl rounded-2xl p-0">
        <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white/50">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600" />
            Preview Data Import User
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Ditemukan {previewData?.length || 0} user baru yang siap diimport. Silakan periksa kembali sebelum menyimpan.
          </p>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-0 flex flex-col">
          {skippedData?.length > 0 && (
            <div className="m-4 mb-2 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
              <AlertTriangle className="text-amber-500 w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-800">
                  Perhatian: Ada Data Terlewat ({skippedData.length} User)
                </h4>
                <p className="text-sm text-amber-700 mt-1">
                  NIK dari baris-baris ini sudah terdaftar di database, sehingga dilewati secara otomatis untuk mencegah tumpang tindih data.
                </p>
              </div>
            </div>
          )}

          {previewData?.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Users size={48} className="stroke-1" />
              <p className="text-sm">Tidak ada data user baru untuk ditambahkan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader className="bg-slate-50/80 sticky top-0 shadow-sm z-10">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">NIK</TableHead>
                    <TableHead className="whitespace-nowrap">Nama</TableHead>
                    <TableHead className="whitespace-nowrap">Jabatan (Role)</TableHead>
                    <TableHead className="whitespace-nowrap">Seksi/Group</TableHead>
                    <TableHead className="whitespace-nowrap">Dinas</TableHead>
                    <TableHead className="whitespace-nowrap">Divisi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData?.slice(0, 100).map((row, i) => (
                    <TableRow key={i} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-sm font-semibold whitespace-nowrap">
                        {row.nik}
                      </TableCell>
                      <TableCell className="text-sm font-medium whitespace-nowrap text-slate-800">
                        {row.name || "-"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-slate-600">
                        <span className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded font-mono">
                          {row.role || "teknisi"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-slate-600">
                        {row.group || "-"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-slate-600">
                        {row.dinas || "-"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-slate-600">
                        {row.divisi || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {previewData?.length > 100 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
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
