#!/usr/bin/env python3
"""
dashboard/app.py — RansomWatch SOC Dashboard Flask Application
==============================================================

Serves a real-time Security Operations Centre (SOC) dashboard
that visualises ransomware simulation progress and canary detections.

Endpoints:
  GET /           → HTML dashboard page (dark-themed SOC UI)
  GET /api/alerts → Returns alerts.json as JSON array
  GET /api/stats  → Returns live file counts (total/encrypted/saved/canaries)
  GET /api/status → Returns current system status string

The dashboard auto-refreshes every 2 seconds via JavaScript fetch()
calls to /api/alerts and /api/stats.

Architecture note:
  This service is designed to run as a separate Docker container
  alongside the defender service, sharing test_vault/ and alerts.json
  via Docker volumes. No database required — file-based state only.

Usage:
    python3 dashboard/app.py [--host 0.0.0.0] [--port 5000]

Author: RansomWatch Team — Amrita University Hackathon 2024
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from flask import Flask, jsonify, render_template, Response
from flask.typing import ResponseReturnValue

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-8s] %(name)s — %(message)s",
)
log = logging.getLogger("dashboard")

# ── Flask app ─────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
app = Flask(__name__, template_folder=str(BASE_DIR / "templates"))

# ── Configurable paths ────────────────────────────────────────────────────────
ALERTS_PATH   = Path(os.environ.get("ALERTS_PATH",   "alerts.json"))
VAULT_ROOT    = Path(os.environ.get("VAULT_ROOT",    "test_vault"))
MANIFEST_PATH = Path(os.environ.get("MANIFEST_PATH", "canary_manifest.json"))


# ── Helper functions ──────────────────────────────────────────────────────────

def load_alerts() -> list[dict]:
    """Load and return all alerts from alerts.json.

    Returns:
        List of alert dicts, empty list if file missing or malformed.
    """
    if not ALERTS_PATH.exists():
        return []
    try:
        with ALERTS_PATH.open() as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        log.warning("Could not load alerts: %s", exc)
        return []


def compute_vault_stats() -> dict:
    """Walk test_vault/ in real-time to compute live file counts.

    This gives the dashboard accurate numbers without depending on
    the simulator to report its own progress. Walks the actual
    filesystem every time the endpoint is polled.

    Returns:
        Dict with: total, encrypted, saved, canaries_active,
        ransom_note_dropped, vss_simulated.
    """
    if not VAULT_ROOT.exists():
        return {
            "total":              0,
            "encrypted":          0,
            "saved":              0,
            "canaries_active":    0,
            "ransom_note_dropped": False,
            "vss_simulated":      False,
        }

    total     = 0
    encrypted = 0
    canaries  = 0
    ransom_note_found = False

    for path in VAULT_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.name == "RANSOM_NOTE.txt":
            ransom_note_found = True
            continue
        if path.name.startswith(".canary_"):
            canaries += 1
            total    += 1
            continue
        if path.suffix == ".locked":
            encrypted += 1
            total     += 1
        else:
            total += 1

    saved = total - encrypted

    return {
        "total":              total,
        "encrypted":          encrypted,
        "saved":              saved,
        "canaries_active":    canaries,
        "ransom_note_dropped": ransom_note_found,
        "vss_simulated":      ransom_note_found,  # VSS sim happens at same time
    }


def load_manifest_summary() -> dict:
    """Load summary from canary_manifest.json.

    Returns:
        Summary dict with canary count and placement info.
    """
    if not MANIFEST_PATH.exists():
        return {"canary_count": 0}
    try:
        with MANIFEST_PATH.open() as fh:
            manifest = json.load(fh)
        return {
            "canary_count":   len(manifest.get("canaries", [])),
            "decoy_count":    len(manifest.get("decoys",   [])),
            "created_at":     manifest.get("created_at", "unknown"),
            "canaries":       manifest.get("canaries", []),
        }
    except (json.JSONDecodeError, OSError):
        return {"canary_count": 0}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index() -> ResponseReturnValue:
    """Serve the SOC dashboard HTML page.

    Returns:
        Rendered dashboard HTML.
    """
    manifest = load_manifest_summary()
    return render_template(
        "index.html",
        canary_count = manifest.get("canary_count", 0),
        decoy_count  = manifest.get("decoy_count",  0),
    )


@app.route("/api/alerts")
def api_alerts() -> ResponseReturnValue:
    """Return all alerts as a JSON array.

    The dashboard polls this every 2 seconds via JavaScript fetch().

    Returns:
        JSON array of alert objects.
    """
    alerts = load_alerts()
    response = jsonify(alerts)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@app.route("/api/stats")
def api_stats() -> ResponseReturnValue:
    """Return live vault file statistics.

    Walks test_vault/ in real-time to count encrypted vs saved files.

    Returns:
        JSON object with total/encrypted/saved/canaries_active counts.
    """
    stats    = compute_vault_stats()
    alerts   = load_alerts()
    manifest = load_manifest_summary()

    stats["alerts_count"]    = len(alerts)
    stats["canary_total"]    = manifest.get("canary_count", 0)

    if alerts:
        latencies = [a.get("detection_ms", 0) for a in alerts if "detection_ms" in a]
        stats["fastest_detection_ms"] = min(latencies) if latencies else 0
        stats["avg_detection_ms"]     = int(sum(latencies) / len(latencies)) if latencies else 0
    else:
        stats["fastest_detection_ms"] = 0
        stats["avg_detection_ms"]     = 0

    response = jsonify(stats)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@app.route("/api/status")
def api_status() -> ResponseReturnValue:
    """Return current system status string.

    Returns:
        JSON object with status field: ARMED / TRIGGERED / CONTAINED.
    """
    alerts = load_alerts()
    stats  = compute_vault_stats()

    if alerts and stats["encrypted"] == 0:
        status = "CONTAINED"
    elif alerts or stats["encrypted"] > 0:
        status = "TRIGGERED"
    else:
        status = "ARMED"

    return jsonify({"status": status, "timestamp": __import__("datetime").datetime.utcnow().isoformat()})


@app.route("/api/manifest")
def api_manifest() -> ResponseReturnValue:
    """Return canary manifest metadata.

    Returns:
        JSON object with canary file metadata.
    """
    manifest = load_manifest_summary()
    return jsonify(manifest)


@app.route("/health")
def health() -> ResponseReturnValue:
    """Health check endpoint for Docker HEALTHCHECK.

    Returns:
        JSON {"status": "ok"} with 200 status code.
    """
    return jsonify({"status": "ok", "service": "ransomwatch-dashboard"})


# ── CLI entry point ───────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed argument namespace with host and port.
    """
    parser = argparse.ArgumentParser(
        description="RansomWatch — SOC Dashboard (Flask)",
    )
    parser.add_argument("--host",  default="0.0.0.0", help="Bind host")
    parser.add_argument("--port",  type=int, default=5000, help="Bind port")
    parser.add_argument("--debug", action="store_true", help="Flask debug mode")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    log.info("RansomWatch Dashboard starting on %s:%d", args.host, args.port)
    log.info("Vault:    %s", VAULT_ROOT.resolve())
    log.info("Alerts:   %s", ALERTS_PATH.resolve())
    log.info("Manifest: %s", MANIFEST_PATH.resolve())
    app.run(
        host  = args.host,
        port  = args.port,
        debug = args.debug,
    )
