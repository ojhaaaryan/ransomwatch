// ============================================================
// App.tsx — RansomWatch SOC Dashboard
// Main orchestrator: simulation state machine + all panels
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Activity, FileText, Code, Network, Eye,
  BookOpen, BarChart3, AlertTriangle, Terminal,
} from 'lucide-react';

import MatrixRain from './components/MatrixRain';
import Header     from './components/Header';
import StatCard   from './components/StatCard';
import AlertFeed  from './components/AlertFeed';
import SimulatorControls from './components/SimulatorControls';
import LiveChart  from './components/LiveChart';
import CanaryGrid from './components/CanaryGrid';
import TerminalLog from './components/TerminalLog';
import MitrePanel  from './components/MitrePanel';
import NetworkMap  from './components/NetworkMap';
import ThreatRadar from './components/ThreatRadar';
import IntegrityTable from './components/IntegrityTable';
import CodeViewer  from './components/CodeViewer';
import FileTreeViewer from './components/FileTreeViewer';
import ReadmeViewer   from './components/ReadmeViewer';

import {
  initSimulatorState, initFileStats,
  CANARY_FILES, VAULT_FILES,
  PHASE_LABELS, SPEED_DELAY,
  buildAlert, buildLogEntry,
  randomHex, nowIso, nowDisplay,
} from './simulation/engine';

import type {
  SimulatorState, FileStats, Alert, CanaryFile,
  LogEntry, IntegrityCheck, SystemStatus, ThreatLevel, Phase,
} from './types';

// ── Tab definitions ───────────────────────────────────────────
type MainTab = 'dashboard' | 'attack' | 'files' | 'code' | 'network' | 'docs';

const MAIN_TABS: { id: MainTab; label: string; icon: typeof Shield }[] = [
  { id: 'dashboard', label: 'SOC DASHBOARD', icon: BarChart3   },
  { id: 'attack',    label: 'ATTACK SIM',    icon: AlertTriangle},
  { id: 'files',     label: 'FILE VAULT',    icon: FileText     },
  { id: 'code',      label: 'SOURCE CODE',   icon: Code         },
  { id: 'network',   label: 'NETWORK MAP',   icon: Network      },
  { id: 'docs',      label: 'DOCS & README', icon: BookOpen     },
];

// ── Compute threat level ──────────────────────────────────────
function computeThreatLevel(stats: FileStats, alerts: Alert[]): ThreatLevel {
  if (alerts.some(a => a.severity === 'CRITICAL'))   return 'CRITICAL';
  if (stats.encrypted > stats.total * 0.15)          return 'CRITICAL';
  if (stats.canariesTriggered > 0)                   return 'HIGH';
  if (stats.encrypted > 0)                           return 'MEDIUM';
  return 'LOW';
}

// ── System status ─────────────────────────────────────────────
function computeStatus(sim: SimulatorState, alerts: Alert[]): SystemStatus {
  if (!sim.isRunning && alerts.length === 0) return 'ARMED';
  if (sim.isRunning && alerts.length === 0)  return 'TRIGGERED';
  if (alerts.length > 0 && !sim.isRunning)   return 'CONTAINED';
  if (alerts.length > 0 && sim.isRunning)    return 'TRIGGERED';
  return 'ARMED';
}

