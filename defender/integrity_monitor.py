#!/usr/bin/env python3
"""
defender/integrity_monitor.py — SHA-256 Canary Integrity Monitor
=================================================================

Standalone module imported by canary_daemon.py.

Purpose:
  Periodically re-computes SHA-256 hashes of all canary files and
  compares against the baseline stored in canary_manifest.json.

  This provides a SECOND layer of detection that catches ransomware
  bypass techniques that suppress inotify events, such as:

  1. LD_PRELOAD hooks intercepting write() syscalls
  2. Direct /proc/pid/mem manipulation
  3. mmap() in-place encryption (may miss some inotify events)
  4. Kernel module hooking the inotify subsystem

  If a canary's SHA-256 changes WITHOUT a corresponding inotify event
  having been caught by canary_daemon, this monitor will still detect
  the tampering — defence in depth.

Check interval: 30 seconds (configurable via constructor).

Detection flow:
  1. Read canary file bytes directly (bypasses LD_PRELOAD on read path)
  2. Compute SHA-256
  3. Compare to manifest baseline
  4. If mismatch → log CRITICAL + append alert to alerts.json

Author: RansomWatch Team — Amrita University Hackathon 2024
"""

import hashlib
import json
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

log = logging.getLogger("integrity_monitor")

# ── Alert lock (shared with canary_daemon) ────────────────────────────────────
_ALERT_LOCK = threading.Lock()


# ── Integrity alert data structure ───────────────────────────────────────────

def build_integrity_alert(
    file_path: str,
    reason:    str,
    expected:  Optional[str] = None,
    actual:    Optional[str] = None,
) -> dict[str, Any]:
    """Build a structured integrity alert dict.

    Args:
        file_path: Path of the canary file that failed integrity check.
        reason:    Human-readable reason: HASH_CHANGED or FILE_DELETED.
        expected:  Expected SHA-256 hash from manifest baseline.
        actual:    Actual SHA-256 hash computed now (None if file deleted).

    Returns:
        Dict suitable for appending to alerts.json.
    """
    import os
    return {
        "id":          hashlib.sha256(f"{file_path}{time.time()}".encode()).hexdigest()[:24],
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "type":        "INTEGRITY_VIOLATION",
        "event_type":  "HASH_CHANGE",
        "canary_path": file_path,
        "canary_ext":  Path(file_path).suffix,
        "reason":      reason,
        "expected":    expected,
        "actual":      actual,
        "severity":    "CRITICAL",
        "process_killed": False,   # Integrity monitor doesn't kill processes
        "offending_pid":  None,
        "process_name":   "unknown",
        "detection_ms":   0,
        "files_encrypted": 0,
        "files_saved":     0,
    }


def sha256_bytes(data: bytes) -> str:
    """Compute SHA-256 hash of raw bytes.

    Args:
        data: Bytes to hash.

    Returns:
        Lowercase hex-encoded SHA-256 digest.
    """
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    """Compute SHA-256 hash of a file via direct read.

    Note: We use the low-level os.open() approach to read the raw file
    descriptor, which is harder for LD_PRELOAD hooks to intercept than
    the higher-level open() call (though not impossible for kernel hooks).

    Args:
        path: Path to the file to hash.

    Returns:
        Lowercase hex-encoded SHA-256 digest.

    Raises:
        FileNotFoundError: If file does not exist.
        PermissionError:   If file is not readable.
    """
    h = hashlib.sha256()
    # Use raw fd for slightly harder LD_PRELOAD bypass
    import os as _os
    fd = _os.open(str(path), _os.O_RDONLY)
    try:
        while True:
            chunk = _os.read(fd, 65536)
            if not chunk:
                break
            h.update(chunk)
    finally:
        _os.close(fd)
    return h.hexdigest()


def append_alert_to_file(alert: dict[str, Any], alerts_path: Path) -> None:
    """Thread-safe append of an alert to alerts.json.

    Args:
        alert:       Alert dictionary to append.
        alerts_path: Path to alerts.json.
    """
    with _ALERT_LOCK:
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


class IntegrityCheck:
    """Result of a single canary file integrity check.

    Attributes:
        file:      Absolute path of the canary file.
        expected:  SHA-256 from manifest baseline.
        actual:    SHA-256 computed now (None if file missing).
        match:     True if expected == actual and file exists.
        checked_at: ISO timestamp of the check.
        reason:    Reason for mismatch, or 'OK'.
    """

    def __init__(
        self,
        file:       str,
        expected:   str,
        actual:     Optional[str],
        match:      bool,
        checked_at: str,
        reason:     str = "OK",
    ) -> None:
        self.file       = file
        self.expected   = expected
        self.actual     = actual
        self.match      = match
        self.checked_at = checked_at
        self.reason     = reason

    def to_dict(self) -> dict[str, Any]:
        """Serialise to dictionary.

        Returns:
            Dict representation of this integrity check result.
        """
        return {
            "file":       self.file,
            "expected":   self.expected,
            "actual":     self.actual,
            "match":      self.match,
            "checked_at": self.checked_at,
            "reason":     self.reason,
        }


