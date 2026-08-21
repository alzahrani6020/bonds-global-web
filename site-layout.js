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
      financialAdvisory: isEn ? 'Financial Advisory' : 'الاستشارات المالية',
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
      login: isEn ? 'Login' : 'تسجيل الدخول',
      signup: isEn ? 'Sign Up' : 'تسجيل جديد',
      clientPortal: isEn ? 'Client Portal' : 'بوابة العميل',
      accountLabel: isEn ? 'Account' : 'الحساب',
      caseStudies: isEn ? 'Case Studies' : 'دراسات الحالة',
      langSwitch: isEn ? 'العربية' : 'EN',
      allServices: isEn ? 'View All Services →' : 'استعراض جميع الخدمات →',
      analysis: isEn ? 'Financial Analysis' : 'التحليل المالي',
      cashflow: isEn ? 'Cash Flow Management' : 'إدارة التدفقات النقدية',
      budgets: isEn ? 'Budgeting & Forecasting' : 'الموازنات والتقديرات',
      feasibility: isEn ? 'Feasibility Studies' : 'دراسات الجدوى',
      risk: isEn ? 'Risk Analysis' : 'تحليل المخاطر',
      strategy: isEn ? 'Financial Strategy' : 'الاستراتيجية المالية',
      operations: isEn ? 'Operational Consulting' : 'استشارات تشغيلية',
      research: isEn ? 'Surveys & Research' : 'الاستبيانات والبحوث',
      projectRescue: isEn ? 'Project Rescue' : 'إحياء المشاريع',
      fundingExtraction: isEn ? 'Funding Extraction' : 'استخراج التمويل',
      fundingHub: isEn ? 'Funding & Investment' : 'التمويل والاستثمار',
      investmentOpportunities: isEn ? 'Investment Opportunities' : 'فرص استثمارية',
      fundingSources: isEn ? 'Funding Sources' : 'مصادر التمويل',
      fundingReadiness: isEn ? 'Funding Readiness' : 'جاهزية التمويل',
      breakEven: isEn ? 'Break-Even' : 'نقطة التعادل',
      projectWizard: isEn ? 'Project Feasibility Wizard' : 'معالج جدوى المشاريع',
      investmentCenter: isEn ? 'Investment Center' : 'مركز الحاسبات الاستثمارية',
      cashFlowCalc: isEn ? 'Cash Flow' : 'تدفق النقد',
      pricingCalc: isEn ? 'Pricing' : 'تسعير المنتج',
      loanCalc: isEn ? 'Loan & Finance' : 'القرض والتمويل',
      roiCalc: isEn ? 'ROI Calculator' : 'عائد الاستثمار',
      restaurantCalc: isEn ? 'Restaurants & Cloud' : 'المطاعم والسحابي',
      menuEngCalc: isEn ? 'Menu Engineering' : 'هندسة المنيو',
      feasibilityCalc: isEn ? 'Restaurant Viability' : 'الجدوى المالية للمطعم',
      medicalCalc: isEn ? 'Medical Viability' : 'الجدوى الطبية',
      invoiceCalc: isEn ? 'Invoice Analyzer' : 'تحليل الفواتير',
      templateCalc: isEn ? 'Feasibility Template' : 'نموذج دراسة الجدوى',
      manufacturingFeasibilityCalc: isEn ? 'Manufacturing Feasibility' : 'الجدوى المالية للمصنع',
      valuation: isEn ? 'Valuation' : 'التقييم',
      creditworthinessCalc: isEn ? 'Credit Rating' : 'تقييم الجدارة الائتمانية',
      realProjectAnalysis: isEn ? 'Real Project Analysis' : 'تحليل المشروع الحقيقي',
      search: isEn ? 'Search' : 'بحث',
      factorySa: isEn ? 'Factory Cost — Saudi' : 'تكلفة المصنع — السعودية',
      factoryEg: isEn ? 'Factory Cost — Egypt' : 'تكلفة المصنع — مصر',
      pricingFeasibilityGroup: isEn ? 'Pricing & Feasibility' : 'التسعير والجدوى',
      financialAnalysisGroup: isEn ? 'Financial Analysis' : 'التحليل المالي',
    };

    const currentPath = window.location.pathname;
    const currentSearch = window.location.search || '';
    const langHref = isEn
      ? (currentPath.replace(/^\/en\//, '/').replace(/\/$/, '/index.html') || '/index.html') + currentSearch
      : '/en' + currentPath + currentSearch;
    const homeHref = langBase + 'index.html';
    const aboutHref = langBase + 'about.html';
    const caseStudiesHref = langBase + 'case-studies.html';
    const servicesHref = langBase + 'services.html';
    const contactHref = langBase + 'contact.html';
    const blogHref = langBase + '../blog/index.html';
    const valuationHref = langBase + 'valuation/index.html';
    const clientPortalHref = isEn ? '/en/my-bonds/' : '/my-bonds/';
    const loginHref = langBase + 'calculators/auth/login.html';
    const signupHref = langBase + 'calculators/auth/index.html?tab=signup';
    const searchHref = langBase + 'search.html';
    const v3Base = 'v3/';
    const fundingReadinessHref = langBase + 'funding-readiness.html';
    const fundingSourcesHref = langBase + 'funding-sources.html';
    const fundingHubHref = langBase + 'funding.html';
    const investmentOpportunitiesHref = langBase + 'investment-opportunities.html';
    const cityIntelligenceHref = '/' + v3Base + 'city-intelligence.html';
    const projectRescueHref = langBase + 'project-rescue.html';
    const fundingExtractionHref = langBase + 'funding-extraction.html';
    const calcBase = langBase + 'calculators/';
    const calcBreakEven = calcBase + 'break-even.html';
    const sectorsBase = langBase + 'sectors/';

    const serviceDropdown = [
      { label: labels.financialAdvisory, href: servicesHref },
      { label: labels.analysis, href: servicesHref + '#analysis' },
      { label: labels.cashflow, href: servicesHref + '#cashflow' },
      { label: labels.budgets, href: servicesHref + '#budgets' },
      { label: labels.feasibility, href: servicesHref + '#feasibility' },
      { label: labels.risk, href: servicesHref + '#risk' },
      { label: labels.strategy, href: servicesHref + '#strategy' },
      { label: labels.operations, href: servicesHref + '#operations' },
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
          { label: labels.roiCalc, href: calcBase + 'roi.html' },
          { label: labels.creditworthinessCalc, href: calcBase + 'creditworthiness.html' },
          { label: labels.realProjectAnalysis, href: calcBase + 'real-project-analysis.html' },
          { label: labels.invoiceCalc, href: calcBase + 'invoice-analyzer.html' },
        ],
      },
      {
        heading: { ar: labels.pricingFeasibilityGroup, en: 'Pricing & Feasibility' },
        items: [
          { label: labels.pricingCalc, href: calcBase + 'pricing.html' },
          { label: labels.templateCalc, href: calcBase + 'feasibility-template.html' },
          { label: labels.manufacturingFeasibilityCalc, href: calcBase + 'manufacturing-feasibility.html' },
        ],
      },
      {
        heading: { ar: 'حاسبات متخصصة', en: 'Specialized Calculators' },
        items: [
          { label: labels.restaurantCalc, href: calcBase + 'restaurant.html' },
          { label: labels.menuEngCalc, href: calcBase + 'menu-engineering.html' },
          { label: labels.medicalCalc, href: calcBase + 'medical-viability.html' },
          { label: labels.valuation, href: langBase + 'valuation/index.html' },
        ],
      },
    ];

    const fundingDropdown = [
      { label: labels.fundingHub, href: fundingHubHref },
      { label: labels.fundingExtraction, href: fundingExtractionHref },
      { label: labels.fundingSources, href: fundingSourcesHref },
      { label: labels.fundingReadiness, href: fundingReadinessHref },
      { label: labels.investmentOpportunities, href: investmentOpportunitiesHref },
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
      { type: 'dropdown', label: labels.fundingHub, items: fundingDropdown, highlight: true },
      { type: 'dropdown', label: labels.calculators, items: calcDropdown, all: { href: calcBase + 'investment-center/index.html', label: isEn ? 'All Calculators →' : 'جميع الحاسبات →' } },
      { type: 'dropdown', label: labels.intelligence, items: intelligenceDropdown },
      { href: contactHref, label: labels.contact },
    ];

    const navHtml = navItems.map(item => {
      if (item.type === 'dropdown') {
        const highlightClass = item.highlight ? ' nav-highlight' : '';
        return `<li class="dropdown"><button type="button" class="dropdown-toggle${highlightClass}" aria-expanded="false" aria-haspopup="true">${item.label} ${caretSvg}</button>${buildDropdown(item.items, item.all, item.isLarge)}</li>`;
      }
      const highlightClass = item.highlight ? ' nav-highlight' : '';
      return `<li><a href="${item.href}" data-nav="${item.href}" class="${highlightClass}">${item.label}</a></li>`;
    }).join('');

    return `
<header class="main-header" id="header">
  <div class="main-header__inner">
    <a href="${homeHref}" class="header-brand">
      <img src="/assets/bonds-logo-2026-v2-sm.webp?v=2026b" alt="${isEn ? 'Bonds' : 'بوندز'}" style="height:60px;" />
    </a>
    <nav class="main-nav" id="mainNav">
      <ul>
        ${navHtml}
      </ul>
    </nav>
    <div class="header-actions">
      <a href="${searchHref}" class="header-search" aria-label="${labels.search}" title="${labels.search}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      </a>
      <a href="${clientPortalHref}" class="btn-header" id="headerCtaBtn">${labels.cta}</a>
      <a href="${signupHref}" class="header-signup" id="headerSignupBtn">${labels.signup}</a>
      <a href="${loginHref}" class="header-login" id="headerLoginBtn">${labels.login}</a>
      <div id="authContainer" class="header-account-wrap">
        <a href="${clientPortalHref}" class="header-account" aria-label="${labels.accountLabel}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
        </a>
      </div>
      <a href="${langHref}" class="lang-switch" aria-label="${isEn ? 'Switch to Arabic' : 'Switch to English'}">${labels.langSwitch}</a>
      <button class="nav-toggle" id="navToggle" aria-label="${isEn ? 'Menu' : 'القائمة'}"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
    `.trim();
  }

  function buildFooter(lang, base) {
    const isEn = lang === 'en';
    const langBase = getLangBase(isEn);
    const env = window.__ENV || {};
    const socialUrls = {
      linkedin: env.SOCIAL_LINKEDIN_URL || 'https://www.linkedin.com/company/bonds-global',
      x: env.SOCIAL_X_URL || 'https://x.com/bonds_global',
      instagram: env.SOCIAL_INSTAGRAM_URL || 'https://instagram.com/bonds.global',
      youtube: env.SOCIAL_YOUTUBE_URL || 'https://www.youtube.com/@bondsglobal',
    };

    const labels = {
      brandDesc: isEn
        ? 'BONDS<br />Financial & Management Consulting'
        : 'بوندز BONDS<br />للاستشارات المالية والإدارية',
      servicesTitle: isEn ? 'Services' : 'خدماتنا',
      aboutTitle: isEn ? 'About Bonds' : 'عن بوندز',
      knowledgeTitle: isEn ? 'Knowledge Center' : 'المركز المعرفي',
      legalTitle: isEn ? 'Legal' : 'قانوني',
      partnersTitle: isEn ? 'Partners' : 'شركاؤنا',
      rights: isEn
        ? 'All rights reserved. Bonds Financial & Management Consulting © 2026'
        : 'جميع الحقوق محفوظة. بوندز للاستشارات المالية والإدارية © 2026',
      privacy: isEn ? 'Privacy Policy' : 'سياسة الخصوصية',
      terms: isEn ? 'Terms of Use' : 'شروط الاستخدام',
    };

    const servicesHref = langBase + 'services.html';
    const fundingHubHref = langBase + 'funding.html';
    const fundingExtractionHref = langBase + 'funding-extraction.html';
    const fundingSourcesHref = langBase + 'funding-sources.html';
    const fundingReadinessHref = langBase + 'funding-readiness.html';
    const investmentOpportunitiesHref = langBase + 'investment-opportunities.html';
    const aboutHref = langBase + 'about.html';
    const caseStudiesHref = langBase + 'case-studies.html';
    const projectRescueHref = langBase + 'project-rescue.html';
    const blogHref = isEn ? langBase + '../blog/en/index.html' : langBase + '../blog/index.html';
    const reportsHref = isEn ? langBase + 'reports/index.html' : langBase + '../reports/index.html';
    const faqHref = langBase + 'faq.html';
    const contactHref = langBase + 'contact.html';
    const clientPortalHref = isEn ? '/en/my-bonds/' : '/my-bonds/';
    const privacyHref = langBase + 'privacy.html';
    const termsHref = langBase + 'terms.html';

    return `
<footer class="footer">
  <div class="footer-grid">
    <div class="footer-brand">
      <img src="/assets/bonds-logo-2026-v2-sm.webp?v=2026b" alt="${isEn ? 'Bonds' : 'بوندز'}" style="height:80px; width:auto; margin-bottom:1rem;" />
      <p>${labels.brandDesc}</p>
    </div>
    <div>
      <div class="footer-title">${labels.servicesTitle}</div>
      <div class="footer-links">
        <a href="${homeHref}">${isEn ? 'Financial Advisory' : 'الاستشارات المالية'}</a>
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
      <div class="footer-title">${isEn ? 'Funding & Investment' : 'التمويل والاستثمار'}</div>
      <div class="footer-links">
        <a href="${fundingHubHref}">${isEn ? 'Funding & Investment Hub' : 'بوابة التمويل والاستثمار'}</a>
        <a href="${fundingExtractionHref}">${isEn ? 'Funding Extraction' : 'استخراج التمويل'}</a>
        <a href="${fundingSourcesHref}">${isEn ? 'Funding Sources' : 'مصادر التمويل'}</a>
        <a href="${fundingReadinessHref}">${isEn ? 'Funding Readiness' : 'جاهزية التمويل'}</a>
        <a href="${investmentOpportunitiesHref}">${isEn ? 'Investment Opportunities' : 'فرص استثمارية'}</a>
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
        <a href="${reportsHref}">${isEn ? 'Guides & Reports' : 'الأدلة والتقارير'}</a>
        <a href="${faqHref}">${isEn ? 'FAQ' : 'الأسئلة الشائعة'}</a>
      </div>
    </div>
    <div>
      <div class="footer-title">${isEn ? 'Clients' : 'العملاء'}</div>
      <div class="footer-links">
        <a href="${clientPortalHref}">${isEn ? 'My Bonds' : 'مساحتي'}</a>
        <a href="${contactHref}">${isEn ? 'Request Service' : 'طلب خدمة'}</a>
      </div>
    </div>
    <div>
      <div class="footer-title">${labels.partnersTitle}</div>
      <div class="footer-links">
        <a href="https://thiqqah.live/" target="_blank" rel="noopener noreferrer">${isEn ? 'Thiqqah Al-Dhahabiya' : 'ثقة الذهبية'}</a>
        <a href="https://afaq-global.com/" target="_blank" rel="noopener noreferrer">${isEn ? 'Afaq Creative Production' : 'آفاق الإبداعية'}</a>
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
      <a href="${socialUrls.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.98 3.5C4.98 4.881 3.87 6 2.5 6S.02 4.881.02 3.5C.02 2.12 1.13 1 2.5 1s2.48 1.12 2.48 2.5zM.02 8h5V24h-5V8zm8 0h4.8v2.2h.07c.67-1.27 2.3-2.6 4.73-2.6 5.06 0 6 3.33 6 7.65V24h-5v-7.1c0-1.7-.03-3.88-2.36-3.88-2.36 0-2.72 1.85-2.72 3.75V24h-5.52V8z"/></svg></a>
      <a href="${socialUrls.x}" target="_blank" rel="noopener" aria-label="X"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
      <a href="${socialUrls.instagram}" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a>
      <a href="${socialUrls.youtube}" target="_blank" rel="noopener" aria-label="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
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
    const href = '/header-footer.css?v=2.63.0';
    if (document.querySelector('link[href*="header-footer.css?v=2.63.0"]')) return;
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
      // Design tokens: default :root is DARK; light is opt-in via data-theme="light".
      html.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    }

    if (savedTheme) applyTheme(savedTheme);

    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.title = isEn ? 'Toggle theme' : 'تبديل الوضع';
    btn.innerHTML = html.getAttribute('data-theme') !== 'light' ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/></svg>" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#FFD983\" d=\"M30.312.776C32 19 20 32 .776 30.312c8.199 7.717 21.091 7.588 29.107-.429C37.9 21.867 38.03 8.975 30.312.776z\"/><path d=\"M30.705 15.915c-.453.454-.453 1.189 0 1.644.454.453 1.189.453 1.643 0 .454-.455.455-1.19 0-1.644-.453-.454-1.189-.454-1.643 0zm-16.022 14.38c-.682.681-.682 1.783 0 2.465.68.682 1.784.682 2.464 0 .681-.682.681-1.784 0-2.465-.68-.682-1.784-.682-2.464 0zm13.968-2.147c-1.135 1.135-2.974 1.135-4.108 0-1.135-1.135-1.135-2.975 0-4.107 1.135-1.136 2.974-1.136 4.108 0 1.135 1.133 1.135 2.973 0 4.107z\" fill=\"#FFCC4D\"/></svg>";

    btn.addEventListener('click', function () {
      const isDark = html.getAttribute('data-theme') !== 'light';
      const next = isDark ? 'light' : 'dark';
      applyTheme(next);
      btn.innerHTML = next === 'dark' ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/></svg>" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#FFD983\" d=\"M30.312.776C32 19 20 32 .776 30.312c8.199 7.717 21.091 7.588 29.107-.429C37.9 21.867 38.03 8.975 30.312.776z\"/><path d=\"M30.705 15.915c-.453.454-.453 1.189 0 1.644.454.453 1.189.453 1.643 0 .454-.455.455-1.19 0-1.644-.453-.454-1.189-.454-1.643 0zm-16.022 14.38c-.682.681-.682 1.783 0 2.465.68.682 1.784.682 2.464 0 .681-.682.681-1.784 0-2.465-.68-.682-1.784-.682-2.464 0zm13.968-2.147c-1.135 1.135-2.974 1.135-4.108 0-1.135-1.135-1.135-2.975 0-4.107 1.135-1.136 2.974-1.136 4.108 0 1.135 1.133 1.135 2.973 0 4.107z\" fill=\"#FFCC4D\"/></svg>";
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

  function applyCalendlyUrl() {
    try {
      const env = window.__ENV || {};
      const url = env.CALENDLY_URL || '';
      if (!url || url.indexOf('calendly.com') === -1) return;
      document.querySelectorAll('a[href="/book"], a[href="/en/book"], a[href*="calendly.com/iiffund-dev/30min"]').forEach(a => {
        a.href = url;
      });
    } catch (e) {}
  }

  function buildSkipLink(lang) {
    const isEn = lang === 'en';
    const text = isEn ? 'Skip to main content' : 'تخطي إلى المحتوى الرئيسي';
    return `<a href="#main-content" class="skip-link" style="position:absolute;left:0;top:-44px;z-index:10000;padding:12px 18px;background:linear-gradient(90deg,#f0c96a,#d4a853);color:#0a0f1a;font-weight:700;text-decoration:none;border-radius:0 0 12px 0;transition:top .2s;" onfocus="this.style.top='0'" onblur="this.style.top='-44px'">${text}</a>`;
  }

  function inject() {
    const lang = detectLang();
    const base = getBase();
    ensureLayoutCSS();

    // Ensure <main> has an id for skip-link targeting
    const mainEl = document.querySelector('main');
    if (mainEl && !mainEl.id) mainEl.id = 'main-content';

    const noPrint = shouldNoPrint();
    const headerContainer = document.getElementById('site-header');
    const footerContainer = document.getElementById('site-footer');

    if (headerContainer) {
      headerContainer.insertAdjacentHTML('beforebegin', buildSkipLink(lang));
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

    // Branded chat button (WhatsApp) — replaces Tawk.to and the old WhatsApp float
    if (!location.pathname.startsWith('/admin') && !noPrint) {
      const waNumber = '966567566616';
      const waLabel = lang === 'en' ? 'Chat with us on WhatsApp' : 'تواصل معنا عبر واتساب';
      const waText = encodeURIComponent(lang === 'en' ? 'Hello Bonds Global, I have a question.' : 'مرحباً بوندز، عندي سؤال.');
      const chatBtn = document.createElement('a');
      chatBtn.id = 'bonds-chat-launcher';
      chatBtn.href = `https://wa.me/${waNumber}?text=${waText}`;
      chatBtn.className = 'bonds-chat-launcher';
      chatBtn.target = '_blank';
      chatBtn.rel = 'noopener noreferrer';
      chatBtn.setAttribute('aria-label', waLabel);
      const chatLabel = lang === 'en' ? 'Chat' : 'دردشة';
      chatBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg><span>${chatLabel}</span>`;
      document.body.appendChild(chatBtn);
    }

    setActiveLinks();
    applyCalendlyUrl();

    initAuthHeader();
    initGlobalAuthGate();

    initThemeToggle();
  }

  function initGlobalAuthGate() {
    if (document.querySelector('script[src*="global-auth-gate.js"]')) return;
    const gateScript = document.createElement('script');
    gateScript.src = '/global-auth-gate.js?v=3';
    gateScript.async = true;
    document.head.appendChild(gateScript);
  }

  function initAuthHeader() {
    function runInit() {
      if (window.BondsAuth && window.BondsAuth.initSiteAuth) {
        window.BondsAuth.initSiteAuth('authContainer').catch(err => {
          console.warn('[site-layout] initSiteAuth failed:', err);
        });
      }
    }
    if (window.BondsAuth && window.BondsAuth.initSiteAuth) {
      runInit();
      // Retry a few times in case env/session recovery is still in progress
      setTimeout(runInit, 800);
      setTimeout(runInit, 1600);
      return;
    }

    // Helper: inject a script only if it isn't already present and a test isn't satisfied.
    function injectScript(src, isReady) {
      return new Promise((resolve, reject) => {
        if (isReady && isReady()) return resolve();
        const bare = src.split('?')[0];
        if (document.querySelector('script[src*="' + bare + '"]')) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = false; // preserve insertion order for the dependency chain
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
      });
    }

    const envReady = () => typeof window.__ENV !== 'undefined' && window.__ENV.SUPABASE_URL && window.__ENV.SUPABASE_ANON_KEY;
    const supabaseReady = () => typeof supabase !== 'undefined';
    const authReady = () => typeof window.BondsAuth !== 'undefined' && window.BondsAuth.initSiteAuth;

    // Load env + Supabase library + auth client in order, then initialise the header.
    injectScript('/api/env?_=' + Date.now(), envReady)
      .then(() => injectScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js', supabaseReady))
      .then(() => injectScript('/bonds-auth-2026.js?v=3.1.2', authReady))
      .then(() => {
        runInit();
        // Extra retries because session recovery can race with the first getUser call
        setTimeout(runInit, 800);
        setTimeout(runInit, 1600);
        setTimeout(runInit, 2500);
      })
      .catch(err => {
        console.warn('[site-layout] Could not load auth dependencies:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  // Load universal visitor tracking on public pages only
  if (!location.pathname.startsWith('/admin')) {
    const trackScript = document.createElement('script');
    trackScript.src = '/lib/tracking.js?v=2';
    trackScript.async = true;
    document.head.appendChild(trackScript);
  }


})();