export default function App() {
  // ── Core state ────────────────────────────────────────────
  const [mainTab, setMainTab]           = useState<MainTab>('dashboard');
  const [sim, setSim]                   = useState<SimulatorState>(initSimulatorState());
  const [stats, setStats]               = useState<FileStats>(initFileStats());
  const [alerts, setAlerts]             = useState<Alert[]>([]);
  const [canaries, setCanaries]         = useState<CanaryFile[]>(CANARY_FILES);
  const [logs, setLogs]                 = useState<LogEntry[]>([]);
  const [integrity, setIntegrity]       = useState<IntegrityCheck[]>([]);
  const [nextIntegrity, setNextIntegrity] = useState(30);
  const [chartHistory, setChartHistory] = useState<
    Array<{ time: string; encrypted: number; saved: number }>
  >([]);

  // ── Simulation refs ───────────────────────────────────────
  const simRef   = useRef<SimulatorState>(sim);
  const statsRef = useRef<FileStats>(stats);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  simRef.current   = sim;
  statsRef.current = stats;

  // ── Derived state ─────────────────────────────────────────
  const threatLevel  = computeThreatLevel(stats, alerts);
  const systemStatus = computeStatus(sim, alerts);

  // ── Log helper ────────────────────────────────────────────
  const addLog = useCallback((
    level: LogEntry['level'],
    source: string,
    message: string,
  ) => {
    setLogs(prev => [...prev, buildLogEntry(level, source, message)]);
  }, []);

  // ── Chart history updater (every 2s) ──────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setChartHistory(h => [
        ...h.slice(-20),
        {
          time:      nowDisplay(),
          encrypted: statsRef.current.encrypted,
          saved:     statsRef.current.saved,
        },
      ]);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // ── Integrity check cycle (every 30s) ─────────────────────
  useEffect(() => {
    let countdown = 30;
    const tick = setInterval(() => {
      countdown--;
      setNextIntegrity(countdown);
      if (countdown <= 0) {
        countdown = 30;
        runIntegrityCheck();
      }
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canaries]);

  const runIntegrityCheck = useCallback(() => {
    addLog('INFO', 'INTEGRITY', 'Running periodic SHA-256 integrity check on all canary files…');
    const checks: IntegrityCheck[] = canaries.map(c => {
      const tampered = c.triggered;
      const actualHash = tampered
        ? randomHex(64)   // Simulate changed hash
        : c.sha256;
      return {
        file:      c.path,
        expected:  c.sha256,
        actual:    actualHash,
        match:     !tampered,
        checkedAt: nowIso(),
      };
    });
    setIntegrity(checks);

    const tampered = checks.filter(c => !c.match);
    if (tampered.length > 0) {
      addLog('CRITICAL', 'INTEGRITY', `Hash mismatch detected on ${tampered.length} canary file(s)! Possible LD_PRELOAD bypass.`);
    } else {
      addLog('SUCCESS', 'INTEGRITY', `All ${checks.length} canary files passed integrity check.`);
    }
  }, [canaries, addLog]);

  // ── Boot sequence ─────────────────────────────────────────
  useEffect(() => {
    const bootLogs: Array<[LogEntry['level'], string, string]> = [
      ['INFO',    'SYSTEM',    'RansomWatch v2.4.1 initialising…'],
      ['INFO',    'SYSTEM',    'Loading canary_manifest.json…'],
      ['SUCCESS', 'SYSTEM',    `Loaded ${CANARY_FILES.length} canary file definitions`],
      ['INFO',    'DEFENDER',  'Starting inotify watchdog on canary paths…'],
      ['SUCCESS', 'DEFENDER',  'watchdog.Observer started — monitoring 5 paths'],
      ['INFO',    'INTEGRITY', 'SHA-256 integrity baseline loaded from manifest'],
      ['INFO',    'DASHBOARD', 'Flask SOC dashboard starting on :5000'],
      ['SUCCESS', 'DASHBOARD', 'Dashboard live at http://localhost:5000'],
      ['SUCCESS', 'SYSTEM',    'All systems ARMED — awaiting adversary activity'],
    ];

    bootLogs.forEach(([level, src, msg], i) => {
      setTimeout(() => addLog(level as LogEntry['level'], src, msg), i * 200);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Simulation state machine ──────────────────────────────
  const runPhase = useCallback(async (phase: Phase) => {
    const delay = (ms: number) => new Promise<void>(resolve => {
      timerRef.current = setTimeout(resolve, ms);
    });
    const speed = simRef.current.speed;
    const d = SPEED_DELAY[speed];

    setSim(s => ({ ...s, phase, phaseLabel: PHASE_LABELS[phase] }));

    // ── PHASE 1: RECONNAISSANCE ───────────────────────────
    if (phase === 1) {
      addLog('WARN', 'SIMULATOR', 'Phase 1 — RECONNAISSANCE initiated');
      addLog('INFO', 'SIMULATOR', `Walking directory tree: ${VAULT_FILES.length} target files discovered`);
      addLog('INFO', 'SIMULATOR', 'Extension fingerprinting: .xlsx(11) .docx(9) .pdf(9) .db(2) .bak(3) .sql(1)');
      addLog('WARN', 'SIMULATOR', 'Building target file list — excluding system directories');
      setSim(s => ({ ...s, targetFiles: VAULT_FILES }));
      await delay(d * 3);
    }

    // ── PHASE 2: KEY GENERATION ──────────────────────────
    if (phase === 2) {
      addLog('WARN', 'SIMULATOR', 'Phase 2 — KEY GENERATION initiated');
      const aesKey   = randomHex(64);
      const rsaThumb = randomHex(40);
      const c2Addr   = `${Math.floor(Math.random()*254+1)}.${Math.floor(Math.random()*254+1)}.${Math.floor(Math.random()*254+1)}.${Math.floor(Math.random()*99+1)}:${4444 + Math.floor(Math.random()*100)}`;
      addLog('INFO',    'SIMULATOR', `AES-256 session key generated: ${aesKey.slice(0,16)}…`);
      addLog('INFO',    'SIMULATOR', `Connecting to C2 server: ${c2Addr}`);
      await delay(d);
      addLog('SUCCESS', 'SIMULATOR', `RSA-2048 public key received. Thumb: ${rsaThumb.slice(0,16)}…`);
      addLog('INFO',    'SIMULATOR', 'AES session key wrapped with RSA-2048 pubkey');
      setSim(s => ({ ...s, aesKey: aesKey.slice(0,32)+'…', rsaThumb: rsaThumb.slice(0,20)+'…', c2Address: c2Addr }));
      setStats(s => ({ ...s, keysGenerated: 1 }));
      await delay(d * 2);
    }

    // ── PHASE 3: ENCRYPTION ──────────────────────────────
    if (phase === 3) {
      addLog('ERROR', 'SIMULATOR', 'Phase 3 — ENCRYPTION initiated. AES-256-CBC encrypting targets…');

      for (let i = 0; i < VAULT_FILES.length; i++) {
        if (!simRef.current.isRunning) break;

        const file = VAULT_FILES[i];
        const progress = ((i + 1) / VAULT_FILES.length) * 100;
        const iv = randomHex(32);

        setSim(s => ({
          ...s,
          currentFile: file,
          encryptedFiles: [...s.encryptedFiles, file],
          progress,
        }));
        setStats(s => ({
          ...s,
          encrypted: i + 1,
          saved: VAULT_FILES.length - (i + 1),
        }));

        addLog('ERROR', 'SIMULATOR', `ENCRYPT: ${file.split('/').pop()} → .locked [IV:${iv.slice(0,8)}]`);
        await delay(d);
      }
      setSim(s => ({ ...s, currentFile: null, progress: 100 }));
    }

    // ── PHASE 4: IMPACT ──────────────────────────────────
    if (phase === 4) {
      addLog('CRITICAL', 'SIMULATOR', 'Phase 4 — IMPACT. Dropping ransom note…');
      addLog('CRITICAL', 'SIMULATOR', 'Simulating: vssadmin delete shadows /all /quiet');
      addLog('CRITICAL', 'SIMULATOR', 'RANSOM_NOTE.txt dropped in all directories');
      setStats(s => ({ ...s, vssShadowDeleted: true, ransomNoteDropped: true }));

      // Touch canary files — this triggers the defender
      addLog('CRITICAL', 'SIMULATOR', 'Touching canary files — DEFENDER SHOULD TRIGGER NOW');
      await delay(d);

      // Trigger defender for each canary
      const triggeredAt = nowIso();
      const updatedCanaries = canaries.map(c => ({
        ...c, triggered: true, triggeredAt,
      }));
      setCanaries(updatedCanaries);

      for (const canary of CANARY_FILES) {
        const enc = statsRef.current.encrypted;
        const alert = buildAlert(canary, enc, VAULT_FILES.length, 'IN_MODIFY');

        addLog('CRITICAL', 'DEFENDER', `⚡ CANARY TRIGGERED: ${canary.path.split('/').pop()}`);
        addLog('CRITICAL', 'DEFENDER', `Offending PID: ${alert.offendingPid} (${alert.processName})`);
        addLog('SUCCESS',  'DEFENDER', `SIGKILL sent to PID ${alert.offendingPid} — process terminated`);
        addLog('SUCCESS',  'DEFENDER', `Detection latency: ${alert.detectionLatencyMs}ms`);
        addLog('INFO',     'DEFENDER', `Alert written to alerts.json [ID: ${alert.id}]`);

        setAlerts(prev => [...prev, alert]);
        setStats(s => ({ ...s, canariesTriggered: s.canariesTriggered + 1 }));

        await delay(d * 0.5);
      }

      // Stop simulation after impact
      setSim(s => ({ ...s, isRunning: false }));
      addLog('SUCCESS', 'SYSTEM', '✓ Ransomware process killed. System CONTAINED.');
      addLog('INFO',    'SYSTEM', `Files saved: ${statsRef.current.saved} / ${VAULT_FILES.length}`);
    }
  }, [canaries, addLog]);

  // ── Start simulation ──────────────────────────────────────
  const handleStart = useCallback(async () => {
    // Reset state
    setSim(s => ({
      ...initSimulatorState(),
      speed: s.speed,
      isRunning: true,
      startedAt: nowIso(),
    }));
    setStats(initFileStats());
    setAlerts([]);
    setCanaries(CANARY_FILES);

    addLog('WARN', 'SYSTEM', '══════════════════════════════════════════════════');
    addLog('WARN', 'SYSTEM', 'RANSOMWARE SIMULATION INITIATED — SANDBOX ACTIVE');
    addLog('WARN', 'SYSTEM', '══════════════════════════════════════════════════');

    for (const phase of [1, 2, 3, 4] as Phase[]) {
      if (!simRef.current.isRunning && phase > 1) break;
      await runPhase(phase);
    }
  }, [addLog, runPhase]);

  // ── Stop simulation ───────────────────────────────────────
  const handleStop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSim(s => ({ ...s, isRunning: false }));
    addLog('WARN', 'SYSTEM', 'Simulation ABORTED by operator');
  }, [addLog]);

  // ── Reset simulation ──────────────────────────────────────
  const handleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSim(initSimulatorState());
    setStats(initFileStats());
    setAlerts([]);
    setCanaries(CANARY_FILES);
    setIntegrity([]);
    setLogs([]);
    addLog('INFO', 'SYSTEM', 'System reset. Re-arming canary trap…');
    addLog('SUCCESS', 'SYSTEM', 'All systems ARMED.');
  }, [addLog]);

  const handleSpeedChange = (speed: SimulatorState['speed']) => {
    setSim(s => ({ ...s, speed }));
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      className="relative min-h-screen w-full grid-lines overflow-hidden"
      style={{ background: '#030a03', color: '#00ff41' }}
    >
      <MatrixRain />

      {/* Main layout */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <Header status={systemStatus} threatLevel={threatLevel} alertCount={alerts.length} />

        {/* Tab bar */}
        <div
          className="flex items-center gap-0 px-4 overflow-x-auto"
          style={{ background: '#020802', borderBottom: '1px solid #00ff4120' }}
        >
          {MAIN_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = mainTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                className="flex items-center gap-2 px-4 py-3 text-[11px] font-['Rajdhani'] font-semibold tracking-widest uppercase transition-all shrink-0"
                style={{
                  color:       isActive ? '#00ff41' : '#00ff4140',
                  borderBottom:`2px solid ${isActive ? '#00ff41' : 'transparent'}`,
                  background:  isActive ? '#00ff4108' : 'transparent',
                  textShadow:  isActive ? '0 0 8px #00ff41' : 'none',
                }}
              >
                <Icon size={13} />
                {tab.label}
                {tab.id === 'attack' && sim.isRunning && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff0040] pulse-red ml-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={mainTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-hidden"
            >
              {/* ── SOC DASHBOARD ─────────────────────────── */}
              {mainTab === 'dashboard' && (
                <div className="h-full p-3 grid grid-rows-[auto_1fr_1fr] gap-3">
                  {/* Stat cards row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    <StatCard
                      label="Total Files"    value={stats.total}
                      icon={<FileText size={16} />} color="blue"
                      sub="in test_vault/"
                    />
                    <StatCard
                      label="Files Saved"   value={stats.saved}
                      icon={<Shield size={16} />} color="green"
                      sub="protected"
                    />
                    <StatCard
                      label="Encrypted"     value={stats.encrypted}
                      icon={<AlertTriangle size={16} />} color="red"
                      pulse={stats.encrypted > 0}
                      sub=".locked files"
                    />
                    <StatCard
                      label="Canaries Triggered" value={stats.canariesTriggered}
                      icon={<Eye size={16} />} color="amber"
                      sub={`of ${CANARY_FILES.length} traps`}
                    />
                    <StatCard
                      label="Alerts Raised" value={alerts.length}
                      icon={<Activity size={16} />} color={alerts.length > 0 ? 'red' : 'green'}
                      sub="SIGKILL sent"
                    />
                    <StatCard
                      label="Detection Time" 
                      value={alerts.length > 0 ? `${Math.min(...alerts.map(a => a.detectionLatencyMs))}ms` : '—'}
                      icon={<Terminal size={16} />} color="blue"
                      sub="fastest trigger"
                    />
                  </div>

                  {/* Middle row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0">
                    <div className="cyber-card rounded p-3 min-h-0 overflow-hidden glow-box-green">
                      <LiveChart stats={stats} history={chartHistory} />
                    </div>
                    <div className="cyber-card rounded p-3 min-h-0 overflow-hidden" style={{ borderColor: '#ffaa0030' }}>
                      <AlertFeed alerts={alerts} />
                    </div>
                    <div className="flex flex-col gap-3 min-h-0">
                      <div className="cyber-card rounded p-3 flex-1 min-h-0 overflow-hidden" style={{ borderColor: '#9b59b630' }}>
                        <ThreatRadar
                          level={threatLevel}
                          alertCount={alerts.length}
                          canariesTriggered={stats.canariesTriggered}
                        />
                      </div>
                      <div className="cyber-card rounded p-3 min-h-0 overflow-hidden" style={{ borderColor: '#00d4ff30' }}>
                        <MitrePanel currentPhase={sim.phase} />
                      </div>
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
                    <div className="cyber-card rounded p-3 min-h-0 overflow-hidden">
                      <TerminalLog entries={logs} />
                    </div>
                    <div className="cyber-card rounded p-3 min-h-0 overflow-hidden" style={{ borderColor: '#ffaa0030' }}>
                      <IntegrityTable checks={integrity} nextCheckIn={nextIntegrity} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── ATTACK SIMULATOR ──────────────────────── */}
              {mainTab === 'attack' && (
                <div className="h-full p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="cyber-card rounded p-3 min-h-0 overflow-hidden" style={{ borderColor: '#ff004030' }}>
                    <SimulatorControls
                      sim={sim}
                      onStart={handleStart}
                      onStop={handleStop}
                      onReset={handleReset}
                      onSpeedChange={handleSpeedChange}
                    />
                  </div>
                  <div className="cyber-card rounded p-3 min-h-0 overflow-hidden">
                    <TerminalLog entries={logs} />
                  </div>
                  <div className="cyber-card rounded p-3 min-h-0 overflow-hidden" style={{ borderColor: '#ffaa0030' }}>
                    <AlertFeed alerts={alerts} />
                  </div>
                </div>
              )}

              {/* ── FILE VAULT ────────────────────────────── */}
              {mainTab === 'files' && (
                <div className="h-full p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="cyber-card rounded p-3 min-h-0 overflow-hidden lg:col-span-2"
                    style={{ borderColor: '#ffaa0030' }}>
                    <FileTreeViewer sim={sim} />
                  </div>
                  <div className="cyber-card rounded p-3 min-h-0 overflow-hidden" style={{ borderColor: '#ffaa0030' }}>
                    <CanaryGrid canaries={canaries} />
                  </div>
                </div>
              )}

              {/* ── SOURCE CODE ───────────────────────────── */}
              {mainTab === 'code' && (
                <div className="h-full p-3">
                  <div className="cyber-card rounded p-3 h-full min-h-0 overflow-hidden" style={{ borderColor: '#00d4ff30' }}>
                    <CodeViewer />
                  </div>
                </div>
              )}

              {/* ── NETWORK MAP ───────────────────────────── */}
              {mainTab === 'network' && (
                <div className="h-full p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="cyber-card rounded p-3 min-h-0 overflow-hidden" style={{ borderColor: '#9b59b630' }}>
                    <NetworkMap sim={sim} />
                  </div>
                  <div className="cyber-card rounded p-3 min-h-0 overflow-hidden" style={{ borderColor: '#00d4ff30' }}>
                    <MitrePanel currentPhase={sim.phase} />
                  </div>
                </div>
              )}

              {/* ── DOCS & README ─────────────────────────── */}
              {mainTab === 'docs' && (
                <div className="h-full p-3">
                  <div className="cyber-card rounded p-3 h-full min-h-0 overflow-hidden">
                    <ReadmeViewer />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Status bar */}
        <div
          className="flex items-center justify-between px-4 py-1.5 text-[10px] font-['Share_Tech_Mono']"
          style={{
            background: '#020802',
            borderTop: '1px solid #00ff4115',
          }}
        >
          <div className="flex items-center gap-4">
            <span style={{ color: '#00ff4160' }}>
              RansomWatch v2.4.1 — MITRE T1486
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px]"
              style={{ background: '#00ff4110', color: '#00ff41', border: '1px solid #00ff4120' }}
            >
              SANDBOXED
            </span>
          </div>
          <div className="flex items-center gap-4">
            {sim.isRunning && (
              <span className="text-[#ff0040] pulse-red font-bold">
                ◉ ATTACK RUNNING — Phase {sim.phase}
              </span>
            )}
            <span style={{ color: '#00ff4140' }}>
              Amrita University Hackathon 2024 — Problem #24
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
