import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from bonds_security.token_engine import (
    BondsTokenEngine,
    SERVICE_TOKEN_TTL_SECONDS,
    TOKEN_ISSUER,
    TOKEN_SCHEMA_VERSION,
)

HOST = "127.0.0.1"
PORT = int(os.environ.get("BONDS_TOKEN_PORT", "8771"))
DB = os.environ["BONDS_TOKEN_DB"]
SECRET_FILE = os.environ["BONDS_TOKEN_ADMIN_SECRET_FILE"]
BUILD_COMMIT = os.environ.get("BONDS_TOKEN_BUILD_COMMIT", "unknown")

engine = BondsTokenEngine(DB)
admin_secret = Path(SECRET_FILE).read_text(encoding="utf-8").strip()

if not admin_secret:
    raise RuntimeError("empty admin secret")


class Handler(BaseHTTPRequestHandler):
    server_version = "BondsTokenService/1.0"

    def log_message(self, fmt, *args):
        return

    def send_json(self, status, payload):
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def authorized(self):
        supplied = self.headers.get("X-Bonds-Admin", "")
        return hmac.compare_digest(supplied, admin_secret)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 65536:
            raise ValueError("invalid body size")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {
                "service": TOKEN_ISSUER,
                "status": "ok",
                "version": "1.0",
                "build_commit": BUILD_COMMIT,
                "schema_version": TOKEN_SCHEMA_VERSION,
                "service_token_ttl_seconds": SERVICE_TOKEN_TTL_SECONDS,
            })
            return

        self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/introspect" and not self.authorized():
            self.send_json(401, {"error": "unauthorized"})
            return

        try:
            data = self.read_json()

            if self.path == "/issue":
                token = engine.issue(
                    token_type=data["token_type"],
                    subject=data["subject"],
                    audience=data.get("audience", "bonds"),
                    scopes=data.get("scopes", []),
                    ttl=int(data.get("ttl", SERVICE_TOKEN_TTL_SECONDS)),
                )
                self.send_json(200, {
                    "status": "issued",
                    "token": token,
                })
                return

            if self.path == "/introspect":
                self.send_json(200, {
                    "claims": engine.introspect(data["token"]),
                })
                return

            if self.path == "/verify":
                result = engine.verify(
                    token=data["token"],
                    audience=data.get("audience", "bonds"),
                    required_scope=data.get("required_scope"),
                )
                self.send_json(200, {
                    "valid": result is not None,
                    "claims": result,
                })
                return

            if self.path == "/revoke":
                self.send_json(200, {
                    "revoked": bool(engine.revoke(data["token"])),
                })
                return

            self.send_json(404, {"error": "not_found"})

        except Exception as exc:
            self.send_json(400, {
                "error": type(exc).__name__,
                "message": str(exc),
            })


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(
        f"BONDS_TOKEN_SERVICE_READY http://{HOST}:{PORT} "
        f"build={BUILD_COMMIT} schema={TOKEN_SCHEMA_VERSION}",
        flush=True,
    )
    server.serve_forever()
