# BONDS Portable Document Intelligence (foundation)

Commercial module independent from the BONDS production database and correspondence workflows.

## Architecture
- `core.js`: dependency-free structured normalization; proposals only; explicit workspace context.
- `file-adapters.js`: XLSX/CSV parser, PDF text extraction; images require an injected OCR implementation.
- `integration-contract.js`: CRM and correspondence reviewed-directory intent envelopes only; HR employee creation fails closed until authenticated employment linking is implemented. No email is sent.
- `local-ocr.js`: optional offline Tesseract subprocess adapter for images. Tesseract with Arabic and English trained data must be installed separately; the adapter has no cloud fallback and is not a Windows installer.
- `review-gate.js`: fail-closed review boundary requiring selected proposals, a trusted host authorization callback, and a single atomic host commit callback. Workspace IDs supplied by a caller are NOT proof of membership.
- The engine **never writes** to Supabase/PostgreSQL or sends mail. The host product must enforce authenticated tenant permission, review, persistence, duplicate checks and audit log.
- Each customer deployment must supply its **own** storage, identity, encryption keys and backup policy. Never bundle BONDS production credentials or datasets.
- Proposals are not verified facts. PDF/text/image candidates require identifying the entity and explicit human review before any insert.

## Integration contract
`analyzeFile({file:{filename,buffer},workspaceId,defaultType,ocr})` returns pending candidates. Only a separately authorized tenant-specific adapter may persist confirmed records. `commitReviewedProposals({proposal,workspaceId,actorId,approvedIndices,authorize,commit})` provides the application boundary; the host MUST verify user identity, enforce tenant access again in persistence, and make the write plus audit record atomic inside the single commit callback. This module does not supply those guarantees by itself.

## Supported foundation
- XLSX/CSV: structured rows and bilingual field aliases; original source row numbers are retained and XLSX items include sheet names. More than 20 sheets or 1000 rows fails closed (not silently truncated).
- PDF/DOCX: extracted text, non-authoritative email/phone candidates only.
- Business card image: pluggable OCR; throws `OCR_ADAPTER_REQUIRED` without one. CLI supports `--ocr-local` using separately installed Tesseract (`ara+eng`); extracted text remains unverified contact candidates.
- PDF tables, bundled OCR binaries/language models, installers, key management, licensing and local database migrations: **not implemented**. Sheet-name/row-number provenance does not yet represent cell-level evidence.

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
