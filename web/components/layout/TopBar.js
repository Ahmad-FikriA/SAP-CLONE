'use client';

export default function TopBar({ title }) {
  return (
    <header className="h-12 bg-[#0a2540] text-white flex items-center px-6 shadow-sm shrink-0">
      <h1 className="text-sm font-medium tracking-wide truncate">{title || 'KTI SmartCare'}</h1>
    </header>
  );
}
