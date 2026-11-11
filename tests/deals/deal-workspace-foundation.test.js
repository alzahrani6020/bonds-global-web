/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const {
  normalizeDealCreate,
  normalizeDealPatch,
  normalizeParty,
  normalizeTask,
  normalizeDueDiligenceItem,
  normalizeDocument
} = require('../../lib/deals/deal-domain');

describe('Bonds Deal Workspace foundation', () => {
  test('normalizes a valid central deal record', () => {
    expect(normalizeDealCreate({
      title:'استحواذ تجريبي',
      deal_type:'ma_buy',
      target_value:'2500000',
      currency:'sar'
    })).toMatchObject({
      title:'استحواذ تجريبي',
      deal_type:'ma_buy',
      stage:'draft',
      status:'active',
      target_value:2500000,
      currency:'SAR'
    });
  });

  test('rejects invalid stages and negative values', () => {
    expect(() => normalizeDealCreate({ title:'X', stage:'unknown' })).toThrow('INVALID_ENUM_VALUE');
    expect(() => normalizeDealCreate({ title:'X', target_value:-1 })).toThrow('INVALID_NON_NEGATIVE_NUMBER');
  });

  test('patches only explicitly supported deal fields', () => {
    expect(normalizeDealPatch({ stage:'due_diligence', injected:'ignored' })).toEqual({
      stage:'due_diligence'
    });
    expect(() => normalizeDealPatch({ injected:'ignored' })).toThrow('DEAL_PATCH_EMPTY');
  });

  test('normalizes the four operational child records', () => {
    expect(normalizeParty({ name:'مستثمر أ', party_role:'investor' }).party_role).toBe('investor');
    expect(normalizeTask({ title:'مراجعة النموذج', priority:'high' }).status).toBe('open');
    expect(normalizeDueDiligenceItem({ title:'مراجعة الالتزامات', area:'legal' }).area).toBe('legal');
    expect(normalizeDocument({ name:'القوائم المالية.pdf' }).confidentiality).toBe('confidential');
  });

  test('migration is additive, enables RLS, and exposes no authenticated delete grant', () => {
    const sql=fs.readFileSync(
      path.join(__dirname,'..','..','supabase','migrations','20261112003000_deal_workspace_foundation.sql'),
      'utf8'
    );
    expect(sql).toContain('create table if not exists public.bonds_deals');
    expect(sql).toContain('alter table public.bonds_deals enable row level security');
    expect(sql).toContain('user_id = auth.uid()');
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/grant\s+delete/i);
  });

  test('api exposes no destructive DELETE endpoint', () => {
    const source=fs.readFileSync(
      path.join(__dirname,'..','..','v3','api','deals.js'),
      'utf8'
    );
    expect(source).toContain("if (!user) return sendJson(res, 401");
    expect(source).toContain(".eq('user_id', user.id)");
    expect(source).not.toContain("req.method === 'DELETE'");
  });

  test('workspace client uses authenticated same-origin API', () => {
    const source=fs.readFileSync(
      path.join(__dirname,'..','..','components','deal-workspace.js'),
      'utf8'
    );
    expect(source).toContain("const API='/api/v3/deals'");
    expect(source).toContain("headers.Authorization='Bearer '+token");
    expect(source).toContain("credentials:'same-origin'");
  });
});
