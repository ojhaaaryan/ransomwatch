// ============================================================
// DemoScript.tsx — Word-for-word 4-minute demo presentation script
// ============================================================
import { useState } from 'react';
import { ChevronRight, ChevronDown, Mic, Clock } from 'lucide-react';

interface Step {
  id: string;
  time: string;
  title: string;
  command?: string;
  narration: string;
  pointAt?: string;
  qa?: Array<{ q: string; a: string }>;
}

const DEMO_STEPS: Step[] = [
  {
    id: '00',
    time: '0:00',
    title: 'Introduction',
    narration: `"Good afternoon. I'm presenting Problem 24 — Ransomware Behaviour Simulation and Canary File 
Detection, mapped to MITRE ATT&CK T1486: Data Encrypted for Impact. 

RansomWatch is both an offensive simulator and a defensive canary-based detection system running on 
Linux with Python 3.11. Let me show you the live demo."`,
    pointAt: 'Header — note ARMED status in top right',
  },
  {
    id: '01',
    time: '0:30',
    title: 'Setup: Place Canary Files',
    command: 'make setup',
    narration: `"First, we run make setup. This calls canary_placer.py which creates a realistic enterprise 
file server under test_vault/ — finance, HR, engineering, legal, ops directories — 37 decoy files 
and 5 hidden canary tripwires.

Each canary is a dot-prefixed file with realistic content — fake payroll data, fake PDFs — placed in 
the highest-value directories. Their SHA-256 hashes are recorded in canary_manifest.json as our baseline.

The watchdog daemon and Flask dashboard start in the background. System is now ARMED."`,
    pointAt: 'File Vault tab — show the directory tree with 🪤 TRAP badges',
  },
  {
    id: '02',
    time: '1:00',
    title: 'Architecture Walkthrough',
    narration: `"While the system arms, let me explain the architecture. 
  
On the left — our offensive simulator running 4 phases:
  Phase 1: Reconnaissance — walks the directory tree
  Phase 2: Key Generation — AES-256 session key, RSA-2048 C2 exchange  
  Phase 3: Encryption — AES-256-CBC with fresh IV per file
  Phase 4: Impact — ransom note, simulated VSS deletion, canary touch

On the right — our defender: watchdog.Observer monitors all 5 canary paths via inotify. 
The moment any canary is touched, it identifies the offending PID via psutil, 
sends SIGKILL, and writes a structured alert.

There's also a background integrity monitor re-hashing all canaries every 30 seconds 
to catch LD_PRELOAD bypass attempts."`,
    pointAt: 'Network Map tab — point to attack flow and defender nodes',
  },
  {
    id: '03',
    time: '1:45',
    title: 'Launch Attack',
    command: 'make attack-slow',
    narration: `"Now — the attack. make attack-slow runs simulator.py at 900ms per file, 
ideal for demonstration.

Watch Phase 1 appear in the terminal log — directory walk complete, 37 targets found.

Phase 2 — you can see the AES-256 session key generated and the RSA-2048 C2 key exchange simulated.

Phase 3 is starting now — watch the files turning red in the vault tree. The encryption progress 
bar is climbing. Each file gets a fresh random IV — AES-256-CBC.

We're approaching the canary files in the finance directory…"`,
    pointAt: 'SOC Dashboard — watch encrypted count rise in stat cards and chart',
  },
  {
    id: '04',
    time: '2:30',
    title: 'Detection Event',
    narration: `"THERE — the canary triggered! 

The inotify event fired on .canary_2024_q4_forecast.xlsx. The defender identified the offending 
PID via psutil open-file enumeration. SIGKILL sent — process terminated.

Detection latency: under 2 seconds. 

Look at the alert card: canary file name, severity CRITICAL, PID killed, exact detection latency 
in milliseconds, how many files were saved versus encrypted.

In this run, the ransomware managed to encrypt maybe 3 files before being killed — out of 37. 
That's 92% file protection from a single canary tripwire."`,
    pointAt: 'Alert timeline — click the alert card to show all details. Point to SIGKILL confirmation.',
  },
  {
    id: '05',
    time: '3:15',
    title: 'Threat Radar & MITRE Panel',
    narration: `"The threat radar shows CRITICAL level with blips for each triggered canary.

The MITRE ATT&CK panel shows T1486 as ACTIVE in red — our primary technique. You can see 
the full kill chain from T1566 spearphishing through T1490 VSS deletion.

The integrity monitor tab shows all 5 canary files re-hashed — the triggered ones now show 
TAMPERED status because their content changed during the attack.

This dual detection — inotify events AND hash comparison — means we catch even sophisticated 
ransomware that tries to suppress inotify events via LD_PRELOAD hooks."`,
    pointAt: 'MITRE panel — T1486 active badge. Integrity table — TAMPERED rows in red.',
  },
  {
    id: '06',
    time: '3:45',
    title: 'Closing',
    command: 'make status',
    narration: `"make status shows us the structured JSON alerts — timestamps, PIDs, detection 
latencies, files saved.

To summarise: we've demonstrated a complete offensive-defensive loop. AES-256-CBC encryption 
simulated with RSA-2048 key wrapping, detected by inotify watchdog in under 2 seconds, 
with a SHA-256 integrity monitor as a second line of defence against bypass techniques.

The system runs in Docker — defender container with SYS_PTRACE for psutil, dashboard container 
on port 5000. Also works with Miniconda via the environment.yml.

I'll take questions."`,
    pointAt: 'Show JSON output in terminal',
  },
];

