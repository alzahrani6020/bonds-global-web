# BONDS Portable Commercial Intelligence — Acceptance Matrix

**Scope:** The nine original requirements of the independent, customer-installable commercial entity extraction engine. Excludes financial statements, financial year matching, video/audio features, and BONDS production data.

**Status: FAIL for commercial acceptance** until all gates have direct evidence on one immutable release SHA. A code commit, unit-test pass, merge, or synthetic SQLite fixture does not count as a customer-ready installation.

| Original requirement | Existing implementation (source-level only) | Evidence still required before DONE | Current |
|---|---|---|---|
| 1. PDF/Excel/Word/images/business cards/HTML | `file-adapters.js`, `local-pdf-ocr.js`, `local-ocr.js`, `html-table-review.js` | End-to-end real file corpus across formats, scanned and mixed PDFs, corrupt/oversized/hostile input, no silent truncation | UNKNOWN |
| 2. Institutions and individual records | `entity-intelligence.js` labeled extraction and candidate classifications | Multiple businesses and contacts per source file; source provenance, Arabic/English mixed contacts, government/hospitals/schools, no cross-entity data mixing | UNKNOWN |
| 3. Normalization/classification/duplicates | `core.js`, `entity-intelligence.js`, `commercial-workflow.js` | Full normalization and fuzzy match accuracy on real examples, collision/concurrency tests with atomic per-workspace constraints | UNKNOWN |
| 4. Review/edit/approve before insert | `review-gate.js`, `commercial-workflow.js` | Complete GUI scenario, authenticated reviewer, evidence override reason, rejection and correction history | UNKNOWN |
| 5. Persist/search/update/read | `sqlite-store.js`, atomic writes and audit for imports/edits | End-user GUI and API reopen, delete/archive with permission, scale/indexing, concurrent edits and recovery | UNKNOWN |
| 6. CRM/correspondence/HR sharing | `approved-directory-export.js` produces *intents*, no destination writes | Authorized destination adapters, real destination readback, no email without explicit send, destination workspace isolation | BLOCKED: connectors not implemented |
| 7. Customer/company isolation | `tenant-authorization.js` requires trusted `getMembership` callback | Installed host authentication and verified membership records; real two-company and multi-role negative E2E | BLOCKED: authenticated host not implemented |
| 8. Independent customer install/licensing | `license-verifier.js`, `licensed-commercial-workflow.js` (opt-in signed verification); separate SQLite | Signed clean Windows installer, operational license issuance/revocation/renewal, robust offline restrictions, full client independence | BLOCKED: commercial installer and issuance not implemented |
| 9. UI/permissions/backups/tests | Portable V6 local prototype, `encrypted-backup.js` offline backup and restore | Real Windows/browser UI, encrypted live DB, independent key custody, online consistent backup/recovery exercise, complete security gate | BLOCKED: commercial security and installation incomplete |

## Mandatory non-negotiable gates

- Record the exact `main` and PR SHA, build artifact checksum, build environment and supported OS.
- For each format attach real input hash, extracted entities, field-level source offsets, manual corrections and post-save readback.
- Run negative tests: forged identity, viewer escalation, cross-company reads/exports, malicious upload, duplicate concurrent approval, tampered license and backup, missing OCR runtime.
- Restore backup to an isolated machine and read back original records and audit events.
- Verify the *actual installed UI*, not just an API or a localhost fixture, on Windows desktop and mobile browser.
- Review all changed files for unintended changes to BONDS website, HR, CRM production, user memberships, security controls and financial modules.
- CI and visual regressions must pass without bypass or unreviewed screenshot replacement.
- No live customer data until live SQLite encryption and key recovery are verified.

## Evidence observed on 2026-11-27 (historic, must rerun on final SHA)

- PR #1279: https://github.com/alzahrani6020/bonds-global-web/pull/1279
- Previous CI run 46053546382: 5,011 Jest tests passed; 2 mobile homepage visual screenshots failed. A full CI PASS has not been confirmed for the current SHA.
- Source-level `commercial-workflow.js` integrates analyze/review/SQLite/search/update/export-intent, with external host membership requirement.
- `licensed-commercial-workflow.js` is a license-enforcing entry point; the developer entrypoint remains unlicensed; full end-user license enforcement requires installer wiring.

**STATUS: FAIL for full commercial readiness.**
**EVIDENCE:** bounded source-level implementation and test suites, not final installed-client acceptance.
**REMAINING:** all unknown and blocked gates in the original nine requirements.
**REGRESSION:** UNKNOWN until all gates pass on the same SHA.
**SECURITY:** PARTIAL, no production signoff.
**PRODUCTION:** NOT DEPLOYED by this work; no production data changed.
