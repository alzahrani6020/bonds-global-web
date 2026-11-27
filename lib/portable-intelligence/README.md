# BONDS Portable Document Intelligence (foundation)

Commercial module independent from the BONDS production database and correspondence workflows.

## Architecture
- `core.js`: dependency-free structured normalization; proposals only; explicit workspace context.
- `file-adapters.js`: XLSX/CSV parser, PDF text extraction; images require an injected OCR implementation.
- `integration-contract.js`: CRM and correspondence reviewed-directory intent envelopes only; HR employee creation fails closed until authenticated employment linking is implemented. No email is sent.
- `local-ocr.js`: optional offline Tesseract subprocess adapter for images. Tesseract with Arabic and English trained data must be installed separately; the adapter has no cloud fallback and is not a Windows installer.
- `encrypted-backup.js`: encrypted offline backups and consistent live SQLite snapshots using the Node SQLite backup API; always restore to a NEW file. Live snapshots temporarily create plaintext in a restricted scratch directory: the scratch volume must itself be encrypted for real customer deployments.
- `license-verifier.js`: Ed25519 offline customer license verification. `licensed-commercial-workflow.js` revalidates signature, customer scope, expiry and licensed features per operation. No issuance server, billing, renewal, revocation or signed installer is provided.
- `sqlite-store.js`: local SQLite with per-workspace authorization, atomic reviewed imports, search, updates, soft archive and audits. Optional AES-256-GCM record/source encryption with keyed names protects those columns, but it is NOT full-database SQLCipher encryption: user IDs, usernames and schema metadata are still plaintext; real customer deployment remains NOT APPROVED.
- `review-gate.js`: fail-closed review boundary requiring selected proposals, a trusted host authorization callback, and a single atomic host commit callback. Workspace IDs supplied by a caller are NOT proof of membership.
- The engine **never writes** to BONDS production Supabase/PostgreSQL or sends mail. Offline customer-local runtime includes a session-authenticated loopback UI and a persistent local identity provider; CRM/HR/correspondence exports remain reviewed data intents, not actual destination writes.
- Each customer deployment must supply its **own** storage, identity, encryption keys and backup policy. Never bundle BONDS production credentials or datasets.
- Proposals are not verified facts. PDF/text/image candidates require identifying the entity and explicit human review before any insert.

## Integration contract
`analyzeFile({file:{filename,buffer},workspaceId,defaultType,ocr})` returns pending candidates. Only a separately authorized tenant-specific adapter may persist confirmed records. `commitReviewedProposals({proposal,workspaceId,actorId,approvedIndices,authorize,commit})` provides the application boundary; the host MUST verify user identity, enforce tenant access again in persistence, and make the write plus audit record atomic inside the single commit callback. This module does not supply those guarantees by itself.

## Supported foundation
- XLSX/CSV: structured rows and bilingual field aliases; original source row numbers are retained and XLSX items include sheet names. More than 20 sheets or 1000 rows fails closed (not silently truncated).
- PDF/DOCX: extracted text and labeled organization/contact suggestions requiring explicit human review; selected labeled records carry source-line evidence.
- Business card image: pluggable OCR; throws `OCR_ADAPTER_REQUIRED` without one. CLI supports `--ocr-local` using separately installed Tesseract (`ara+eng`); extracted text remains unverified contact candidates.
- Generic HTML tables: header-normalized organization/contact rows and cell provenance. The financial year/table reconciliation feature is explicitly out of scope. Scanned PDF OCR requires externally installed Poppler/Tesseract and is bounded to 12 pages; real-world recognition accuracy is not fully accepted.

## Installation readiness
This is source-level modularization, **not an installable customer release**. Packaging, reproducible container image, offline license verification, deployment scripts, signed updates and tenant E2E acceptance must pass separately.

## Local developer smoke test (Node.js >=22)

From this directory, install the listed dependencies in an isolated test environment, then run:

```sh
node cli.js sample.csv --workspace-id 12345678-1234-4123-8123-1234567890ab --type organization
```

CLI emits JSON **review proposals only**. Its workspace identifier is metadata, **not an authorization token**: a customer-hosted server must enforce identity/tenant rights before accepting imports. Do not run CLI against untrusted files without sandboxing, size caps and malware scanning. The production installer and offline dependency bundle are still pending.

Offline image example after installing Tesseract with Arabic and English language packs:

```sh
node cli.js card.png --workspace-id 12345678-1234-4123-8123-1234567890ab --type contact --ocr-local
```

