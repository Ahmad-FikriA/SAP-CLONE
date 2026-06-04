"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiGet, apiPut, apiDelete, apiUpload } from "@/lib/api";
import { getUser, canDelete } from "@/lib/auth";
import { toast } from "sonner";
import { HseInspeksiSpkTable } from "@/components/hse-inspeksi/HseInspeksiSpkTable";
import { HseInspeksiDetailModal } from "@/components/hse-inspeksi/HseInspeksiDetailModal";
import { HseInspeksiExecutionModal } from "@/components/hse-inspeksi/HseInspeksiExecutionModal";
import { InspeksiScheduleFormDialog } from "@/components/inspeksi/InspeksiScheduleFormDialog";
import {
  fetchInspeksiSchedules,
  deleteInspeksiSchedule,
  fetchInspeksiUsersMap,
} from "@/lib/inspeksi-service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  User,
  Calendar,
  Eye,
  Activity,
  Zap,
  Award,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  ExternalLink,
  ClipboardCheck,
  ClipboardList,
  Loader2,
  AlertOctagon,
  HeartPulse,
  Flame,
  Stethoscope,
  Wrench,
  Trash2,
  Camera,
  MapPin,
  XCircle,
  Plus,
  SwitchCamera,
  Ban,
  Crosshair,
  Cross,
  Timer,
  Accessibility,
  Skull,
  Lightbulb,
  ListChecks,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, getMediaUrl } from "@/lib/utils";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "active", label: "Laporan Aktif", icon: Activity },
  { key: "history", label: "Riwayat", icon: CheckCircle2 },
];

const STATUS_CONFIG = {
  menunggu_review_kadiv_pelapor: {
    label: "Review Pelapor",
    color: "bg-amber-100 text-amber-700",
  },
  menunggu_review_kadiv_pphse: {
    label: "Review Kadiv",
    color: "bg-amber-100 text-amber-700",
  },
  menunggu_validasi_kadiv_pphse: {
    label: "Validasi PPHSE",
    color: "bg-blue-100 text-blue-700",
  },
  menunggu_validasi_kadis_hse: {
    label: "Validasi HSE",
    color: "bg-amber-100 text-amber-700",
  },
  menunggu_tindakan_hse: {
    label: "Tindakan HSE",
    color: "bg-blue-100 text-blue-700",
  },
  menunggu_verifikasi_investigasi: {
    label: "Verifikasi Investigasi",
    color: "bg-indigo-100 text-indigo-700",
  },
  menunggu_validasi_kadiv: {
    label: "Validasi Kadiv",
    color: "bg-purple-100 text-purple-700",
  },
  menunggu_validasi_hasil_kadis_hse: {
    label: "Validasi Hasil",
    color: "bg-indigo-100 text-indigo-700",
  },
  menunggu_validasi_akhir_kadiv_pphse: {
    label: "Verifikasi Akhir",
    color: "bg-purple-100 text-purple-700",
  },
  selesai: { label: "Selesai", color: "bg-emerald-100 text-emerald-700" },
  disetujui: { label: "Disetujui", color: "bg-emerald-100 text-emerald-700" },
  ditolak: { label: "Ditolak", color: "bg-rose-100 text-rose-700" },
  ditolak_kadiv_pphse: {
    label: "Ditolak Kadiv",
    color: "bg-rose-100 text-rose-700",
  },
  ditolak_kadis_hse: {
    label: "Ditolak HSE",
    color: "bg-rose-100 text-rose-700",
  },
  investigasi_ditolak_kadis_hse: {
    label: "Investigasi Ditolak",
    color: "bg-rose-100 text-rose-700",
  },
  investigasi_ditolak_kadiv: {
    label: "Investigasi Ditolak",
    color: "bg-rose-100 text-rose-700",
  },
  perbaikan_ditolak_pphse: {
    label: "Perbaikan Ditolak",
    color: "bg-rose-100 text-rose-700",
  },
};

function formatStatus(status) {
  if (!status) return { label: "-", color: "bg-slate-100 text-slate-600" };
  const config = STATUS_CONFIG[status];
  if (config) return config;

  // Fallback formatting
  const label = status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace("Hse", "HSE")
    .replace("Pphse", "PPHSE");

  return { label, color: "bg-slate-100 text-slate-600" };
}

function getMetricClassification(id, valueNum) {
  const key = id.toLowerCase();
  if (key === "nmrr") {
    if (valueNum >= 2)
      return { label: "Baik", color: "bg-emerald-100 text-emerald-700" };
    if (valueNum >= 1)
      return { label: "Cukup", color: "bg-amber-100 text-amber-700" };
    return { label: "Kurang", color: "bg-rose-100 text-rose-700" };
  }
  if (key === "sor") {
    if (valueNum >= 5)
      return { label: "Baik Sekali", color: "bg-indigo-100 text-indigo-700" };
    if (valueNum >= 4)
      return { label: "Baik", color: "bg-emerald-100 text-emerald-700" };
    if (valueNum >= 3)
      return { label: "Cukup", color: "bg-amber-100 text-amber-700" };
    if (valueNum >= 2)
      return { label: "Kurang", color: "bg-orange-100 text-orange-700" };
    return { label: "Buruk", color: "bg-rose-100 text-rose-700" };
  }
  if (key === "cacr") {
    if (valueNum >= 90)
      return { label: "Baik Sekali", color: "bg-indigo-100 text-indigo-700" };
    if (valueNum >= 70)
      return { label: "Baik", color: "bg-emerald-100 text-emerald-700" };
    if (valueNum >= 50)
      return { label: "Cukup", color: "bg-amber-100 text-amber-700" };
    if (valueNum >= 30)
      return { label: "Kurang", color: "bg-orange-100 text-orange-700" };
    return { label: "Buruk", color: "bg-rose-100 text-rose-700" };
  }
  if (key === "trir") {
    if (valueNum <= 4.0)
      return { label: "Baik Sekali", color: "bg-indigo-100 text-indigo-700" };
    if (valueNum <= 8.0)
      return { label: "Baik", color: "bg-emerald-100 text-emerald-700" };
    if (valueNum <= 12.0)
      return { label: "Cukup", color: "bg-amber-100 text-amber-700" };
    if (valueNum <= 16.0)
      return { label: "Kurang", color: "bg-orange-100 text-orange-700" };
    return { label: "Buruk", color: "bg-rose-100 text-rose-700" };
  }
  if (key === "ltifr") {
    if (valueNum <= 1.0)
      return { label: "Baik Sekali", color: "bg-indigo-100 text-indigo-700" };
    if (valueNum <= 2.0)
      return { label: "Baik", color: "bg-emerald-100 text-emerald-700" };
    if (valueNum <= 3.0)
      return { label: "Cukup", color: "bg-amber-100 text-amber-700" };
    if (valueNum <= 4.0)
      return { label: "Kurang", color: "bg-orange-100 text-orange-700" };
    return { label: "Buruk", color: "bg-rose-100 text-rose-700" };
  }
  return null;
}

