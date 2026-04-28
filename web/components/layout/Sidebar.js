'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Wrench, Upload, Radio,
  Map, Users, Link2, Calendar, Activity, LogOut,
  ChevronLeft, ChevronRight, ClipboardCheck, BarChart2, ClipboardList,
  MapPin, CalendarRange, ShieldCheck, Settings,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { clearAuth, getUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { key: 'dashboard',         href: '/dashboard',          label: 'Dashboard',          Icon: LayoutDashboard },
  { key: 'spk',               href: '/spk',                label: 'SPK / Preventive',   Icon: FileText },
  { key: 'spk-approval',      href: '/spk/approval',       label: 'Persetujuan SPK',    Icon: ClipboardCheck },
  { key: 'corrective',        href: '/corrective',         label: 'Corrective Planner', Icon: Wrench },
  { key: 'hse',               href: '/hse',                label: 'HSE Command Center', Icon: ShieldCheck },
  { key: 'spk-import',        href: '/spk/import',         label: 'Import SAP',         Icon: Upload },
  { divider: true },
  { key: 'equipment',         href: '/equipment',          label: 'Equipment',          Icon: Radio },
  { key: 'maps',              href: '/maps',               label: 'Maps',               Icon: Map },
  { key: 'users',             href: '/users',              label: 'Users',              Icon: Users },
  { key: 'track-record',      href: '/users/track-record', label: 'Track Record',       Icon: BarChart2 },
  { key: 'task-mapping',      href: '/equipment/mappings', label: 'Task Mapping',       Icon: Link2 },
  { key: 'interval-planner',  href: '/interval-planner',   label: 'Interval Planner',   Icon: Calendar },
  { divider: true },
  { key: 'submissions',       href: '/submissions',        label: 'Submissions',        Icon: Activity },
  { divider: true },
  { key: 'inspeksi',          href: '/inspeksi',           label: 'Inspeksi',           Icon: ClipboardList },
  { key: 'supervisi',         href: '/supervisi',          label: 'Supervisi',          Icon: MapPin },
  { key: 'kalender',          href: '/kalender',           label: 'Kalender Jadwal',    Icon: CalendarRange },
  { key: 'settings',          href: '/settings',           label: 'Pengaturan Akses',   Icon: Settings },

];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebar_collapsed') === '1');
    setUser(getUser());
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
  }

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  function isActive(href) {
    if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/dashboard/');
    return pathname === href || pathname.startsWith(href + '/');
  }

  const initials = user
    ? (user.name || user.nik || 'U').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'U';

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-[#0a2540] text-white transition-all duration-200 shrink-0',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Logo / header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <Image src="/app_icon.jpeg" alt="Logo" width={32} height={32} className="rounded shrink-0" />
          {!collapsed && (
            <span className="text-sm font-semibold tracking-wide truncate">MANTIS PPHSE</span>
          )}
        </div>
        <button
          onClick={toggleCollapsed}
          className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {NAV.map((item, i) => {
          if (item.divider) {
            return <div key={i} className="my-2 border-t border-white/10" />;
          }
          const rolePages = user?.rolePages;
          const canSee = rolePages
            ? rolePages.includes(item.key)
            : true; // null = unrestricted (unknown role or kadiv)
          if (!canSee) return null;
          const { href, label, Icon } = item;
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-2 py-2 rounded text-sm transition-colors',
                active
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-white/10 p-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>
        {!collapsed && (
          <span className="text-xs text-white/70 truncate flex-1">
            {user?.name || user?.nik || ''}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
