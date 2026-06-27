# Supabase Migrations

This directory contains all database migrations for the Bonds Global platform.

## Applying migrations

Migrations are applied automatically via GitHub Actions (`.github/workflows/apply-migrations.yml`)
whenever a file in this directory is pushed to `main`.

To apply pending migrations manually, run:

```bash
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase db push
```

## Recent CAE migrations

- `20260714000000_condition_assessment.sql` — Condition assessment standards.
- `20260715000000_asset_condition_assessments.sql` — Saved per-asset condition assessments.
- `20260716000000_assessment_due_date.sql` — Re-evaluation due date tracking.
