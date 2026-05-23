// ============================================================
// ReadmeViewer.tsx — README & documentation viewer component
// ============================================================
import { useState } from 'react';
import { BookOpen, Terminal, GitBranch, Shield, AlertTriangle, Mic } from 'lucide-react';
import DemoScript from './DemoScript';

type DocTab = 'readme' | 'architecture' | 'setup' | 'threat' | 'commands' | 'bypass' | 'demo';

const TABS: { id: DocTab; label: string; icon: typeof BookOpen }[] = [
  { id: 'readme',       label: 'README',        icon: BookOpen     },
  { id: 'architecture', label: 'ARCHITECTURE',  icon: GitBranch    },
  { id: 'setup',        label: 'QUICK START',   icon: Terminal     },
  { id: 'commands',     label: 'COMMANDS',      icon: Terminal     },
  { id: 'threat',       label: 'THREAT MODEL',  icon: Shield       },
  { id: 'bypass',       label: 'BYPASSES',      icon: AlertTriangle},
  { id: 'demo',         label: 'DEMO SCRIPT',   icon: Mic          },
];

export default function ReadmeViewer() {
  const [tab, setTab] = useState<DocTab>('readme');

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div
        className="flex gap-0 overflow-x-auto mb-4"
        style={{ borderBottom: '1px solid #00ff4120' }}
      >
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-['Rajdhani'] font-semibold tracking-wider uppercase transition-all shrink-0"
              style={{
                color: isActive ? '#00ff41' : '#00ff4140',
                borderBottom: `2px solid ${isActive ? '#00ff41' : 'transparent'}`,
                background: isActive ? '#00ff4108' : 'transparent',
              }}
            >
              <Icon size={11} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'readme'       && <ReadmeContent />}
        {tab === 'architecture' && <ArchitectureContent />}
        {tab === 'setup'        && <SetupContent />}
        {tab === 'commands'     && <CommandsContent />}
        {tab === 'threat'       && <ThreatModelContent />}
        {tab === 'bypass'       && <BypassContent />}
        {tab === 'demo'         && <DemoScript />}
      </div>
    </div>
  );
}

// ── Individual content sections ───────────────────────────────

