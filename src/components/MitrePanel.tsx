// ============================================================
// MitrePanel.tsx — MITRE ATT&CK T1486 technique visualiser
// ============================================================
import { ExternalLink, ChevronRight } from 'lucide-react';
import type { MitreAttack } from '../types';
import type { Phase } from '../types';

interface Props {
  currentPhase: Phase;
}

const TECHNIQUES: MitreAttack[] = [
  {
    id: 'T1566.001',
    name: 'Spearphishing Attachment',
    tactic: 'Initial Access',
    phase: 'PRE-ATTACK',
    active: false,
    mitigations: ['M1049 – Anti-virus', 'M1017 – User Training'],
  },
  {
    id: 'T1059.006',
    name: 'Python Script Execution',
    tactic: 'Execution',
    phase: 'RECON',
    active: false,
    mitigations: ['M1040 – Behavior Prevention', 'M1026 – Privileged Account Mgmt'],
  },
  {
    id: 'T1083',
    name: 'File & Directory Discovery',
    tactic: 'Discovery',
    phase: 'RECON',
    active: false,
    mitigations: ['M1018 – User Account Mgmt'],
  },
  {
    id: 'T1027',
    name: 'Obfuscated Files',
    tactic: 'Defence Evasion',
    phase: 'KEYGEN',
    active: false,
    mitigations: ['M1049 – Anti-virus'],
  },
  {
    id: 'T1486',
    name: 'Data Encrypted for Impact',
    tactic: 'Impact',
    phase: 'ENCRYPT',
    active: false,
    mitigations: ['M1053 – Data Backup', 'M1040 – Behavior Prevention on Endpoint'],
  },
  {
    id: 'T1490',
    name: 'Inhibit System Recovery',
    tactic: 'Impact',
    phase: 'IMPACT',
    active: false,
    mitigations: ['M1053 – Data Backup', 'M1028 – OS Configuration'],
  },
  {
    id: 'T1491',
    name: 'Defacement / Ransom Note',
    tactic: 'Impact',
    phase: 'IMPACT',
    active: false,
    mitigations: ['M1053 – Data Backup'],
  },
];

const PHASE_TO_TECHNIQUE_PHASE: Record<Phase, string> = {
  0: 'PRE-ATTACK',
  1: 'RECON',
  2: 'KEYGEN',
  3: 'ENCRYPT',
  4: 'IMPACT',
};

const TACTIC_COLORS: Record<string, string> = {
  'Initial Access':    '#ff4400',
  'Execution':         '#9b59b6',
  'Discovery':         '#00d4ff',
  'Defence Evasion':   '#ffaa00',
  'Impact':            '#ff0040',
};

export default function MitrePanel({ currentPhase }: Props) {
  const currentPhaseName = PHASE_TO_TECHNIQUE_PHASE[currentPhase];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#00d4ff]"
          style={{ textShadow: '0 0 8px #00d4ff80' }}
        >
          ◈ MITRE ATT&amp;CK CHAIN
        </h3>
        <div
          className="text-[10px] font-['Share_Tech_Mono'] px-2 py-0.5 rounded"
          style={{ background: '#00d4ff10', border: '1px solid #00d4ff30', color: '#00d4ff' }}
        >
          T1486 PRIMARY
        </div>
      </div>

      {/* Kill chain progress */}
      <div className="flex items-center mb-3 overflow-x-auto pb-1">
        {['PRE-ATTACK', 'RECON', 'KEYGEN', 'ENCRYPT', 'IMPACT'].map((stage, i) => {
          const isActive = stage === currentPhaseName;
          const isPast   = ['PRE-ATTACK', 'RECON', 'KEYGEN', 'ENCRYPT', 'IMPACT']
            .indexOf(currentPhaseName) > i;
          return (
            <div key={stage} className="flex items-center shrink-0">
              <div
                className="px-2 py-0.5 rounded text-[8px] font-['Orbitron'] font-bold tracking-wider transition-all"
                style={{
                  background: isActive ? '#ff004020' : isPast ? '#00ff4110' : '#00ff4105',
                  border:     `1px solid ${isActive ? '#ff004060' : isPast ? '#00ff4140' : '#00ff4115'}`,
                  color:      isActive ? '#ff0040' : isPast ? '#00ff41' : '#00ff4130',
                  boxShadow:  isActive ? '0 0 10px #ff004040' : 'none',
                }}
              >
                {stage}
              </div>
              {i < 4 && (
                <ChevronRight size={10} className="mx-1" style={{ color: isPast ? '#00ff4160' : '#00ff4120' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Technique list */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {TECHNIQUES.map((tech) => {
          const isActive = tech.phase === currentPhaseName;
          const tc = TACTIC_COLORS[tech.tactic] ?? '#00ff41';
          const isT1486 = tech.id === 'T1486';

          return (
            <div
              key={tech.id}
              className="rounded p-2.5 transition-all duration-500"
              style={{
                background: isActive
                  ? `${tc}12`
                  : isT1486
                  ? '#ff004008'
                  : '#00ff4105',
                border: `1px solid ${isActive ? tc + '60' : isT1486 ? '#ff004030' : '#00ff4115'}`,
                boxShadow: isActive ? `0 0 15px ${tc}20` : 'none',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {/* Technique ID */}
                  <span
                    className="font-['Share_Tech_Mono'] text-[10px] font-bold"
                    style={{ color: isActive ? tc : isT1486 ? '#ff0040' : '#00ff4180' }}
                  >
                    {tech.id}
                  </span>
                  {isT1486 && (
                    <span
                      className="text-[8px] font-['Orbitron'] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: '#ff004020', color: '#ff0040', border: '1px solid #ff004040' }}
                    >
                      PRIMARY
                    </span>
                  )}
                  {isActive && (
                    <span
                      className="text-[8px] font-['Orbitron'] font-bold px-1.5 py-0.5 rounded pulse-red"
                      style={{ background: `${tc}20`, color: tc, border: `1px solid ${tc}40` }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>
                {/* Tactic badge */}
                <span
                  className="text-[8px] font-['Rajdhani'] font-semibold tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: `${tc}15`, color: tc }}
                >
                  {tech.tactic.toUpperCase()}
                </span>
              </div>

              {/* Name */}
              <div
                className="text-[11px] font-['Rajdhani'] font-semibold mb-1.5"
                style={{ color: isActive ? tc : '#00ff4180' }}
              >
                {tech.name}
              </div>

              {/* Mitigations */}
              <div className="flex flex-wrap gap-1">
                {tech.mitigations.map(m => (
                  <span
                    key={m}
                    className="text-[8px] font-['Share_Tech_Mono'] px-1.5 py-0.5 rounded"
                    style={{ background: '#00ff4108', color: '#00ff4160', border: '1px solid #00ff4115' }}
                  >
                    {m.split(' – ')[0]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* MITRE link note */}
      <div className="mt-2 flex items-center gap-1">
        <ExternalLink size={9} className="text-[#00ff4140]" />
        <span className="text-[9px] font-['Share_Tech_Mono'] text-[#00ff4140]">
          attack.mitre.org/techniques/T1486
        </span>
      </div>
    </div>
  );
}
