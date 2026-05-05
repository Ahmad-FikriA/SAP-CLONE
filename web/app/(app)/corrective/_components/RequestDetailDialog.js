"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { canUpdate } from "@/lib/auth";
import { getMediaUrl } from "@/lib/utils";
import { APPROVAL_COLORS, APPROVAL_LABELS } from "./constants";
import {
  CorrectiveStatusBadge, Section, Row, InfoCard, fmtDate,
} from "./ui-primitives";

export function RequestDetailDialog({
  selectedRequest, onClose,
  onApprovePlanner, onRejectPlanner,
}) {
  return (
    <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[95vw] lg:max-w-[75vw] max-h-[90vh] overflow-hidden p-0 rounded-2xl gap-0">
        <div className="overflow-y-auto max-h-[90vh]">
        <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-8 py-6 border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800">
                Detail Laporan Notifikasi
              </DialogTitle>
              <div className="text-sm font-mono text-slate-400 mt-1">
                {selectedRequest?.id}
              </div>
            </div>
            <div className="flex gap-2">
              <CorrectiveStatusBadge
                value={selectedRequest?.approvalStatus}
                colorMap={APPROVAL_COLORS}
                labelMap={APPROVAL_LABELS}
              />
            </div>
          </div>
        </div>

        {selectedRequest && (
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard label="Notification ID" value={selectedRequest.id} mono />
              {selectedRequest.sapOrderNumber && (
                <InfoCard
                  label="SAP Order Number"
                  value={selectedRequest.sapOrderNumber}
                  mono
                  className="bg-blue-50 border-blue-200"
                />
              )}
              <InfoCard label="Tipe Notifikasi" value={selectedRequest.notificationType} />
              <InfoCard label="Work Center" value={selectedRequest.workCenter} />
              <InfoCard label="Dilaporkan Oleh" value={selectedRequest.reportedBy} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Section title="Informasi Peralatan">
                <Row label="Equipment" value={selectedRequest.equipment} />
                <Row label="Functional Location" value={selectedRequest.functionalLocation} />
              </Section>
              <Section title="Jadwal">
                <Row label="Tanggal Lapor" value={fmtDate(selectedRequest.notificationDate || selectedRequest.submittedAt)} />
                <Row label="Target Mulai" value={fmtDate(selectedRequest.requiredStart)} />
                <Row label="Target Selesai" value={fmtDate(selectedRequest.requiredEnd)} />
              </Section>
            </div>

            <Section title="Deskripsi Kerusakan">
              <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100/50">
                <p className="font-semibold text-slate-800 mb-2 text-base">
                  {selectedRequest.description || "Tanpa judul"}
                </p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {selectedRequest.longText || "Tidak ada deskripsi panjang."}
                </p>
              </div>
            </Section>

            {selectedRequest.approvalStatus === "rejected" && selectedRequest.rejectionReason && (
              <Section title="Alasan Penolakan">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-red-800 text-sm">
                  {selectedRequest.rejectionReason}
                </div>
              </Section>
            )}

            {(selectedRequest.images || []).length > 0 && (
              <Section title="Foto Lapangan">
                <div className="flex flex-wrap gap-4">
                  {selectedRequest.images.filter(Boolean).map((p, i) => {
                    const src = getMediaUrl(p);
                    return (
                      <img
                        key={i}
                        src={src}
                        alt={`Attachment ${i + 1}`}
                        onClick={() => window.open(src, "_blank")}
                        className="w-36 h-36 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:shadow-lg transition-all hover:scale-105"
                      />
                    );
                  })}
                </div>
              </Section>
            )}
          </div>
        )}
        <div className="bg-slate-50/80 px-8 py-5 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          {selectedRequest?.status === "submitted" &&
            selectedRequest?.approvalStatus === "pending" &&
            canUpdate('corrective') && (
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={() => onRejectPlanner(selectedRequest.id)}
                  className="shadow-sm"
                >
                  Tolak Laporan
                </Button>
                <Button
                  onClick={() => {
                    onClose();
                    onApprovePlanner(selectedRequest.id);
                  }}
                  className="shadow-sm"
                >
                  Terima Laporan
                </Button>
              </div>
            )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
