/**
 * Enterprise Monitoring & Logging Client — Bonds Global
 * Captures errors and events and sends them to Supabase system_logs.
 */
(function (root) {
  'use strict';

  const QUEUE = [];
  let flushTimer = null;

  function enqueue(level, component, message, metadata) {
    QUEUE.push({
      level,
      component,
      message,
      metadata: metadata || {},
      url: typeof location !== 'undefined' ? location.href : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      created_at: new Date().toISOString()
    });
    scheduleFlush();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 5000);
  }

  async function flush() {
    flushTimer = null;
    if (!QUEUE.length) return;
    const batch = QUEUE.splice(0, QUEUE.length);
    try {
      const sb = root.BondsAuth && root.BondsAuth.getSupabase ? root.BondsAuth.getSupabase() : null;
      if (!sb) return;
      await sb.from('system_logs').insert(batch);
    } catch (e) {
      // Do not loop on logging errors
    }
  }

  function info(component, message, metadata) { enqueue('info', component, message, metadata); }
  function warn(component, message, metadata) { enqueue('warning', component, message, metadata); }
  function error(component, message, metadata) { enqueue('error', component, message, metadata); }

  function captureException(err, component) {
    error(component || 'client', err.message, {
      stack: err.stack,
      name: err.name,
      code: err.code
    });
  }

  function bindWindowErrors() {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', e => {
      captureException(e.error || new Error(e.message), 'window.error');
    });
    window.addEventListener('unhandledrejection', e => {
      const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
      captureException(err, 'unhandledrejection');
    });
  }

  bindWindowErrors();

  root.BondsMonitor = {
    info, warn, error, captureException, flush
  };
})(window);
