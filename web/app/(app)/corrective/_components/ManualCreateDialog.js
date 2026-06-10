"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const INITIAL_FORM = {
  order_number: "",
  description: "",
  work_center: "",
  equipment_name: "",
  functional_location: "",
  report_by: "",
  sys_status: "CRTD",
};

export function ManualCreateDialog({ open, onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.order_number) return toast.error("Nomor SPK SAP wajib diisi");

    setSaving(true);
    try {
      await onSubmit(form);
      setForm(INITIAL_FORM);
      onClose();
    } catch (e) {
      toast.error(e.message || "Gagal membuat SPK Manual");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Buat SPK Manual (Bypass SAP)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Order Number (10 digit)</label>
            <Input
              value={form.order_number}
              onChange={(e) => setForm({ ...form, order_number: e.target.value })}
              placeholder="Misal: 1000289381"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Deskripsi / Short Text</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Kerusakan pompa..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Work Center</label>
            <Input
              value={form.work_center}
              onChange={(e) => setForm({ ...form, work_center: e.target.value })}
              placeholder="Misal: M1-MEKANIK"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipment</label>
              <Input
                value={form.equipment_name}
                onChange={(e) => setForm({ ...form, equipment_name: e.target.value })}
                placeholder="Misal: POMPA TRANSFER"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Functional Loc.</label>
              <Input
                value={form.functional_location}
                onChange={(e) => setForm({ ...form, functional_location: e.target.value })}
                placeholder="Misal: PABRIK-AREA"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reported By</label>
              <Input
                value={form.report_by}
                onChange={(e) => setForm({ ...form, report_by: e.target.value })}
                placeholder="Nama pelapor..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">System Status</label>
              <Input
                value={form.sys_status}
                onChange={(e) => setForm({ ...form, sys_status: e.target.value })}
                placeholder="CRTD"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan SPK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
