# 🛡 RansomWatch — Canary File Detection System

> **Hackathon Problem #24** — Amrita University, Bengaluru  
> **Track:** Offensive + Defensive | **Difficulty:** Medium  
> **MITRE ATT&CK:** T1486 — Data Encrypted for Impact

RansomWatch is a production-quality ransomware behaviour simulation and real-time canary-based detection
system. It combines a fully sandboxed AES-256-CBC ransomware simulator with an inotify-powered watchdog
daemon that identifies offending processes via psutil, sends SIGKILL, and displays live alerts on a
dark-themed SOC dashboard.

---

## 📐 Architecture Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RANSOMWATCH ARCHITECTURE                      │
│                   MITRE ATT&CK T1486 — Simulation & Detection        │
└─────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │                        SETUP PHASE                              │
  │                                                                 │
  │  canary_placer.py                                               │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │  create_vault_structure()  → test_vault/{finance,hr,...}  │  │
  │  │  place_decoy_files()       → 37 realistic office files   │  │
  │  │  place_canary_files()      → 5 hidden .canary_* tripwires │  │
  │  │  write_manifest()          → canary_manifest.json         │  │
  │  └──────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
  ┌───────────────────┐ ┌──────────────┐ ┌────────────────────┐
  │  OFFENSIVE LAYER  │ │  FILESYSTEM  │ │  DEFENSIVE LAYER   │
  │                   │ │              │ │                     │
  │ simulator.py      │ │  test_vault/ │ │ canary_daemon.py    │
  │ ┌───────────────┐ │ │  ┌────────┐ │ │ ┌────────────────┐  │
  │ │Ph1: RECON     │─┼─┼─►│finance/│ │ │ │ watchdog       │  │
  │ │Ph2: KEYGEN    │ │ │  │hr/     │◄┼─┼─│ (inotify)      │  │
  │ │Ph3: AES-CBC   │─┼─┼─►│ops/    │ │ │ │                │  │
  │ │Ph4: IMPACT    │─┼─┼─►│.canary*│─┼─┼►│ TRIGGER!       │  │
  │ └───────────────┘ │ │  └────────┘ │ │ │ psutil → PID   │  │
  └───────────────────┘ └──────────────┘ │ │ SIGKILL        │  │
                                         │ │ write alert    │  │
                                         │ └────────────────┘  │
                                         │                     │
                                         │ integrity_monitor.py│
                                         │ ┌────────────────┐  │
                                         │ │ SHA-256 30s    │  │
                                         │ │ re-hash loop   │  │
                                         │ │ LD_PRELOAD     │  │
                                         │ │ bypass detect  │  │
                                         │ └────────────────┘  │
                                         └────────────────────┘
                                                   │
                                                   ▼ alerts.json
                                         ┌────────────────────┐
                                         │  DASHBOARD LAYER   │
                                         │                    │
                                         │  Flask app.py      │
                                         │  GET /api/alerts   │
                                         │  GET /api/stats    │
                                         │  Port 5000         │
                                         │       │            │
                                         │       ▼ 2s poll    │
                                         │  React Dashboard   │
                                         │  • Alert timeline  │
                                         │  • Live bar chart  │
                                         │  • MITRE T1486 map │
                                         │  • Threat radar    │
                                         │  • Network map     │
                                         │  • Source viewer   │
                                         └────────────────────┘
```

---

## ⚡ Quick Start (3 commands)

```bash
# 1. Clone
git clone https://github.com/ojhaaaryan/ransomwatch.git && cd ransomwatch

# 2. Install (choose one)
make install                   # Using pip directly
# OR
conda create --prefix ./.env && conda activate ./.env && pip install -r requirements.txt

# 3. Install React UI dependencies
npm install

# 4. Run full stack (Flask API + React UI)
make dev
```

Then open **<http://localhost:5173>** for the stunning cyberpunk SOC dashboard.
(The raw Flask API runs on `localhost:5000`)

---

## 🐳 Docker Quick Start

```bash
# Build and start all services
docker compose build
docker compose up -d

# Run the attack simulation inside defender container
docker compose exec defender python3 ransomware_sim/simulator.py --speed slow

# Stream defender logs
docker compose logs -f defender

# Open dashboard
xdg-open http://localhost:5000

# Teardown
docker compose down -v
```

---

## 🐍 Miniconda Quick Start

```bash
# Create a local conda environment in .env/ (prefix-based, no global name clash)
conda create --prefix ./.env
conda activate ./.env
pip install -r requirements.txt

# Install React UI dependencies
npm install

# Start full stack (Flask API + React UI)
make dev
# Open http://localhost:5173 in your browser

# In a new terminal — launch slow attack (best for demo)
make attack-slow

# View alerts
make status

# Stop all services when done
make stop

# Reset everything (deletes logs and vault)
make reset

