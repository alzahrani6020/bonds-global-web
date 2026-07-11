# Archived Supabase Migrations

The enterprise upgrade migrations in this folder have been **consolidated into**:

```
supabase/migrations/20260619190000_enterprise_upgrade_combined.sql
```

They were applied to the live Supabase project on 2026-06-19 using:

```bash
npx supabase db query --linked -f supabase/migrations/20260619190000_enterprise_upgrade_combined.sql
```

These files are kept here for reference/history only. Do not move them back into `supabase/migrations/` because that would cause duplicate object errors on the next `supabase db push`.

---

`20260703000000_bank_partner_requests.sql` was archived because it shared a timestamp with `20260703000000_combined.sql`. Its contents were merged into the combined baseline, which was renamed to `20260729000000_combined_baseline.sql` so it could be applied at the end of the migration history without requiring a history repair.
