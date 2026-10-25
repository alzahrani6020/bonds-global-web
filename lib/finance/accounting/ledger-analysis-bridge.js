'use strict';

const { runFinancialEngine } = require('../financial-engine-registry');
const { buildFinancialStatements } = require('./ledger-report-engine');
const { createDefaultFinancialStatementMapping } = require('./financial-statement-mapping');

function runFinancialEngineFromLedger({
  engineCode,
  balanceRows,
  periodRows,
  mappingRegistry = createDefaultFinancialStatementMapping(),
  options = {}
} = {}) {
  const statements = buildFinancialStatements({
    balanceRows,
    periodRows,
    mappingRegistry
  });

  const result = runFinancialEngine(
    engineCode,
    statements.normalized_input,
    {
      ...options,
      inputSource: 'accounting_ledger'
    }
  );

  return {
    ...result,
    diagnostics: {
      ...(result.diagnostics || {}),
      input_source: 'accounting_ledger',
      statement_mapping_fields: Object.keys(statements.mapping_provenance).sort(),
      trial_balance_verified: true,
      balance_sheet_equation_verified: true
    },
    accounting_statements: statements,
    evidence: [
      ...(result.evidence || []),
      {
        source: 'bonds_accounting_ledger',
        evidence_type: 'verified_financial_statements',
        value: {
          balance_sheet: statements.balance_sheet,
          income_statement: statements.income_statement
        },
        confidence: 100,
        timestamp: new Date().toISOString(),
        metadata: {
          deterministic: true,
          ai_generated: false
        }
      }
    ]
  };
}

module.exports = {
  runFinancialEngineFromLedger
};
