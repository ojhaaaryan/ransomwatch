#!/usr/bin/env python3
"""
defender/canary_daemon.py — Canary File Watchdog Daemon
========================================================

Monitors all canary file paths defined in canary_manifest.json
using the watchdog library (which uses inotify on Linux).

Monitored events:
  IN_ACCESS  — File was read (potential enumeration)
  IN_MODIFY  — File content was changed (encryption in progress)
  IN_OPEN    — File was opened
  IN_DELETE  — File was deleted (encryption + rename)

On any canary event:
  a) Records detection timestamp (target: <2 seconds from event)
  b) Identifies offending PID via psutil open-file handle enumeration
  c) Sends SIGKILL to the offending process
  d) Takes a vault snapshot (count saved vs encrypted files)
  e) Writes a structured JSON alert to alerts.json
  f) Prints a formatted terminal alert via rich library

Also launches IntegrityMonitor in a background thread for
hash-based detection of inotify bypass attempts (LD_PRELOAD hooks).

Usage:
    python3 defender/canary_daemon.py [--manifest PATH] [--alerts PATH] [--vault PATH]

Author: RansomWatch Team — Amrita University Hackathon 2024
"""

import json
import logging
import os
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import psutil
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

# Import the integrity monitor module
sys.path.insert(0, str(Path(__file__).parent.parent))
from defender.integrity_monitor import IntegrityMonitor

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_PATH = Path("ransomwatch_activity.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-8s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_PATH, mode="a", encoding="utf-8"),
    ],
)
log = logging.getLogger("canary_daemon")

# Rich console for coloured terminal output
console = Console(highlight=False)

# ── Constants ─────────────────────────────────────────────────────────────────
DEFAULT_MANIFEST = Path("canary_manifest.json")
DEFAULT_ALERTS   = Path("alerts.json")
DEFAULT_VAULT    = Path("test_vault")
ALERT_LOCK       = threading.Lock()


# ── Alert data structure ──────────────────────────────────────────────────────

def build_alert_dict(
    canary_path:      str,
    canary_ext:       str,
    event_type:       str,
    offending_pid:    Optional[int],
    process_name:     str,
    detection_ms:     int,
    files_encrypted:  int,
    files_saved:      int,
    process_killed:   bool,
) -> dict[str, Any]:
    """Build a structured alert dictionary.

    Args:
        canary_path:     Full path of the triggered canary file.
        canary_ext:      File extension of the canary (.xlsx, etc.).
        event_type:      inotify event type string.
        offending_pid:   PID of the process that touched the canary.
        process_name:    Name of the offending process.
        detection_ms:    Milliseconds from event to detection completion.
        files_encrypted: Count of .locked files in vault at detection time.
        files_saved:     Count of unlocked files in vault at detection time.
        process_killed:  Whether SIGKILL was sent successfully.

    Returns:
        Dict suitable for JSON serialisation to alerts.json.
    """
    import hashlib
    alert_id = hashlib.sha256(
        f"{canary_path}{datetime.now().isoformat()}".encode()
    ).hexdigest()[:24]

    return {
        "id":              alert_id,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "canary_path":     canary_path,
        "canary_ext":      canary_ext,
        "event_type":      event_type,
        "offending_pid":   offending_pid,
        "process_name":    process_name,
        "detection_ms":    detection_ms,
        "files_encrypted": files_encrypted,
        "files_saved":     files_saved,
        "process_killed":  process_killed,
        "severity":        _compute_severity(files_encrypted, files_saved + files_encrypted),
    }


def _compute_severity(encrypted: int, total: int) -> str:
    """Compute alert severity based on encryption ratio.

    Args:
        encrypted: Number of encrypted files.
        total:     Total file count.

    Returns:
        Severity string: LOW / MEDIUM / HIGH / CRITICAL
    """
    if total == 0:
        return "LOW"
    ratio = encrypted / total
    if ratio < 0.05:  return "MEDIUM"
    if ratio < 0.20:  return "HIGH"
    return "CRITICAL"


