# RansomWatch — Threat Model Document
## STRIDE Analysis for T1486 Ransomware Detection System

---

## 1. System Overview

RansomWatch is a canary-based ransomware detection system deployed on an on-premises Linux file server.
It consists of:

- **Canary files**: Hidden sentinel files placed in high-value directories
- **Watchdog daemon**: inotify-based filesystem monitor on canary paths
- **Integrity monitor**: Periodic SHA-256 re-hash for bypass detection
- **SOC Dashboard**: Real-time Flask/React dashboard showing detection events

**Trust boundary**: The system operates entirely within `test_vault/` (simulation) or a designated
protected directory in production deployment.

---

## 2. Assets

| Asset | Sensitivity | Location | Owner |
|-------|-------------|----------|-------|
| Finance files (.xlsx, .pdf) | HIGH | `test_vault/finance/` | CFO / Finance Team |
| HR records (.docx, .xlsx) | CRITICAL | `test_vault/hr/` | CHRO / HR |
| Engineering source/configs | HIGH | `test_vault/engineering/` | CTO / Dev Team |
| Legal contracts/evidence | CRITICAL | `test_vault/legal/` | General Counsel |
| Operational databases (.db) | HIGH | `test_vault/ops/` | IT Operations |
| Canary manifest (baseline) | MEDIUM | `canary_manifest.json` | Security Team |
| Alert store | MEDIUM | `alerts.json` | SOC Analysts |
| AES session key (in memory) | CRITICAL | Ransomware process memory | ATTACKER |

---

## 3. Threat Actors

### 3.1 Primary: Financially Motivated Ransomware Group
- **Examples**: LockBit, ALPHV/BlackCat, REvil, Cl0p
- **Motivation**: Ransom payment (Bitcoin)
- **Capabilities**: High — custom tooling, OPSEC-aware, multi-stage attacks
- **Access Method**: Phishing, RDP brute-force, VPN 0-day, initial access brokers

### 3.2 Secondary: Nation-State Actors (Destructive)
- **Examples**: Sandworm (NotPetya), Lazarus Group
- **Motivation**: Disruption, not financial
- **Capabilities**: Very high — wiper variants, kernel exploits
- **Detection relevance**: Canary detection still applies; they often use ransomware-like encryption

### 3.3 Tertiary: Insider Threat
- **Examples**: Disgruntled employee, contractor
- **Motivation**: Sabotage, financial (data sale)
- **Access Method**: Legitimate credentials, physical access

---

## 4. Attack Vectors

```
ATTACK SURFACE MAP
──────────────────

External:
  Internet ──► Email Gateway ──► Phishing/Malicious Attachment
  Internet ──► VPN Gateway    ──► Credential Stuffing / 0-day
  Internet ──► RDP Port 3389  ──► Brute Force

Internal (post-compromise):
  Compromised Endpoint ──► File Server (SMB/NFS) ──► test_vault/
  Lateral Movement     ──► Domain Controller     ──► GPO Deployment
  Privilege Escalation ──► Local Admin           ──► Disable AV/Canary
```

---

## 5. STRIDE Analysis

### 5.1 Spoofing

| Scenario | Component | Risk | Mitigation |
|----------|-----------|------|------------|
| Ransomware masquerades as `svchost.exe` | PID identification | HIGH | Verify full process path + parent chain via psutil |
| Attacker spoofs canary file modification time | Integrity check | MEDIUM | Check content hash, not just mtime |
| Canary daemon impersonation | Alert pipeline | LOW | Run daemon as dedicated service account |

**Detection**: `psutil.Process(pid).exe()` returns full executable path, harder to spoof than just process name.

### 5.2 Tampering

| Scenario | Component | Risk | Mitigation |
|----------|-----------|------|------------|
| In-place AES encryption of canary file | inotify + hash monitor | HIGH | SHA-256 re-hash every 30s detects content change |
| Modification of canary_manifest.json | Baseline integrity | CRITICAL | Sign manifest with HMAC; store copy in read-only location |
| Tampering with alerts.json | SOC visibility | MEDIUM | Append-only log; SIEM forwarding for redundancy |
| LD_PRELOAD hook bypasses inotify write events | inotify monitor | HIGH | Hash monitor catches this within 30s |

