from __future__ import annotations

import hmac
import json
import os
import select
import socket
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from native_generator import (
    NativeClientCancelled,
    NativeContextOverflow,
    NativeRuntimeBusy,
    generate,
    status,
)

ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("BONDS_NATIVE_HOST", "127.0.0.1")
PORT = int(os.environ.get("BONDS_NATIVE_PORT", "8765"))
TOKEN = os.environ.get("BONDS_NATIVE_TOKEN", "")
MAX_BODY_BYTES = int(os.environ.get("BONDS_NATIVE_MAX_BODY_BYTES", "1048576"))
# Opt-in: stop queued/in-flight generation when the HTTP client disconnects.
# Off by default; enable only after verifying disconnect detection through the tunnel.
CANCEL_ON_DISCONNECT = os.environ.get("BONDS_NATIVE_CANCEL_ON_DISCONNECT", "0") == "1"


def _is_loopback(host: str) -> bool:
    return host in {"127.0.0.1", "::1", "localhost"}


if not _is_loopback(HOST) and not TOKEN:
    raise RuntimeError("BONDS_NATIVE_TOKEN is required when binding beyond loopback")


class Handler(BaseHTTPRequestHandler):
    server_version = "BondsNativeInference/1.0"

    def _json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        if not TOKEN:
            return True
        header = self.headers.get("authorization", "")
        supplied = header[7:] if header.startswith("Bearer ") else ""
        return hmac.compare_digest(supplied, TOKEN)

    def _require_auth(self) -> bool:
        if self._authorized():
            return True
        self._json(401, {"ok": False, "error": {"code": "UNAUTHORIZED"}})
        return False

    def _client_disconnected(self) -> bool:
        """True once the peer has closed its side of the connection.

        The request body was fully read, so a readable socket that yields EOF
        on a non-consuming peek means the client went away. Pending bytes
        (e.g. a pipelined request) mean it is still connected.
        """
        try:
            conn = self.connection
            readable, _, _ = select.select([conn], [], [], 0)
            if not readable:
                return False
            return conn.recv(1, socket.MSG_PEEK) == b""
        except (OSError, ValueError):
            return True

    def _read_json(self) -> dict[str, Any]:
        raw_length = self.headers.get("content-length", "0")
        try:
            length = int(raw_length)
        except ValueError:
            raise ValueError("invalid content-length")
        if length < 0 or length > MAX_BODY_BYTES:
            raise ValueError("request body too large")
        body = self.rfile.read(length)
        if not body:
            return {}
        value = json.loads(body.decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("JSON body must be an object")
        return value

    def do_GET(self) -> None:
        if self.path != "/health":
            self._json(404, {"ok": False, "error": {"code": "NOT_FOUND"}})
            return
        if not self._require_auth():
            return
        self._json(200, {"ok": True, "runtime": status(ROOT)})

    def do_POST(self) -> None:
        if self.path != "/generate":
            self._json(404, {"ok": False, "error": {"code": "NOT_FOUND"}})
            return
        if not self._require_auth():
            return
        try:
            body = self._read_json()
            prompt = str(body.get("prompt") or "").strip()
            if not prompt:
                self._json(400, {"ok": False, "error": {"code": "PROMPT_REQUIRED"}})
                return
            result = generate(
                ROOT,
                prompt,
                context=body.get("context") or {},
                options=body.get("options") or {},
                cancel_check=self._client_disconnected if CANCEL_ON_DISCONNECT else None,
            )
            self._json(200, {"ok": True, "result": result})
        except NativeClientCancelled as exc:
            # The caller is gone; there is nobody to answer.
            self.close_connection = True
            print(json.dumps({
                "event": "native_generate_cancelled",
                "reason": str(exc),
            }, ensure_ascii=False), file=sys.stderr, flush=True)
        except NativeRuntimeBusy as exc:
            self._json(503, {
                "ok": False,
                "error": {
                    "code": "NATIVE_RUNTIME_BUSY",
                    "message": str(exc),
                },
            })
        except NativeContextOverflow as exc:
            self._json(503, {
                "ok": False,
                "error": {
                    "code": "NATIVE_CONTEXT_OVERFLOW",
                    "message": str(exc),
                },
            })
        except Exception as exc:
            self._json(503, {
                "ok": False,
                "error": {
                    "code": "NATIVE_INFERENCE_ERROR",
                    "class": type(exc).__name__,
                    "message": str(exc),
                },
            })

    def log_message(self, fmt: str, *args: Any) -> None:
        if os.environ.get("BONDS_NATIVE_ACCESS_LOG", "0") == "1":
            super().log_message(fmt, *args)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(json.dumps({
        "service": "Bonds Native Inference",
        "host": HOST,
        "port": PORT,
        "token_required": bool(TOKEN),
    }, ensure_ascii=False))
    server.serve_forever()


if __name__ == "__main__":
    main()
