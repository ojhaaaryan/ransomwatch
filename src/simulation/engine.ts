// ============================================================
// simulation/engine.ts — Ransomware simulation state machine
// Drives all four phases: Recon → KeyGen → Encrypt → Impact
// ============================================================

import type {
  SimulatorState, FileStats, Alert, CanaryFile,
  LogEntry, Phase, ThreatLevel
} from '../types';

// ── Seed data ────────────────────────────────────────────────
export const VAULT_FILES: string[] = [
  // Finance
  'test_vault/finance/Q1_Revenue_Report_2024.xlsx',
  'test_vault/finance/Q2_Revenue_Report_2024.xlsx',
  'test_vault/finance/Q3_Revenue_Report_2024.xlsx',
  'test_vault/finance/Annual_Budget_2024.xlsx',
  'test_vault/finance/Payroll_March_2024.xlsx',
  'test_vault/finance/Invoice_INV-2024-0091.pdf',
  'test_vault/finance/Invoice_INV-2024-0092.pdf',
  'test_vault/finance/Invoice_INV-2024-0093.pdf',
  'test_vault/finance/Tax_Filings_FY2023.pdf',
  'test_vault/finance/Bank_Statements_Jan2024.pdf',
  // HR
  'test_vault/hr/Employee_Records_2024.xlsx',
  'test_vault/hr/Salary_Structure_Confidential.docx',
  'test_vault/hr/Recruitment_Pipeline_Q1.docx',
  'test_vault/hr/Performance_Reviews_2023.docx',
  'test_vault/hr/NDA_Template_v3.docx',
  'test_vault/hr/Org_Chart_2024.pdf',
  // Engineering
  'test_vault/engineering/Architecture_Diagram_v5.pdf',
  'test_vault/engineering/API_Spec_Internal_v2.docx',
  'test_vault/engineering/DB_Schema_Production.sql',
  'test_vault/engineering/Deployment_Runbook.docx',
  'test_vault/engineering/Source_Backup_2024-03.bak',
  'test_vault/engineering/SSL_Certs_Backup.bak',
  // Legal
  'test_vault/legal/Client_Contract_Acme_Corp.pdf',
  'test_vault/legal/Client_Contract_GlobalTech.pdf',
  'test_vault/legal/IP_Assignment_Agreement.pdf',
  'test_vault/legal/Vendor_SLA_CloudProvider.docx',
  'test_vault/legal/Litigation_Notes_2023.docx',
  // Operations
  'test_vault/ops/Incident_Response_Playbook.docx',
  'test_vault/ops/Network_Topology_Map.pdf',
  'test_vault/ops/Asset_Inventory_Q1.xlsx',
  'test_vault/ops/Patch_Schedule_2024.xlsx',
  'test_vault/ops/Backup_Manifest.db',
  'test_vault/ops/SIEM_Config_Export.db',
  // Media
  'test_vault/media/Product_Launch_Photo_001.jpg',
  'test_vault/media/Product_Launch_Photo_002.jpg',
  'test_vault/media/Executive_Headshots.zip',
  'test_vault/media/Brand_Assets_2024.zip',
];

export const CANARY_FILES: CanaryFile[] = [
  {
    id: 'cnry-001',
    path: 'test_vault/finance/.canary_2024_q4_forecast.xlsx',
    extension: '.xlsx',
    inode: 2490881,
    sha256: 'a3f8e2d1c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0',
    placedAt: '2024-03-15T08:00:00Z',
    triggered: false,
  },
  {
    id: 'cnry-002',
    path: 'test_vault/hr/.canary_employee_ssn_backup.docx',
    extension: '.docx',
    inode: 2490882,
    sha256: 'b4f9e3d2c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1',
    placedAt: '2024-03-15T08:01:00Z',
    triggered: false,
  },
  {
    id: 'cnry-003',
    path: 'test_vault/ops/.canary_db_master_backup.db',
    extension: '.db',
    inode: 2490883,
    sha256: 'c5f0e4d3c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2',
    placedAt: '2024-03-15T08:02:00Z',
    triggered: false,
  },
  {
    id: 'cnry-004',
    path: 'test_vault/engineering/.canary_source_master.bak',
    extension: '.bak',
    inode: 2490884,
    sha256: 'd6f1e5d4c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3',
    placedAt: '2024-03-15T08:03:00Z',
    triggered: false,
  },
  {
    id: 'cnry-005',
    path: 'test_vault/legal/.canary_litigation_evidence.pdf',
    extension: '.pdf',
    inode: 2490885,
    sha256: 'e7f2e6d5c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4',
    placedAt: '2024-03-15T08:04:00Z',
    triggered: false,
  },
];

