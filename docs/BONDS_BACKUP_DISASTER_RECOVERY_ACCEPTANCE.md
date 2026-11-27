# BONDS Global — Encrypted Backup Custody and Recovery Acceptance

## Scope and exclusions

This runbook covers encrypted PostgreSQL backup custody, audit evidence and isolated disaster recovery testing. No live database mutation is authorized by this document. **The presence of code, a CI success, or a manual backup does not prove scheduled operation.** Do not store private AGE identities or unlock passphrases in this repository, CI artifacts, shared logs or public issue bodies.

## BONDS production architecture boundaries (verified 2026-11-27)

- **Vercel** hosts the BONDS web application and API. Confirmed linked Vercel project: `bonds-global-web` (project `prj_djffUO1KXbGKtumZBWsziWxqJ6Qk`, team `DR Talal`). The Vercel response reported `live=false`, no domains in the project response, and a most recent deployment with `READY`; **do not infer which public production domain is live from this alone**.
- **Supabase** holds BONDS production data: project reference `hutxsqzplyuqgnghsrcs`. Do not point recovery tests or temporary databases at production.
- **GitHub** owns source, CI, approved encrypted backup/isolated restore workflow and watchdog. Only an actual `event=schedule` execution satisfies schedule acceptance; manual runs and merged commits cannot substitute.
- **Independent encrypted custody** is a separate recovery storage failure domain selected and approved explicitly; no backup or private key may be copied to an unrelated application workspace by default.
- **Render is not part of the approved BONDS deployment topology.** Do not deploy a BONDS worker, cron job or database to Render, SCC380 or AFAQ merely because another project's resources are available.
- Current `vercel.json` on `main` already declares eight application cron entries. **Before adding a new Vercel Cron**, inventory those entries, verify the intended BONDS project, Git commit, plan quota, runtime/API authentication, failure alert path and independent acceptance. Vercel Cron could monitor GitHub dispatch, but must not itself count as an independent off-platform data copy or a verified disaster recovery test.
- Project deployment configuration changes must use a scoped PR with CI validation and a verified Vercel preview/production release path. No new paid services, credentials, database changes or deployment are authorized by this runbook.

## Read-only operational reference

- Production Supabase project identity: `hutxsqzplyuqgnghsrcs` (check current identity before any action).
- Daily GitHub backup: `.github/workflows/bonds-production-backup-restore.yml`, schedule 00:07 UTC.
- Watchdog: `.github/workflows/bonds-backup-freshness-watchdog.yml`, schedule minute 35 every three hours.
- Verified manual historical backup: GitHub Actions run `45814509069` (2026-11-26), encrypted artifact `15115985718`.
- External-storage configuration: **NOT CONFIGURED/NOT VERIFIED** as of this runbook. The local custody utility below works only with an operator-selected existing independent destination.

## Offline encrypted copy procedure

1. Use an already downloaded, encrypted `production-<run-id>.dump.age` file from a verified workflow. Do not extract or decrypt on the transfer host.
2. Select an independent mounted destination with enough free capacity, proper access restrictions and backup retention arrangements. The destination **must not** be the source directory or a folder mirrored to the same single storage failure domain.
3. Run the following with the correct paths after confirming the destination drive and access rights:

   `python3 scripts/backup/archive_encrypted_backup.py --source /mnt/v/BONDS-Recovery/production-45814509069/production.dump.age --run-id 45814509069 --destination-dir /offline/independent/custody`

4. Require output status `COPY_SHA256_PASS` and matching source/destination SHA-256. The tool stores the existing production.dump.age under the unique production-<run-id>.dump.age name without renaming the source. It refuses to overwrite an existing copy or manifest; it does not delete the original.
5. Separately protect the AGE identity and any wrapping passphrase, avoiding co-location with the only backup copy. Keep a second controlled recovery route as organizational policy allows.
6. Record custody evidence in a restricted audit register: workflow run ID, source location, destination custody owner, UTC timestamp, hash, verified reader, media identification, retention deadline. **Do not** record private keys or passwords.
7. Periodically decrypt a copy of the encrypted file in a dedicated isolated environment, perform full `pg_restore --exit-on-error` and data invariants checks. SHA-256 alone proves byte equality, **not** that a backup can actually be restored.

