# ============================================================
# Makefile — RansomWatch Build & Demo Automation
# Compatible with Ubuntu 24.04 / Arch Linux
# Requires: Python 3.10+, pip, make
# ============================================================

PYTHON     := python3
PIP        := pip3
VAULT      := test_vault
ALERTS     := alerts.json
LOG        := ransomwatch_activity.log
MANIFEST   := canary_manifest.json
DAEMON_PID := .daemon.pid
DASH_PID   := .dashboard.pid

.DEFAULT_GOAL := help

# ── Help ──────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  ◈ RansomWatch — Canary File Detection System"
	@echo "  ─────────────────────────────────────────────────────────"
	@echo "  make install      → Install all Python dependencies"
	@echo "  make setup        → Place canary files, start daemon + dashboard"
	@echo "  make attack       → Run simulator at NORMAL speed (350ms/file)"
	@echo "  make attack-slow  → Run simulator at SLOW speed  (900ms/file)  ← demo"
	@echo "  make attack-fast  → Run simulator at FAST speed  (50ms/file)"
	@echo "  make status       → Show last 10 alerts from alerts.json"
	@echo "  make logs         → Stream ransomwatch_activity.log"
	@echo "  make reset        → Kill everything, delete vault, re-run setup"
	@echo "  make demo         → Full scripted demo: setup → 3s pause → attack-slow"
	@echo "  make integrity    → Run a one-off integrity check"
	@echo "  make clean        → Remove generated files (not vault)"
	@echo "  ─────────────────────────────────────────────────────────"
	@echo "  Docker targets:"
	@echo "  make docker-build → docker compose build"
	@echo "  make docker-up    → docker compose up -d"
	@echo "  make docker-down  → docker compose down -v"
	@echo "  make docker-logs  → docker compose logs -f defender"
	@echo "  ─────────────────────────────────────────────────────────"
	@echo ""

# ── Install dependencies ──────────────────────────────────────
.PHONY: install
install:
	@echo "[*] Installing Python dependencies..."
	$(PIP) install -r requirements.txt
	@echo "[+] Dependencies installed."

# ── Setup: place canaries, start daemon + dashboard ───────────
.PHONY: setup
setup: _ensure_deps _clean_pids
	@echo "[*] Placing canary files..."
	$(PYTHON) canary_placer.py --verbose
	@echo "[+] Canary files placed. Manifest: $(MANIFEST)"
	@echo "[*] Starting canary daemon in background..."
	$(PYTHON) defender/canary_daemon.py \
		--manifest $(MANIFEST) \
		--alerts   $(ALERTS) \
		--vault    $(VAULT)   \
		> $(LOG) 2>&1 & echo $$! > $(DAEMON_PID)
	@echo "[+] Daemon started (PID $$(cat $(DAEMON_PID)))"
	@echo "[*] Starting Flask dashboard in background..."
	$(PYTHON) dashboard/app.py --host 0.0.0.0 --port 5000 \
		>> $(LOG) 2>&1 & echo $$! > $(DASH_PID)
	@sleep 1
	@echo "[+] Dashboard started (PID $$(cat $(DASH_PID)))"
	@echo "[+] SOC Dashboard: http://localhost:5000"
	@echo "[+] Setup complete. System ARMED."

# ── Attack: normal speed ──────────────────────────────────────
.PHONY: attack
attack: _ensure_vault
	@echo "[*] Launching ransomware simulation (NORMAL speed)..."
	$(PYTHON) ransomware_sim/simulator.py \
		--speed  normal \
		--vault  $(VAULT) \
		--manifest $(MANIFEST)
	@echo "[+] Simulation complete. Check dashboard: http://localhost:5000"

# ── Attack: slow speed (best for live demo) ───────────────────
.PHONY: attack-slow
attack-slow: _ensure_vault
	@echo "[*] Launching ransomware simulation (SLOW speed — best for demo)..."
	$(PYTHON) ransomware_sim/simulator.py \
		--speed  slow \
		--vault  $(VAULT) \
		--manifest $(MANIFEST)
	@echo "[+] Simulation complete."

# ── Attack: fast speed ────────────────────────────────────────
.PHONY: attack-fast
attack-fast: _ensure_vault
	@echo "[*] Launching ransomware simulation (FAST speed)..."
	$(PYTHON) ransomware_sim/simulator.py \
		--speed  fast \
		--vault  $(VAULT) \
		--manifest $(MANIFEST)
	@echo "[+] Simulation complete."

