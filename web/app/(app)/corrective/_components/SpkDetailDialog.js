"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Wrench } from "lucide-react";
import { cn, getMediaUrl } from "@/lib/utils";
import { canUpdate } from "@/lib/auth";
import {
  SAP_STATUS_COLORS,
  SAP_STATUS_LABELS,
  SAP_SPK_STEPS,
} from "./constants";
import {
  CorrectiveStatusBadge,
  Section,
  Row,
  InfoCard,
  MetricCard,
  PersonCard,
  fmtDate,
} from "./ui-primitives";

export function SpkDetailDialog({
  selectedSpk,
  onClose,
  isKadisPp,
  userId,
  userNik,
  userRole,
  onApproveKadisPp,
  onRejectKadisPp,
  onApproveKadisPelapor,
  onRejectKadisPelapor,
}) {
  return (
    <Dialog open={!!selectedSpk} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw] lg:max-w-[80vw] max-h-[90vh] overflow-hidden p-0 rounded-2xl flex flex-col gap-0"
      >
        <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-8 py-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800">
                Detail SPK SAP
              </DialogTitle>
              <div className="text-sm font-mono text-slate-400 mt-1">
                {selectedSpk?.order_number}
              </div>
            </div>
            <CorrectiveStatusBadge
              value={selectedSpk?.status}
              colorMap={SAP_STATUS_COLORS}
              labelMap={SAP_STATUS_LABELS}
            />
          </div>

          {/* Progress Stepper */}
          <div className="flex items-center w-full relative max-w-xl mx-auto">
            {SAP_SPK_STEPS.map((step, i) => {
              const currentIdx = SAP_SPK_STEPS.findIndex(
                (s) => s.key === selectedSpk?.status,
              );
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <div
                  key={step.key}
                  className="flex-1 relative flex flex-col items-center"
                >
                  {i !== 0 && (
                    <div
                      className={cn(
                        "absolute top-3 left-[-50%] w-full h-[2px] -z-10",
                        done || active ? "bg-blue-500" : "bg-slate-200",
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-slate-50 transition-colors z-10",
                      done
                        ? "bg-blue-500 text-white"
                        : active
                          ? "bg-blue-600 text-white ring-blue-100"
                          : "bg-slate-200 text-slate-400",
                    )}
                  >
                    {done ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      "text-xs mt-2 font-medium w-full text-center absolute top-8",
                      active
                        ? "text-blue-700"
                        : done
                          ? "text-slate-700"
                          : "text-slate-400",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-7"></div>
        </div>

        {selectedSpk && (
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard
                label="Order Number"
                value={selectedSpk.order_number}
                mono
              />
              <InfoCard label="Status SAP" value={selectedSpk.sys_status} />
              <InfoCard label="Work Center" value={selectedSpk.work_center} />
              <InfoCard label="Control Key" value={selectedSpk.ctrl_key} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard label="Deskripsi" value={selectedSpk.description} />
              <InfoCard label="Short Text" value={selectedSpk.short_text} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Section title="Lokasi & Peralatan">
                <Row label="Equipment" value={selectedSpk.equipment_name} />
                <Row
                  label="Functional Loc"
                  value={selectedSpk.functional_location}
                />
                <Row label="Location" value={selectedSpk.location} />
                <Row label="Cost Center" value={selectedSpk.cost_center} />
              </Section>
              <Section title="Perencanaan">
                <Row
                  label="Jam Pekerja (Planned)"
                  value={`${selectedSpk.dur_plan || 0} ${selectedSpk.normal_dur_un || "Jam"} / ${selectedSpk.num_of_work || 0} Orang`}
                />
                <Row
                  label="Normal Duration"
                  value={`${selectedSpk.normal_dur || 0} ${selectedSpk.normal_dur_un || ""}`}
                />
                <Row label="Unit for Work" value={selectedSpk.unit_for_work} />
                <Row label="Activity" value={selectedSpk.activity} />
                <Row
                  label="Maint. Activ. Type"
                  value={selectedSpk.maint_activ_type}
                />
              </Section>
              <Section title="Jadwal & Aktual SAP">
                <Row
                  label="Tgl Diminta Dikerjakan"
                  value={
                    selectedSpk.notification?.requiredStart || selectedSpk.notification?.requiredEnd
                      ? `${fmtDate(selectedSpk.notification?.requiredStart) || "-"} s/d ${fmtDate(selectedSpk.notification?.requiredEnd) || "-"}`
                      : "-"
                  }
                />
                <Row
                  label="Work Start"
                  value={fmtDate(selectedSpk.work_start)}
                />
                <Row
                  label="Work Finish"
                  value={fmtDate(selectedSpk.work_finish)}
                />
                <Row label="Start Time" value={selectedSpk.start_time} />
                <Row label="Finish Time" value={selectedSpk.finish_time} />
                <Row
                  label="Durasi Aktual"
                  value={`${selectedSpk.dur_act || 0} ${selectedSpk.normal_dur_un || ""}`}
                />
                <Row
                  label="Actual Work"
                  value={`${selectedSpk.actual_work || 0} ${selectedSpk.unit_for_work || ""}`}
                />
              </Section>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoCard
                label="Confirmation Text"
                value={selectedSpk.conf_text}
              />
              <InfoCard
                label="Confirm Number"
                value={selectedSpk.confirm_number}
              />
              <InfoCard
                label="Reason of Var"
                value={selectedSpk.reason_of_var}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PersonCard
                title="Dilaporkan Oleh"
                name={selectedSpk.notification?.kadisPelapor?.name}
                nik={selectedSpk.notification?.kadisPelapor?.id}
                role={selectedSpk.notification?.kadisPelapor?.role}
                divisi={selectedSpk.notification?.kadisPelapor?.divisi}
                dinas={selectedSpk.notification?.kadisPelapor?.dinas}
                group={selectedSpk.notification?.kadisPelapor?.group}
                fallback={selectedSpk.report_by || "—"}
              />
              <PersonCard
                title="Tim Eksekutor (Penerima SPK)"
                name={selectedSpk.executor?.name || selectedSpk.execution_name}
                nik={selectedSpk.executor?.id || selectedSpk.execution_nik}
                role={selectedSpk.executor?.role}
                divisi={selectedSpk.executor?.divisi}
                dinas={selectedSpk.executor?.dinas}
                group={selectedSpk.executor?.group}
                fallback={
                  selectedSpk.execution_nik
                    ? `NIK: ${selectedSpk.execution_nik}`
                    : "Belum ada eksekutor"
                }
              />
            </div>

            {/* Execution Results */}
            {(selectedSpk.actual_materials ||
              selectedSpk.actual_tools ||
              selectedSpk.job_result_description ||
              selectedSpk.photo_before ||
              selectedSpk.photo_after) && (
              <div className="bg-orange-50/50 rounded-2xl border border-orange-100/50 p-5">
                <h4 className="text-sm font-bold text-orange-800 mb-4 flex items-center gap-2">
                  <Wrench size={16} /> Laporan Eksekusi Teknisi
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <MetricCard
                    label="Jam Pekerja (Planned)"
                    value={`${selectedSpk.dur_plan || 0} Jam / ${selectedSpk.num_of_work || 0} Org`}
                    className="bg-blue-50/50 border-blue-100"
                  />
                  <MetricCard
                    label="Pekerja Aktual"
                    value={`${selectedSpk.actual_personnel || 0} Orang`}
                  />
                  <MetricCard
                    label="Jam Aktual"
                    value={`${selectedSpk.total_actual_hour || 0} Jam`}
                  />
                </div>

                <div className="space-y-4 text-sm text-slate-700">
                  <div>
                    <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
                      Material yang Digunakan
                    </strong>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      {selectedSpk.actual_materials || "-"}
                    </div>
                  </div>
                  <div>
                    <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
                      Tools yang Digunakan
                    </strong>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      {selectedSpk.actual_tools || "-"}
                    </div>
                  </div>
                  <div>
                    <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
                      Catatan Hasil Kerja
                    </strong>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">
                      {selectedSpk.job_result_description || "-"}
                    </div>
                  </div>
                </div>

                {(selectedSpk.photo_before || selectedSpk.photo_after) && (
                  <div className="mt-6 pt-6 border-t border-orange-200/50">
                    <strong className="block text-xs text-slate-500 uppercase tracking-wider mb-3">
                      Foto Dokumentasi
                    </strong>
                    <div className="flex flex-wrap gap-4">
                      {selectedSpk.photo_before && (
                        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-block">
                          <img
                            src={getMediaUrl(selectedSpk.photo_before)}
                            onClick={() =>
                              window.open(
                                getMediaUrl(selectedSpk.photo_before),
                                "_blank",
                              )
                            }
                            className="w-36 h-36 object-cover rounded-lg cursor-zoom-in hover:opacity-90"
                            alt="Before"
                          />
                          <span className="text-xs font-semibold text-slate-600 block text-center mt-2">
                            Kondisi Awal
                          </span>
                        </div>
                      )}
                      {selectedSpk.photo_after && (
                        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-block">
                          <img
                            src={getMediaUrl(selectedSpk.photo_after)}
                            onClick={() =>
                              window.open(
                                getMediaUrl(selectedSpk.photo_after),
                                "_blank",
                              )
                            }
                            className="w-36 h-36 object-cover rounded-lg cursor-zoom-in hover:opacity-90"
                            alt="After"
                          />
                          <span className="text-xs font-semibold text-slate-600 block text-center mt-2">
                            Kondisi Akhir
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center shrink-0">
          <div>
            {selectedSpk?.status === "menunggu_review_kadis_pp" &&
              isKadisPp && (
                <div className="flex gap-2">
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                    onClick={() => {
                      onClose();
                      onApproveKadisPp(selectedSpk.order_number);
                    }}
                  >
                    Setujui
                  </Button>
                  <Button
                    variant="destructive"
                    className="shadow-sm"
                    onClick={() => {
                      onClose();
                      onRejectKadisPp(selectedSpk.order_number);
                    }}
                  >
                    Tolak
                  </Button>
                </div>
              )}
            {selectedSpk?.status === "menunggu_review_kadis_pelapor" &&
              (userRole === "admin" ||
                selectedSpk.notification?.kadisPelaporId === userId ||
                selectedSpk.notification?.kadis_pelapor_id === userId) && (
                <div className="flex gap-2">
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    onClick={() => {
                      onClose();
                      onApproveKadisPelapor(selectedSpk.order_number);
                    }}
                  >
                    Setujui Selesai
                  </Button>
                  <Button
                    variant="destructive"
                    className="shadow-sm"
                    onClick={() => {
                      onClose();
                      onRejectKadisPelapor(selectedSpk.order_number);
                    }}
                  >
                    Tolak
                  </Button>
                </div>
              )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
