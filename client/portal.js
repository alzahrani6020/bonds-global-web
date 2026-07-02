// BONDS Client Portal V2 — Project-Journey Experience
(function () {
  'use strict';

  const LANG = window.__PORTAL_LANG || 'ar';
  const IS_EN = LANG === 'en';
  const PAGE = window.__PORTAL_PAGE || 'dashboard';

  const LABELS = {
    ar: {
      portalTitle: 'بوابة العميل',
      projects: 'المشاريع',
      portfolio: 'المحفظة',
      newProject: 'مشروع جديد',
      logout: 'تسجيل الخروج',
      switchLang: 'English',
      loading: 'جاري تحميل مشاريعك...',
      errorLoading: 'تعذر تحميل المشاريع. حاول مرة أخرى.',
      noProjectsTitle: 'ابدأ رحلتك الاستثمارية',
      noProjectsDesc: 'أنشئ مشروعك الأول واحصل على تحليل AI وتقييم وتمويل ونشرة استثمارية.',
      openProject: 'فتح المشروع',
      stage: 'المرحلة',
      readiness: 'جاهزية الاستثمار',
      confidence: 'درجة الثقة',
      nextStep: 'الخطوة التالية',
      capital: 'رأس المال',
      revenue: 'الإيرادات السنوية',
      totalProjects: 'إجمالي المشاريع',
      avgReadiness: 'متوسط الجاهزية',
      avgConfidence: 'متوسط الثقة',
      wizardTitle: 'مشروع جديد',
      wizardStep1: 'بيانات المشروع',
      wizardStep2: 'البيانات المالية',
      wizardStep3: 'المراجعة',
      projectName: 'اسم المشروع',
      sector: 'القطاع',
      activity: 'النشاط',
      country: 'الدولة',
      governorate: 'المحافظة',
      city: 'المدينة',
      currency: 'العملة',
      annualRevenue: 'الإيرادات السنوية',
      annualNetProfit: 'صافي الربح السنوي',
      investmentCapital: 'رأس المال الاستثماري',
      back: 'العودة',
      next: 'التالي',
      createProject: 'إنشاء المشروع',
      creating: 'جاري الإنشاء...',
      cancel: 'إلغاء',
      selectPlaceholder: 'اختر',
      successCreated: 'تم إنشاء المشروع بنجاح.',
      reportsMoved: 'التقارير والتحليلات متاحة الآن داخل صفحة المشروع.',
      goToPortfolio: 'الذهاب إلى المحفظة',
      close: 'إغلاق',
      errorCreate: 'تعذر إنشاء المشروع.',
      health_healthy: 'ممتازة',
      health_attention: 'تحتاج اهتمام',
      health_at_risk: 'مرتفعة المخاطر',
      stage_idea: 'الفكرة',
      stage_feasibility: 'دراسة الجدوى',
      stage_valuation: 'التقييم',
      stage_funding: 'التمويل',
      stage_investment_readiness: 'جاهزية الاستثمار',
      stage_investment_memorandum: 'النشرة الاستثمارية',
      stage_ai_review: 'مراجعة AI',
      stage_investor_matching: 'المستثمرون',
      stage_virtual_data_room: 'غرفة البيانات',
      stage_ready: 'جاهز للنشر',
      sector_real_estate: 'عقار',
      sector_manufacturing: 'صناعة',
      sector_retail: 'تجارة تجزئة',
      sector_restaurant: 'مطعم/مقهى',
      sector_technology: 'تقنية',
      sector_healthcare: 'صحة',
      sector_agriculture: 'زراعة',
      sector_logistics: 'خدمات لوجستية',
      sector_services: 'خدمات',
      sector_energy: 'طاقة',
      sector_other: 'أخرى'
    },
    en: {
      portalTitle: 'Client Portal',
      projects: 'Projects',
      portfolio: 'Portfolio',
      newProject: 'New Project',
      logout: 'Sign out',
      switchLang: 'العربية',
      loading: 'Loading your projects...',
      errorLoading: 'Unable to load projects. Please try again.',
      noProjectsTitle: 'Start your investment journey',
      noProjectsDesc: 'Create your first project and get AI analysis, valuation, funding, and an investment memorandum.',
      openProject: 'Open project',
      stage: 'Stage',
      readiness: 'Investment readiness',
      confidence: 'Confidence',
      nextStep: 'Next step',
      capital: 'Capital',
      revenue: 'Annual revenue',
      totalProjects: 'Total projects',
      avgReadiness: 'Average readiness',
      avgConfidence: 'Average confidence',
      wizardTitle: 'New Project',
      wizardStep1: 'Project Data',
      wizardStep2: 'Financial Data',
      wizardStep3: 'Review',
      projectName: 'Project name',
      sector: 'Sector',
      activity: 'Activity',
      country: 'Country',
      governorate: 'Region',
      city: 'City',
      currency: 'Currency',
      annualRevenue: 'Annual revenue',
      annualNetProfit: 'Annual net profit',
      investmentCapital: 'Investment capital',
      back: 'Back',
      next: 'Next',
      createProject: 'Create project',
      creating: 'Creating...',
      cancel: 'Cancel',
      selectPlaceholder: 'Select',
      successCreated: 'Project created successfully.',
      reportsMoved: 'Reports and analyses are now available inside the project page.',
      goToPortfolio: 'Go to portfolio',
      close: 'Close',
      errorCreate: 'Unable to create project.',
      health_healthy: 'Healthy',
      health_attention: 'Needs attention',
      health_at_risk: 'At risk',
      stage_idea: 'Idea',
      stage_feasibility: 'Feasibility',
      stage_valuation: 'Valuation',
      stage_funding: 'Funding',
      stage_investment_readiness: 'Investment readiness',
      stage_investment_memorandum: 'Investment memorandum',
      stage_ai_review: 'AI review',
      stage_investor_matching: 'Investors',
      stage_virtual_data_room: 'Data room',
      stage_ready: 'Ready to publish',
      sector_real_estate: 'Real estate',
      sector_manufacturing: 'Manufacturing',
      sector_retail: 'Retail',
      sector_restaurant: 'Restaurant / Café',
      sector_technology: 'Technology',
      sector_healthcare: 'Healthcare',
      sector_agriculture: 'Agriculture',
      sector_logistics: 'Logistics',
      sector_services: 'Services',
      sector_energy: 'Energy',
      sector_other: 'Other'
    }
  };

  function t(key) {
    return LABELS[LANG][key] || key;
  }

  const JOURNEY_STAGES = [
    { id: 'idea', labelKey: 'stage_idea' },
    { id: 'feasibility', labelKey: 'stage_feasibility' },
    { id: 'valuation', labelKey: 'stage_valuation' },
    { id: 'funding', labelKey: 'stage_funding' },
    { id: 'investment_readiness', labelKey: 'stage_investment_readiness' },
    { id: 'investment_memorandum', labelKey: 'stage_investment_memorandum' },
    { id: 'ai_review', labelKey: 'stage_ai_review' },
    { id: 'investor_matching', labelKey: 'stage_investor_matching' },
    { id: 'virtual_data_room', labelKey: 'stage_virtual_data_room' },
    { id: 'ready', labelKey: 'stage_ready' }
  ];

  const SECTOR_KEYS = [
    'real_estate', 'manufacturing', 'retail', 'restaurant', 'technology',
    'healthcare', 'agriculture', 'logistics', 'services', 'energy', 'other'
  ];

  function clientPath(page) {
    return IS_EN ? '/en/client/' + page : '/client/' + page;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return Number(num).toLocaleString(IS_EN ? 'en-US' : 'ar-SA');
  }

  function el(id) {
    return document.getElementById(id);
  }

  async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      if (window.BondsAuth && window.BondsAuth.getSession) {
        const { data } = await window.BondsAuth.getSession();
        const token = data?.session?.access_token;
        if (token) headers.Authorization = 'Bearer ' + token;
      }
    } catch (e) {
      console.warn('[PortalV2] unable to read session', e);
    }
    return headers;
  }

  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(body || {})
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  }

  async function requireAuth() {
    if (!window.BondsAuth || !window.BondsAuth.getUser) {
      window.location.replace(clientPath('login.html') + '?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    const { data } = await window.BondsAuth.getUser();
    if (!data?.user) {
      window.location.replace(clientPath('login.html') + '?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    window.__PORTAL_USER = data.user;
  }

  function injectHeader() {
    const header = el('portal-header');
    if (!header) return;
    const user = window.__PORTAL_USER || {};
    header.innerHTML = `
      <header class="portal-header">
        <div class="portal-header__inner">
          <a class="portal-header__brand" href="${clientPath('index.html')}">
            <img src="/assets/bonds-logo-2026-header.webp?v=2026" alt="Bonds" />
            <span>${t('portalTitle')}</span>
          </a>
          <div class="portal-header__actions">
            <span class="portal-user">${escapeHtml(user.email || '')}</span>
            <a class="portal-header__lang" href="${IS_EN ? '/v3/portfolio' : '/en/v3/portfolio'}">${t('switchLang')}</a>
            <a class="portal-header__logout" href="#" id="portalLogout">${t('logout')}</a>
          </div>
        </div>
      </header>
    `;
    const logout = el('portalLogout');
    if (logout) {
      logout.addEventListener('click', async (e) => {
        e.preventDefault();
        if (window.BondsAuth && window.BondsAuth.signOut) await window.BondsAuth.signOut();
        window.location.replace(clientPath('login.html'));
      });
    }
  }

  function injectSidebar() {
    const sidebar = el('portal-sidebar');
    if (!sidebar) return;
    const items = [
      { label: t('projects'), href: clientPath('index.html'), active: PAGE === 'dashboard' },
      { label: t('portfolio'), href: IS_EN ? '/en/v3/portfolio' : '/v3/portfolio', active: false },
      { label: t('newProject'), href: '#', active: false, id: 'sidebarNewProject' }
    ];
    sidebar.innerHTML = items.map(item => `
      <a class="portal-sidebar__link ${item.active ? 'active' : ''}" href="${item.href}" ${item.id ? 'id="' + item.id + '"' : ''}>
        ${escapeHtml(item.label)}
      </a>
    `).join('');
    const newProject = el('sidebarNewProject');
    if (newProject) {
      newProject.addEventListener('click', (e) => {
        e.preventDefault();
        openNewProjectWizard();
      });
    }
  }

  function renderHealthClass(health) {
    return health === 'healthy' ? 'status--healthy' : health === 'attention' ? 'status--attention' : 'status--at-risk';
  }

  function renderHealthLabel(health) {
    return t('health_' + (health || 'attention'));
  }

  function journeyStageIndex(stageId) {
    const found = JOURNEY_STAGES.findIndex(s => s.id === stageId);
    if (found >= 0) return found;
    // Post-data-room stages map to ready
    return JOURNEY_STAGES.length - 1;
  }

  function renderJourneyBar(stageId) {
    const currentIndex = journeyStageIndex(stageId);
    return `
      <div class="journey-bar">
        ${JOURNEY_STAGES.map((stage, index) => {
          const status = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
          return `
            <div class="journey-step journey-step--${status}">
              <div class="journey-step__dot"></div>
              <div class="journey-step__label">${t(stage.labelKey)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderProjectCard(project) {
    const p = project;
    const status = p.status || {};
    const health = status.health || {};
    const stage = status.lifecycle?.currentStage || 'idea';
    const next = status.mission?.nextBestAction || {};
    const cityName = p.city || (p.status?.project?.city) || '';
    const sectorLabel = t('sector_' + (p.sector || 'other'));
    return `
      <div class="project-card">
        <div class="project-card__header">
          <div>
            <div class="project-card__title">${escapeHtml(p.name)}</div>
            <div class="project-card__meta">${escapeHtml(sectorLabel)}${cityName ? ' · ' + escapeHtml(cityName) : ''}</div>
          </div>
          <span class="project-card__badge ${renderHealthClass(health.projectHealth)}">${renderHealthLabel(health.projectHealth)}</span>
        </div>
        <div class="project-card__metrics">
          <div class="project-card__metric">
            <div class="project-card__metric-value">${formatNumber(health.readinessScore || 0)}</div>
            <div class="project-card__metric-label">${t('readiness')}</div>
          </div>
          <div class="project-card__metric">
            <div class="project-card__metric-value">${formatNumber(health.confidence || 0)}%</div>
            <div class="project-card__metric-label">${t('confidence')}</div>
          </div>
          <div class="project-card__metric">
            <div class="project-card__metric-value">${formatNumber(status.financial?.capital || p.capital || 0)}</div>
            <div class="project-card__metric-label">${t('capital')}</div>
          </div>
        </div>
        <div class="project-card__stage">
          <strong>${t('stage')}:</strong> ${t('stage_' + (JOURNEY_STAGES.find(s => s.id === stage)?.id || 'idea'))}
        </div>
        ${next.action_ar || next.action ? `
          <div class="project-card__next">
            <strong>${t('nextStep')}:</strong> ${escapeHtml(IS_EN ? next.action : (next.action_ar || next.action))}
          </div>
        ` : ''}
        <div class="project-card__actions">
          <a class="portal-btn portal-btn--primary" href="/v3/project?id=${encodeURIComponent(p.id)}">${t('openProject')}</a>
        </div>
      </div>
    `;
  }

  function renderDashboard(portfolio) {
    const main = el('portal-main');
    if (!main) return;

    const summary = portfolio.summary || {};
    const projects = portfolio.projects || [];

    let html = `
      <div class="portal-dashboard">
        <div class="portal-dashboard__head">
          <h1 class="portal-dashboard__title">${t('projects')}</h1>
          <button class="portal-btn portal-btn--primary" id="dashboardNewProject">${t('newProject')}</button>
        </div>
        <div class="summary-cards">
          <div class="summary-card">
            <div class="summary-card__value">${formatNumber(summary.totalProjects || 0)}</div>
            <div class="summary-card__label">${t('totalProjects')}</div>
          </div>
          <div class="summary-card">
            <div class="summary-card__value">${formatNumber(summary.averageReadiness || 0)}</div>
            <div class="summary-card__label">${t('avgReadiness')}</div>
          </div>
          <div class="summary-card">
            <div class="summary-card__value">${formatNumber(summary.averageConfidence || 0)}%</div>
            <div class="summary-card__label">${t('avgConfidence')}</div>
          </div>
          <div class="summary-card">
            <div class="summary-card__value">${formatNumber(summary.totalCapital || 0)}</div>
            <div class="summary-card__label">${t('capital')}</div>
          </div>
        </div>
    `;

    if (!projects.length) {
      html += `
        <div class="empty-state">
          <div class="empty-state__icon">🚀</div>
          <h2 class="empty-state__title">${t('noProjectsTitle')}</h2>
          <p class="empty-state__desc">${t('noProjectsDesc')}</p>
          <button class="portal-btn portal-btn--primary" id="emptyNewProject">${t('newProject')}</button>
        </div>
      `;
    } else {
      html += `
        <div class="project-grid">
          ${projects.map(renderProjectCard).join('')}
        </div>
      `;
    }

    html += '</div>';
    main.innerHTML = html;

    const newProjectBtn = el('dashboardNewProject') || el('emptyNewProject');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => openNewProjectWizard());
    }
  }

  function showLoading(message) {
    const main = el('portal-main');
    if (main) main.innerHTML = `<div class="portal-loading"><div class="portal-loading__spinner"></div><p>${escapeHtml(message)}</p></div>`;
  }

  function showError(message) {
    const main = el('portal-main');
    if (main) main.innerHTML = `<div class="portal-error"><p>${escapeHtml(message)}</p><button class="portal-btn" id="errorRetry">${t('close')}</button></div>`;
    const retry = el('errorRetry');
    if (retry) retry.addEventListener('click', () => initDashboard());
  }

  async function initDashboard() {
    await requireAuth();
    injectHeader();
    injectSidebar();
    showLoading(t('loading'));

    try {
      const portfolio = await apiPost('/api/v3/ecc/portfolio', {});
      renderDashboard(portfolio);
      if (new URLSearchParams(window.location.search).has('wizard')) {
        openNewProjectWizard();
      }
    } catch (err) {
      console.error('[PortalV2] dashboard load failed', err);
      showError(t('errorLoading'));
    }
  }

  // ---- New Project Wizard ----

  function sectorOptions() {
    return SECTOR_KEYS.map(key => `<option value="${key}">${t('sector_' + key)}</option>`).join('');
  }

  function renderWizardStep(step, data) {
    if (step === 1) {
      return `
        <div class="wizard-step">
          <h2>${t('wizardStep1')}</h2>
          <div class="portal-form-group">
            <label for="wiz-name">${t('projectName')}</label>
            <input type="text" id="wiz-name" value="${escapeHtml(data.name || '')}" required />
          </div>
          <div class="portal-form-row">
            <div class="portal-form-group">
              <label for="wiz-sector">${t('sector')}</label>
              <select id="wiz-sector" required>
                <option value="">${t('selectPlaceholder')}</option>
                ${sectorOptions()}
              </select>
            </div>
            <div class="portal-form-group">
              <label for="wiz-activity">${t('activity')}</label>
              <input type="text" id="wiz-activity" value="${escapeHtml(data.activity || '')}" />
            </div>
          </div>
          <div class="portal-form-row">
            <div class="portal-form-group">
              <label for="wiz-country">${t('country')}</label>
              <select id="wiz-country" required></select>
            </div>
            <div class="portal-form-group">
              <label for="wiz-governorate">${t('governorate')}</label>
              <select id="wiz-governorate" required></select>
            </div>
            <div class="portal-form-group">
              <label for="wiz-city">${t('city')}</label>
              <select id="wiz-city" required></select>
            </div>
          </div>
        </div>
      `;
    }
    if (step === 2) {
      return `
        <div class="wizard-step">
          <h2>${t('wizardStep2')}</h2>
          <div class="portal-form-row">
            <div class="portal-form-group">
              <label for="wiz-currency">${t('currency')}</label>
              <select id="wiz-currency">
                <option value="SAR" ${data.currency === 'SAR' ? 'selected' : ''}>SAR</option>
                <option value="AED" ${data.currency === 'AED' ? 'selected' : ''}>AED</option>
                <option value="USD" ${data.currency === 'USD' ? 'selected' : ''}>USD</option>
                <option value="EGP" ${data.currency === 'EGP' ? 'selected' : ''}>EGP</option>
                <option value="KWD" ${data.currency === 'KWD' ? 'selected' : ''}>KWD</option>
                <option value="QAR" ${data.currency === 'QAR' ? 'selected' : ''}>QAR</option>
                <option value="BHD" ${data.currency === 'BHD' ? 'selected' : ''}>BHD</option>
                <option value="OMR" ${data.currency === 'OMR' ? 'selected' : ''}>OMR</option>
                <option value="JOD" ${data.currency === 'JOD' ? 'selected' : ''}>JOD</option>
                <option value="LBP" ${data.currency === 'LBP' ? 'selected' : ''}>LBP</option>
                <option value="MAD" ${data.currency === 'MAD' ? 'selected' : ''}>MAD</option>
                <option value="TND" ${data.currency === 'TND' ? 'selected' : ''}>TND</option>
              </select>
            </div>
            <div class="portal-form-group">
              <label for="wiz-capital">${t('investmentCapital')}</label>
              <input type="number" id="wiz-capital" value="${data.capital || ''}" min="0" step="1" required />
            </div>
          </div>
          <div class="portal-form-row">
            <div class="portal-form-group">
              <label for="wiz-revenue">${t('annualRevenue')}</label>
              <input type="number" id="wiz-revenue" value="${data.revenue || ''}" min="0" step="1" required />
            </div>
            <div class="portal-form-group">
              <label for="wiz-profit">${t('annualNetProfit')}</label>
              <input type="number" id="wiz-profit" value="${data.annualProfit || ''}" min="0" step="1" required />
            </div>
          </div>
        </div>
      `;
    }
    // step 3 review
    const cityName = data.city ? (window.BondsGeo ? window.BondsGeo.findCityByCode(data.city)?.city?.name : data.city) : '';
    return `
      <div class="wizard-step">
        <h2>${t('wizardStep3')}</h2>
        <div class="review-list">
          <div class="review-item"><span>${t('projectName')}</span><strong>${escapeHtml(data.name)}</strong></div>
          <div class="review-item"><span>${t('sector')}</span><strong>${t('sector_' + (data.sector || 'other'))}</strong></div>
          <div class="review-item"><span>${t('activity')}</span><strong>${escapeHtml(data.activity)}</strong></div>
          <div class="review-item"><span>${t('city')}</span><strong>${escapeHtml(cityName || data.city)}</strong></div>
          <div class="review-item"><span>${t('currency')}</span><strong>${escapeHtml(data.currency)}</strong></div>
          <div class="review-item"><span>${t('investmentCapital')}</span><strong>${formatNumber(data.capital)}</strong></div>
          <div class="review-item"><span>${t('annualRevenue')}</span><strong>${formatNumber(data.revenue)}</strong></div>
          <div class="review-item"><span>${t('annualNetProfit')}</span><strong>${formatNumber(data.annualProfit)}</strong></div>
        </div>
      </div>
    `;
  }

  function openNewProjectWizard() {
    const main = el('portal-main');
    if (!main) return;

    let step = 1;
    const data = { currency: 'SAR' };
    let geoBinding = null;

    function render() {
      main.innerHTML = `
        <div class="wizard">
          <div class="wizard__header">
            <h2>${t('wizardTitle')}</h2>
            <div class="wizard__steps">
              <span class="wizard__step ${step >= 1 ? 'active' : ''}">1</span>
              <span class="wizard__step ${step >= 2 ? 'active' : ''}">2</span>
              <span class="wizard__step ${step >= 3 ? 'active' : ''}">3</span>
            </div>
          </div>
          <form id="wizardForm" class="wizard__body">
            ${renderWizardStep(step, data)}
            <div class="wizard__actions">
              ${step > 1 ? `<button type="button" class="portal-btn portal-btn--secondary" id="wizardBack">${t('back')}</button>` : ''}
              ${step < 3 ? `<button type="submit" class="portal-btn portal-btn--primary">${t('next')}</button>` : ''}
              ${step === 3 ? `<button type="submit" class="portal-btn portal-btn--primary" id="wizardSubmit">${t('createProject')}</button>` : ''}
              <button type="button" class="portal-btn portal-btn--ghost" id="wizardCancel">${t('cancel')}</button>
            </div>
          </form>
          <div id="wizardMsg" class="portal-msg" style="display:none;margin-top:1rem;"></div>
        </div>
      `;

      if (step === 1 && window.BondsGeo) {
        geoBinding = window.BondsGeo.bindCascading({
          countryId: 'wiz-country',
          governorateId: 'wiz-governorate',
          cityId: 'wiz-city',
          lang: LANG
        });
      }

      // Restore selections
      if (data.sector) el('wiz-sector').value = data.sector;
      if (data.currency) el('wiz-currency').value = data.currency;
      if (step === 1 && data.city && geoBinding) {
        const found = window.BondsGeo.findCityByCode(data.city);
        if (found) {
          geoBinding.setValues(found.countryCode, found.governorateIndex, data.city);
        }
      }

      el('wizardForm').addEventListener('submit', handleSubmit);
      const back = el('wizardBack');
      if (back) back.addEventListener('click', () => { saveStep(); step--; render(); });
      const cancel = el('wizardCancel');
      if (cancel) cancel.addEventListener('click', () => initDashboard());
    }

    function saveStep() {
      if (step === 1) {
        data.name = el('wiz-name').value.trim();
        data.sector = el('wiz-sector').value;
        data.activity = el('wiz-activity').value.trim();
        data.country = el('wiz-country').value;
        data.city = el('wiz-city').value;
      } else if (step === 2) {
        data.currency = el('wiz-currency').value;
        data.capital = Number(el('wiz-capital').value) || 0;
        data.revenue = Number(el('wiz-revenue').value) || 0;
        data.annualProfit = Number(el('wiz-profit').value) || 0;
      }
    }

    async function handleSubmit(e) {
      e.preventDefault();
      saveStep();
      if (step === 1) {
        if (!data.name || !data.sector || !data.city) {
          showWizardMessage('يرجى تعبئة جميع الحقول المطلوبة');
          return;
        }
      }
      if (step < 3) {
        step++;
        render();
        return;
      }
      // Submit
      const submitBtn = el('wizardSubmit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = t('creating');
      }
      try {
        const result = await apiPost('/api/v3/projects', {
          name: data.name,
          sector: data.sector,
          activity: data.activity,
          cityCode: data.city,
          currency: data.currency,
          capital: data.capital,
          revenue: data.revenue,
          annualProfit: data.annualProfit,
          language: LANG
        });
        if (result.project?.id) {
          window.location.replace('/v3/project?id=' + encodeURIComponent(result.project.id));
        } else {
          showWizardMessage(t('errorCreate'));
        }
      } catch (err) {
        console.error('[PortalV2] create project failed', err);
        showWizardMessage(err.message || t('errorCreate'));
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = t('createProject');
        }
      }
    }

    function showWizardMessage(msg) {
      const m = el('wizardMsg');
      if (m) {
        m.textContent = msg;
        m.className = 'portal-msg portal-msg--error';
        m.style.display = 'block';
      }
    }

    render();
  }

  // ---- Legacy page handlers (kept to avoid breaking routes) ----

  function initProject() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      window.location.replace('/v3/project?id=' + encodeURIComponent(id));
    } else {
      window.location.replace(clientPath('index.html'));
    }
  }

  function initReports() {
    const main = el('portal-main');
    if (main) {
      main.innerHTML = `
        <div class="portal-dashboard">
          <div class="empty-state">
            <div class="empty-state__icon">📂</div>
            <h2 class="empty-state__title">${IS_EN ? 'Reports & Analyses' : 'التقارير والتحليلات'}</h2>
            <p class="empty-state__desc">${t('reportsMoved')}</p>
            <a class="portal-btn portal-btn--primary" href="${IS_EN ? '/en/v3/portfolio' : '/v3/portfolio'}">${t('goToPortfolio')}</a>
          </div>
        </div>
      `;
    }
    injectHeader();
    injectSidebar();
  }

  function initReportView() {
    initReports();
  }

  window.BondsClientPortal = {
    initDashboard,
    initProject,
    initReports,
    initReportView
  };
})();