# ── Vault snapshot ────────────────────────────────────────────────────────────

def snapshot_vault(vault_root: Path) -> tuple[int, int]:
    """Count encrypted vs unlocked files in the vault.

    Args:
        vault_root: Root directory of the file vault.

    Returns:
        Tuple of (encrypted_count, saved_count).
    """
    encrypted = 0
    saved     = 0
    for path in vault_root.rglob("*"):
        if not path.is_file():
            continue
        if path.name in ("RANSOM_NOTE.txt",):
            continue
        if path.suffix == ".locked":
            encrypted += 1
        else:
            saved += 1
    return encrypted, saved


# ── PID identification ────────────────────────────────────────────────────────

def find_offending_pid(target_path: str) -> Optional[int]:
    """Identify the process holding an open handle to target_path.

    Uses psutil to enumerate all open file handles across all processes
    and cross-reference against the canary path. This requires the
    SYS_PTRACE capability in Docker (see docker-compose.yml).

    Args:
        target_path: Absolute path of the canary file that was triggered.

    Returns:
        PID of the offending process, or None if not found.
    """
    try:
        for proc in psutil.process_iter(["pid", "name", "open_files"]):
            try:
                open_files = proc.info.get("open_files") or []
                for of in open_files:
                    if of.path == target_path:
                        log.info(
                            "Offending PID identified: %d (%s)",
                            proc.info["pid"],
                            proc.info["name"],
                        )
                        return proc.info["pid"]
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except Exception as exc:
        log.warning("PID identification failed: %s", exc)
    return None


def kill_process(pid: int) -> bool:
    """Send SIGKILL to the offending process.

    Args:
        pid: Process ID to kill.

    Returns:
        True if SIGKILL was sent, False if process was already dead.
    """
    try:
        os.kill(pid, signal.SIGKILL)
        log.warning("SIGKILL sent to PID %d", pid)
        return True
    except ProcessLookupError:
        log.warning("PID %d already terminated before SIGKILL", pid)
        return False
    except PermissionError:
        log.error("Permission denied killing PID %d (need CAP_KILL)", pid)
        return False


# ── Alert persistence ─────────────────────────────────────────────────────────

def append_alert(alert: dict[str, Any], alerts_path: Path) -> None:
    """Append an alert to alerts.json in a thread-safe manner.

    Args:
        alert:       The alert dictionary to append.
        alerts_path: Path to the alerts JSON file.
    """
    with ALERT_LOCK:
        existing: list[dict[str, Any]] = []
        if alerts_path.exists():
            try:
                with alerts_path.open() as fh:
                    existing = json.load(fh)
            except (json.JSONDecodeError, OSError):
                existing = []

        existing.append(alert)

        with alerts_path.open("w") as fh:
            json.dump(existing, fh, indent=2)

    log.info("Alert written to %s [ID: %s]", alerts_path, alert["id"])


# ── Rich terminal display ─────────────────────────────────────────────────────

def display_alert(alert: dict[str, Any]) -> None:
    """Print a formatted terminal alert using rich library.

    Args:
        alert: The alert dictionary to display.
    """
    severity = alert["severity"]
    color_map = {
        "LOW":      "green",
        "MEDIUM":   "yellow",
        "HIGH":     "red",
        "CRITICAL": "bold red",
    }
    color = color_map.get(severity, "red")

    table = Table(show_header=False, box=None, padding=(0, 1))
    table.add_column("key",   style="dim")
    table.add_column("value", style=color)

    table.add_row("Canary",    str(alert["canary_path"]).split("/")[-1])
    table.add_row("Extension", alert["canary_ext"])
    table.add_row("Event",     alert["event_type"])
    table.add_row("PID",       str(alert["offending_pid"]))
    table.add_row("Process",   alert["process_name"])
    table.add_row("Latency",   f"{alert['detection_ms']}ms")
    table.add_row("Encrypted", str(alert["files_encrypted"]))
    table.add_row("Saved",     str(alert["files_saved"]))
    table.add_row("SIGKILL",   "✓ SENT" if alert["process_killed"] else "✗ FAILED")

    panel = Panel(
        table,
        title=Text(f"⚡ CANARY TRIGGERED — {severity}", style=f"bold {color}"),
        border_style=color,
        padding=(1, 2),
    )
    console.print(panel)