**Key design choice**: Using `os.open()` (raw fd) rather than Python `open()` to read canary files in
the integrity monitor reduces the LD_PRELOAD hook surface (hooks typically intercept libc `open()`).

### 5.3 Repudiation

| Scenario | Component | Risk | Mitigation |
|----------|-----------|------|------------|
| Attacker deletes ransomware logs | Activity log | HIGH | Forward logs to remote SIEM in real-time (rsyslog/Splunk) |
| Alert timestamps disputed | alerts.json | MEDIUM | Use UTC timestamps with nanosecond precision; sign alerts |
| "It wasn't ransomware" claim | Forensics | LOW | Preserve memory dump of killed process for forensic analysis |

**Design**: All timestamps are UTC ISO-8601 format. `ransomware_activity.log` is append-only (mode `"a"`).

### 5.4 Information Disclosure

| Scenario | Component | Risk | Mitigation |
|----------|-----------|------|------------|
| Canary file content reveals canary location | Reconnaissance | HIGH | High-entropy realistic content in canary files |
| alerts.json exposed via unauthenticated Flask | Dashboard | MEDIUM | Add Flask-Login auth; restrict to SOC subnet |
| Manifest reveals canary paths via directory listing | File server | MEDIUM | Restrict manifest to security service account only |
| RSA public key fingerprint in logs | Key material | LOW | Key material is ephemeral (simulation only) |

**Key decision**: Canary files contain realistic content (fake payroll data, fake PDFs) to appear
genuinely valuable, reducing the chance that an attacker's tool skips them as obviously fake.

### 5.5 Denial of Service

| Scenario | Component | Risk | Mitigation |
|----------|-----------|------|------------|
| VSS shadow deletion blocks recovery | Backup restore | CRITICAL | Offline immutable backups; cloud backup (M1053) |
| SIGKILL of defender process | Canary daemon | HIGH | Run as systemd service with `Restart=always`; watchdog pid |
| inotify queue overflow (16384 events) | Event monitoring | HIGH | `sysctl fs.inotify.max_queued_events=1048576` |
| Ransom note filesystem flood | Disk capacity | MEDIUM | Monitor disk usage; inode exhaustion alerts |
| Mass encryption before canary trigger | File protection | HIGH | Canary files placed at TOP of directory tree (first hit) |

**Canary placement strategy**: Canary files are placed as the **first alphabetically sorted entry** in
each directory (dot-prefix sorts before alphabetic names on most filesystems). This ensures the
ransomware hits a canary file early in its top-down directory walk, minimising files encrypted before
detection.

### 5.6 Elevation of Privilege

| Scenario | Component | Risk | Mitigation |
|----------|-----------|------|------------|
| Ransomware UAC bypass → SYSTEM | Privilege level | CRITICAL | Principle of least privilege on file shares; ACLs |
| Exploit in canary_daemon process | Defender | MEDIUM | Run as non-root, seccomp filter, AppArmor profile |
| Docker container escape (SYS_PTRACE) | Container | HIGH | SYS_PTRACE required for psutil; minimise attack surface |
| Kernel module loading (rootkit) | Kernel | CRITICAL | Secure Boot, module signing, Lockdown LSM |

**SYS_PTRACE justification**: The defender container requires `SYS_PTRACE` capability to enumerate
open file handles of other processes via psutil. This is a known trade-off. In production:
- Restrict ptrace to specific PIDs only (using seccomp)
- Use `Yama ptrace scope` (`/proc/sys/kernel/yama/ptrace_scope=2`)

---

## 6. Attack Chain Narrative

### Stage 1: Initial Access (T1566.001)
Adversary sends spearphishing email to finance team with malicious Excel attachment containing
obfuscated VBA macro. User opens attachment → macro executes.

### Stage 2: Execution (T1059.006)
VBA macro drops a Python script to `%TEMP%` and executes via `wscript.exe`. The Python script
is the ransomware payload (`simulator.py` equivalent).

### Stage 3: Discovery (T1083)
Payload calls `Path.rglob("*")` on all mounted drives and network shares. Builds target list:
37 files in `test_vault/` across 5 categories.

### Stage 4: Key Generation (no explicit T-code)
Payload connects to C2 server (`10.0.0.99:4444`), receives RSA-2048 public key. Generates
local AES-256 session key. Wraps session key with RSA-OAEP and uploads to C2.

**At this point, victim has NO way to decrypt without paying ransom** — they don't have the
RSA private key, so they can't unwrap the AES key.

