'use strict';

const registry = require('../../data/tools-registry.json');

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
    active:item.active !== false
  };
}

module.exports = { toolById };
