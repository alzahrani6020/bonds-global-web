// ===== Bonds Calculator Lead Conversion Helper =====
// Marks the signed-up user's email as converted so the retargeting
// email sequence stops sending follow-up messages.
(function () {
  'use strict';

  window.BondsLeadConversion = window.BondsLeadConversion || {
    _marked: new Set(),

    /**
     * Mark the given email as converted on the backend.
     * Requires BondsAuth to be loaded and a valid session.
     * Safe to call multiple times — deduplicated locally and idempotent server-side.
     */
    async markConverted(email) {
      const normalized = String(email || '').toLowerCase().trim();
      if (!normalized) return { success: false, error: 'Email required' };
      if (this._marked.has(normalized)) return { success: true, cached: true };

      if (!window.BondsAuth || !window.BondsAuth.getSession) {
        return { success: false, error: 'BondsAuth not loaded' };
      }

      try {
        const { data: sessionData } = await window.BondsAuth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return { success: false, error: 'No active session' };

        const res = await fetch('/api/mark-lead-converted', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ email: normalized })
        });

        const result = await res.json().catch(() => ({}));
        if (res.ok) {
          this._marked.add(normalized);
          return { success: true, ...result };
        }
        return { success: false, error: result.error || ('HTTP ' + res.status) };
      } catch (err) {
        console.warn('[BondsLeadConversion] markConverted failed:', err);
        return { success: false, error: err.message || 'Network error' };
      }
    }
  };
})();
