/**
 * Bonds Admin Common Helpers
 * Shared utilities used across standalone admin pages to avoid duplicate code.
 */
(function (global) {
  'use strict';

  function isAsciiJwt(value) {
    return typeof value === 'string' && /^[A-Za-z0-9\-_\.]+$/.test(value);
  }

  function extractToken(value) {
    if (!value || typeof value !== 'string') return '';
    if (isAsciiJwt(value)) return value;
    // Supabase stores the session as a JSON string under bonds-auth-token.
    try {
      const parsed = JSON.parse(value);
      const access = parsed?.access_token || parsed?.session?.access_token || parsed?.data?.session?.access_token || '';
      return isAsciiJwt(access) ? access : '';
    } catch (e) {
      return '';
    }
  }

  async function getAdminToken() {
    let token = extractToken(global.__ADMIN_TOKEN);
    if (!token && global.BondsAuth?.getSession) {
      try {
        const { data: { session } } = await global.BondsAuth.getSession();
        token = extractToken(session?.access_token);
      } catch (e) {}
    }
    if (!token && typeof supabase !== 'undefined' && global.__ENV?.SUPABASE_URL) {
      try {
        // Use the same unified storage key so we share the session with BondsAuth
        // instead of creating a second, isolated client.
        const client = supabase.createClient(global.__ENV.SUPABASE_URL, global.__ENV.SUPABASE_ANON_KEY, {
          auth: { storageKey: 'bonds-auth-token', persistSession: true, autoRefreshToken: true }
        });
        const { data: { session } } = await client.auth.getSession();
        token = extractToken(session?.access_token);
      } catch (e) {}
    }
    if (!token) {
      try {
        token = extractToken(global.localStorage?.getItem('bonds-auth-token'));
      } catch (e) {}
    }
    return token;
  }

  function showAdminStatus(containerId, message, isError) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    el.style.background = isError ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)';
    el.style.border = '1px solid ' + (isError ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)');
    el.style.color = isError ? 'var(--danger)' : 'var(--success)';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ''));

      if (url.protocol === 'https:') {
        return url.toString();
      }

      if (
        url.protocol === 'http:' &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
      ) {
        return url.toString();
      }

      return '';
    } catch {
      return '';
    }
  }

  const ADMIN_LABELS_AR = Object.freeze({
    organizations:'المنشآت',
    clients:'العملاء',
    opportunities:'الفرص',
    renewals:'التجديدات',
    customerSuccessRecords:'سجلات نجاح العملاء',
    generatedAt:'وقت التحديث',
    currentDeployment:'النشر الحالي',
    provider:'المزوّد',
    environment:'البيئة',
    production:'الإنتاج',
    executive:'التحليلات التنفيذية',
    activeUsers30d:'المستخدمون النشطون خلال 30 يومًا',
    activatedUsers:'المستخدمون المفعّلون',
    mrr:'الإيراد الشهري المتكرر',
    arr:'الإيراد السنوي المتكرر',
    arpu:'متوسط الإيراد لكل مستخدم',
    conversionPct:'معدل التحويل',
    churnPct:'معدل التسرب',
    pipelineValue:'قيمة خط المبيعات',
    weightedPipeline:'خط المبيعات المرجّح',
    renewalRisk:'مخاطر التجديد',
    customerHealth:'صحة العملاء',
    lead:'عملاء محتملون',
    qualified:'مؤهلون',
    count:'العدد',
    value:'القيمة',
    weightedValue:'القيمة المرجّحة',
    items:'العناصر',
    requests:'الطلبات',
    status:'الحالة',
    version:'الإصدار'
  });

  function humanizeAdminKey(value, locale) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parts = raw.split('.');
    const translatePart = part => {
      if ((locale || document?.documentElement?.lang || 'ar').startsWith('ar') && ADMIN_LABELS_AR[part]) {
        return ADMIN_LABELS_AR[part];
      }
      return part
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, m => m.toUpperCase());
    };
    return parts.map(translatePart).join(' · ');
  }

  async function requestJson(url, options) {
    const response = await global.BondsAuth.authenticatedFetch(url, options || {});
    let body = {};
    try {
      body = typeof response?.json === 'function' ? await response.json() : response || {};
    } catch (error) {
      body = { error: error?.message || 'INVALID_JSON_RESPONSE' };
    }
    if (!response?.ok || body?.success === false) {
      const err = new Error(body?.error || body?.message || ('HTTP ' + Number(response?.status || 0)));
      err.status = Number(response?.status || 0);
      err.body = body;
      throw err;
    }
    return body;
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  global.BondsAdminCommon = {
    getAdminToken,
    showAdminStatus,
    escapeHtml,
    safeExternalUrl,
    humanizeAdminKey,
    requestJson,
    debounce
  };
})(window);
