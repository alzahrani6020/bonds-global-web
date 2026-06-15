/**
 * Bonds Global — Unified Site Layout (Header/Footer) Injection
 *
 * This script injects a shared header and footer into any page that has:
 *   <div id="site-header"></div>
 *   <div id="site-footer"></div>
 *
 * Language is detected from <html lang="ar|en"> or the URL path (/en/).
 * Relative paths are adjusted based on file depth.
 */
(function () {
  'use strict';

  function getDepth() {
    const path = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!path) return 0;
    return path.split('/').length - 1;
  }

  function getBase() {
    const depth = getDepth();
    return depth === 0 ? '' : Array(depth).fill('../').join('');
  }

  function getLangBase(isEn) {
    const rootBase = getBase();
    if (!isEn) return rootBase;
    // English pages live under /en/, so internal language links are one level shallower.
    const path = window.location.pathname.replace(/^\/+/, '');
    const enDepth = (path.match(/\b(en)\//g) || []).length;
    const langDepth = Math.max(0, getDepth() - enDepth);
    return langDepth === 0 ? '' : Array(langDepth).fill('../').join('');
  }

  function detectLang() {
    const html = document.documentElement;
    if (html && html.lang) {
      const lang = html.lang.toLowerCase();
      if (lang === 'en' || lang.startsWith('en-')) return 'en';
      if (lang === 'ar' || lang.startsWith('ar-')) return 'ar';
    }
    if (/\/(en)(\/|$)/i.test(window.location.pathname)) return 'en';
    return 'ar';
  }

  function buildHeader(lang, base) {
    const isEn = lang === 'en';
    const langBase = getLangBase(isEn);

    const labels = {
      home: isEn ? 'Home' : 'الرئيسية',
      about: isEn ? 'About' : 'من نحن',
      services: isEn ? 'Services' : 'خدماتنا',
      guides: isEn ? 'Guides' : 'الأدلة',
      calculators: isEn ? 'Calculators' : 'الحاسبات',
      articles: isEn ? 'Insights' : 'مقالات',
      contact: isEn ? 'Contact' : 'تواصل معنا',
      cta: isEn ? 'Book Consultation' : 'احجز استشارة',
      langSwitch: isEn ? 'العربية' : 'EN',
      allServices: isEn ? 'View All Services →' : 'استعراض جميع الخدمات →',
      analysis: isEn ? 'Financial Analysis' : 'التحليل المالي',
      cashflow: isEn ? 'Cash Flow Management' : 'إدارة التدفقات النقدية',
      feasibility: isEn ? 'Feasibility Studies' : 'دراسات الجدوى',
      risk: isEn ? 'Risk Analysis' : 'تحليل المخاطر',
      research: isEn ? 'Surveys & Research' : 'الاستبيانات والبحوث',
      breakEven: isEn ? 'Break-Even' : 'نقطة التعادل',
      cashFlowCalc: isEn ? 'Cash Flow' : 'تدفق النقد',
      pricingCalc: isEn ? 'Pricing' : 'تسعير المنتج',
      loanCalc: isEn ? 'Loan & Finance' : 'القرض والتمويل',
      restaurantCalc: isEn ? 'Restaurants & Cloud' : 'المطاعم والسحابي',
      menuEngCalc: isEn ? 'Menu Engineering' : 'هندسة المنيو',
      feasibilityCalc: isEn ? 'Restaurant Viability' : 'الجدوى المالية للمطعم',
      medicalCalc: isEn ? 'Medical Viability' : 'الجدوى الطبية',
      invoiceCalc: isEn ? 'Invoice Analyzer' : 'تحليل الفواتير',
      templateCalc: isEn ? 'Feasibility Template' : 'نموذج دراسة الجدوى',
      factorySa: isEn ? 'Factory Cost — Saudi' : 'تكلفة المصنع — السعودية',
      factoryEg: isEn ? 'Factory Cost — Egypt' : 'تكلفة المصنع — مصر',
    };

    const langHref = langBase + '../index.html';
    const homeHref = langBase + 'index.html';
    const aboutHref = langBase + 'about.html';
    const servicesHref = langBase + 'services.html';
    const contactHref = langBase + 'contact.html';
    const blogHref = langBase + '../blog/index.html';
    const calcBase = langBase + 'calculators/';
    const calcBreakEven = langBase + 'calculator.html';
    const sectorsBase = langBase + 'sectors/';

    const serviceDropdown = [
      { label: labels.analysis, href: servicesHref + '#analysis' },
      { label: labels.cashflow, href: servicesHref + '#cashflow' },
      { label: labels.feasibility, href: servicesHref + '#feasibility' },
      { label: labels.risk, href: servicesHref + '#risk' },
      { label: labels.research, href: servicesHref + '#research' },
    ];

    const calcDropdown = [
      { label: labels.breakEven, href: calcBreakEven },
      { label: labels.cashFlowCalc, href: calcBase + 'cash-flow.html' },
      { label: labels.pricingCalc, href: calcBase + 'pricing.html' },
      { label: labels.loanCalc, href: calcBase + 'loan.html' },
      { label: labels.restaurantCalc, href: calcBase + 'restaurant.html' },
      { label: labels.menuEngCalc, href: calcBase + 'menu-engineering.html' },
      { label: labels.feasibilityCalc, href: calcBase + 'feasibility.html' },
      { label: labels.medicalCalc, href: calcBase + 'medical-viability.html' },
      { label: labels.invoiceCalc, href: calcBase + 'invoice-analyzer.html' },
      { label: labels.templateCalc, href: calcBase + 'feasibility-template.html' },
      { label: labels.factorySa, href: calcBase + 'factory-cost.html' },
      { label: labels.factoryEg, href: calcBase + 'factory-cost-eg.html' },
    ];

    const guideCountries = [
      { code: 'manufacturing', label: isEn ? 'Saudi Arabia' : 'السعودية', flag: '🏭' },
      { code: 'manufacturing-eg', label: isEn ? 'Egypt' : 'مصر', flag: '🏭' },
      { code: 'manufacturing-ae', label: isEn ? 'UAE' : 'الإمارات', flag: '🏭' },
      { code: 'manufacturing-jo', label: isEn ? 'Jordan' : 'الأردن', flag: '🏭' },
      { code: 'manufacturing-om', label: isEn ? 'Oman' : 'عمان', flag: '🏭' },
      { code: 'manufacturing-bh', label: isEn ? 'Bahrain' : 'البحرين', flag: '🏭' },
      { code: 'manufacturing-kw', label: isEn ? 'Kuwait' : 'الكويت', flag: '🏭' },
      { code: 'manufacturing-qa', label: isEn ? 'Qatar' : 'قطر', flag: '🏭' },
      { code: 'manufacturing-ma', label: isEn ? 'Morocco' : 'المغرب', flag: '🏭' },
      { code: 'manufacturing-tn', label: isEn ? 'Tunisia' : 'تونس', flag: '🏭' },
      { code: 'manufacturing-iq', label: isEn ? 'Iraq' : 'العراق', flag: '🏭' },
      { code: 'manufacturing-sd', label: isEn ? 'Sudan' : 'السودان', flag: '🏭' },
      { code: 'manufacturing-ly', label: isEn ? 'Libya' : 'ليبيا', flag: '🏭' },
      { code: 'manufacturing-dz', label: isEn ? 'Algeria' : 'الجزائر', flag: '🏭' },
      { code: 'manufacturing-lb', label: isEn ? 'Lebanon' : 'لبنان', flag: '🏭' },
      { code: 'manufacturing-ye', label: isEn ? 'Yemen' : 'اليمن', flag: '🏭' },
      { code: 'manufacturing-sy', label: isEn ? 'Syria' : 'سوريا', flag: '🏭' },
    ];

    const caretSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';

    function buildDropdown(items, extraAll) {
      let html = items.map(i => `<a href="${i.href}">${i.label}</a>`).join('');
      if (extraAll) {
        html += `<div style="border-top:1px solid var(--border); margin:0.4rem 0;"></div><a href="${extraAll.href}">${extraAll.label}</a>`;
      }
      return `<div class="dropdown-menu">${html}</div>`;
    }

    const navItems = [
      { href: homeHref, label: labels.home },
      { href: aboutHref, label: labels.about },
      { type: 'dropdown', label: labels.services, items: serviceDropdown, all: { href: servicesHref, label: labels.allServices } },
      { type: 'dropdown', label: labels.guides, items: guideCountries.map(c => ({ href: sectorsBase + c.code + '.html', label: c.flag + ' ' + c.label })) },
      { type: 'dropdown', label: labels.calculators, items: calcDropdown },
      { href: blogHref, label: labels.articles },
      { href: contactHref, label: labels.contact },
    ];

    const navHtml = navItems.map(item => {
      if (item.type === 'dropdown') {
        return `<li class="dropdown"><span class="dropdown-toggle">${item.label} ${caretSvg}</span>${buildDropdown(item.items, item.all)}</li>`;
      }
      return `<li><a href="${item.href}" data-nav="${item.href}">${item.label}</a></li>`;
    }).join('');

    return `
<header class="main-header" id="header">
  <div class="main-header__inner">
    <a href="${homeHref}" class="header-brand">
      <img src="${base}assets/bonds-logo-2026-header.webp?v=2026" alt="${isEn ? 'Bonds' : 'بوندز'}" style="height:60px;" />
    </a>
    <nav class="main-nav" id="mainNav">
      <ul>
        ${navHtml}
      </ul>
    </nav>
    <div class="header-actions">
      <a href="${langHref}" class="lang-switch">${labels.langSwitch}</a>
      <div id="authContainer"></div>
      <a href="${contactHref}" class="btn-header">${labels.cta}</a>
      <button class="nav-toggle" id="navToggle" aria-label="${isEn ? 'Menu' : 'القائمة'}"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
    `.trim();
  }

  function buildFooter(lang, base) {
    const isEn = lang === 'en';
    const langBase = getLangBase(isEn);

    const labels = {
      brandDesc: isEn
        ? 'BONDS<br />Financial & Management Consulting'
        : 'بوندز BONDS<br />للاستشارات المالية والإدارية',
      servicesTitle: isEn ? 'Services' : 'خدماتنا',
      aboutTitle: isEn ? 'About Bonds' : 'عن بوندز',
      knowledgeTitle: isEn ? 'Knowledge Center' : 'المركز المعرفي',
      legalTitle: isEn ? 'Legal' : 'قانوني',
      rights: isEn
        ? 'All rights reserved. Bonds Financial & Management Consulting © 2026'
        : 'جميع الحقوق محفوظة. بوندز للاستشارات المالية والإدارية © 2026',
      privacy: isEn ? 'Privacy Policy' : 'سياسة الخصوصية',
      terms: isEn ? 'Terms of Use' : 'شروط الاستخدام',
    };

    const servicesHref = langBase + 'services.html';
    const aboutHref = langBase + 'about.html';
    const blogHref = langBase + '../blog/index.html';
    const faqHref = langBase + 'faq.html';
    const contactHref = langBase + 'contact.html';
    const privacyHref = langBase + 'privacy.html';
    const termsHref = langBase + 'terms.html';

    return `
<footer class="footer">
  <div class="footer-grid">
    <div class="footer-brand">
      <img src="${base}assets/bonds-logo-2026.webp?v=2026" alt="${isEn ? 'Bonds' : 'بوندز'}" style="height:80px; width:auto; margin-bottom:1rem;" />
      <p>${labels.brandDesc}</p>
    </div>
    <div>
      <div class="footer-title">${labels.servicesTitle}</div>
      <div class="footer-links">
        <a href="${servicesHref}">${isEn ? 'Financial Consulting' : 'الاستشارات المالية'}</a>
        <a href="${servicesHref}">${isEn ? 'Management Consulting' : 'الاستشارات الإدارية'}</a>
        <a href="${servicesHref}#feasibility">${isEn ? 'Feasibility Studies' : 'دراسات الجدوى'}</a>
        <a href="${servicesHref}">${isEn ? 'Business Valuation' : 'تقييم المنشآت'}</a>
        <a href="${servicesHref}">${isEn ? 'Corporate Restructuring' : 'إعادة هيكلة الشركات'}</a>
        <a href="${servicesHref}">${isEn ? 'Risk & Governance' : 'إدارة المخاطر والحوكمة'}</a>
      </div>
    </div>
    <div>
      <div class="footer-title">${labels.aboutTitle}</div>
      <div class="footer-links">
        <a href="${aboutHref}">${isEn ? 'About Us' : 'من نحن'}</a>
        <a href="${aboutHref}">${isEn ? 'Our Values' : 'قيمنا'}</a>
        <a href="${aboutHref}">${isEn ? 'Our Team' : 'فريقنا'}</a>
        <a href="${aboutHref}">${isEn ? 'Partners' : 'شركاؤنا'}</a>
      </div>
    </div>
    <div>
      <div class="footer-title">${labels.knowledgeTitle}</div>
      <div class="footer-links">
        <a href="${blogHref}">${isEn ? 'Articles' : 'المقالات'}</a>
        <a href="${blogHref}">${isEn ? 'Guides & Reports' : 'الأدلة والتقارير'}</a>
        <a href="${faqHref}">${isEn ? 'FAQ' : 'الأسئلة الشائعة'}</a>
      </div>
    </div>
    <div>
      <div class="footer-title">${labels.legalTitle}</div>
      <div class="footer-links">
        <a href="${termsHref}">${labels.terms}</a>
        <a href="${privacyHref}">${labels.privacy}</a>
        <span>+966 11 123 4567</span>
        <span>info@bonds-global.com</span>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <span>${labels.rights}</span>
    <div class="footer-socials">
      <a href="#">in</a>
      <a href="#">X</a>
      <a href="#">📷</a>
    </div>
  </div>
</footer>
    `.trim();
  }

  function setActiveLinks() {
    const path = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    const file = path.split('/').pop() || 'index.html';

    document.querySelectorAll('.main-nav a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const cleanHref = href.split('#')[0].split('?')[0];
      const hrefFile = cleanHref.split('/').pop();
      if (hrefFile && (hrefFile === file || (file === '' && hrefFile === 'index.html'))) {
        a.classList.add('active');
      }
    });

    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
      const menu = toggle.nextElementSibling;
      if (!menu || !menu.classList.contains('dropdown-menu')) return;
      const activeChild = menu.querySelector('a.active');
      if (activeChild) toggle.classList.add('active');
    });
  }

  function ensureLayoutCSS(base) {
    const href = base + 'header-footer.css?v=2';
    if (document.querySelector('link[href*="header-footer.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    const head = document.head || document.querySelector('head');
    if (head) head.appendChild(link);
  }

  function initThemeToggle() {
    if (document.getElementById('themeToggle')) return;
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    const html = document.documentElement;
    const savedTheme = localStorage.getItem('theme');

    function applyTheme(theme) {
      if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
      } else {
        html.removeAttribute('data-theme');
      }
    }

    if (savedTheme) applyTheme(savedTheme);

    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.textContent = html.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    btn.style.cssText = 'background:transparent;border:1px solid var(--border);border-radius:8px;padding:0.4rem 0.6rem;cursor:pointer;font-size:1rem;color:var(--text-secondary);';

    btn.addEventListener('click', function () {
      const isDark = html.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      applyTheme(next);
      btn.textContent = next === 'dark' ? '☀️' : '🌙';
      localStorage.setItem('theme', next);
    });

    headerActions.insertBefore(btn, headerActions.firstChild);
  }

  function shouldNoPrint() {
    return document.querySelector('.template-toolbar, .progress-bar.no-print') !== null;
  }

  function adjustLayoutForFixedHeader() {
    const header = document.getElementById('header');
    const topbar = document.querySelector('.topbar');
    if (!header) return;

    // Old standalone topbar is redundant once the unified fixed header is injected
    if (topbar) topbar.style.display = 'none';

    function setPadding() {
      const height = header.offsetHeight || 70;
      document.body.style.paddingTop = height + 'px';
    }
    setPadding();
    window.addEventListener('resize', debounce(setPadding, 150));
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  function inject() {
    const lang = detectLang();
    const base = getBase();
    ensureLayoutCSS(base);

    const noPrint = shouldNoPrint();
    const headerContainer = document.getElementById('site-header');
    const footerContainer = document.getElementById('site-footer');

    if (headerContainer) {
      headerContainer.innerHTML = buildHeader(lang, base);
      if (noPrint) headerContainer.classList.add('no-print');
      const navToggle = document.getElementById('navToggle');
      const mainNav = document.getElementById('mainNav');
      if (navToggle && mainNav) {
        navToggle.addEventListener('click', function () {
          mainNav.classList.toggle('is-open');
          navToggle.setAttribute('aria-expanded', mainNav.classList.contains('is-open'));
        });
      }
      adjustLayoutForFixedHeader();
    }

    if (footerContainer) {
      footerContainer.innerHTML = buildFooter(lang, base);
      if (noPrint) footerContainer.classList.add('no-print');
    }

    setActiveLinks();

    if (window.BondsAuth && window.BondsAuth.initSiteAuth) {
      window.BondsAuth.initSiteAuth('authContainer');
    }

    initThemeToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
