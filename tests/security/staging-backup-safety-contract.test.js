const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/bonds-staging-backup-restore.yml'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'scripts/backup/ephemeral_staging_backup_login.py'), 'utf8');

describe('Staging encrypted backup cannot target production or publish plaintext', () => {
  test('management backup helper is pinned to staging and has a separate secret', () => {
    expect(helper).toContain('PROJECT = "gjwppwtgsecwmqlsmbmq"');
    expect(helper).toContain('SUPABASE_STAGING_ACCESS_TOKEN');
    expect(helper).not.toContain('hutxsqzplyuqgnghsrcs');
    expect(helper).not.toMatch(/os\.environ\.get\("SUPABASE_ACCESS_TOKEN"/);
    expect(helper).toContain('default_transaction_read_only = on');
    expect(helper).toContain('GRANT pg_read_all_data TO ');
  });

  test('workflow is manual, main-only and has no automatic release hooks', () => {
    expect(workflow).toContain('on:\n  workflow_dispatch:');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("github.repository == 'alzahrani6020/bonds-global-web'");
    expect(workflow).not.toMatch(/^\s+(push|schedule|pull_request):/m);
    expect(workflow).toContain('SUPABASE_PROJECT_REF: gjwppwtgsecwmqlsmbmq');
    expect(workflow).not.toContain('hutxsqzplyuqgnghsrcs');
    expect(workflow).toContain('persist-credentials: false');
  });

  test('encrypted artifact exists only after successful isolated restore', () => {
    const restore = workflow.indexOf('pg_restore -U supabase_admin');
    const encrypt = workflow.indexOf('age -r "$BONDS_STAGING_BACKUP_AGE_RECIPIENT"');
    const upload = workflow.indexOf('actions/upload-artifact@');
    expect(restore).toBeGreaterThan(-1);
    expect(encrypt).toBeGreaterThan(restore);
    expect(upload).toBeGreaterThan(encrypt);
    expect(workflow).toContain('staging.dump.age');
    expect(workflow).toContain('shred -u "$RUNNER_TEMP/bonds-staging-backup/staging.dump"');
    expect(workflow).toContain('retention-days: 30');
    expect(workflow).toContain('if: always()');
    expect(workflow).not.toMatch(/path:\s*.*staging\.dump\s*$/m);
  });
});
