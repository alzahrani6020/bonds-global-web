import hmac
import json
import os
import re
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
TOKEN_CONTRACT_VERSION = 2

BROKER_POLICIES = {
    "research-intelligence": {
        "subject": "service:orchestrator",
        "scopes": ["research:read"],
    },
    "orchestrator": {
        "subject": "service:agent-runtime",
        "scopes": ["orchestrator:dispatch"],
    },
    "agent-runtime": {
        "subject": "service:orchestrator",
        "scopes": ["agent:execute"],
    },
}


def _read_secret(path, name):
    value = Path(path).read_text(encoding="utf-8").strip()
    if not 32 <= len(value) <= 4096 or not all(33 <= ord(char) <= 126 for char in value):
        raise RuntimeError(f"{name} must contain 32 to 4096 printable ASCII characters without whitespace")
    if value.startswith("bonds_") or re.fullmatch(r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", value):
        raise RuntimeError(f"{name} must not be a service token or user-session JWT")
    return value


def load_configuration():
    """Validate the runtime configuration before opening its store."""
    required = (
        "BONDS_TOKEN_DB",
        "BONDS_TOKEN_ADMIN_SECRET_FILE",
        "BONDS_TOKEN_CHANNEL_SECRET_FILE",
        "BONDS_TOKEN_BROKER_SECRET_FILE",
        "BONDS_TOKEN_BUILD_COMMIT",
    )
    missing = [name for name in required if not os.environ.get(name, "").strip()]
    if missing:
        raise RuntimeError(f"Missing token runtime configuration: {', '.join(missing)}")

    admin_secret = _read_secret(os.environ["BONDS_TOKEN_ADMIN_SECRET_FILE"], "admin secret")
    channel_secret = _read_secret(os.environ["BONDS_TOKEN_CHANNEL_SECRET_FILE"], "channel secret")
    broker_secret = _read_secret(os.environ["BONDS_TOKEN_BROKER_SECRET_FILE"], "broker secret")

    values = [admin_secret, channel_secret, broker_secret]
    if len({value.encode("utf-8") for value in values}) != 3:
        raise RuntimeError("admin, channel and broker secrets must be distinct")

    build_commit = os.environ["BONDS_TOKEN_BUILD_COMMIT"]
    if not re.fullmatch(r"[0-9a-fA-F]{40}", build_commit):
        raise RuntimeError("BONDS_TOKEN_BUILD_COMMIT must be an exact 40-character Git SHA")
    port = int(os.environ.get("BONDS_TOKEN_PORT", "8771"))
    if not 1 <= port <= 65535:
        raise RuntimeError("invalid BONDS_TOKEN_PORT")

    return {
        "database": os.environ["BONDS_TOKEN_DB"],
        "admin_secret": admin_secret,
        "channel_secret": channel_secret,
        "broker_secret": broker_secret,
        "build_commit": build_commit.lower(),
        "port": port,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "BondsTokenService/2.0"

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

    def authorized(self, header, secret):
        supplied = self.headers.get_all(header, [])
        return len(supplied) == 1 and hmac.compare_digest(
            supplied[0].encode("utf-8"), secret.encode("utf-8")
        )

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 65536:
            raise ValueError("invalid body size")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def runtime_identity(self):
        return {
            "service": TOKEN_ISSUER,
            "issuer": TOKEN_ISSUER,
            "status": "ok",
            "version": "2.0",
            "build_commit": self.server.config["build_commit"],
            "contract_version": TOKEN_CONTRACT_VERSION,
            "schema_version": TOKEN_SCHEMA_VERSION,
            "service_token_ttl_seconds": SERVICE_TOKEN_TTL_SECONDS,
            "channel_auth": "required",
            "broker_auth": "required",
            "broker_mode": "one_time_service_tokens",
        }

    def do_GET(self):
        if self.path == "/health":
            if not self.authorized("X-Bonds-Channel", self.server.config["channel_secret"]):
                self.send_json(401, {"error": "unauthorized"})
                return
            self.send_json(200, self.runtime_identity())
            return

        self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path == "/introspect":
            authorized = self.authorized("X-Bonds-Channel", self.server.config["channel_secret"])
        elif self.path in ("/broker/issue", "/broker/revoke"):
            authorized = self.authorized("X-Bonds-Broker", self.server.config["broker_secret"])
        else:
            authorized = self.authorized("X-Bonds-Admin", self.server.config["admin_secret"])
        if not authorized:
            self.send_json(401, {"error": "unauthorized"})
            return

        try:
            data = self.read_json()

            if self.path == "/issue":
                token = self.server.engine.issue(
                    token_type=data["token_type"],
                    subject=data["subject"],
                    audience=data.get("audience", "bonds"),
                    scopes=data.get("scopes", []),
                    ttl=int(data.get("ttl", SERVICE_TOKEN_TTL_SECONDS)),
                    issued_by="admin",
                )
                self.send_json(200, {"status": "issued", "token": token})
                return

            if self.path == "/broker/issue":
                audience = str(data.get("audience", "")).strip()
                policy = BROKER_POLICIES.get(audience)
                if policy is None:
                    self.send_json(403, {"error": "broker_policy_denied"})
                    return
                token = self.server.engine.issue(
                    token_type="service",
                    subject=policy["subject"],
                    audience=audience,
                    scopes=policy["scopes"],
                    ttl=SERVICE_TOKEN_TTL_SECONDS,
                    issued_by="broker",
                )
                self.send_json(200, {
                    "status": "issued",
                    "token": token,
                    "audience": audience,
                    "one_time": True,
                })
                return

            if self.path == "/introspect":
                self.send_json(200, {
                    "runtime": self.runtime_identity(),
                    "claims": self.server.engine.introspect(
                        data["token"],
                        consume_broker=True,
                    ),
                })
                return

            if self.path == "/verify":
                result = self.server.engine.verify(
                    token=data["token"],
                    audience=data.get("audience", "bonds"),
                    required_scope=data.get("required_scope"),
                )
                self.send_json(200, {"valid": result is not None, "claims": result})
                return

            if self.path == "/revoke":
                self.send_json(200, {
                    "revoked": bool(self.server.engine.revoke(data["token"])),
                })
                return

            if self.path == "/broker/revoke":
                self.send_json(200, {
                    "revoked": bool(self.server.engine.revoke(
                        data["token"],
                        issued_by="broker",
                    )),
                })
                return

            self.send_json(404, {"error": "not_found"})

        except Exception as exc:
            self.send_json(400, {
                "error": type(exc).__name__,
                "message": str(exc),
            })


if __name__ == "__main__":
    config = load_configuration()
    if sys.argv[1:] == ["--check-config"]:
        print("BONDS_TOKEN_CONFIG_VALID", flush=True)
        sys.exit(0)
    if sys.argv[1:]:
        raise RuntimeError("Unsupported token runtime arguments")
    server = ThreadingHTTPServer((HOST, config["port"]), Handler)
    server.config = config
    server.engine = BondsTokenEngine(config["database"])
    print(
        f"BONDS_TOKEN_SERVICE_READY http://{HOST}:{config['port']} "
        f"build={config['build_commit']} schema={TOKEN_SCHEMA_VERSION} "
        f"contract={TOKEN_CONTRACT_VERSION}",
        flush=True,
    )
    server.serve_forever()