No records are persisted by this command. Run it only in a restricted account or sandbox with trusted/virus-scanned files. The separate Tesseract binary and its licenses must be included and validated by the future commercial installer.

## Isolated local persistence acceptance

Run `node --test tests/intelligence/portable-sqlite-acceptance.cjs` from the repository root. The test writes only temporary SQLite fixtures, verifies a review-approved import, closes/reopens the database, checks two different workspace IDs cannot read each other's records, and verifies a rejected import is not partially persisted. This is NOT evidence of production authentication, encryption, SaaS RLS, disaster recovery, or a completed installer.

## Local acceptance for backup and license verifier

Run `node --test tests/intelligence/portable-backup-license.acceptance.cjs` from repository root. This covers encrypted SQLite backup/readback, wrong password, tampering, overwrite refusal, and tenant-scoped signed license validation. These are isolated fixtures only. The live SQLite database remains unencrypted, the backup process requires complete shutdown, and the verifier is not a full licensing platform.

## Integrated commercial workflow (review-only)

`commercial-workflow.js` connects existing components without touching BONDS SaaS:
`analyze -> prepareEntityReview (unstructured sources) -> duplicates -> approve -> SQLite -> search / update -> exportDirectory`.

- `createCommercialWorkflow({filename,getMembership,ocr})` requires a **trusted, server-side** membership resolver. The caller must authenticate `actorId` outside this library; accepting a client-supplied actor ID would defeat tenant isolation.
- `analyze({workspaceId,actorId,file,defaultType})` requires `documents.write` and never saves candidates.
- `prepareEntityReview(...)` prepares a proposed record; fields not supported by extraction require a reviewer's explicit entry. The reviewer must submit the resulting proposal through `approve`.
- `approve(...)` checks `import.reviewed`, requires selected records, blocks duplicates by default and rechecks normalized identity within a `BEGIN IMMEDIATE` SQLite transaction; explicit reviewed duplicate exceptions require a reason and are audit logged. This is not an on-disk unique constraint for direct writes outside the API.
- `list/search/update` are scoped to a workspace and enforce `records.read` / `records.write`. Every update writes an audit event within the same transaction.
- `exportDirectory` checks explicit `crm.export`, `correspondence.directory.export` or `hr.directory.export` permission, rechecks every record's workspace, and emits **destination intents only**. It does not deliver email, create HR employees, or write into destination systems.
- `close()` must be called by the host. A licensed localhost server (`commercial-server.js`) and persistent member identities (`local-identity.js`) are available as an isolated test-only app. Its SQLite storage is not fully encrypted and has not passed production-grade threat modelling.
- These are source-level integration interfaces, **not** an authenticated Windows installer or a complete commercial release. Production authorization, licensing enforcement, encryption at rest, operational backup/restore, destination adapter authorization, and real multi-user E2E remain separate acceptance gates.

Integration contract test: `npx jest tests/intelligence/portable-commercial-workflow.test.js --runInBand` from repository root.

## Local integrated UI and Windows acceptance

- `commercial-ui.html` / `commercial-ui.js`: Arabic localhost UI for login, file upload, source-based identity review, explicit approval, search, edit, soft archive, permissioned export intents and encrypted-backup requests.
- `commercial-server.js`: loopback-only authenticated HTTP API. It **never** takes actor identity or target tenant membership from browser JSON. User accounts come from trusted `verifyCredentials` and `getMembership` callbacks; sessions expire and all sensitive operations recheck membership.
- `local-identity.js`: SQLite-backed salted password hashing, workspace role membership and immediate membership revocation; offline provisioning only. Users and membership metadata are not fully encrypted.
- `start-local-server.js`: explicit bootstrap and licensed local test-data-only startup. Requires a customer-created signed token, public key, workspace, local database and `BONDS_ALLOW_UNENCRYPTED_TEST_DATA=1` acknowledgement; not a signed Windows installer. Optional `BONDS_DATA_KEY_BASE64` protects record/source fields, while `BONDS_LOCAL_BACKUP_DIR` sets a local backup destination.
- The commercial Windows CI gate tests the actual Node runtime, isolated SQLite and roles, backup restore, signed licensing, OCR adapters and Chromium UI journeys. An actual customer machine and cross-application delivery remain unverified.

**Important:** Transient live-backup snapshots include plaintext files until encrypted and cleaned. Real customer use requires an encrypted temporary volume, operating-system storage protections, installation security review, scheduled recovery testing and an approved key-custody scheme. Do not enter real personal or institutional data into this test-only package.