# ── Watchdog event handler ────────────────────────────────────────────────────

class CanaryEventHandler(FileSystemEventHandler):
    """watchdog event handler for canary file monitoring.

    Reacts to any filesystem event on registered canary paths.
    Detection pipeline:
    1. Record event timestamp
    2. Verify event is on a canary path
    3. Find offending PID via psutil
    4. Send SIGKILL
    5. Snapshot vault
    6. Write alert to alerts.json
    7. Display rich terminal alert

    Args:
        canary_set:  Set of absolute canary path strings to watch.
        manifest:    Parsed canary manifest dict.
        vault_root:  Root of the file vault for snapshot counts.
        alerts_path: Path to alerts.json.
    """

    def __init__(
        self,
        canary_set:  set[str],
        manifest:    dict[str, Any],
        vault_root:  Path,
        alerts_path: Path,
    ) -> None:
        """Initialise the event handler.

        Args:
            canary_set:  Set of absolute canary file path strings.
            manifest:    Parsed canary_manifest.json content.
            vault_root:  Root of the file vault.
            alerts_path: Output path for alerts.json.
        """
        super().__init__()
        self.canary_set  = canary_set
        self.manifest    = manifest
        self.vault_root  = vault_root
        self.alerts_path = alerts_path
        self._triggered: set[str] = set()    # Track already-alerted paths
        self._lock       = threading.Lock()

    def on_any_event(self, event: FileSystemEvent) -> None:
        """Handle any filesystem event.

        Called by watchdog for every inotify event. We filter to
        canary paths only and de-duplicate rapid re-triggers.

        Args:
            event: The filesystem event from watchdog.
        """
        if event.is_directory:
            return

        src_path = str(Path(event.src_path).resolve())

        # Only react to canary paths
        if src_path not in self.canary_set:
            return

        # De-duplicate: one alert per canary per 5s window
        with self._lock:
            if src_path in self._triggered:
                return
            self._triggered.add(src_path)

        detected_at = datetime.now(timezone.utc)

        log.warning(
            "CANARY TRIGGERED: %s  event=%s",
            Path(src_path).name,
            event.event_type,
        )
        console.print(
            f"[bold red]⚡ CANARY TRIGGERED:[/] "
            f"[yellow]{Path(src_path).name}[/] "
            f"— event: [cyan]{event.event_type}[/]"
        )

        # ── Find offending PID ───────────────────────────────────────────────
        pid = find_offending_pid(src_path)

        # Find process name
        proc_name = "unknown"
        if pid:
            try:
                proc_name = psutil.Process(pid).name()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                proc_name = "already_dead"

        # ── SIGKILL ──────────────────────────────────────────────────────────
        killed = False
        if pid:
            killed = kill_process(pid)
            if killed:
                console.print(f"[bold green]✓ SIGKILL → PID {pid} ({proc_name})[/]")
            else:
                console.print(f"[yellow]⚠ PID {pid} already dead[/]")

        # ── Vault snapshot ───────────────────────────────────────────────────
        encrypted, saved = snapshot_vault(self.vault_root)

        # ── Compute detection latency ────────────────────────────────────────
        detection_ms = int(
            (datetime.now(timezone.utc) - detected_at).total_seconds() * 1000
        )

        # ── Find canary extension ────────────────────────────────────────────
        canary_ext = Path(src_path).suffix

        # ── Build and persist alert ──────────────────────────────────────────
        alert = build_alert_dict(
            canary_path     = src_path,
            canary_ext      = canary_ext,
            event_type      = event.event_type.upper(),
            offending_pid   = pid,
            process_name    = proc_name,
            detection_ms    = detection_ms,
            files_encrypted = encrypted,
            files_saved     = saved,
            process_killed  = killed,
        )
        append_alert(alert, self.alerts_path)
        display_alert(alert)

        # Re-allow this canary to trigger again after 5s
        threading.Timer(5.0, lambda: self._triggered.discard(src_path)).start()


