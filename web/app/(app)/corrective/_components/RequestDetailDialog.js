import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { canUpdate } from "@/lib/auth";
import { getMediaUrl } from "@/lib/utils";
import { APPROVAL_COLORS, APPROVAL_LABELS } from "./constants";
import {
  CorrectiveStatusBadge, Section, Row, InfoCard, fmtDate,
} from "./ui-primitives";
import { ShieldAlert } from "lucide-react";

export function RequestDetailDialog({
  selectedRequest, onClose,
  onApprovePlanner, onRejectPlanner,
  userRole, onAdminUpdateStatus
}) {
  const [isAdminEditing, setIsAdminEditing] = useState(false);
  const [adminStatus, setAdminStatus] = useState("");
  const [adminApprovalStatus, setAdminApprovalStatus] = useState("");

  const handleAdminSave = async () => {
    try {
      await onAdminUpdateStatus(selectedRequest.id, {
        status: adminStatus || undefined,
        approvalStatus: adminApprovalStatus || undefined
      });
      setIsAdminEditing(false);
    } catch (e) {
      // toast is handled in action
    }
  };

  return (
    <AnimatePresence>
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ 
              opacity: 0, 
              y: 400, 
              scaleX: 0.05, 
              scaleY: 0.2,
            }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scaleX: 1, 
              scaleY: 1,
              transition: {
                type: "spring",
                damping: 24,
                stiffness: 300,
                mass: 0.7
              }
            }}
            exit={{ 
              opacity: 0, 
              y: 400, 
              scaleX: 0.05, 
              scaleY: 0.2,
              transition: {
                ease: [0.32, 0.72, 0, 1],
                duration: 0.28
              }
            }}
            style={{ transformOrigin: "bottom center" }}
            className="relative z-50 bg-white max-w-[95vw] lg:max-w-[75vw] w-full max-h-[90vh] overflow-hidden p-0 rounded-2xl flex flex-col gap-0 shadow-2xl origin-bottom"
          >
            <div className="overflow-y-auto max-h-[90vh]">
        <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-8 py-6 border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Detail Laporan Notifikasi
              </h2>
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
            {/* Admin Tool Section */}
            {userRole === "admin" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                    <ShieldAlert size={16} />
                    ADMIN TOOLS: FORCE UPDATE STATUS
                  </div>
                  {!isAdminEditing ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 border-amber-300 text-amber-800 hover:bg-amber-100"
                      onClick={() => {
                        setAdminStatus(selectedRequest.status);
                        setAdminApprovalStatus(selectedRequest.approvalStatus);
                        setIsAdminEditing(true);
                      }}
                    >
                      Edit Status
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setIsAdminEditing(false)}>Batal</Button>
                      <Button size="sm" className="h-7 bg-amber-600 hover:bg-amber-700" onClick={handleAdminSave}>Simpan Paksa</Button>
                    </div>
                  )}
                </div>
                
                {isAdminEditing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-amber-700">Internal Status</label>
                      <select 
                        className="w-full bg-white border border-amber-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                        value={adminStatus}
                        onChange={(e) => setAdminStatus(e.target.value)}
                      >
                        <option value="submitted">submitted</option>
                        <option value="approved">approved</option>
                        <option value="spk_created">spk_created</option>
                        <option value="closed">closed</option>
                        <option value="rejected">rejected</option>
                        <option value="menunggu_review_awal_kadis_pp">menunggu_review_awal_kadis_pp</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-amber-700">Approval Status (UI Display)</label>
                      <select 
                        className="w-full bg-white border border-amber-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                        value={adminApprovalStatus}
                        onChange={(e) => setAdminApprovalStatus(e.target.value)}
                      >
                        <option value="pending">pending</option>
                        <option value="approved">approved</option>
                        <option value="rejected">rejected</option>
                        <option value="menunggu_review_awal_kadis_pp">menunggu_review_awal_kadis_pp</option>
                        <option value="spk_issued">spk_issued</option>
                        <option value="eksekusi">eksekusi</option>
                        <option value="selesai">selesai</option>
                      </select>
                    </div>
                    <p className="md:col-span-2 text-[11px] text-amber-600 italic">
                      * Perhatian: Mengubah status di sini akan mem-bypass logika sistem normal. Gunakan hanya jika data "nyangkut".
                    </p>
                  </div>
                )}
              </div>
            )}

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
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
