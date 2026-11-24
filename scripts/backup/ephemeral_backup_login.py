#!/usr/bin/env python3
"""Ephemeral database backup login. Never outputs the login password or verifier."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sys
from datetime import datetime, timedelta, timezone
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "hutxsqzplyuqgnghsrcs"
RUN_ID = os.environ.get("GITHUB_RUN_ID", "")
if not RUN_ID.isascii() or not RUN_ID.isdecimal() or not (1 <= len(RUN_ID) <= 15):
    raise SystemExit("Invalid GitHub run identifier")
ROLE = "bonds_backup_" + RUN_ID
POOLER = "aws-1-eu-central-1.pooler.supabase.com"

def execute_sql(query):
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    if not token:
        raise RuntimeError("SUPABASE_ACCESS_TOKEN unavailable")
    ref = os.environ.get("SUPABASE_PROJECT_REF", "")
    if ref != PROJECT:
        raise RuntimeError("Production project ref mismatch")
    endpoint = "https://api.supabase.com/v1/projects/" + PROJECT + "/database/query"
    body = json.dumps({"query": query, "read_only": False}).encode()
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            if response.status not in (200, 201, 204):
                raise RuntimeError("Management SQL returned unexpected status")
            response.read()
    except urllib.error.HTTPError as exc:
        # Do not print response body, SQL query, authentication token, or verifier.
        raise RuntimeError("Management SQL failed, HTTP " + str(exc.code)) from None

def scram_verifier(password):
    salt = secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 4096)
    stored = hashlib.sha256(hmac.new(salted, b"Client Key", "sha256").digest()).digest()
    server = hmac.new(salted, b"Server Key", "sha256").digest()
    b64 = lambda v: base64.b64encode(v).decode("ascii")
    return "SCRAM-SHA-256$4096:" + b64(salt) + "$" + b64(stored) + ":" + b64(server)

def provision():
    password = secrets.token_urlsafe(48)
    verifier = scram_verifier(password)
    expires = (datetime.now(timezone.utc) + timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M:%S+00")
    execute_sql("CREATE ROLE " + ROLE + " WITH LOGIN BYPASSRLS PASSWORD '" + verifier + "' VALID UNTIL '" + expires + "'; GRANT pg_read_all_data TO " + ROLE + "; ALTER ROLE " + ROLE + " SET default_transaction_read_only = on;")
    print("::add-mask::" + password, flush=True)
    url = ("postgresql://" + ROLE + "." + PROJECT + ":"
           + urllib.parse.quote(password, safe="")
           + "@" + POOLER + ":5432/postgres?sslmode=require")
    base = Path(os.environ["RUNNER_TEMP"]) / "bonds-backup"
    base.mkdir(mode=0o700, parents=True, exist_ok=True)
    (base / "role-name").write_text(ROLE)
    path = base / "connection-url"
    fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        stream.write(url)
    print("PASS: ephemeral dedicated backup login provisioned; secret not logged")

def disable():
    execute_sql("ALTER ROLE " + ROLE + " WITH NOLOGIN PASSWORD NULL; REVOKE pg_read_all_data FROM " + ROLE + "; DROP ROLE " + ROLE + ";")
    path = Path(os.environ["RUNNER_TEMP"]) / "bonds-backup" / "connection-url"
    if path.exists():
        path.unlink()
    print("PASS: dedicated backup login disabled and verifier cleared")

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("provision", "disable"):
        raise SystemExit("usage: ephemeral_backup_login.py provision|disable")
    try:
        if sys.argv[1] == "provision":
            provision()
        else:
            disable()
    except Exception as exc:
        # Restrict exceptions to sanitized program-generated strings.
        print("FAIL: ephemeral backup role operation: " + type(exc).__name__
              + (": " + str(exc) if str(exc).startswith(("Management SQL failed, HTTP ", "SUPABASE_ACCESS_TOKEN unavailable", "Production project ref mismatch", "Management SQL returned unexpected status")) else ""), file=sys.stderr)
        raise SystemExit(1)
