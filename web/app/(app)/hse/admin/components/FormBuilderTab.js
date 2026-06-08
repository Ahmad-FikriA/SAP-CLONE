"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiGet, apiPut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Copy,
  ToggleLeft,
  Type,
  AlignLeft,
  CheckSquare,
  CircleDot,
  Hash,
  HelpCircle,
  X,
  Sliders,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Upload,
  LayoutList,
  Loader2,
  ListChecks,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION TYPE CONFIG (enhanced — Google Forms parity)
// ═══════════════════════════════════════════════════════════════════════════════
const QUESTION_TYPES = [
  { key: "short_text", label: "Jawaban Singkat", icon: Type, group: "text" },
  {
    key: "long_text",
    label: "Jawaban Panjang",
    icon: AlignLeft,
    group: "text",
  },
  { key: "number", label: "Angka", icon: Hash, group: "text" },
  {
    key: "multiple_choice",
    label: "Pilihan Ganda",
    icon: CircleDot,
    group: "choice",
  },
  {
    key: "checkbox",
    label: "Kotak Centang",
    icon: CheckSquare,
    group: "choice",
  },
  { key: "dropdown", label: "Dropdown", icon: ChevronDown, group: "choice" },
  { key: "yes_no", label: "Ya / Tidak", icon: ToggleLeft, group: "choice" },
  {
    key: "linear_scale",
    label: "Skala Linier",
    icon: Sliders,
    group: "special",
  },
  { key: "date", label: "Tanggal", icon: CalendarIcon, group: "special" },
  { key: "time", label: "Waktu", icon: ClockIcon, group: "special" },
  { key: "file_upload", label: "Upload File", icon: Upload, group: "special" },
  {
    key: "section",
    label: "── Pemisah Bagian ──",
    icon: LayoutList,
    group: "layout",
  },
];

const QUESTION_TYPE_GROUPS = [
  { key: "text", label: "Teks" },
  { key: "choice", label: "Pilihan" },
  { key: "special", label: "Spesial" },
  { key: "layout", label: "Tata Letak" },
];

const INVESTIGATION_CATEGORIES = [
  { key: "kecelakaan", label: "Kecelakaan", color: "bg-rose-500" },
  {
    key: "penyakit_kerja",
    label: "Penyakit Akibat Kerja",
    color: "bg-amber-500",
  },
  { key: "kebakaran", label: "Kebakaran", color: "bg-orange-500" },
];

// INITIAL_FORM_DATA without dummy questions (fully database driven)
const INITIAL_FORM_DATA = {
  kecelakaan: {
    title: "Form Investigasi Kecelakaan",
    description:
      "Form ini digunakan untuk melengkapi data investigasi insiden kecelakaan kerja. Isi semua pertanyaan dengan lengkap dan akurat.",
    questions: [],
  },
  penyakit_kerja: {
    title: "Form Investigasi Penyakit Akibat Kerja",
    description:
      "Form ini digunakan untuk investigasi kasus penyakit yang disebabkan oleh kondisi kerja.",
    questions: [],
  },
  kebakaran: {
    title: "Form Investigasi Kebakaran",
    description:
      "Form ini digunakan untuk investigasi insiden kebakaran di area kerja.",
    questions: [],
  },
};

