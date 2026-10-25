'use strict';

class SupabaseFixedAssetAccountingStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function' || typeof supabase.rpc !== 'function') {
      throw new Error('FIXED_ASSET_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async upsertSchedule(rows = []) {
    if (!Array.isArray(rows)) throw new Error('DEPRECIATION_SCHEDULE_ARRAY_REQUIRED');
    if (!rows.length) return {ok:true,upserted:0};

    const payload = rows.map(row => ({
      accounting_entity_id:row.accounting_entity_id,
      fixed_asset_id:row.fixed_asset_id,
      period_id:row.period_id,
      depreciation_amount:row.depreciation_amount,
      accumulated_depreciation:row.accumulated_depreciation,
      ending_book_value:row.ending_book_value,
      status:row.status || 'scheduled',
      metadata:{
        period_code:row.period_code,
        effective_date:row.effective_date,
        month_index:row.month_index
      }
    }));

    const { data, error } = await this.supabase
      .from('accounting_asset_depreciation_schedule')
      .upsert(payload, {
        onConflict:'accounting_entity_id,fixed_asset_id,period_id'
      })
      .select('id,accounting_entity_id,fixed_asset_id,period_id,status');

    if (error) throw new Error(String(error.message || error.code || 'DEPRECIATION_SCHEDULE_WRITE_FAILED'));
    return {ok:true,upserted:payload.length,rows:Array.isArray(data)?data:[]};
  }

  async commitDepreciation({ scheduleId, event, posting } = {}) {
    const id = String(scheduleId || '').trim();
    if (!id) throw new Error('DEPRECIATION_SCHEDULE_ID_REQUIRED');

    const { data, error } = await this.supabase.rpc('accounting_commit_asset_depreciation', {
      p_schedule_id:id,
      p_event:event,
      p_posting:posting
    });

    if (error) throw new Error(String(error.message || error.code || 'DEPRECIATION_POSTING_FAILED'));
    return data;
  }
}

module.exports = {
  SupabaseFixedAssetAccountingStore
};
