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
    // Keep trailing slash so directory index pages (e.g. /valuation/) get the
    // correct depth and relative paths resolve to the parent directory.
    const path = window.location.pathname.replace(/^\/+/, '');
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

  function detectDir() {
    const html = document.documentElement;
    if (html && html.dir) return html.dir.toLowerCase();
    return detectLang() === 'en' ? 'ltr' : 'rtl';
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
      intelligence: isEn ? 'Intelligence' : 'الذكاء الاقتصادي',
      articles: isEn ? 'Insights' : 'مقالات',
      cityIntelligence: isEn ? 'City Intelligence' : 'ذكاء المدن',
      cityComparison: isEn ? 'City Comparison' : 'مقارنة المدن',
      investmentMap: isEn ? 'Investment Map' : 'الخريطة الاستثمارية',
      projectReadiness: isEn ? 'Project Readiness' : 'جاهزية المشروع',
      opportunityBank: isEn ? 'Opportunity Bank' : 'بنك الفرص',
      scenariosEngine: isEn ? 'Scenarios' : 'محرك السيناريوهات',
      fundingSources: isEn ? 'Funding' : 'التمويل',
      contact: isEn ? 'Contact' : 'تواصل معنا',
      cta: isEn ? 'Start Now' : 'ابدأ الآن',
      clientPortal: isEn ? 'Client Portal' : 'بوابة العميل',
      accountLabel: isEn ? 'Account' : 'الحساب',
      caseStudies: isEn ? 'Case Studies' : 'دراسات الحالة',
      langSwitch: isEn ? 'العربية' : 'EN',
      allServices: isEn ? 'View All Services →' : 'استعراض جميع الخدمات →',
      analysis: isEn ? 'Financial Analysis' : 'التحليل المالي',
      cashflow: isEn ? 'Cash Flow Management' : 'إدارة التدفقات النقدية',
      feasibility: isEn ? 'Feasibility Studies' : 'دراسات الجدوى',
      risk: isEn ? 'Risk Analysis' : 'تحليل المخاطر',
      research: isEn ? 'Surveys & Research' : 'الاستبيانات والبحوث',
      projectRescue: isEn ? 'Project Rescue' : 'إحياء المشاريع',
      breakEven: isEn ? 'Break-Even' : 'نقطة التعادل',
      projectWizard: isEn ? 'Project Feasibility Wizard' : 'معالج جدوى المشاريع',
      investmentCenter: isEn ? 'Investment Center' : 'مركز الحاسبات الاستثمارية',
      cashFlowCalc: isEn ? 'Cash Flow' : 'تدفق النقد',
      pricingCalc: isEn ? 'Pricing' : 'تسعير المنتج',
      loanCalc: isEn ? 'Loan & Finance' : 'القرض والتمويل',
      restaurantCalc: isEn ? 'Restaurants & Cloud' : 'المطاعم والسحابي',
      menuEngCalc: isEn ? 'Menu Engineering' : 'هندسة المنيو',
      feasibilityCalc: isEn ? 'Restaurant Viability' : 'الجدوى المالية للمطعم',
      medicalCalc: isEn ? 'Medical Viability' : 'الجدوى الطبية',
      invoiceCalc: isEn ? 'Invoice Analyzer' : 'تحليل الفواتير',
      templateCalc: isEn ? 'Feasibility Template' : 'نموذج دراسة الجدوى',
      valuation: isEn ? 'Valuation' : 'التقييم',
      creditworthinessCalc: isEn ? 'Credit Rating' : 'تقييم الجدارة الائتمانية',
      factorySa: isEn ? 'Factory Cost — Saudi' : 'تكلفة المصنع — السعودية',
      factoryEg: isEn ? 'Factory Cost — Egypt' : 'تكلفة المصنع — مصر',
      pricingFeasibilityGroup: isEn ? 'Pricing & Feasibility' : 'التسعير والجدوى',
      financialAnalysisGroup: isEn ? 'Financial Analysis' : 'التحليل المالي',
    };

    const langHref = langBase + '../index.html';
    const homeHref = langBase + 'index.html';
    const aboutHref = langBase + 'about.html';
    const caseStudiesHref = langBase + 'case-studies.html';
    const servicesHref = langBase + 'services.html';
    const contactHref = langBase + 'contact.html';
    const blogHref = langBase + '../blog/index.html';
    const valuationHref = langBase + 'valuation/index.html';
    const clientPortalHref = isEn ? '/en/v3/portfolio' : '/v3/portfolio';
    const v3Base = 'v3/';
    const fundingReadinessHref = langBase + 'calculators/creditworthiness.html';
    const cityIntelligenceHref = '/' + v3Base + 'city-intelligence.html';
    const projectRescueHref = langBase + 'project-rescue.html';
    const calcBase = langBase + 'calculators/';
    const calcBreakEven = langBase + 'calculator.html';
    const sectorsBase = langBase + 'sectors/';

    const serviceDropdown = [
      { label: labels.analysis, href: servicesHref + '#analysis' },
      { label: labels.cashflow, href: servicesHref + '#cashflow' },
      { label: labels.feasibility, href: servicesHref + '#feasibility' },
      { label: labels.risk, href: servicesHref + '#risk' },
      { label: labels.research, href: servicesHref + '#research' },
      { label: labels.projectRescue, href: projectRescueHref },
    ];

    // Navigation dropdown data is kept intentionally minimal; deep calculator lists
    // live on the dedicated calculators landing pages to avoid cognitive overload.

    const calcDropdown = [
      {
        heading: { ar: 'الأدوات الرئيسية', en: 'Main Tools' },
        items: [
          { label: labels.investmentCenter, href: calcBase + 'investment-center/index.html' },
          { label: labels.projectWizard, href: langBase + 'calculator-wizard.html' },
          { label: labels.breakEven, href: calcBreakEven },
        ],
      },
      {
        heading: { ar: labels.financialAnalysisGroup, en: 'Financial Analysis' },
        items: [
          { label: labels.cashFlowCalc, href: calcBase + 'cash-flow.html' },
          { label: labels.loanCalc, href: calcBase + 'loan.html' },
          { label: labels.creditworthinessCalc, href: calcBase + 'creditworthiness.html' },
          { label: labels.invoiceCalc, href: calcBase + 'invoice-analyzer.html' },
        ],
      },
      {
        heading: { ar: labels.pricingFeasibilityGroup, en: 'Pricing & Feasibility' },
        items: [
          { label: labels.pricingCalc, href: calcBase + 'pricing.html' },
          { label: labels.templateCalc, href: calcBase + 'feasibility-template.html' },
        ],
      },
    ];

    const intelligenceDropdown = [
      { label: labels.cityIntelligence, href: '/' + v3Base + 'city-intelligence' },
      { label: labels.cityComparison, href: '/' + v3Base + 'city-comparison' },
      { label: labels.investmentMap, href: '/' + v3Base + 'investment-map' },
      { label: labels.projectReadiness, href: '/' + v3Base + 'project-readiness' },
      { label: labels.opportunityBank, href: '/' + v3Base + 'opportunity-bank' },
      { label: labels.scenariosEngine, href: '/' + v3Base + 'scenarios' },
    ];

    const caretSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';

    function buildDropdown(items, extraAll, isLarge) {
      const isGrouped = Array.isArray(items) && items.length > 0 && Array.isArray(items[0].items);
      let html = '';
      if (isGrouped) {
        html = items.map(g => {
          const heading = isEn ? g.heading.en : g.heading.ar;
          const links = g.items.map(i => `<a href="${i.href}">${i.label}</a>`).join('');
          return `<div class="dropdown-group"><div class="dropdown-group__heading">${heading}</div>${links}</div>`;
        }).join('');
      } else {
        html = items.map(i => `<a href="${i.href}">${i.label}</a>`).join('');
      }
      if (extraAll) {
        html += `<div class="dropdown-menu__divider"></div><a href="${extraAll.href}">${extraAll.label}</a>`;
      }
      const cls = isGrouped
        ? 'dropdown-menu dropdown-menu--grouped'
        : (isLarge ? 'dropdown-menu dropdown-menu--large' : 'dropdown-menu');
      return `<div class="${cls}">${html}</div>`;
    }

    const navItems = [
      { href: homeHref, label: labels.home },
      { type: 'dropdown', label: labels.services, items: serviceDropdown, all: { href: servicesHref, label: labels.allServices } },
      { type: 'dropdown', label: labels.calculators, items: calcDropdown, all: { href: calcBase + 'investment-center/index.html', label: isEn ? 'All Calculators →' : 'جميع الحاسبات →' } },
      { type: 'dropdown', label: labels.intelligence, items: intelligenceDropdown },
      { href: contactHref, label: labels.contact },
    ];

    const navHtml = navItems.map(item => {
      if (item.type === 'dropdown') {
        return `<li class="dropdown"><button type="button" class="dropdown-toggle" aria-expanded="false" aria-haspopup="true">${item.label} ${caretSvg}</button>${buildDropdown(item.items, item.all, item.isLarge)}</li>`;
      }
      return `<li><a href="${item.href}" data-nav="${item.href}">${item.label}</a></li>`;
    }).join('');

    return `
<header class="main-header" id="header">
  <div class="main-header__inner">
    <a href="${homeHref}" class="header-brand">
      <img src="/assets/bonds-logo-2026-v2.png?v=2026b" alt="${isEn ? 'Bonds' : 'بوندز'}" style="height:60px;" />
    </a>
    <nav class="main-nav" id="mainNav">
      <ul>
        ${navHtml}
      </ul>
    </nav>
    <div class="header-actions">
      <a href="${langHref}" class="lang-switch" aria-label="${isEn ? 'Switch to Arabic' : 'Switch to English'}">${labels.langSwitch}</a>
      <div id="authContainer" class="header-account-wrap">
        <a href="${clientPortalHref}" class="header-account" aria-label="${labels.accountLabel}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
        </a>
      </div>
      <a href="${clientPortalHref}" class="btn-header">${labels.cta}</a>
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
    const caseStudiesHref = langBase + 'case-studies.html';
    const projectRescueHref = langBase + 'project-rescue.html';
    const blogHref = langBase + '../blog/index.html';
    const faqHref = langBase + 'faq.html';
    const contactHref = langBase + 'contact.html';
    const clientPortalHref = isEn ? '/en/v3/portfolio' : '/v3/portfolio';
    const privacyHref = langBase + 'privacy.html';
    const termsHref = langBase + 'terms.html';

    return `
