'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabaseAccountingReportStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('ACCOUNTING_REPORT_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async dimensionFinancialPosition(input = {}) {
    const dimensionType = requiredText(
      input.dimensionType,
      'ACCOUNTING_DIMENSION_TYPE_REQUIRED'
    );
    if (!['cost_center','segment'].includes(dimensionType)) {
      throw new Error('ACCOUNTING_DIMENSION_TYPE_UNSUPPORTED');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_dimension_financial_position_rows',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_dimension_type: dimensionType,
        p_dimension_code: input.dimensionCode
          ? String(input.dimensionCode).trim()
          : null,
        p_as_of: input.asOf || null
      }
    );

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_DIMENSION_FINANCIAL_POSITION_FAILED'
      ));
    }
    return Array.isArray(data) ? data : [];
  }

  async dimensionIncomeStatement(input = {}) {
    const dimensionType = requiredText(
      input.dimensionType,
      'ACCOUNTING_DIMENSION_TYPE_REQUIRED'
    );
    if (!['cost_center','segment'].includes(dimensionType)) {
      throw new Error('ACCOUNTING_DIMENSION_TYPE_UNSUPPORTED');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_dimension_income_statement_rows',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_dimension_type: dimensionType,
        p_dimension_code: input.dimensionCode
          ? String(input.dimensionCode).trim()
          : null,
        p_from: input.from || null,
        p_to: input.to || null
      }
    );

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_DIMENSION_INCOME_STATEMENT_FAILED'
      ));
    }
    return Array.isArray(data) ? data : [];
  }

  async dimensionLedger(input = {}) {
    const dimensionType = requiredText(
      input.dimensionType,
      'ACCOUNTING_DIMENSION_TYPE_REQUIRED'
    );
    if (!['cost_center','segment'].includes(dimensionType)) {
      throw new Error('ACCOUNTING_DIMENSION_TYPE_UNSUPPORTED');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_dimension_ledger_balances',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_dimension_type: dimensionType,
        p_dimension_code: input.dimensionCode
          ? String(input.dimensionCode).trim()
          : null,
        p_from: input.from || null,
        p_to: input.to || null
      }
    );

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_DIMENSION_REPORT_FAILED'
      ));
    }
    return Array.isArray(data) ? data : [];
  }
}

module.exports = { SupabaseAccountingReportStore };
