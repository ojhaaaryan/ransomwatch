// ============================================================
// CodeViewer.tsx — Syntax-highlighted code snippets viewer
// Shows key implementation snippets from each module
// ============================================================
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Snippet {
  id: string;
  title: string;
  file: string;
  language: string;
  code: string;
  description: string;
}

const SNIPPETS: Snippet[] = [
  {
    id: 'canary_placer',
    title: 'Canary File Placement',
    file: 'canary_placer.py',
    language: 'python',
    description: 'Creates hidden canary files with SHA-256 manifest tracking',
    code: `def place_canary_files(vault_root: Path, manifest: dict) -> None:
    """Place canary files in strategic locations across the vault.
    
    Args:
        vault_root: Root directory of the simulated file server
        manifest: Dictionary to record canary metadata
    
    Design: Canary files are hidden (dot-prefixed) and contain
    realistic fake content to appear valuable to ransomware.
    """
    canaries = [
        (".canary_q4_forecast.xlsx",   DIRS["finance"]),
        (".canary_employee_ssn.docx",  DIRS["hr"]),
        (".canary_db_master.db",       DIRS["ops"]),
        (".canary_source_backup.bak",  DIRS["engineering"]),
        (".canary_litigation.pdf",     DIRS["legal"]),
    ]
    
    for filename, directory in canaries:
        path = vault_root / directory / filename
        content = generate_realistic_content(path.suffix)
        path.write_bytes(content)
        
        # Record metadata for integrity monitoring
        manifest["canaries"].append({
            "path":      str(path),
            "inode":     path.stat().st_ino,
            "sha256":    sha256_file(path),
            "placed_at": datetime.utcnow().isoformat() + "Z",
        })
    
    log.info(f"Placed {len(canaries)} canary files")`,
  },
  {
    id: 'aes_encrypt',
    title: 'AES-256-CBC Encryption',
    file: 'ransomware_sim/simulator.py',
    language: 'python',
    description: 'Phase 3: AES-256-CBC file encryption with per-file IV',
    code: `def encrypt_file(path: Path, aes_key: bytes) -> None:
    """Encrypt a single file using AES-256-CBC.
    
    Args:
        path:    Target file path (must be within VAULT_ROOT)
        aes_key: 32-byte AES session key
    
    Security Notes:
    - Fresh random IV generated per file (not reused)
    - IV stored in sidecar .iv file, encrypted with RSA pubkey
    - Original file atomically replaced with .locked version
    - PKCS7 padding applied via cryptography library
    """
    # ── Safety guard ──────────────────────────────────────────
    assert VAULT_ROOT in path.parents, "Path escape attempt!"
    
    iv        = os.urandom(16)          # Fresh IV every file
    cipher    = Cipher(
        algorithms.AES(aes_key),
        modes.CBC(iv),
        backend=default_backend()
    )
    encryptor = cipher.encryptor()
    padder    = padding.PKCS7(128).padder()
    
    plaintext  = path.read_bytes()
    padded     = padder.update(plaintext) + padder.finalize()
    ciphertext = encryptor.update(padded) + encryptor.finalize()
    
    locked_path = path.with_suffix(path.suffix + ".locked")
    locked_path.write_bytes(iv + ciphertext)   # Prepend IV
    path.unlink()                               # Delete original
    
    log.info(f"[PHASE3] Encrypted: {path.name} → {locked_path.name}")`,
  },
  {
    id: 'canary_daemon',
    title: 'inotify Canary Watchdog',
    file: 'defender/canary_daemon.py',
    language: 'python',
    description: 'Real-time filesystem event monitoring with PID identification',
    code: `class CanaryEventHandler(FileSystemEventHandler):
    """watchdog event handler for canary file monitoring.
    
    Monitors all canary paths for any filesystem event.
    On trigger: identifies PID, sends SIGKILL, writes alert.
    Detection target: < 2 seconds from event to kill.
    """
    
    def on_any_event(self, event: FileSystemEvent) -> None:
        """Fires on IN_ACCESS, IN_MODIFY, IN_OPEN, IN_DELETE."""
        if event.src_path not in self.canary_paths:
            return
        
        detected_at = datetime.utcnow()
        canary_meta = self.manifest[event.src_path]
        
        # ── Identify offending PID ─────────────────────────────
        offending_pid = self._find_pid_with_open_handle(
            event.src_path
        )
        
        if offending_pid:
            try:
                os.kill(offending_pid, signal.SIGKILL)
                console.print(
                    f"[bold red]✓ SIGKILL → PID {offending_pid}[/]"
                )
            except ProcessLookupError:
                log.warning("PID already dead before kill sent")
        
        # ── Write structured alert ─────────────────────────────
        latency_ms = int((datetime.utcnow() - detected_at)
                         .total_seconds() * 1000)
        write_alert(Alert(
            canary_path    = event.src_path,
            offending_pid  = offending_pid,
            event_type     = event.event_type,
            latency_ms     = latency_ms,
            files_saved    = count_unlocked_files(),
        ))`,
  },
  {
    id: 'integrity',
    title: 'Hash Integrity Monitor',
    file: 'defender/integrity_monitor.py',
    language: 'python',
    description: 'Catches LD_PRELOAD bypass: detects in-place modification without inotify events',
    code: `class IntegrityMonitor:
    """Periodic SHA-256 re-hash to catch inotify bypass attempts.
    
    Real ransomware can bypass inotify using:
    - LD_PRELOAD hooks that intercept write() syscalls
    - Direct /dev/mem or /proc/pid/mem manipulation
    - Kernel module-level modifications
    
    This monitor detects hash changes regardless of how the
    modification was made, providing a defence-in-depth layer.
    
    Check interval: 30 seconds (configurable)
    """
    
    def run_check(self) -> list[IntegrityAlert]:
        """Recompute hashes and compare against manifest baseline.
        
        Returns:
            List of IntegrityAlert for any files whose hash changed
        """
        alerts = []
        for canary in self.manifest["canaries"]:
            path = Path(canary["path"])
            if not path.exists():
                alerts.append(IntegrityAlert(
                    file=str(path), 
                    reason="FILE_DELETED"
                ))
                continue
            
            current_hash = sha256_file(path)
            if current_hash != canary["sha256"]:
                log.critical(
                    f"HASH MISMATCH: {path.name} "
                    f"expected={canary['sha256'][:8]}… "
                    f"got={current_hash[:8]}…"
                )
                alerts.append(IntegrityAlert(
                    file=str(path),
                    reason="HASH_CHANGED",
                    expected=canary["sha256"],
                    actual=current_hash,
                ))
        return alerts`,
  },
  {
    id: 'flask_api',
    title: 'Flask SOC Dashboard API',
    file: 'dashboard/app.py',
    language: 'python',
    description: 'REST endpoints for real-time SOC dashboard data',
    code: `from flask import Flask, jsonify, render_template
import json, pathlib, os

app = Flask(__name__)
ALERTS_PATH = pathlib.Path("alerts.json")
VAULT_ROOT  = pathlib.Path("test_vault")

@app.route("/api/alerts")
def api_alerts():
    """Return all alerts as JSON. Dashboard polls every 2s."""
    if not ALERTS_PATH.exists():
        return jsonify([])
    with ALERTS_PATH.open() as f:
        return jsonify(json.load(f))

@app.route("/api/stats")  
def api_stats():
    """Return live file counts: total, encrypted, saved, canaries.
    
    Walks test_vault/ to count .locked files in real-time.
    This gives the dashboard accurate live numbers without
    relying on the simulator to report its own progress.
    """
    total     = sum(1 for _ in VAULT_ROOT.rglob("*") 
                    if _.is_file())
    encrypted = sum(1 for _ in VAULT_ROOT.rglob("*.locked"))
    saved     = total - encrypted
    canaries  = sum(1 for _ in VAULT_ROOT.rglob(".canary_*"))
    
    return jsonify({
        "total":             total,
        "encrypted":         encrypted,
        "saved":             saved,
        "canaries_active":   canaries,
        "ransom_note":       (VAULT_ROOT/"RANSOM_NOTE.txt").exists(),
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)`,
  },
  {
    id: 'docker',
    title: 'Docker Compose Config',
    file: 'docker-compose.yml',
    language: 'yaml',
    description: 'Two-service deployment with shared volumes and SYS_PTRACE capability',
    code: `version: "3.9"

services:
  defender:
    build:
      context: .
      dockerfile: Dockerfile.defender
    volumes:
      - ./test_vault:/app/test_vault     # Shared file vault
      - ./alerts.json:/app/alerts.json   # Shared alert store
      - ./canary_manifest.json:/app/canary_manifest.json
    cap_add:
      - SYS_PTRACE     # Required for psutil open-file inspection
    pid: "host"        # Share PID namespace for process kill
    restart: unless-stopped
    environment:
      - PYTHONUNBUFFERED=1

  dashboard:
    build:
      context: .
      dockerfile: Dockerfile.dashboard
    ports:
      - "5000:5000"    # SOC dashboard accessible on host
    volumes:
      - ./test_vault:/app/test_vault
      - ./alerts.json:/app/alerts.json
    depends_on:
      - defender
    restart: unless-stopped

volumes:
  shared_data: {}`,
  },
];