class IntegrityMonitor:
    """Periodic SHA-256 integrity monitor for canary files.

    Runs as a background thread (started by canary_daemon.py).
    Every check_interval seconds, re-hashes all canary files and
    compares to the manifest baseline.

    Design rationale:
    - 30-second interval balances detection speed vs. CPU overhead
    - Uses raw fd reads to reduce LD_PRELOAD hook surface
    - Writes alerts to alerts.json using the same format as canary_daemon
      so the dashboard displays both types of detections uniformly

    Args:
        canaries:        List of canary metadata dicts from manifest.
        alerts_path:     Path to alerts.json for alert persistence.
        check_interval:  Seconds between integrity checks (default: 30).

    Example::

        monitor = IntegrityMonitor(canaries, Path("alerts.json"), 30)
        thread  = threading.Thread(target=monitor.run, daemon=True)
        thread.start()
    """

    def __init__(
        self,
        canaries:       list[dict[str, Any]],
        alerts_path:    Path,
        check_interval: int = 30,
    ) -> None:
        self.canaries       = canaries
        self.alerts_path    = alerts_path
        self.check_interval = check_interval
        self._stop_event    = threading.Event()
        self.last_results: list[IntegrityCheck] = []

    def stop(self) -> None:
        """Signal the monitor to stop on next iteration."""
        self._stop_event.set()

    def run_once(self) -> list[IntegrityCheck]:
        """Perform a single integrity check pass over all canary files.

        Returns:
            List of IntegrityCheck results (one per canary file).
        """
        results: list[IntegrityCheck] = []
        checked_at = datetime.now(timezone.utc).isoformat()

        for entry in self.canaries:
            path     = Path(entry["path"])
            expected = entry["sha256"]

            # ── Check file existence ─────────────────────────────────────
            if not path.exists():
                log.critical(
                    "INTEGRITY — FILE DELETED: %s (expected sha256: %s…)",
                    path.name, expected[:16],
                )
                result = IntegrityCheck(
                    file       = str(path),
                    expected   = expected,
                    actual     = None,
                    match      = False,
                    checked_at = checked_at,
                    reason     = "FILE_DELETED",
                )
                results.append(result)

                # Write integrity alert
                alert = build_integrity_alert(
                    file_path = str(path),
                    reason    = "FILE_DELETED",
                    expected  = expected,
                    actual    = None,
                )
                append_alert_to_file(alert, self.alerts_path)
                continue

            # ── Compute current hash ──────────────────────────────────────
            try:
                actual = sha256_file(path)
            except PermissionError:
                log.warning("INTEGRITY — Cannot read: %s (permission denied)", path)
                actual = "UNREADABLE"

            match = (actual == expected)

            if not match:
                log.critical(
                    "INTEGRITY — HASH MISMATCH: %s\n"
                    "  Expected: %s\n"
                    "  Actual:   %s\n"
                    "  This may indicate LD_PRELOAD bypass or in-place encryption!",
                    path.name, expected, actual,
                )
                result = IntegrityCheck(
                    file       = str(path),
                    expected   = expected,
                    actual     = actual,
                    match      = False,
                    checked_at = checked_at,
                    reason     = "HASH_CHANGED",
                )
                results.append(result)

                # Write integrity alert
                alert = build_integrity_alert(
                    file_path = str(path),
                    reason    = "HASH_CHANGED",
                    expected  = expected,
                    actual    = actual,
                )
                append_alert_to_file(alert, self.alerts_path)
            else:
                log.debug("INTEGRITY — OK: %s", path.name)
                result = IntegrityCheck(
                    file       = str(path),
                    expected   = expected,
                    actual     = actual,
                    match      = True,
                    checked_at = checked_at,
                    reason     = "OK",
                )
                results.append(result)

        ok_count      = sum(1 for r in results if r.match)
        tampered_count = len(results) - ok_count
        log.info(
            "INTEGRITY check complete: %d OK, %d TAMPERED",
            ok_count, tampered_count,
        )
        self.last_results = results
        return results

    def run(self) -> None:
        """Main loop — run integrity checks every check_interval seconds.

        This method is designed to be called from a daemon thread.
        It blocks until stop() is called.
        """
        log.info(
            "IntegrityMonitor started — check interval: %ds",
            self.check_interval,
        )
        while not self._stop_event.is_set():
            self.run_once()
            # Sleep in 1-second intervals to allow clean shutdown
            for _ in range(self.check_interval):
                if self._stop_event.is_set():
                    break
                time.sleep(1)

        log.info("IntegrityMonitor stopped")
