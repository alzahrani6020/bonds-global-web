# BONDS Storage Blob Backup — Acceptance Runbook

Scope: Supabase production ref `hutxsqzplyuqgnghsrcs` only. Separate from encrypted PostgreSQL backups and from Vercel deployment. No Render services. **Do not count `storage.objects` rows as backed-up file contents.**

## Status, limitations and credentials

The new workflow `.github/workflows/bonds-storage-encrypted-backup.yml` is **manual-only** until production blob restore has passed. It needs GitHub Actions repository secret `BONDS_STORAGE_SERVICE_ROLE_KEY` for this production Supabase project, plus existing `SUPABASE_PROJECT_REF` and public `BONDS_BACKUP_AGE_RECIPIENT`. Never paste a service role secret, AGE identity or passphrase into a PR, issue, ticket or CI logs. These secrets are consumed only by the workflow's server-side runner. Do not use the browser's publishable/anon key for private file backups. The scoped service-role key has broad powers: rotating it or storing it without access controls is not a least-privilege guarantee. Review alternate credentials before promoting to scheduling.

The exporter dynamically enumerates all Storage buckets using the Storage API and records their identifiers in the encrypted manifest, including empty buckets. It compares the bucket list again before encrypting and fails closed if it changed. This eliminates the former fixed-five-bucket omission risk, but actual scope and consistency still require validation against production inventory immediately before acceptance. The exporter lists recursively, downloads bytes via authenticated Storage API, hashes each blob, checks declared size and compares inventory again; **concurrent writes can still create a non-atomic snapshot**. A successful export cannot guarantee database/blob cross-service point-in-time consistency. For absolute consistency, coordinate a maintenance window or documented write freeze and retry if changes are detected. New buckets are discovered by default; access failures must stop the export rather than silently skip them.

The exporter places ephemeral plaintext blobs and the TAR inside the same managed temporary directory on a GitHub-hosted runner, and cleans up that directory when the process exits normally. This is not proof of forensic erasure, and a hard runner crash can leave runner-local temporary files until the provider retires the runner. The workflow uploads **only `.age`**, not tar, dump, key or manifest. No GitHub run should start until the security and retention review is approved.

## Evidence and gates

1. Verify production identity and count objects by bucket at the start of the test; classify counts as a momentary snapshot.
2. Set `BONDS_STORAGE_SERVICE_ROLE_KEY` using GitHub repository Secrets UI, without publishing its value. Confirm required scope and access controls.
3. Manually dispatch the Storage workflow; require successful object downloads for *all* enumerated production buckets, consistent second inventory, nonzero encrypted artifact and upload-artifact success.
4. Download the encrypted artifact into an explicitly approved separate failure domain (e.g. operator-controlled external drive), reject overwrite, calculate and record SHA-256, and independently verify the hash.
5. Recover using the previously tested protected AGE identity. Decrypt into a tightly controlled temporary recovery location, never a public folder. Run `python3 scripts/backup/verify_storage_restored.py --archive <isolated-decrypted-tar> --restore-to <new-empty-isolated-folder>`; require `status=PASS`, `restored=<full-object-count>` and full per-object SHA-256 verification **of files written to disk**. The restore destination must not exist; the tool refuses overwriting. The verifier first checks tar members, manifest bucket coverage, object paths, sizes and SHA-256 before recreating any files. Compare restored paths and counts to the manifest and production metadata (within the documented backup window). Never write to production. Do not treat a tool-level pass as proof of recovery without an operator-controlled offline USB test.
6. Verify blob and PostgreSQL metadata alignment to the **same bounded backup window**; compare metadata records, identifiers, not just counts. Document exclusions and concurrent-write window. On the **isolated restored PostgreSQL database only**, verify its host/database identity and database name `bonds_restore_gate` before running `umask 077; psql -q -X -At -v ON_ERROR_STOP=1 "$ISOLATED_DATABASE_URL" -f scripts/backup/export_isolated_storage_metadata.sql > isolated-inventory.json`. The SQL itself refuses execution outside the expected disposable database, and opens a READ ONLY transaction. Treat this plaintext JSON as sensitive metadata: never upload it to GitHub or public folders; store with restricted permissions and delete only the temporary test copy after verification. The generated JSON contains all bucket IDs and each `storage.objects` bucket/path/id/declared size (no plaintext blob bytes). After independently decrypting the Storage archive and verifying its actual blob hashes, run `python3 scripts/backup/check_storage_db_alignment.py --archive <isolated-decrypted-tar> --isolated-db-inventory isolated-inventory.json`; require PASS with exact bucket and object identity match. This gate will **reject** database/Storage snapshots made at incompatible points in time. It neither uploads bytes back into Supabase Storage nor proves app-level restoration on its own. Never point `ISOLATED_DATABASE_URL` to production.
7. Remove transient test data following an explicit targeted preflight; no deletion of original encrypted copies, recovery keys or production buckets.
8. Only after real, repeatable production acceptance decide whether to enable automatic scheduling. Monitor its **actual** `event=schedule` run and off-platform alert delivery. Avoid triggering parallel redundant exports and exceeding free quotas.
9. Track key separation, media custody, alert delivery, retention and tested RPO/RTO separately. No passing test can replace missing criteria.