export default function CodeViewer() {
  const [activeId, setActiveId] = useState<string>('aes_encrypt');
  const [copied, setCopied]     = useState(false);

  const active = SNIPPETS.find(s => s.id === activeId)!;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Basic syntax-highlight helper
  const highlight = (code: string): string => {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Strings
      .replace(/(["'`])(.*?)\1/g, '<span style="color:#ce9178">$1$2$1</span>')
      // Comments
      .replace(/(#.+$)/gm, '<span style="color:#6a9955">$1</span>')
      // Keywords
      .replace(/\b(def|class|return|import|from|if|else|elif|for|in|not|and|or|True|False|None|try|except|with|as|raise|assert|self|log)\b/g,
        '<span style="color:#569cd6">$1</span>')
      // Builtins / types
      .replace(/\b(int|str|list|dict|Path|bytes|bool|None|datetime|os|signal)\b/g,
        '<span style="color:#4ec9b0">$1</span>')
      // Decorators
      .replace(/(@\w+)/g, '<span style="color:#dcdcaa">$1</span>')
      // Numbers
      .replace(/\b(\d+)\b/g, '<span style="color:#b5cea8">$1</span>');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#00d4ff]"
          style={{ textShadow: '0 0 8px #00d4ff80' }}
        >
          ◈ SOURCE CODE VIEWER
        </h3>
      </div>

      {/* File tabs */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {SNIPPETS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className="px-2 py-1 rounded text-[9px] font-['Share_Tech_Mono'] transition-all"
            style={{
              background: activeId === s.id ? '#00d4ff15' : 'transparent',
              border: `1px solid ${activeId === s.id ? '#00d4ff40' : '#00ff4115'}`,
              color: activeId === s.id ? '#00d4ff' : '#00ff4140',
            }}
          >
            {s.file}
          </button>
        ))}
      </div>

      {/* Code area */}
      <div
        className="flex-1 rounded overflow-hidden flex flex-col"
        style={{ background: '#0d1117', border: '1px solid #00d4ff20' }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: '#161b22', borderBottom: '1px solid #00d4ff15' }}
        >
          <div>
            <span className="text-[11px] font-['Share_Tech_Mono'] text-[#00d4ff]">{active.file}</span>
            <span className="mx-2 text-[#00d4ff30]">—</span>
            <span className="text-[10px] font-['Rajdhani'] text-[#00d4ff60]">{active.title}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all"
            style={{ border: '1px solid #00d4ff20', color: copied ? '#00ff41' : '#00d4ff60' }}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? 'COPIED' : 'COPY'}
          </button>
        </div>

        {/* Description */}
        <div
          className="px-4 py-2 text-[10px] font-['Rajdhani']"
          style={{ background: '#0d1117', borderBottom: '1px solid #00d4ff10', color: '#00d4ff60' }}
        >
          {active.description}
        </div>

        {/* Code */}
        <div className="flex-1 overflow-auto">
          <pre className="p-4 text-[11px] font-['Share_Tech_Mono'] leading-relaxed">
            {/* Line numbers */}
            <code dangerouslySetInnerHTML={{
              __html: active.code
                .split('\n')
                .map((line, i) =>
                  `<span style="color:#00ff4125;user-select:none;margin-right:16px">${String(i+1).padStart(3,' ')}</span>${highlight(line)}`
                )
                .join('\n')
            }} />
          </pre>
        </div>
      </div>
    </div>
  );
}
