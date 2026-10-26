'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabaseAccountingBudgetStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('ACCOUNTING_BUDGET_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async createPlan(input = {}) {
    const { data, error } = await this.supabase.rpc(
      'accounting_budget_plan_create',
      {
        p_accounting_entity_id:requiredText(input.accountingEntityId,'ACCOUNTING_ENTITY_REQUIRED'),
        p_code:requiredText(input.code,'ACCOUNTING_BUDGET_PLAN_CODE_REQUIRED'),
        p_name:requiredText(input.name,'ACCOUNTING_BUDGET_PLAN_NAME_REQUIRED'),
        p_plan_type:requiredText(input.planType,'ACCOUNTING_BUDGET_PLAN_TYPE_REQUIRED'),
        p_fiscal_year_start:requiredText(input.fiscalYearStart,'ACCOUNTING_BUDGET_FISCAL_YEAR_START_REQUIRED'),
        p_fiscal_year_end:requiredText(input.fiscalYearEnd,'ACCOUNTING_BUDGET_FISCAL_YEAR_END_REQUIRED'),
        p_currency:input.currency || null,
        p_request_key:requiredText(input.requestKey,'ACCOUNTING_BUDGET_REQUEST_KEY_REQUIRED'),
        p_actor_id:requiredText(input.actorId,'ACCOUNTING_BUDGET_ACTOR_REQUIRED'),
        p_metadata:input.metadata || {}
      }
    );
    if (error) throw new Error(String(error.message || error.code || 'ACCOUNTING_BUDGET_PLAN_CREATE_FAILED'));
    return data;
  }

  async saveDraft(input = {}) {
    const { data, error } = await this.supabase.rpc(
      'accounting_budget_draft_save',
      {
        p_accounting_entity_id:requiredText(input.accountingEntityId,'ACCOUNTING_ENTITY_REQUIRED'),
        p_budget_version_id:requiredText(input.budgetVersionId,'ACCOUNTING_BUDGET_VERSION_REQUIRED'),
        p_lines:Array.isArray(input.lines) ? input.lines : [],
        p_request_key:requiredText(input.requestKey,'ACCOUNTING_BUDGET_REQUEST_KEY_REQUIRED'),
        p_actor_id:requiredText(input.actorId,'ACCOUNTING_BUDGET_ACTOR_REQUIRED')
      }
    );
    if (error) throw new Error(String(error.message || error.code || 'ACCOUNTING_BUDGET_DRAFT_SAVE_FAILED'));
    return data;
  }

  async transition(input = {}) {
    const { data, error } = await this.supabase.rpc(
      'accounting_budget_transition',
      {
        p_accounting_entity_id:requiredText(input.accountingEntityId,'ACCOUNTING_ENTITY_REQUIRED'),
        p_budget_version_id:requiredText(input.budgetVersionId,'ACCOUNTING_BUDGET_VERSION_REQUIRED'),
        p_action:requiredText(input.action,'ACCOUNTING_BUDGET_ACTION_REQUIRED'),
        p_request_key:requiredText(input.requestKey,'ACCOUNTING_BUDGET_REQUEST_KEY_REQUIRED'),
        p_actor_id:requiredText(input.actorId,'ACCOUNTING_BUDGET_ACTOR_REQUIRED'),
        p_reason:input.reason || null
      }
    );
    if (error) throw new Error(String(error.message || error.code || 'ACCOUNTING_BUDGET_TRANSITION_FAILED'));
    return data;
  }

  async analysisSnapshot(input = {}) {
    const { data, error } = await this.supabase.rpc(
      'accounting_budget_analysis_snapshot',
      {
        p_accounting_entity_id:requiredText(input.accountingEntityId,'ACCOUNTING_ENTITY_REQUIRED'),
        p_budget_plan_id:requiredText(input.budgetPlanId,'ACCOUNTING_BUDGET_PLAN_REQUIRED'),
        p_forecast_plan_id:input.forecastPlanId || null,
        p_actor_id:requiredText(input.actorId,'ACCOUNTING_BUDGET_ACTOR_REQUIRED')
      }
    );
    if (error) throw new Error(String(error.message || error.code || 'ACCOUNTING_BUDGET_ANALYSIS_SNAPSHOT_FAILED'));
    return data;
  }
}

module.exports = { SupabaseAccountingBudgetStore };
