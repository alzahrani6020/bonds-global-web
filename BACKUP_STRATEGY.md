# Backup Strategy — Bonds Global Enterprise

## 1. Supabase Managed Backups

- **Automated daily backups** are included with Supabase paid tiers.
- **Point-in-Time Recovery (PITR)** is available for Pro/Enterprise projects; enable it for the production project.
- Backup retention aligns with Supabase plan terms (typically 7 days for daily backups).

## 2. Manual Database Dumps

Run weekly logical backups using `pg_dump`:

```bash
# .env must contain PGHOST, PGDATABASE, PGUSER, PGPASSWORD
pg_dump -Fc -v -f backups/bonds-global-$(date +%Y%m%d).dump
```

Store dumps in:
- Encrypted object storage (AWS S3 / Cloudflare R2)
- Off-site with 90-day retention

## 3. Storage Bucket Backups

- Mirror `advisory-documents` and any user-uploaded assets to a secondary bucket.
- Use `rclone` or Supabase Storage copy jobs nightly.

## 4. Code & Configuration

- Source code is versioned in Git (GitHub) with branch protection on `main`.
- Vercel env variables should be documented in a secure vault (1Password / Bitwarden Secrets Manager).
- Run `vercel env pull` periodically and store a copy in the vault.

## 5. Disaster Recovery

| Scenario | Recovery Method | RTO | RPO |
|----------|-----------------|-----|-----|
| Accidental row deletion | PITR to last known good state | 15 min | < 5 min |
| Table corruption | Restore from nightly pg_dump | 1 hour | 24 hours |
| Full project loss | Restore pg_dump + storage mirror to new Supabase project | 4 hours | 24 hours |
| Vercel deployment failure | Rollback to previous production deployment | 5 min | N/A |

## 6. Backup Verification

- Restore dumps to a staging environment monthly.
- Run `npm test` and smoke tests against restored staging.
- Verify storage mirror integrity by sampling files.

## 7. Roles & Responsibilities

- **Platform owner**: approves backup budget and PITR enablement.
- **Senior Database Architect**: maintains pg_dump scripts and verifies restores.
- **Senior Security Engineer**: manages encryption and access to backup credentials.
