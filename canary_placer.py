#!/usr/bin/env python3
"""
canary_placer.py — RansomWatch Canary File Placement Module
============================================================

Creates a realistic directory structure under test_vault/ simulating
an enterprise office file server, then:

  1. Places 5 hidden canary files (xlsx, docx, pdf, db, bak) in
     strategic high-value directories.
  2. Records canary metadata (path, inode, sha256, placement timestamp)
     to canary_manifest.json for the defender to consume.
  3. Creates 30+ realistic decoy files (reports, invoices, HR docs)
     so the simulator has real targets to encrypt.

MITRE ATT&CK Context:
  This module represents the DEFENDER setup phase — placing tripwires
  (canary files) that the ransomware simulation will inevitably touch.

Usage:
    python3 canary_placer.py [--vault PATH] [--verbose]

Author: RansomWatch Team — Amrita University Hackathon 2024
"""

import argparse
import hashlib
import json
import logging
import os
import random
import string
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── Logging configuration ─────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-8s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("canary_placer")

# ── Constants ─────────────────────────────────────────────────────────────────
DEFAULT_VAULT = Path("test_vault")
MANIFEST_PATH = Path("canary_manifest.json")

# Directory structure simulating an enterprise file server
VAULT_DIRS = [
    "finance",
    "finance/archive",
    "hr",
    "hr/archive",
    "engineering",
    "engineering/architecture",
    "legal",
    "legal/contracts",
    "ops",
    "ops/configs",
    "media",
    "shared",
]

# Canary file definitions: (filename, parent_dir_key)
CANARY_DEFINITIONS = [
    (".canary_2024_q4_forecast.xlsx",    "finance"),
    (".canary_employee_ssn_backup.docx", "hr"),
    (".canary_db_master_backup.db",      "ops"),
    (".canary_source_master.bak",        "engineering"),
    (".canary_litigation_evidence.pdf",  "legal"),
]

# Decoy file definitions: (filename, parent_dir_key, content_generator)
DECOY_DEFINITIONS = [
    # Finance
    ("Q1_Revenue_Report_2024.xlsx",    "finance",          "xlsx"),
    ("Q2_Revenue_Report_2024.xlsx",    "finance",          "xlsx"),
    ("Q3_Revenue_Report_2024.xlsx",    "finance",          "xlsx"),
    ("Annual_Budget_2024.xlsx",        "finance",          "xlsx"),
    ("Payroll_March_2024.xlsx",        "finance",          "xlsx"),
    ("Invoice_INV-2024-0091.pdf",      "finance",          "pdf"),
    ("Invoice_INV-2024-0092.pdf",      "finance",          "pdf"),
    ("Invoice_INV-2024-0093.pdf",      "finance",          "pdf"),
    ("Tax_Filings_FY2023.pdf",         "finance",          "pdf"),
    ("Bank_Statements_Jan2024.pdf",    "finance",          "pdf"),
    ("Audit_Report_2023.pdf",          "finance/archive",  "pdf"),
    # HR
    ("Employee_Records_2024.xlsx",     "hr",               "xlsx"),
    ("Salary_Structure_Confidential.docx", "hr",           "docx"),
    ("Recruitment_Pipeline_Q1.docx",   "hr",               "docx"),
    ("Performance_Reviews_2023.docx",  "hr",               "docx"),
    ("NDA_Template_v3.docx",           "hr",               "docx"),
    ("Org_Chart_2024.pdf",             "hr",               "pdf"),
    # Engineering
    ("Architecture_Diagram_v5.pdf",    "engineering/architecture", "pdf"),
    ("API_Spec_Internal_v2.docx",      "engineering",      "docx"),
    ("DB_Schema_Production.sql",       "engineering",      "sql"),
    ("Deployment_Runbook.docx",        "engineering",      "docx"),
    ("Source_Backup_2024-03.bak",      "engineering",      "bak"),
    ("SSL_Certs_Backup.bak",           "engineering",      "bak"),
    # Legal
    ("Client_Contract_Acme_Corp.pdf",  "legal/contracts",  "pdf"),
    ("Client_Contract_GlobalTech.pdf", "legal/contracts",  "pdf"),
    ("IP_Assignment_Agreement.pdf",    "legal",            "pdf"),
    ("Vendor_SLA_CloudProvider.docx",  "legal",            "docx"),
    ("Litigation_Notes_2023.docx",     "legal",            "docx"),
    # Ops
    ("Incident_Response_Playbook.docx","ops",              "docx"),
    ("Network_Topology_Map.pdf",       "ops",              "pdf"),
    ("Asset_Inventory_Q1.xlsx",        "ops",              "xlsx"),
    ("Patch_Schedule_2024.xlsx",       "ops",              "xlsx"),
    ("Backup_Manifest.db",             "ops",              "db"),
    ("SIEM_Config_Export.db",          "ops/configs",      "db"),
    # Media
    ("Product_Launch_Photo_001.jpg",   "media",            "jpg"),
    ("Product_Launch_Photo_002.jpg",   "media",            "jpg"),
    ("Executive_Headshots.zip",        "media",            "zip"),
]


