// Bonds Global — Shared calculator analytics
// Tracks events to GA4 / Plausible / Bonds backend (best-effort, never blocks UI)
(function() {
  'use strict';

  function safeStringify(obj) {
    try { return JSON.stringify(obj); } catch (e) { return '{}'; }
  }

  function getSessionId() {
    try {
      var sid = sessionStorage.getItem('bonds_session_id');
      if (sid) return sid;
      sid = 'bs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('bonds_session_id', sid);
      return sid;
    } catch (e) { return ''; }
  }

  window.BondsAnalytics = window.BondsAnalytics || {};

  window.BondsAnalytics.trackEvent = function(eventName, properties) {
    properties = properties || {};
    var payload = {
      event: eventName,
      properties: properties,
      url: (typeof window !== 'undefined' ? window.location.href : ''),
      timestamp: new Date().toISOString()
    };

    // Google Analytics 4
    if (typeof gtag === 'function') {
      try { gtag('event', eventName, properties); } catch (e) {}
    }

    // Plausible
    if (typeof plausible === 'function') {
      try { plausible(eventName); } catch (e) {}
    }

    // Bonds backend usage log (best-effort, supports anonymous users)
    try {
      var token = '';
      try { token = localStorage.getItem('bonds-auth-token') || ''; } catch (e) {}
      var sessionId = getSessionId();
      var body = {
        event: eventName,
        calculator: properties.source || properties.calculator || eventName,
        country: properties.country || null,
        lang: document.documentElement.lang || 'ar',
        session_id: sessionId,
        action: properties.action || null,
        duration_seconds: typeof properties.durationSeconds === 'number' ? properties.durationSeconds : null,
        properties: properties,
        url: window.location.href
      };
      if (typeof fetch === 'function') {
        fetch('/api/log-usage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': 'Bearer ' + token } : {})
          },
          body: safeStringify(body)
        }).catch(function() {});
      }
    } catch (e) {}
  };
})();
