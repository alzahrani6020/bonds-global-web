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

  const NAV_COLLAPSE_WIDTH = 1280;
  const GA_MEASUREMENT_ID = 'G-3B9HJ3YTY7';
  const GA_CONSENT_STORAGE_KEY = 'bonds:analytics-consent:v1';

  function initGoogleAnalyticsConsent() {
    if (location.pathname.startsWith('/admin') || shouldNoPrint()) return;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '::1') return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

    // Default-deny before any Google Analytics network request.
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });

    function readChoice() {
      try {
        const value = localStorage.getItem(GA_CONSENT_STORAGE_KEY);
        return value === 'granted' || value === 'denied' ? value : null;
      } catch (e) {
        return null;
      }
    }

    function saveChoice(value) {
      try {
        localStorage.setItem(GA_CONSENT_STORAGE_KEY, value);
      } catch (e) {}
    }

    function loadAnalytics() {
      if (document.querySelector('script[data-bonds-ga4]')) return;

      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });

      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
      script.setAttribute('data-bonds-ga4', 'true');
      document.head.appendChild(script);
    }

    function removeBanner() {
      const banner = document.getElementById('bonds-analytics-consent');
      if (banner) banner.remove();
    }

    function applyChoice(value) {
      saveChoice(value);
      if (value === 'granted') {
        loadAnalytics();
      } else {
        window.gtag('consent', 'update', {
          analytics_storage: 'denied',
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied'
        });
      }
      removeBanner();
    }

    function showBanner() {
      if (document.getElementById('bonds-analytics-consent')) return;

      const isEn = (document.documentElement.lang || '').toLowerCase().startsWith('en') ||
        /^\/en(?:\/|$)/i.test(location.pathname);
      const banner = document.createElement('aside');
      banner.id = 'bonds-analytics-consent';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-live', 'polite');
      banner.setAttribute('aria-label', isEn ? 'Analytics cookie consent' : 'موافقة ملفات تعريف الارتباط التحليلية');
      banner.style.cssText = [
        'position:fixed',
        'left:16px',
        'right:16px',
        'bottom:16px',
        'z-index:2147483000',
        'max-width:760px',
        'margin:auto',
        'padding:16px 18px',
        'border:1px solid rgba(212,168,83,.35)',
        'border-radius:14px',
        'background:#0f172a',
        'color:#e8ecf4',
        'box-shadow:0 18px 50px rgba(0,0,0,.35)',
        'font:14px/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
      ].join(';');

      const privacyHref = isEn ? '/en/privacy.html' : '/privacy.html';
      const message = isEn
        ? 'We use optional analytics cookies to understand website usage and improve BONDS Global. Analytics stays off unless you accept.'
        : 'نستخدم ملفات تعريف ارتباط تحليلية اختيارية لفهم استخدام الموقع وتحسين BONDS Global. يبقى التتبع متوقفًا ما لم توافق.';
      const acceptText = isEn ? 'Accept analytics' : 'موافق';
      const rejectText = isEn ? 'Reject' : 'رفض';
      const privacyText = isEn ? 'Privacy policy' : 'سياسة الخصوصية';

      banner.innerHTML =
        '<div style="margin-bottom:12px">' + message +
        ' <a href="' + privacyHref + '" style="color:#f0c96a;text-decoration:underline">' + privacyText + '</a></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button type="button" data-ga-consent="accept" style="cursor:pointer;border:0;border-radius:10px;padding:10px 16px;background:#d4a853;color:#0a0f1a;font-weight:800">' + acceptText + '</button>' +
        '<button type="button" data-ga-consent="reject" style="cursor:pointer;border:1px solid rgba(255,255,255,.28);border-radius:10px;padding:10px 16px;background:transparent;color:#e8ecf4;font-weight:700">' + rejectText + '</button>' +
        '</div>';

      banner.addEventListener('click', function (event) {
        const target = event.target.closest('[data-ga-consent]');
        if (!target) return;
        applyChoice(target.getAttribute('data-ga-consent') === 'accept' ? 'granted' : 'denied');
      });

      document.body.appendChild(banner);
    }

    const choice = readChoice();
    if (choice === 'granted') {
      loadAnalytics();
    } else if (choice === 'denied') {
      applyChoice('denied');
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner, { once: true });
    } else {
      showBanner();
    }

    // Expose a small reset hook for future privacy/settings UI.
    window.BondsAnalyticsConsent = Object.freeze({
      measurementId: GA_MEASUREMENT_ID,
      getChoice: readChoice,
      setChoice: applyChoice,
      reset: function () {
        try { localStorage.removeItem(GA_CONSENT_STORAGE_KEY); } catch (e) {}
        showBanner();
      }
    });
  }


  const INTERFACE_SVG_SELECTOR = [
    '.emoji-icon > svg',
    '.input-label-icon > svg',
    '.calc-section-title > svg',
    '.bec-smart-alert__icon > svg',
    '.bec-share-bar button > svg',
    '.bec-share-bar .btn > svg',
    '.header-search > svg',
    '.header-account > svg',
    '.dropdown-toggle > svg',
    '.footer-socials a > svg',
    '.bonds-chat-launcher > svg',
    'button > svg',
    '[role="button"] > svg',
    '.btn > svg',
    '.status-badge > svg',
    '.alert-icon > svg',
    'svg[aria-hidden="true"]'
  ].join(',');

  function setSvgImportant(el, property, value) {
    if (!el || !el.style) return;
    el.style.setProperty(property, value, 'important');
  }

  function hardenInterfaceSvg(svg) {
    if (!svg || !svg.matches || !svg.matches(INTERFACE_SVG_SELECTOR)) return;
    if (svg.matches('.bonds-auth-modal__icon > svg, .bonds-exit-modal__icon > svg')) return;
    if (svg.closest(
      '.chart, .chart-container, .chart-wrap, .gauge, .gauge-container, .score-gauge, ' +
      '.map, .map-container, .diagram, .illustration, .hero-illustration, .logo, .brand-logo, ' +
      '.site-logo, .qr-code, [data-chart], [data-gauge], [data-map]'
    )) return;

    setSvgImportant(svg, 'display', 'block');
    setSvgImportant(svg, 'width', '1em');
    setSvgImportant(svg, 'height', '1em');
    setSvgImportant(svg, 'max-width', '1em');
    setSvgImportant(svg, 'max-height', '1em');
    setSvgImportant(svg, 'min-width', '0');
    setSvgImportant(svg, 'min-height', '0');
    setSvgImportant(svg, 'flex', '0 0 1em');
    setSvgImportant(svg, 'position', 'static');
    setSvgImportant(svg, 'inset', 'auto');
    setSvgImportant(svg, 'transform', 'none');
    setSvgImportant(svg, 'object-fit', 'contain');
    setSvgImportant(svg, 'overflow', 'hidden');
  }

  function hardenInterfaceSvgs(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.matches && root.matches(INTERFACE_SVG_SELECTOR)) {
      hardenInterfaceSvg(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll(INTERFACE_SVG_SELECTOR).forEach(hardenInterfaceSvg);
    }
  }

  function installInterfaceSvgGuard() {
    hardenInterfaceSvgs(document);
    const target = document.documentElement || document.body;
    if (!target || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) hardenInterfaceSvgs(node);
        });
      });
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  installInterfaceSvgGuard();

  initGoogleAnalyticsConsent();

  function ensureEmojiRuntime() {
    const rendererPath = '/components/emoji-renderer.js';
    const iconsPath = '/components/emoji-icons.js';
    const hasRendererTag = document.querySelector('script[src*="components/emoji-renderer.js"]');
    if (hasRendererTag) return;

    function loadRenderer() {
      if (document.querySelector('script[src*="components/emoji-renderer.js"]')) return;
      const renderer = document.createElement('script');
      renderer.src = rendererPath;
      renderer.async = false;
      document.head.appendChild(renderer);
    }

    if (window.EmojiIcons) {
      loadRenderer();
      return;
    }

    const existingIcons = document.querySelector('script[src*="components/emoji-icons.js"]');
    if (existingIcons) {
      if (window.EmojiIcons) loadRenderer();
      else existingIcons.addEventListener('load', loadRenderer, { once: true });
      return;
    }

    const icons = document.createElement('script');
    icons.src = iconsPath;
    icons.async = false;
    icons.addEventListener('load', loadRenderer, { once: true });
    document.head.appendChild(icons);
  }

  // Site-layout is present across the public application shell. It acts as the
  // final safety net for pages that contain emoji/icon surfaces but predate the
  // explicit emoji runtime includes.
  ensureEmojiRuntime();

  const institutionalHref = '/styles/institutional-system.css?v=6';
  const institutionalStyles = document.querySelector('link[href*="institutional-system.css"]');
  if (institutionalStyles) {
    if (!institutionalStyles.href.includes('institutional-system.css?v=6')) {
      institutionalStyles.href = institutionalHref;
    }
  } else {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = institutionalHref;
    document.head.appendChild(link);
  }

  const universalCss = document.querySelector('link[href*="universal-dropdown.css"]');
  if (!universalCss) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/components/universal-dropdown.css?v=2';
    document.head.appendChild(link);
  }

  const discoveryCss = document.querySelector('link[href*="service-discovery.css"]');
  if (!discoveryCss) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/components/service-discovery.css?v=4';
    document.head.appendChild(link);
  }

  function ensureGlobalAssistantRuntime() {
    if (location.pathname.startsWith('/admin') || shouldNoPrint()) return;

    const mountAssistant = () => {
      if (!window.BondsAIChat || typeof window.BondsAIChat.mount !== 'function') return false;
      window.BondsAIChat.mount({
        mode: 'city',
        global: true,
        pagePath: window.location.pathname + window.location.hash,
        pageTitle: document.title || null
      });
      const whatsapp = document.getElementById('bonds-chat-launcher');
      if (whatsapp) whatsapp.remove();
      return true;
    };

    if (mountAssistant()) return;

    const existing = document.querySelector('script[src*="/v3/components/ai-chat-widget.js"]');
    if (existing) {
      existing.addEventListener('load', mountAssistant, { once:true });
      return;
    }

    const script = document.createElement('script');
    script.src = '/v3/components/ai-chat-widget.js?v=global-assistant-e12e26db3e';
    script.async = false;
    script.addEventListener('load', mountAssistant, { once:true });
    document.head.appendChild(script);
  }

  function ensureServiceDiscoveryRuntime() {
    const loadDiscovery = () => {
      if (document.querySelector('script[src*="service-discovery.js"]')) return;
      const script = document.createElement('script');
      script.src = '/components/service-discovery.js?v=5';
      script.async = false;
      document.head.appendChild(script);
    };

    if (window.UniversalDropdown) {
      loadDiscovery();
      return;
    }

    const existingDropdown = document.querySelector('script[src*="universal-dropdown.js"]');
    if (existingDropdown) {
      existingDropdown.addEventListener('load', loadDiscovery, { once:true });
      existingDropdown.addEventListener('error', loadDiscovery, { once:true });
      return;
    }

    const dropdown = document.createElement('script');
    dropdown.src = '/components/universal-dropdown.js?v=2';
    dropdown.async = false;
    dropdown.addEventListener('load', loadDiscovery, { once: true });
    dropdown.addEventListener('error', loadDiscovery, { once: true });
    document.head.appendChild(dropdown);
  }

  ensureServiceDiscoveryRuntime();

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
      services: isEn ? 'Services' : 'الخدمات',
      sectors: isEn ? 'Sectors' : 'القطاعات',
      knowledge: isEn ? 'Knowledge' : 'المعرفة',
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
      cta: isEn ? 'Book a Consultation' : 'احجز استشارة',
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
      breakEven: isEn ? "Break-Even" : "نقطة التعادل",
      projectWizard: isEn ? "Project Feasibility Wizard" : "معالج جدوى المشاريع",
      investmentCenter: isEn ? "Investment Center" : "مركز الحاسبات الاستثمارية",
      cashFlowCalc: isEn ? "Cash Flow" : "تدفق النقد",
      pricingCalc: isEn ? "Pricing" : "تسعير المنتج",
      loanCalc: isEn ? "Loan & Finance" : "القرض والتمويل",
      roiCalc: isEn ? "ROI Calculator" : "عائد الاستثمار",
      restaurantCalc: isEn ? "Restaurants & Cloud" : "المطاعم والسحابي",
      menuEngCalc: isEn ? "Menu Engineering" : "هندسة المنيو",
      feasibilityCalc: isEn ? 'Restaurant Viability' : 'الجدوى المالية للمطعم',
      medicalCalc: isEn ? "Medical Viability" : "الجدوى الطبية",
      invoiceCalc: isEn ? "Invoice Analyzer" : "تحليل الفواتير",
      templateCalc: isEn ? "Feasibility Template" : "نموذج دراسة الجدوى",
      manufacturingFeasibilityCalc: isEn ? "Manufacturing Feasibility" : "الجدوى المالية للمصنع",
      valuation: isEn ? 'Valuation' : 'التقييم',
      creditworthinessCalc: isEn ? "Credit Rating" : "تقييم الجدارة الائتمانية",
      realProjectAnalysis: isEn ? "Real Project Analysis" : "تحليل المشروع الحقيقي",
      search: isEn ? 'Search' : 'بحث',
      factorySa: isEn ? 'Factory Cost — Saudi' : 'تكلفة المصنع — السعودية',
      factoryEg: isEn ? 'Factory Cost — Egypt' : 'تكلفة المصنع — مصر',
      pricingFeasibilityGroup: isEn ? 'Pricing & Feasibility' : 'التسعير والجدوى',
      financialAnalysisGroup: isEn ? 'Financial Analysis' : 'التحليل المالي',
      tools: isEn ? 'Tools' : 'الأدوات',
      aboutGovernance: isEn ? 'About' : 'عن بوندز',
      advisoryGroup: isEn ? 'Advisory' : 'الاستشارات',
      financeManagementGroup: isEn ? 'Financial Management' : 'الإدارة المالية',
      transformationGroup: isEn ? 'Transformation & Risk' : 'التحول والمخاطر',
      fundingGroup: isEn ? 'Funding' : 'التمويل',
      investmentGroup: isEn ? 'Investment' : 'الاستثمار',
      intelligenceGroup: isEn ? 'Cities & Markets' : 'المدن والأسواق',
      methodologyGroup: isEn ? 'Methodology & Data' : 'المنهجية والبيانات',
      methodology: isEn ? 'Calculation Methodology' : 'منهجية الحساب',
      dataMethodology: isEn ? 'Data Sources & Methodology' : 'مصادر ومنهجية البيانات',
      companyGroup: isEn ? 'Company' : 'الشركة',
      governanceGroup: isEn ? 'Governance & Trust' : 'الحوكمة والثقة',
      privacy: isEn ? 'Privacy' : 'الخصوصية',
      terms: isEn ? 'Terms' : 'الشروط والأحكام',
      kyc: isEn ? 'Know Your Customer (KYC)' : 'اعرف عميلك (KYC)',
      receivablesAging: isEn ? 'Receivables Aging' : 'أعمار الذمم',
      establishmentInfo: isEn ? 'Establishment Information' : 'معلومات المنشأة',
      payablesAging: isEn ? 'Payables Aging' : 'أعمار الذمم الدائنة',
      cashFlowForm: isEn ? 'Cash Flow' : 'التدفقات النقدية',
      businessActivityInfo: isEn ? 'Business Activity Information' : 'معلومات النشاط',
      businessCreditConsent: isEn ? 'Business Credit Consent' : 'موافقة الاستعلام الائتماني — منشأة',
      individualCreditConsent: isEn ? 'Individual Credit Consent' : 'موافقة الاستعلام الائتماني — فرد',
      fundingFileGroup: isEn ? 'Funding File' : 'ملف التمويل',
      fundingRequirements: isEn ? 'Requirements & Forms' : 'المتطلبات والنماذج',
      fundingCases: isEn ? 'Funding Cases' : 'حالات التمويل',
      clientPortalNav: isEn ? 'Client Portal' : 'بوابة العميل',
    };

    const currentPath = window.location.pathname;
    const currentSearch = window.location.search || '';
    function languageSwitchHref() {
      if (isEn) {
        if (/^\/en\/v3\/?$/i.test(currentPath)) {
          const source = new URLSearchParams(currentSearch).get('from');
          return source && source.startsWith('/v3/') ? source : '/v3/city-intelligence';
        }
        const arPath = currentPath === '/en' || currentPath === '/en/'
          ? '/'
          : currentPath.replace(/^\/en(?=\/|$)/, '');
        return (arPath || '/') + currentSearch;
      }
      if (/^\/v3\//i.test(currentPath)) {
        return '/en/v3/?from=' + encodeURIComponent(currentPath + currentSearch);
      }
      return '/en' + (currentPath === '/' ? '/index.html' : currentPath) + currentSearch;
    }
    const langHref = languageSwitchHref();
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
    const kycHref = isEn ? '/en/client/kyc' : '/client/kyc';
    const receivablesAgingHref = isEn ? '/en/client/receivables-aging' : '/client/receivables-aging';
    const establishmentInfoHref = isEn ? '/en/client/establishment-information' : '/client/establishment-information';
    const payablesAgingHref = isEn ? '/en/client/payables-aging' : '/client/payables-aging';
    const cashFlowFormHref = isEn ? '/en/client/cash-flow' : '/client/cash-flow';
    const businessActivityInfoHref = isEn ? '/en/client/business-activity' : '/client/business-activity';
    const businessCreditConsentHref = isEn ? '/en/client/credit-consent-business' : '/client/credit-consent-business';
    const individualCreditConsentHref = isEn ? '/en/client/credit-consent-individual' : '/client/credit-consent-individual';
    const fundingCasesHref = isEn ? '/en/client/funding-cases' : '/client/funding-cases';
    const fundingExtractionHref = langBase + 'funding-extraction.html';
    const fundingRequirementsHref = fundingExtractionHref + '#funding-file';
    const investmentOpportunitiesHref = langBase + 'investment-opportunities.html';
    const cityIntelligenceHref = '/' + v3Base + 'city-intelligence.html';
    const projectRescueHref = langBase + 'project-rescue.html';
    const calcBase = langBase + 'calculators/';
    const calcBreakEven = calcBase + 'break-even.html';
    const sectorsBase = langBase + 'sectors/';
    const methodologyHref = langBase + 'methodology.html';
    const dataMethodologyHref = langBase + 'data-methodology.html';
    const privacyHref = langBase + 'privacy.html';
    const termsHref = langBase + 'terms.html';
    const v3EnglishHubHref = '/en/v3/';

    const serviceDropdown = [
      {
        heading: { ar: 'الاستشارات المالية', en: 'Financial Advisory' },
        items: [
          { label: labels.analysis, href: servicesHref + '#analysis' },
          { label: labels.cashflow, href: servicesHref + '#cashflow' },
          { label: labels.budgets, href: servicesHref + '#budgets' },
          { label: labels.strategy, href: servicesHref + '#strategy' },
        ],
      },
      {
        heading: { ar: 'الدراسات والتقييم', en: 'Studies & Valuation' },
        items: [
          { label: labels.feasibility, href: servicesHref + '#feasibility' },
          { label: labels.valuation, href: valuationHref },
          { label: labels.risk, href: servicesHref + '#risk' },
        ],
      },
      {
        heading: { ar: 'التمويل وإعادة الهيكلة', en: 'Funding & Restructuring' },
        items: [
          { label: labels.fundingExtraction, href: fundingExtractionHref },
          { label: labels.fundingReadiness, href: fundingReadinessHref },
          { label: labels.projectRescue, href: projectRescueHref },
        ],
      },
      {
        heading: { ar: 'الأعمال والسوق', en: 'Business & Market' },
        items: [
          { label: labels.operations, href: servicesHref + '#operations' },
          { label: labels.research, href: servicesHref + '#research' },
        ],
      },
    ];

    // TOOLS-GENERATED:START
    const calcDropdown = [
      {
        heading: { ar: "التحليل والقرار", en: "Analysis & Decision" },
        items: [
          { label: labels.investmentCenter, href: calcBase + 'investment-center/index.html' },
          { label: labels.projectWizard, href: langBase + 'calculator-wizard.html' },
          { label: labels.realProjectAnalysis, href: calcBase + 'real-project-analysis.html' },
          { label: labels.breakEven, href: calcBreakEven },
        ],
      },
      {
        heading: { ar: "التحليل المالي", en: "Financial Analysis" },
        items: [
          { label: labels.cashFlowCalc, href: calcBase + 'cash-flow.html' },
          { label: labels.loanCalc, href: calcBase + 'loan.html' },
          { label: labels.roiCalc, href: calcBase + 'roi.html' },
          { label: labels.creditworthinessCalc, href: calcBase + 'creditworthiness.html' },
          { label: labels.invoiceCalc, href: calcBase + 'invoice-analyzer.html' },
        ],
      },
      {
        heading: { ar: "التسعير والجدوى", en: "Pricing & Feasibility" },
        items: [
          { label: labels.pricingCalc, href: calcBase + 'pricing.html' },
          { label: labels.templateCalc, href: calcBase + 'feasibility-template.html' },
          { label: labels.manufacturingFeasibilityCalc, href: calcBase + 'manufacturing-feasibility.html' },
        ],
      },
      {
        heading: { ar: "أدوات قطاعية", en: "Sector Tools" },
        items: [
          { label: labels.restaurantCalc, href: calcBase + 'restaurant.html' },
          { label: labels.menuEngCalc, href: calcBase + 'menu-engineering.html' },
          { label: labels.medicalCalc, href: calcBase + 'medical-viability.html' },
        ],
      },
    ];
    // TOOLS-GENERATED:END
    const fundingDropdown = [
      {
        heading: { ar: labels.fundingGroup, en: 'Funding' },
        items: [
          { label: labels.fundingHub, href: fundingHubHref },
          { label: labels.fundingExtraction, href: fundingExtractionHref },
          { label: labels.fundingSources, href: fundingSourcesHref },
          { label: labels.fundingReadiness, href: fundingReadinessHref },
        ],
      },
      {
        heading: { ar: labels.investmentGroup, en: 'Investment' },
        items: [
          { label: labels.investmentOpportunities, href: investmentOpportunitiesHref },
          { label: labels.projectReadiness, href: isEn ? v3EnglishHubHref + '#project-readiness' : '/v3/project-readiness' },
          { label: labels.opportunityBank, href: isEn ? v3EnglishHubHref + '#opportunity-bank' : '/v3/opportunity-bank' },
        ],
      },
      {
        heading: { ar: labels.fundingFileGroup, en: 'Funding File' },
        items: [
          { label: labels.fundingCases, href: fundingCasesHref },
          { label: labels.fundingRequirements, href: fundingRequirementsHref },
          { label: labels.clientPortalNav, href: clientPortalHref },
        ],
      },
    ];

    const intelligenceDropdown = [
      {
        heading: { ar: labels.intelligenceGroup, en: 'Cities & Markets' },
        items: [
          { label: labels.cityIntelligence, href: isEn ? v3EnglishHubHref + '#city-intelligence' : '/v3/city-intelligence' },
          { label: labels.cityComparison, href: isEn ? v3EnglishHubHref + '#city-comparison' : '/v3/city-comparison' },
          { label: labels.investmentMap, href: isEn ? v3EnglishHubHref + '#investment-map' : '/v3/investment-map' },
          { label: labels.scenariosEngine, href: isEn ? v3EnglishHubHref + '#scenarios' : '/v3/scenarios' },
        ],
      },
      {
        heading: { ar: labels.methodologyGroup, en: 'Methodology & Data' },
        items: [
          { label: labels.dataMethodology, href: dataMethodologyHref },
          { label: labels.methodology, href: methodologyHref },
        ],
      },
    ];


    const aboutDropdown = [
      {
        heading: { ar: labels.companyGroup, en: 'Company' },
        items: [
          { label: labels.about, href: aboutHref },
          { label: labels.caseStudies, href: caseStudiesHref },
          { label: labels.contact, href: contactHref },
        ],
      },
      {
        heading: { ar: labels.governanceGroup, en: 'Governance & Trust' },
        items: [
          { label: labels.privacy, href: privacyHref },
          { label: labels.terms, href: termsHref },
          { label: labels.kyc, href: kycHref },
        ],
      },
    ];

    const caretSvg = ''; // caret is rendered by header-footer.css ::after; avoid duplicate raw SVG

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
        if (isGrouped) {
          html += `<div class="dropdown-menu__footer"><a href="${extraAll.href}">${extraAll.label}</a></div>`;
        } else {
          html += `<div class="dropdown-menu__divider"></div><a href="${extraAll.href}">${extraAll.label}</a>`;
        }
      }
      const cls = isGrouped
        ? 'dropdown-menu dropdown-menu--grouped'
        : (isLarge ? 'dropdown-menu dropdown-menu--large' : 'dropdown-menu');
      return `<div class="${cls}">${html}</div>`;
    }

    const navItems = [
      { href: homeHref, label: labels.home },
      { type: 'dropdown', label: labels.services, items: serviceDropdown, all: { href: servicesHref, label: labels.allServices } },
      { href: servicesHref + '#sectors', label: labels.sectors },
      { type: 'dropdown', navId: 'tools', label: labels.tools, items: calcDropdown, all: { href: calcBase + 'investment-center/index.html', label: isEn ? 'All Tools →' : 'جميع الأدوات →' } },
      { type: 'dropdown', label: labels.knowledge, items: intelligenceDropdown },
      { type: 'dropdown', label: labels.aboutGovernance, items: aboutDropdown },
    ];

    const navHtml = navItems.map(item => {
      if (item.type === 'dropdown') {
        const highlightClass = item.highlight ? ' nav-highlight' : '';
        const navIdAttr = item.navId ? ` data-nav-id="${item.navId}"` : '';
        return `<li class="dropdown"${navIdAttr}><button type="button" class="dropdown-toggle${highlightClass}" aria-expanded="false" aria-haspopup="true">${item.label} ${caretSvg}</button>${buildDropdown(item.items, item.all, item.isLarge)}</li>`;
      }
      const highlightClass = item.highlight ? ' nav-highlight' : '';
      return `<li><a href="${item.href}" data-nav="${item.href}" class="${highlightClass}">${item.label}</a></li>`;
    }).join('');

    return `
<header class="main-header" id="header">
  <div class="main-header__inner">
    <a href="${homeHref}" class="header-brand">
      <img class="header-brand__image" src="/assets/bonds-logo-2026-v2-sm.webp?v=2026f" alt="${isEn ? 'Bonds' : 'بوندز'}" width="112" height="44" />
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
      <a href="${contactHref}" class="btn-header" id="headerCtaBtn">${labels.cta}</a>
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
    const homeHref = langBase + 'index.html';
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
      <img src="/assets/bonds-logo-2026-v2-sm.webp?v=2026f" alt="${isEn ? 'Bonds' : 'بوندز'}" width="180" height="71" style="width:180px; height:auto; max-width:100%; margin-bottom:1rem; object-fit:contain;" />
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
        <a href="${langBase + 'data-methodology.html'}">${isEn ? 'Data Sources & Methodology' : 'مصادر ومنهجية البيانات'}</a>
        <a href="${langBase + 'methodology.html'}">${isEn ? 'Calculation Methodology' : 'منهجية الحساب'}</a>
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
    const href = '/header-footer.css?v=2.71.0';
    const existing = document.querySelector('link[href*="header-footer.css"]');
    if (existing) {
      if (!existing.href.includes('header-footer.css?v=2.71.0')) {
        existing.href = href;
      }
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    const head = document.head || document.querySelector('head');
    if (head) head.appendChild(link);
  }

  function initThemeToggle() {
    // The public institutional interface is intentionally single-theme.
    // Remove any legacy empty theme control left by older cached layout code.
    const existing = document.getElementById('themeToggle');
    if (existing) existing.remove();
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

      // Deterministic dropdown handling.
      // Desktop opens ONLY from the trigger itself; menu hover never opens a closed dropdown.
      const isTouch = window.matchMedia('(pointer: coarse)').matches;
      const dropdownOpenTimers = new WeakMap();
      const dropdownCloseTimers = new WeakMap();

      function setDropdownOpen(dropdown, open) {
        if (!dropdown) return;
        const toggle = dropdown.querySelector(':scope > .dropdown-toggle');
        dropdown.classList.toggle('is-open', open);
        if (toggle) toggle.setAttribute('aria-expanded', String(open));
      }

      function closeOtherDropdowns(except) {
        document.querySelectorAll('.main-header .dropdown.is-open').forEach(d => {
          if (d !== except) setDropdownOpen(d, false);
        });
      }

      document.querySelectorAll('.main-header .dropdown-toggle').forEach(toggle => {
        const dropdown = toggle.closest('.dropdown');
        const menu = dropdown && dropdown.querySelector(':scope > .dropdown-menu');
        if (!dropdown || !menu) return;

        const clearTimer = (map) => {
          const timer = map.get(dropdown);
          if (timer) {
            clearTimeout(timer);
            map.delete(dropdown);
          }
        };

        const scheduleOpen = () => {
          if (window.innerWidth <= NAV_COLLAPSE_WIDTH || isTouch) return;
          clearTimer(dropdownCloseTimers);
          clearTimer(dropdownOpenTimers);
          const timer = setTimeout(() => {
            closeOtherDropdowns(dropdown);
            setDropdownOpen(dropdown, true);
            dropdownOpenTimers.delete(dropdown);
          }, 140);
          dropdownOpenTimers.set(dropdown, timer);
        };

        const scheduleClose = () => {
          if (window.innerWidth <= NAV_COLLAPSE_WIDTH || isTouch) return;
          clearTimer(dropdownOpenTimers);
          clearTimer(dropdownCloseTimers);
          const timer = setTimeout(() => {
            setDropdownOpen(dropdown, false);
            dropdownCloseTimers.delete(dropdown);
          }, 180);
          dropdownCloseTimers.set(dropdown, timer);
        };

        toggle.addEventListener('pointerenter', scheduleOpen);
        toggle.addEventListener('pointerleave', scheduleClose);
        menu.addEventListener('pointerenter', () => clearTimer(dropdownCloseTimers));
        menu.addEventListener('pointerleave', scheduleClose);

        toggle.addEventListener('click', function (e) {
          e.preventDefault();
          clearTimer(dropdownOpenTimers);
          clearTimer(dropdownCloseTimers);
          const wasOpen = dropdown.classList.contains('is-open');
          closeOtherDropdowns(dropdown);
          setDropdownOpen(dropdown, !wasOpen);
        });

        toggle.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            setDropdownOpen(dropdown, false);
            toggle.focus();
          } else if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !dropdown.classList.contains('is-open')) {
            e.preventDefault();
            closeOtherDropdowns(dropdown);
            setDropdownOpen(dropdown, true);
            const first = menu.querySelector('a, button');
            if (first) first.focus();
          }
        });

        menu.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            setDropdownOpen(dropdown, false);
            toggle.focus();
          }
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
    ensureGlobalAssistantRuntime();

    initThemeToggle();
  }

  function initGlobalAuthGate() {
    if (document.querySelector('script[src*="global-auth-gate.js"]')) return;
    const gateScript = document.createElement('script');
    gateScript.src = '/global-auth-gate.js?v=4';
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
      .then(() => injectScript('/bonds-auth-2026.js?v=3.1.3', authReady))
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