const BANNER_SLIDES = [
  {
    id: 1,
    url: "https://picsum.photos/seed/k3safety1/800/600",
    title: "Safety Briefing Harian",
    subtitle: "Komitmen keselamatan dimulai dari awal hari kerja",
  },
  {
    id: 2,
    url: "https://picsum.photos/seed/k3safety2/800/600",
    title: "Inspeksi Alat Pelindung Diri",
    subtitle: "Pemeriksaan kelengkapan APD sebelum bekerja",
  },
  {
    id: 3,
    url: "https://picsum.photos/seed/k3safety3/800/600",
    title: "Pelatihan Tanggap Darurat",
    subtitle: "Simulasi evakuasi dan penanganan keadaan darurat",
  },
  {
    id: 4,
    url: "https://picsum.photos/seed/k3safety4/800/600",
    title: "Audit Keselamatan Kerja",
    subtitle: "Evaluasi berkala sistem manajemen K3",
  },
  {
    id: 5,
    url: "https://picsum.photos/seed/k3safety5/800/600",
    title: "Zero Accident Achievement",
    subtitle: "Target nihil kecelakaan kerja tercapai",
  },
];

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function HseDashboardPage() {
  const [tab, setTab] = useState("dashboard");
  const [bannerSlide, setBannerSlide] = useState(0);
  
  // ── States for Inspeksi K3 ──
  const [k3Schedules,      setK3Schedules]      = useState([]);
  const [k3Loading,        setK3Loading]        = useState(false);
  const [k3DetailOpen,     setK3DetailOpen]     = useState(false);
  const [k3DetailSchedule, setK3DetailSchedule] = useState(null);
  const [k3ExecutionOpen,  setK3ExecutionOpen]  = useState(false);
  const [k3ExecSchedule,   setExecSchedule]     = useState(null);
  const [k3CreateOpen,     setK3CreateOpen]     = useState(false);
  const [k3UsersMap,       setK3UsersMap]       = useState({});
  const [k3PicFilter,      setK3PicFilter]      = useState('all');
  const [k3SearchQuery,    setK3SearchQuery]    = useState('');
  const [k3StatusFilter,   setK3StatusFilter]   = useState('semua');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [k3Settings, setK3Settings] = useState(null);

  const activeSlides = useMemo(() => {
    if (k3Settings?.bannerSlides) {
      try {
        const parsed = typeof k3Settings.bannerSlides === 'string'
          ? JSON.parse(k3Settings.bannerSlides)
          : k3Settings.bannerSlides;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing bannerSlides", e);
      }
    }
    return BANNER_SLIDES;
  }, [k3Settings]);

  const bannerTitle1 = k3Settings?.bannerTitle1 || "Zero Accident Strategy";
  const bannerTitle2 = k3Settings?.bannerTitle2 || "Safety First, Always.";
  const displayDescription = k3Settings?.bannerDescription || "Data kinerja keselamatan kerja yang diagregasi berdasarkan standar formulasi pelaporan insiden internasional.";

  const [selectedReport, setSelectedReport] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationAction, setValidationAction] = useState(null);
  const [staffList, setStaffList] = useState([]);

  const [jenisTindakan, setJenisTindakan] = useState("perbaikan_langsung");
  const [assignedTo, setAssignedTo] = useState("");
  const [catatanValidasi, setCatatanValidasi] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Report States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createData, setCreateData] = useState({
    kategori: "",
    deskripsi: "",
    lokasiTemuan: "",
  });
  const [createPhotos, setCreatePhotos] = useState([]);       // Array of { file, preview }
  const MAX_PHOTOS = 3;
  const MAX_SIZE_KB = 500;

  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");

  const currentUser = useMemo(() => getUser(), []);
  const role = useMemo(() => (currentUser?.role || "").toLowerCase(), [currentUser]);
  const divisi = useMemo(() => (currentUser?.divisi || "").toLowerCase(), [currentUser]);

  const isKadisHse = useMemo(() =>
    (role.includes("kadis") || role.includes("kepala dinas")) &&
    (divisi.includes("pphse") || divisi.includes("hse")), [role, divisi]);
  const isKadivPphse = useMemo(() =>
    (role.includes("kadiv") || role.includes("kepala divisi")) &&
    (divisi.includes("pphse") || divisi.includes("hse")), [role, divisi]);

  const openDetail = (report) => {
    setSelectedReport(report);
    setJenisTindakan("perbaikan_langsung");
    setAssignedTo("");
    setCatatanValidasi("");
    setIsDetailOpen(true);
  };

  const openValidation = (action) => {
    setValidationAction(action);
    setIsValidationOpen(true);
  };

  const submitValidation = async () => {
    if (!selectedReport || !validationAction) return;

    setIsSubmitting(true);
    try {
      if (
        selectedReport.status === "menunggu_validasi_kadis_hse" ||
        selectedReport.status === "menunggu_validasi_kadiv_pphse"
      ) {
        if (validationAction === "approve" && !assignedTo) {
          toast.error("Silakan pilih staf yang ditugaskan");
          setIsSubmitting(false);
          return;
        }
        await apiPut(`/k3-safety/${selectedReport.id}/validasi-awal`, {
          action: validationAction,
          catatanValidasi,
          assignedTo,
          jenisTindakan,
        });
      } else if (
        selectedReport.status === "menunggu_validasi_akhir_kadiv_pphse"
      ) {
        await apiPut(`/k3-safety/${selectedReport.id}/validasi-akhir`, {
          action: validationAction,
          catatan: catatanValidasi,
        });
      } else if (
        selectedReport.status === "menunggu_validasi_hasil_kadis_hse"
      ) {
        await apiPut(`/k3-safety/${selectedReport.id}/validasi-hasil`, {
          action: validationAction,
          catatan: catatanValidasi,
        });
      } else if (selectedReport.status === "menunggu_verifikasi_investigasi") {
        await apiPut(`/k3-safety/${selectedReport.id}/verifikasi-investigasi`, {
          action: validationAction,
          catatan: catatanValidasi,
        });
      } else if (selectedReport.status === "menunggu_validasi_kadiv") {
        await apiPut(
          `/k3-safety/${selectedReport.id}/validasi-investigasi-kadiv`,
          {
            action: validationAction,
            kadivType: "pphse",
            catatan: catatanValidasi,
          },
        );
      }

      toast.success(
        `Laporan berhasil di${validationAction === "approve" ? "setujui" : "tolak"}`,
      );
      setIsValidationOpen(false);
      setIsDetailOpen(false);
      loadReports();
    } catch (e) {
      toast.error(e.message || "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  async function loadReports() {
    setLoading(true);
    try {
      const res = await apiGet("/k3-safety");
      setReports(
        Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [],
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.",
      )
    )
      return;

    setIsSubmitting(true);
    try {
      await apiDelete(`/k3-safety/${id}`);
      toast.success("Laporan berhasil dihapus");
      if (selectedReport?.id === id) setIsDetailOpen(false);
      loadReports();
    } catch (e) {
      toast.error(e.message || "Gagal menghapus laporan");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBulkDelete() {
    if (
      !window.confirm(
        "PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA laporan K3 Safety? Tindakan ini akan menghapus seluruh data secara permanen!",
      )
    )
      return;

    setIsSubmitting(true);
    try {
      await apiDelete("/k3-safety");
      toast.success("Semua laporan berhasil dihapus");
      loadReports();
    } catch (e) {
      toast.error(e.message || "Gagal menghapus semua laporan");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadStaff() {
    try {
      const res = await apiGet("/users");
      const usersArray = Array.isArray(res)
        ? res
        : res?.data && Array.isArray(res.data)
          ? res.data
          : [];
      const hseStaff = usersArray.filter(
        (u) =>
          u.dinas?.toLowerCase().includes("hse") &&
          !u.role?.toLowerCase().includes("kadis") &&
          !u.role?.toLowerCase().includes("kadiv"),
      );
      setStaffList(hseStaff);
    } catch (e) {
      console.error(e);
    }
  }

  // ── dynamicTabs ──
  const userDinasVal = useMemo(() => currentUser?.dinas?.toLowerCase() || '', [currentUser]);
  const isHseMemberVal = useMemo(() => (userDinasVal === 'hse' || userDinasVal.includes('hse')) && !userDinasVal.includes('pphse'), [userDinasVal]);
  const isKadivVal = useMemo(() => currentUser?.role === 'kadiv', [currentUser]);
  const isAdminVal = useMemo(() => currentUser?.role === 'admin', [currentUser]);
  const showInspeksiTab = useMemo(() => isAdminVal || isKadivVal || isHseMemberVal, [isAdminVal, isKadivVal, isHseMemberVal]);

  const dynamicTabs = useMemo(() => {
    return [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "active", label: "Laporan Aktif", icon: Activity },
      { key: "history", label: "Riwayat", icon: CheckCircle2 },
      ...(showInspeksiTab ? [{ key: "inspeksi-k3", label: "Inspeksi K3", icon: ClipboardList }] : []),
    ];
  }, [showInspeksiTab]);

  // ── Inspeksi K3 helper functions ──
  const loadK3Schedules = useCallback(async () => {
    setK3Loading(true);
    try {
      const params = {
        type: 'k3',
      };
      if (isHseMemberVal && !isKadivVal && !isAdminVal) {
        params.assignedTo = currentUser?.nik;
      } else if (k3PicFilter && k3PicFilter !== 'all') {
        params.assignedTo = k3PicFilter;
      }

      const [data, uMap] = await Promise.all([
        fetchInspeksiSchedules(params),
        fetchInspeksiUsersMap(),
      ]);
      setK3Schedules(Array.isArray(data) ? data : []);
      setK3UsersMap(uMap);
    } catch (e) {
      toast.error('Gagal memuat jadwal inspeksi K3: ' + e.message);
    } finally {
      setK3Loading(false);
    }
  }, [k3PicFilter, currentUser?.nik, isHseMemberVal, isKadivVal, isAdminVal]);

  // ── Memoized K3 calculations ──
  const k3Stats = useMemo(() => {
    return {
      total: k3Schedules.length,
      scheduled: k3Schedules.filter(s => s.status === 'scheduled').length,
      inProgress: k3Schedules.filter(s => s.status === 'in_progress').length,
      completed: k3Schedules.filter(s => s.status === 'completed').length,
    };
  }, [k3Schedules]);

  const filteredK3Schedules = useMemo(() => {
    return k3Schedules.filter(s => {
      if (k3StatusFilter !== 'semua' && s.status !== k3StatusFilter) return false;
      if (k3SearchQuery) {
        const q = k3SearchQuery.toLowerCase();
        const picName = k3UsersMap[String(s.assignedTo)] || s.assignedTo || '';
        return (
          s.title?.toLowerCase().includes(q) ||
          s.nomorPoJo?.toLowerCase().includes(q) ||
          s.location?.toLowerCase().includes(q) ||
          picName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [k3Schedules, k3StatusFilter, k3SearchQuery, k3UsersMap]);

  const openK3Detail = (schedule) => {
    setK3DetailSchedule(schedule);
    setK3DetailOpen(true);
  };

  const openK3Execution = (schedule) => {
    setExecSchedule(schedule);
    setK3ExecutionOpen(true);
  };

  const handleK3Delete = async (schedule) => {
    if (!isAdminVal) {
      toast.error("Hanya administrator yang dapat menghapus jadwal inspeksi.");
      return;
    }

    try {
      await deleteInspeksiSchedule(schedule.id);
      toast.success(`Jadwal "${schedule.title}" berhasil dihapus.`);
      setK3Schedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (e) {
      toast.error(`Gagal menghapus jadwal (ID: ${schedule?.id}): ` + e.message);
    }
  };

  useEffect(() => {
    if (tab === "inspeksi-k3") {
      loadK3Schedules();
    }
  }, [tab, loadK3Schedules]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab");
      if (urlTab) {
        setTab(urlTab);
      }
    }
  }, []);

  useEffect(() => {
    loadReports();
    loadStaff();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // --- Image compression utility ---
  const compressImage = (file, maxSizeKB = 500) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if very large
        const MAX_DIM = 1920;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Try decreasing quality until under maxSizeKB
        const tryCompress = (quality) => {
          canvas.toBlob(
            (blob) => {
              if (blob.size > maxSizeKB * 1024 && quality > 0.1) {
                tryCompress(quality - 0.1);
              } else {
                const compressed = new File([blob], file.name, { type: "image/jpeg" });
                resolve(compressed);
              }
            },
            "image/jpeg",
            quality,
          );
        };

        // If already small enough, resolve immediately
        if (file.size <= maxSizeKB * 1024) {
          canvas.toBlob(
            (blob) => resolve(new File([blob], file.name, { type: "image/jpeg" })),
            "image/jpeg",
            0.92,
          );
        } else {
          tryCompress(0.8);
        }
      };
      img.src = url;
    });
  };

  // --- Create Report Handlers ---
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - createPhotos.length;
    if (remaining <= 0) {
      toast.error(`Maksimal ${MAX_PHOTOS} foto`);
      return;
    }

    const toProcess = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.info(`Hanya ${remaining} foto lagi yang bisa ditambahkan`);
    }

    for (const file of toProcess) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} bukan file gambar`);
        continue;
      }
      const compressed = await compressImage(file, MAX_SIZE_KB);
      const preview = URL.createObjectURL(compressed);
      setCreatePhotos((prev) => [...prev, { file: compressed, preview }]);
    }
  };

  const openCamera = async () => {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
      });
      setStream(mediaStream);
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        toast.error(
          "Kamera diblokir! Silakan klik ikon gembok (🔒) di kiri atas (sebelah link web) dan izinkan akses kamera, lalu coba lagi.",
          { duration: 6000 },
        );
      } else {
        toast.error("Gagal mengakses kamera: " + err.message);
      }
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    openCamera();
  };

  const closeCamera = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    setIsCameraOpen(false);
  };

  const takePhoto = async () => {
    if (!videoRef.current) return;
    if (createPhotos.length >= MAX_PHOTOS) {
      toast.error(`Maksimal ${MAX_PHOTOS} foto`);
      closeCamera();
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");

    // Gambar foto dari video
    ctx.drawImage(videoRef.current, 0, 0);

    // Persiapan Watermark
    const dateStr = new Date().toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const userName = currentUser?.name || currentUser?.nik || "User";
    const watermarkLines = [
      `MANTIS PPHSE - PT KTI`,
      `Oleh: ${userName}`,
      `Waktu: ${dateStr}`,
    ];

    // Ukuran font proporsional dengan tinggi gambar
    const fontSize = Math.max(14, Math.floor(canvas.height * 0.025));
    ctx.font = `bold ${fontSize}px sans-serif`;

    const padding = fontSize * 0.6;
    const lineHeight = fontSize * 1.4;

    // Cari text yang paling panjang untuk kotak background
    let maxTextWidth = 0;
    watermarkLines.forEach((line) => {
      const w = ctx.measureText(line).width;
      if (w > maxTextWidth) maxTextWidth = w;
    });

    const boxWidth = maxTextWidth + padding * 2;
    const boxHeight = watermarkLines.length * lineHeight + padding;

    // Posisi di pojok kiri bawah
    const x = Math.max(10, canvas.width * 0.02);
    const y = canvas.height - boxHeight - Math.max(10, canvas.height * 0.02);

    // Gambar background watermark (hitam transparan)
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.roundRect
      ? ctx.roundRect(x, y, boxWidth, boxHeight, 8)
      : ctx.fillRect(x, y, boxWidth, boxHeight);
    if (ctx.roundRect) ctx.fill();

    // Gambar text warna putih
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "top";
    watermarkLines.forEach((line, index) => {
      ctx.fillText(line, x + padding, y + padding + index * lineHeight);
    });

    // Convert canvas to blob, then compress
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    const rawFile = new File([blob], `camera_${Date.now()}.jpg`, { type: "image/jpeg" });
    const compressed = await compressImage(rawFile, MAX_SIZE_KB);
    const preview = URL.createObjectURL(compressed);
    setCreatePhotos((prev) => [...prev, { file: compressed, preview }]);
    closeCamera();
  };

  const removePhoto = (index) => {
    setCreatePhotos((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  const submitCreate = async () => {
    if (!createData.kategori || !createData.deskripsi) {
      toast.error("Kategori dan Deskripsi wajib diisi");
      return;
    }
    if (createPhotos.length === 0) {
      toast.error("Minimal 1 foto bukti wajib dilampirkan");
      return;
    }
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("kategori", createData.kategori);
      fd.append("deskripsi", createData.deskripsi);
      if (createData.lokasiTemuan)
        fd.append("lokasiTemuan", createData.lokasiTemuan);
      createPhotos.forEach((p) => fd.append("foto", p.file));

      await apiUpload("/k3-safety", fd);
      toast.success("Laporan K3 berhasil dikirim");
      setIsCreateOpen(false);
      setCreateData({ kategori: "", deskripsi: "", lokasiTemuan: "" });
      setCreatePhotos([]);
      loadData();
    } catch (e) {
      toast.error(e.message || "Gagal membuat laporan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsRes, settingsRes] = await Promise.all([
        apiGet("/k3-safety"),
        apiGet("/k3-settings").catch(() => null)
      ]);
      setReports(reportsRes.data || []);
      if (settingsRes?.data) {
        setK3Settings(settingsRes.data);
      }
    } catch (e) {
      toast.error(e.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
    loadStaff();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Banner auto-slide ──
  useEffect(() => {
    if (tab !== "dashboard" || activeSlides.length === 0) return;
    const timer = setInterval(() => {
      setBannerSlide((prev) => (prev + 1) % activeSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [tab, activeSlides]);

  // ── Konfigurasi Safety Performance Standard KS Group ──────────────────────
  const TOTAL_KARYAWAN = k3Settings?.totalKaryawan || 280;
  const JAM_KERJA_PER_BULAN = (k3Settings?.jamKerjaPerHari || 8) * (k3Settings?.hariKerjaPerBulan || 20);
  const KONSTANTA_OSHA = k3Settings?.konstantaOsha || 200_000;
  const TOTAL_JAM_KERJA = TOTAL_KARYAWAN * JAM_KERJA_PER_BULAN * 12;

  // ── Data dasar ───────────────────────────────────────────────────────────────
  const approvedReports = reports.filter(
    (r) => r.status === "selesai" || r.status === "disetujui",
  );

  // 1. NMRR = (Jumlah kejadian Near Miss / Total Karyawan) × 100
  const nearMissCount = approvedReports.filter(
    (r) => r.kategori === "Near Miss",
  ).length;
  const nmrrNum = (nearMissCount / TOTAL_KARYAWAN) * 100;
  const nmrrValue = nmrrNum.toFixed(1) + "%";

  // 2. SOR = (Jumlah total observasi / Total Karyawan) × 100
  const observationCount = approvedReports.filter(
    (r) =>
      r.kategori === "Kondisi Tidak Aman" ||
      r.kategori === "Tindakan Tidak Aman",
  ).length;
  const sorNum = (observationCount / TOTAL_KARYAWAN) * 100;
  const sorValue = sorNum.toFixed(1) + "%";

  // 3. CACR = (Jumlah tindakan korektif ditutup / Total temuan NMRR+SOR) × 100%
  const totalTemuanNmrrSor = nearMissCount + observationCount;
  const solvedTemuanCount = approvedReports.filter(
    (r) =>
      (r.status === "selesai" || r.status === "disetujui") &&
      (r.kategori === "Near Miss" ||
        r.kategori === "Kondisi Tidak Aman" ||
        r.kategori === "Tindakan Tidak Aman"),
  ).length;
  const cacrNum =
    totalTemuanNmrrSor > 0
      ? (solvedTemuanCount / totalTemuanNmrrSor) * 100
      : 0;
  const cacrValue = cacrNum.toFixed(1) + "%";

  // 4. TRIR = (Jumlah insiden tercatat / Total Jam Kerja) × Konstanta × 1/12
  const recordableCategories = [
    "First Aid Case",
    "Medical Treatment",
    "Lost Time Injury",
    "Permanent Disability",
    "Fatality",
  ];
  const trirCount = approvedReports.filter((r) =>
    recordableCategories.includes(r.kategori),
  ).length;
  const trirNum =
    TOTAL_JAM_KERJA > 0
      ? (trirCount / TOTAL_JAM_KERJA) * KONSTANTA_OSHA * (1 / 12)
      : 0;
  const trirValue = trirNum.toFixed(2);

  // 5. LTIFR = (Jumlah LTI tercatat / Total Jam Kerja) × Konstanta × 1/12
  const ltiCount = approvedReports.filter(
    (r) => r.kategori === "Lost Time Injury",
  ).length;
  const ltifrNum =
    TOTAL_JAM_KERJA > 0
      ? (ltiCount / TOTAL_JAM_KERJA) * KONSTANTA_OSHA * (1 / 12)
      : 0;
  const ltifrValue = ltifrNum.toFixed(2);

  // 6. Fatality Rate = Manual input dari Admin K3 (jumlahFatality di settings)
  const fatalityCount = k3Settings?.jumlahFatality || 0;
  const fatalityExists = fatalityCount > 0;
  const fatalityValue = fatalityExists ? `${fatalityCount} (Ada)` : "Tidak Ada";

  const dynamicMetrics = [
    {
      id: "nmrr",
      title: "NMRR",
      subtitle: "Near Miss Reporting Rate",
      value: nmrrValue,
      classObj: getMetricClassification("nmrr", nmrrNum),
      icon: AlertTriangle,
      color: "bg-blue-500",
      light: "bg-blue-50",
      text: "text-blue-600",
    },
    {
      id: "sor",
      title: "SOR",
      subtitle: "Safety Observation Rate",
      value: sorValue,
      classObj: getMetricClassification("sor", sorNum),
      icon: Eye,
      color: "bg-emerald-500",
      light: "bg-emerald-50",
      text: "text-emerald-600",
    },
    {
      id: "cacr",
      title: "CACR",
      subtitle: "Corrective Action Closure",
      value: cacrValue,
      classObj: getMetricClassification("cacr", cacrNum),
      icon: ClipboardCheck,
      color: "bg-violet-500",
      light: "bg-violet-50",
      text: "text-violet-600",
    },
    {
      id: "trir",
      title: "TRIR",
      subtitle: "Total Recordable Incident Rate",
      value: trirValue,
      classObj: getMetricClassification("trir", trirNum),
      icon: HeartPulse,
      color: "bg-amber-500",
      light: "bg-amber-50",
      text: "text-amber-600",
    },
    {
      id: "ltifr",
      title: "LTIFR",
      subtitle: "Loss Time Injury Frequency",
      value: ltifrValue,
      classObj: getMetricClassification("ltifr", ltifrNum),
      icon: Stethoscope,
      color: "bg-indigo-500",
      light: "bg-indigo-50",
      text: "text-indigo-600",
    },
    {
      id: "fatality",
      title: "Fatality Rate",
      subtitle: "Kematian Akibat Kerja",
      value: fatalityValue,
      classObj: fatalityExists
        ? { label: "Bahaya", color: "bg-rose-100 text-rose-700" }
        : { label: "Aman", color: "bg-emerald-100 text-emerald-700" },
      icon: AlertOctagon,
      color: "bg-rose-500",
      light: "bg-rose-50",
      text: "text-rose-600",
    },
  ];

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.reportNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.kategori?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase());

    if (tab === "active")
      return (
        matchesSearch && r.status !== "selesai" && !r.status.includes("ditolak")
      );
    if (tab === "history")
      return (
        matchesSearch &&
        (r.status === "selesai" || r.status.includes("ditolak"))
      );
    return matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-8">
      {/* Header Area */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3 mb-1">
              <div className="p-1.5 sm:p-2 bg-rose-600 rounded-lg sm:rounded-xl shadow-lg shadow-rose-200">
                <ShieldCheck size={18} className="text-white sm:w-5 sm:h-5" />
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
                HSE Command Center
              </h2>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm ml-9 sm:ml-12 hidden sm:block">
              Monitoring kinerja K3 dan manajemen insiden secara real-time.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadReports}
            disabled={loading}
            className="bg-white shadow-sm rounded-lg sm:hidden flex-shrink-0"
          >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
          <Button
            variant="outline"
            onClick={loadReports}
            disabled={loading}
            className="bg-white shadow-sm hidden sm:flex"
          >
            <RefreshCw
              size={16}
              className={cn("mr-2", loading && "animate-spin")}
            />
            Segarkan
          </Button>
          {canDelete("hse") && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={loading || isSubmitting || reports.length === 0}
              className="shadow-md shadow-rose-100 text-xs sm:text-sm"
            >
              <Trash2 size={14} className="mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Hapus Semua</span>
              <span className="sm:hidden">Hapus</span>
            </Button>
          )}
          <Button
            size="sm"
            className="bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-100 text-xs sm:text-sm ml-auto"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={14} className="mr-1.5 sm:mr-2" />
            <span className="hidden sm:inline">Buat Laporan</span>
            <span className="sm:hidden">Lapor</span>
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl sm:rounded-2xl w-full sm:w-fit overflow-x-auto">
        {dynamicTabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all rounded-lg sm:rounded-xl whitespace-nowrap",
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Icon
                size={14}
                className={cn("sm:w-4 sm:h-4", isActive ? "text-rose-600" : "text-slate-400")}
              />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Performance Banner */}
          <div className="relative overflow-hidden bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 text-white shadow-2xl">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center">
              <div>
                <Badge className="mb-3 sm:mb-4 bg-rose-500/20 text-rose-300 border-none px-2.5 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold">
                  HSE Performance
                </Badge>
                <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold mb-3 sm:mb-4 tracking-tight leading-tight">
                  {bannerTitle1}
                  {bannerTitle2 && (
                    <>
                      <br />
                      <span className="text-rose-500">{bannerTitle2}</span>
                    </>
                  )}
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm md:text-base max-w-md leading-relaxed mb-5 sm:mb-8">
                  {displayDescription}
                </p>
                <div className="flex gap-5 sm:gap-6">
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-white">
                      {k3Settings?.jamKerjaTanpaKecelakaan?.toLocaleString() || 0}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Jam Kerja Tanpa Kecelakaan
                    </p>
                  </div>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="relative w-full max-w-sm ml-auto">
                  {/* Glow effect */}
                  <div className="absolute -inset-3 bg-gradient-to-br from-rose-500/20 via-transparent to-indigo-500/10 rounded-3xl blur-2xl" />

                  {/* Carousel */}
                  <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl aspect-[4/3] group cursor-pointer">
                    {activeSlides.map((slide, idx) => (
                      <div
                        key={slide.id || idx}
                        className={cn(
                          "absolute inset-0 transition-all duration-700 ease-in-out",
                          idx === bannerSlide
                            ? "opacity-100 scale-100"
                            : "opacity-0 scale-105"
                        )}
                      >
                        <img
                          src={getMediaUrl(slide.path || slide.url)}
                          alt={slide.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/20" />
                      </div>
                    ))}

                    {/* Caption */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-4 bg-rose-500 rounded-full flex-shrink-0" />
                        <p className="text-white font-bold text-sm leading-snug line-clamp-1">
                          {activeSlides[bannerSlide]?.title}
                        </p>
                      </div>
                      <p className="text-white/50 text-[11px] ml-3 leading-relaxed line-clamp-1">
                        {activeSlides[bannerSlide]?.subtitle}
                      </p>
                    </div>

                    {/* Arrows */}
                    <button
                      onClick={() =>
                        setBannerSlide(
                          (p) =>
                            (p - 1 + activeSlides.length) %
                            activeSlides.length
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white/80 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/20 hover:text-white z-20"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() =>
                        setBannerSlide(
                          (p) => (p + 1) % activeSlides.length
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white/80 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/20 hover:text-white z-20"
                    >
                      <ChevronRight size={14} />
                    </button>

                    {/* Dot indicators */}
                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                      {activeSlides.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setBannerSlide(idx)}
                          className={cn(
                            "rounded-full transition-all duration-300",
                            idx === bannerSlide
                              ? "w-5 h-1.5 bg-rose-500"
                              : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Slide counter */}
                  <div className="flex justify-between items-center mt-3">
                    <p className="text-[10px] text-white/30 font-semibold tracking-widest uppercase">
                      Galeri K3
                    </p>
                    <p className="text-[10px] text-white/40 font-mono">
                      {String(bannerSlide + 1).padStart(2, "0")} /{" "}
                      {String(activeSlides.length).padStart(2, "0")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 blur-[100px] -mr-48 -mt-48 rounded-full" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[100px] -ml-32 -mb-32 rounded-full" />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {dynamicMetrics.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.id}
                  className="group bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-3 sm:mb-6">
                    <div
                      className={cn(
                        "p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-colors",
                        m.light,
                      )}
                    >
                      <Icon size={18} className={cn("sm:w-6 sm:h-6", m.text)} />
                    </div>
                    <div className="flex flex-col items-end gap-1 sm:gap-2">
                      <p
                        className={cn(
                          "text-[10px] sm:text-xs font-bold uppercase tracking-widest",
                          m.text,
                        )}
                      >
                        {m.id}
                      </p>
                      {m.classObj && (
                        <Badge
                          className={cn(
                            "border-none px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-bold uppercase",
                            m.classObj.color,
                          )}
                        >
                          {m.classObj.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xl sm:text-3xl font-black text-slate-900 mb-0.5 sm:mb-1">
                      {m.value}
                    </p>
                    <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">
                      {m.subtitle}
                    </p>
                  </div>
                  <div className="mt-4 sm:mt-6 pt-3 sm:pt-6 border-t border-slate-50 hidden sm:flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <TrendingUp size={10} className="text-emerald-500" />{" "}
                      +2.4% vs last month
                    </span>
                    <button className="text-slate-400 hover:text-rose-600 transition-colors">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(tab === "active" || tab === "history") && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <Input
                placeholder="Cari laporan..."
                className="pl-9 sm:pl-10 h-10 sm:h-11 rounded-lg sm:rounded-xl border-slate-200 bg-slate-50/50 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="rounded-lg sm:rounded-xl h-10 sm:h-11 px-3 sm:px-4 flex-1 sm:flex-initial text-xs sm:text-sm">
                <Filter size={14} className="mr-1.5 sm:mr-2" /> Filter
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg sm:rounded-xl h-10 sm:h-11 px-3 sm:px-4 flex-1 sm:flex-initial text-xs sm:text-sm">
                <Calendar size={14} className="mr-1.5 sm:mr-2" /> <span className="hidden sm:inline">Semua </span>Waktu
              </Button>
            </div>
          </div>

          {/* Reports Grid */}
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <RefreshCw className="animate-spin text-rose-600" size={32} />
              <p className="text-slate-500 font-medium">
                Memuat data laporan...
              </p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-white py-20 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <FileText size={40} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Tidak Ada Data
              </h3>
              <p className="text-slate-500 max-w-sm text-sm">
                Belum ada data laporan K3 yang ditemukan untuk kriteria ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {filteredReports.map((report) => {
                const status = formatStatus(report.status);
                const hasPhotos = report.foto && report.foto.length > 0;

                return (
                  <div
                    key={report.id}
                    className="group bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-rose-100 transition-all duration-300 flex flex-col"
                  >
                    <div className="p-4 sm:p-6 space-y-3 sm:space-y-5 flex-1">
                      {/* Header Card */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                          <p className="text-[9px] sm:text-[10px] font-black text-rose-600 uppercase tracking-[0.15em] sm:tracking-[0.2em] truncate">
                            {report.kategori || "K3 INCIDENT"}
                          </p>
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
                            {report.reportNumber}
                            <ExternalLink
                              size={11}
                              className="text-slate-300 group-hover:text-rose-500 transition-colors flex-shrink-0"
                            />
                          </h3>
                        </div>
                        <Badge
                          className={cn(
                            "border-none px-2 sm:px-3 py-0.5 sm:py-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider rounded-md sm:rounded-lg flex-shrink-0",
                            status.color,
                          )}
                        >
                          {status.label}
                        </Badge>
                      </div>

                      {/* Content */}
                      <div className="flex gap-3 sm:gap-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-100 group-hover:border-rose-100 transition-colors">
                          {hasPhotos ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL}/${report.foto[0]}`}
                              alt="K3 Report"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileText size={20} className="text-slate-300 sm:w-6 sm:h-6" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed italic">
                            "{report.deskripsi || "Tidak ada deskripsi"}"
                          </p>
                          <div className="mt-2 sm:mt-3 flex flex-wrap gap-y-1.5 gap-x-3 sm:gap-x-4 items-center">
                            <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-slate-400 font-medium">
                              <User size={11} className="text-slate-300" />
                              <span className="truncate max-w-[100px] sm:max-w-none">{report.pelapor?.name || "Unknown"}</span>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-slate-400 font-medium">
                              <Calendar size={11} className="text-slate-300" />
                              {report.createdAt
                                ? new Date(report.createdAt).toLocaleDateString(
                                    "id-ID",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )
                                : "-"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Task Info */}
                      {report.petugasHse && (
                        <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50 flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                            <Wrench size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                              Ditugaskan
                            </p>
                            <p className="text-xs font-bold text-slate-700 truncate">
                              {report.petugasHse.name}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Card */}
                    <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center group-hover:bg-rose-50/20 transition-colors">
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                        <span className="hidden sm:inline">Terakhir Update: </span>
                        <span className="sm:hidden">Update: </span>
                        {report.updatedAt
                          ? new Date(report.updatedAt).toLocaleTimeString(
                              "id-ID",
                              { hour: "2-digit", minute: "2-digit" },
                            )
                          : "-"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(report)}
                        className="h-7 sm:h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-[11px] sm:text-xs gap-1.5 sm:gap-2 px-2 sm:px-3"
                      >
                        <span className="hidden sm:inline">Detail Laporan</span>
                        <span className="sm:hidden">Detail</span>
                        <ChevronRight size={13} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "inspeksi-k3" && showInspeksiTab && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* 1. Summary Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total SPK K3", value: k3Stats.total, icon: ClipboardList, color: "border-slate-100 text-slate-700 bg-gradient-to-br from-slate-50 to-slate-100/50" },
              { label: "Terjadwal", value: k3Stats.scheduled, icon: Clock, color: "border-amber-100 text-amber-700 bg-gradient-to-br from-amber-50 to-amber-100/30" },
              { label: "Sedang Berjalan", value: k3Stats.inProgress, icon: Activity, color: "border-blue-100 text-blue-700 bg-gradient-to-br from-blue-50 to-blue-100/30" },
              { label: "Selesai", value: k3Stats.completed, icon: CheckCircle2, color: "border-emerald-100 text-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100/30" }
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className={cn("p-4 sm:p-5 rounded-2xl border bg-white shadow-sm flex items-center gap-4 transition-all duration-300 hover:shadow-md", stat.color)}>
                  <div className="p-2.5 sm:p-3 rounded-xl bg-white shadow-sm shrink-0">
                    <Icon size={20} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider opacity-85">{stat.label}</p>
                    <p className="text-xl sm:text-2xl font-black mt-0.5">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Custom Filter Controls & Search */}
          <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between bg-white p-5 rounded-2xl border border-slate-100 shadow-md shadow-slate-100/40">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                placeholder="Cari objek, nomor SPK, lokasi, PIC..."
                value={k3SearchQuery}
                onChange={(e) => setK3SearchQuery(e.target.value)}
                className="pl-11 h-11 rounded-xl border-slate-200 bg-slate-50/50 text-sm focus-visible:ring-rose-500/20 focus-visible:border-rose-500"
              />
            </div>

            {/* Custom Segmented Buttons for Status */}
            <div className="flex flex-wrap gap-1 items-center bg-slate-50 border border-slate-100 p-1.5 rounded-xl w-full xl:w-auto">
              {[
                { key: 'semua', label: 'Semua Status' },
                { key: 'scheduled', label: 'Terjadwal' },
                { key: 'in_progress', label: 'Berjalan' },
                { key: 'completed', label: 'Selesai' },
              ].map(btn => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => setK3StatusFilter(btn.key)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex-1 xl:flex-initial text-center",
                    k3StatusFilter === btn.key 
                      ? "bg-rose-600 text-white shadow-md shadow-rose-100" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                  )}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Penanggung Jawab & Action widgets */}
            <div className="flex items-center gap-2.5 flex-wrap justify-end">
              {(isAdminVal || isKadivVal) && (
                <div className="w-52">
                  <Select value={k3PicFilter} onValueChange={setK3PicFilter}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-700">
                      <SelectValue placeholder="Pilih Penanggung Jawab" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl border-slate-200 max-h-60 overflow-y-auto">
                      <SelectItem value="all" className="text-xs font-semibold">Semua Penanggung Jawab</SelectItem>
                      {staffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.nik || staff.id} className="text-xs font-semibold">
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(isAdminVal || isKadivVal) && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setK3CreateOpen(true)}
                  className="bg-[#0a2540] hover:bg-[#0d3152] text-white h-11 rounded-xl px-5 text-xs font-extrabold shadow-md shadow-slate-100"
                >
                  <Plus size={14} className="mr-1.5 stroke-[3]" /> Buat SPK K3
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={loadK3Schedules}
                disabled={k3Loading}
                className="h-11 w-11 rounded-xl border-slate-200 bg-white hover:bg-slate-50"
              >
                <RefreshCw size={14} className={cn(k3Loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* 3. Schedules Cards Grid */}
          {k3Loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 size={36} className="animate-spin text-rose-600" />
              <p className="text-sm font-bold text-slate-500">Memuat data jadwal inspeksi K3...</p>
            </div>
          ) : filteredK3Schedules.length === 0 ? (
            <div className="bg-white py-24 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-6 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100">
                <ClipboardList size={28} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1.5">Jadwal Tidak Ditemukan</h3>
              <p className="text-slate-500 max-w-sm text-xs leading-relaxed font-medium">
                Belum ada data jadwal inspeksi K3 yang ditemukan untuk filter ini atau ditugaskan kepada Anda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredK3Schedules.map((s) => {
                const isExecutor = (isHseMemberVal && !isKadivVal) || isAdminVal;
                const picName = k3UsersMap[String(s.assignedTo)] || s.assignedTo || '—';
                
                // Color configuration based on status for premium aesthetics
                const statusMeta = s.status === 'completed' 
                  ? { label: 'Selesai', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', strip: 'bg-emerald-500' }
                  : s.status === 'in_progress'
                  ? { label: 'Berjalan', color: 'bg-blue-50 text-blue-700 border-blue-100', strip: 'bg-blue-500' }
                  : s.status === 'cancelled'
                  ? { label: 'Batal', color: 'bg-slate-100 text-slate-500 border-slate-200', strip: 'bg-slate-400' }
                  : { label: 'Terjadwal', color: 'bg-amber-50 text-amber-700 border-amber-100', strip: 'bg-amber-500' };

                return (
                  <div
                    key={s.id}
                    onClick={() => openK3Detail(s)}
                    className="group relative bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-rose-100/80 transition-all duration-300 flex flex-col justify-between cursor-pointer"
                  >
                    {/* Status Color Strip on Top */}
                    <div className={cn("absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl transition-all duration-300 group-hover:h-2", statusMeta.strip)} />

                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="font-mono text-xs font-extrabold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {s.nomorPoJo || `#${s.id}`}
                        </span>
                        <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", statusMeta.color)}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          {statusMeta.label}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="space-y-2">
                        <h4 className="font-extrabold text-slate-800 text-lg leading-snug group-hover:text-rose-600 transition-colors line-clamp-2">
                          {s.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                          <MapPin size={13} className="shrink-0 text-rose-500/80" />
                          <span className="truncate">{s.location || '—'}</span>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal Mulai</p>
                          <div className="flex items-center gap-2 mt-1.5 font-bold text-slate-700">
                            <Calendar size={13} className="text-slate-400 shrink-0" />
                            <span>{s.scheduledDate ? String(s.scheduledDate).slice(0, 10) : '—'}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Penanggung Jawab</p>
                          <div className="flex items-center gap-2 mt-1.5 font-bold text-slate-700">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{picName}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 text-xs font-extrabold text-slate-600 hover:bg-slate-50 hover:text-slate-900 gap-1.5 px-3 rounded-xl border border-slate-100"
                        onClick={() => openK3Detail(s)}
                      >
                        <Eye size={13} className="stroke-[2.5]" /> Detail
                      </Button>

                      {isExecutor && ['scheduled', 'in_progress'].includes(s.status) ? (
                        <Button
                          size="sm"
                          className="h-9 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white gap-1.5 px-4 shadow-md shadow-rose-100 rounded-xl"
                          onClick={() => openK3Execution(s)}
                        >
                          <ClipboardList size={13} className="stroke-[2.5]" /> Laksanakan
                        </Button>
                      ) : s.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100/50">
                          <CheckCircle2 size={13} className="stroke-[2.5]" /> Laporan Terisi
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* ── isolated K3 Inspeksi Popups ── */}
          <HseInspeksiDetailModal
            schedule={k3DetailSchedule}
            open={k3DetailOpen}
            usersMap={k3UsersMap}
            onChanged={() => {
              loadK3Schedules();
            }}
            onExecute={openK3Execution}
            onClose={() => { setK3DetailOpen(false); setK3DetailSchedule(null); }}
          />

          <HseInspeksiExecutionModal
            schedule={k3ExecSchedule}
            open={k3ExecutionOpen}
            onClose={() => { setK3ExecutionOpen(false); setExecSchedule(null); }}
            onSaved={() => {
              loadK3Schedules();
            }}
          />

          <InspeksiScheduleFormDialog
            open={k3CreateOpen}
            onOpenChange={setK3CreateOpen}
            onSaved={loadK3Schedules}
            defaultType="k3"
          />
        </div>
      )}

      {/* Detail & Action Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-t-3xl sm:rounded-3xl">
          {/* Styled Header */}
          <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <ShieldCheck size={16} />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">K3 Safety Report</span>
            </div>
            <DialogHeader className="p-0">
              <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Detail Laporan K3</DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs font-medium text-slate-500">
                {selectedReport?.reportNumber} • Dilaporkan pada{" "}
                {selectedReport?.createdAt
                  ? new Date(selectedReport.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })
                  : "-"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {selectedReport && (
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-4 space-y-4 sm:space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 font-bold flex-shrink-0 text-sm sm:text-base">
                    {selectedReport.pelapor?.name
                      ? selectedReport.pelapor.name.charAt(0).toUpperCase()
                      : "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-xs font-bold text-rose-600 uppercase tracking-widest mb-0.5 sm:mb-1">
                      {selectedReport.kategori}
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {selectedReport.pelapor?.name || "Unknown"}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 uppercase tracking-wider font-medium truncate">
                      {selectedReport.pelapor?.role || "-"} •{" "}
                      {selectedReport.pelapor?.dinas || "-"} •{" "}
                      {selectedReport.pelapor?.divisi || "-"}
                    </p>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "border-none px-2.5 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-xs flex-shrink-0",
                    formatStatus(selectedReport.status).color,
                  )}
                >
                  {formatStatus(selectedReport.status).label}
                </Badge>
              </div>

              {/* Deskripsi */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Deskripsi Laporan
                </h4>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                  <p className="text-sm text-slate-700 leading-relaxed pl-2">
                    "{selectedReport.deskripsi}"
                  </p>
                </div>
              </div>

              {/* Dokumentasi Laporan Awal */}
              {selectedReport.foto && selectedReport.foto.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Foto Temuan Awal
                  </h4>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    {selectedReport.foto.map((f, i) => (
                      <div
                        key={i}
                        className="group relative rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer"
                        onClick={() => setSelectedImage(`${process.env.NEXT_PUBLIC_API_URL}/${f}`)}
                      >
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL}/${f}`}
                          alt={`Foto Awal ${i + 1}`}
                          className="w-full h-32 sm:h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <Eye className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hasil Perbaikan (Jika Ada) */}
              {(selectedReport.tindakanPerbaikan ||
                (selectedReport.fotoPerbaikan &&
                  selectedReport.fotoPerbaikan.length > 0)) && (
                <div className="space-y-4 pt-4 border-t border-slate-100 mt-4">
                  <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                    Hasil Perbaikan / Tindakan
                  </h4>

                  {selectedReport.tindakanPerbaikan && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                      <p className="text-sm text-slate-700 leading-relaxed pl-2">
                        "{selectedReport.tindakanPerbaikan}"
                      </p>
                    </div>
                  )}

                  {selectedReport.fotoPerbaikan &&
                    selectedReport.fotoPerbaikan.length > 0 && (
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        {selectedReport.fotoPerbaikan.map((f, i) => (
                          <div
                            key={i}
                            className="group relative rounded-xl overflow-hidden border border-emerald-200 shadow-sm cursor-pointer"
                            onClick={() => setSelectedImage(`${process.env.NEXT_PUBLIC_API_URL}/${f}`)}
                          >
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL}/${f}`}
                              alt={`Foto Perbaikan ${i + 1}`}
                              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <Eye className="w-8 h-8 text-white drop-shadow-md" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}

              {/* Catatan Penolakan / Validasi */}
              {selectedReport.catatanKadivPphse && (
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider">
                    Catatan Validasi / Penolakan
                  </h4>
                  <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                    <p className="text-sm text-rose-700 leading-relaxed pl-2 font-medium">
                      "{selectedReport.catatanKadivPphse}"
                    </p>
                  </div>
                </div>
              )}

              {/* Form Validasi dihapus dari sini dan dipindahkan ke Dialog terpisah */}
            </div>
          )}

          <div className="border-t border-slate-100 px-4 sm:px-6 py-3 sm:py-4 bg-slate-50/50 flex-shrink-0">
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 w-full">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-lg sm:rounded-xl" onClick={() => setIsDetailOpen(false)}>
                  Tutup
                </Button>
                {canDelete("hse") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(selectedReport.id)}
                    disabled={isSubmitting}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg sm:rounded-xl"
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    Hapus
                  </Button>
                )}
              </div>

              {/* Action Buttons for Validasi Awal */}
              {(isKadisHse || isKadivPphse) &&
                (selectedReport?.status === "menunggu_validasi_kadis_hse" ||
                  selectedReport?.status === "menunggu_validasi_kadiv_pphse") && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 sm:flex-initial rounded-lg sm:rounded-xl"
                      onClick={() => openValidation("reject")}
                    >
                      Tolak
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-initial rounded-lg sm:rounded-xl"
                      onClick={() => openValidation("approve")}
                    >
                      Setujui
                    </Button>
                  </div>
                )}

              {/* Action Buttons for Validasi Hasil */}
              {isKadisHse &&
                (selectedReport?.status === "menunggu_validasi_hasil_kadis_hse" ||
                  selectedReport?.status ===
                    "menunggu_verifikasi_investigasi") && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 sm:flex-initial rounded-lg sm:rounded-xl"
                      onClick={() => openValidation("reject")}
                    >
                      Tolak
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-initial rounded-lg sm:rounded-xl"
                      onClick={() => openValidation("approve")}
                    >
                      Validasi
                    </Button>
                  </div>
                )}

              {/* Action Buttons for Validasi Akhir */}
              {isKadivPphse &&
                (selectedReport?.status ===
                  "menunggu_validasi_akhir_kadiv_pphse" ||
                  selectedReport?.status === "menunggu_validasi_kadiv") && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 sm:flex-initial rounded-lg sm:rounded-xl"
                      onClick={() => openValidation("reject")}
                    >
                      Tolak
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-initial rounded-lg sm:rounded-xl"
                      onClick={() => openValidation("approve")}
                    >
                      Selesai
                    </Button>
                  </div>
                )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Buat Laporan */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          {/* Styled Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <ShieldCheck size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">K3 Safety Report</span>
            </div>
            <DialogHeader className="p-0">
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Buat Laporan K3</DialogTitle>
              <DialogDescription className="text-xs font-medium text-slate-500">
                Laporkan temuan K3 di lapangan. Isi semua informasi yang diperlukan.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
            {!isCameraOpen ? (
              <div className="space-y-5">
                {/* Kategori */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-slate-500 mb-1">
                    <AlertTriangle size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Kategori Insiden</span>
                  </label>
                  <Select
                    value={createData.kategori}
                    onValueChange={(val) =>
                      setCreateData({ ...createData, kategori: val })
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors font-medium">
                      <SelectValue placeholder="Pilih Kategori Temuan" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl border-slate-200">
                      {/* Group: Observasi */}
                      <div className="px-3 py-1.5 text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50/50">
                        Temuan Observasi
                      </div>
                      <SelectItem value="Kondisi Tidak Aman" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><ShieldAlert size={14} className="text-amber-500" /> Kondisi Tidak Aman</span>
                      </SelectItem>
                      <SelectItem value="Tindakan Tidak Aman" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><Ban size={14} className="text-orange-500" /> Tindakan Tidak Aman</span>
                      </SelectItem>
                      <SelectItem value="Near Miss" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><Crosshair size={14} className="text-red-500" /> Near Miss</span>
                      </SelectItem>
                      {/* Group: Insiden/Kecelakaan */}
                      <div className="px-3 py-1.5 text-[10px] font-black text-rose-600 uppercase tracking-widest bg-rose-50/50 mt-1">
                        Insiden / Kecelakaan
                      </div>
                      <SelectItem value="First Aid Case" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><Cross size={14} className="text-blue-500" /> First Aid Case</span>
                      </SelectItem>
                      <SelectItem value="Medical Treatment" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><Stethoscope size={14} className="text-indigo-500" /> Medical Treatment</span>
                      </SelectItem>
                      <SelectItem value="Lost Time Injury" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><Timer size={14} className="text-rose-500" /> Lost Time Injury</span>
                      </SelectItem>
                      <SelectItem value="Permanent Disability" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><Accessibility size={14} className="text-purple-500" /> Permanent Disability</span>
                      </SelectItem>
                      <SelectItem value="Fatality" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><Skull size={14} className="text-rose-700" /> Fatality</span>
                      </SelectItem>
                      {/* Group: Lainnya */}
                      <div className="px-3 py-1.5 text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50/50 mt-1">
                        Lainnya
                      </div>
                      <SelectItem value="Ide perbaikan K3" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><Lightbulb size={14} className="text-emerald-500" /> Ide Perbaikan K3</span>
                      </SelectItem>
                      <SelectItem value="Lainnya" className="py-2.5 pl-4 font-medium">
                        <span className="flex items-center gap-2"><ListChecks size={14} className="text-slate-500" /> Lainnya</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Deskripsi */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-slate-500 mb-1">
                    <ClipboardCheck size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Deskripsi Kejadian</span>
                  </label>
                  <Textarea
                    placeholder="Ceritakan dengan detail apa yang terjadi, di mana, dan bagaimana..."
                    value={createData.deskripsi}
                    onChange={(e) =>
                      setCreateData({ ...createData, deskripsi: e.target.value })
                    }
                    className="resize-none h-28 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors focus:bg-white"
                  />
                </div>

                {/* Lokasi Temuan */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-slate-500 mb-1">
                    <MapPin size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Lokasi Temuan</span>
                  </label>
                  <Input
                    placeholder="Misal: Area Pump Station IV"
                    value={createData.lokasiTemuan}
                    onChange={(e) =>
                      setCreateData({
                        ...createData,
                        lokasiTemuan: e.target.value,
                      })
                    }
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors focus:bg-white"
                  />
                </div>

                {/* Foto Bukti */}
                <div className="space-y-2">
                  <label className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Camera size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Foto Bukti ({createPhotos.length}/{MAX_PHOTOS})
                      </span>
                    </div>
                    {createPhotos.length < MAX_PHOTOS && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-rose-600 px-2 rounded-lg hover:bg-rose-50"
                        onClick={openCamera}
                      >
                        <Camera size={12} className="mr-1" /> Buka Kamera
                      </Button>
                    )}
                  </label>

                  {/* Photo grid preview */}
                  {createPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {createPhotos.map((p, i) => (
                        <div key={i} className="relative border border-slate-200 rounded-xl overflow-hidden aspect-square group shadow-sm">
                          <img
                            src={p.preview}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            alt={`Foto ${i + 1}`}
                          />
                          <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-300" />
                          <button
                            className="absolute top-1.5 right-1.5 bg-black/50 text-white p-1 rounded-full hover:bg-rose-600 transition-colors backdrop-blur-sm"
                            onClick={() => removePhoto(i)}
                          >
                            <XCircle size={14} />
                          </button>
                          <span className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                            {(p.file.size / 1024).toFixed(0)}KB
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add more photos area */}
                  {createPhotos.length < MAX_PHOTOS && (
                    <div
                      className="border-2 border-dashed border-slate-200 rounded-2xl h-24 flex items-center justify-center bg-slate-50/50 hover:bg-slate-100 hover:border-rose-300 cursor-pointer transition-all duration-300 group"
                      onClick={openCamera}
                    >
                      <div className="text-slate-400 group-hover:text-rose-500 flex flex-col items-center gap-1.5 transition-colors">
                        <Camera size={22} />
                        <span className="text-[11px] font-medium">
                          {createPhotos.length === 0
                            ? "Wajib ambil foto dari kamera (min. 1)"
                            : `Tambah foto (maks. ${MAX_PHOTOS - createPhotos.length} lagi)`}
                        </span>
                        <span className="text-[9px] text-slate-400">Maks. 500KB per foto (otomatis dikompres)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info hint */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Pastikan kategori, deskripsi, dan minimal 1 foto (maks. 3) sudah terisi sebelum mengirim laporan. Foto akan otomatis dikompres ke maks. 500KB.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2 flex flex-col items-center">
                <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden flex items-center justify-center shadow-inner">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    autoPlay
                    muted
                  />
                  <button
                    className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-full hover:bg-white/20 transition-colors backdrop-blur-md"
                    onClick={switchCamera}
                    title="Ganti Kamera"
                  >
                    <SwitchCamera size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    className="rounded-full w-12 h-12 p-0"
                    onClick={closeCamera}
                  >
                    <XCircle size={20} className="text-gray-500" />
                  </Button>
                  <Button
                    className="rounded-full w-16 h-16 bg-white border-4 border-rose-500 hover:bg-gray-100 shadow-xl p-0"
                    onClick={takePhoto}
                  >
                    <div className="w-12 h-12 rounded-full bg-rose-600" />
                  </Button>
                  <div className="w-12 h-12" /> {/* Empty div for balance */}
                </div>
              </div>
            )}
          </div>

          {!isCameraOpen && (
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-semibold px-6"
                onClick={() => setIsCreateOpen(false)}
              >
                Batal
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-100 font-semibold px-6"
                onClick={submitCreate}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                ) : (
                  <ShieldCheck size={16} className="mr-2" />
                )}
                Kirim Laporan
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Validation Dialog (Nested/Secondary Popup) */}
      <Dialog open={isValidationOpen} onOpenChange={setIsValidationOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl border-none shadow-2xl p-4 sm:p-6">
          <DialogHeader
            className={
              validationAction === "approve"
                ? "text-emerald-700"
                : "text-rose-700"
            }
          >
            <DialogTitle className="text-lg sm:text-xl font-black">
              {validationAction === "approve"
                ? "Setujui Laporan"
                : "Tolak Laporan"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {validationAction === "approve"
                ? "Pilih tindak lanjut dan tugaskan staf untuk menyelesaikan masalah ini."
                : "Berikan alasan mengapa laporan ini ditolak."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-5">
            {validationAction === "approve" &&
              (selectedReport?.status === "menunggu_validasi_kadis_hse" ||
                selectedReport?.status === "menunggu_validasi_kadiv_pphse") && (
                <>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Pilih Jenis Tindakan
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={cn(
                          "cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center text-center gap-2",
                          jenisTindakan === "perbaikan_langsung"
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 hover:border-emerald-200 hover:bg-slate-50",
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name="jenisTindakan"
                          value="perbaikan_langsung"
                          checked={jenisTindakan === "perbaikan_langsung"}
                          onChange={(e) => setJenisTindakan(e.target.value)}
                        />
                        <ShieldCheck
                          size={28}
                          className={
                            jenisTindakan === "perbaikan_langsung"
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }
                        />
                        <span
                          className={cn(
                            "text-xs font-bold",
                            jenisTindakan === "perbaikan_langsung"
                              ? "text-emerald-700"
                              : "text-slate-600",
                          )}
                        >
                          Perbaikan
                          <br />
                          Langsung
                        </span>
                      </label>
                      <label
                        className={cn(
                          "cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center text-center gap-2",
                          jenisTindakan === "investigasi"
                            ? "border-amber-500 bg-amber-50"
                            : "border-slate-200 hover:border-amber-200 hover:bg-slate-50",
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name="jenisTindakan"
                          value="investigasi"
                          checked={jenisTindakan === "investigasi"}
                          onChange={(e) => setJenisTindakan(e.target.value)}
                        />
                        <Search
                          size={28}
                          className={
                            jenisTindakan === "investigasi"
                              ? "text-amber-600"
                              : "text-slate-400"
                          }
                        />
                        <span
                          className={cn(
                            "text-xs font-bold",
                            jenisTindakan === "investigasi"
                              ? "text-amber-700"
                              : "text-slate-600",
                          )}
                        >
                          Investigasi
                          <br />
                          Lanjut
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tugaskan Ke (Staf HSE)
                    </label>
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger className="w-full h-12 rounded-xl">
                        <SelectValue placeholder="Pilih staf yang bertugas..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.map((staff) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name} - {staff.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

            {validationAction === "reject" && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Catatan (Wajib)
                </label>
                <textarea
                  value={catatanValidasi}
                  onChange={(e) => setCatatanValidasi(e.target.value)}
                  placeholder="Masukkan alasan penolakan laporan..."
                  className="w-full h-28 p-4 rounded-xl border border-slate-200 text-sm transition-all focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-slate-50 focus:bg-white"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4 border-slate-100">
            <Button
              variant="ghost"
              onClick={() => setIsValidationOpen(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              className={cn(
                "text-white",
                validationAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700",
              )}
              onClick={submitValidation}
              disabled={
                isSubmitting ||
                (validationAction === "approve" &&
                  !assignedTo &&
                  (selectedReport?.status === "menunggu_validasi_kadis_hse" ||
                    selectedReport?.status ===
                      "menunggu_validasi_kadiv_pphse")) ||
                (validationAction === "reject" && !catatanValidasi.trim())
              }
            >
              {isSubmitting ? "Memproses..." : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-fit w-auto p-0 bg-transparent border-none shadow-none [&>button]:hidden flex justify-center items-center">
          <div className="relative flex justify-center items-center">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Preview"
                className="max-h-[85vh] w-auto max-w-[95vw] rounded-xl object-contain shadow-2xl"
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-3 -right-3 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center p-0 backdrop-blur-sm"
              onClick={() => setSelectedImage(null)}
            >
              <XCircle className="w-6 h-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
