/**
 * Bonds Calculator Shared Chart Utilities
 * Chart.js loader, dark theme defaults, and helpers
 */

// ===== 1. Chart.js Loader =====
function loadChartJS() {
  if (window._chartJsPromise) return window._chartJsPromise;
  if (typeof Chart !== 'undefined') return Promise.resolve();
  window._chartJsPromise = new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window._chartJsPromise;
}

// ===== 2. Apply Bonds Dark Theme Defaults =====
function applyChartDarkTheme() {
  if (typeof Chart === 'undefined' || Chart.defaults._bondsThemed) return;
  Chart.defaults.color = '#e8ecf4';
  Chart.defaults.font.family = 'Vazirmatn';
  Chart.defaults._bondsThemed = true;
}

// ===== 3. Safe Chart Destroy =====
function safeDestroyChart(chartInstance) {
  if (chartInstance && typeof chartInstance.destroy === 'function') {
    try { chartInstance.destroy(); } catch(e) {}
  }
}

// ===== 4. Common Scale Config =====
function getBondsScales(yTitle) {
  return {
    x: { ticks: { color: '#e8ecf4', font: { family: 'Vazirmatn' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    y: { ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } }, grid: { color: 'rgba(255,255,255,0.05)' }, title: yTitle ? { display: true, text: yTitle, color: '#94a3b8' } : undefined }
  };
}
