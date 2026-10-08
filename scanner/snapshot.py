"""Bounded file fingerprints; no source text is retained."""
import hashlib

from scanner.limits import read_bytes


def file_digest(path: str) -> str | None:
    try:
        return hashlib.sha256(read_bytes(path)).hexdigest()
    except OSError:
        return None
