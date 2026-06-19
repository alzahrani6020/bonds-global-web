/**
 * Enterprise Validation Layer — Bonds Global
 * Reusable, strict input validation with Arabic/English error messages.
 */
(function (root) {
  'use strict';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const SA_PHONE_RE = /^05\d{8}$/;
  const INT_PHONE_RE = /^\+[1-9]\d{7,15}$/;
  const PRICE_ID_RE = /^price_/;

  const validators = {
    required: (value) => value !== undefined && value !== null && String(value).trim() !== '',
    string: (value) => typeof value === 'string',
    number: (value) => typeof value === 'number' && !isNaN(value) && isFinite(value),
    positiveNumber: (value) => validators.number(value) && value >= 0,
    integer: (value) => Number.isInteger(value),
    email: (value) => typeof value === 'string' && EMAIL_RE.test(value),
    uuid: (value) => typeof value === 'string' && UUID_RE.test(value),
    saPhone: (value) => typeof value === 'string' && SA_PHONE_RE.test(value),
    internationalPhone: (value) => typeof value === 'string' && INT_PHONE_RE.test(value),
    phone: (value) => validators.saPhone(value) || validators.internationalPhone(value),
    priceId: (value) => typeof value === 'string' && PRICE_ID_RE.test(value),
    countryCode: (value) => typeof value === 'string' && /^[A-Z]{2}$/.test(value),
    status: (value, allowed) => typeof value === 'string' && Array.isArray(allowed) && allowed.includes(value),
    url: (value) => {
      if (typeof value !== 'string') return false;
      try { new URL(value); return true; } catch { return false; }
    },
    minLength: (value, len) => typeof value === 'string' && value.length >= len,
    maxLength: (value, len) => typeof value === 'string' && value.length <= len,
    range: (value, min, max) => validators.number(value) && value >= min && value <= max,
    oneOf: (value, list) => Array.isArray(list) && list.includes(value),
    json: (value) => {
      if (typeof value !== 'string') return false;
      try { JSON.parse(value); return true; } catch { return false; }
    }
  };

  function validateField(name, value, rules) {
    const errors = [];
    if (rules.required && !validators.required(value)) {
      errors.push({ field: name, code: 'required', message: `الحقل ${name} مطلوب.` });
      return errors;
    }
    if (!validators.required(value)) return errors;

    if (rules.type && validators[rules.type] && !validators[rules.type](value)) {
      errors.push({ field: name, code: 'type', message: `الحقل ${name} يجب أن يكون من نوع ${rules.type}.` });
    }
    if (rules.email && !validators.email(value)) {
      errors.push({ field: name, code: 'email', message: `الحقل ${name} يجب أن يكون بريداً إلكترونياً صالحاً.` });
    }
    if (rules.uuid && !validators.uuid(value)) {
      errors.push({ field: name, code: 'uuid', message: `الحقل ${name} يجب أن يكون UUID صالحاً.` });
    }
    if (rules.phone && !validators.phone(value)) {
      errors.push({ field: name, code: 'phone', message: `الحقل ${name} يجب أن يكون رقم هاتف سعودي أو دولي صالح.` });
    }
    if (rules.priceId && !validators.priceId(value)) {
      errors.push({ field: name, code: 'priceId', message: `الحقل ${name} يجب أن يبدأ بـ price_.` });
    }
    if (rules.countryCode && !validators.countryCode(value)) {
      errors.push({ field: name, code: 'countryCode', message: `الحقل ${name} يجب أن يكون رمز دولة ISO-3166 مكون من حرفين.` });
    }
    if (rules.status && !validators.status(value, rules.status)) {
      errors.push({ field: name, code: 'status', message: `الحقل ${name} يجب أن يكون أحد: ${rules.status.join('، ')}.` });
    }
    if (rules.minLength !== undefined && !validators.minLength(value, rules.minLength)) {
      errors.push({ field: name, code: 'minLength', message: `الحقل ${name} يجب ألا يقل طوله عن ${rules.minLength} حروف.` });
    }
    if (rules.maxLength !== undefined && !validators.maxLength(value, rules.maxLength)) {
      errors.push({ field: name, code: 'maxLength', message: `الحقل ${name} يجب ألا يزيد طوله عن ${rules.maxLength} حرفاً.` });
    }
    if (rules.min !== undefined && validators.number(value) && value < rules.min) {
      errors.push({ field: name, code: 'min', message: `الحقل ${name} يجب ألا يقل عن ${rules.min}.` });
    }
    if (rules.max !== undefined && validators.number(value) && value > rules.max) {
      errors.push({ field: name, code: 'max', message: `الحقل ${name} يجب ألا يزيد عن ${rules.max}.` });
    }
    if (rules.oneOf && !validators.oneOf(value, rules.oneOf)) {
      errors.push({ field: name, code: 'oneOf', message: `الحقل ${name} يجب أن يكون أحد: ${rules.oneOf.join('، ')}.` });
    }
    if (rules.custom && typeof rules.custom === 'function') {
      const custom = rules.custom(value);
      if (custom !== true) errors.push({ field: name, code: 'custom', message: custom || `الحقل ${name} غير صالح.` });
    }
    return errors;
  }

  function validate(data, schema) {
    const errors = [];
    Object.keys(schema).forEach(field => {
      errors.push(...validateField(field, data[field], schema[field]));
    });
    return {
      valid: errors.length === 0,
      errors,
      first: errors[0] || null
    };
  }

  function assertValid(data, schema) {
    const result = validate(data, schema);
    if (!result.valid) {
      const err = new Error(result.first.message);
      err.code = result.first.code;
      err.field = result.first.field;
      err.validationErrors = result.errors;
      throw err;
    }
  }

  root.BondsValidation = {
    validators,
    validate,
    assertValid,
    isEmail: validators.email,
    isUuid: validators.uuid,
    isPhone: validators.phone,
    isPriceId: validators.priceId,
    isCountryCode: validators.countryCode
  };
})(window);
