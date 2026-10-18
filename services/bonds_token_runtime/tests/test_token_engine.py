import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path

from bonds_security.token_engine import (
    BondsTokenEngine,
    SERVICE_TOKEN_TTL_SECONDS,
    TOKEN_ISSUER,
)


class BondsTokenEngineContractTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.db = str(Path(self.tempdir.name) / "tokens.sqlite3")

    def tearDown(self):
        self.tempdir.cleanup()

    def issue_service_token(self, engine):
        return engine.issue(
            token_type="service",
            subject="service:orchestrator",
            audience="research-intelligence",
            scopes=["research:read"],
            ttl=SERVICE_TOKEN_TTL_SECONDS,
        )

    def test_service_token_contract(self):
        engine = BondsTokenEngine(self.db)
        token = self.issue_service_token(engine)
        claims = engine.introspect(token)

        self.assertTrue(claims["active"])
        self.assertFalse(claims["revoked"])
        self.assertEqual(claims["iss"], TOKEN_ISSUER)
        self.assertEqual(claims["aud"], "research-intelligence")
        self.assertEqual(claims["sub"], "service:orchestrator")
        self.assertEqual(claims["scope"], ["research:read"])
        self.assertIsInstance(claims["iat"], int)
        self.assertIsInstance(claims["exp"], int)
        self.assertTrue(claims["jti"])
        self.assertEqual(
            claims["exp"] - claims["iat"],
            SERVICE_TOKEN_TTL_SECONDS,
        )

    def test_service_token_ttl_override_is_rejected(self):
        engine = BondsTokenEngine(self.db)
        with self.assertRaises(ValueError):
            engine.issue(
                token_type="service",
                subject="service:orchestrator",
                audience="research-intelligence",
                scopes=["research:read"],
                ttl=7200,
            )

    def test_active_token_survives_engine_restart(self):
        first = BondsTokenEngine(self.db)
        token = self.issue_service_token(first)
        before = first.introspect(token)

        second = BondsTokenEngine(self.db)
        after = second.introspect(token)

        self.assertTrue(after["active"])
        self.assertEqual(after["jti"], before["jti"])
        self.assertEqual(after["iat"], before["iat"])
        self.assertEqual(after["exp"], before["exp"])

    def test_revocation_survives_engine_restart(self):
        first = BondsTokenEngine(self.db)
        token = self.issue_service_token(first)
        self.assertTrue(first.revoke(token))
        self.assertFalse(first.introspect(token)["active"])

        second = BondsTokenEngine(self.db)
        after = second.introspect(token)

        self.assertFalse(after["active"])
        self.assertTrue(after["revoked"])

    def test_legacy_row_without_temporal_identity_is_inactive(self):
        engine = BondsTokenEngine(self.db)
        legacy_token = "bonds_legacy"
        digest = hashlib.sha256(legacy_token.encode()).hexdigest()

        with sqlite3.connect(self.db) as db:
            db.execute(
                "INSERT INTO tokens "
                "(token_hash,token_type,subject,audience,scopes,expires_at,revoked,issued_at,token_id) "
                "VALUES (?,?,?,?,?,?,0,NULL,NULL)",
                (
                    digest,
                    "service",
                    "service:legacy",
                    "research-intelligence",
                    "[]",
                    4102444800,
                ),
            )
            db.commit()

        self.assertEqual(engine.introspect(legacy_token), {"active": False})


if __name__ == "__main__":
    unittest.main()