# ── Daemon main ───────────────────────────────────────────────────────────────

def load_manifest(manifest_path: Path) -> dict[str, Any]:
    """Load and parse canary_manifest.json.

    Args:
        manifest_path: Path to the manifest file.

    Returns:
        Parsed manifest as a dict.

    Raises:
        FileNotFoundError: If manifest does not exist.
        json.JSONDecodeError: If manifest is malformed.
    """
    if not manifest_path.exists():
        raise FileNotFoundError(
            f"Manifest not found: {manifest_path}. "
            f"Run canary_placer.py first."
        )
    with manifest_path.open() as fh:
        manifest = json.load(fh)
    log.info(
        "Loaded manifest: %d canaries, %d decoys",
        len(manifest.get("canaries", [])),
        len(manifest.get("decoys", [])),
    )
    return manifest


def run_daemon(
    manifest_path: Path = DEFAULT_MANIFEST,
    alerts_path:   Path = DEFAULT_ALERTS,
    vault_root:    Path = DEFAULT_VAULT,
) -> None:
    """Start the canary watchdog daemon.

    Launches a watchdog Observer on the vault root with an event handler
    that filters to canary paths. Also starts the IntegrityMonitor thread.
    Runs until SIGINT/SIGTERM.

    Args:
        manifest_path: Path to canary_manifest.json.
        alerts_path:   Output path for alerts.json.
        vault_root:    Root of the file vault to watch.
    """
    manifest = load_manifest(manifest_path)
    canaries = manifest.get("canaries", [])

    if not canaries:
        log.error("No canary files in manifest — exiting")
        return

    # Build absolute path set for fast O(1) lookup
    canary_set: set[str] = set()
    for entry in canaries:
        p = Path(entry["path"]).resolve()
        canary_set.add(str(p))
        log.info("Monitoring canary: %s", p)

    # ── Start integrity monitor in background thread ──────────────────────
    integrity_mon = IntegrityMonitor(
        canaries     = canaries,
        alerts_path  = alerts_path,
        check_interval = 30,
    )
    int_thread = threading.Thread(target=integrity_mon.run, daemon=True, name="integrity_monitor")
    int_thread.start()
    log.info("IntegrityMonitor started (30s interval)")

    # ── Start watchdog observer ───────────────────────────────────────────
    handler  = CanaryEventHandler(canary_set, manifest, vault_root, alerts_path)
    observer = Observer()
    observer.schedule(handler, str(vault_root), recursive=True)
    observer.start()

    console.print(
        Panel(
            f"[bold green]RansomWatch Defender v2.4.1 — ARMED[/]\n"
            f"Monitoring [cyan]{len(canary_set)}[/] canary paths in "
            f"[yellow]{vault_root}[/]\n"
            f"Alerts → [magenta]{alerts_path}[/]",
            title="[bold green]◈ CANARY DAEMON ACTIVE[/]",
            border_style="green",
        )
    )
    log.info("watchdog.Observer started — monitoring %d canary paths", len(canary_set))

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Shutdown signal received")
    finally:
        observer.stop()
        observer.join()
        log.info("watchdog.Observer stopped")


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="RansomWatch — Canary File Watchdog Daemon",
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--alerts",   type=Path, default=DEFAULT_ALERTS)
    parser.add_argument("--vault",    type=Path, default=DEFAULT_VAULT)
    args = parser.parse_args()

    run_daemon(
        manifest_path = args.manifest,
        alerts_path   = args.alerts,
        vault_root    = args.vault,
    )
