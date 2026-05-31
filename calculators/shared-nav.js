/**
 * Shared Navigation Dropdown Injector for Bonds Global
 * Usage: Add <div id="bonds-nav-dropdown"></div> where you want the calculators dropdown.
 * The script auto-detects depth and builds correct relative paths.
 */
(function() {
  'use strict';

  var CALCULATORS = [
    { ar: 'نقطة التعادل', en: 'Break-Even', path: 'calculator.html' },
    { ar: 'تدفق النقد', en: 'Cash Flow', path: 'calculators/cash-flow.html' },
    { ar: 'تسعير المنتج', en: 'Product Pricing', path: 'calculators/pricing.html' },
    { ar: 'القرض والتمويل', en: 'Loan & Financing', path: 'calculators/loan.html' },
    { ar: 'المطاعم والسحابي', en: 'Restaurant & Cloud', path: 'calculators/restaurant.html' },
    { ar: 'هامش الربح', en: 'Dish Margin', path: 'calculators/dish-margin.html' },
    { ar: 'دراسة جدوى', en: 'Feasibility Study', path: 'calculators/feasibility.html' },
    { ar: 'تحليل الفواتير', en: 'Invoice Analyzer', path: 'calculators/invoice-analyzer.html' },
    { ar: 'هندسة القائمة', en: 'Menu Engineering', path: 'calculators/menu-engineering.html' },
    { ar: 'هندسة القائمة (بسيط)', en: 'Menu Eng. (Simple)', path: 'calculators/menu-engineering-simple.html' }
  ];

  function getBasePath() {
    var path = window.location.pathname;
    var depth = path.split('/').filter(Boolean).length;
    // index.html at root → depth 0 after removing empty string
    // /calculators/x.html → depth 1 (calculators)
    // /en/calculators/x.html → depth 2 (en, calculators)
    if (path.endsWith('.html')) depth -= 1;
    if (depth <= 0) return '';
    var parts = [];
    for (var i = 0; i < depth; i++) parts.push('..');
    return parts.join('/') + '/';
  }

  function injectNav() {
    var containers = document.querySelectorAll('[data-bonds-nav]');
    if (containers.length === 0) return;

    var base = getBasePath();
    var isRTL = document.dir === 'rtl' || document.documentElement.lang === 'ar';
    var label = isRTL ? 'الحاسبات' : 'Calculators';

    var html = '<div class="dropdown-menu bonds-shared-dropdown" style="display:none;position:absolute;top:100%;' + (isRTL ? 'left' : 'right') + ':0;background:#0f172a;border:1px solid rgba(212,168,83,0.2);border-radius:8px;padding:0.5rem 0;min-width:220px;z-index:999;box-shadow:0 10px 40px rgba(0,0,0,0.4);">';

    CALCULATORS.forEach(function(c) {
      var name = isRTL ? c.ar : c.en;
      var href = base + c.path;
      html += '<a href="' + href + '" style="display:block;padding:0.5rem 1rem;color:#e2e8f0;font-size:0.9rem;text-decoration:none;transition:background 0.15s;">' + name + '</a>';
    });

    html += '</div>';

    containers.forEach(function(container) {
      container.innerHTML =
        '<span class="dropdown-toggle" style="cursor:pointer;color:#94a3b8;font-weight:600;position:relative;">' +
        label +
        ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-' + (isRTL ? 'right' : 'left') + ':4px;"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
        '</span>' + html;

      var toggle = container.querySelector('.dropdown-toggle');
      var menu = container.querySelector('.bonds-shared-dropdown');
      if (!toggle || !menu) return;

      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var isVisible = menu.style.display === 'block';
        // Close all others
        document.querySelectorAll('.bonds-shared-dropdown').forEach(function(m) { m.style.display = 'none'; });
        menu.style.display = isVisible ? 'none' : 'block';
      });

      // Hover styles for links
      menu.querySelectorAll('a').forEach(function(a) {
        a.addEventListener('mouseenter', function() { a.style.background = 'rgba(212,168,83,0.1)'; });
        a.addEventListener('mouseleave', function() { a.style.background = 'transparent'; });
      });
    });

    // Close on outside click
    document.addEventListener('click', function() {
      document.querySelectorAll('.bonds-shared-dropdown').forEach(function(m) { m.style.display = 'none'; });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNav);
  } else {
    injectNav();
  }
})();