const QA_ANSWERS = [
  {
    q: 'What happens if ransomware disables inotify?',
    a: `The integrity monitor (integrity_monitor.py) runs independently of inotify. Every 30 seconds 
it re-computes SHA-256 of all canary files using raw os.open() file descriptors rather than 
the standard libc open() — this makes LD_PRELOAD hooks harder to intercept (though not impossible 
for kernel-level hooks). If a hash changes without a corresponding inotify event, we detect 
the tampering within 30 seconds maximum. For kernel-module-level rootkits that hook the 
entire inotify subsystem, we'd need kernel integrity checking (IMA/EVM) and Secure Boot — 
which is documented in our THREAT_MODEL.md as a known detection gap.`,
  },
  {
    q: 'Why AES-256-CBC and not GCM?',
    a: `Great question — real ransomware almost universally uses CBC, not GCM, for two reasons:
1. Performance: GCM requires computing an authentication tag (GHASH) for every block, which adds 
   ~10-15% CPU overhead. For bulk file encryption, this matters.
2. No benefit to attacker: The attacker doesn't need integrity protection — they WANT the victim 
   to be unable to modify the ciphertext without the key. GCM's authentication tag would actually 
   alert the victim if they tried to tamper with the ciphertext, which is not in the attacker's 
   interest.
We chose CBC to accurately simulate real ransomware behaviour for the MITRE T1486 alignment 
requirement. In a legitimate file encryption system, we'd absolutely use AES-256-GCM.`,
  },
  {
    q: 'What are the limitations of canary-based detection?',
    a: `Five key limitations:
1. Canary-aware ransomware: Sophisticated samples specifically check for dot-prefixed files, 
   zero-entropy content, or known canary inode patterns and skip them.
2. Detection lag: If ransomware is extremely fast (Ryuk can encrypt 100k files in seconds), 
   most files are encrypted before the canary is triggered.
3. Coverage gaps: We only monitor test_vault/ — production requires canaries on EVERY file share, 
   every mount point, every NAS share.
4. inotify queue overflow: Default max_queued_events=16384. Fast ransomware can flood this and 
   cause events to be dropped.
5. No exfiltration detection: Double-extortion ransomware exfiltrates data BEFORE encrypting. 
   Canaries don't catch network exfiltration — you need DLP and network monitoring for that.`,
  },
  {
    q: 'Why not use a HIPS/EDR instead?',
    a: `Canary detection is complementary to HIPS/EDR, not a replacement. EDR has higher false 
positive rates and requires signature updates or ML model training. Canary files have near-zero 
false positives — legitimate software never touches hidden dot-prefix files with fake PII content. 
This makes canary alerts extremely high confidence — when a canary fires, you know with near-certainty 
it's malicious. In an enterprise, you'd run both: EDR for broad threat detection + canary files as 
a high-confidence trip wire with automated containment.`,
  },
];

