'use strict';

const crypto = require('crypto');

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ratio(numerator, denominator) {
  const a = finite(numerator);
  const b = finite(denominator);
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

function sumAgingBuckets(summary = {}) {
  return ['b30','b60','b90','b120','over120']
    .reduce((sum, key) => sum + (finite(summary[key]) || 0), 0);
}

function buildExecutiveFinancialMetrics({
  statements = {},
  financialAnalysis = {},
  receivablesAging = {},
  payablesAging = {},
  crm = {},
  operations = {}
} = {}) {
  const normalized = statements.normalized_input || {};
  const bs = statements.balance_sheet || {};
  const income = statements.income_statement || {};
  const analysisMetrics = financialAnalysis.metrics || financialAnalysis || {};

  const receivablesTotal = finite(receivablesAging.total);
  const payablesTotal = finite(payablesAging.total);
  const overdueReceivables = sumAgingBuckets(receivablesAging);
  const overduePayables = sumAgingBuckets(payablesAging);
  const wonCount = finite(crm.won_count) || 0;
  const lostCount = finite(crm.lost_count) || 0;
  const decided = wonCount + lostCount;

  return Object.freeze({
    revenue: finite(income.revenue ?? normalized.revenue),
    net_income: finite(income.net_income ?? normalized.net_income),
    total_assets: finite(bs.total_assets ?? normalized.total_assets),
    total_liabilities: finite(bs.total_liabilities ?? normalized.total_liabilities),
    total_equity: finite(bs.total_equity ?? normalized.equity),
    working_capital: finite(analysisMetrics.working_capital),
    current_ratio: finite(analysisMetrics.current_ratio),
    debt_to_equity: finite(analysisMetrics.debt_to_equity),
    receivables_total: receivablesTotal,
    receivables_overdue: overdueReceivables,
    receivables_overdue_ratio: ratio(overdueReceivables, receivablesTotal),
    payables_total: payablesTotal,
    payables_overdue: overduePayables,
    payables_overdue_ratio: ratio(overduePayables, payablesTotal),
    pipeline_value: finite(crm.pipeline_value),
    weighted_pipeline_value: finite(crm.weighted_pipeline_value),
    opportunity_count: finite(crm.opportunity_count),
    won_count: wonCount,
    lost_count: lostCount,
    conversion_rate: decided > 0 ? wonCount / decided : null,
    average_processing_hours: finite(operations.average_processing_hours),
    completed_count: finite(operations.completed_count),
    rejected_count: finite(operations.rejected_count)
  });
}

const DEFAULT_THRESHOLDS = Object.freeze({
  receivables_overdue_ratio: 0.25,
  payables_overdue_ratio: 0.25,
  current_ratio_min: 1,
  debt_to_equity_max: 2,
  contract_expiry_days: 30,
  application_stuck_hours: 72,
  bank_statement_stale_days: 90
});

function alertId(type, subject, value) {
  return 'financial-alert-' + crypto
    .createHash('sha256')
    .update([type, subject || '', String(value ?? '')].join('|'))
    .digest('hex')
    .slice(0, 24);
}

function makeAlert(type, {
  severity,
  subject = null,
  metric = null,
  value = null,
  threshold = null,
  message_ar,
  message_en,
  action_type = null,
  action_target = null,
  evidence = []
} = {}) {
  return Object.freeze({
    id: alertId(type, subject, value),
    type,
    domain: 'financial_operations',
    severity,
    subject,
    metric,
    value,
    threshold,
    message_ar,
    message_en,
    action_type,
    action_target,
    evidence: Array.isArray(evidence) ? evidence.slice(0, 20) : [],
    informational_only: true,
    auto_execute: false
  });
}

function evaluateFinancialOperationalAlerts({
  metrics = {},
  context = {},
  thresholds = {}
} = {}) {
  const limits = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  const alerts = [];
  const add = alert => alerts.push(alert);

  const arRatio = finite(metrics.receivables_overdue_ratio);
  if (arRatio !== null && arRatio >= limits.receivables_overdue_ratio) {
    add(makeAlert('PAYMENT_OVERDUE', {
      severity: arRatio >= 0.5 ? 'critical' : 'high',
      metric: 'receivables_overdue_ratio',
      value: arRatio,
      threshold: limits.receivables_overdue_ratio,
      message_ar: 'نسبة الذمم المدينة المتأخرة تجاوزت الحد التشغيلي المحدد.',
      message_en: 'Overdue receivables exceeded the configured operating threshold.',
      action_type: 'receivables_aging_review',
      action_target: context.accounting_entity_id || null
    }));
  }

  const apRatio = finite(metrics.payables_overdue_ratio);
  if (apRatio !== null && apRatio >= limits.payables_overdue_ratio) {
    add(makeAlert('OBLIGATION_OVERDUE', {
      severity: apRatio >= 0.5 ? 'critical' : 'high',
      metric: 'payables_overdue_ratio',
      value: apRatio,
      threshold: limits.payables_overdue_ratio,
      message_ar: 'نسبة الالتزامات المتأخرة تجاوزت الحد التشغيلي المحدد.',
      message_en: 'Overdue payables exceeded the configured operating threshold.',
      action_type: 'payables_aging_review',
      action_target: context.accounting_entity_id || null
    }));
  }

  const workingCapital = finite(metrics.working_capital);
  if (workingCapital !== null && workingCapital < 0) {
    add(makeAlert('LIQUIDITY_PRESSURE', {
      severity: 'high',
      metric: 'working_capital',
      value: workingCapital,
      threshold: 0,
      message_ar: 'رأس المال العامل سلبي ويحتاج مراجعة السيولة والالتزامات قصيرة الأجل.',
      message_en: 'Working capital is negative and requires liquidity review.',
      action_type: 'liquidity_analysis'
    }));
  }

  const currentRatio = finite(metrics.current_ratio);
  if (currentRatio !== null && currentRatio < limits.current_ratio_min) {
    add(makeAlert('CURRENT_RATIO_LOW', {
      severity: currentRatio < 0.75 ? 'critical' : 'high',
      metric: 'current_ratio',
      value: currentRatio,
      threshold: limits.current_ratio_min,
      message_ar: 'نسبة التداول أقل من الحد المحدد.',
      message_en: 'Current ratio is below the configured threshold.',
      action_type: 'liquidity_analysis'
    }));
  }

  const leverage = finite(metrics.debt_to_equity);
  if (leverage !== null && leverage > limits.debt_to_equity_max) {
    add(makeAlert('LEVERAGE_HIGH', {
      severity: leverage > limits.debt_to_equity_max * 1.5 ? 'critical' : 'high',
      metric: 'debt_to_equity',
      value: leverage,
      threshold: limits.debt_to_equity_max,
      message_ar: 'نسبة الدين إلى حقوق الملكية تجاوزت الحد المحدد.',
      message_en: 'Debt-to-equity exceeded the configured threshold.',
      action_type: 'debt_to_equity_analysis'
    }));
  }

  const missingDocuments = finite(context.missing_document_count);
  if (missingDocuments !== null && missingDocuments > 0) {
    add(makeAlert('FINANCING_DOCUMENT_MISSING', {
      severity: 'medium',
      value: missingDocuments,
      threshold: 0,
      message_ar: 'يوجد مستند أو أكثر مطلوب وغير مكتمل.',
      message_en: 'One or more required documents are missing.',
      action_type: 'document_find',
      action_target: context.application_id || null
    }));
  }

  const staleDays = finite(context.bank_statement_age_days);
  if (staleDays !== null && staleDays > limits.bank_statement_stale_days) {
    add(makeAlert('BANK_STATEMENT_STALE', {
      severity: 'medium',
      value: staleDays,
      threshold: limits.bank_statement_stale_days,
      message_ar: 'كشف الحساب البنكي أقدم من الحد المقبول للمراجعة.',
      message_en: 'Bank statement is older than the configured review threshold.',
      action_type: 'document_find',
      action_target: context.application_id || null
    }));
  }

  const stuckHours = finite(context.application_stuck_hours);
  if (stuckHours !== null && stuckHours > limits.application_stuck_hours) {
    add(makeAlert('APPLICATION_STUCK', {
      severity: stuckHours > limits.application_stuck_hours * 2 ? 'high' : 'medium',
      value: stuckHours,
      threshold: limits.application_stuck_hours,
      message_ar: 'الطلب متوقف في مرحلته الحالية أطول من الحد التشغيلي.',
      message_en: 'Application has remained in its current stage beyond the operating threshold.',
      action_type: 'funding_next_step',
      action_target: context.application_id || null
    }));
  }

  const contractDays = finite(context.contract_days_to_expiry);
  if (contractDays !== null && contractDays >= 0 && contractDays <= limits.contract_expiry_days) {
    add(makeAlert('CONTRACT_EXPIRING', {
      severity: contractDays <= 7 ? 'high' : 'medium',
      value: contractDays,
      threshold: limits.contract_expiry_days,
      message_ar: 'العقد يقترب من تاريخ الانتهاء.',
      message_en: 'Contract is approaching its expiry date.',
      action_type: 'contract_review',
      action_target: context.contract_id || null
    }));
  }

  const contradictions = finite(context.evidence_contradiction_count);
  if (contradictions !== null && contradictions > 0) {
    add(makeAlert('EVIDENCE_CONTRADICTION', {
      severity: 'critical',
      value: contradictions,
      threshold: 0,
      message_ar: 'تم اكتشاف تعارض في الأدلة ويجب إيقاف الاعتماد الآلي حتى المراجعة.',
      message_en: 'Evidence contradiction detected; automated reliance must stop pending review.',
      action_type: 'evidence_review',
      action_target: context.application_id || null
    }));
  }

  return alerts;
}

async function persistExecutiveFinancialMetrics({
  supabase,
  metricDate,
  metrics,
  dimensions = {},
  source = 'financial_operations'
} = {}) {
  if (!supabase || typeof supabase.from !== 'function') {
    throw new Error('EXECUTIVE_METRICS_DATABASE_REQUIRED');
  }
  const date = String(metricDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('EXECUTIVE_METRICS_DATE_INVALID');

  const rows = Object.entries(metrics || {})
    .filter(([, value]) => Number.isFinite(Number(value)))
    .map(([key, value]) => ({
      metric_date: date,
      metric_key: 'financial.' + key,
      value: Number(value),
      dimensions: dimensions && typeof dimensions === 'object' && !Array.isArray(dimensions)
        ? dimensions
        : {},
      source
    }));

  if (!rows.length) return { ok:true, upserted:0 };

  const { error } = await supabase
    .from('admin_metric_snapshots')
    .upsert(rows, { onConflict:'metric_date,metric_key,dimensions' });

  if (error) throw error;
  return { ok:true, upserted:rows.length };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  buildExecutiveFinancialMetrics,
  evaluateFinancialOperationalAlerts,
  persistExecutiveFinancialMetrics
};
