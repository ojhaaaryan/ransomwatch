// ============================================================
// AlertFeed.tsx — Live alert timeline with severity badges
// ============================================================
import { Shield, AlertTriangle, Zap, Eye } from 'lucide-react';
import type { Alert } from '../types';

interface Props {
  alerts: Alert[];
}

const EVENT_ICONS: Record<Alert['eventType'], typeof Shield> = {
  IN_MODIFY:   Zap,
  IN_ACCESS:   Eye,
  IN_OPEN:     Eye,
  IN_DELETE:   AlertTriangle,
  HASH_CHANGE: Shield,
};

const SEVERITY_STYLES: Record<Alert['severity'], { border: string; bg: string; text: string; badge: string }> = {
  LOW:      { border: '#00ff4140', bg: '#00ff4108', text: '#00ff41', badge: 'bg-[#00ff4120] text-[#00ff41]' },
  MEDIUM:   { border: '#ffaa0040', bg: '#ffaa0008', text: '#ffaa00', badge: 'bg-[#ffaa0020] text-[#ffaa00]' },
  HIGH:     { border: '#ff440040', bg: '#ff440008', text: '#ff4400', badge: 'bg-[#ff440020] text-[#ff4400]' },
  CRITICAL: { border: '#ff004060', bg: '#ff004010', text: '#ff0040', badge: 'bg-[#ff004030] text-[#ff0040]' },
};

const EXT_COLORS: Record<string, string> = {
  '.xlsx': '#00d4ff', '.docx': '#00ff41', '.pdf': '#ff4400',
  '.db':   '#9b59b6', '.bak': '#ffaa00',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false });
}

export default function AlertFeed({ alerts }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#00ff41]"
          style={{ textShadow: '0 0 8px #00ff41' }}
        >
          ◈ ALERT TIMELINE
        </h3>
        <span
          className="text-[10px] font-['Share_Tech_Mono'] px-2 py-0.5 rounded"
          style={{ background: '#00ff4115', border: '1px solid #00ff4130', color: '#00ff41' }}
        >
          {alerts.length} EVENT{alerts.length !== 1 ? 'S' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Shield size={28} className="text-[#00ff4130]" />
            <p className="text-[#00ff4140] font-['Share_Tech_Mono'] text-xs">
              NO ALERTS — SYSTEM MONITORING
            </p>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#00ff41] pulse-green"
                  style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
          </div>
        ) : (
          [...alerts].reverse().map((alert, idx) => {
            const s = SEVERITY_STYLES[alert.severity];
            const Icon = EVENT_ICONS[alert.eventType];
            const extColor = EXT_COLORS[alert.canaryExt] ?? '#00ff41';
            const fileName = alert.canaryPath.split('/').pop() ?? alert.canaryPath;

            return (
              <div
                key={alert.id}
                className="cyber-card rounded p-3 alert-enter"
                style={{
                  borderColor: s.border,
                  background: s.bg,
                  animationDelay: `${idx * 0.05}s`,
                }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={12} style={{ color: s.text }} />
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded font-['Orbitron'] tracking-wider ${s.badge}`}
                    >
                      {alert.severity}
                    </span>
                    <span
                      className="text-[10px] font-['Share_Tech_Mono'] px-1.5 py-0.5 rounded"
                      style={{ background: `${extColor}15`, color: extColor, border: `1px solid ${extColor}30` }}
                    >
                      {alert.canaryExt}
                    </span>
                  </div>
                  <span className="text-[10px] font-['Share_Tech_Mono'] text-[#00ff4160]">
                    {formatTime(alert.timestamp)}
                  </span>
                </div>

                {/* File path */}
                <div
                  className="font-['Share_Tech_Mono'] text-[11px] mb-2 truncate"
                  style={{ color: s.text }}
                  title={alert.canaryPath}
                >
                  🪤 {fileName}
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <Detail label="PID KILLED" value={`#${alert.offendingPid}`} color={s.text} />
                  <Detail label="PROCESS"    value={alert.processName}        color={s.text} />
                  <Detail label="LATENCY"    value={`${alert.detectionLatencyMs}ms`} color={
                    alert.detectionLatencyMs < 500 ? '#00ff41' :
                    alert.detectionLatencyMs < 1200 ? '#ffaa00' : '#ff0040'
                  } />
                  <Detail label="EVENT"      value={alert.eventType}          color={s.text} />
                  <Detail label="ENCRYPTED"  value={String(alert.filesEncrypted)} color="#ff0040" />
                  <Detail label="SAVED"      value={String(alert.filesSaved)}     color="#00ff41" />
                </div>

                {/* Kill confirmation */}
                {alert.processKilled && (
                  <div
                    className="mt-2 flex items-center gap-1 text-[10px] font-['Share_Tech_Mono']"
                    style={{ color: '#00ff41' }}
                  >
                    <span style={{ color: '#00ff41' }}>✓</span> SIGKILL sent — process terminated
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-['Rajdhani'] font-semibold tracking-widest text-[#00ff4150] uppercase">
        {label}
      </span>
      <span className="font-['Share_Tech_Mono'] text-[10px]" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
