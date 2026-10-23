from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOST = os.environ.get("BONDS_FILE_SECURITY_HOST", "127.0.0.1")
PORT = int(os.environ.get("BONDS_FILE_SECURITY_PORT", "8772"))
TOKEN = os.environ.get("BONDS_FILE_SECURITY_TOKEN", "")
ALLOWED_HOST = os.environ.get("BONDS_FILE_SECURITY_ALLOWED_HOST", "").strip().lower()
CLAMSCAN = os.environ.get("BONDS_CLAMSCAN_PATH", "").strip()
YARA = os.environ.get("BONDS_YARA_PATH", "").strip()
YARA_RULES = os.environ.get("BONDS_YARA_RULES", "").strip()
MAX_BYTES = int(os.environ.get("BONDS_FILE_SECURITY_MAX_BYTES", str(10 * 1024 * 1024)))
MAX_BODY_BYTES = 64 * 1024

MAGIC = (
    (b"%PDF-", "application/pdf"),
    (b"PK\x03\x04", "application/zip"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"RIFF", "image/webp"),
    (b"II*\x00", "image/tiff"),
    (b"MM\x00*", "image/tiff"),
    (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "application/x-ole-storage"),
)

def _authorized(header: str) -> bool:
    if not TOKEN:
        return False
    supplied = header[7:] if header.startswith("Bearer ") else ""
    return hmac.compare_digest(supplied, TOKEN)

def _clam_ready() -> bool:
    return bool(CLAMSCAN and Path(CLAMSCAN).is_file())

def _detect_mime(path: Path, expected: str = "") -> str:
    head = path.read_bytes()[:32]
    for signature, mime in MAGIC:
        if head.startswith(signature):
            if mime == "application/zip":
                suffix = path.suffix.lower()
                if suffix == ".docx":
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                if suffix == ".xlsx":
                    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                if suffix == ".pptx":
                    return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            if mime == "image/webp" and head[8:12] != b"WEBP":
                continue
            return mime
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or expected or "application/octet-stream"

def _download(url: str, target: Path, expected_size: int) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("SIGNED_URL_HTTPS_REQUIRED")
    if not ALLOWED_HOST or parsed.hostname != ALLOWED_HOST:
        raise ValueError("SIGNED_URL_HOST_DENIED")
    if expected_size <= 0 or expected_size > MAX_BYTES:
        raise ValueError("FILE_SIZE_DENIED")

    request = urllib.request.Request(url, headers={"User-Agent": "BondsFileSecurity/1.0"})
    total = 0
    with urllib.request.urlopen(request, timeout=30) as response, target.open("wb") as out:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_BYTES or total > expected_size:
                raise ValueError("FILE_SIZE_CHANGED")
            out.write(chunk)
    if total != expected_size:
        raise ValueError("FILE_SIZE_CHANGED")

