"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Settings, Undo2, ListChecks, ShieldCheck } from "lucide-react";
import SettingsTab from "./components/SettingsTab";
import RevertStepTab from "./components/RevertStepTab";
import FormBuilderTab from "./components/FormBuilderTab";

// ═══════════════════════════════════════════════════════════════════════════════
// TAB DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: "settings", label: "Pengaturan Umum", icon: Settings },
  { key: "revert", label: "Mundurkan Tahapan", icon: Undo2 },
  { key: "form-builder", label: "Form Investigasi", icon: ListChecks },
];

export default function AdminK3Page() {
  const [activeTab, setActiveTab] = useState("settings");
  const [settings, setSettings] = useState(null);
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiGet("/k3-settings");
      setSettings(res.data);
    } catch (error) {
      console.error("Failed to load settings", error);
      toast.error("Gagal memuat pengaturan K3");
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const role = String(user.role || "").toLowerCase();
    const divisi = String(user.divisi || "").toLowerCase();
    const dinas = String(user.dinas || "").toLowerCase();

    let allowed = false;
    if (role === "admin") allowed = true;
    else if (role === "kadiv" && divisi.includes("pphse")) allowed = true;
    else if (role === "kadis" && dinas.includes("hse") && !dinas.includes("pphse")) allowed = true;

    if (!allowed) {
      setIsAllowed(false);
    } else {
      setIsAllowed(true);
      fetchSettings();
    }
  }, [fetchSettings, router]);

  if (isAllowed === null) {
    return <div className="p-8 text-center text-slate-500">Memeriksa otorisasi...</div>;
  }

  if (isAllowed === false) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-rose-200 bg-white px-6 py-5 shadow-sm text-center">
          <p className="text-lg font-bold text-rose-700 mb-2">Akses Ditolak</p>
          <p className="text-sm text-slate-500 mb-4">
            Halaman ini hanya dapat diakses oleh Admin, Kepala Divisi PPHSE, dan Kepala Dinas HSE.
          </p>
          <Button onClick={() => router.push("/dashboard")} variant="outline">
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-1.5 sm:p-2 bg-slate-800 rounded-lg sm:rounded-xl shadow-lg">
              <ShieldCheck size={18} className="text-white sm:w-5 sm:h-5" />
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              Admin K3
            </h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm ml-9 sm:ml-12 hidden sm:block">
            Konfigurasi parameter K3, kelola tahapan laporan, dan buat template
            form investigasi.
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl sm:rounded-2xl w-full overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 sm:gap-2 flex-1 px-2.5 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-sm font-semibold transition-all rounded-lg sm:rounded-xl whitespace-nowrap",
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Icon
                size={14}
                className={cn(
                  "sm:w-4 sm:h-4",
                  isActive ? "text-slate-800" : "text-slate-400",
                )}
              />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "settings" && (
        <SettingsTab settings={settings} fetchSettings={fetchSettings} />
      )}
      {activeTab === "revert" && <RevertStepTab />}
      {activeTab === "form-builder" && <FormBuilderTab />}
    </div>
  );
}
