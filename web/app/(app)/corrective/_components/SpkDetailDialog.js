"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Wrench,
  Edit3,
  Save,
  X,
  AlertTriangle,
  Search,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getMediaUrl } from "@/lib/utils";
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
  userGroup,
  onApproveKadisPp,
  onRejectKadisPp,
  onApproveKadisPelapor,
  onRejectKadisPelapor,
  onUpdateSpk,
  onSearchMaterials,
  onAddMaterial,
  onRemoveMaterial,
  equipment = [],
  functionalLocations = [],
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightButtons, setHighlightButtons] = useState(false);
  const highlightTimeout = useRef(null);

  const [editData, setEditData] = useState({
    description: "",
    short_text: "",
    num_of_work: 0,
    dur_plan: 0,
  });

  // Material search state
  const [matSearch, setMatSearch] = useState("");
  const [matResults, setMatResults] = useState([]);
  const [matSearching, setMatSearching] = useState(false);
  const [matQty, setMatQty] = useState(1);
  const [matSelected, setMatSelected] = useState(null);
  const [matAdding, setMatAdding] = useState(false);
  const matSearchTimeout = useRef(null);
  const matDropdownRef = useRef(null);

  useEffect(() => {
    if (selectedSpk) {
      setEditData({
        description: selectedSpk.description || "",
        short_text: selectedSpk.short_text || "",
        num_of_work: selectedSpk.num_of_work || 0,
        dur_plan: selectedSpk.dur_plan || 0,
      });
      setIsEditing(false);
      setHighlightButtons(false);
      // Reset material state
      setMatSearch("");
      setMatResults([]);
      setMatSelected(null);
      setMatQty(1);
    }
  }, [selectedSpk]);

  const triggerHighlight = () => {
    setHighlightButtons(true);
    if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
    highlightTimeout.current = setTimeout(() => {
      setHighlightButtons(false);
    }, 10000);
  };

  const isPlanner =
    userRole === "admin" ||
    (userGroup && userGroup.toLowerCase().includes("perencanaan"));

  const canEdit =
    isPlanner &&
    ![
      "menunggu_review_kadis_pp",
      "menunggu_review_kadis_pelapor",
      "selesai",
    ].includes(selectedSpk?.status);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onUpdateSpk(selectedSpk.order_number, editData);
      setIsEditing(false);
    } catch (error) {
      // toast is handled in action
    } finally {
      setLoading(false);
    }
  };

  // Material search with debounce
  const handleMatSearch = (value) => {
    setMatSearch(value);
    setMatSelected(null);
    if (matSearchTimeout.current) clearTimeout(matSearchTimeout.current);
    if (!value || value.length < 1) {
      setMatResults([]);
      return;
    }
    setMatSearching(true);
    matSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await onSearchMaterials(value);
        setMatResults(results.slice(0, 20));
      } catch {
        setMatResults([]);
      } finally {
        setMatSearching(false);
      }
    }, 300);
  };

  const handleSelectMaterial = (mat) => {
    if (Number(mat.quantity) <= 0) return;
    setMatSelected(mat);
    setMatSearch(`${mat.materialCode} — ${mat.name}`);
    setMatResults([]);
    setMatQty(1);
  };

  const handleAddMaterial = async () => {
    if (!matSelected || matQty <= 0) return;
    setMatAdding(true);
    try {
      await onAddMaterial(selectedSpk.order_number, matSelected.id, Number(matQty));
      setMatSelected(null);
      setMatSearch("");
      setMatQty(1);
    } catch (error) {
      toast.error(error.message || "Gagal menambahkan material");
    } finally {
      setMatAdding(false);
    }
  };

  const handleRemoveMaterial = async (recordId) => {
    try {
      await onRemoveMaterial(selectedSpk.order_number, recordId);
    } catch (error) {
      toast.error(error.message || "Gagal menghapus material");
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (matDropdownRef.current && !matDropdownRef.current.contains(e.target)) {
        setMatResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <AnimatePresence>
      {selectedSpk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (isEditing) {
                toast.warning("Selesaikan Edit Planning!", {
                  description: <span className="text-slate-600">Silakan tekan 'Simpan' atau 'Batal' terlebih dahulu sebelum menutup.</span>
                });
                triggerHighlight();
                return;
              }
              onClose();
            }}
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
            className="relative z-50 bg-white max-w-[95vw] lg:max-w-[80vw] w-full max-h-[90vh] overflow-hidden p-0 rounded-2xl flex flex-col gap-0 shadow-2xl origin-bottom"
          >
        <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-8 py-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Detail SPK SAP
              </h2>
              <div className="text-sm font-mono text-slate-400 mt-1">
                {selectedSpk?.order_number}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {canEdit && !isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white hover:bg-slate-50 text-blue-600 border-blue-200"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 size={14} className="mr-1.5" /> Edit Planning
                </Button>
              )}
              {isEditing && (
                <div 
                  className={cn(
                    "flex gap-2 p-1 rounded-lg transition-all duration-300",
                    highlightButtons ? "ring-4 ring-red-500 ring-offset-2 bg-red-50 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" : ""
                  )}
                >
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    <Save size={14} className="mr-1.5" />{" "}
                    {loading ? "Menyimpan..." : "Simpan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-500 hover:text-slate-700"
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({
                        description: selectedSpk.description || "",
                        short_text: selectedSpk.short_text || "",
                        num_of_work: selectedSpk.num_of_work || 0,
                        dur_plan: selectedSpk.dur_plan || 0,
                      });
                    }}
                  >
                    <X size={14} className="mr-1.5" /> Batal
                  </Button>
                </div>
              )}
              <CorrectiveStatusBadge
                value={selectedSpk?.status}
                colorMap={SAP_STATUS_COLORS}
                labelMap={SAP_STATUS_LABELS}
              />
            </div>
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
            {isEditing && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                <AlertTriangle
                  className="text-amber-500 shrink-0 mt-0.5"
                  size={20}
                />
                <div>
                  <h4 className="text-amber-800 font-bold text-sm">
                    Mode Edit Planning Aktif
                  </h4>
                  <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                    Anda sedang mengubah data perencanaan SPK ini. Pastikan
                    jumlah pekerja, durasi, dan deskripsi sudah tepat dan sesuai
                    dengan kebutuhan aktual sebelum menyimpan. Perubahan akan
                    langsung tersimpan di sistem.
                  </p>
                </div>
              </div>
            )}
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
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  Deskripsi
                  {isEditing && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 normal-case tracking-normal">
                      <Edit3 size={10} /> bisa diedit
                    </span>
                  )}
                </label>
                {isEditing ? (
                  <Textarea
                    value={editData.description}
                    onChange={(e) =>
                      setEditData({ ...editData, description: e.target.value })
                    }
                    className="bg-white min-h-[80px]"
                    placeholder="Masukkan deskripsi..."
                  />
                ) : (
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-h-[46px] text-sm text-slate-700">
                    {selectedSpk.description || "-"}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  Short Text
                  {isEditing && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 normal-case tracking-normal">
                      <Edit3 size={10} /> bisa diedit
                    </span>
                  )}
                </label>
                {isEditing ? (
                  <Textarea
                    value={editData.short_text}
                    onChange={(e) =>
                      setEditData({ ...editData, short_text: e.target.value })
                    }
                    className="bg-white min-h-[80px]"
                    placeholder="Masukkan short text..."
                  />
                ) : (
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-h-[46px] text-sm text-slate-700">
                    {selectedSpk.short_text || "-"}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Section title="Lokasi & Peralatan">
                <Row
                  label="Equipment"
                  value={(() => {
                    const eqItem = equipment.find(
                      (e) =>
                        String(e.equipmentId || e.equipment_id).trim() ===
                        String(selectedSpk.equipment_name).trim(),
                    );
                    const name = eqItem
                      ? eqItem.equipmentName || eqItem.equipment_name
                      : null;
                    return (
                      <div className="flex flex-col">
                        <span className="text-slate-800 font-bold">
                          {name || "-"}
                        </span>
                        {selectedSpk.equipment_name && (
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {selectedSpk.equipment_name}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                />
                <Row
                  label="Functional Loc"
                  value={(() => {
                    const flItem = functionalLocations.find(
                      (f) =>
                        String(f.funcLocId || f.func_loc_id).trim() ===
                        String(selectedSpk.functional_location).trim(),
                    );
                    const desc = flItem ? flItem.description : null;
                    return (
                      <div className="flex flex-col">
                        <span className="text-slate-800 font-bold">
                          {desc || "-"}
                        </span>
                        {selectedSpk.functional_location && (
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {selectedSpk.functional_location}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                />
                <Row label="Location" value={selectedSpk.location} />
                <Row label="Cost Center" value={selectedSpk.cost_center} />
              </Section>
              <Section title="Perencanaan">
                <div className="flex flex-col gap-4 mb-4 mt-2">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-2">
                          Jam Planned
                          {isEditing && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 normal-case tracking-normal">
                              <Edit3 size={10} /> bisa diedit
                            </span>
                          )}
                        </label>
                        <Input
                          type="number"
                          step="0.5"
                          value={editData.dur_plan}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              dur_plan: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="bg-white h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-2">
                          Pekerja Planned (Orang)
                          {isEditing && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 normal-case tracking-normal">
                              <Edit3 size={10} /> bisa diedit
                            </span>
                          )}
                        </label>
                        <Input
                          type="number"
                          value={editData.num_of_work}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              num_of_work: parseInt(e.target.value) || 0,
                            })
                          }
                          className="bg-white h-9"
                        />
                      </div>
                    </>
                  ) : (
                    <Row
                      label="Jam Pekerja (Planned)"
                      value={`${selectedSpk.dur_plan || 0} ${selectedSpk.normal_dur_un || "Jam"} / ${selectedSpk.num_of_work || 0} Orang`}
                    />
                  )}
                </div>
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
                    selectedSpk.notification?.requiredStart ||
                    selectedSpk.notification?.requiredEnd
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

            {/* Material Section — Always visible */}
            <div className="bg-blue-50/50 rounded-2xl border border-blue-100/50 p-5">
              <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
                <Package size={16} /> Material yang Direncanakan
                {selectedSpk?.spkMaterials?.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold">
                    {selectedSpk.spkMaterials.length} item
                  </span>
                )}
              </h4>

              {/* Add material — planner only, when editing */}
              {isPlanner && isEditing && (
                <div className="mb-4 space-y-3">
                  <div className="relative" ref={matDropdownRef}>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={matSearch}
                          onChange={(e) => handleMatSearch(e.target.value)}
                          placeholder="Cari material (kode/nama)..."
                          className="pl-9 bg-white h-9"
                        />
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={matSelected ? Number(matSelected.quantity) : 99999}
                        value={matQty}
                        onChange={(e) => setMatQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-white h-9 text-center"
                        placeholder="Qty"
                        disabled={!matSelected}
                      />
                      <Button
                        size="sm"
                        className="h-9 bg-blue-600 hover:bg-blue-700 text-white px-3"
                        disabled={!matSelected || matAdding || matQty <= 0}
                        onClick={handleAddMaterial}
                      >
                        {matAdding ? "..." : <><Plus size={14} className="mr-1" /> Tambah</>}
                      </Button>
                    </div>

                    {/* Search results dropdown */}
                    {matResults.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        {matResults.map((mat) => {
                          const isOut = Number(mat.quantity) <= 0;
                          return (
                            <button
                              key={mat.id}
                              disabled={isOut}
                              onClick={() => handleSelectMaterial(mat)}
                              className={cn(
                                "w-full px-4 py-3 text-left flex items-center justify-between transition-colors border-b border-slate-50 last:border-0",
                                isOut
                                  ? "opacity-40 cursor-not-allowed bg-slate-50"
                                  : "hover:bg-blue-50 cursor-pointer",
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-slate-600">{mat.materialCode}</span>
                                  {isOut && (
                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">Habis</span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-800 truncate mt-0.5">{mat.name}</p>
                              </div>
                              <div className="text-right ml-3 shrink-0">
                                <div className={cn(
                                  "text-sm font-bold",
                                  isOut ? "text-red-400" : "text-green-600"
                                )}>
                                  {Number(mat.quantity).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-slate-400">{mat.uom || "PCS"}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {matSearching && matSearch.length >= 1 && (
                      <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-sm text-slate-400">
                        Mencari material...
                      </div>
                    )}
                  </div>

                  {matSelected && (
                    <div className="flex items-center gap-2 bg-blue-100/50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
                      <Package size={14} className="text-blue-600 shrink-0" />
                      <span className="text-blue-800 font-medium truncate">
                        {matSelected.materialCode} — {matSelected.name}
                      </span>
                      <span className="text-blue-600 text-xs shrink-0">
                        (Stok: {Number(matSelected.quantity).toLocaleString()} {matSelected.uom || "PCS"})
                      </span>
                      <button onClick={() => { setMatSelected(null); setMatSearch(""); }}
                        className="ml-auto text-blue-400 hover:text-blue-600">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Material list */}
              {selectedSpk?.spkMaterials?.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Kode</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Nama Material</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Qty Pakai</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">UoM</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Sisa Stok</th>
                        {isPlanner && isEditing && (
                          <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-16"></th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSpk.spkMaterials.map((sm) => (
                        <tr key={sm.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{sm.material?.materialCode || sm.material?.material_code || "-"}</td>
                          <td className="px-4 py-2.5 text-slate-800">{sm.material?.name || "-"}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-blue-700">{Number(sm.quantityUsed || sm.quantity_used)}</td>
                          <td className="px-4 py-2.5 text-center text-slate-500 text-xs">{sm.material?.uom || "PCS"}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={cn(
                              "text-xs font-semibold px-2 py-0.5 rounded-full",
                              Number(sm.material?.quantity) > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                            )}>
                              {Number(sm.material?.quantity ?? 0).toLocaleString()}
                            </span>
                          </td>
                          {isPlanner && isEditing && (
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => handleRemoveMaterial(sm.id)}
                                className="text-red-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                title="Hapus material & kembalikan stok"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-slate-400">
                  Belum ada material yang ditambahkan
                </div>
              )}
            </div>
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
          <Button 
            variant="outline" 
            onClick={() => {
              if (isEditing) {
                toast.warning("Selesaikan Edit Planning!", {
                  description: <span className="text-slate-600">Silakan tekan 'Simpan' atau 'Batal' terlebih dahulu sebelum menutup.</span>
                });
                triggerHighlight();
                return;
              }
              onClose();
            }}
          >
            Tutup
          </Button>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
