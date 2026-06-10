"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserCircle2 } from "lucide-react";
import { formatDateShort } from "@/lib/date-utils";

export const fmtDate = formatDateShort;

export function CorrectiveStatusBadge({ value, colorMap, labelMap }) {
  const colorClass = colorMap?.[value] || "bg-gray-100 text-gray-600";
  const label = labelMap?.[value] || value || "-";
  return (
    <Badge
      className={cn(
        "px-2 py-0.5 text-xs font-semibold border-transparent",
        colorClass,
      )}
    >
      {label}
    </Badge>
  );
}

export function Section({ title, children }) {
  return (
    <div className="flex flex-col h-full">
      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
        {title}
      </h4>
      <div className="space-y-3 flex-1 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
        {children}
      </div>
    </div>
  );
}

export function Row({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-slate-800 font-medium break-words">
        {value || "-"}
      </dd>
    </div>
  );
}

export function MetricCard({ label, value, className }) {
  return (
    <div
      className={cn(
        "bg-white p-3 rounded-xl border border-slate-200 shadow-sm",
        className,
      )}
    >
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}

export function InfoCard({ label, value, mono, className }) {
  return (
    <div className={cn("bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm", className)}>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </div>
      <div
        className={cn(
          "text-sm text-slate-800 font-medium break-words",
          mono && "font-mono",
        )}
      >
        {value || "-"}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center text-slate-400 py-8">
      <Icon size={48} strokeWidth={1} className="mb-3 text-slate-300" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

export function SkeletonRows({ cols = 6, rows = 5 }) {
  const widths = ["w-24", "w-32", "w-20", "w-16", "w-28", "w-14"];
  const subWidths = ["w-16", "w-24", "w-12", "w-20", "w-10", "w-18"];
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="animate-pulse border-b border-slate-100 last:border-0">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className="px-4 py-3">
          <div className={cn("h-3.5 bg-slate-200/70 rounded-full mb-1.5", widths[c % widths.length])} />
          {c < 3 && (
            <div className={cn("h-2.5 bg-slate-100 rounded-full", subWidths[c % subWidths.length])} />
          )}
        </td>
      ))}
    </tr>
  ));
}

export function PersonCard({ title, name, nik, role, divisi, dinas, group, fallback }) {
  if (!name && !fallback) return null;

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "";

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col h-full hover:border-blue-200 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-2 mb-3">
        <UserCircle2 size={16} className="text-blue-500" />
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {title}
        </div>
      </div>
      {name ? (
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100 shadow-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-800 text-[15px] truncate leading-tight">
              {name}
            </div>
            {nik && (
              <div className="text-xs text-slate-500 font-mono mt-0.5 mb-2">
                {nik}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {role && (
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] px-2 py-0.5 font-semibold"
                >
                  {role}
                </Badge>
              )}
              {divisi && (
                <Badge
                  variant="secondary"
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] px-2 py-0.5 font-semibold"
                >
                  {divisi}
                </Badge>
              )}
              {dinas && (
                <Badge
                  variant="secondary"
                  className="bg-teal-50 text-teal-700 hover:bg-teal-100 text-[10px] px-2 py-0.5 font-semibold"
                >
                  {dinas}
                </Badge>
              )}
              {group && (
                <Badge
                  variant="secondary"
                  className="bg-orange-50 text-orange-700 hover:bg-orange-100 text-[10px] px-2 py-0.5 font-semibold"
                >
                  {group}
                </Badge>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500 italic flex items-center h-11 bg-slate-50 rounded-lg px-3 border border-slate-100">
          {fallback}
        </div>
      )}
    </div>
  );
}
