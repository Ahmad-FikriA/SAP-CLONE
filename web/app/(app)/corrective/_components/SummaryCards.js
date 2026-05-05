"use client";

import { Inbox, Clock, FileText, Activity } from "lucide-react";

export function SummaryCards({ requests, spks }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <Inbox size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Laporan
          </p>
          <p className="text-2xl font-extrabold text-slate-900 truncate">
            {requests.length}
          </p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
          <Clock size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Butuh Approval
          </p>
          <p className="text-2xl font-extrabold text-slate-900 truncate">
            {requests.filter((r) => r.approvalStatus === "pending").length}
          </p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
          <FileText size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            SPK Aktif
          </p>
          <p className="text-2xl font-extrabold text-slate-900 truncate">
            {spks.length}
          </p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
          <Activity size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Sedang Dikerjakan
          </p>
          <p className="text-2xl font-extrabold text-slate-900 truncate">
            {
              spks.filter(
                (s) => s.status === "eksekusi" || s.sys_status?.includes("EXEC"),
              ).length
            }
          </p>
        </div>
      </div>
    </div>
  );
}