function ReadmeContent() {
  return (
    <div className="space-y-4 font-['Rajdhani']">
      <Section title="🛡 RansomWatch — Canary File Detection System">
        <p className="text-[#00ff4180] text-sm leading-relaxed">
          RansomWatch is a production-quality ransomware behaviour simulation and detection system built for
          the MITRE ATT&amp;CK T1486 threat (Data Encrypted for Impact). It combines offensive simulation
          (AES-256-CBC encryption, RSA-2048 key wrapping, VSS deletion) with defensive detection
          (inotify watchdog, SHA-256 integrity monitoring, PID identification and SIGKILL).
        </p>
      </Section>

      <Section title="📋 Problem Statement">
        <p className="text-[#00ff4180] text-sm">
          Hackathon Problem #24 — Amrita University Bengaluru
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[
            ['Track',       'Offensive + Defensive'],
            ['MITRE',       'T1486 – Data Encrypted for Impact'],
            ['Difficulty',  'Medium'],
            ['Platform',    'Ubuntu 24.04 / Arch Linux + Docker'],
          ].map(([k, v]) => (
            <div key={k} className="rounded p-2" style={{ background: '#00ff4108', border: '1px solid #00ff4115' }}>
              <div className="text-[9px] font-semibold tracking-wider text-[#00ff4150] uppercase">{k}</div>
              <div className="text-[11px] text-[#00ff41]">{v}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🏆 Judging Rubric Addressed">
        <div className="space-y-1.5">
          {[
            ['Technical Implementation (10)',   'AES-256-CBC, RSA-2048, inotify watchdog, SIGKILL, async Flask'],
            ['Security Depth (8)',              'T1486 alignment, C2 simulation, 5+ bypass techniques documented'],
            ['Architecture (6)',               'On-Premises/Hybrid ready, Docker Compose, shared volumes'],
            ['Communication (4)',              'Live SOC dashboard, real-time charts, terminal log'],
            ['Documentation (2)',              'Full README, THREAT_MODEL.md, inline comments, type hints'],
          ].map(([cat, detail]) => (
            <div key={cat} className="flex gap-2">
              <span className="text-[#00ff41] shrink-0">✓</span>
              <div>
                <span className="text-[11px] font-semibold text-[#00ff41]">{cat}:</span>
                <span className="text-[10px] text-[#00ff4170] ml-1">{detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ArchitectureContent() {
  const ascii = `
┌─────────────────────────────────────────────────────────────────────┐
│                        RANSOMWATCH ARCHITECTURE                      │
│                   MITRE ATT&CK T1486 – Simulation & Detection        │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │                      OFFENSIVE LAYER                          │
  │                                                              │
  │  canary_placer.py          ransomware_sim/simulator.py       │
  │  ┌──────────────┐          ┌───────────────────────────┐    │
  │  │ Creates:     │          │ Phase 1: RECON             │    │
  │  │ • 5 canaries │  ──────► │ Phase 2: KEY GENERATION   │    │
  │  │ • 30+ decoys │          │ Phase 3: AES-256-CBC CRYPT │    │
  │  │ • manifest   │          │ Phase 4: IMPACT / RANSOM   │    │
  │  └──────────────┘          └───────────────────────────┘    │
  └──────────────────────────────────────────────────────────────┘
                           │ filesystem events
                           ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                      DEFENSIVE LAYER                          │
  │                                                              │
  │  defender/canary_daemon.py                                   │
  │  ┌────────────────────────────────────────┐                 │
  │  │  watchdog (inotify)                    │                 │
  │  │  ┌──────────────────────────────────┐ │                 │
  │  │  │ IN_ACCESS / IN_MODIFY / IN_OPEN  │ │                 │
  │  │  │ IN_DELETE events on canary paths │ │                 │
  │  │  └──────────────┬───────────────────┘ │                 │
  │  │                 │                      │                 │
  │  │  ┌──────────────▼───────────────────┐ │                 │
  │  │  │  psutil → find offending PID      │ │                 │
  │  │  │  os.kill(pid, SIGKILL)            │ │                 │
  │  │  │  write_alert(alerts.json)         │ │                 │
  │  │  └──────────────────────────────────┘ │                 │
  │  └────────────────────────────────────────┘                 │
  │                                                              │
  │  defender/integrity_monitor.py (30s SHA-256 re-hash loop)   │
  └──────────────────────────────────────────────────────────────┘
                           │
                           ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                    DASHBOARD LAYER                            │
  │                                                              │
  │  dashboard/app.py (Flask)          Browser (React)           │
  │  ┌─────────────────────┐           ┌──────────────────┐     │
  │  │ GET /api/alerts     │ ◄──── 2s │ Alert Timeline   │     │
  │  │ GET /api/stats      │ ──────── │ Live Bar Chart   │     │
  │  │ GET /               │ poll     │ MITRE T1486 Map  │     │
  │  └─────────────────────┘           │ Threat Radar     │     │
  │         Port 5000                  └──────────────────┘     │
  └──────────────────────────────────────────────────────────────┘

  Shared State: test_vault/ + alerts.json + canary_manifest.json`;

  return (
    <div className="space-y-4">
      <div
        className="code-block text-[10px] text-[#00ff41] whitespace-pre overflow-x-auto"
        style={{ lineHeight: 1.6 }}
      >
        {ascii}
      </div>

      <Section title="Docker Architecture">
        <div className="grid grid-cols-2 gap-3 mt-2">
          {[
            {
              name: 'defender',
              color: '#00ff41',
              items: ['canary_daemon.py', 'integrity_monitor.py', 'SYS_PTRACE cap', 'PID: host namespace'],
            },
            {
              name: 'dashboard',
              color: '#00d4ff',
              items: ['Flask app.py', 'Port 5000:5000', 'Shared volumes', 'Auto-refresh 2s'],
            },
          ].map(svc => (
            <div
              key={svc.name}
              className="rounded p-3"
              style={{ background: `${svc.color}08`, border: `1px solid ${svc.color}30` }}
            >
              <div className="font-['Orbitron'] text-sm font-bold mb-2" style={{ color: svc.color }}>
                {svc.name} service
              </div>
              {svc.items.map(i => (
                <div key={i} className="text-[10px] font-['Share_Tech_Mono']" style={{ color: svc.color, opacity: 0.7 }}>
                  → {i}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function SetupContent() {
  const steps = [
    {
      step: '1. Clone Repository',
      cmd: 'git clone https://github.com/your-org/ransomwatch.git\ncd ransomwatch',
      note: 'Or download ZIP from hackathon submission portal',
    },
    {
      step: '2a. Miniconda Setup (Recommended)',
      cmd: 'conda create -n ransomwatch python=3.11 -y\nconda activate ransomwatch\nmake install',
      note: 'Creates isolated Python environment with all dependencies',
    },
    {
      step: '2b. Docker Setup (Production)',
      cmd: 'docker compose build\ndocker compose up -d',
      note: 'Runs defender + dashboard in containers with shared volumes',
    },
    {
      step: '3. Full Demo',
      cmd: 'make demo',
      note: 'Runs: setup → 3s pause → attack-slow → SOC dashboard at :5000',
    },
    {
      step: '4. Live Attack (Slow Mode)',
      cmd: 'make attack-slow',
      note: 'Best for demonstrations — 900ms between file encryptions',
    },
    {
      step: '5. Check Alerts',
      cmd: 'make status\n# or visit http://localhost:5000',
      note: 'Shows last 10 alerts from alerts.json',
    },
    {
      step: '6. Reset Environment',
      cmd: 'make reset',
      note: 'Kills all background processes, deletes test_vault/, re-runs setup',
    },
  ];

  return (
    <div className="space-y-3">
      {steps.map(s => (
        <div key={s.step} className="rounded p-3" style={{ background: '#00ff4108', border: '1px solid #00ff4120' }}>
          <div className="text-[11px] font-['Orbitron'] font-bold text-[#00ff41] mb-2">{s.step}</div>
          <div
            className="code-block text-[11px] text-[#00ff41] mb-2"
            style={{ background: '#000', padding: '8px 12px' }}
          >
            {s.cmd}
          </div>
          <div className="text-[10px] font-['Share_Tech_Mono'] text-[#00ff4160]">ℹ {s.note}</div>
        </div>
      ))}
    </div>
  );
}

function CommandsContent() {
  const cmds = [
    { cmd: 'make install',      desc: 'pip install all dependencies from requirements.txt',         color: '#00d4ff' },
    { cmd: 'make setup',        desc: 'Run canary_placer.py, start daemon + dashboard in background',color: '#00ff41' },
    { cmd: 'make attack',       desc: 'Run simulator.py at normal speed (350ms/file)',               color: '#ff4400' },
    { cmd: 'make attack-slow',  desc: 'Run simulator.py at slow speed (900ms/file) — best for demo', color: '#ff4400' },
    { cmd: 'make attack-fast',  desc: 'Run simulator.py at fast speed (80ms/file)',                  color: '#ff4400' },
    { cmd: 'make status',       desc: 'tail -n 10 alerts.json | python3 -m json.tool',               color: '#ffaa00' },
    { cmd: 'make reset',        desc: 'Kill all PIDs, delete test_vault/, re-run setup',             color: '#ff0040' },
    { cmd: 'make demo',         desc: 'Full scripted demo: setup → 3s pause → attack-slow',          color: '#9b59b6' },
    { cmd: 'make logs',         desc: 'tail -f ransomwatch_activity.log',                            color: '#00ff41' },
    { cmd: 'make integrity',    desc: 'Run a one-off integrity check against manifest',              color: '#ffaa00' },
    // Docker
    { cmd: 'docker compose up -d',           desc: 'Start all services in background',             color: '#00d4ff' },
    { cmd: 'docker compose logs -f defender',desc: 'Stream defender logs',                          color: '#00d4ff' },
    { cmd: 'docker compose down -v',         desc: 'Stop and remove containers + volumes',          color: '#ff0040' },
    // Conda
    { cmd: 'conda create -n ransomwatch python=3.11 -y', desc: 'Create miniconda env',             color: '#9b59b6' },
    { cmd: 'conda activate ransomwatch',     desc: 'Activate the conda environment',                color: '#9b59b6' },
    { cmd: 'conda deactivate',               desc: 'Deactivate conda environment',                  color: '#9b59b6' },
  ];

  return (
    <div className="space-y-1.5">
      {cmds.map(({ cmd, desc, color }) => (
        <div
          key={cmd}
          className="rounded p-2.5 flex gap-3"
          style={{ background: `${color}06`, border: `1px solid ${color}20` }}
        >
          <code
            className="font-['Share_Tech_Mono'] text-[10px] shrink-0"
            style={{ color, minWidth: 240 }}
          >
            $ {cmd}
          </code>
          <span className="text-[10px] font-['Rajdhani'] text-[#00ff4170]">{desc}</span>
        </div>
      ))}
    </div>
  );
}

function ThreatModelContent() {
  return (
    <div className="space-y-4">
      <Section title="STRIDE Analysis">
        <div className="space-y-2 mt-2">
          {[
            { threat: 'Spoofing',             s: 'S', c: '#ff4400', detail: 'Ransomware masquerades as legitimate process (svchost.exe). Canary daemon verifies PID lineage via psutil parent chain.' },
            { threat: 'Tampering',            s: 'T', c: '#ff0040', detail: 'AES-256-CBC encrypts file contents. SHA-256 integrity monitor detects in-place modification within 30s.' },
            { threat: 'Repudiation',          s: 'R', c: '#9b59b6', detail: 'All events logged to ransomwatch_activity.log with timestamps. Alerts written to alerts.json for audit trail.' },
            { threat: 'Info Disclosure',      s: 'I', c: '#ffaa00', detail: 'Canary files contain fake PII/financial data. Triggering them reveals attacker presence without real data exposure.' },
            { threat: 'Denial of Service',    s: 'D', c: '#ff4400', detail: 'VSS shadow deletion (T1490) prevents recovery. Mitigated by out-of-band backups (M1053).' },
            { threat: 'Elevation of Priv',    s: 'E', c: '#ff0040', detail: 'Ransomware may attempt UAC bypass. Defender runs with minimal privileges; SIGKILL sent to offending PID.' },
          ].map(({ threat, s, c, detail }) => (
            <div key={threat} className="flex gap-3 p-2 rounded" style={{ background: `${c}08`, border: `1px solid ${c}20` }}>
              <div
                className="w-6 h-6 rounded font-['Orbitron'] font-bold text-sm flex items-center justify-center shrink-0"
                style={{ background: `${c}20`, color: c, border: `1px solid ${c}40` }}
              >
                {s}
              </div>
              <div>
                <div className="text-[11px] font-['Orbitron'] font-bold mb-1" style={{ color: c }}>{threat}</div>
                <div className="text-[10px] font-['Rajdhani'] text-[#00ff4170]">{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Attack Chain Narrative">
        <div className="space-y-2">
          {[
            ['Initial Access (T1566)',  'Spearphishing email with malicious macro-enabled Office document lands in user inbox.'],
            ['Execution (T1059)',       'VBA macro drops Python-based ransomware payload; executed via wscript.exe.'],
            ['Discovery (T1083)',       'Payload walks filesystem tree, identifying valuable extensions (.xlsx, .docx, .pdf, .db, .bak).'],
            ['Key Generation',         'AES-256 session key generated locally. RSA-2048 public key fetched from C2 (10.0.0.99:4444). Session key encrypted with RSA pubkey.'],
            ['Impact (T1486)',          'Files encrypted AES-256-CBC. Original deleted. .locked extension added. Per-file IV stored in sidecar.'],
            ['Impact (T1490)',          'vssadmin delete shadows attempted to prevent VSS-based recovery.'],
            ['Impact (T1491)',          'RANSOM_NOTE.txt dropped in every directory with bitcoin address and decryption instructions.'],
          ].map(([phase, detail], i) => (
            <div key={phase} className="flex gap-3">
              <div
                className="w-5 h-5 rounded-full font-['Orbitron'] text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: '#ff004020', color: '#ff0040', border: '1px solid #ff004040' }}
              >
                {i+1}
              </div>
              <div>
                <span className="text-[11px] font-['Rajdhani'] font-bold text-[#ff4400]">{phase}: </span>
                <span className="text-[10px] font-['Rajdhani'] text-[#00ff4170]">{detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Detection Gaps">
        <div className="space-y-1">
          {[
            'Does NOT detect pre-encryption staging (data exfiltration before encryption)',
            'Does NOT detect ransomware that encrypts files outside test_vault/',
            'Does NOT catch ransomware that deletes canary files before modifying them',
            'Does NOT prevent initial access or lateral movement phases',
            'Hash check interval (30s) leaves a window for fast ransomware to complete',
          ].map(gap => (
            <div key={gap} className="flex gap-2 text-[10px] font-['Rajdhani']">
              <span className="text-[#ff0040] shrink-0">✗</span>
              <span className="text-[#00ff4160]">{gap}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function BypassContent() {
  const bypasses = [
    {
      id: '01',
      title: 'LD_PRELOAD Hook Injection',
      severity: 'HIGH',
      color: '#ff4400',
      description: 'Ransomware preloads a shared library that intercepts write() and open() syscalls, preventing inotify events from being generated for canary files.',
      detection: 'Integrity monitor re-hashes canary files every 30s via direct read(), bypassing the hook. Hash mismatch triggers alert without inotify dependency.',
      technique: 'LD_PRELOAD=/lib/hook.so ransomware',
    },
    {
      id: '02',
      title: 'Canary-Aware Enumeration',
      severity: 'CRITICAL',
      color: '#ff0040',
      description: 'Sophisticated ransomware identifies canary files by checking for dot-prefix, zero entropy (fake content), or known canary inode patterns before encrypting.',
      detection: 'Use high-entropy realistic content in canary files. Vary naming patterns. Place some canaries with non-dot prefix names.',
      technique: 'Skip files where stat.st_size < 1024 or name.startswith(".")',
    },
    {
      id: '03',
      title: 'inotify Queue Overflow',
      severity: 'HIGH',
      color: '#ff4400',
      description: 'Ransomware generates thousands of filesystem events simultaneously to overflow the inotify event queue (default: 16384 events), causing events to be dropped.',
      detection: 'Increase /proc/sys/fs/inotify/max_queued_events to 1048576. Monitor queue overflow counter at /proc/sys/fs/inotify.',
      technique: 'Encrypt 20,000 small files simultaneously to overflow queue',
    },
    {
      id: '04',
      title: 'In-Place Encryption',
      severity: 'MEDIUM',
      color: '#ffaa00',
      description: 'Instead of write(), ransomware uses mmap() to map file into memory and encrypts in-place, potentially bypassing some inotify IN_MODIFY events.',
      detection: 'inotify watches IN_CLOSE_WRITE events which fires after mmap flush. Also caught by hash integrity monitor.',
      technique: 'mmap(fd, PROT_READ|PROT_WRITE, MAP_SHARED) → XOR in place',
    },
    {
      id: '05',
      title: 'Kernel Module Rootkit',
      severity: 'CRITICAL',
      color: '#ff0040',
      description: 'A kernel-level rootkit can intercept the inotify subsystem directly, suppressing events for targeted files entirely.',
      detection: 'This bypasses both inotify and hash-based monitoring if the rootkit intercepts read() too. Requires kernel integrity checking (IMA/EVM, Secure Boot).',
      technique: 'LKM hooks inotify_handle_event() in kernel',
    },
    {
      id: '06',
      title: 'Canary File Backup & Restore',
      severity: 'HIGH',
      color: '#ff4400',
      description: 'Ransomware backs up the canary file content before encryption, then restores it afterwards — canary hash remains unchanged.',
      detection: 'Monitor inode change time (ctime) in addition to content hash. Use hardware security keys or TPM-backed attestation for canary integrity.',
      technique: 'cp canary /tmp/.bak → encrypt → cp /tmp/.bak canary',
    },
    {
      id: '07',
      title: 'Time-Delayed Activation',
      severity: 'MEDIUM',
      color: '#ffaa00',
      description: 'Ransomware avoids canary triggers during business hours, activating at 2AM when monitoring may be less attentive.',
      detection: '24/7 automated daemon monitoring with PagerDuty/SIEM integration. Alert thresholds do not vary by time of day.',
      technique: 'if datetime.now().hour in range(2, 4): begin_encryption()',
    },
  ];

  return (
    <div className="space-y-3">
      <div
        className="text-[11px] font-['Rajdhani'] text-[#ffaa00] p-3 rounded mb-4"
        style={{ background: '#ffaa0008', border: '1px solid #ffaa0030' }}
      >
        ⚠ These bypass techniques are documented for defensive awareness. Understanding attacker evasion
        methods is essential for building robust detection systems. Each bypass has a documented mitigation.
      </div>

      {bypasses.map(b => (
        <div
          key={b.id}
          className="rounded p-3"
          style={{ background: `${b.color}06`, border: `1px solid ${b.color}25` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="font-['Share_Tech_Mono'] text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: `${b.color}15`, color: b.color }}
            >
              BYPASS-{b.id}
            </span>
            <span className="font-['Orbitron'] text-[11px] font-bold" style={{ color: b.color }}>
              {b.title}
            </span>
            <span
              className="ml-auto text-[8px] font-['Orbitron'] font-bold px-1.5 py-0.5 rounded"
              style={{ background: `${b.color}15`, color: b.color, border: `1px solid ${b.color}30` }}
            >
              {b.severity}
            </span>
          </div>

          <p className="text-[10px] font-['Rajdhani'] text-[#00ff4170] mb-2">{b.description}</p>

          <div className="code-block text-[9px] text-[#ffaa00] mb-2" style={{ padding: '6px 10px' }}>
            {b.technique}
          </div>

          <div className="flex gap-1.5">
            <span className="text-[#00ff41] text-[10px]">🛡</span>
            <span className="text-[10px] font-['Rajdhani'] text-[#00ff4180]">
              <strong className="text-[#00ff41]">Mitigation:</strong> {b.detection}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="font-['Orbitron'] text-[12px] font-bold tracking-wider text-[#00ff41] mb-2 pb-1"
        style={{ borderBottom: '1px solid #00ff4120' }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
