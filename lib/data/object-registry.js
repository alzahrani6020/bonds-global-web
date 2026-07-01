/**
 * BONDS Global Object Registry
 * Allocates human-readable, unique identifiers for all canonical entities.
 *
 * Supported prefixes and formats are defined in:
 *   docs/foundation/03_GLOBAL_OBJECT_REGISTRY.md
 */

const { randomUUID } = require('crypto');

/**
 * Known prefixes and their human-readable formatting rules.
 */
const PREFIXES = {
  // Human-numbered prefixes
  PRJ: { entity: 'Project', numbered: true, formatter: (y, cc, n) => `PRJ-${y}-${String(n).padStart(8, '0')}` },
  AST: { entity: 'Asset', numbered: true, formatter: (y, cc, n) => `AST-${y}-${cc}-${String(n).padStart(8, '0')}` },
  VAL: { entity: 'Valuation', numbered: true, formatter: (y, cc, n) => `VAL-${y}-${String(n).padStart(8, '0')}` },
  FIN: { entity: 'Financing', numbered: true, formatter: (y, cc, n) => `FIN-${y}-${String(n).padStart(8, '0')}` },
  FEA: { entity: 'Feasibility', numbered: true, formatter: (y, cc, n) => `FEA-${y}-${String(n).padStart(8, '0')}` },
  RPT: { entity: 'Report', numbered: true, formatter: (y, cc, n) => `RPT-${y}-${String(n).padStart(8, '0')}` },
  SIM: { entity: 'Scenario', numbered: true, formatter: (y, cc, n) => `SIM-${y}-${String(n).padStart(8, '0')}` },
  REC: { entity: 'Recommendation', numbered: true, formatter: (y, cc, n) => `REC-${y}-${String(n).padStart(8, '0')}` },
  BDVC: { entity: 'Certificate', numbered: true, formatter: (y, cc, n) => `BDVC-${y}-${cc}-${String(n).padStart(8, '0')}` },

  // UUID-based prefixes
  USR: { entity: 'User', numbered: false },
  ORG: { entity: 'Organization', numbered: false },
  AI: { entity: 'AI Report', numbered: false },
  ENG: { entity: 'Engine Run', numbered: false },
  API: { entity: 'API Request', numbered: false },
  DB: { entity: 'Database Record', numbered: false },
  CAL: { entity: 'Calculation', numbered: false },
  KNW: { entity: 'Knowledge Object', numbered: false },
  INT: { entity: 'Intelligence Event', numbered: false },
  AUD: { entity: 'Audit Record', numbered: false },
  DSR: { entity: 'Data Source', numbered: false },
  OV: { entity: 'Data Override', numbered: false },
  EVD: { entity: 'Evidence Bundle', numbered: false },
  DEC: { entity: 'Decision', numbered: false },
  DGT: { entity: 'Decision Graph Node', numbered: false },
  DTW: { entity: 'Digital Twin', numbered: false }
};

function isValidPrefix(prefix) {
  return typeof prefix === 'string' && Object.prototype.hasOwnProperty.call(PREFIXES, prefix.toUpperCase());
}

function getPrefixConfig(prefix) {
  return PREFIXES[prefix.toUpperCase()];
}

function generateUuidId(prefix) {
  return `${prefix.toUpperCase()}-${randomUUID()}`;
}

function formatNumberedId(prefix, year, countryCode, sequenceNumber) {
  const config = getPrefixConfig(prefix);
  if (!config || !config.numbered) {
    throw new Error(`Prefix ${prefix} does not support numbered IDs`);
  }
  return config.formatter(year, countryCode || 'XX', sequenceNumber);
}

/**
 * Parse a human-readable BONDS ID.
 * @param {string} humanId
 * @returns {{prefix:string, year?:number, countryCode?:string, sequence?:number, uuid?:string}|null}
 */
function parseHumanId(humanId) {
  if (typeof humanId !== 'string' || humanId.length < 4) return null;
  const [prefix, ...rest] = humanId.split('-');
  if (!isValidPrefix(prefix)) return null;
  const config = getPrefixConfig(prefix);
  if (!config.numbered) {
    return { prefix: prefix.toUpperCase(), uuid: rest.join('-') };
  }

  // Numbered formats:
  // PRJ-YYYY-NNNNNNNN
  // AST-YYYY-CC-NNNNNNNN
  // VAL/FIN/FEA/RPT/SIM/REC-YYYY-NNNNNNNN
  // BDVC-YYYY-CC-NNNNNNNN
  if (rest.length < 2) return null;
  const year = parseInt(rest[0], 10);
  if (Number.isNaN(year)) return null;

  let countryCode;
  let sequencePart;
  if (['AST', 'BDVC'].includes(prefix.toUpperCase())) {
    if (rest.length !== 3) return null;
    countryCode = rest[1];
    sequencePart = rest[2];
  } else {
    if (rest.length !== 2) return null;
    sequencePart = rest[1];
  }
  const sequence = parseInt(sequencePart, 10);
  if (Number.isNaN(sequence)) return null;
  return { prefix: prefix.toUpperCase(), year, countryCode, sequence };
}

/**
 * Allocate the next sequence number for a numbered prefix.
 * @param {object} supabase — Supabase client with service role or RPC access.
 * @param {string} prefix
 * @param {number} year
 * @param {string|null} [countryCode]
 * @returns {Promise<number>}
 */
async function nextSequence(supabase, prefix, year, countryCode = null) {
  if (!isValidPrefix(prefix)) throw new Error(`Invalid prefix: ${prefix}`);
  const config = getPrefixConfig(prefix);
  if (!config.numbered) throw new Error(`Prefix ${prefix} is not numbered`);

  const { data, error } = await supabase.rpc('next_bonds_sequence', {
    p_prefix: prefix.toUpperCase(),
    p_year: year,
    p_country_code: countryCode
  });
  if (error) throw new Error(`Failed to allocate sequence: ${error.message}`);
  return data;
}

/**
 * Allocate a new BONDS object ID.
 * @param {object} supabase
 * @param {object} options
 * @param {string} options.prefix
 * @param {string} options.entityType
 * @param {string} [options.referenceTable]
 * @param {string} [options.referenceId]
 * @param {string} [options.countryCode]
 * @param {number} [options.year]
 * @param {string} [options.userId]
 * @returns {Promise<{id:string, humanId:string, prefix:string}>}
 */
async function allocate(supabase, options) {
  const { prefix, entityType, referenceTable, referenceId, countryCode, year, userId } = options;
  if (!isValidPrefix(prefix)) throw new Error(`Invalid prefix: ${prefix}`);
  if (!entityType) throw new Error('entityType is required');

  const config = getPrefixConfig(prefix);
  let humanId;
  if (config.numbered) {
    const y = year || new Date().getUTCFullYear();
    const seq = await nextSequence(supabase, prefix, y, countryCode);
    humanId = formatNumberedId(prefix, y, countryCode, seq);
  } else {
    humanId = generateUuidId(prefix);
  }

  const { data, error } = await supabase
    .from('bonds_objects')
    .insert({
      prefix: prefix.toUpperCase(),
      human_id: humanId,
      entity_type: entityType,
      reference_table: referenceTable || null,
      reference_id: referenceId || null,
      created_by: userId || null,
      metadata: {}
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to register object ${humanId}: ${error.message}`);
  }

  return {
    id: data.id,
    humanId,
    prefix: prefix.toUpperCase(),
    entityType
  };
}

module.exports = {
  PREFIXES,
  isValidPrefix,
  getPrefixConfig,
  formatNumberedId,
  parseHumanId,
  nextSequence,
  allocate,
  generateUuidId
};
