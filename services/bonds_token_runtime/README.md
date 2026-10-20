# Bonds token runtime (8771)

This directory is the durable source for the localhost token issuer/introspection service used by protected service-token consumers.

## Contract

- Bind: `127.0.0.1`
- Default port: `8771`
- Issuer: `bonds-token-service`
- Channel contract version: `1`; token schema version: `2`
- Service-token TTL: exactly `3600` seconds
- Required consumer claims: `iss`, `aud`, `sub`, `iat`, `exp`, `jti`
- Service tokens with another TTL are rejected.
- Legacy rows without persisted `issued_at` / `token_id` introspect as inactive.
- Revoked tokens introspect as inactive.
- Service-token introspection includes `token_type: "service"`; consumers must not treat other token types as service credentials.

The credentials have separate purposes:

| Request | Required credential | Purpose |
| --- | --- | --- |
| `POST /issue`, `POST /revoke`, `POST /verify` | `X-Bonds-Admin` | Token administration on the host |
| `POST /introspect`, `GET /health` | `X-Bonds-Channel` | Authenticate the verifier/readiness channel |

An admin credential does not authorize introspection or readiness. A channel credential does not authorize issuance, revocation, or administrative verification. Duplicate credential headers are rejected. User-session Bearer tokens and the service token being inspected cannot substitute for either credential.

Every authenticated introspection response has the envelope `{ "runtime": { ... }, "claims": { ... } }`. `runtime` carries the same service/issuer, status, build SHA, contract/schema versions, TTL and channel-auth policy as `/health`; the existing claims remain unchanged. Consumers must validate that identity and their expected build on every introspection before accepting claims. A claims-only response from an older runtime cannot satisfy this contract, even if an earlier readiness probe succeeded.

See `contract.json` for the machine-readable contract.

## Configuration

Required environment variables:

- `BONDS_TOKEN_DB`: path to the SQLite database.
- `BONDS_TOKEN_ADMIN_SECRET_FILE`: path to the admin-secret file.
- `BONDS_TOKEN_CHANNEL_SECRET_FILE`: path to the separate channel-secret file.
- `BONDS_TOKEN_BUILD_COMMIT`: exact 40-hex Git commit of the reviewed deployed source. Readiness reports the lowercase SHA. Missing, shortened, or placeholder identities prevent startup.

The channel secret must contain 32–4096 printable ASCII characters without whitespace. It must differ from the admin secret and must not have a `bonds_` service-token prefix or three-segment JWT shape. Secret files are read on process startup; they must already exist and be readable by the runtime service account. The runtime and installer do not generate or rotate credentials.

Optional:

- `BONDS_TOKEN_PORT`: defaults to `8771`.

Ephemeral loopback ports are supported for isolated tests. The Windows service installer requires `8771`.

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

Validate the configuration without starting a listener or opening/creating the token database:

```powershell
python -m bonds_security.server --check-config
```

Both direct startup and the Windows service wrapper use the same validator. Invalid credentials or build identity fail before the token store is opened.

## Coordinated client/runtime rollout

This release changes the wire contract: unauthenticated `/introspect` and `/health` requests now return `401`. An older verifier that sends no channel credential will fail against this runtime. Update the existing runtime and server-side verifier together within the approved rollout procedure.

The verifier receives the matching channel credential as server-side `BONDS_TOKEN_CHANNEL_SECRET`, and pins the runtime identity through `BONDS_TOKEN_EXPECTED_BUILD_COMMIT`. The inspected service token remains a separate request-body value. Keep the user's session in the existing user-authentication flow; never publish either runtime credential to browser or Native client code.

The runtime's HTTP connection remains loopback-only. An existing protected HTTPS route must carry the channel header to this loopback service for remote consumers; do not bind `8771` publicly or introduce a second issuer/store. The verifier must validate the authenticated health contract and exact build before the rollout is considered ready. Missing configuration, an old runtime, or a failed/omitted probe is not successful readiness.

The existing web deployment requires these server-side settings:

| Setting | Required value |
| --- | --- |
| `BONDS_TOKEN_INTROSPECTION_URL` | HTTPS URL with the exact `/introspect` path |
| `BONDS_TOKEN_RUNTIME_HEALTH_URL` | HTTPS URL with the exact `/health` path, on the same origin |
| `BONDS_TOKEN_CHANNEL_SECRET` | The separately provisioned channel credential matching the runtime file |
| `BONDS_TOKEN_EXPECTED_BUILD_COMMIT` | Exact lowercase 40-hex SHA of the verified runtime source |

Both URLs reject embedded credentials, query strings, fragments and redirects. Provision credentials through the existing secret-management channel; do not put them in a URL, browser configuration, logs or a review comment. If `BONDS_TOKEN_ISSUER` is present it must remain `bonds-token-service`.