// ── Helper utilities ──────────────────────────────────────────
export function randomHex(len: number): string {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

export function randomPid(): number {
  return 10000 + Math.floor(Math.random() * 55000);
}

export function randomLatency(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nowDisplay(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export function severity(encrypted: number, total: number): ThreatLevel {
  const ratio = encrypted / total;
  if (ratio < 0.05) return 'MEDIUM';
  if (ratio < 0.20) return 'HIGH';
  return 'CRITICAL';
}

// ── Phase label map ───────────────────────────────────────────
export const PHASE_LABELS: Record<Phase, string> = {
  0: 'IDLE',
  1: 'PHASE 1 — RECONNAISSANCE',
  2: 'PHASE 2 — KEY GENERATION',
  3: 'PHASE 3 — ENCRYPTION',
  4: 'PHASE 4 — IMPACT',
};

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  0: 'System armed. Canary files placed. Awaiting adversary activity.',
  1: 'Adversary walking directory tree. Building target file list. Fingerprinting extensions.',
  2: 'Generating AES-256 session key. Simulating RSA-2048 C2 key exchange. Wrapping key material.',
  3: 'AES-256-CBC encrypting target files. Writing .locked extensions. Dropping per-file IV sidecars.',
  4: 'Dropping RANSOM_NOTE.txt. Simulating VSS shadow deletion. Canary files touched — DEFENDER ACTIVATED.',
};

// ── Process names (realistic) ─────────────────────────────────
const PROC_NAMES = [
  'python3', 'svchost.exe', 'explorer.exe', 'cmd.exe',
  'powershell.exe', 'conhost.exe', 'wscript.exe', 'mshta.exe',
];

// ── Log message templates ─────────────────────────────────────
export function buildLogEntry(
  level: LogEntry['level'],
  source: string,
  message: string,
): LogEntry {
  return {
    id: randomHex(8),
    timestamp: nowIso(),
    level,
    source,
    message,
  };
}

// ── Initial state factories ───────────────────────────────────
export function initSimulatorState(): SimulatorState {
  return {
    phase: 0,
    phaseLabel: PHASE_LABELS[0],
    speed: 'normal',
    startedAt: null,
    targetFiles: [],
    encryptedFiles: [],
    currentFile: null,
    aesKey: '',
    rsaThumb: '',
    c2Address: '',
    progress: 0,
    isRunning: false,
  };
}

export function initFileStats(): FileStats {
  return {
    total: VAULT_FILES.length,
    encrypted: 0,
    saved: VAULT_FILES.length,
    canariesTriggered: 0,
    keysGenerated: 0,
    vssShadowDeleted: false,
    ransomNoteDropped: false,
  };
}

// ── Alert builder ─────────────────────────────────────────────
export function buildAlert(
  canary: CanaryFile,
  encrypted: number,
  total: number,
  eventType: Alert['eventType'] = 'IN_MODIFY',
): Alert {
  const pid = randomPid();
  return {
    id: randomHex(12),
    timestamp: nowIso(),
    canaryPath: canary.path,
    canaryExt: canary.extension,
    offendingPid: pid,
    processName: PROC_NAMES[Math.floor(Math.random() * PROC_NAMES.length)],
    eventType,
    detectionLatencyMs: randomLatency(120, 1850),
    filesEncrypted: encrypted,
    filesSaved: total - encrypted,
    processKilled: true,
    severity: severity(encrypted, total),
  };
}

// ── Speed delay map (ms) ──────────────────────────────────────
export const SPEED_DELAY: Record<SimulatorState['speed'], number> = {
  fast: 80,
  normal: 350,
  slow: 900,
};
