# BONDS Portable Document Intelligence (foundation)

Commercial module independent from the BONDS production database and correspondence workflows.

## Architecture
- `core.js`: dependency-free structured normalization; proposals only; explicit workspace context.
- `file-adapters.js`: XLSX/CSV parser, PDF text extraction; images require an injected OCR implementation.
- The engine **never writes** to Supabase/PostgreSQL or sends mail. The host product must enforce authenticated tenant permission, review, persistence, duplicate checks and audit log.
- Each customer deployment must supply its **own** storage, identity, encryption keys and backup policy. Never bundle BONDS production credentials or datasets.
- Proposals are not verified facts. PDF/text/image candidates require identifying the entity and explicit human review before any insert.

## Integration contract
`analyzeFile({file:{filename,buffer},workspaceId,defaultType,ocr})` returns pending candidates. Only a separately authorized tenant-specific adapter may persist confirmed records.

## Supported foundation
- XLSX/CSV: structured rows and bilingual field aliases; original source row numbers are retained and XLSX items include sheet names. More than 20 sheets or 1000 rows fails closed (not silently truncated).
- PDF/DOCX: extracted text, non-authoritative email/phone candidates only.
- Business card image: pluggable OCR; throws `OCR_ADAPTER_REQUIRED` without one.
- PDF tables, offline OCR, installers, key management, licensing and local database migrations: **not implemented**. Sheet-name/row-number provenance does not yet represent cell-level evidence.

## Installation readiness
This is source-level modularization, **not an installable customer release**. Packaging, reproducible container image, offline license verification, deployment scripts, signed updates and tenant E2E acceptance must pass separately.

## Local developer smoke test (Node.js >=22)

From this directory, install the listed dependencies in an isolated test environment, then run:

```sh
node cli.js sample.csv --workspace-id 12345678-1234-4123-8123-1234567890ab --type organization
```

CLI emits JSON **review proposals only**. Its workspace identifier is metadata, **not an authorization token**: a customer-hosted server must enforce identity/tenant rights before accepting imports. Do not run CLI against untrusted files without sandboxing, size caps and malware scanning. The production installer and offline dependency bundle are still pending.