For Capability API requests, the user's existing authenticated session stays in `Authorization`, and the issued service token stays in `X-Bonds-Service-Token`. The server adds `X-Bonds-Channel` only when contacting the runtime. No request-body role, subscription tier, user ID or governance array supplies authority. Runtime/configuration failures return `503`; denied user/token authorization returns `403`.

## Existing user governance prerequisites

The Capability API resolves the active profile, `get_user_permissions` result, current subscription and effective service entitlements from the existing Supabase records using the server-side client. An expired or inactive subscription cannot provide its former paid tier. The orchestrator receives the resolved user ID and tier, including when the request body contains conflicting values. Missing or conflicting authority records fail closed.

The forward migration `20261020092930_complete_governed_service_catalog.sql` adds only the missing permission and entitlement definitions for enabled Research Intelligence and Orchestrator services, with entitlement defaults set to `false`. It does not grant a role, plan, override or user access. Apply it through the approved database release process and record the intended user/role and subscription entitlement using the existing administration controls. Do not infer business grants from a passing token test. The disabled Agent Runtime remains disabled.

Strict `/api/readiness` requires both authenticated runtime identity/contract checks and accessible governance definitions/RPC. It also verifies that the introspection endpoint rejects an unauthenticated channel request. Missing Native mode, runtime settings or governance definitions is an unavailable result. The regular `/api/health` retains its core site-health purpose. The production release workflow checks strict readiness on the staged deployment before promotion; metadata readiness still does not prove any real user's Capability execution.

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
- real HTTP credential separation for every runtime endpoint,
- exact authenticated health identity and contract,
- identical runtime identity in health and introspection responses for active and unknown tokens,
- duplicate-header rejection,
- successful service-token issuance and verification over HTTP,
- missing/unknown, expired, wrong-audience and wrong-scope tokens,
- active-token and revocation persistence across actual subprocess restarts using the same temporary SQLite file,
- invalid configuration rejected before database creation.

These are isolated tests: credentials, SQLite files and ports are temporary. Expiry is tested by aging only the temporary fixture's stored timestamps; production token TTL remains exactly 3600 seconds. Socket-denied environments fail the HTTP tests rather than skipping them. These tests do not prove deployed host access, a Windows service cutover, or a production Capability execution. Those require evidence from the selected deployment or an explicitly approved host test window.

From the repository root, the integrated acceptance harness can be run with Node.js, Python 3 and OpenSSL installed:

```sh
node tests/integration/governed-token-runtime-acceptance.js
```

It runs the actual Python runtime with temporary SQLite state behind a local TLS endpoint, then exercises the actual verifier, Capability API, gateway, executor and Research Intelligence adapter. User sessions, Supabase authority records and research inputs are controlled fixtures. It checks denied/authorized execution, credential separation, actual process restarts, and rollback to the recorded previous runtime source while retaining the current database. A pre-channel runtime must fail the new client contract; restoring the candidate must recover authorized execution without reviving revoked tokens. Its JSON report records source hashes, results and process/listener cleanup. It is isolated acceptance, not production evidence.

The CI job **Token Runtime Windows service acceptance (isolated)** runs `tests/test_windows_service_lifecycle.ps1` on a disposable GitHub-hosted Windows VM. The script requires explicit CI guards and refuses a pre-existing service, listener or state directory. It uses temporary credentials and a real SCM service to check restart persistence and failed-candidate source/configuration recovery, including a revocation committed after the backup. Only the sanitized acceptance report is uploaded. Missing prerequisites, a failed recovery or unproved cleanup fails the job. A successful run proves that Windows test environment; it does not establish access to the production host.

## Rollout identity

Before starting a reviewed build, set:

```powershell
$env:BONDS_TOKEN_BUILD_COMMIT = "<exact-reviewed-commit-sha>"
```

Then verify `GET /health` with `X-Bonds-Channel` reports all of the following:

| Field | Required value |
| --- | --- |
| `service`, `issuer` | `bonds-token-service` |
| `status` | `ok` |
| `build_commit` | Exact expected reviewed 40-hex SHA |
| `schema_version` | `2` |
| `contract_version` | `1` |
| `service_token_ttl_seconds` | `3600` |
| `channel_auth` | `required` |

The health SHA reports configured process metadata; it is not independent proof of the files executing on the host. The Windows installer establishes that link by requiring Git, matching the checkout's actual `HEAD` to the configured SHA, and rejecting changes or untracked files in the runtime directory. It also verifies that every copied source file is tracked, repeats the checks before cutover, and compares the copied files' SHA-256 hashes with the verified source. A Git error, source-only archive without Git, dirty runtime checkout, mismatched SHA or copy mismatch fails closed. These checks are local and do not fetch from the network. A manual launch must establish the equivalent source provenance separately.