### Stage 5: Encryption (T1486) ← CANARY DETECTION TRIGGERS HERE
Payload begins encrypting files. Within the first few iterations, it encounters:

```
test_vault/finance/.canary_2024_q4_forecast.xlsx
```

The `Path.touch()` or `write_bytes()` call fires an `IN_MODIFY` inotify event.
`canary_daemon.py` detects this within **< 2 seconds**.

**SIGKILL sent to ransomware process.**

Files saved: ~35 of 37 (95% protected — only 2 encrypted before detection).

### Stage 6: Impact Attempt (T1490, T1491)
Payload attempts:
- `vssadmin delete shadows /all /quiet` — simulated, logged
- Drop `RANSOM_NOTE.txt` — simulated in sandbox

**In real deployment**: SIGKILL at Stage 5 prevents Stage 6 from executing.

---

## 7. Defender Assumptions & Trust Boundaries

| Assumption | Justification | Failure Mode |
|------------|---------------|--------------|
| inotify events are reliable | Linux kernel guarantee | Kernel module rootkit |
| psutil can read open files | SYS_PTRACE granted | Rootkit hides file handles |
| SIGKILL terminates the process | Kernel enforces SIGKILL | SIGKILL cannot be caught/ignored |
| canary_manifest.json is unmodified | Service account read-only | Manifest tampering attack |
| Canary files exist on disk | Periodic existence check | Ransomware pre-deletes canaries |
| SHA-256 via os.read() is unhooked | LD_PRELOAD targets libc open() | Kernel-level hook |

---

## 8. Detection Gaps

**What RansomWatch does NOT catch:**

1. **Pre-encryption exfiltration** (double-extortion): Ransomware that exfiltrates data before
   encrypting. Canary files don't detect network exfiltration.

2. **Files outside test_vault/**: Ransomware targeting other directories. Production deployment
   must cover ALL high-value directories.

3. **Pure wipers**: Ransomware that deletes rather than encrypts (NotPetya-style). No `.locked`
   extension → integrity monitor may catch hash change.

4. **Canary-aware ransomware**: Ransomware specifically coded to skip files starting with `.canary_`.
   Mitigation: use unpredictable canary naming.

5. **Fast ransomware** (< 30s to completion): Ryuk variants can encrypt thousands of files in seconds.
   Our 30-second hash check interval may be too slow.

6. **Encrypted exfiltration channel**: C2 communication to exfiltrate files before encryption.
   Requires network-level DLP.

7. **Memory-only attacks**: In-memory ransomware that never touches disk until encryption.
   Standard inotify doesn't detect in-memory operations.

---

## 9. Real-World Deployment Considerations

### Where to deploy in an enterprise:

```
Enterprise File Server Deployment
──────────────────────────────────

[Windows File Server / Samba / NAS]
├── \\fileserver\finance\          ← Place 3-5 canaries per share
├── \\fileserver\hr\
├── \\fileserver\engineering\
└── \\fileserver\legal\

[Defender agent]  ─── runs as: DOMAIN\ransomwatch-svc (service account)
[inotify / FSEvents (macOS) / ReadDirectoryChangesW (Windows)]
       │
       ▼
[SIEM Integration]  →  Splunk / Microsoft Sentinel / Elastic SIEM
       │
       ▼
[PagerDuty / VictorOps]  →  24/7 on-call SOC analyst notification
       │
       ▼
[Automated Containment]  →  NAC quarantine / EDR isolation policy
```

### Enterprise hardening checklist:
- [ ] Deploy canary files via Group Policy (Windows) or Ansible (Linux)
- [ ] Integrate alerts with SIEM (Splunk, Sentinel) for correlation
- [ ] Set up PagerDuty alerting for canary triggers (< 5 min MTTD target)
- [ ] Place canaries on ALL file shares, not just high-value directories
- [ ] Monitor canary existence every 5 minutes (additional file-delete detection)
- [ ] Deploy CanaryTokens.org fake credentials alongside file canaries
- [ ] Test monthly: run `make attack-slow` in staging environment
- [ ] Document canary locations in change management system (prevent false positives during maintenance)

---

*Document version: 2.4.1 | Classification: INTERNAL — Hackathon Demo*  
*Author: RansomWatch Team | Amrita University Bengaluru | Problem #24*
