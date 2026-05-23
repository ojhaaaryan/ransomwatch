// ============================================================
// CanaryGrid.tsx — Visual grid of all canary files with status
// ============================================================
import { Shield, AlertTriangle, Lock, Eye } from 'lucide-react';
import type { CanaryFile } from '../types';

interface Props {
  canaries: CanaryFile[];
}

const EXT_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  '.xlsx': { color: '#00d4ff', label: 'Spreadsheet', icon: '📊' },
  '.docx': { color: '#00ff41', label: 'Document',    icon: '📄' },
  '.pdf':  { color: '#ff4400', label: 'PDF Report',  icon: '📋' },
  '.db':   { color: '#9b59b6', label: 'Database',    icon: '🗄️'  },
  '.bak':  { color: '#ffaa00', label: 'Backup',      icon: '💾' },
};

export default function CanaryGrid({ canaries }: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#ffaa00]"
          style={{ textShadow: '0 0 8px #ffaa0080' }}
        >
          ◈ CANARY FILE STATUS
        </h3>
        <div
          className="text-[10px] font-['Share_Tech_Mono'] px-2 py-0.5 rounded"
          style={{ background: '#ffaa0015', border: '1px solid #ffaa0030', color: '#ffaa00' }}
        >
          {canaries.filter(c => !c.triggered).length}/{canaries.length} INTACT
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 gap-2 overflow-y-auto">
        {canaries.map((canary) => {
          const cfg   = EXT_CONFIG[canary.extension] ?? { color: '#00ff41', label: 'File', icon: '📁' };
          const name  = canary.path.split('/').pop() ?? canary.path;
          const dir   = canary.path.split('/').slice(0, -1).join('/');

          return (
            <div
              key={canary.id}
              className="cyber-card rounded p-3 transition-all duration-500"
              style={{
                borderColor: canary.triggered ? '#ff004060' : `${cfg.color}30`,
                background:  canary.triggered ? '#ff004010' : `${cfg.color}05`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {/* Icon */}
                <span className="text-base">{cfg.icon}</span>

                {/* Status badge */}
                {canary.triggered ? (
                  <div className="flex items-center gap-1">
                    <AlertTriangle size={10} className="text-[#ff0040] glow-red" />
                    <span
                      className="text-[9px] font-['Orbitron'] font-bold px-1.5 py-0.5 rounded tracking-wider"
                      style={{ background: '#ff004030', color: '#ff0040', border: '1px solid #ff004060' }}
                    >
                      TRIGGERED
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Shield size={10} style={{ color: cfg.color }} />
                    <span
                      className="text-[9px] font-['Orbitron'] font-bold px-1.5 py-0.5 rounded tracking-wider"
                      style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                    >
                      MONITORING
                    </span>
                  </div>
                )}

                {/* Extension badge */}
                <span
                  className="ml-auto text-[9px] font-['Share_Tech_Mono'] px-1.5 py-0.5 rounded"
                  style={{ background: `${cfg.color}15`, color: cfg.color }}
                >
                  {canary.extension}
                </span>
              </div>

              {/* File name */}
              <div
                className="font-['Share_Tech_Mono'] text-[10px] truncate mb-1"
                style={{ color: canary.triggered ? '#ff0040' : cfg.color }}
                title={name}
              >
                {name}
              </div>

              {/* Directory */}
              <div className="text-[9px] font-['Share_Tech_Mono'] text-[#00ff4140] truncate mb-2" title={dir}>
                {dir}/
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                <MetaItem label="INODE" value={canary.inode.toString()} />
                <MetaItem label="PLACED" value={new Date(canary.placedAt).toLocaleDateString()} />
                <MetaItem label="SHA256" value={`${canary.sha256.slice(0, 8)}…`} />
                {canary.triggeredAt && (
                  <MetaItem
                    label="TRIGGERED"
                    value={new Date(canary.triggeredAt).toLocaleTimeString('en-US', { hour12: false })}
                    color="#ff0040"
                  />
                )}
              </div>

              {/* Integrity indicator */}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Eye size={8} style={{ color: cfg.color, opacity: 0.5 }} />
                  <span className="text-[8px] font-['Share_Tech_Mono']" style={{ color: cfg.color, opacity: 0.5 }}>
                    inotify + hash watch
                  </span>
                </div>
                {!canary.triggered && (
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color, opacity: 0.8 }} />
                  </div>
                )}
                {canary.triggered && (
                  <Lock size={10} className="text-[#ff0040]" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetaItem({ label, value, color = '#00ff4160' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span className="text-[8px] font-['Rajdhani'] font-semibold tracking-wider text-[#00ff4130] uppercase">
        {label}:{' '}
      </span>
      <span className="font-['Share_Tech_Mono'] text-[9px]" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
