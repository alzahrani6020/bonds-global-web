const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Admin Finance Operations', () => {
  test('finance schema covers refunds reconciliation collections contracts and exceptions', () => {
    const sql = read('supabase/migrations/20261012223000_admin_finance_operations.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.finance_refunds');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.finance_reconciliation_items');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.finance_collections');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.finance_contracts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.finance_revenue_exceptions');
    expect(sql).toContain('variance_amount numeric');
    expect(sql).toContain('REVOKE ALL ON public.finance_refunds FROM anon, authenticated');
  });

  test('finance API aggregates existing payments and audited operations', () => {
    const api = read('api/admin.js');
    expect(api).toContain('async function getFinanceOverview(sb)');
    expect(api).toContain("sb.from('moyasar_invoices')");
    expect(api).toContain("sb.from('bank_transfer_requests')");
    expect(api).toContain("sb.from('subscriptions')");
    expect(api).toContain('async function createFinanceRefund');
    expect(api).toContain('async function upsertReconciliationItem');
    expect(api).toContain('FINANCE_UUID_RE');
    expect(api).toContain('requireFinanceApprover');
    expect(api).toContain('Refund requester cannot approve the same refund');
    expect(api).toContain('invalid refund status transition');
    expect(api).toContain('invalid reconciliation source_type');
    expect(api).toContain('invalid reconciliation status');
    expect(api).toContain('async function createRevenueException');
    expect(api).toContain("'finance_refund_request'");
    expect(api).toContain("'finance_reconciliation_upsert'");
  });

  test('finance workspace is linked from admin navigation', () => {
    const page = read('admin/finance.html');
    const dashboard = read('admin/dashboard.html');
    expect(page).toContain('Finance Operations');
    expect(page).toContain('Reconciliation Exceptions');
    expect(page).toContain('Revenue Exceptions');
    expect(page).toContain('aria-label="شدة الاستثناء"');
    expect(page).toContain('refundInvoiceId');
    expect(page).toContain('refundExternalRef');
    expect(page).toContain('.muted{color:#475569}');
    expect(dashboard).toContain('/admin/finance.html?embed=1');
  });

  test('finance UI escapes dynamic values and does not expose service role', () => {
    const page = read('admin/finance.html');
    expect(page).toContain('BondsAdminCommon.escapeHtml');
    expect(page).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