# ── Status: show recent alerts ────────────────────────────────
.PHONY: status
status:
	@echo "[*] Recent alerts from $(ALERTS):"
	@if [ -f $(ALERTS) ]; then \
		$(PYTHON) -c "import json,sys; alerts=json.load(open('$(ALERTS)')); \
		[print(f\"  [{a['timestamp']}] {a.get('canary_path','?').split('/')[-1]} \
		PID:{a.get('offending_pid','?')} \
		latency:{a.get('detection_ms',0)}ms \
		severity:{a.get('severity','?')}\") \
		for a in alerts[-10:]] or print('  No alerts yet.')"; \
	else \
		echo "  No alerts file found."; \
	fi

# ── Logs: stream activity log ─────────────────────────────────
.PHONY: logs
logs:
	@echo "[*] Streaming $(LOG) (Ctrl+C to stop)..."
	tail -f $(LOG)

# ── Integrity: one-off check ──────────────────────────────────
.PHONY: integrity
integrity:
	@echo "[*] Running integrity check..."
	$(PYTHON) -c "\
	import json, sys; \
	sys.path.insert(0, '.'); \
	from pathlib import Path; \
	from defender.integrity_monitor import IntegrityMonitor; \
	m = json.load(open('$(MANIFEST)')); \
	monitor = IntegrityMonitor(m['canaries'], Path('$(ALERTS)'), 30); \
	results = monitor.run_once(); \
	ok = sum(1 for r in results if r.match); \
	print(f'Results: {ok}/{len(results)} canaries intact'); \
	"

# ── Reset: kill everything, delete vault, re-setup ────────────
.PHONY: reset
reset:
	@echo "[*] Resetting environment..."
	@-[ -f $(DAEMON_PID) ] && kill $$(cat $(DAEMON_PID)) 2>/dev/null; rm -f $(DAEMON_PID)
	@-[ -f $(DASH_PID)   ] && kill $$(cat $(DASH_PID))   2>/dev/null; rm -f $(DASH_PID)
	@-pkill -f "canary_daemon.py"  2>/dev/null || true
	@-pkill -f "dashboard/app.py"  2>/dev/null || true
	@rm -rf $(VAULT) $(ALERTS) $(MANIFEST) $(LOG)
	@echo "[+] Environment cleaned."
	@$(MAKE) setup

# ── Demo: full scripted demo sequence ─────────────────────────
.PHONY: demo
demo:
	@echo ""
	@echo "  ╔══════════════════════════════════════════════════════╗"
	@echo "  ║   RansomWatch — Live Hackathon Demo                  ║"
	@echo "  ║   Amrita University, Bengaluru — Problem #24         ║"
	@echo "  ╚══════════════════════════════════════════════════════╝"
	@echo ""
	@$(MAKE) reset
	@echo "[*] Waiting 3 seconds for services to arm..."
	@sleep 3
	@echo "[*] Launching attack simulation (slow mode for demo)..."
	@$(MAKE) attack-slow

# ── Docker targets ────────────────────────────────────────────
.PHONY: docker-build
docker-build:
	docker compose build

.PHONY: docker-up
docker-up:
	docker compose up -d
	@echo "[+] Services started:"
	@echo "    Defender:  docker compose logs -f defender"
	@echo "    Dashboard: http://localhost:5000"

.PHONY: docker-down
docker-down:
	docker compose down -v

.PHONY: docker-logs
docker-logs:
	docker compose logs -f defender

.PHONY: docker-attack
docker-attack:
	docker compose exec defender python3 ransomware_sim/simulator.py --speed slow

# ── Internal helpers ──────────────────────────────────────────
.PHONY: _ensure_deps
_ensure_deps:
	@$(PYTHON) -c "import cryptography, watchdog, psutil, flask, rich" 2>/dev/null || \
		(echo "[!] Dependencies missing. Run: make install"; exit 1)

.PHONY: _ensure_vault
_ensure_vault:
	@[ -d $(VAULT) ] || (echo "[!] Vault not found. Run: make setup"; exit 1)
	@[ -f $(MANIFEST) ] || (echo "[!] Manifest not found. Run: make setup"; exit 1)

.PHONY: _clean_pids
_clean_pids:
	@-[ -f $(DAEMON_PID) ] && kill $$(cat $(DAEMON_PID)) 2>/dev/null || true
	@-[ -f $(DASH_PID)   ] && kill $$(cat $(DASH_PID))   2>/dev/null || true
	@rm -f $(DAEMON_PID) $(DASH_PID)

.PHONY: clean
clean:
	@rm -f $(ALERTS) $(LOG) $(DAEMON_PID) $(DASH_PID)
	@find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	@find . -name "*.pyc" -delete 2>/dev/null || true
	@echo "[+] Cleaned generated files."