export default function FormBuilderTab() {
  const [activeCategory, setActiveCategory] = useState("kecelakaan");
  const [formData, setFormData] = useState(
    JSON.parse(JSON.stringify(INITIAL_FORM_DATA)),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [animatingId, setAnimatingId] = useState(null);
  const [animatingDir, setAnimatingDir] = useState(null);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [draggableId, setDraggableId] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // ── Load form config from backend ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet("/k3-settings");
        if (cancelled) return;
        const saved = res?.data?.formInvestigasi;
        if (saved && typeof saved === "object" && Object.keys(saved).length > 0) {
          // Merge: use saved data but fall back to INITIAL_FORM_DATA for missing categories
          const merged = { ...JSON.parse(JSON.stringify(INITIAL_FORM_DATA)) };
          for (const key of Object.keys(merged)) {
            if (saved[key] && saved[key].questions && saved[key].questions.length > 0) {
              merged[key] = saved[key];
            }
          }
          setFormData(merged);
        }
      } catch (e) {
        console.error("Failed to load form investigasi config", e);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Track changes ─────────────────────────────────────────────────────────
  const markChanged = useCallback(() => setHasChanges(true), []);
  const originalSetFormData = setFormData;
  const setFormDataTracked = useCallback((updater) => {
    originalSetFormData(updater);
    markChanged();
  }, [originalSetFormData, markChanged]);

  // ── Save to backend ───────────────────────────────────────────────────────
  const saveFormConfig = async () => {
    setIsSaving(true);
    try {
      await apiPut("/k3-settings", { formInvestigasi: formData });
      toast.success("Konfigurasi form investigasi berhasil disimpan");
      setHasChanges(false);
    } catch (e) {
      toast.error(e.message || "Gagal menyimpan konfigurasi form");
    } finally {
      setIsSaving(false);
    }
  };

  const currentForm = formData[activeCategory] || {
    title: "",
    description: "",
    questions: [],
  };
  const questions = currentForm.questions || [];

  // ── Form Header Helpers ────────────────────────────────────────────────────
  const updateFormHeader = (field, value) => {
    setFormDataTracked((prev) => ({
      ...prev,
      [activeCategory]: { ...prev[activeCategory], [field]: value },
    }));
  };

  // ── Question CRUD ──────────────────────────────────────────────────────────
  const addQuestion = (type = "short_text") => {
    const isSection = type === "section";
    const newQ = {
      id: `q_${Date.now()}`,
      label: isSection ? "Bagian Baru" : "",
      description: "",
      type,
      required: false,
      options: ["multiple_choice", "checkbox", "dropdown"].includes(type)
        ? ["Opsi 1"]
        : [],
      config:
        type === "linear_scale"
          ? { scaleMin: 1, scaleMax: 5, labelMin: "", labelMax: "" }
          : type === "number"
            ? { min: undefined, max: undefined }
            : type === "file_upload"
              ? { accept: "image/*", maxFiles: 5 }
              : {},
    };
    setFormDataTracked((prev) => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        questions: [...prev[activeCategory].questions, newQ],
      },
    }));
    setEditingQuestion(newQ.id);
    setAddMenuOpen(false);
  };

  const updateQuestion = (qId, updates) => {
    setFormDataTracked((prev) => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        questions: prev[activeCategory].questions.map((q) =>
          q.id === qId ? { ...q, ...updates } : q,
        ),
      },
    }));
  };

  const updateConfig = (qId, cfgUpdates) => {
    const q = questions.find((x) => x.id === qId);
    if (!q) return;
    updateQuestion(qId, { config: { ...(q.config || {}), ...cfgUpdates } });
  };

  const deleteQuestion = (qId) => {
    setFormDataTracked((prev) => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        questions: prev[activeCategory].questions.filter((q) => q.id !== qId),
      },
    }));
    if (editingQuestion === qId) setEditingQuestion(null);
  };

  const duplicateQuestion = (q) => {
    const dup = {
      ...JSON.parse(JSON.stringify(q)),
      id: `q_${Date.now()}`,
      label: q.label + " (Copy)",
    };
    setFormDataTracked((prev) => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        questions: [...prev[activeCategory].questions, dup],
      },
    }));
  };

  const moveQuestion = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= questions.length) return;
    
    const q1 = questions[idx];
    
    setAnimatingId(q1.id);
    setAnimatingDir(direction);
    
    setTimeout(() => {
      setFormDataTracked((prev) => {
        const arr = [...prev[activeCategory].questions];
        [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
        return {
          ...prev,
          [activeCategory]: { ...prev[activeCategory], questions: arr },
        };
      });
      setAnimatingId(null);
      setAnimatingDir(null);
    }, 250);
  };

  const handleDragDrop = (targetIdx) => {
    const finalIdx = dragOverIdx !== null ? dragOverIdx : targetIdx;
    if (draggedIdx === null || finalIdx === null || draggedIdx === finalIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    setFormDataTracked((prev) => {
      const arr = [...prev[activeCategory].questions];
      const [movedItem] = arr.splice(draggedIdx, 1);
      arr.splice(finalIdx, 0, movedItem);
      return {
        ...prev,
        [activeCategory]: { ...prev[activeCategory], questions: arr },
      };
    });
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // ── Option helpers ─────────────────────────────────────────────────────────
  const addOption = (qId) => {
    const q = questions.find((x) => x.id === qId);
    if (!q) return;
    updateQuestion(qId, {
      options: [...q.options, `Opsi ${q.options.length + 1}`],
    });
  };

  const updateOption = (qId, optIdx, value) => {
    const q = questions.find((x) => x.id === qId);
    if (!q) return;
    const opts = [...q.options];
    opts[optIdx] = value;
    updateQuestion(qId, { options: opts });
  };

  const removeOption = (qId, optIdx) => {
    const q = questions.find((x) => x.id === qId);
    if (!q) return;
    updateQuestion(qId, { options: q.options.filter((_, i) => i !== optIdx) });
  };

  const getTypeInfo = (type) =>
    QUESTION_TYPES.find((t) => t.key === type) || QUESTION_TYPES[0];
  const needsOptions = (type) =>
    ["multiple_choice", "checkbox", "dropdown"].includes(type);
  const catInfo = INVESTIGATION_CATEGORIES.find(
    (c) => c.key === activeCategory,
  );
  const questionCount = questions.filter((q) => q.type !== "section").length;
  const sectionCount = questions.filter((q) => q.type === "section").length;

  if (!isLoaded) {
    return <div className="p-8 text-center text-slate-500">Memuat konfigurasi form...</div>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl p-4">
        <ListChecks size={16} className="text-violet-500 mt-0.5 shrink-0" />
        <div className="text-xs text-violet-700 space-y-1">
          <p className="font-semibold">Form Pertanyaan Investigasi</p>
          <p>
            Buat dan kelola template pertanyaan seperti Google Form untuk setiap
            kategori investigasi. Tersedia berbagai tipe pertanyaan: teks,
            pilihan ganda, skala, upload file, dan lainnya.
          </p>
        </div>
      </div>

      {/* Category Switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-fit">
        {INVESTIGATION_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => {
              setActiveCategory(cat.key);
              setEditingQuestion(null);
            }}
            className={cn(
              "flex-1 sm:flex-initial px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap",
              activeCategory === cat.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {cat.label}
            <span className="ml-1.5 text-xs text-slate-400 font-normal">
              (
              {
                (formData[cat.key]?.questions || []).filter(
                  (q) => q.type !== "section",
                ).length
              }
              )
            </span>
          </button>
        ))}
      </div>

      {/* ── Form Header (editable title & description) ── */}
      <div
        className={cn(
          "rounded-2xl overflow-hidden border shadow-sm",
          "border-slate-200",
        )}
      >
        <div className={cn("h-2", catInfo?.color || "bg-violet-500")} />
        <div className="bg-white p-5 sm:p-6 space-y-3">
          <input
            type="text"
            value={currentForm.title}
            onChange={(e) => updateFormHeader("title", e.target.value)}
            placeholder="Judul Form"
            className="w-full text-xl sm:text-2xl font-bold text-slate-900 placeholder:text-slate-300 border-0 border-b-2 border-transparent focus:border-blue-500 outline-none pb-1.5 transition-colors bg-transparent"
          />
          <textarea
            value={currentForm.description}
            onChange={(e) => updateFormHeader("description", e.target.value)}
            placeholder="Deskripsi form (opsional)"
            rows={2}
            className="w-full text-sm text-slate-600 placeholder:text-slate-300 border-0 border-b border-transparent focus:border-blue-400 outline-none resize-none transition-colors bg-transparent"
          />
          <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
            <span>{questionCount} pertanyaan</span>
            {sectionCount > 0 && <span>{sectionCount} bagian</span>}
          </div>
        </div>
      </div>

      {/* Questions Header & Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Pertanyaan — {catInfo?.label}
        </h3>
        <div className="flex gap-2">
          <Button
            variant={hasChanges ? "default" : "outline"}
            size="sm"
            className={cn(
              "gap-1.5 transition-all duration-300",
              hasChanges && "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm"
            )}
            onClick={saveFormConfig}
            disabled={isSaving}
          >
            <Save size={14} />
            {isSaving ? "Menyimpan..." : "Simpan Form"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye size={14} />
            Preview
          </Button>
          {/* Add Question Dropdown */}
          <div className="relative">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setAddMenuOpen(!addMenuOpen)}
            >
              <Plus size={14} />
              Tambah
              <ChevronDown size={12} />
            </Button>
            {addMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAddMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-1 max-h-80 overflow-y-auto">
                  {QUESTION_TYPE_GROUPS.map((group) => {
                    const items = QUESTION_TYPES.filter(
                      (t) => t.group === group.key,
                    );
                    if (items.length === 0) return null;
                    return (
                      <div key={group.key}>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {group.label}
                        </div>
                        {items.map((t) => {
                          const Icon = t.icon;
                          return (
                            <button
                              key={t.key}
                              onClick={() => addQuestion(t.key)}
                              className={cn(
                                "w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm hover:bg-slate-50 transition-colors",
                                t.key === "section" &&
                                  "text-violet-700 font-medium",
                              )}
                            >
                              <Icon
                                size={15}
                                className={
                                  t.key === "section"
                                    ? "text-violet-500"
                                    : "text-slate-400"
                                }
                              />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Question List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <ListChecks size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              Belum ada pertanyaan
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Klik &quot;Tambah&quot; untuk mulai membuat form.
            </p>
          </div>
        ) : (
          (() => {
            const renderQuestions = [...questions];
            if (draggedIdx !== null && dragOverIdx !== null && draggedIdx !== dragOverIdx) {
              const [movedItem] = renderQuestions.splice(draggedIdx, 1);
              renderQuestions.splice(dragOverIdx, 0, movedItem);
            }
            return renderQuestions.map((q, idx) => {
              const typeInfo = getTypeInfo(q.type);
              const TypeIcon = typeInfo.icon;
              const isExpanded = editingQuestion === q.id;
              const isSection = q.type === "section";

              const isAnimating = q.id === animatingId;
              const isPartner = animatingId && (
                (animatingDir === 1 && idx > 0 && questions[idx - 1].id === animatingId) ||
                (animatingDir === -1 && idx < questions.length - 1 && questions[idx + 1].id === animatingId)
              );

              const animationClass = cn(
                (isAnimating || isPartner) ? "transition-all duration-200 ease-in-out transform" : "transition-none transform-none",
                isAnimating && animatingDir === 1 && "translate-y-[calc(100%+12px)] scale-[1.01] border-blue-400 shadow-md z-20 bg-blue-50/10",
                isAnimating && animatingDir === -1 && "-translate-y-[calc(100%+12px)] scale-[1.01] border-blue-400 shadow-md z-20 bg-blue-50/10",
                isPartner && animatingDir === 1 && "-translate-y-[calc(100%+12px)] scale-[0.99] opacity-90 z-10",
                isPartner && animatingDir === -1 && "translate-y-[calc(100%+12px)] scale-[0.99] opacity-90 z-10"
              );

              // ── Section Separator Card ──
              if (isSection) {
                return (
                  <div
                    key={q.id}
                    draggable={draggableId === q.id}
                    onDragStart={(e) => {
                      setDraggedIdx(idx);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDraggableId(null);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => {
                      if (draggedIdx !== null && q.id !== draggableId) setDragOverIdx(idx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDragDrop(idx);
                    }}
                    className={cn(
                      "rounded-xl overflow-hidden border",
                      isExpanded
                        ? "border-violet-300 shadow-md shadow-violet-100"
                        : "border-slate-200 shadow-sm",
                      q.id === draggableId && "opacity-35 border-blue-400 bg-blue-50/10 border-dashed border-2 shadow-inner",
                      animationClass
                    )}
                  >
                  <div
                    className={cn("h-1.5", catInfo?.color || "bg-violet-500")}
                  />
                  <div
                    className="bg-white px-5 py-4 cursor-pointer"
                    onClick={() => setEditingQuestion(isExpanded ? null : q.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div 
                        className="flex items-center gap-1 mt-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
                        onMouseDown={() => setDraggableId(q.id)}
                        onMouseUp={() => setDraggableId(null)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {isExpanded ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={q.label}
                              onChange={(e) =>
                                updateQuestion(q.id, { label: e.target.value })
                              }
                              placeholder="Judul bagian"
                              className="w-full text-base font-semibold text-slate-900 placeholder:text-slate-300 border-0 border-b-2 border-violet-300 outline-none pb-1 bg-transparent"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <input
                              type="text"
                              value={q.description}
                              onChange={(e) =>
                                updateQuestion(q.id, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Deskripsi bagian (opsional)"
                              className="w-full text-sm text-slate-500 placeholder:text-slate-300 border-0 border-b border-slate-200 outline-none pb-1 bg-transparent"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-base font-semibold text-slate-900">
                              {q.label || "Bagian tanpa judul"}
                            </p>
                            {q.description && (
                              <p className="text-sm text-slate-500 mt-0.5">
                                {q.description}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveQuestion(idx, -1);
                          }}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ChevronUp size={14} className="text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveQuestion(idx, 1);
                          }}
                          disabled={idx === questions.length - 1}
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ChevronDown size={14} className="text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteQuestion(q.id);
                          }}
                          className="p-1 rounded hover:bg-rose-50"
                          title="Hapus"
                        >
                          <Trash2 size={13} className="text-rose-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // ── Regular Question Card ──
            return (
              <div
                key={q.id}
                draggable={draggableId === q.id}
                onDragStart={(e) => {
                  setDraggedIdx(idx);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDraggableId(null);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => {
                  if (draggedIdx !== null && q.id !== draggableId) setDragOverIdx(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDragDrop(idx);
                }}
                className={cn(
                  "bg-white rounded-xl border",
                  isExpanded
                    ? "border-blue-300 shadow-md shadow-blue-100"
                    : "border-slate-200 shadow-sm hover:shadow",
                  q.id === draggableId && "opacity-35 border-blue-400 bg-blue-50/10 border-dashed border-2 shadow-inner",
                  animationClass
                )}
              >
                {/* Question Header (collapsed view) */}
                <div
                  className="px-4 py-3 flex items-start gap-3 cursor-pointer"
                  onClick={() => setEditingQuestion(isExpanded ? null : q.id)}
                >
                  <div 
                    className="flex items-center gap-1 mt-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
                    onMouseDown={() => setDraggableId(q.id)}
                    onMouseUp={() => setDraggableId(null)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical size={14} />
                    <span className="text-xs font-bold text-slate-400 w-5">
                      {
                        questions.filter(
                          (x, i) => i <= idx && x.type !== "section",
                        ).length
                      }
                      .
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          q.label ? "text-slate-800" : "text-slate-400 italic",
                        )}
                      >
                        {q.label || "Pertanyaan tanpa judul"}
                      </p>
                      {q.required && (
                        <span className="text-[10px] font-bold text-rose-500">
                          WAJIB
                        </span>
                      )}
                    </div>
                    {q.description && !isExpanded && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {q.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <TypeIcon size={12} className="text-slate-400" />
                      <span className="text-[11px] text-slate-400 font-medium">
                        {typeInfo.label}
                      </span>
                      {needsOptions(q.type) && q.options.length > 0 && (
                        <span className="text-[11px] text-slate-300">
                          · {q.options.length} opsi
                        </span>
                      )}
                      {q.config?.allowOther && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                          + Lainnya
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(idx, -1);
                      }}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronUp size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(idx, 1);
                      }}
                      disabled={idx === questions.length - 1}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronDown size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateQuestion(q);
                      }}
                      className="p-1 rounded hover:bg-slate-100"
                      title="Duplikat"
                    >
                      <Copy size={13} className="text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteQuestion(q.id);
                      }}
                      className="p-1 rounded hover:bg-rose-50"
                      title="Hapus"
                    >
                      <Trash2 size={13} className="text-rose-400" />
                    </button>
                  </div>
                </div>

                {/* Expanded Editor */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">
                    {/* Row 1: Teks Pertanyaan & Tipe Jawaban (Google Forms style) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Left: Question text (2/3 width) */}
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Teks Pertanyaan
                        </label>
                        <Input
                          value={q.label}
                          onChange={(e) =>
                            updateQuestion(q.id, { label: e.target.value })
                          }
                          placeholder="Tulis pertanyaan di sini..."
                          className="h-10 text-sm font-medium"
                          autoFocus
                        />
                      </div>

                      {/* Right: Type selector (1/3 width) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Tipe Jawaban
                        </label>
                        <Select
                          value={q.type}
                          onValueChange={(v) => {
                            const updates = { type: v };
                            if (!needsOptions(v) && needsOptions(q.type)) {
                              updates.options = [];
                            }
                            if (needsOptions(v) && !needsOptions(q.type)) {
                              updates.options = ["Opsi 1", "Opsi 2"];
                            }
                            if (
                              v === "linear_scale" &&
                              q.type !== "linear_scale"
                            ) {
                              updates.config = {
                                scaleMin: 1,
                                scaleMax: 5,
                                labelMin: "",
                                labelMax: "",
                              };
                            }
                            if (v === "number" && q.type !== "number") {
                              updates.config = { min: undefined, max: undefined };
                            }
                            if (v === "file_upload" && q.type !== "file_upload") {
                              updates.config = {
                                accept: "image/*",
                                maxFiles: 5,
                                maxSizeKB: 500,
                              };
                            }
                            updateQuestion(q.id, updates);
                          }}
                        >
                          <SelectTrigger className="h-10 text-sm font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-80 min-w-[240px]">
                            {QUESTION_TYPE_GROUPS.filter(
                              (g) => g.key !== "layout",
                            ).map((group) => {
                              const items = QUESTION_TYPES.filter(
                                (t) => t.group === group.key,
                              );
                              if (items.length === 0) return null;
                              return (
                                <SelectGroup key={group.key}>
                                  <SelectLabel className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {group.label}
                                  </SelectLabel>
                                  {items.map((t) => {
                                    const Icon = t.icon;
                                    return (
                                      <SelectItem key={t.key} value={t.key} className="py-2.5 pl-8 cursor-pointer">
                                        <div className="flex items-center gap-2">
                                          <Icon
                                            size={14}
                                            className="text-slate-400 shrink-0"
                                          />
                                          <span className="text-slate-700 text-sm font-medium">{t.label}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectGroup>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 2: Description / Petunjuk (opsional, full width) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <HelpCircle size={11} className="text-slate-400" />
                        Deskripsi / Petunjuk
                        <span className="text-slate-300 font-normal">
                          (opsional)
                        </span>
                      </label>
                      <Input
                        value={q.description || ""}
                        onChange={(e) =>
                          updateQuestion(q.id, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Tambahkan deskripsi atau petunjuk pengisian..."
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Options Editor */}
                    {needsOptions(q.type) && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">
                          Opsi Jawaban
                        </label>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0 flex items-center justify-center text-[10px] text-slate-400">
                              {q.type === "checkbox"
                                ? "☐"
                                : q.type === "dropdown"
                                  ? "▾"
                                  : String.fromCharCode(65 + optIdx)}
                            </span>
                            <Input
                              value={opt}
                              onChange={(e) =>
                                updateOption(q.id, optIdx, e.target.value)
                              }
                              className="h-9 flex-1"
                            />
                            <button
                              onClick={() => removeOption(q.id, optIdx)}
                              className="p-1 rounded hover:bg-rose-50"
                              disabled={q.options.length <= 1}
                            >
                              <X
                                size={14}
                                className={
                                  q.options.length <= 1
                                    ? "text-slate-200"
                                    : "text-rose-400"
                                }
                              />
                            </button>
                          </div>
                        ))}
                        {q.config?.allowOther && (
                          <div className="flex items-center gap-2 opacity-60">
                            <span className="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 shrink-0 flex items-center justify-center text-[10px] text-slate-400">
                              {q.type === "checkbox" ? "☐" : "○"}
                            </span>
                            <span className="text-sm text-slate-400 italic">
                              Lainnya...
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 pl-7">
                          <button
                            onClick={() => addOption(q.id)}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <Plus size={12} />
                            Tambah opsi
                          </button>
                          <span className="text-slate-200">|</span>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.config?.allowOther || false}
                              onChange={(e) =>
                                updateConfig(q.id, {
                                  allowOther: e.target.checked,
                                })
                              }
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-500">
                              Tambah &quot;Lainnya&quot;
                            </span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Linear Scale Config */}
                    {q.type === "linear_scale" && (
                      <div className="space-y-3 bg-slate-50 rounded-lg p-3">
                        <label className="text-xs font-medium text-slate-600">
                          Pengaturan Skala
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">
                              Mulai dari
                            </label>
                            <Select
                              value={String(q.config?.scaleMin || 0)}
                              onValueChange={(v) =>
                                updateConfig(q.id, { scaleMin: parseInt(v) })
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1].map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">
                              Sampai
                            </label>
                            <Select
                              value={String(q.config?.scaleMax || 5)}
                              onValueChange={(v) =>
                                updateConfig(q.id, { scaleMax: parseInt(v) })
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">
                              Label nilai terendah
                            </label>
                            <Input
                              value={q.config?.labelMin || ""}
                              onChange={(e) =>
                                updateConfig(q.id, { labelMin: e.target.value })
                              }
                              placeholder="mis. Sangat Buruk"
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">
                              Label nilai tertinggi
                            </label>
                            <Input
                              value={q.config?.labelMax || ""}
                              onChange={(e) =>
                                updateConfig(q.id, { labelMax: e.target.value })
                              }
                              placeholder="mis. Sangat Baik"
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                        <div className="pt-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>{q.config?.labelMin || ""}</span>
                            <span>{q.config?.labelMax || ""}</span>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            {Array.from(
                              {
                                length:
                                  (q.config?.scaleMax || 5) -
                                  (q.config?.scaleMin || 1) +
                                  1,
                              },
                              (_, i) => (q.config?.scaleMin || 1) + i,
                            ).map((n) => (
                              <div
                                key={n}
                                className="flex flex-col items-center gap-1"
                              >
                                <span className="w-7 h-7 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs text-slate-500">
                                  {n}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Number validation */}
                    {q.type === "number" && (
                      <div className="space-y-2 bg-slate-50 rounded-lg p-3">
                        <label className="text-xs font-medium text-slate-600">
                          Validasi Angka
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">
                              Minimum
                            </label>
                            <Input
                              type="number"
                              value={q.config?.min ?? ""}
                              onChange={(e) =>
                                updateConfig(q.id, {
                                  min:
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                })
                              }
                              placeholder="tanpa batas"
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">
                              Maksimum
                            </label>
                            <Input
                              type="number"
                              value={q.config?.max ?? ""}
                              onChange={(e) =>
                                updateConfig(q.id, {
                                  max:
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                })
                              }
                              placeholder="tanpa batas"
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* File Upload Config */}
                    {q.type === "file_upload" && (
                      <div className="space-y-2 bg-slate-50 rounded-lg p-3">
                        <label className="text-xs font-medium text-slate-600">
                          Pengaturan Upload
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">
                              Tipe file
                            </label>
                            <Select
                              value={q.config?.accept || "image/*"}
                              onValueChange={(v) =>
                                updateConfig(q.id, { accept: v })
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="image/*">
                                  Gambar saja
                                </SelectItem>
                                <SelectItem value=".pdf,.doc,.docx">
                                  Dokumen saja
                                </SelectItem>
                                <SelectItem value="image/*,.pdf,.doc,.docx">
                                  Gambar & Dokumen
                                </SelectItem>
                                <SelectItem value="*">
                                  Semua tipe file
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">
                              Maks. jumlah file
                            </label>
                            <Select
                              value={String(q.config?.maxFiles || 5)}
                              onValueChange={(v) =>
                                updateConfig(q.id, { maxFiles: parseInt(v) })
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 5, 10].map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n} file
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-500">
                              Ukuran maks (KB)
                            </label>
                            <Input
                              type="number"
                              value={q.config?.maxSizeKB ?? 500}
                              onChange={(e) =>
                                updateConfig(q.id, {
                                  maxSizeKB:
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                })
                              }
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bottom bar: Required toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <button
                          onClick={() =>
                            updateQuestion(q.id, { required: !q.required })
                          }
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            q.required ? "bg-blue-600" : "bg-slate-200",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                              q.required ? "translate-x-4" : "translate-x-1",
                            )}
                          />
                        </button>
                        <span className="text-xs font-medium text-slate-600">
                          Wajib diisi
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          });
        })()
      )}
      </div>

      {/* Quick Add Floating Button */}
      {questions.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => addQuestion("short_text")}
            className="gap-1.5 rounded-full shadow-sm"
          >
            <Plus size={14} />
            Tambah Pertanyaan
          </Button>
        </div>
      )}

      {/* ── Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} className="text-blue-600" />
              Preview Form
            </DialogTitle>
            <DialogDescription>
              Tampilan form investigasi yang akan dilihat petugas HSE di
              aplikasi.
            </DialogDescription>
          </DialogHeader>

          {/* Preview: Form Header */}
          <div className="rounded-xl overflow-hidden border border-slate-200 mt-2">
            <div className={cn("h-2", catInfo?.color || "bg-violet-500")} />
            <div className="p-5 bg-white">
              <h2 className="text-lg font-bold text-slate-900">
                {currentForm.title || "Tanpa Judul"}
              </h2>
              {currentForm.description && (
                <p className="text-sm text-slate-500 mt-1">
                  {currentForm.description}
                </p>
              )}
              <p className="text-xs text-rose-500 mt-3">
                * Menandakan pertanyaan wajib
              </p>
            </div>
          </div>

          {/* Preview: Questions */}
          <div className="space-y-3 py-2">
            {questions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                Belum ada pertanyaan.
              </p>
            ) : (
              questions.map((q, idx) => {
                if (q.type === "section") {
                  return (
                    <div
                      key={q.id}
                      className="rounded-xl overflow-hidden border border-slate-200"
                    >
                      <div
                        className={cn(
                          "h-1.5",
                          catInfo?.color || "bg-violet-500",
                        )}
                      />
                      <div className="p-4 bg-white">
                        <h3 className="text-base font-semibold text-slate-900">
                          {q.label}
                        </h3>
                        {q.description && (
                          <p className="text-sm text-slate-500 mt-0.5">
                            {q.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                const qNum = questions.filter(
                  (x, i) => i <= idx && x.type !== "section",
                ).length;

                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 space-y-3"
                  >
                    <div className="flex items-start gap-1 font-medium text-slate-800 text-sm">
                      <span>{qNum}.</span>
                      <span>{q.label || "Pertanyaan tanpa judul"}</span>
                      {q.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </div>

                    {q.description && (
                      <p className="text-xs text-slate-400 pl-4">
                        {q.description}
                      </p>
                    )}

                    {/* Input renderings */}
                    {["short_text", "number"].includes(q.type) && (
                      <Input
                        type={q.type === "number" ? "number" : "text"}
                        disabled
                        placeholder="Jawaban Anda"
                        className="h-10 max-w-md bg-slate-50/50"
                      />
                    )}

                    {q.type === "long_text" && (
                      <textarea
                        disabled
                        placeholder="Jawaban panjang Anda"
                        rows={3}
                        className="w-full text-sm border border-slate-200 rounded-lg p-3 bg-slate-50/50 resize-none outline-none"
                      />
                    )}

                    {q.type === "yes_no" && (
                      <div className="flex items-center gap-6 pl-4">
                        {["Ya", "Tidak"].map((o) => (
                          <label
                            key={o}
                            className="flex items-center gap-2 text-sm text-slate-600"
                          >
                            <input
                              type="radio"
                              name={q.id}
                              disabled
                              className="w-4 h-4 text-blue-600 border-slate-300"
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    )}

                    {q.type === "multiple_choice" && (
                      <div className="space-y-2.5 pl-4">
                        {q.options.map((opt, oIdx) => (
                          <label
                            key={oIdx}
                            className="flex items-center gap-2 text-sm text-slate-600"
                          >
                            <input
                              type="radio"
                              name={q.id}
                              disabled
                              className="w-4 h-4 text-blue-600 border-slate-300"
                            />
                            {opt}
                          </label>
                        ))}
                        {q.config?.allowOther && (
                          <label className="flex items-center gap-2 text-sm text-slate-500 italic">
                            <input
                              type="radio"
                              name={q.id}
                              disabled
                              className="w-4 h-4 text-blue-600 border-slate-300"
                            />
                            Lainnya:{" "}
                            <span className="border-b border-dashed border-slate-300 w-36 inline-block" />
                          </label>
                        )}
                      </div>
                    )}

                    {q.type === "checkbox" && (
                      <div className="space-y-2.5 pl-4">
                        {q.options.map((opt, oIdx) => (
                          <label
                            key={oIdx}
                            className="flex items-center gap-2 text-sm text-slate-600"
                          >
                            <input
                              type="checkbox"
                              disabled
                              className="w-4 h-4 rounded text-blue-600 border-slate-300"
                            />
                            {opt}
                          </label>
                        ))}
                        {q.config?.allowOther && (
                          <label className="flex items-center gap-2 text-sm text-slate-500 italic">
                            <input
                              type="checkbox"
                              disabled
                              className="w-4 h-4 rounded text-blue-600 border-slate-300"
                            />
                            Lainnya:{" "}
                            <span className="border-b border-dashed border-slate-300 w-36 inline-block" />
                          </label>
                        )}
                      </div>
                    )}

                    {q.type === "dropdown" && (
                      <div className="w-full max-w-xs border border-slate-200 rounded-lg h-10 px-3 bg-slate-50/50 flex items-center justify-between text-sm text-slate-400">
                        <span>Pilih opsi</span>
                        <ChevronDown size={16} />
                      </div>
                    )}

                    {q.type === "date" && (
                      <div className="w-full max-w-xs border border-slate-200 rounded-lg h-10 px-3 bg-slate-50/50 flex items-center justify-between text-sm text-slate-400">
                        <span>Pilih tanggal (HH/BB/TTTT)</span>
                        <CalendarIcon size={16} />
                      </div>
                    )}

                    {q.type === "time" && (
                      <div className="w-full max-w-xs border border-slate-200 rounded-lg h-10 px-3 bg-slate-50/50 flex items-center justify-between text-sm text-slate-400">
                        <span>Pilih waktu (WIB)</span>
                        <ClockIcon size={16} />
                      </div>
                    )}

                    {q.type === "linear_scale" && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 max-w-md mb-1 pl-2">
                          <span>{q.config?.labelMin || ""}</span>
                          <span>{q.config?.labelMax || ""}</span>
                        </div>
                        <div className="flex items-center gap-4 pl-2">
                          {Array.from(
                            {
                              length:
                                (q.config?.scaleMax || 5) -
                                (q.config?.scaleMin || 1) +
                                1,
                            },
                            (_, i) => (q.config?.scaleMin || 1) + i,
                          ).map((n) => (
                            <label
                              key={n}
                              className="flex flex-col items-center gap-1.5 cursor-pointer text-xs text-slate-600"
                            >
                              <span>{n}</span>
                              <input
                                type="radio"
                                name={q.id}
                                disabled
                                className="w-4 h-4 text-blue-600 border-slate-300"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {q.type === "file_upload" && (
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center bg-slate-50">
                        <Upload
                          size={20}
                          className="mx-auto text-slate-300 mb-2"
                        />
                        <p className="text-sm text-slate-500 font-medium">
                          Klik atau seret file ke sini
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {q.config?.accept === "image/*"
                            ? "Gambar"
                            : q.config?.accept === "*"
                              ? "Semua tipe file"
                              : q.config?.accept || "File"}
                          {" · "}Maks. {q.config?.maxFiles || 5} file
                          {q.config?.maxSizeKB &&
                            ` · Maks. ${q.config.maxSizeKB} KB`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
