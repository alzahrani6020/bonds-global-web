'use strict';

const SUPPORTED_DIMENSIONS = new Set(['cost_center','segment']);

function clonePosting(posting) {
  return JSON.parse(JSON.stringify(posting));
}

function normalizeDimensionObject(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ACCOUNTING_DIMENSIONS_OBJECT_REQUIRED');
  }

  const out = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!SUPPORTED_DIMENSIONS.has(key)) {
      throw new Error('ACCOUNTING_DIMENSION_KEY_UNSUPPORTED');
    }
    const value = String(raw == null ? '' : raw).trim();
    if (!value) throw new Error('ACCOUNTING_DIMENSION_CODE_INVALID');
    out[key] = value;
  }
  return out;
}

function applyLineDimensions(posting, assignments = []) {
  if (!posting || !posting.journal || !Array.isArray(posting.journal.lines)) {
    throw new Error('POSTING_JOURNAL_LINES_REQUIRED');
  }
  if (!Array.isArray(assignments)) {
    throw new Error('ACCOUNTING_DIMENSION_ASSIGNMENTS_ARRAY_REQUIRED');
  }

  const result = clonePosting(posting);
  const byLine = new Map(result.journal.lines.map(line => [Number(line.line_no), line]));

  for (const assignment of assignments) {
    if (!assignment || typeof assignment !== 'object') {
      throw new Error('ACCOUNTING_DIMENSION_ASSIGNMENT_INVALID');
    }
    const lineNo = Number(assignment.line_no);
    if (!Number.isInteger(lineNo) || lineNo <= 0 || !byLine.has(lineNo)) {
      throw new Error('ACCOUNTING_DIMENSION_LINE_NOT_FOUND');
    }
    const dimensions = normalizeDimensionObject(assignment.dimensions || {});
    byLine.get(lineNo).dimensions = dimensions;
  }

  return result;
}

module.exports = {
  SUPPORTED_DIMENSIONS,
  normalizeDimensionObject,
  applyLineDimensions
};
