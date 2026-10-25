'use strict';

class SupabaseCostCenterLedgerStore {
  constructor(supabase){
    if(!supabase||typeof supabase.rpc!=='function') throw new Error('COST_CENTER_DATABASE_REQUIRED');
    this.supabase=supabase;
  }
  async ledger({accountingEntityId,from=null,to=null}={}){
    const entity=String(accountingEntityId||'').trim();
    if(!entity) throw new Error('ACCOUNTING_ENTITY_REQUIRED');
    if(from&&!/^\d{4}-\d{2}-\d{2}$/.test(String(from))) throw new Error('ACCOUNTING_REPORT_FROM_DATE_INVALID');
    if(to&&!/^\d{4}-\d{2}-\d{2}$/.test(String(to))) throw new Error('ACCOUNTING_REPORT_TO_DATE_INVALID');
    if(from&&to&&String(from)>String(to)) throw new Error('ACCOUNTING_REPORT_DATE_RANGE_INVALID');
    const {data,error}=await this.supabase.rpc('accounting_cost_center_ledger',{
      p_accounting_entity_id:entity,p_from:from||null,p_to:to||null
    });
    if(error) throw new Error(String(error.message||error.code||'COST_CENTER_LEDGER_QUERY_FAILED'));
    return Array.isArray(data)?data:[];
  }
}
module.exports={SupabaseCostCenterLedgerStore};
