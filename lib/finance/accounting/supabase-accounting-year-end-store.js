'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabaseAccountingYearEndStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('ACCOUNTING_YEAR_END_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async configurePolicy(input = {}) {
    const month = Number(input.fiscalYearEndMonth);
    const day = Number(input.fiscalYearEndDay);
    if (!Number.isInteger(month) || !Number.isInteger(day)) {
      throw new Error('ACCOUNTING_YEAR_END_DATE_INVALID');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_configure_year_end_policy',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_retained_earnings_account_id: requiredText(
          input.retainedEarningsAccountId,
          'ACCOUNTING_RETAINED_EARNINGS_ACCOUNT_REQUIRED'
        ),
        p_retained_dimensions: input.retainedDimensions || {},
        p_fiscal_year_end_month: month,
        p_fiscal_year_end_day: day,
        p_status: input.status || 'active',
        p_actor_id: requiredText(
          input.actorId,
          'ACCOUNTING_YEAR_END_ACTOR_REQUIRED'
        ),
        p_metadata: input.metadata || {}
      }
    );

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_YEAR_END_POLICY_SAVE_FAILED'
      ));
    }
    return data;
  }

  async closeYear(input = {}) {
    const { data, error } = await this.supabase.rpc(
      'accounting_execute_year_end_close',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_fiscal_year_start: requiredText(
          input.fiscalYearStart,
          'ACCOUNTING_FISCAL_YEAR_START_REQUIRED'
        ),
        p_fiscal_year_end: requiredText(
          input.fiscalYearEnd,
          'ACCOUNTING_FISCAL_YEAR_END_REQUIRED'
        ),
        p_closing_period_id: requiredText(
          input.closingPeriodId,
          'ACCOUNTING_YEAR_END_CLOSING_PERIOD_REQUIRED'
        ),
        p_request_key: requiredText(
          input.requestKey,
          'ACCOUNTING_YEAR_END_REQUEST_KEY_REQUIRED'
        ),
        p_actor_id: requiredText(
          input.actorId,
          'ACCOUNTING_YEAR_END_ACTOR_REQUIRED'
        )
      }
    );

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_YEAR_END_CLOSE_FAILED'
      ));
    }
    return data;
  }

  async reopenYear(input = {}) {
    const { data, error } = await this.supabase.rpc(
      'accounting_reopen_year_end',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_close_run_id: requiredText(
          input.closeRunId,
          'ACCOUNTING_YEAR_END_CLOSE_RUN_REQUIRED'
        ),
        p_request_key: requiredText(
          input.requestKey,
          'ACCOUNTING_YEAR_END_REQUEST_KEY_REQUIRED'
        ),
        p_actor_id: requiredText(
          input.actorId,
          'ACCOUNTING_YEAR_END_ACTOR_REQUIRED'
        ),
        p_reason: requiredText(
          input.reason,
          'ACCOUNTING_YEAR_END_REOPEN_REASON_REQUIRED'
        )
      }
    );

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_YEAR_END_REOPEN_FAILED'
      ));
    }
    return data;
  }
}

module.exports = { SupabaseAccountingYearEndStore };