## Status criteria

- `PASS`: all required real Storage object bytes were independently archived encrypted, verified from a copy outside GitHub, decrypted and checked in an isolated recovery exercise.
- `PARTIAL`: exporter code and unit tests exist, but credentials, actual export or restore tests remain unverified.
- `FAIL`: missing/changed object, failed bytes/hash test or unreadable archive; preserve prior encrypted copies.
- `UNKNOWN`: current production object inventory or secret status cannot be verified.

The existing PostgreSQL backup schedule must remain unaffected; the Storage workflow intentionally has **no schedule** until evidence of successful production recovery. See [DR master issue #1283](https://github.com/alzahrani6020/bonds-global-web/issues/1283).

## Security review gate (not equivalent to CI success)

- [x] Source-code gate: secrets are scoped only to the credential-guard and export steps, never job-global; no secret values printed by intended code paths.
- [x] Supply-chain gate: the sensitive workflow pins `actions/checkout` and `actions/upload-artifact` to inspected full commit SHAs instead of mutable major-version tags; a dedicated regression test enforces these refs.
- [x] Source-code gate: bucket enumeration is dynamic; omitted/invalid bucket inventory fails closed. Pagination uses `limit`/`offset` and rejects duplicate IDs across pages; synthetic tests cover 101 buckets.
- [x] Source-code gate: encrypted artifact is the only declared upload path; archival source data never deliberately uploaded as a plain artifact.
- [x] Source-code gate: isolated restoration checks SHA-256 of each actual written file, rejects unsafe bucket/object names, duplicates, unexpected tar members, and existing destination paths; counts and declared bytes are bounded. Restored manifest must identify the exact production Supabase project and a numeric backup run ID; foreign-project archives are rejected before any write.
- [ ] Operational gate: verify GitHub secret exists, is the correct credential for the production project, and is not exposed to untrusted branch code. Restrict Actions workflow editing and dispatch permissions; require reviewed commit and change approvals before sensitive export.
- [ ] Operational gate: review service-role breadth and choose appropriately scoped read-only credentials where supported. A Supabase service-role key is NOT least-privilege; do not describe it as such.
- [ ] Operational gate: approve GitHub-hosted ephemeral plaintext processing, ephemeral runner lifecycle, storage retention limits, logging restrictions and cost; alternatively use a controlled trusted runner.
- [ ] Operational gate: verify actual encrypted export, manifest coverage, immutable off-platform custody, isolated USB restoration and file-level hashes.
- [ ] Operational gate: verify PostgreSQL/Storage bounded-window consistency, tested alerts and measured RPO/RTO before enabling scheduling.

Security disposition: **PARTIAL / NOT APPROVED FOR PRODUCTION** until every unchecked operational gate is independently evidenced. CI does not prove service-role scope or runner trust. Keep this PR as Draft; do not merge or enable automatic scheduling based solely on tests.
