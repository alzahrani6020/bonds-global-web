'use strict';

function detectLanguage(text) {
  const value = String(text || '').trim();
  if (!value) {
    return { language:'unknown', confidence:0, direction:'ltr', script:'unknown' };
  }

  const arabic = (value.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  const total = arabic + latin;

  if (!total) {
    return { language:'unknown', confidence:0.2, direction:'ltr', script:'unknown' };
  }

  if (arabic && latin) {
    const dominantArabic = arabic >= latin;
    return {
      language:'mixed',
      dominant_language:dominantArabic ? 'ar' : 'en',
      confidence:Number((Math.max(arabic, latin) / total).toFixed(3)),
      direction:dominantArabic ? 'rtl' : 'ltr',
      script:'mixed'
    };
  }

  if (arabic) {
    return {
      language:'ar',
      confidence:Number((arabic / total).toFixed(3)),
      direction:'rtl',
      script:'arabic'
    };
  }

  return {
    language:'en',
    confidence:Number((latin / total).toFixed(3)),
    direction:'ltr',
    script:'latin'
  };
}

module.exports = { detectLanguage };
