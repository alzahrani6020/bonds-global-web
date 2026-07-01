/**
 * BONDS UCP Validation Registry
 *
 * Loads reusable validation rules and applies them to inputs.
 */

const { validators: baseValidators, validate: validateSchema } = require('../validation');

const DEFAULT_VALIDATIONS = [
  { code: 'val_required', validation_type: 'required', params: {}, error_message: 'This field is required' },
  { code: 'val_number', validation_type: 'number', params: {}, error_message: 'Must be a number' },
  { code: 'val_positive', validation_type: 'positive', params: {}, error_message: 'Must be positive' },
  { code: 'val_non_negative', validation_type: 'nonNegative', params: {}, error_message: 'Must be zero or positive' },
  { code: 'val_integer', validation_type: 'integer', params: {}, error_message: 'Must be an integer' },
  { code: 'val_revenue_positive', validation_type: 'positive', field: 'revenue', params: {}, error_message: 'Revenue must be positive' },
  { code: 'val_cogs_non_negative', validation_type: 'nonNegative', field: 'cogs', params: {}, error_message: 'COGS must be non-negative' },
  { code: 'val_loan_term_months', validation_type: 'range', field: 'loan_term_months', params: { min: 1, max: 600 }, error_message: 'Loan term must be 1-600 months' }
];

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function toNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function applyValidation(value, rule) {
  const params = rule.params || {};
  const type = rule.validation_type;
  const msg = rule.error_message || `Validation ${type} failed`;

  switch (type) {
    case 'required':
      if (isBlank(value)) return msg;
      break;
    case 'number': {
      const n = toNumber(value);
      if (n === null) return msg;
      break;
    }
    case 'integer': {
      const n = toNumber(value);
      if (n === null || !Number.isInteger(n)) return msg;
      break;
    }
    case 'positive': {
      const n = toNumber(value);
      if (n === null || n <= 0) return msg;
      break;
    }
    case 'nonNegative': {
      const n = toNumber(value);
      if (n === null || n < 0) return msg;
      break;
    }
    case 'range': {
      const n = toNumber(value);
      if (n === null) return msg;
      if (params.min !== undefined && n < params.min) return msg;
      if (params.max !== undefined && n > params.max) return msg;
      break;
    }
    case 'min': {
      const n = toNumber(value);
      if (n === null || n < params.value) return msg;
      break;
    }
    case 'max': {
      const n = toNumber(value);
      if (n === null || n > params.value) return msg;
      break;
    }
    case 'oneOf': {
      const list = Array.isArray(params.values) ? params.values : [];
      if (!list.includes(value)) return msg;
      break;
    }
    case 'regex': {
      const re = new RegExp(params.pattern, params.flags || undefined);
      if (!re.test(String(value))) return msg;
      break;
    }
    case 'email':
      if (!baseValidators.email(value)) return msg;
      break;
    case 'phone':
      if (!baseValidators.phone(value)) return msg;
      break;
    case 'countryCode':
      if (!baseValidators.countryCode(value)) return msg;
      break;
    case 'uuid':
      if (!baseValidators.uuid(value)) return msg;
      break;
    case 'priceId':
      if (!baseValidators.priceId(value)) return msg;
      break;
    case 'status':
      if (!baseValidators.status(value)) return msg;
      break;
    case 'custom': {
      if (params.fn && typeof params.fn === 'function') {
        const ok = params.fn(value, params);
        if (!ok) return msg;
      }
      break;
    }
    default:
      return `Unknown validation type: ${type}`;
  }
  return null;
}

class ValidationRegistry {
  constructor({ rules = [], preferStatic = false } = {}) {
    this.rules = new Map();
    if (preferStatic || rules.length === 0) {
      for (const r of DEFAULT_VALIDATIONS) this.register(r);
    }
    for (const r of rules) this.register(r);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_validation_registry').select('*');
    if (error) throw error;
    return new ValidationRegistry({ rules: data || [] });
  }

  register(rule) {
    if (!rule || !rule.code) throw new Error('Validation rule must have code');
    this.rules.set(rule.code, rule);
  }

  get(code) { return this.rules.get(code); }

  list() { return Array.from(this.rules.values()); }

  findBySectorCountry(sector, country) {
    return this.list().filter(r => {
      if (r.sector && r.sector !== sector) return false;
      if (r.country && r.country !== country) return false;
      return true;
    });
  }

  /**
   * Validate inputs against a list of validation codes.
   * @param {Object} inputs
   * @param {string[]} codes
   * @returns {{valid: boolean, errors: Object<string,string>, details: Array}}
   */
  validate(inputs, codes) {
    const errors = {};
    const details = [];
    for (const code of codes) {
      const rule = this.get(code);
      if (!rule) {
        details.push({ code, status: 'skipped', message: 'Rule not found' });
        continue;
      }
      const field = rule.field || code;
      const value = inputs[field];
      const message = applyValidation(value, rule);
      details.push({ code, field, value, status: message ? 'fail' : 'pass', message });
      if (message && !errors[field]) errors[field] = message;
    }
    return { valid: Object.keys(errors).length === 0, errors, details };
  }

  /**
   * Validate by a JSON schema using existing lib/validation.
   */
  validateSchema(data, schema) {
    return validateSchema(data, schema);
  }
}

module.exports = { ValidationRegistry, DEFAULT_VALIDATIONS, applyValidation };
