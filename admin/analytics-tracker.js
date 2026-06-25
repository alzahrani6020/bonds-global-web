// ============================================
// Analytics Tracker
// Include this script in calculators to track usage
// Usage: trackCalculation('factory-cost-sa', 'SA', { area: 500 }, { total: 15000 }, 'expected');
// ============================================

async function trackCalculation(calculator, country, inputs, results, scenarioType) {
  try {
    const payload = {
      calculator: calculator || 'unknown',
      country: country || null,
      inputs: inputs || {},
      results: results || {},
      scenario_type: scenarioType || null
    };

    // Try to get user_id from Supabase session if available
    if (typeof supabase !== 'undefined') {
      const url = window.__ENV?.SUPABASE_URL || '';
      const key = window.__ENV?.SUPABASE_ANON_KEY || '';
      if (url && key) {
        const client = supabase.createClient(url, key);
        const { data: { session } } = await client.auth.getSession();
        if (session?.user?.id) payload.user_id = session.user.id;
      }
    }

    await fetch('/api/log-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // Silently fail — analytics should not break calculators
  }
}

// Auto-track if data-analytics attributes exist on page
function initAutoTracking() {
  document.querySelectorAll('[data-analytics-calculator]').forEach(el => {
    el.addEventListener('click', () => {
      const calc = el.dataset.analyticsCalculator;
      const country = el.dataset.analyticsCountry;
      const scenario = el.dataset.analyticsScenario;
      if (calc) trackCalculation(calc, country, {}, {}, scenario);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAutoTracking);
} else {
  initAutoTracking();
}