The installer requires Python 3.10+ and a verified default bytecode-cache location. It rejects redirected or unproved cache configuration. Its read-only source preflight uses an unused cache prefix with bytecode writes disabled, so an ignored checkout cache cannot substitute older code. After copying or restoring source, and before importing or starting it, the installer removes only the legacy/tagged bytecode caches of the four managed Python files while the service is proved stopped. It refuses reparse-point traversal and retains other files. This is necessary because Python's default timestamp/size cache validation can otherwise accept older code when a replacement source has the same size and modification time; see the [Python import reference](https://docs.python.org/3/reference/import.html#cached-bytecode-invalidation).

## Windows service activation

`windows/install-token-service.ps1` without `-Activate` now performs preflight only. It does not overwrite runtime files, update service configuration, or stop a process. `-Activate` repeats the checks and first saves the previous source/configuration paths plus a consistent SQLite backup to a unique recovery directory before cutover. Provision the state directory with the host's existing restricted access policy; snapshots must stay private.

The installer requires explicit machine-level database, admin/channel file paths and exact build identity from a clean Git checkout. For an existing managed service, the database, interpreter, runtime directory, port and existing credential paths must match the recorded service configuration. Its registered `PythonClass` must point to the wrapper in that runtime directory. `ImagePath` and `PythonClass` are recorded and checked before cutover and recovery. The installer does not run pywin32 `update` for that service, so its SCM launch registration remains unchanged; only a new service uses `install`. A running listener must be the verified child of `BondsTokenRuntimeService`, with its recorded build and contract healthy on loopback. Failed listener inventory cannot be interpreted as a free port.

Candidate and recorded database, credential, interpreter, runtime and state paths must be fully qualified Windows file-system paths before mutation. Relative, drive-relative and root-relative paths are rejected; the installer never reinterprets or moves the token store. Existing startup type and delayed-auto-start state are recorded in the recovery snapshot. During replacement or source restoration, the service is disabled and must be stopped with no listener on `8771`, preventing a queued SCM recovery restart from loading partially copied source. Its recorded startup settings are restored before the controlled start; existing recovery actions are retained. An existing service must have a running, healthy recovery baseline. A stopped, disabled or unrecordable baseline is refused before cutover, because re-enabling it could allow an earlier queued restart without restoring its observed state.

An unmanaged legacy process is left running. Its automatic takeover is refused because an unverified command line does not prove which database, source or credentials it uses. A host operator must establish that launch configuration and a tested recovery path during an approved maintenance window before migrating it. The installer never force-stops a process.

For managed cutover failure, the installer restores the previous runtime source and service environment, confirms the retained SCM registration, and verifies the prior build. This restores the launch configuration under the enforced same-interpreter, same-wrapper and unchanged-registration conditions. An unexpected concurrent change to `ImagePath` or `PythonClass` stops automatic recovery instead of claiming it succeeded. The installer keeps the current database, including revocations committed after the backup. Recovery snapshots are retained; readiness success does not claim full Capability acceptance or independently prove that the previous source matched its reported historical SHA.

## Recovery / rollback

1. Record the currently deployed Git commit and database path.
2. Back up the SQLite database before replacing the running source.
3. Keep the previous known-good Git commit available.
4. Prove ownership of the listener and its recoverable launch configuration before stopping the managed service in the approved window.
5. Check out the intended known-good commit.
6. Keep the current `BONDS_TOKEN_DB` and recorded credential-file configuration. Do not restore the older database backup during a source rollback: that could resurrect tokens revoked after the backup.
7. Set `BONDS_TOKEN_BUILD_COMMIT` to the checked-out commit.
8. For a managed service, use the verified SCM recovery procedure above. Use `run.ps1` only for an already documented standalone launch procedure after proving there is no competing service/listener.
9. Verify the authenticated `/health` identity/contract and coordinated verifier configuration, then issue/introspect/revoke using a disposable token. Recheck a revoked token after the process restarts.
10. Verify the unrelated service on port 8765 remains unchanged.

Do not weaken consumer authorization, enlarge TTL, or accept legacy claims as a rollback mechanism.

Rolling back to a pre-channel runtime does not satisfy the new production contract. Its claims-only responses fail the new verifier's per-request runtime identity/build check. A runtime with another build also fails that check. Keep governed service-token execution fail-closed until a compatible runtime/client pair is restored and its acceptance checks pass; a successful health check from an earlier deployment cannot authorize execution after rollback.
