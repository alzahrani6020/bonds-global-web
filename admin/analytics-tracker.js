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

    let token = '';
    try { token = localStorage.getItem('bonds-auth-token') || ''; } catch (e) {}

    await fetch('/api/log-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
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
