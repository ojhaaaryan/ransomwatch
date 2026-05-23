// ============================================================
// LiveChart.tsx — Real-time bar + area charts using Recharts
// ============================================================
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, Legend,
} from 'recharts';
import type { FileStats } from '../types';

interface Props {
  stats: FileStats;
  history: Array<{ time: string; encrypted: number; saved: number }>;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#050f05',
    border: '1px solid #00ff4130',
    borderRadius: '4px',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '11px',
    color: '#00ff41',
  },
  labelStyle: { color: '#00ff4180' },
};

export default function LiveChart({ stats, history }: Props) {
  const barData = [
    { name: 'TOTAL',     value: stats.total,     fill: '#00d4ff' },
    { name: 'SAVED',     value: stats.saved,      fill: '#00ff41' },
    { name: 'ENCRYPTED', value: stats.encrypted,  fill: '#ff0040' },
    { name: 'CANARIES',  value: 5,                fill: '#ffaa00' },
  ];

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#00ff41]"
          style={{ textShadow: '0 0 8px #00ff41' }}
        >
          ◈ FILE PROTECTION METRICS
        </h3>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#00ff41] pulse-green" />
          <span className="text-[10px] font-['Share_Tech_Mono'] text-[#00ff4160]">LIVE</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="50%">
          <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#00ff4110" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#00ff4160', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}
              axisLine={{ stroke: '#00ff4120' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#00ff4160', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={50}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Area chart (history) */}
        <ResponsiveContainer width="100%" height="50%">
          <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSaved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00ff41" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00ff41" stopOpacity={0}   />
              </linearGradient>
              <linearGradient id="gradEncrypted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ff0040" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff0040" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#00ff4110" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#00ff4160', fontSize: 8, fontFamily: "'Share Tech Mono', monospace" }}
              axisLine={{ stroke: '#00ff4120' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#00ff4160', fontSize: 8, fontFamily: "'Share Tech Mono', monospace" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend
              wrapperStyle={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: '#00ff4180' }}
            />
            <Area
              type="monotone"
              dataKey="saved"
              name="SAVED"
              stroke="#00ff41"
              strokeWidth={2}
              fill="url(#gradSaved)"
            />
            <Area
              type="monotone"
              dataKey="encrypted"
              name="ENCRYPTED"
              stroke="#ff0040"
              strokeWidth={2}
              fill="url(#gradEncrypted)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'TOTAL',     val: stats.total,     c: '#00d4ff' },
          { label: 'SAVED',     val: stats.saved,      c: '#00ff41' },
          { label: 'ENCRYPTED', val: stats.encrypted,  c: '#ff0040' },
          { label: 'CANARIES',  val: stats.canariesTriggered, c: '#ffaa00' },
        ].map(({ label, val, c }) => (
          <div
            key={label}
            className="rounded p-2 text-center"
            style={{ background: `${c}08`, border: `1px solid ${c}20` }}
          >
            <div className="font-['Orbitron'] text-lg font-bold" style={{ color: c, textShadow: `0 0 8px ${c}60` }}>
              {val}
            </div>
            <div className="text-[9px] font-['Rajdhani'] font-semibold tracking-wider" style={{ color: c, opacity: 0.6 }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
