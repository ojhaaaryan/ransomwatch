// ============================================================
// IntegrityTable.tsx — Hash integrity check results table
// ============================================================
import type { IntegrityCheck } from '../types';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface Props {
  checks: IntegrityCheck[];
  nextCheckIn: number; // seconds until next check
}

export default function IntegrityTable({ checks, nextCheckIn }: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#ffaa00]"
          style={{ textShadow: '0 0 8px #ffaa0080' }}
        >
          ◈ INTEGRITY MONITOR
        </h3>
        <div className="flex items-center gap-2">
          <RefreshCw size={10} className="text-[#ffaa00]" style={{ animation: 'spin 2s linear infinite' }} />
          <span className="text-[10px] font-['Share_Tech_Mono'] text-[#ffaa0080]">
            NEXT CHECK: {nextCheckIn}s
          </span>
        </div>
      </div>

      <div
        className="text-[10px] font-['Share_Tech_Mono'] text-[#ffaa0080] mb-2 px-2 py-1.5 rounded"
        style={{ background: '#ffaa0008', border: '1px solid #ffaa0020' }}
      >
        Periodic SHA-256 re-hash detects in-place modification bypass (LD_PRELOAD evasion)
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[10px] font-['Share_Tech_Mono']">
          <thead>
            <tr style={{ borderBottom: '1px solid #00ff4115' }}>
              {['FILE', 'EXPECTED', 'ACTUAL', 'STATUS', 'CHECKED'].map(h => (
                <th
                  key={h}
                  className="pb-1.5 text-left font-semibold tracking-widest"
                  style={{ color: '#00ff4140', fontSize: '9px', fontFamily: "'Rajdhani', sans-serif" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checks.map((check, i) => {
              const fileName = check.file.split('/').pop() ?? check.file;
              return (
                <tr
                  key={i}
                  className="transition-colors hover:bg-[#00ff4105]"
                  style={{ borderBottom: '1px solid #00ff4108' }}
                >
                  <td className="py-1.5 text-[#00ff4180] max-w-[100px] truncate" title={fileName}>
                    {fileName}
                  </td>
                  <td className="py-1.5 text-[#00ff4160]">
                    {check.expected.slice(0, 8)}…
                  </td>
                  <td
                    className="py-1.5"
                    style={{ color: check.match ? '#00ff4160' : '#ff0040' }}
                  >
                    {check.actual.slice(0, 8)}…
                  </td>
                  <td className="py-1.5">
                    {check.match ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle size={10} className="text-[#00ff41]" />
                        <span className="text-[#00ff41]">OK</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <XCircle size={10} className="text-[#ff0040]" />
                        <span className="text-[#ff0040] font-bold">TAMPERED</span>
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 text-[#00ff4140]">
                    {new Date(check.checkedAt).toLocaleTimeString('en-US', { hour12: false })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {checks.length === 0 && (
          <div className="text-center py-8 text-[#00ff4130] font-['Share_Tech_Mono'] text-[11px]">
            Waiting for first integrity scan…
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div
          className="rounded p-1.5 text-center"
          style={{ background: '#00ff4108', border: '1px solid #00ff4120' }}
        >
          <div className="font-['Orbitron'] text-sm font-bold text-[#00ff41]">
            {checks.filter(c => c.match).length}
          </div>
          <div className="text-[9px] font-['Rajdhani'] font-semibold tracking-wider text-[#00ff4160]">
            INTACT
          </div>
        </div>
        <div
          className="rounded p-1.5 text-center"
          style={{ background: '#ff004008', border: '1px solid #ff004020' }}
        >
          <div className="font-['Orbitron'] text-sm font-bold text-[#ff0040]">
            {checks.filter(c => !c.match).length}
          </div>
          <div className="text-[9px] font-['Rajdhani'] font-semibold tracking-wider text-[#ff004060]">
            TAMPERED
          </div>
        </div>
      </div>
    </div>
  );
}
