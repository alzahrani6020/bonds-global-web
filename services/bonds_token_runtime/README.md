# Bonds token runtime (8771)

This directory is the durable source for the localhost token issuer/introspection service used by protected service-token consumers.

## Contract

- Bind: `127.0.0.1`
- Default port: `8771`
- Issuer: `bonds-token-service`
- Service-token TTL: exactly `3600` seconds
- Required consumer claims: `iss`, `aud`, `sub`, `iat`, `exp`, `jti`
- Service tokens with another TTL are rejected.
- Legacy rows without persisted `issued_at` / `token_id` introspect as inactive.
- Revoked tokens introspect as inactive.

See `contract.json` for the machine-readable contract.

## Configuration

Required environment variables:

- `BONDS_TOKEN_DB`: path to the SQLite database.
- `BONDS_TOKEN_ADMIN_SECRET_FILE`: path to the admin-secret file.

Optional:

- `BONDS_TOKEN_PORT`: defaults to `8771`.
- `BONDS_TOKEN_BUILD_COMMIT`: exact Git commit used to deploy the running build. Set this during rollout so `/health` can tie the process to reviewed source.

Do not commit the database, secret file, tokens, or runtime logs.

## Startup

From `services/bonds_token_runtime`:

```powershell
.\run.ps1
```

Equivalent:

```powershell
python -m bonds_security.server
```

The process binds only to `127.0.0.1`.

## Storage and schema behavior

State is stored in SQLite at `BONDS_TOKEN_DB`.

Startup creates the `tokens` table if absent. Existing pre-hardening databases are migrated additively by adding nullable `issued_at` and `token_id` columns when missing. Existing rows are not assigned invented temporal identity; rows without those fields fail closed during introspection.

Issued-token state and revocation state are therefore persisted in the database rather than process memory.

## Verification

Run the contract tests from this directory:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

The tests verify:

- fixed service-token TTL,
- introspection claims,
- TTL override rejection,
- active-token persistence across a new engine instance,
- revocation persistence across a new engine instance.

A live rollout must still perform an actual process restart test against port 8771.

## Rollout identity

Before starting a reviewed build, set:

```powershell
$env:BONDS_TOKEN_BUILD_COMMIT = "<exact-reviewed-commit-sha>"
```

Then verify `GET /health` reports that SHA together with schema version and TTL.

## Recovery / rollback

1. Record the currently deployed Git commit and database path.
2. Back up the SQLite database before replacing the running source.
3. Keep the previous known-good Git commit available.
4. Stop only the process listening on port 8771.
5. Check out the intended known-good commit.
6. Keep the same `BONDS_TOKEN_DB` and admin-secret-file configuration unless the recovery specifically requires otherwise.
7. Set `BONDS_TOKEN_BUILD_COMMIT` to the checked-out commit.
8. Start with `run.ps1`.
9. Verify `/health`, then issue/introspect/revoke using a disposable token.
10. Verify the unrelated service on port 8765 remains unchanged.

Do not weaken consumer authorization, enlarge TTL, or accept legacy claims as a rollback mechanism.