# ── Content generators ────────────────────────────────────────────────────────

def _random_text(n_words: int = 200) -> bytes:
    """Generate realistic-looking lorem-ipsum text content.

    Args:
        n_words: Approximate number of words to generate.

    Returns:
        UTF-8 encoded bytes of random text.
    """
    vocab = [
        "revenue", "quarterly", "employee", "contract", "budget", "invoice",
        "department", "compliance", "audit", "financial", "report", "payroll",
        "confidential", "internal", "strategy", "operations", "management",
        "security", "incident", "backup", "deployment", "configuration",
        "architecture", "database", "litigation", "vendor", "procurement",
    ]
    words = [random.choice(vocab) for _ in range(n_words)]
    # Add some sentences structure
    text = ". ".join(" ".join(words[i:i+8]) for i in range(0, n_words, 8))
    return text.encode("utf-8")


def _fake_xlsx_content() -> bytes:
    """Generate realistic binary content resembling an Excel file header.

    Returns:
        Bytes with an XLSX-like structure (ZIP PK header + random data).
    """
    # XLSX files are ZIP archives; start with PK header
    pk_header = b"PK\x03\x04"
    metadata  = b"[Content_Types].xml"
    payload   = _random_text(300)
    padding   = os.urandom(random.randint(4096, 16384))
    return pk_header + metadata + payload + padding


def _fake_pdf_content() -> bytes:
    """Generate realistic bytes resembling a PDF file.

    Returns:
        Bytes with PDF header/trailer structure + random body.
    """
    header  = b"%PDF-1.7\n"
    obj     = b"1 0 obj\n<< /Type /Catalog >>\nendobj\n"
    body    = _random_text(400)
    xref    = b"\nxref\n0 1\n0000000000 65535 f \n%%EOF\n"
    padding = os.urandom(random.randint(2048, 8192))
    return header + obj + body + xref + padding


def _fake_docx_content() -> bytes:
    """Generate realistic bytes resembling a DOCX file.

    Returns:
        Bytes with DOCX ZIP-archive-like structure.
    """
    # DOCX = ZIP containing word/document.xml
    pk     = b"PK\x03\x04"
    marker = b"word/document.xml"
    body   = _random_text(350)
    pad    = os.urandom(random.randint(2048, 12288))
    return pk + marker + body + pad


def _fake_db_content() -> bytes:
    """Generate realistic bytes resembling an SQLite database.

    Returns:
        Bytes starting with SQLite magic header + realistic payload.
    """
    # SQLite databases start with this 16-byte magic string
    magic   = b"SQLite format 3\x00"
    page_sz = struct.pack(">H", 4096)  # Page size = 4096 bytes
    schema  = b"CREATE TABLE employees (id INTEGER, name TEXT, salary REAL);\n"
    data    = _random_text(200)
    pad     = os.urandom(random.randint(8192, 32768))
    return magic + page_sz + schema + data + pad


def _fake_bak_content() -> bytes:
    """Generate realistic bytes resembling a backup archive.

    Returns:
        Bytes with a tar-like header + random compressed-looking data.
    """
    tar_magic = b"ustar  \x00"
    header    = os.urandom(512 - len(tar_magic))
    data      = _random_text(500)
    pad       = os.urandom(random.randint(16384, 65536))
    return tar_magic + header + data + pad


