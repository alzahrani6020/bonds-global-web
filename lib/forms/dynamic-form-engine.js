/**
 * BONDS Dynamic Form Engine
 *
 * Builds a form dynamically from a semantic profile, decision context and business rules.
 * No field is shown unless it is required, auto-populatable, or explicitly relevant.
 */

const semantic = require('../semantic');
const { detectContext, applyContext } = require('../context/decision-context-engine');
const rulesEngine = require('../rules/business-rules-engine');

const COMMON_FIELDS = [
  { name: 'project_name', type: 'string', required: true, label: { ar: 'اسم المشروع', en: 'Project Name' } },
  { name: 'country', type: 'country', required: true, label: { ar: 'الدولة', en: 'Country' } },
  { name: 'city', type: 'city', required: true, label: { ar: 'المدينة', en: 'City' } },
  { name: 'currency', type: 'currency', required: false, default: 'SAR', label: { ar: 'العملة', en: 'Currency' } }
];

function buildFieldDef(base, language = 'ar') {
  return {
    name: base.name,
    type: base.type || 'number',
    label: base.label || { ar: base.name, en: base.name },
    unit: base.unit,
    required: base.required === true,
    auto: base.auto === true || base.populated === true,
    calculated: base.calculated === true,
    hidden: base.hidden === true,
    weight: base.weight || 1,
    category: base.category || 'operational',
    concepts: base.concepts || [],
    default: base.default,
    helpText: base.helpText || null
  };
}

function buildForm({ sector, activity, intent, context, userTier = 'free', language = 'ar' }) {
  const resolved = semantic.resolveSector(sector);
  if (!resolved) {
    throw new Error(`Unknown sector: ${sector}`);
  }

  let profile = semantic.getProfile(resolved.sector);
  const contextResult = context ? detectContext(context, { intent }) : null;
  if (contextResult) {
    profile = applyContext(profile, contextResult);
  }

  // Start with common fields and profile-specific fields.
  const fieldMap = new Map();
  for (const f of COMMON_FIELDS) {
    fieldMap.set(f.name, buildFieldDef(f, language));
  }

  for (const f of semantic.getFields(resolved.sector, activity)) {
    fieldMap.set(f.name, buildFieldDef(f, language));
  }

  // Apply sector business rules to show/hide or require fields.
  const ruleContext = {
    sector: resolved.sector,
    activity: activity || '',
    asset_class: activity || '',
    tier: userTier,
    language
  };

  const sectorRuleResult = rulesEngine.evaluateByCategory('Sector', ruleContext);
  for (const result of sectorRuleResult.results) {
    if (result.effect && result.fields) {
      for (const fieldName of result.fields) {
        if (result.effect.startsWith('show_')) {
          const existing = fieldMap.get(fieldName);
          if (existing) {
            existing.hidden = false;
            existing.required = existing.required || true;
          } else {
            fieldMap.set(fieldName, buildFieldDef({
              name: fieldName,
              type: 'number',
              required: true,
              label: { ar: fieldName, en: fieldName }
            }, language));
          }
        }
        if (result.effect.startsWith('hide_')) {
          const existing = fieldMap.get(fieldName);
          if (existing) existing.hidden = true;
        }
      }
    }
  }

  // Apply subscription tier limits.
  const subResult = rulesEngine.evaluate('BR-SUB-001', { tier: userTier });
  if (!subResult.passed && subResult.limits) {
    // Free tier: limit scenario fields.
    for (const f of fieldMap.values()) {
      if (f.name.includes('scenario')) f.hidden = userTier === 'free';
    }
  }

  // Sort: required first, then by weight desc.
  const fields = Array.from(fieldMap.values()).sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return b.weight - a.weight;
  });

  return {
    sector: resolved.sector,
    sectorName: profile.names,
    activity,
    intent,
    context: contextResult ? contextResult.context : null,
    language,
    userTier,
    confidenceThreshold: profile.confidenceThreshold || 70,
    reportTemplate: profile.reportTemplate || 'default',
    requiredEngines: profile.requiredEngines || [],
    fields,
    rulesTriggered: sectorRuleResult.results.filter(r => r.effect || !r.passed).map(r => r.rule?.id || r.rule)
  };
}

module.exports = {
  buildForm,
  buildFieldDef
};
