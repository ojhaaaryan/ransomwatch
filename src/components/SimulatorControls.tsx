// ============================================================
// SimulatorControls.tsx — Attack simulation control panel
// ============================================================
import { Play, Square, RotateCcw, ChevronRight } from 'lucide-react';
import type { SimulatorState, Phase } from '../types';
import { PHASE_LABELS, PHASE_DESCRIPTIONS, SPEED_DELAY } from '../simulation/engine';

interface Props {
  sim: SimulatorState;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onSpeedChange: (s: SimulatorState['speed']) => void;
}

const PHASES: Phase[] = [1, 2, 3, 4];

const PHASE_COLORS: Record<Phase, string> = {
  0: '#444',
  1: '#00d4ff',
  2: '#9b59b6',
  3: '#ff4400',
  4: '#ff0040',
};

export default function SimulatorControls({ sim, onStart, onStop, onReset, onSpeedChange }: Props) {
  return (
    <div className="cyber-card rounded p-4 h-full flex flex-col" style={{ borderColor: '#ff004030' }}>
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest"
          style={{ color: '#ff4400', textShadow: '0 0 8px #ff440080' }}
        >
          ◈ ATTACK SIMULATOR
        </h3>
        <span
          className="text-[9px] font-['Share_Tech_Mono'] px-2 py-0.5 rounded tracking-wider"
          style={{ border: '1px solid #ff440040', color: '#ff4400', background: '#ff440010' }}
        >
          SANDBOXED
        </span>
      </div>

      {/* Phase timeline */}
      <div className="mb-4">
        <div className="flex items-center gap-0 mb-2">
          {PHASES.map((p, i) => {
            const isComplete = sim.phase > p;
            const isActive   = sim.phase === p;
            const color      = PHASE_COLORS[p];

            return (
              <div key={p} className="flex items-center flex-1">
                {/* Phase node */}
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-['Orbitron'] font-bold transition-all duration-500"
                    style={{
                      background: isComplete ? `${color}30` : isActive ? `${color}20` : '#00ff4108',
                      border: `2px solid ${isComplete || isActive ? color : '#00ff4120'}`,
                      color: isComplete || isActive ? color : '#00ff4130',
                      boxShadow: isActive ? `0 0 15px ${color}60` : 'none',
                    }}
                  >
                    {isComplete ? '✓' : p}
                  </div>
                  <span
                    className="text-[8px] font-['Rajdhani'] font-semibold tracking-wider mt-1 text-center"
                    style={{ color: isActive ? color : '#00ff4140', maxWidth: 48 }}
                  >
                    {['RECON', 'KEYGEN', 'CRYPT', 'IMPACT'][i]}
                  </span>
                </div>
                {/* Connector */}
                {i < 3 && (
                  <div
                    className="h-0.5 w-full transition-all duration-500"
                    style={{
                      background: isComplete
                        ? `linear-gradient(90deg, ${color}, ${PHASE_COLORS[PHASES[i+1]]})`
                        : '#00ff4115',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current phase info */}
      <div
        className="rounded p-3 mb-4 flex-1"
        style={{ background: '#00000040', border: '1px solid #00ff4115' }}
      >
        <div
          className="font-['Orbitron'] text-xs font-bold mb-2 tracking-wider"
          style={{ color: PHASE_COLORS[sim.phase] ?? '#00ff41' }}
        >
          {PHASE_LABELS[sim.phase]}
        </div>
        <p className="text-[11px] font-['Share_Tech_Mono'] text-[#00ff4170] leading-relaxed">
          {PHASE_DESCRIPTIONS[sim.phase]}
        </p>

        {/* Current file being encrypted */}
        {sim.currentFile && (
          <div className="mt-2 flex items-center gap-1">
            <ChevronRight size={10} className="text-[#ff4400]" />
            <span
              className="text-[10px] font-['Share_Tech_Mono'] text-[#ff4400] truncate"
              title={sim.currentFile}
            >
              {sim.currentFile.split('/').pop()}
            </span>
          </div>
        )}

        {/* Key material */}
        {sim.aesKey && (
          <div className="mt-2 space-y-1">
            <KeyLine label="AES-256 KEY" value={sim.aesKey} color="#9b59b6" />
            {sim.rsaThumb && <KeyLine label="RSA THUMB" value={sim.rsaThumb} color="#00d4ff" />}
            {sim.c2Address && <KeyLine label="C2 ADDR" value={sim.c2Address} color="#ffaa00" />}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] font-['Share_Tech_Mono'] mb-1">
          <span className="text-[#ff4400]">ENCRYPTION PROGRESS</span>
          <span className="text-[#ff4400]">{Math.round(sim.progress)}%</span>
        </div>
        <div className="cyber-progress">
          <div
            className="cyber-progress-bar"
            style={{
              width: `${sim.progress}%`,
              background: sim.progress < 50
                ? 'linear-gradient(90deg, #ffaa00, #ff4400)'
                : 'linear-gradient(90deg, #ff4400, #ff0040)',
            }}
          />
        </div>
      </div>

      {/* Speed selector */}
      <div className="mb-4">
        <div className="text-[10px] font-['Rajdhani'] font-semibold tracking-widest text-[#00ff4160] mb-2 uppercase">
          Simulation Speed
        </div>
        <div className="flex gap-2">
          {(['fast', 'normal', 'slow'] as const).map(sp => (
            <button
              key={sp}
              onClick={() => !sim.isRunning && onSpeedChange(sp)}
              disabled={sim.isRunning}
              className="flex-1 py-1.5 rounded text-[11px] font-['Rajdhani'] font-semibold tracking-wider uppercase transition-all"
              style={{
                border: `1px solid ${sim.speed === sp ? '#ff440060' : '#00ff4120'}`,
                color: sim.speed === sp ? '#ff4400' : '#00ff4140',
                background: sim.speed === sp ? '#ff440015' : 'transparent',
                cursor: sim.isRunning ? 'not-allowed' : 'pointer',
              }}
            >
              {sp === 'fast' ? '⚡ Fast' : sp === 'normal' ? '▶ Normal' : '🐢 Slow'}
              <div className="text-[8px] opacity-60">
                {SPEED_DELAY[sp]}ms
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex gap-2">
        {!sim.isRunning ? (
          <>
            <button
              onClick={onStart}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded font-['Rajdhani'] font-bold text-sm tracking-widest uppercase transition-all"
              style={{
                background: 'linear-gradient(135deg, #ff040020, #ff004015)',
                border: '1px solid #ff004060',
                color: '#ff0040',
                boxShadow: '0 0 15px #ff004020',
              }}
            >
              <Play size={14} /> LAUNCH ATTACK
            </button>
            <button
              onClick={onReset}
              className="px-3 py-2.5 rounded transition-all"
              style={{ border: '1px solid #00ff4120', color: '#00ff4160' }}
              title="Reset simulation"
            >
              <RotateCcw size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={onStop}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded font-['Rajdhani'] font-bold text-sm tracking-widest uppercase"
            style={{
              background: '#ff004015',
              border: '1px solid #ff004060',
              color: '#ff0040',
            }}
          >
            <Square size={14} /> ABORT
          </button>
        )}
      </div>

      {/* Warning */}
      <div
        className="mt-3 text-center text-[9px] font-['Share_Tech_Mono'] tracking-wider"
        style={{ color: '#ff000040' }}
      >
        ⚠ SANDBOXED — OPERATES ONLY WITHIN test_vault/
      </div>
    </div>
  );
}

function KeyLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-['Rajdhani'] font-semibold tracking-wider" style={{ color, opacity: 0.6, minWidth: 64 }}>
        {label}:
      </span>
      <span className="font-['Share_Tech_Mono'] text-[9px] truncate" style={{ color, opacity: 0.8 }}>
        {value}
      </span>
    </div>
  );
}
