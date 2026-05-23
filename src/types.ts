// ============================================================
// types.ts — Shared TypeScript interfaces for RansomWatch
// ============================================================

export type SystemStatus = 'ARMED' | 'TRIGGERED' | 'CONTAINED' | 'IDLE';
export type ThreatLevel  = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Phase = 0 | 1 | 2 | 3 | 4;   // 0=idle, 1=recon, 2=keygen, 3=encrypt, 4=impact

export interface CanaryFile {
  id: string;
  path: string;
  extension: string;
  inode: number;
  sha256: string;
  placedAt: string;
  triggered: boolean;
  triggeredAt?: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  canaryPath: string;
  canaryExt: string;
  offendingPid: number;
  processName: string;
  eventType: 'IN_ACCESS' | 'IN_MODIFY' | 'IN_OPEN' | 'IN_DELETE' | 'HASH_CHANGE';
  detectionLatencyMs: number;
  filesEncrypted: number;
  filesSaved: number;
  processKilled: boolean;
  severity: ThreatLevel;
}

export interface FileStats {
  total: number;
  encrypted: number;
  saved: number;
  canariesTriggered: number;
  keysGenerated: number;
  vssShadowDeleted: boolean;
  ransomNoteDropped: boolean;
}

export interface SimulatorState {
  phase: Phase;
  phaseLabel: string;
  speed: 'fast' | 'normal' | 'slow';
  startedAt: string | null;
  targetFiles: string[];
  encryptedFiles: string[];
  currentFile: string | null;
  aesKey: string;
  rsaThumb: string;
  c2Address: string;
  progress: number;          // 0–100
  isRunning: boolean;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: 'attacker' | 'c2' | 'victim' | 'file' | 'defender';
  x: number;
  y: number;
  active: boolean;
  compromised: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'SUCCESS';
  source: string;
  message: string;
}

export interface MitreAttack {
  id: string;
  name: string;
  tactic: string;
  phase: string;
  active: boolean;
  mitigations: string[];
}

export interface IntegrityCheck {
  file: string;
  expected: string;
  actual: string;
  match: boolean;
  checkedAt: string;
}
