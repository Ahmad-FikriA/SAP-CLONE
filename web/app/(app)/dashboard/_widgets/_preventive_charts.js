'use client';

// This file is dynamically imported by widget_preventive.js to keep Recharts
// out of the SSR bundle (Recharts uses browser-only APIs).

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';

// ── Custom donut label (center text) ──────────────────────────────────────
function DonutCenterLabel({ viewBox, total }) {
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.4em" fontSize="22" fontWeight="700" fill="#1f2937">{total}</tspan>
      <tspan x={cx} dy="1.4em" fontSize="10" fill="#9ca3af">total</tspan>
    </text>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function PreventiveCharts({ statusData, catData, weeklyData, total }) {
  const hasWeekly = weeklyData.length > 1;

  return (
    <div className="space-y-5">
      {/* Row 1: Donut (status) + Bar (category) */}
      <div className={`grid gap-4 ${hasWeekly ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {/* Status donut */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Status
          </p>
          {statusData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%" cy="50%"
                  innerRadius={48} outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  startAngle={90} endAngle={-270}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="none" />
                  ))}
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                    <tspan x="50%" dy="-0.4em" fontSize="20" fontWeight="700" fill="#1f2937">{total}</tspan>
                    <tspan x="50%" dy="1.4em" fontSize="9" fill="#9ca3af">SPK</tspan>
                  </text>
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle" iconSize={7}
                  formatter={(v) => <span style={{ fontSize: 10, color: '#6b7280' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category bar */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Kategori
          </p>
          {catData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={catData} barSize={14} layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="completed" name="Selesai" stackId="a" radius={[0, 0, 0, 0]}>
                  {catData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={1} />
                  ))}
                </Bar>
                <Bar dataKey="total" name="Total" fill="#94a3b8" stackId="b" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Weekly trend (only if we have schedule data) */}
      {hasWeekly && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Tren Mingguan
          </p>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={weeklyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="total" name="Total" stroke="#3B82F6" strokeWidth={2}
                fill="url(#gradTotal)" dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="completed" name="Selesai" stroke="#10B981" strokeWidth={2}
                fill="url(#gradDone)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