def _fake_sql_content() -> bytes:
    """Generate realistic SQL DDL/DML statements."""
    stmts = [
        "-- Production database schema v3.2",
        "CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, hash TEXT);",
        "CREATE TABLE orders (id SERIAL, user_id INT REFERENCES users(id), total DECIMAL);",
        "CREATE INDEX idx_users_email ON users(email);",
        "INSERT INTO users VALUES (1, 'admin@corp.local', 'redacted');",
    ]
    return ("\n".join(stmts) + "\n" + _random_text(100).decode("utf-8")).encode("utf-8")


def _fake_jpg_content() -> bytes:
    """Generate realistic bytes resembling a JPEG image."""
    # JPEG SOI + APP0 marker
    soi    = b"\xff\xd8\xff\xe0"
    app0   = b"\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    pad    = os.urandom(random.randint(32768, 131072))
    eoi    = b"\xff\xd9"
    return soi + app0 + pad + eoi


def _fake_zip_content() -> bytes:
    """Generate realistic bytes resembling a ZIP archive."""
    pk  = b"PK\x03\x04"
    pad = os.urandom(random.randint(65536, 262144))
    eocd = b"PK\x05\x06" + b"\x00" * 18
    return pk + pad + eocd


CONTENT_GENERATORS = {
    "xlsx": _fake_xlsx_content,
    "pdf":  _fake_pdf_content,
    "docx": _fake_docx_content,
    "db":   _fake_db_content,
    "bak":  _fake_bak_content,
    "sql":  _fake_sql_content,
    "jpg":  _fake_jpg_content,
    "zip":  _fake_zip_content,
}

# Canary file type → generator
CANARY_CONTENT_MAP = {
    ".xlsx": "xlsx",
    ".docx": "docx",
    ".pdf":  "pdf",
    ".db":   "db",
    ".bak":  "bak",
}


# ── Core functions ────────────────────────────────────────────────────────────

def sha256_file(path: Path) -> str:
    """Compute SHA-256 hash of a file.

    Args:
        path: Path to the file to hash.

    Returns:
        Lowercase hex-encoded SHA-256 digest.

    Raises:
        FileNotFoundError: If the file does not exist.
        PermissionError:   If the file cannot be read.
    """
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def create_vault_structure(vault_root: Path) -> None:
    """Create the directory tree for the simulated file server.

    Args:
        vault_root: Root path of the simulated vault.

    Raises:
        OSError: If directories cannot be created.
    """
    log.info("Creating vault directory structure under: %s", vault_root)
    for sub_dir in VAULT_DIRS:
        target = vault_root / sub_dir
        target.mkdir(parents=True, exist_ok=True)
        log.debug("Created directory: %s", target)
    log.info("Vault structure created (%d directories)", len(VAULT_DIRS))


def place_decoy_files(vault_root: Path) -> list[dict[str, Any]]:
    """Create realistic decoy files throughout the vault.

    Args:
        vault_root: Root path of the simulated vault.

    Returns:
        List of metadata dicts for each decoy file created.

    Raises:
        OSError: If files cannot be written.
    """
    decoys: list[dict[str, Any]] = []
    log.info("Placing %d decoy files…", len(DECOY_DEFINITIONS))

    for filename, sub_dir, content_type in DECOY_DEFINITIONS:
        path      = vault_root / sub_dir / filename
        generator = CONTENT_GENERATORS.get(content_type, _random_text)
        content   = generator()

        path.write_bytes(content)
        stat = path.stat()

        decoys.append({
            "path":        str(path),
            "inode":       stat.st_ino,
            "size_bytes":  stat.st_size,
            "sha256":      sha256_file(path),
            "content_type": content_type,
            "created_at":  datetime.now(timezone.utc).isoformat(),
        })
        log.debug("Placed decoy: %s (%d bytes)", path.name, stat.st_size)

    log.info("Placed %d decoy files successfully", len(decoys))
    return decoys