## Independent scheduling monitor (outside GitHub)

Run `python3 scripts/backup/check_github_backup_schedule.py` from an **independently scheduled** computer or server with HTTPS access to the GitHub REST API (optionally configure `GH_TOKEN` through a private environment, never command-line plaintext). The script is read-only: it confirms a recent successful `event=schedule` backup and watchdog run on `main`, checks the encrypted artifact name, nonzero size, expiry and returns JSON.

Exit codes: `0=PASS`, `1=FAIL`, `2=UNKNOWN`, `3=PENDING`. **A manual backup does not satisfy the schedule gate.** The initial grace dates are explicitly pinned to this rollout; adjust only through a reviewed source change for future migrations.

The presence of this script in GitHub does **not** make it an independent monitor. Schedule it on a separate host, connect its nonzero results to an actually delivered alert and test receipt. These steps remain `NOT DONE` until demonstrated. Avoid placing the scheduler on the same GitHub Actions failure domain.

## Acceptance matrix

| Gate | Pass evidence | Current classification |
| --- | --- | --- |
| Automatic backup | GitHub run `event=schedule`, success, created on `main` | UNKNOWN |
| Full isolated restore | Fresh scheduled backup restored without errors; sampled domain-level counts checked | UNKNOWN |
| Encrypted artifact | Artifact associated with that same scheduled run, nonempty, within retention | UNKNOWN |
| Automatic watchdog | GitHub run `event=schedule` succeeds; separate scheduled-backup freshness check | UNKNOWN |
| Alert delivery | Test failure received by authorized responsible person outside GitHub UI | UNKNOWN |
| Independent storage | Encrypted copy exists outside GitHub, verified SHA-256 and controlled retention | NOT DONE |
| Offline recovery | Independent copy + separate key actually restored to isolated database | NOT DONE |
| Recovery objectives | Measured RPO/RTO signed off by business and operations | NOT APPROVED |
| Retention | Daily/weekly/monthly periods approved, enacted and independently sampled | NOT APPROVED |
| Access control | Ephemeral database role disabled even after failure; privileges reviewed | PARTIAL |
| Disaster runbook | Named custodian/deputy, offline credentials, escalation and failover roles | PARTIAL |

## RPO / RTO

- RPO is maximum tolerable age of lost transactions; RTO is maximum tolerable time to restore service.
- The **daily** schedule alone cannot establish a guaranteed RPO, because GitHub scheduled runs can be delayed or dropped. Until successful dispatch, independent retention and measured restore time are proven, RPO/RTO remain `UNKNOWN`.
- Proposed targets require explicit business acceptance and an execution-time sample; never claim a target was met from an estimated time.

## 3-2-1 and retention

Use at least three separately recoverable copies, two storage media/failure domains, and one independent offsite/offline. The existing GitHub artifact and one local encrypted file do not automatically satisfy this. Configure retention (daily, weekly, monthly) only after the custodian, storage limits, deletion protection and cost are approved; do not delete any old copy automatically until the independent restore gate passes.

## Failure actions

- `schedule` missing: keep [issue #1273](https://github.com/alzahrani6020/bonds-global-web/issues/1273) open, verify workflow enabled, default branch, actor permissions and GitHub dispatch; do not substitute `workflow_dispatch` as scheduled evidence.
- Encrypted artifact absent: keep the last known good encrypted copy and identify upstream failure; do not rotate credentials without evidence.
- Copy SHA mismatch: remove the unverified destination copy, leave source untouched and investigate media integrity.
- Restore failure: stop acceptance; retain the original encrypted object and logs without secrets, diagnose schema/extensions/roles, repeat only on disposable infrastructure.
- Alert failure: preserve an independent escalation contact path; a created GitHub issue is not delivery proof.

## Operational closure

For every gate record `STATUS: PASS / FAIL / PARTIAL / UNKNOWN`, direct evidence link, timestamp, specific responsible operator, and remaining actions. Close disaster recovery acceptance only after **all** original gates have direct evidence; no blanket exceptions or simulated production outcomes.
