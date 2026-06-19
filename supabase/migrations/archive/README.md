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
