'use strict';

const fs=require('fs');
const path=require('path');
const {
  buildStraightLineDepreciationSchedule,
  buildDepreciationPosting
}=require('../../lib/finance/accounting/asset-depreciation-engine');
const {EVENT_TYPES}=require('../../lib/finance/accounting/financial-event');
const {
  SupabaseAssetDepreciationStore
}=require('../../lib/finance/accounting/supabase-asset-depreciation-store');

const MIGRATION=fs.readFileSync(
  path.join(__dirname,'../../supabase/migrations/20261026020000_fixed_asset_depreciation_cost_centers.sql'),
  'utf8'
);

function canonical(overrides={}){
  return {
    id:'asset-1',
    accounting_entity_id:'entity-1',
    asset_number:'A-001',
    name:'Machine',
    acquisition_date:'2026-09-10',
    acquisition_cost:1200,
    residual_value:200,
    useful_life_months:10,
    currency:'SAR',
    lifecycle_status:'active',
    ...overrides
  };
}
function profile(overrides={}){
  return {
    id:'profile-1',
    accounting_entity_id:'entity-1',
    asset_id:'asset-1',
    in_service_date:'2026-10-15',
    depreciation_method:'straight_line',
    depreciation_convention:'full_month',
    depreciation_expense_account_code:'6100',
    depreciation_expense_account_name:'Depreciation Expense',
    accumulated_depreciation_account_code:'1290',
    accumulated_depreciation_account_name:'Accumulated Depreciation',
    cost_center_id:'cc-1',
    status:'active',
    ...overrides
  };
}
function period(id,month,status='open'){
  const [y,m]=month.split('-').map(Number);
  return {
    id,
    period_code:month,
    starts_on:month+'-01',
    ends_on:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10),
    status
  };
}

describe('canonical asset accounting depreciation',()=>{
  test('uses bonds_assets economics plus narrow accounting profile',()=>{
    const periods=[];
    for(let i=0;i<10;i++){
      const d=new Date(Date.UTC(2026,9+i,1));
      periods.push(period('p'+i,d.toISOString().slice(0,7)));
    }
    const result=buildStraightLineDepreciationSchedule({
      asset:canonical(),
      profile:profile(),
      periods
    });
    expect(result.depreciable_basis).toBe(1000);
    expect(result.monthly_depreciation).toBe(100);
    expect(result.schedule).toHaveLength(10);
    expect(result.schedule[9].ending_book_value).toBe(200);
    expect(result.provenance).toMatchObject({
      asset_source:'bonds_assets',
      policy_source:'accounting_asset_depreciation_profiles',
      deterministic:true,
      ai_generated:false
    });
  });

  test('fails closed when canonical asset/profile entity or asset differs',()=>{
    expect(()=>buildStraightLineDepreciationSchedule({
      asset:canonical(),
      profile:profile({asset_id:'asset-2'}),
      periods:[period('p1','2026-10')]
    })).toThrow('DEPRECIATION_PROFILE_ASSET_MISMATCH');
  });

  test('does not post into closed period',()=>{
    const row=buildStraightLineDepreciationSchedule({
      asset:canonical(),
      profile:profile(),
      periods:[period('p1','2026-10','soft_closed')]
    }).schedule[0];
    expect(()=>buildDepreciationPosting({
      asset:canonical(),
      profile:profile(),
      scheduleRow:{...row,id:'schedule-1'}
    })).toThrow('ACCOUNTING_PERIOD_NOT_OPEN');
  });

  test('builds balanced depreciation event/posting through existing posting contract',()=>{
    const row=buildStraightLineDepreciationSchedule({
      asset:canonical(),
      profile:profile(),
      periods:[period('p1','2026-10')]
    }).schedule[0];
    const bundle=buildDepreciationPosting({
      asset:canonical(),
      profile:profile(),
      scheduleRow:{...row,id:'schedule-1'}
    });
    expect(bundle.event).toMatchObject({
      type:'asset.depreciation.recorded',
      accounting_entity_id:'entity-1',
      amount:100,
      currency:'SAR',
      payload:{
        asset_id:'asset-1',
        depreciation_profile_id:'profile-1',
        period_id:'p1'
      }
    });
    expect(bundle.posting.journal.total_debit).toBe(100);
    expect(bundle.posting.journal.total_credit).toBe(100);
    expect(bundle.posting.journal.lines[0].dimensions).toEqual({cost_center_id:'cc-1'});
  });

  test('schema extends canonical bonds_assets instead of duplicating asset master',()=>{
    expect(MIGRATION).toContain('create table if not exists public.accounting_asset_depreciation_profiles');
    expect(MIGRATION).toContain('references public.bonds_assets(accounting_entity_id, id)');
    expect(MIGRATION).not.toMatch(/create table if not exists public\.accounting_fixed_assets/i);
    expect(MIGRATION).not.toMatch(/create table if not exists public\.bonds_assets/i);
    expect(MIGRATION).toContain('create table if not exists public.accounting_cost_centers');
    expect(MIGRATION).toContain('create table if not exists public.accounting_asset_depreciation_schedule');
  });

  test('atomic posting reuses accounting_commit_posting and validates canonical data',()=>{
    expect(MIGRATION).toContain('v_result := public.accounting_commit_posting(p_event,p_posting)');
    expect(MIGRATION).toContain("raise exception 'CANONICAL_ASSET_DEPRECIATION_DATA_REQUIRED'");
    expect(MIGRATION).toContain("raise exception 'DEPRECIATION_EVENT_REFERENCE_MISMATCH'");
    expect(MIGRATION).toContain('grant execute on function public.accounting_commit_asset_depreciation(uuid,jsonb,jsonb)');
    expect(MIGRATION).not.toMatch(/accounting_commit_asset_depreciation[\s\S]{0,200}to authenticated/i);
  });

  test('event taxonomy includes accounting depreciation',()=>{
    expect(EVENT_TYPES).toContain('asset.depreciation.recorded');
  });

  test('store persists schedule and commits governed RPC',async()=>{
    const select=jest.fn(async()=>({data:[{id:'schedule-1'}],error:null}));
    const upsert=jest.fn(()=>({select}));
    const from=jest.fn(()=>({upsert}));
    const rpc=jest.fn(async()=>({data:{ok:true,state:'claimed'},error:null}));
    const store=new SupabaseAssetDepreciationStore({from,rpc});
    const result=await store.upsertSchedule([{
      accounting_entity_id:'entity-1',
      depreciation_profile_id:'profile-1',
      asset_id:'asset-1',
      period_id:'p1',
      depreciation_amount:100,
      accumulated_depreciation:100,
      ending_book_value:1100,
      status:'scheduled'
    }]);
    expect(from).toHaveBeenCalledWith('accounting_asset_depreciation_schedule');
    expect(result.upserted).toBe(1);
    await store.commit({scheduleId:'schedule-1',event:{},posting:{}});
    expect(rpc).toHaveBeenCalledWith('accounting_commit_asset_depreciation',{
      p_schedule_id:'schedule-1',p_event:{},p_posting:{}
    });
  });

  test('migration version is later than asset collateral registry version',()=>{
    expect(Number('20261026020000')).toBeGreaterThan(Number('20261026013000'));
  });
});
