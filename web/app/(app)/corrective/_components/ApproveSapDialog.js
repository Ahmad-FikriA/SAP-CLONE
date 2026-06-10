"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function ApproveSapDialog({ state, onClose, onConfirm, confirming }) {
  const [sapNumber, setSapNumber] = useState("");

  function handleOpen(open) {
    if (!open) {
      onClose();
      setSapNumber("");
    }
  }

  function handleConfirm() {
    onConfirm(sapNumber);
  }

  if (state && !sapNumber && state.initialValue) {
    setSapNumber(state.initialValue);
  }

  return (
    <Dialog open={!!state} onOpenChange={handleOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md p-0 rounded-2xl overflow-hidden"
      >
        <div
          className={cn(
            "p-6 text-white text-center",
            state?.isEdit
              ? "bg-gradient-to-r from-slate-700 to-slate-600"
              : "bg-gradient-to-r from-blue-600 to-blue-500",
          )}
        >
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <FileText className="text-white" size={24} />
          </div>
          <DialogTitle className="text-xl font-bold">
            {state?.isEdit ? "Update Nomor SAP" : "Terima Laporan"}
          </DialogTitle>
          <p className="text-blue-50/80 text-sm mt-1">
            {state?.isEdit
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
                value={sapNumber}
                onChange={(e) => setSapNumber(e.target.value)}
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
                onClick={() => { onClose(); setSapNumber(""); }}
              >
                Batal
              </Button>
              <Button
                className={cn(
                  "flex-1 h-11 shadow-md",
                  state?.isEdit
                    ? "bg-slate-800 hover:bg-slate-900"
                    : "bg-blue-600 hover:bg-blue-700",
                )}
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming
                  ? "Memproses..."
                  : state?.isEdit
                    ? "Update"
                    : "Konfirmasi"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
