import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from contextlib import closing
from pathlib import Path

TOKEN_ISSUER = "bonds-token-service"
SERVICE_TOKEN_TTL_SECONDS = 3600
MAX_TOKEN_TTL_SECONDS = 86400
TOKEN_SCHEMA_VERSION = 2


class BondsTokenEngine:
    def __init__(self, database):
        self.database = str(database)
        Path(self.database).parent.mkdir(parents=True, exist_ok=True)

        with closing(sqlite3.connect(self.database)) as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS tokens ("
                "token_hash TEXT PRIMARY KEY,"
                "token_type TEXT NOT NULL,"
                "subject TEXT NOT NULL,"
                "audience TEXT NOT NULL,"
                "scopes TEXT NOT NULL,"
                "expires_at INTEGER NOT NULL,"
                "revoked INTEGER NOT NULL DEFAULT 0,"
                "issued_at INTEGER,"
                "token_id TEXT)"
            )

            columns = {
                row[1]
                for row in db.execute("PRAGMA table_info(tokens)").fetchall()
            }
            if "issued_at" not in columns:
                db.execute("ALTER TABLE tokens ADD COLUMN issued_at INTEGER")
            if "token_id" not in columns:
                db.execute("ALTER TABLE tokens ADD COLUMN token_id TEXT")
            db.commit()

    def issue(self, token_type, subject, audience="bonds", scopes=None, ttl=SERVICE_TOKEN_TTL_SECONDS):
        if not token_type or not subject or not audience:
            raise ValueError("token_type, subject and audience are required")

        token_type = str(token_type)
        if token_type == "service" and ttl != SERVICE_TOKEN_TTL_SECONDS:
            raise ValueError(
                f"service token ttl must equal {SERVICE_TOKEN_TTL_SECONDS}"
            )

        if not isinstance(ttl, int) or ttl < 1 or ttl > MAX_TOKEN_TTL_SECONDS:
            raise ValueError("invalid ttl")

        scopes = scopes or []

        token = "bonds_" + secrets.token_urlsafe(48)
        digest = hashlib.sha256(token.encode()).hexdigest()
        issued_at = int(time.time())
        expires = issued_at + ttl
        token_id = secrets.token_urlsafe(24)

        with closing(sqlite3.connect(self.database)) as db:
            db.execute(
                "INSERT INTO tokens "
                "(token_hash,token_type,subject,audience,scopes,expires_at,revoked,issued_at,token_id) "
                "VALUES (?,?,?,?,?,?,0,?,?)",
                (
                    digest,
                    token_type,
                    str(subject),
                    str(audience),
                    json.dumps(scopes),
                    expires,
                    issued_at,
                    token_id,
                ),
            )
            db.commit()

        return token

    def verify(self, token, audience="bonds", required_scope=None):
        if not isinstance(token, str) or not token.startswith("bonds_"):
            return None

        digest = hashlib.sha256(token.encode()).hexdigest()

        with closing(sqlite3.connect(self.database)) as db:
            row = db.execute(
                "SELECT token_type,subject,audience,scopes,expires_at,revoked,issued_at,token_id "
                "FROM tokens WHERE token_hash=?",
                (digest,),
            ).fetchone()

        if row is None:
            return None

        (
            token_type,
            subject,
            stored_audience,
            scopes_json,
            expires,
            revoked,
            issued_at,
            token_id,
        ) = row

        if issued_at is None or token_id is None:
            return None

        if revoked or expires <= int(time.time()):
            return None

        if not hmac.compare_digest(stored_audience, audience):
            return None

        scopes = json.loads(scopes_json)
        if required_scope is not None and required_scope not in scopes:
            return None

        return {
            "token_type": token_type,
            "subject": subject,
            "audience": stored_audience,
            "scopes": scopes,
            "expires_at": expires,
        }

    def introspect(self, token):
        if not isinstance(token, str) or not token.startswith("bonds_"):
            return {"active": False}

        digest = hashlib.sha256(token.encode()).hexdigest()

        with closing(sqlite3.connect(self.database)) as db:
            row = db.execute(
                "SELECT token_type,subject,audience,scopes,expires_at,revoked,issued_at,token_id "
                "FROM tokens WHERE token_hash=?",
                (digest,),
            ).fetchone()

        if row is None:
            return {"active": False}

        (
            token_type,
            subject,
            audience,
            scopes_json,
            expires,
            revoked,
            issued_at,
            token_id,
        ) = row

        # Tokens created before the temporal-contract migration cannot safely
        # satisfy the hardened consumer because their iat/jti are unknowable.
        if issued_at is None or token_id is None:
            return {"active": False}

        active = not bool(revoked) and expires > int(time.time())

        return {
            "iss": TOKEN_ISSUER,
            "aud": audience,
            "sub": subject,
            "iat": issued_at,
            "exp": expires,
            "jti": token_id,
            "scope": json.loads(scopes_json),
            "active": active,
            "revoked": bool(revoked),
            "token_type": token_type,
        }

    def revoke(self, token):
        if not isinstance(token, str):
            return False

        digest = hashlib.sha256(token.encode()).hexdigest()

        with closing(sqlite3.connect(self.database)) as db:
            result = db.execute(
                "UPDATE tokens SET revoked=1 WHERE token_hash=?",
                (digest,),
            )
            db.commit()
            changed = result.rowcount

        return changed == 1