def place_canary_files(vault_root: Path) -> list[dict[str, Any]]:
    """Place hidden canary files with high-entropy realistic content.

    Canary files are named with a dot-prefix to blend in with hidden
    config files that legitimate software might create. They are
    strategically placed in the highest-value directories so that
    any ransomware performing a top-down directory walk will encounter
    them early in the encryption process.

    Args:
        vault_root: Root path of the simulated vault.

    Returns:
        List of canary metadata dicts (path, inode, sha256, placed_at).

    Raises:
        OSError: If canary files cannot be written.
    """
    manifest_entries: list[dict[str, Any]] = []
    log.info("Placing %d canary files…", len(CANARY_DEFINITIONS))

    for filename, sub_dir in CANARY_DEFINITIONS:
        path         = vault_root / sub_dir / filename
        ext          = Path(filename).suffix
        content_type = CANARY_CONTENT_MAP.get(ext, "bak")
        generator    = CONTENT_GENERATORS[content_type]
        content      = generator()

        path.write_bytes(content)
        stat = path.stat()

        entry: dict[str, Any] = {
            "path":       str(path),
            "filename":   filename,
            "extension":  ext,
            "directory":  sub_dir,
            "inode":      stat.st_ino,
            "size_bytes": stat.st_size,
            "sha256":     sha256_file(path),
            "placed_at":  datetime.now(timezone.utc).isoformat(),
            "triggered":  False,
        }
        manifest_entries.append(entry)
        log.info("Canary placed: %s (inode=%d, sha256=%s…)", path, stat.st_ino, entry["sha256"][:16])

    return manifest_entries


def write_manifest(canaries: list[dict[str, Any]], decoys: list[dict[str, Any]]) -> None:
    """Write canary_manifest.json with all metadata.

    The manifest is the ground-truth document consumed by:
      - canary_daemon.py  (to know which paths to watch)
      - integrity_monitor.py  (for hash baseline comparison)
      - dashboard/app.py  (for the SOC dashboard display)

    Args:
        canaries: List of canary file metadata dicts.
        decoys:   List of decoy file metadata dicts.

    Raises:
        OSError: If the manifest file cannot be written.
    """
    manifest = {
        "version":    "2.4.1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "canaries":   canaries,
        "decoys":     decoys,
        "summary": {
            "total_canaries": len(canaries),
            "total_decoys":   len(decoys),
            "vault_root":     str(DEFAULT_VAULT),
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))
    log.info("Manifest written to: %s", MANIFEST_PATH)


def verify_placement(vault_root: Path, canaries: list[dict[str, Any]]) -> bool:
    """Verify that all canary files exist and have expected hashes.

    Args:
        vault_root: Root path of the vault.
        canaries:   List of canary metadata dicts from write_manifest.

    Returns:
        True if all canaries pass verification, False otherwise.
    """
    all_ok = True
    for entry in canaries:
        path = Path(entry["path"])
        if not path.exists():
            log.error("VERIFICATION FAILED — canary missing: %s", path)
            all_ok = False
            continue
        actual_hash = sha256_file(path)
        if actual_hash != entry["sha256"]:
            log.error("VERIFICATION FAILED — hash mismatch: %s", path)
            all_ok = False
        else:
            log.debug("Verified: %s ✓", path.name)
    if all_ok:
        log.info("All %d canary files verified successfully ✓", len(canaries))
    return all_ok


# ── CLI entry point ───────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed argument namespace.
    """
    parser = argparse.ArgumentParser(
        description="RansomWatch — Canary File Placement Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--vault", type=Path, default=DEFAULT_VAULT,
        help="Root path for the simulated file vault (default: test_vault/)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable verbose debug logging",
    )
    return parser.parse_args()


def main() -> int:
    """Main entry point for canary_placer.py.

    Returns:
        0 on success, 1 on failure.
    """
    args = parse_args()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    vault_root = args.vault

    log.info("=" * 60)
    log.info("RansomWatch — Canary Placement Tool v2.4.1")
    log.info("Vault root: %s", vault_root.resolve())
    log.info("=" * 60)

    try:
        # 1. Create directory structure
        create_vault_structure(vault_root)

        # 2. Place decoy files (ransomware targets)
        decoys = place_decoy_files(vault_root)

        # 3. Place canary files (detector tripwires)
        canaries = place_canary_files(vault_root)

        # 4. Write manifest
        write_manifest(canaries, decoys)

        # 5. Verify placement
        if not verify_placement(vault_root, canaries):
            log.error("Canary verification failed — aborting")
            return 1

        log.info("=" * 60)
        log.info("Setup complete:")
        log.info("  Directories:  %d", len(VAULT_DIRS))
        log.info("  Decoy files:  %d", len(decoys))
        log.info("  Canary files: %d (armed)", len(canaries))
        log.info("  Manifest:     %s", MANIFEST_PATH)
        log.info("=" * 60)
        return 0

    except PermissionError as exc:
        log.error("Permission denied: %s", exc)
        return 1
    except OSError as exc:
        log.error("OS error during setup: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
