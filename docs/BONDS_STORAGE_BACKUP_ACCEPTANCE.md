# BONDS Storage Blob Backup — Acceptance Runbook

Scope: Supabase production ref `hutxsqzplyuqgnghsrcs` only. Separate from encrypted PostgreSQL backups and from Vercel deployment. No Render services. **Do not count `storage.objects` rows as backed-up file contents.**

## Status, limitations and credentials

The new workflow `.github/workflows/bonds-storage-encrypted-backup.yml` is **manual-only** until production blob restore has passed. It needs GitHub Actions repository secret `BONDS_STORAGE_SERVICE_ROLE_KEY` for this production Supabase project, plus existing `SUPABASE_PROJECT_REF` and public `BONDS_BACKUP_AGE_RECIPIENT`. Never paste a service role secret, AGE identity or passphrase into a PR, issue, ticket or CI logs. These secrets are consumed only by the workflow's server-side runner. Do not use the browser's publishable/anon key for private file backups. The scoped service-role key has broad powers: rotating it or storing it without access controls is not a least-privilege guarantee. Review alternate credentials before promoting to scheduling.

Preconfigured bucket allowlist: `avatars`, `client-documents`, `client-documents-quarantine`, `correspondence-artifacts`, `hr-company-branding`. Actual scope and consistency require validation against production inventory immediately before acceptance. The exporter lists recursively, downloads bytes via authenticated Storage API, hashes each blob, checks declared size and compares inventory again; **concurrent writes can still create a non-atomic snapshot**. A successful export cannot guarantee database/blob cross-service point-in-time consistency. For absolute consistency, coordinate a maintenance window or documented write freeze and retry if changes are detected. The selected allowlist also means any newly added buckets must be explicitly reviewed, not silently considered protected.

The exporter uses ephemeral plaintext blob and tar files on a GitHub-hosted runner and deletes them when the process exits normally. This is not proof of forensic erasure, and a hard runner crash can leave runner-local temporary files until the provider retires the runner. The workflow uploads **only `.age`**, not tar, dump, key or manifest. No GitHub run should start until the security and retention review is approved.

## Evidence and gates

1. Verify production identity and count objects by bucket at the start of the test; classify counts as a momentary snapshot.
2. Set `BONDS_STORAGE_SERVICE_ROLE_KEY` using GitHub repository Secrets UI, without publishing its value. Confirm required scope and access controls.
3. Manually dispatch the Storage workflow; require successful object downloads for *all* allowlisted buckets, consistent second inventory, nonzero encrypted artifact and upload-artifact success.
4. Download the encrypted artifact into an explicitly approved separate failure domain (e.g. operator-controlled external drive), reject overwrite, calculate and record SHA-256, and independently verify the hash.
5. Recover using the previously tested protected AGE identity. Decrypt into a tightly controlled temporary recovery location, never a public folder. Run `python3 scripts/backup/verify_storage_restored.py --archive <isolated-decrypted-tar>`; require `status=PASS` and full per-object SHA-256 verification. The verifier **never extracts** tar members, preventing path traversal during the check. Compare a list of restored paths and count against the manifest and test selected actual downloads in an isolated destination without any write to production.
6. Verify blob and PostgreSQL metadata alignment to the **same bounded backup window**; compare metadata records, identifiers, not just counts. Document exclusions and concurrent-write window.
7. Remove transient test data following an explicit targeted preflight; no deletion of original encrypted copies, recovery keys or production buckets.
8. Only after real, repeatable production acceptance decide whether to enable automatic scheduling. Monitor its **actual** `event=schedule` run and off-platform alert delivery. Avoid triggering parallel redundant exports and exceeding free quotas.
9. Track key separation, media custody, alert delivery, retention and tested RPO/RTO separately. No passing test can replace missing criteria.

## Status criteria

- `PASS`: all required real Storage object bytes were independently archived encrypted, verified from a copy outside GitHub, decrypted and checked in an isolated recovery exercise.
- `PARTIAL`: exporter code and unit tests exist, but credentials, actual export or restore tests remain unverified.
- `FAIL`: missing/changed object, failed bytes/hash test or unreadable archive; preserve prior encrypted copies.
- `UNKNOWN`: current production object inventory or secret status cannot be verified.

The existing PostgreSQL backup schedule must remain unaffected; the Storage workflow intentionally has **no schedule** until evidence of successful production recovery. See [DR master issue #1283](https://github.com/alzahrani6020/bonds-global-web/issues/1283).
