"""Real loopback HTTP/process tests. No deployed runtime or credentials are used."""

import http.client
import json
import os
import secrets
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path


RUNTIME_ROOT = Path(__file__).resolve().parents[1]
BUILD_COMMIT = "0123456789abcdef0123456789abcdef01234567"


class TokenRuntimeHTTPTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.root = Path(self.tempdir.name)
        self.database = self.root / "tokens.sqlite3"
        self.admin = secrets.token_urlsafe(48)
        self.channel = secrets.token_urlsafe(48)
        self.broker = secrets.token_urlsafe(48)
        self.admin_file = self.root / "admin.secret"
        self.channel_file = self.root / "channel.secret"
        self.broker_file = self.root / "broker.secret"
        self.admin_file.write_text(self.admin, encoding="utf-8")
        self.channel_file.write_text(self.channel, encoding="utf-8")
        self.broker_file.write_text(self.broker, encoding="utf-8")
        self.environment = {
            name: value for name, value in os.environ.items()
            if not name.startswith("BONDS_TOKEN_")
        }
        self.environment.update({
            "BONDS_TOKEN_DB": str(self.database),
            "BONDS_TOKEN_ADMIN_SECRET_FILE": str(self.admin_file),
            "BONDS_TOKEN_CHANNEL_SECRET_FILE": str(self.channel_file),
            "BONDS_TOKEN_BROKER_SECRET_FILE": str(self.broker_file),
            "BONDS_TOKEN_BUILD_COMMIT": BUILD_COMMIT,
            "PYTHONDONTWRITEBYTECODE": "1",
        })
        self.process = None
        self.addCleanup(self.stop)

    def start(self):
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            self.port = reservation.getsockname()[1]
        self.environment["BONDS_TOKEN_PORT"] = str(self.port)
        self.process = subprocess.Popen(
            [sys.executable, "-m", "bonds_security.server"],
            cwd=RUNTIME_ROOT,
            env=self.environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                self.fail("Isolated token runtime exited before becoming ready")
            try:
                status, _ = self.request("GET", "/health", headers={"X-Bonds-Channel": self.channel})
                if status == 200:
                    return
            except (OSError, http.client.HTTPException):
                pass
            time.sleep(0.025)
        self.fail("Isolated token runtime did not become ready")

    def stop(self):
        if self.process is not None:
            if self.process.poll() is None:
                self.process.terminate()
                self.process.wait(timeout=10)
            self.process = None

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        try:
            payload = json.dumps(body).encode("utf-8") if body is not None else b""
            connection.putrequest(method, path)
            connection.putheader("Content-Type", "application/json")
            connection.putheader("Content-Length", str(len(payload)))
            entries = headers.items() if isinstance(headers, dict) else (headers or [])
            for name, value in entries:
                connection.putheader(name, value)
            connection.endheaders(payload)
            response = connection.getresponse()
            data = json.loads(response.read().decode("utf-8"))
            self.assertEqual(response.getheader("Cache-Control"), "no-store")
            return response.status, data
        finally:
            connection.close()

    def issue(self):
        status, result = self.request("POST", "/issue", {
            "token_type": "service",
            "subject": "service:isolated-acceptance",
            "audience": "research-intelligence",
            "scopes": ["research:read"],
        }, {"X-Bonds-Admin": self.admin})
        self.assertEqual(status, 200)
        self.assertEqual(result["status"], "issued")
        self.assertTrue(result["token"].startswith("bonds_"))
        return result["token"]

    def introspect(self, token):
        status, result = self.request("POST", "/introspect", {"token": token}, {
            "X-Bonds-Channel": self.channel,
        })
        self.assertEqual(status, 200)
        return result["claims"]

    def test_health_requires_channel_and_identifies_contract_and_build(self):
        self.start()
        for headers in ({}, {"X-Bonds-Admin": self.admin}, {"X-Bonds-Channel": self.admin}, {"X-Bonds-Channel": "invalid"}):
            status, result = self.request("GET", "/health", headers=headers)
            self.assertEqual((status, result), (401, {"error": "unauthorized"}))

        status, result = self.request("GET", "/health", headers={"X-Bonds-Channel": self.channel})
        contract = json.loads((RUNTIME_ROOT / "contract.json").read_text(encoding="utf-8"))
        self.assertEqual(status, 200)
        self.assertEqual(result["service"], contract["issuer"])
        self.assertEqual(result["issuer"], contract["issuer"])
        self.assertEqual(result["contract_version"], contract["contractVersion"])
        self.assertEqual(result["schema_version"], contract["schemaVersion"])
        self.assertEqual(result["service_token_ttl_seconds"], contract["serviceTokenTtlSeconds"])
        self.assertEqual(result["channel_auth"], "required")
        self.assertEqual(result["broker_auth"], "required")
        self.assertEqual(result["broker_mode"], "one_time_service_tokens")
        self.assertEqual(result["build_commit"], BUILD_COMMIT)

    def test_introspection_rejects_user_service_and_admin_credentials(self):
        self.start()
        token = self.issue()
        rejected = (
            {},
            {"Authorization": "Bearer user-session-is-not-a-channel"},
            {"Authorization": "Bearer " + token},
            {"X-Bonds-Channel": token},
            {"X-Bonds-Admin": self.admin},
            {"X-Bonds-Broker": self.broker},
            {"X-Bonds-Channel": self.admin},
        )
        for headers in rejected:
            status, result = self.request("POST", "/introspect", {"token": token}, headers)
            self.assertEqual((status, result), (401, {"error": "unauthorized"}))
        self.assertTrue(self.introspect(token)["active"])

    def test_introspection_carries_the_same_identity_as_authenticated_health(self):
        self.start()
        token = self.issue()
        status, health = self.request("GET", "/health", headers={"X-Bonds-Channel": self.channel})
        self.assertEqual(status, 200)
        for inspected_token, active in ((token, True), ("bonds_unknown_isolated_token", False)):
            status, result = self.request("POST", "/introspect", {"token": inspected_token}, {
                "X-Bonds-Channel": self.channel,
            })
            self.assertEqual(status, 200)
            self.assertEqual(result["runtime"], health)
            self.assertEqual(result["runtime"]["build_commit"], BUILD_COMMIT)
            self.assertEqual(result["claims"]["active"], active)

    def test_channel_cannot_issue_verify_or_revoke_tokens(self):
        self.start()
        token = self.issue()
        for path in ("/issue", "/verify", "/revoke"):
            for headers in ({"X-Bonds-Channel": self.channel}, {"X-Bonds-Admin": self.channel}):
                status, result = self.request("POST", path, {"token": token}, headers)
                self.assertEqual((status, result), (401, {"error": "unauthorized"}))
        self.assertTrue(self.introspect(token)["active"])

        status, result = self.request("POST", "/verify", {
            "token": token,
            "audience": "research-intelligence",
            "required_scope": "research:read",
        }, {"X-Bonds-Admin": self.admin})
        self.assertEqual(status, 200)
        self.assertTrue(result["valid"])

    def test_duplicate_credentials_are_rejected(self):
        self.start()
        for method, path, header, credential in (
            ("GET", "/health", "X-Bonds-Channel", self.channel),
            ("POST", "/introspect", "X-Bonds-Channel", self.channel),
            ("POST", "/issue", "X-Bonds-Admin", self.admin),
            ("POST", "/broker/issue", "X-Bonds-Broker", self.broker),
        ):
            status, _ = self.request(method, path, {}, [(header, credential), (header, credential)])
            self.assertEqual(status, 401)

    def test_broker_issues_policy_bound_single_use_tokens(self):
        self.start()
        status, result = self.request("POST", "/broker/issue", {
            "audience": "research-intelligence",
            "subject": "attacker-controlled",
            "scopes": ["admin:*"],
            "ttl": 86400,
        }, {"X-Bonds-Broker": self.broker})
        self.assertEqual(status, 200)
        self.assertEqual(result["audience"], "research-intelligence")
        self.assertTrue(result["one_time"])
        token = result["token"]

        first = self.introspect(token)
        self.assertTrue(first["active"])
        self.assertEqual(first["sub"], "service:orchestrator")
        self.assertEqual(first["scope"], ["research:read"])
        self.assertEqual(first["exp"] - first["iat"], 3600)

        second = self.introspect(token)
        self.assertFalse(second["active"])
        self.assertTrue(second["revoked"])

    def test_broker_rejects_unknown_audience_and_other_credentials(self):
        self.start()
        status, result = self.request("POST", "/broker/issue", {
            "audience": "unknown-service",
        }, {"X-Bonds-Broker": self.broker})
        self.assertEqual((status, result), (403, {"error": "broker_policy_denied"}))

        for headers in (
            {"X-Bonds-Admin": self.admin},
            {"X-Bonds-Channel": self.channel},
            {},
        ):
            status, result = self.request("POST", "/broker/issue", {
                "audience": "research-intelligence",
            }, headers)
            self.assertEqual((status, result), (401, {"error": "unauthorized"}))

    def test_broker_cannot_use_admin_endpoints(self):
        self.start()
        for path in ("/issue", "/verify", "/revoke"):
            status, result = self.request("POST", path, {"token": "bonds_placeholder"}, {
                "X-Bonds-Broker": self.broker,
            })
            self.assertEqual((status, result), (401, {"error": "unauthorized"}))

    def test_tokens_and_revocation_survive_real_process_restarts(self):
        self.start()
        token = self.issue()
        retained_token = self.issue()
        before = self.introspect(token)
        self.stop()
        self.start()
        self.assertEqual(self.introspect(token), before)

        status, result = self.request("POST", "/revoke", {"token": token}, {"X-Bonds-Admin": self.admin})
        self.assertEqual((status, result), (200, {"revoked": True}))
        self.stop()
        self.start()

        after = self.introspect(token)
        self.assertFalse(after["active"])
        self.assertTrue(after["revoked"])
        self.assertEqual(after["jti"], before["jti"])
        self.assertTrue(self.introspect(retained_token)["active"])

    def test_invalid_tokens_expiry_and_wrong_scope_fail_closed(self):
        self.start()
        self.assertEqual(self.introspect(""), {"active": False})
        self.assertEqual(self.introspect("bonds_unknown_isolated_token"), {"active": False})
        token = self.issue()
        for audience, scope in (("wrong-audience", "research:read"), ("research-intelligence", "research:write")):
            status, result = self.request("POST", "/verify", {
                "token": token, "audience": audience, "required_scope": scope,
            }, {"X-Bonds-Admin": self.admin})
            self.assertEqual((status, result), (200, {"valid": False, "claims": None}))

        # Age only the disposable fixture; service-token issuance retains its exact TTL.
        with sqlite3.connect(self.database) as database:
            database.execute("UPDATE tokens SET issued_at = ?, expires_at = ?", (1, 3601))
        self.assertFalse(self.introspect(token)["active"])
        status, result = self.request("POST", "/verify", {
            "token": token, "audience": "research-intelligence", "required_scope": "research:read",
        }, {"X-Bonds-Admin": self.admin})
        self.assertEqual((status, result), (200, {"valid": False, "claims": None}))

    def test_invalid_configuration_never_creates_the_store(self):
        invalid_channels = ("", "short", self.admin, "bonds_" + "x" * 40, "has whitespace " + "x" * 40, "x" * 4097, "jwt." + "x" * 32 + ".signature")
        for value in invalid_channels:
            self.channel_file.write_text(value, encoding="utf-8")
            checked = subprocess.run(
                [sys.executable, "-m", "bonds_security.server", "--check-config"],
                cwd=RUNTIME_ROOT, env=self.environment, capture_output=True, timeout=5,
            )
            self.assertNotEqual(checked.returncode, 0)
            self.assertFalse(self.database.exists())

        self.channel_file.write_text(self.channel, encoding="utf-8")
        for name in ("BONDS_TOKEN_CHANNEL_SECRET_FILE", "BONDS_TOKEN_BROKER_SECRET_FILE", "BONDS_TOKEN_BUILD_COMMIT"):
            invalid_environment = {key: value for key, value in self.environment.items() if key != name}
            checked = subprocess.run(
                [sys.executable, "-m", "bonds_security.server"],
                cwd=RUNTIME_ROOT, env=invalid_environment, capture_output=True, timeout=5,
            )
            self.assertNotEqual(checked.returncode, 0)
            self.assertFalse(self.database.exists())

        for build in ("unknown", BUILD_COMMIT[:7], "g" * 40):
            invalid_environment = dict(self.environment, BONDS_TOKEN_BUILD_COMMIT=build)
            checked = subprocess.run(
                [sys.executable, "-m", "bonds_security.server"],
                cwd=RUNTIME_ROOT, env=invalid_environment, capture_output=True, timeout=5,
            )
            self.assertNotEqual(checked.returncode, 0)
            self.assertFalse(self.database.exists())

    def test_valid_configuration_preflight_does_not_create_the_store(self):
        checked = subprocess.run(
            [sys.executable, "-m", "bonds_security.server", "--check-config"],
            cwd=RUNTIME_ROOT, env=self.environment, capture_output=True, timeout=5,
        )
        self.assertEqual(checked.returncode, 0)
        self.assertEqual(checked.stdout.strip(), b"BONDS_TOKEN_CONFIG_VALID")
        self.assertFalse(self.database.exists())


if __name__ == "__main__":
    unittest.main()
