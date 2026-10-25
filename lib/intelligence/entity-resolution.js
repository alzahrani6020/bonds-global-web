'use strict';

const ENTITY_FRAME_SCHEMA_VERSION = 1;

function clean(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function resolveEntityFrame(entity = null, options = {}) {
  if (!entity || typeof entity !== 'object') return null;

  if (entity.type === 'person' && entity.person_entity_frame) {
    const person = entity.person_entity_frame;
    return deepFreeze({
      entity_frame_schema_version: ENTITY_FRAME_SCHEMA_VERSION,
      entity_type: 'person',
      raw_mention: clean(person.raw_mention || options.rawMention || entity.text),
      canonical_name: clean(person.canonical_name || entity.text, 300),
      qualifiers: Array.isArray(person.qualifiers) ? person.qualifiers : [],
      relations: Array.isArray(person.relations) ? person.relations : [],
      organizations: Array.isArray(person.organizations) ? person.organizations : [],
      confidence: Number(person.confidence ?? entity.confidence ?? 0),
      ambiguity: Boolean(person.ambiguity),
      provenance: {
        source: 'resolved_entity',
        person_identity_schema_version: person.person_identity_schema_version || null,
        immutable: true
      }
    });
  }

  if (entity.type === 'relation') {
    return deepFreeze({
      entity_frame_schema_version: ENTITY_FRAME_SCHEMA_VERSION,
      entity_type:'relation',
      raw_mention:clean(options.rawMention || entity.text),
      canonical_name:clean(entity.organization?.value || entity.text, 300),
      qualifiers:[],
      relations:entity.relation ? [entity.relation] : [],
      organizations:entity.organization ? [entity.organization] : [],
      confidence:Math.max(0, Math.min(1, Number(entity.confidence) || 0)),
      ambiguity:false,
      provenance:{
        source:'resolved_entity',
        immutable:true
      }
    });
  }

  return deepFreeze({
    entity_frame_schema_version: ENTITY_FRAME_SCHEMA_VERSION,
    entity_type: clean(entity.type || 'topic', 80),
    raw_mention: clean(options.rawMention || entity.text),
    canonical_name: clean(entity.text, 300),
    qualifiers: [],
    relations: [],
    organizations: [],
    confidence: Math.max(0, Math.min(1, Number(entity.confidence) || 0)),
    ambiguity: Number(entity.confidence || 0) < 0.8,
    provenance: {
      source: 'resolved_entity',
      immutable: true
    }
  });
}

module.exports = {
  ENTITY_FRAME_SCHEMA_VERSION,
  resolveEntityFrame
};
