'use strict';

const registry = require('../../data/tools-registry.json');

const ASSISTANT_CALCULATOR_BY_TOOL = Object.freeze({
  'break-even': 'break_even',
  'cash-flow': 'cash_flow',
  loan: 'loan',
  roi: 'roi',
  creditworthiness: 'creditworthiness',
  'feasibility-template': 'feasibility',
  restaurant: 'restaurant'
});

function toolById(toolId, language = 'ar') {
  const id = String(toolId || '').trim();
  if (!id) return null;
  const item = (registry.tools || []).find(tool => tool.id === id && tool.active !== false);
  if (!item) return null;
  const locale = language === 'en' ? 'en' : 'ar';
  return {
    id:item.id,
    type:item.type,
    category:item.category,
    label:item.labels?.[locale] || item.labels?.ar || item.id,
    route:item.routes?.[locale] || item.routes?.ar || null,
    assistant_calculator:ASSISTANT_CALCULATOR_BY_TOOL[item.id] || null,
    active:item.active !== false
  };
}

module.exports = {
  ASSISTANT_CALCULATOR_BY_TOOL,
  toolById
};