# Deactivate when done
conda deactivate
```

---

## 🔧 Makefile Commands Reference

| Command              | Description                                              |
|----------------------|----------------------------------------------------------|
| `make install`       | `pip install -r requirements.txt`                        |
| `make setup`         | Run canary_placer.py + start daemon + Flask dashboard    |
| `make ui`            | Start the React SOC dashboard (Vite on port 5173)        |
| `make dev`           | Full stack: setup + ui (`localhost:5173`)                |
| `make attack`        | Simulator at normal speed (350ms/file)                   |
| `make attack-slow`   | Simulator at slow speed (900ms/file) ← **demo mode**    |
| `make attack-fast`   | Simulator at fast speed (50ms/file)                      |
| `make status`        | Show last 10 alerts from alerts.json                     |
| `make logs`          | Stream both activity logs                                |
| `make stop`          | Kill daemon + dashboard + UI (no auto-restart)           |
| `make reset`         | stop + delete all runtime files                          |
| `make demo`          | Full scripted demo: setup → 3s → attack-slow             |
| `make integrity`     | One-off SHA-256 integrity check                          |
| `make docker-build`  | `docker compose build`                                   |
| `make docker-up`     | `docker compose up -d`                                   |
| `make docker-down`   | `docker compose down -v`                                 |
| `make docker-attack` | Run simulator inside defender container                  |

---

## 🔍 How It Works

### Phase 1 — Reconnaissance (T1083)

The simulator walks `test_vault/` recursively, building a target file list by extension
(`.xlsx`, `.docx`, `.pdf`, `.db`, `.bak`). This mirrors real ransomware enumeration behaviour.

### Phase 2 — Key Generation

- AES-256 session key generated via `os.urandom(32)` (cryptographically secure CSPRNG)
- RSA-2048 key pair generated locally to simulate C2 key exchange
- AES session key wrapped with RSA-OAEP-SHA256 (attacker holds private key → victim cannot recover AES key)

### Phase 3 — Encryption (T1486 ← PRIMARY)

- Each file encrypted with AES-256-CBC using a **fresh random IV per file**
- PKCS7 padding applied for non-block-aligned plaintext
- Original file deleted; `.locked` extension appended
- Per-file IV prepended to ciphertext in `.locked` file

### Phase 4 — Impact (T1490, T1491)

- `RANSOM_NOTE.txt` dropped in every directory
- VSS shadow deletion simulated (logged, no actual system call — safety)
- Canary files touched via `Path.touch()` → this fires `IN_MODIFY` inotify events

### Defender — Detection Pipeline

1. `watchdog.Observer` fires on any canary path event
2. Offending PID identified via `psutil.process_iter(open_files)`
3. `SIGKILL` sent via `os.kill(pid, signal.SIGKILL)`
4. Vault snapshot: count `.locked` vs unlocked files
5. Detection latency computed (target: **< 2 seconds**)
6. Structured alert written to `alerts.json`
7. Rich terminal panel displayed

### Integrity Monitor (bypass detection)

Every 30 seconds, `IntegrityMonitor.run_once()`:

1. Opens each canary file via raw `os.open()` (harder to hook than `open()`)
2. Computes SHA-256
3. Compares against `canary_manifest.json` baseline
4. Hash mismatch → CRITICAL alert (catches LD_PRELOAD and mmap bypasses)

---

## 🎯 MITRE ATT&CK Mapping

| Technique | Name | Phase | Mitigation |
|-----------|------|-------|------------|
| T1566.001 | Spearphishing Attachment | Initial Access | M1049, M1017 |
| T1059.006 | Python Script Execution | Execution | M1040, M1026 |
| T1083     | File & Directory Discovery | Discovery | M1018 |
| T1027     | Obfuscated Files (encrypted) | Defence Evasion | M1049 |
| **T1486** | **Data Encrypted for Impact** | **Impact** | **M1053, M1040** |
| T1490     | Inhibit System Recovery (VSS) | Impact | M1053, M1028 |
| T1491     | Defacement / Ransom Note | Impact | M1053 |

**Primary Technique: T1486 — Data Encrypted for Impact**  
Adversaries may encrypt data on target systems to interrupt availability.  
[→ attack.mitre.org/techniques/T1486](https://attack.mitre.org/techniques/T1486)

**Key Mitigations:**

- **M1053 — Data Backup:** Maintain offline backups inaccessible to ransomware
- **M1040 — Behavior Prevention on Endpoint:** HIPS/EDR that detects mass file modification
- **M1028 — OS Configuration:** Restrict VSS deletion to admin accounts only

---

## 🔒 Threat Model

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for full STRIDE analysis.

**Assets:**

- Finance files (PII, revenue data, invoices)
- HR records (salary, SSNs, NDAs)
- Engineering source code and architecture
- Legal contracts and litigation notes

**Threat Actors:**

- Financially motivated ransomware groups (REvil, LockBit, ALPHV/BlackCat)
- Initial access via phishing, RDP brute-force, VPN vulnerabilities

**Impact:**

- Complete file system encryption → operational shutdown
- VSS deletion → no local recovery path
- Ransom demand → financial impact

---

## 🚨 Bypass Techniques & Mitigations

| # | Bypass | Severity | Mitigation |
|---|--------|----------|------------|
| 1 | LD_PRELOAD hook suppresses inotify events | HIGH | SHA-256 integrity monitor re-checks every 30s |
| 2 | Canary-aware enumeration (skip dot-files) | CRITICAL | Use varied naming, high-entropy content |
| 3 | inotify queue overflow (>16384 events) | HIGH | Increase max_queued_events sysctl |
| 4 | mmap() in-place encryption | MEDIUM | IN_CLOSE_WRITE event + integrity monitor |
| 5 | Kernel module rootkit (hooks inotify) | CRITICAL | Requires IMA/EVM, Secure Boot, kernel hardening |
| 6 | Canary backup-and-restore before encrypt | HIGH | Monitor ctime (inode change time), TPM attestation |
| 7 | Time-delayed activation (2AM attack) | MEDIUM | 24/7 daemon + SIEM integration (PagerDuty) |

---

## 💪 Defensive Hardening Recommendations

1. **Deploy canary files at scale** — Every directory, every file share, varied naming patterns
2. **Network canaries** — Fake credentials in `.env` files that alert on use (e.g., CanaryTokens.org)
3. **Backup immutability** — Implement WORM (Write Once Read Many) storage for backups (M1053)
4. **EDR integration** — Feed canary alerts into CrowdStrike/Defender ATP for automated containment
5. **Sysctl hardening** — `fs.inotify.max_queued_events=1048576` to prevent queue overflow
6. **Privilege separation** — Ransomware running as standard user cannot touch files owned by backup service account
7. **VSS protection** — Volume Shadow Copy access restricted to SYSTEM account only (M1028)

---

## 📁 Project File Structure

```
ransomwatch/
├── canary_placer.py              # Setup: creates vault + places canary tripwires
├── ransomware_sim/
│   └── simulator.py              # 4-phase ransomware simulation (AES-256-CBC)
├── defender/
│   ├── canary_daemon.py          # inotify watchdog + SIGKILL + alert writer
│   └── integrity_monitor.py     # SHA-256 30s re-hash (LD_PRELOAD bypass detection)
├── dashboard/
│   ├── app.py                    # Flask SOC dashboard (Python)
│   └── templates/
│       └── index.html            # Dark-themed Chart.js dashboard
├── src/                          # React frontend (this interactive demo)
│   ├── App.tsx                   # Main orchestrator + simulation state machine
│   ├── types.ts                  # TypeScript type definitions
│   ├── simulation/
│   │   └── engine.ts             # Simulation logic (phases, helpers)
│   └── components/               # 12 UI components
│       ├── Header.tsx            # Status bar + clock
│       ├── MatrixRain.tsx        # Matrix rain background canvas
│       ├── StatCard.tsx          # Metric cards with glow effects
│       ├── AlertFeed.tsx         # Live alert timeline
│       ├── SimulatorControls.tsx # Attack launch panel
│       ├── LiveChart.tsx         # Recharts bar + area charts
│       ├── CanaryGrid.tsx        # Canary file status grid
│       ├── TerminalLog.tsx       # Terminal-style activity log
│       ├── MitrePanel.tsx        # MITRE ATT&CK technique chain
│       ├── NetworkMap.tsx        # Animated network topology canvas
│       ├── ThreatRadar.tsx       # Radar sweep threat visualiser
│       ├── IntegrityTable.tsx    # Hash integrity check results
│       ├── CodeViewer.tsx        # Syntax-highlighted code snippets
│       ├── FileTreeViewer.tsx    # Animated directory tree
│       └── ReadmeViewer.tsx      # Embedded docs/README tabs
├── docs/
│   └── THREAT_MODEL.md           # Full STRIDE threat model
├── Makefile                      # Build automation (install/setup/attack/demo)
├── docker-compose.yml            # Two-service Docker orchestration
├── Dockerfile.defender           # Defender container (SYS_PTRACE)
├── Dockerfile.dashboard          # Dashboard container (port 5000)
├── requirements.txt              # Pinned Python dependencies
└── environment.yml               # Miniconda environment specification
```

---

## 🎓 Judging Rubric — How This Scores

| Criterion | Marks | What We Demonstrate |
|-----------|-------|---------------------|
| Technical Implementation | 10 | AES-256-CBC, RSA-2048 OAEP, inotify watchdog, SIGKILL, async Flask |
| Security Depth | 8 | T1486 alignment, 7 bypass techniques, C2 simulation, STRIDE analysis |
| Architecture | 6 | On-prem/Docker/Conda, SYS_PTRACE, shared volumes, health checks |
| Communication | 4 | Live SOC dashboard, Matrix rain, 6-tab interface, terminal log |
| Documentation | 2 | README + THREAT_MODEL.md + inline comments + type hints |

---

## 👥 Team & Attribution

**Amrita University Bengaluru — Cybersecurity Hackathon 2024**  
Problem #24: Ransomware Behaviour Simulation & Canary File Detection

---

*This project is for educational purposes only. All ransomware simulation is sandboxed within `test_vault/`
and cannot encrypt real system files. The VAULT_ROOT guard verifies every file path before any operation.*