<footer class="footer">
  <div class="footer-grid">
    <div class="footer-brand">
      <img src="/assets/bonds-logo-2026-v2.png?v=2026b" alt="${isEn ? 'Bonds' : 'بوندز'}" style="height:80px; width:auto; margin-bottom:1rem;" />
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
        <a href="${projectRescueHref}">${isEn ? 'Project Rescue' : 'إحياء المشاريع المتعثرة'}</a>
        <a href="${servicesHref}">${isEn ? 'Risk & Governance' : 'إدارة المخاطر والحوكمة'}</a>
      </div>
    </div>
    <div>
      <div class="footer-title">${labels.aboutTitle}</div>
      <div class="footer-links">
        <a href="${aboutHref}">${isEn ? 'About Us' : 'من نحن'}</a>
        <a href="${caseStudiesHref}">${isEn ? 'Case Studies' : 'دراسات الحالة'}</a>
        <a href="${aboutHref}">${isEn ? 'Our Values' : 'قيمنا'}</a>
        <a href="${aboutHref}">${isEn ? 'Our Team' : 'فريقنا'}</a>
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
      <div class="footer-title">${isEn ? 'Clients' : 'العملاء'}</div>
      <div class="footer-links">
        <a href="${clientPortalHref}">${isEn ? 'Client Portal' : 'بوابة العميل'}</a>
        <a href="${contactHref}">${isEn ? 'Request Service' : 'طلب خدمة'}</a>
      </div>
    </div>
    <div>
      <div class="footer-title">${labels.legalTitle}</div>
      <div class="footer-links">
        <a href="${termsHref}">${labels.terms}</a>
        <a href="${privacyHref}">${labels.privacy}</a>
        <a href="https://wa.me/966567566616" target="_blank" rel="noopener">+966 56 756 6616</a>
        <span>info@bonds-global.com</span>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <span>${labels.rights}</span>
    <div class="footer-socials">
      <a href="https://www.linkedin.com/company/bonds-global" target="_blank" rel="noopener" aria-label="LinkedIn">in</a>
      <a href="https://x.com/bonds_global" target="_blank" rel="noopener" aria-label="X">X</a>
      <a href="https://instagram.com/bonds.global" target="_blank" rel="noopener" aria-label="Instagram">📷</a>
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

  function ensureLayoutCSS() {
    const href = '/header-footer.css?v=11';
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

    const isEn = detectLang() === 'en';
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
    btn.title = isEn ? 'Toggle theme' : 'تبديل الوضع';
    btn.textContent = html.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';

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
      // Measure after layout/CSS settle; cap to avoid inflated heights from
      // temporarily visible dropdown markup before styles apply.
      const height = Math.min(header.offsetHeight || 70, 120);
      document.body.style.paddingTop = height + 'px';
    }

    // Initial measure may run before CSS hides large dropdown lists, so defer.
    if (document.readyState === 'complete') {
      setPadding();
    } else {
      window.addEventListener('load', setPadding, { once: true });
      requestAnimationFrame(() => setTimeout(setPadding, 0));
    }

    window.addEventListener('resize', debounce(setPadding, 150));

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(debounce(setPadding, 100));
      ro.observe(header);
    }
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
    ensureLayoutCSS();

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

      // Dropdown toggle handling for touch/mobile and accessibility
      const isTouch = window.matchMedia('(pointer: coarse)').matches;
      document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        const dropdown = toggle.closest('.dropdown');
        if (!dropdown) return;

        toggle.addEventListener('click', function (e) {
          if (window.innerWidth > 900 && !isTouch) return; // desktop hover handles it
          e.preventDefault();
          const wasOpen = dropdown.classList.contains('is-open');
          document.querySelectorAll('.dropdown.is-open').forEach(d => {
            d.classList.remove('is-open');
            const t = d.querySelector('.dropdown-toggle');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
          dropdown.classList.toggle('is-open', !wasOpen);
          toggle.setAttribute('aria-expanded', String(!wasOpen));
        });

        toggle.addEventListener('mouseenter', function () {
          if (window.innerWidth <= 900) return;
          toggle.setAttribute('aria-expanded', 'true');
        });
        dropdown.addEventListener('mouseleave', function () {
          if (window.innerWidth <= 900) return;
          toggle.setAttribute('aria-expanded', 'false');
        });
      });

      // Close dropdowns and mobile nav when clicking outside
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.dropdown')) {
          document.querySelectorAll('.dropdown.is-open').forEach(d => {
            d.classList.remove('is-open');
            const t = d.querySelector('.dropdown-toggle');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
        }
        if (mainNav && !e.target.closest('.main-header')) {
          mainNav.classList.remove('is-open');
          if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
        }
      });

      // Close mobile nav when a nav link is clicked
      if (mainNav) {
        mainNav.querySelectorAll('a').forEach(link => {
          link.addEventListener('click', function () {
            mainNav.classList.remove('is-open');
            if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
          });
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
