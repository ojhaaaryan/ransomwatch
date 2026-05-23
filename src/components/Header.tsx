// ============================================================
// Header.tsx — Top navigation bar with system status & clock
// ============================================================
import { useEffect, useState } from 'react';
import { Shield, Activity, AlertTriangle, Radio } from 'lucide-react';
import type { SystemStatus, ThreatLevel } from '../types';

interface Props {
  status: SystemStatus;
  threatLevel: ThreatLevel;
  alertCount: number;
}

const STATUS_COLORS: Record<SystemStatus, string> = {
  IDLE:      'text-[#888] border-[#333]',
  ARMED:     'text-[#00ff41] border-[#00ff41]',
  TRIGGERED: 'text-[#ff0040] border-[#ff0040]',
  CONTAINED: 'text-[#ffaa00] border-[#ffaa00]',
};

const STATUS_GLOW: Record<SystemStatus, string> = {
  IDLE:      '',
  ARMED:     'glow-green pulse-green',
  TRIGGERED: 'glow-red pulse-red',
  CONTAINED: 'glow-amber pulse-amber',
};

const THREAT_COLORS: Record<ThreatLevel, string> = {
  LOW:      'bg-[#00ff4120] text-[#00ff41] border-[#00ff4140]',
  MEDIUM:   'bg-[#ffaa0020] text-[#ffaa00] border-[#ffaa0040]',
  HIGH:     'bg-[#ff440020] text-[#ff4400] border-[#ff440040]',
  CRITICAL: 'bg-[#ff004020] text-[#ff0040] border-[#ff004040] threat-critical',
};

export default function Header({ status, threatLevel, alertCount }: Props) {
  const [time, setTime]   = useState(new Date());
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const t1 = setInterval(() => setTime(new Date()), 1000);
    const t2 = setInterval(() => setBlink(b => !b), 500);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const hh = time.getHours().toString().padStart(2, '0');
  const mm = time.getMinutes().toString().padStart(2, '0');
  const ss = time.getSeconds().toString().padStart(2, '0');

  return (
    <header
      className="relative z-20 flex items-center justify-between px-6 py-3 border-b"
      style={{
        background: 'linear-gradient(180deg, #020802 0%, #030a03 100%)',
        borderColor: '#00ff4130',
        boxShadow: '0 1px 0 #00ff4115, 0 4px 20px #00000080',
      }}
    >
      {/* Left – Logo */}
      <div className="flex items-center gap-3">
        <div
          className="relative w-10 h-10 flex items-center justify-center rounded"
          style={{ border: '1px solid #00ff4140', background: '#00ff4108' }}
        >
          <Shield size={22} className="text-[#00ff41] glow-green" />
          {status === 'TRIGGERED' && (
            <span
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#ff0040] pulse-red"
              style={{ boxShadow: '0 0 6px #ff0040' }}
            />
          )}
        </div>
        <div>
          <div
            className="glitch-text text-[#00ff41] font-['Orbitron'] text-xl font-bold tracking-widest glow-green"
            data-text="RANSOMWATCH"
          >
            RANSOMWATCH
          </div>
          <div className="text-[10px] text-[#00ff4180] font-['Share_Tech_Mono'] tracking-[0.2em]">
            CANARY-BASED RANSOMWARE DETECTION SYSTEM v2.4.1
          </div>
        </div>
      </div>

      {/* Centre – Phase indicator */}
      <div className="hidden lg:flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-[#00ff41] glow-green" />
          <span className="text-[11px] font-['Share_Tech_Mono'] text-[#00ff4180] tracking-widest">
            MITRE T1486
          </span>
        </div>
        <div
          className="px-4 py-1 rounded border text-sm font-['Orbitron'] font-semibold tracking-widest"
          style={{ borderColor: '#00d4ff40', color: '#00d4ff', background: '#00d4ff08', textShadow: '0 0 8px #00d4ff' }}
        >
          SOC DASHBOARD
        </div>
        <div
          className={`px-3 py-1 rounded border text-xs font-bold tracking-wider ${THREAT_COLORS[threatLevel]}`}
        >
          THREAT: {threatLevel}
        </div>
      </div>

      {/* Right – Clock + Status */}
      <div className="flex items-center gap-4">
        {/* Alert badge */}
        {alertCount > 0 && (
          <div className="flex items-center gap-1">
            <AlertTriangle size={14} className="text-[#ff0040] glow-red" />
            <span className="text-[#ff0040] font-['Share_Tech_Mono'] text-sm glow-red font-bold">
              {alertCount} ALERT{alertCount > 1 ? 'S' : ''}
            </span>
          </div>
        )}

        {/* System status */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded border font-['Orbitron'] text-xs font-bold tracking-widest ${STATUS_COLORS[status]}`}
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <Activity size={12} className={STATUS_GLOW[status]} />
          <span className={STATUS_GLOW[status]}>{status}</span>
        </div>

        {/* Clock */}
        <div
          className="font-['Share_Tech_Mono'] text-[#00ff41] text-sm tracking-widest glow-green"
          style={{ minWidth: '80px', textAlign: 'right' }}
        >
          {hh}<span style={{ opacity: blink ? 1 : 0 }}>:</span>{mm}<span style={{ opacity: blink ? 1 : 0 }}>:</span>{ss}
        </div>
      </div>
    </header>
  );
}