def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def _run_clam(path: Path) -> tuple[str, dict[str, Any]]:
    if not _clam_ready():
        raise RuntimeError("CLAMAV_UNAVAILABLE")
    proc = subprocess.run(
        [CLAMSCAN, "--no-summary", "--infected", str(path)],
        capture_output=True,
        text=True,
        timeout=60,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    output = (proc.stdout + "\n" + proc.stderr).strip()[:8000]
    if proc.returncode == 0:
        return "clean", {"clamav_output": output}
    if proc.returncode == 1:
        return "malicious", {"clamav_output": output}
    raise RuntimeError("CLAMAV_SCAN_ERROR")

def _run_yara(path: Path) -> tuple[bool, list[str]]:
    if not YARA or not YARA_RULES:
        return False, []
    if not Path(YARA).is_file() or not Path(YARA_RULES).exists():
        return False, []
    proc = subprocess.run(
        [YARA, "-r", YARA_RULES, str(path)],
        capture_output=True,
        text=True,
        timeout=30,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    if proc.returncode not in (0, 1):
        raise RuntimeError("YARA_SCAN_ERROR")
    hits = [line.strip() for line in proc.stdout.splitlines() if line.strip()][:50]
    return bool(hits), hits

def _scan(body: dict[str, Any]) -> dict[str, Any]:
    url = str(body.get("signed_url") or "")
    expected_size = int(body.get("expected_size") or 0)
    expected_mime = str(body.get("expected_mime") or "")
    filename = Path(str(body.get("filename") or "upload.bin")).name

    with tempfile.TemporaryDirectory(prefix="bonds-file-security-") as temp:
        path = Path(temp) / filename
        _download(url, path, expected_size)
        sha256 = _sha256(path)
        detected_mime = _detect_mime(path, expected_mime)
        verdict, details = _run_clam(path)
        yara_hit, yara_hits = _run_yara(path)
        if yara_hit and verdict == "clean":
            verdict = "suspicious"
        details.update({
            "yara_hits": yara_hits,
            "expected_mime": expected_mime,
            "detected_mime": detected_mime,
        })
        return {
            "verdict": verdict,
            "sha256": sha256,
            "detected_mime": detected_mime,
            "risk_score": 100 if verdict == "malicious" else 70 if verdict == "suspicious" else 0,
            "scanner_name": "clamav+yara" if YARA and YARA_RULES else "clamav",
            "scanner_version": _clam_version(),
            "signature_version": None,
            "details": details,
        }

def _clam_version() -> str | None:
    if not _clam_ready():
        return None
    try:
        proc = subprocess.run([CLAMSCAN, "--version"], capture_output=True, text=True, timeout=10)
        return (proc.stdout or proc.stderr).strip()[:200] or None
    except Exception:
        return None

class Handler(BaseHTTPRequestHandler):
    server_version = "BondsFileSecurity/1.0"

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(raw)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _body(self) -> dict[str, Any]:
        length = int(self.headers.get("content-length", "0"))
        if length <= 0 or length > MAX_BODY_BYTES:
            raise ValueError("REQUEST_SIZE_INVALID")
        data = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("REQUEST_OBJECT_REQUIRED")
        return data

    def do_GET(self) -> None:
        if self.path != "/health":
            self._json(404, {"ok": False, "error": {"code": "NOT_FOUND"}})
            return
        if not _authorized(self.headers.get("authorization", "")):
            self._json(401, {"ok": False, "error": {"code": "UNAUTHORIZED"}})
            return
        ready = bool(_clam_ready() and ALLOWED_HOST)
        self._json(200 if ready else 503, {
            "ok": ready,
            "runtime": {
                "service": "BondsFileSecurityService",
                "clamav_ready": _clam_ready(),
                "allowed_host_configured": bool(ALLOWED_HOST),
                "yara_configured": bool(YARA and YARA_RULES),
                "max_bytes": MAX_BYTES,
                "clamav_version": _clam_version(),
            },
        })

    def do_POST(self) -> None:
        if self.path != "/scan":
            self._json(404, {"ok": False, "error": {"code": "NOT_FOUND"}})
            return
        if not _authorized(self.headers.get("authorization", "")):
            self._json(401, {"ok": False, "error": {"code": "UNAUTHORIZED"}})
            return
        if not _clam_ready():
            self._json(503, {"ok": False, "error": {"code": "CLAMAV_UNAVAILABLE"}})
            return
        try:
            result = _scan(self._body())
            self._json(200, {"ok": True, "result": result})
        except ValueError as exc:
            self._json(422, {"ok": False, "error": {"code": str(exc)}})
        except subprocess.TimeoutExpired:
            self._json(503, {"ok": False, "error": {"code": "SCANNER_TIMEOUT"}})
        except Exception as exc:
            self._json(503, {"ok": False, "error": {"code": str(exc)[:120] or "SCAN_FAILED"}})

    def log_message(self, fmt: str, *args: Any) -> None:
        if os.environ.get("BONDS_FILE_SECURITY_ACCESS_LOG", "0") == "1":
            super().log_message(fmt, *args)

def main() -> None:
    if not TOKEN:
        raise RuntimeError("BONDS_FILE_SECURITY_TOKEN is required")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.serve_forever()

if __name__ == "__main__":
    main()
