# Production Release Baseline

## Known-good production baseline

- Baseline SHA: `e690d441169941fcb9a0609174a226712c92cc17`
- Production Release: GitHub Actions run `#488`
- Production Authenticated Smoke: run `#87`
- Verification status at capture: CI PASS, staged smoke PASS, promotion PASS, Production SHA PASS, webhook guard PASS, authenticated smoke PASS.

## Release invariants

1. Production promotion must only occur for the SHA that is still the current `main` head.
2. Vercel smoke checks must request canonical clean URLs because `vercel.json` enables `cleanUrls: true`.
3. Existing forward migration files under `supabase/migrations/*.sql` are immutable after merge. Fixes must be introduced through a new recovery migration.
4. A successful migration workflow with zero selected files is not evidence that a previously failed migration was applied.

## Funding-file migration incident closure

- Failed workflow run `#109` attempted `supabase/migrations/20261019064000_funding_file_case_architecture.sql` and returned HTTP 500 with PostgreSQL syntax error near `$`.
- Recovery was recorded in Supabase migration history as `20261019061649_funding_file_case_architecture_recovery`.
- Direct production verification confirmed the core funding-file tables, funding-case columns, validation/propagation functions, validation trigger, and case-draft index exist.

## Rollback decision

If a later production release fails post-deploy verification and rollback is required, use the most recent verified known-good deployment corresponding to this baseline or a newer baseline that has the same full verification chain. Do not treat an arbitrary successful Vercel build as a rollback target.

## Concurrency policy

CI may cancel an older `main` run when a newer `main` commit arrives. Production Release itself remains serialized. The freshness gate immediately before promotion prevents a staged build for an older SHA from being promoted after `main` advances.