export default function DemoScript() {
  const [expandedStep, setExpandedStep] = useState<string | null>('00');
  const [expandedQA, setExpandedQA]     = useState<number | null>(null);

  return (
    <div className="h-full flex flex-col overflow-y-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Mic size={16} className="text-[#00ff41]" />
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#00ff41]"
          style={{ textShadow: '0 0 8px #00ff41' }}
        >
          ◈ 4-MINUTE DEMO SCRIPT
        </h3>
        <div
          className="ml-auto text-[10px] font-['Share_Tech_Mono'] px-2 py-0.5 rounded"
          style={{ background: '#00ff4115', border: '1px solid #00ff4130', color: '#00ff41' }}
        >
          WORD-FOR-WORD
        </div>
      </div>

      {/* Demo steps */}
      {DEMO_STEPS.map(step => (
        <div
          key={step.id}
          className="rounded overflow-hidden"
          style={{ border: '1px solid #00ff4120' }}
        >
          {/* Step header */}
          <button
            onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[#00ff4108]"
            style={{ background: expandedStep === step.id ? '#00ff4108' : 'transparent' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-['Orbitron'] text-xs font-bold shrink-0"
              style={{ background: '#00ff4115', color: '#00ff41', border: '1px solid #00ff4130' }}
            >
              {step.id}
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="font-['Rajdhani'] font-semibold text-[#00ff41]">{step.title}</span>
              {step.command && (
                <code
                  className="text-[10px] font-['Share_Tech_Mono'] px-1.5 py-0.5 rounded"
                  style={{ background: '#ff440015', color: '#ff4400', border: '1px solid #ff440030' }}
                >
                  $ {step.command}
                </code>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <Clock size={9} className="text-[#00ff4140]" />
                <span className="text-[10px] font-['Share_Tech_Mono'] text-[#00ff4140]">{step.time}</span>
              </div>
              {expandedStep === step.id
                ? <ChevronDown size={12} className="text-[#00ff4160]" />
                : <ChevronRight size={12} className="text-[#00ff4140]" />
              }
            </div>
          </button>

          {/* Step content */}
          {expandedStep === step.id && (
            <div className="px-4 pb-4">
              <div
                className="rounded p-3 mb-2 font-['Share_Tech_Mono'] text-[11px] leading-relaxed whitespace-pre-wrap"
                style={{ background: '#000', color: '#00ff41', border: '1px solid #00ff4115' }}
              >
                {step.narration}
              </div>
              {step.pointAt && (
                <div className="flex items-center gap-1 text-[10px] font-['Rajdhani']">
                  <span className="text-[#ffaa00]">👆 POINT AT:</span>
                  <span className="text-[#ffaa00] font-semibold">{step.pointAt}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Q&A section */}
      <div className="mt-4">
        <div
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#ff4400] mb-3"
          style={{ textShadow: '0 0 8px #ff440080' }}
        >
          ◈ ANTICIPATED Q&A
        </div>
        {QA_ANSWERS.map((qa, i) => (
          <div
            key={i}
            className="mb-2 rounded overflow-hidden"
            style={{ border: '1px solid #ff440020' }}
          >
            <button
              onClick={() => setExpandedQA(expandedQA === i ? null : i)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all hover:bg-[#ff440008]"
              style={{ background: expandedQA === i ? '#ff440008' : 'transparent' }}
            >
              <span className="font-['Rajdhani'] font-semibold text-[11px]" style={{ color: '#ff4400' }}>
                Q: {qa.q}
              </span>
              {expandedQA === i
                ? <ChevronDown size={11} className="text-[#ff440060] ml-auto shrink-0" />
                : <ChevronRight size={11} className="text-[#ff440040] ml-auto shrink-0" />
              }
            </button>
            {expandedQA === i && (
              <div
                className="px-4 pb-3 font-['Share_Tech_Mono'] text-[10px] leading-relaxed text-[#00ff4180]"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {qa.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
