const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Admin Support Center', () => {
  test('support schema includes tickets, SLA, escalations, notes and mentions', () => {
    const sql = read('supabase/migrations/20261012220000_admin_support_center.sql');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.support_tickets');
    expect(sql).toContain('sla_due_at timestamptz');
    expect(sql).toContain('escalation_level integer');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.support_ticket_notes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.support_ticket_mentions');
    expect(sql).toContain('request_id text');
    expect(sql).toContain('error_code text');
    expect(sql).toContain('REVOKE ALL ON public.support_tickets FROM anon, authenticated');
  });

  test('support API implements priority SLA, assignment, escalation and audited notes', () => {
    const api = read('api/admin.js');

    expect(api).toContain('function supportSlaHours(priority)');
    expect(api).toContain('async function getSupportOverview(sb)');
    expect(api).toContain('async function createSupportTicket');
    expect(api).toContain('async function updateSupportTicket');
    expect(api).toContain('async function addSupportNote');
    expect(api).toContain('SUPPORT_UUID_RE');
    expect(api).toContain("throw badRequest('invalid priority')");
    expect(api).toContain("throw badRequest('invalid status')");
    expect(api).toContain("throw badRequest('invalid escalation_level')");
    expect(api).toContain("'support_ticket_create'");
    expect(api).toContain("'support_ticket_update'");
    expect(api).toContain("'support_note_add'");
  });

  test('support workspace is linked from admin navigation', () => {
    const page = read('admin/support.html');
    const dashboard = read('admin/dashboard.html');

    expect(page).toContain('Support Center');
    expect(page).toContain('SLA');
    expect(page).toContain('Escalations');
    expect(page).toContain('aria-label="أولوية التذكرة"');
    expect(page).toContain('aria-label="حالة التذكرة"');
    expect(page).toContain('mentionUserIds');
    expect(page).toContain('saveTicket');
    expect(page).toContain('userId');
    expect(page).toContain('advisoryClientId');
    expect(page).toContain('.muted{color:#475569}');
    expect(dashboard).toContain('/admin/support.html?embed=1');
  });

  test('support UI escapes dynamic content', () => {
    const page = read('admin/support.html');

    expect(page).toContain('BondsAdminCommon.escapeHtml');
    expect(page).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
