// ============================================================
// StatCard.tsx — Animated metric card with corner decorations
// ============================================================
import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  color?: 'green' | 'red' | 'amber' | 'blue';
  pulse?: boolean;
  large?: boolean;
}

const COLOR_MAP = {
  green: { text: '#00ff41', bg: '#00ff4108', border: '#00ff4130', glow: 'glow-box-green' },
  red:   { text: '#ff0040', bg: '#ff004008', border: '#ff004030', glow: 'glow-box-red'   },
  amber: { text: '#ffaa00', bg: '#ffaa0008', border: '#ffaa0030', glow: 'glow-box-amber' },
  blue:  { text: '#00d4ff', bg: '#00d4ff08', border: '#00d4ff30', glow: 'glow-box-blue'  },
};

export default function StatCard({
  label, value, sub, icon, color = 'green', pulse = false, large = false,
}: Props) {
  const c = COLOR_MAP[color];

  return (
    <div
      className={`cyber-card rounded p-4 relative ${c.glow} ${pulse ? `pulse-${color}` : ''}`}
      style={{ background: c.bg, borderColor: c.border }}
    >
      {/* Corner decorations */}
      <span
        className="absolute top-0 left-0 w-3 h-3"
        style={{ borderTop: `2px solid ${c.text}`, borderLeft: `2px solid ${c.text}` }}
      />
      <span
        className="absolute bottom-0 right-0 w-3 h-3"
        style={{ borderBottom: `2px solid ${c.text}`, borderRight: `2px solid ${c.text}` }}
      />

      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-['Rajdhani'] font-semibold tracking-[0.15em] uppercase"
          style={{ color: c.text, opacity: 0.7 }}>
          {label}
        </span>
        <span style={{ color: c.text, opacity: 0.8 }}>{icon}</span>
      </div>

      <div
        className={`font-['Orbitron'] font-bold ${large ? 'text-4xl' : 'text-3xl'}`}
        style={{ color: c.text, textShadow: `0 0 12px ${c.text}80` }}
      >
        {value}
      </div>

      {sub && (
        <div className="mt-1 text-[10px] font-['Share_Tech_Mono']" style={{ color: c.text, opacity: 0.5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
