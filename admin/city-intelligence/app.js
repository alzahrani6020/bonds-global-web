/**
 * City Intelligence SPA
 */
(function (global) {
  'use strict';

  const SVC = global.CityIntelligenceService;

  const state = {
    user: null,
    cities: [],
    districts: [],
    indicators: [],
    projects: [],
    competitors: [],
    reports: [],
    activity: [],
    currentCity: null,
    currentDistrict: null,
    activeTab: 'overview',
    map: null,
    mapLayers: null,
    charts: {}
  };

  const PAGE_TITLES = {
    dashboard: 'لوحة المؤشرات',
    cities: 'المدن',
    city: 'تفاصيل المدينة',
    map: 'الخرائط',
    reports: 'التقارير',
    activity: 'السجل',
    roles: 'إدارة الأدوار'
  };

  // ── Analysis Engine ───────────────────────────────────────────────
  const CityAnalysisEngine = {
    weights: {
      population: 0.15,
      income: 0.15,
      urban_growth: 0.15,
      government_projects: 0.10,
      competition: 0.10,
      land_price: 0.10,
      rent: 0.10,
      commercial_density: 0.15
    },
    defaults: {
      population: 500000,
      households: 150000,
      avg_income: 15000,
      urban_growth_rate: 3.0,
      government_projects_count: 10,
      competition_index: 50,
      land_price_per_sqm: 3000,
      rent_per_sqm: 150,
      commercial_density_score: 50
    },
    normalize(value, max) {
      if (value == null || isNaN(value)) return 0;
      return Math.min(100, Math.max(0, (Number(value) / max) * 100));
    },
    invert(value, max) {
      // Lower competition is better => higher score
      if (value == null || isNaN(value)) return 0;
      return Math.min(100, Math.max(0, ((max - Number(value)) / max) * 100));
    },
    calculateDistrictScore(d) {
      const w = this.weights;
      const defs = this.defaults;
      const score =
        this.normalize(d.population, defs.population) * w.population +
        this.normalize(d.avg_income, defs.avg_income) * w.income +
        this.normalize(d.urban_growth_rate, defs.urban_growth_rate) * w.urban_growth +
        this.normalize(d.government_projects_count, defs.government_projects_count) * w.government_projects +
        this.invert(d.competition_index, 100) * w.competition +
        this.normalize(d.land_price_per_sqm, defs.land_price_per_sqm) * w.land_price +
        this.normalize(d.rent_per_sqm, defs.rent_per_sqm) * w.rent +
        this.normalize(d.commercial_density_score, 100) * w.commercial_density;
      return Math.round(score * 100) / 100;
    },
    calculateCityScore(cityId) {
      const districts = state.districts.filter(d => d.city_id === cityId);
      if (!districts.length) return 0;
      const sum = districts.reduce((acc, d) => acc + (d.investment_score ?? this.calculateDistrictScore(d)), 0);
      return Math.round((sum / districts.length) * 100) / 100;
    },
    rating(score) {
      if (score >= 75) return { label: 'ممتاز', status: 'healthy' };
      if (score >= 50) return { label: 'جيد', status: 'attention' };
      return { label: 'ضعيف', status: 'at-risk' };
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function $$$(sel) { return document.querySelectorAll(sel); }
  function formatNum(n, digits = 0) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('ar-SA', { maximumFractionDigits: digits });
  }
  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('ar-SA');
  }
  // ── UI helpers ─────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast toast--${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function setLoading(el, text = 'جارِ التحميل...') {
    el.innerHTML = `<div class="spinner">${BondsAdminCommon.escapeHtml(text)}</div>`;
  }

  function setSidebar(page) {
    $$$('.sidebar-link').forEach(link => {
      const lp = link.getAttribute('data-page');
      link.classList.toggle('active', lp && page.startsWith(lp));
    });
  }

  function updateUserUI() {
    const user = state.user;
    const name = user?.user_metadata?.full_name || user?.email || 'مدير النظام';
    $('#userName').textContent = name.split('@')[0];
    $('#userAvatar').textContent = name.charAt(0).toUpperCase();
    $('#userRole').textContent = window.__ADMIN_ROLE === 'super_admin' ? 'Super Admin' : 'City Admin';
  }

  // ── Modal ──────────────────────────────────────────────────────────
  function openModal(title, html, onSubmit, submitText = 'حفظ') {
    const overlay = $('#modalOverlay');
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>${BondsAdminCommon.escapeHtml(title)}</h3>
          <button class="modal-close" aria-label="إغلاق">&times;</button>
        </div>
        <div class="modal-body">${html}</div>
        <div class="modal-footer">
          <button class="ecc-btn ecc-btn--ghost" id="modalCancel">إلغاء</button>
          <button class="ecc-btn ecc-btn--primary" id="modalSave">${BondsAdminCommon.escapeHtml(submitText)}</button>
        </div>
      </div>`;
    overlay.classList.add('open');
    overlay.querySelector('.modal-close').onclick = closeModal;
    overlay.querySelector('#modalCancel').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    overlay.querySelector('#modalSave').onclick = async () => {
      const btn = overlay.querySelector('#modalSave');
      btn.disabled = true;
      try {
        await onSubmit();
        closeModal();
      } catch (err) {
        showToast(err.message || 'حدث خطأ', 'error');
      } finally {
        btn.disabled = false;
      }
    };
  }

  function closeModal() {
    const overlay = $('#modalOverlay');
    overlay.classList.remove('open');
    overlay.innerHTML = '';
  }

  // ── Data loading ───────────────────────────────────────────────────
  const Cache = global.BondsAdminModuleCache;
  const CACHE_TTL = 120000; // 2 minutes

  async function loadCities() {
    const cached = Cache && Cache.get('city-intelligence', 'cities', CACHE_TTL);
    if (cached) { state.cities = cached; return; }
    state.cities = await SVC.getCities();
    Cache && Cache.set('city-intelligence', 'cities', state.cities);
  }
  async function loadDistricts() {
    const cached = Cache && Cache.get('city-intelligence', 'districts', CACHE_TTL);
    if (cached) { state.districts = cached; return; }
    state.districts = await SVC.getDistricts();
    Cache && Cache.set('city-intelligence', 'districts', state.districts);
  }
  async function loadIndicators() {
    const cached = Cache && Cache.get('city-intelligence', 'indicators', CACHE_TTL);
    if (cached) { state.indicators = cached; return; }
    state.indicators = await SVC.getIndicatorValues({});
    Cache && Cache.set('city-intelligence', 'indicators', state.indicators);
  }
  async function loadProjects() {
    const cached = Cache && Cache.get('city-intelligence', 'projects', CACHE_TTL);
    if (cached) { state.projects = cached; return; }
    state.projects = await SVC.getProjects();
    Cache && Cache.set('city-intelligence', 'projects', state.projects);
  }
  async function loadCompetitors() {
    const cached = Cache && Cache.get('city-intelligence', 'competitors', CACHE_TTL);
    if (cached) { state.competitors = cached; return; }
    state.competitors = await SVC.getCompetitors();
    Cache && Cache.set('city-intelligence', 'competitors', state.competitors);
  }
  async function loadReports() {
    const cached = Cache && Cache.get('city-intelligence', 'reports', CACHE_TTL);
    if (cached) { state.reports = cached; return; }
    state.reports = await SVC.getReports();
    Cache && Cache.set('city-intelligence', 'reports', state.reports);
  }
  async function loadActivity() {
    state.activity = await SVC.getActivity(100);
  }

  async function refreshAll() {
    Cache && Cache.invalidate('city-intelligence');
    await Promise.all([loadCities(), loadDistricts(), loadIndicators(), loadProjects(), loadCompetitors(), loadReports()]);
  }

  // ── Router ─────────────────────────────────────────────────────────
  function parseHash() {
    const hash = location.hash.replace(/^#/, '') || 'dashboard';
    const [page, id, tab] = hash.split('/');
    return { page, id, tab };
  }

  async function router() {
    const { page, id, tab } = parseHash();
    const app = $('#app');
    setSidebar(page);

    try {
      switch (page) {
        case 'cities':
          await loadCities();
          renderCities(app);
          break;
        case 'city':
          await loadCities();
          state.currentCity = state.cities.find(c => c.id === id) || null;
          if (!state.currentCity) { location.hash = '#cities'; return; }
          await Promise.all([loadDistricts(), loadIndicators(), loadProjects(), loadCompetitors(), loadReports()]);
          state.activeTab = tab || 'overview';
          renderCityDetail(app);
          break;
        case 'map':
          await loadCities();
          await loadDistricts();
          renderMapPage(app);
          break;
        case 'reports':
          await loadReports();
          await loadCities();
          renderReportsPage(app);
          break;
        case 'activity':
          await loadActivity();
          renderActivityPage(app);
          break;
        case 'roles':
          await renderRolesPage(app);
          break;
        default:
          await refreshAll();
          renderDashboard(app);
      }
    } catch (err) {
      console.error(err);
      app.innerHTML = `<div class="empty-state"><h4>خطأ في التحميل</h4><p>${BondsAdminCommon.escapeHtml(err.message)}</p></div>`;
    }
  }

  // ── Dashboard ──────────────────────────────────────────────────────
  function renderDashboard(container) {
    const totalCities = state.cities.length;
    const totalDistricts = state.districts.length;
    const avgScore = totalDistricts
      ? state.districts.reduce((a, d) => a + (d.investment_score ?? CityAnalysisEngine.calculateDistrictScore(d)), 0) / totalDistricts
      : 0;
    const highOpportunity = state.districts.filter(d => (d.investment_score ?? CityAnalysisEngine.calculateDistrictScore(d)) >= 75).length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${PAGE_TITLES.dashboard}</h1>
          <p>نظرة عامة على المدن والأحياء والفرص الاستثمارية</p>
        </div>
        <div class="top-actions">
          <button class="ecc-btn ecc-btn--primary" onclick="CityIntelligenceApp.openCityModal()">+ مدينة جديدة</button>
          <button class="ecc-btn ecc-btn--ghost" onclick="location.hash='#map'">فتح الخريطة</button>
        </div>
      </div>
      <div class="ecc-grid-4">
        <div class="ecc-metric">
          <div class="ci-metric-icon ci-metric-icon--gold"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#88C9F9" d="M32 0H4C1.791 0 0 1.791 0 4v22h36V4c0-2.209-1.791-4-4-4z"/><path fill="#66757F" d="M10 36V7l4-4h2l4 4v29zm23-25c0-1-1-1-1-1h-7s-1 0-1 1v25h9V11z"/><path fill="#292F33" d="M28 17c0-1-1-1-1-1h-8c-1 0-1 1-1 1v19h10V17zm-17 2H6v-5s0-1-1-1H0v19c0 2.209 1.791 4 4 4h8V20s0-1-1-1zm21 6c-1 0-1 1-1 1v10h1c2.209 0 4-1.791 4-4v-7h-4z"/><path d="M8 29h2v2H8zm0-8h2v2H8zm-2 4h2v2H6zM16 9h2v2h-2zm0 4h2v2h-2zm-2 4h2v2h-2zm10 1h2v2h-2zm-2 4h2v2h-2zm-2 6h2v2h-2zm9-16h2v2h-2zm0 4h2v2h-2z" fill="#FFCC4D"/></svg></div>
          <div class="ecc-metric__value">${formatNum(totalCities)}</div>
          <div class="ecc-metric__label">المدن</div>
        </div>
        <div class="ecc-metric">
          <div class="ci-metric-icon ci-metric-icon--blue"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><ellipse fill="#292F33" cx="18" cy="34.5" rx="4" ry="1.5"/><path fill="#99AAB5" d="M14.339 10.725S16.894 34.998 18.001 35c1.106.001 3.66-24.275 3.66-24.275h-7.322z"/><circle fill="#DD2E44" cx="18" cy="8" r="8"/></svg></div>
          <div class="ecc-metric__value">${formatNum(totalDistricts)}</div>
          <div class="ecc-metric__label">الأحياء</div>
        </div>
        <div class="ecc-metric">
          <div class="ci-metric-icon ci-metric-icon--green"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFAC33" d="M27.287 34.627c-.404 0-.806-.124-1.152-.371L18 28.422l-8.135 5.834c-.693.496-1.623.496-2.312-.008-.689-.499-.979-1.385-.721-2.194l3.034-9.792-8.062-5.681c-.685-.505-.97-1.393-.708-2.203.264-.808 1.016-1.357 1.866-1.363L12.947 13l3.179-9.549c.268-.809 1.023-1.353 1.874-1.353.851 0 1.606.545 1.875 1.353L23 13l10.036.015c.853.006 1.606.556 1.867 1.363.263.81-.022 1.698-.708 2.203l-8.062 5.681 3.034 9.792c.26.809-.033 1.695-.72 2.194-.347.254-.753.379-1.16.379z"/></svg></div>
          <div class="ecc-metric__value">${formatNum(avgScore, 1)}</div>
          <div class="ecc-metric__label">متوسط درجة الاستثمار</div>
        </div>
        <div class="ecc-metric">
          <div class="ci-metric-icon ci-metric-icon--purple"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#A0041E" d="M1 17l8-7 16 1 1 16-7 8s.001-5.999-6-12-12-6-12-6z"/><path fill="#FFAC33" d="M.973 35s-.036-7.979 2.985-11S15 21.187 15 21.187 14.999 29 11.999 32c-3 3-11.026 3-11.026 3z"/><circle fill="#FFCC4D" cx="8.999" cy="27" r="4"/><path fill="#55ACEE" d="M35.999 0s-10 0-22 10c-6 5-6 14-4 16s11 2 16-4c10-12 10-22 10-22z"/><path d="M26.999 5c-1.623 0-3.013.971-3.641 2.36.502-.227 1.055-.36 1.641-.36 2.209 0 4 1.791 4 4 0 .586-.133 1.139-.359 1.64 1.389-.627 2.359-2.017 2.359-3.64 0-2.209-1.791-4-4-4z"/><path fill="#A0041E" d="M8 28s0-4 1-5 13.001-10.999 14-10-9.001 13-10.001 14S8 28 8 28z"/></svg></div>
          <div class="ecc-metric__value">${formatNum(highOpportunity)}</div>
          <div class="ecc-metric__label">فرص عالية (≥75)</div>
        </div>
      </div>
      <div class="section-row">
        <div class="ecc-card">
          <h3><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFAC33" d="M5.123 5h6C12.227 5 13 4.896 13 6V4c0-1.104-.773-2-1.877-2h-8c-2 0-3.583 2.125-3 5 0 0 1.791 9.375 1.917 9.958C2.373 18.5 4.164 20 6.081 20h6.958c1.105 0-.039-1.896-.039-3v-2c0 1.104-.773 2-1.877 2h-4c-1.104 0-1.833-1.042-2-2S3.539 7.667 3.539 7.667C3.206 5.75 4.018 5 5.123 5zm25.812 0h-6C23.831 5 22 4.896 22 6V4c0-1.104 1.831-2 2.935-2h8c2 0 3.584 2.125 3 5 0 0-1.633 9.419-1.771 10-.354 1.5-2.042 3-4 3h-7.146C21.914 20 22 18.104 22 17v-2c0 1.104 1.831 2 2.935 2h4c1.104 0 1.834-1.042 2-2s1.584-7.333 1.584-7.333C32.851 5.75 32.04 5 30.935 5zM20.832 22c0-6.958-2.709 0-2.709 0s-3-6.958-3 0-3.291 10-3.291 10h12.292c-.001 0-3.292-3.042-3.292-10z"/><path fill="#FFCC4D" d="M29.123 6.577c0 6.775-6.77 18.192-11 18.192-4.231 0-11-11.417-11-18.192 0-5.195 1-6.319 3-6.319 1.374 0 6.025-.027 8-.027l7-.001c2.917-.001 4 .684 4 6.347z"/><path fill="#C1694F" d="M27 33c0 1.104.227 2-.877 2h-16C9.018 35 9 34.104 9 33v-1c0-1.104 1.164-2 2.206-2h13.917c1.042 0 1.877.896 1.877 2v1z"/><path fill="#C1694F" d="M29 34.625c0 .76.165 1.375-1.252 1.375H8.498C7.206 36 7 35.385 7 34.625v-.25C7 33.615 7.738 33 8.498 33h19.25c.759 0 1.252.615 1.252 1.375v.25z"/></svg> أفضل الأحياء</h3>
          <div class="ecc-chart"><canvas id="topDistrictsChart"></canvas></div>
        </div>
        <div class="ecc-card">
          <h3><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#5C913B" d="M13 33H7V16c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v17z"/><path fill="#3B94D9" d="M29 33h-6V9c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v24z"/><path fill="#DD2E44" d="M21 33h-6V23c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v10z"/></svg> توزيع التقييمات</h3>
          <div class="ecc-chart"><canvas id="scoreDistChart"></canvas></div>
        </div>
      </div>
      <div class="ecc-card ecc-form-group--full">
        <h3><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#DD2E44" d="M4.998 33c-.32 0-.645-.076-.946-.239-.973-.523-1.336-1.736-.813-2.709l7-13c.299-.557.845-.939 1.47-1.031.626-.092 1.258.118 1.705.565l6.076 6.076 9.738-18.59c.512-.978 1.721-1.357 2.699-.843.979.512 1.356 1.721.844 2.7l-11 21c-.295.564-.841.953-1.47 1.05-.627.091-1.266-.113-1.716-.563l-6.1-6.099-5.724 10.631C6.4 32.619 5.71 33 4.998 33z"/></svg> مؤشرات الأداء</h3>
        <div class="ecc-chart"><canvas id="radarChart"></canvas></div>
      </div>`;

    renderDashboardCharts();
  }

  function renderDashboardCharts() {
    const topDistricts = [...state.districts]
      .map(d => ({ ...d, score: d.investment_score ?? CityAnalysisEngine.calculateDistrictScore(d) }))
      .sort((a, b) => b.score - a.score).slice(0, 6);

    destroyChart('topDistricts');
    state.charts.topDistricts = new Chart(document.getElementById('topDistrictsChart'), {
      type: 'bar',
      data: {
        labels: topDistricts.map(d => d.name),
        datasets: [{
          label: 'درجة الاستثمار',
          data: topDistricts.map(d => d.score),
          backgroundColor: 'rgba(184,149,78,0.75)',
          borderRadius: 6
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }
    });

    const dist = [0, 0, 0]; // low, medium, high
    state.districts.forEach(d => {
      const s = d.investment_score ?? CityAnalysisEngine.calculateDistrictScore(d);
      if (s >= 75) dist[2]++; else if (s >= 50) dist[1]++; else dist[0]++;
    });
    destroyChart('scoreDist');
    state.charts.scoreDist = new Chart(document.getElementById('scoreDistChart'), {
      type: 'doughnut',
      data: {
        labels: ['ضعيف', 'جيد', 'ممتاز'],
        datasets: [{ data: dist, backgroundColor: ['#ef4444', '#eab308', '#22c55e'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    destroyChart('radar');
    state.charts.radar = new Chart(document.getElementById('radarChart'), {
      type: 'radar',
      data: {
        labels: Object.values(SVC.INDICATOR_KEYS),
        datasets: [{
          label: 'متوسط المؤشرات',
          data: Object.keys(SVC.INDICATOR_KEYS).map(key => averageIndicator(key)),
          backgroundColor: 'rgba(184,149,78,0.2)',
          borderColor: '#b8954e',
          pointBackgroundColor: '#b8954e'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 100 } } }
    });
  }

  function averageIndicator(key) {
    const vals = state.indicators.filter(i => i.indicator_key === key && i.value_numeric != null);
    if (!vals.length) return 0;
    const sum = vals.reduce((a, i) => a + Number(i.value_numeric), 0);
    return Math.round((sum / vals.length) * 100) / 100;
  }

  function destroyChart(name) {
    if (state.charts[name]) { state.charts[name].destroy(); state.charts[name] = null; }
  }

  // ── Cities list ────────────────────────────────────────────────────
  function renderCities(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>${PAGE_TITLES.cities}</h1><p>إدارة المدن المغطاة</p></div>
        <button class="ecc-btn ecc-btn--primary" onclick="CityIntelligenceApp.openCityModal()">+ مدينة جديدة</button>
      </div>
      <div class="city-grid" id="cityGrid"></div>`;
    const grid = $('#cityGrid');
    if (!state.cities.length) {
      grid.innerHTML = `<div class="empty-state ecc-card ecc-form-group--full"><h4>لا توجد مدن</h4><p>أضف أول مدينة لبدء التحليل</p></div>`;
      return;
    }
    grid.innerHTML = state.cities.map(c => {
      const cityDistricts = state.districts.filter(d => d.city_id === c.id);
      const score = CityAnalysisEngine.calculateCityScore(c.id);
      const rating = CityAnalysisEngine.rating(score);
      return `
        <div class="city-card" onclick="location.hash='#city/${c.id}'">
          <div class="city-card__name">${BondsAdminCommon.escapeHtml(c.name)}</div>
          <div class="city-card__meta">${BondsAdminCommon.escapeHtml(c.region || '')} · ${formatNum(cityDistricts.length)} حي</div>
          <span class="status-badge status-badge--${rating.status}">${formatNum(score, 1)} · ${rating.label}</span>
        </div>`;
    }).join('');
  }

  // ── City detail ────────────────────────────────────────────────────
  function renderCityDetail(container) {
    const city = state.currentCity;
    const cityDistricts = state.districts.filter(d => d.city_id === city.id);
    const score = CityAnalysisEngine.calculateCityScore(city.id);
    const rating = CityAnalysisEngine.rating(score);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${BondsAdminCommon.escapeHtml(city.name)} <span class="status-badge status-badge--${rating.status}">${formatNum(score, 1)} · ${rating.label}</span></h1>
          <p>${BondsAdminCommon.escapeHtml(city.region || '')} · ${formatNum(cityDistricts.length)} حي</p>
        </div>
        <div class="top-actions">
          <button class="ecc-btn ecc-btn--primary" onclick="CityIntelligenceApp.openDistrictModal('${city.id}')">+ حي</button>
          <button class="ecc-btn ecc-btn--ghost" onclick="CityIntelligenceApp.openCityModal('${city.id}')">تعديل المدينة</button>
          <button class="ecc-btn ecc-btn--ghost" onclick="CityIntelligenceApp.generateCityReport('${city.id}')"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#E1E8ED" d="M32.415 9.586l-9-9C23.054.225 22.553 0 22 0c-1.104 0-1.999.896-2 2 0 .552.224 1.053.586 1.415l-3.859 3.859 9 9 3.859-3.859c.362.361.862.585 1.414.585 1.104 0 2.001-.896 2-2 0-.552-.224-1.052-.585-1.414z"/><path fill="#CCD6DD" d="M22 0H7C4.791 0 3 1.791 3 4v28c0 2.209 1.791 4 4 4h22c2.209 0 4-1.791 4-4V11h-9c-1 0-2-1-2-2V0z"/><path fill="#99AAB5" d="M22 0h-2v9c0 2.209 1.791 4 4 4h9v-2h-9c-1 0-2-1-2-2V0zm-5 8c0 .552-.448 1-1 1H8c-.552 0-1-.448-1-1s.448-1 1-1h8c.552 0 1 .448 1 1zm0 4c0 .552-.448 1-1 1H8c-.552 0-1-.448-1-1s.448-1 1-1h8c.552 0 1 .448 1 1zm12 4c0 .552-.447 1-1 1H8c-.552 0-1-.448-1-1s.448-1 1-1h20c.553 0 1 .448 1 1zm0 4c0 .553-.447 1-1 1H8c-.552 0-1-.447-1-1 0-.553.448-1 1-1h20c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1H8c-.552 0-1-.447-1-1 0-.553.448-1 1-1h20c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1H8c-.552 0-1-.447-1-1 0-.553.448-1 1-1h20c.553 0 1 .447 1 1z"/></svg> تقرير PDF</button>
          <button class="ecc-btn ecc-btn--ghost ci-btn-danger ecc-btn--sm" onclick="CityIntelligenceApp.deleteCity('${city.id}')">حذف</button>
        </div>
      </div>
      <div class="ecc-tabs">
        <button class="ecc-tab ${state.activeTab === 'overview' ? 'active' : ''}" data-tab="overview" onclick="CityIntelligenceApp.setTab('overview')">نظرة عامة</button>
        <button class="ecc-tab ${state.activeTab === 'districts' ? 'active' : ''}" data-tab="districts" onclick="CityIntelligenceApp.setTab('districts')">الأحياء</button>
        <button class="ecc-tab ${state.activeTab === 'projects' ? 'active' : ''}" data-tab="projects" onclick="CityIntelligenceApp.setTab('projects')">المشاريع</button>
        <button class="ecc-tab ${state.activeTab === 'competitors' ? 'active' : ''}" data-tab="competitors" onclick="CityIntelligenceApp.setTab('competitors')">المنافسون</button>
        <button class="ecc-tab ${state.activeTab === 'reports' ? 'active' : ''}" data-tab="reports" onclick="CityIntelligenceApp.setTab('reports')">تقارير</button>
        <button class="ecc-tab ${state.activeTab === 'ai' ? 'active' : ''}" data-tab="ai" onclick="CityIntelligenceApp.setTab('ai')"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><ellipse fill="#F4900C" cx="33.5" cy="14.5" rx="2.5" ry="3.5"/><ellipse fill="#F4900C" cx="2.5" cy="14.5" rx="2.5" ry="3.5"/><path fill="#FFAC33" d="M34 19c0 .553-.447 1-1 1h-3c-.553 0-1-.447-1-1v-9c0-.552.447-1 1-1h3c.553 0 1 .448 1 1v9zM7 19c0 .553-.448 1-1 1H3c-.552 0-1-.447-1-1v-9c0-.552.448-1 1-1h3c.552 0 1 .448 1 1v9z"/><path fill="#FFCC4D" d="M28 5c0 2.761-4.478 4-10 4C12.477 9 8 7.761 8 5s4.477-5 10-5c5.522 0 10 2.239 10 5z"/><path fill="#F4900C" d="M25 4.083C25 5.694 21.865 7 18 7c-3.866 0-7-1.306-7-2.917 0-1.611 3.134-2.917 7-2.917 3.865 0 7 1.306 7 2.917z"/><path fill="#269" d="M30 5.5C30 6.881 28.881 7 27.5 7h-19C7.119 7 6 6.881 6 5.5S7.119 3 8.5 3h19C28.881 3 30 4.119 30 5.5z"/><path fill="#55ACEE" d="M30 6H6c-1.104 0-2 .896-2 2v26h28V8c0-1.104-.896-2-2-2z"/><path fill="#3B88C3" d="M35 33v-1c0-1.104-.896-2-2-2H22.071l-3.364 3.364c-.391.391-1.023.391-1.414 0L13.929 30H3c-1.104 0-2 .896-2 2v1c0 1.104-.104 2 1 2h32c1.104 0 1-.896 1-2z"/><circle fill="#FFF" cx="24.5" cy="14.5" r="4.5"/><circle fill="#DD2E44" cx="24.5" cy="14.5" r="2.721"/><circle fill="#FFF" cx="11.5" cy="14.5" r="4.5"/><path fill="#F5F8FA" d="M29 25.5c0 1.381-1.119 2.5-2.5 2.5h-17C8.119 28 7 26.881 7 25.5S8.119 23 9.5 23h17c1.381 0 2.5 1.119 2.5 2.5z"/><path fill="#CCD6DD" d="M17 23h2v5h-2zm-5 0h2v5h-2zm10 0h2v5h-2zM7 25.5c0 1.21.859 2.218 2 2.45v-4.9c-1.141.232-2 1.24-2 2.45zm20-2.45v4.899c1.141-.232 2-1.24 2-2.45s-.859-2.217-2-2.449z"/><circle fill="#DD2E44" cx="11.5" cy="14.5" r="2.721"/></svg> AI</button>
      </div>
      <div id="cityTabContent"></div>
      <div id="reportCapture" class="print-capture"></div>`;

    renderCityTab();
  }

  function renderCityTab() {
    const tab = state.activeTab;
    const content = $('#cityTabContent');
    const city = state.currentCity;
    if (tab === 'overview') renderOverviewTab(content, city);
    else if (tab === 'districts') renderDistrictsTab(content, city);
    else if (tab === 'projects') renderProjectsTab(content, city);
    else if (tab === 'competitors') renderCompetitorsTab(content, city);
    else if (tab === 'reports') renderCityReportsTab(content, city);
    else if (tab === 'ai') renderAiTab(content, city);
  }

  function renderAiTab(content, city) {
    const districts = state.districts.filter(d => d.city_id === city.id);
    const avgIncome = districts.length
      ? Math.round(districts.reduce((s, d) => s + (Number(d.avg_income) || 0), 0) / districts.length)
      : city.avg_income || 15000;
    const population = city.population || districts.reduce((s, d) => s + (Number(d.population) || 0), 0) || 500000;
    const competitors = state.competitors.filter(c => c.city_id === city.id);
    content.innerHTML = `
      <div class="ecc-card ecc-form-group--full">
        <h3><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><ellipse fill="#F4900C" cx="33.5" cy="14.5" rx="2.5" ry="3.5"/><ellipse fill="#F4900C" cx="2.5" cy="14.5" rx="2.5" ry="3.5"/><path fill="#FFAC33" d="M34 19c0 .553-.447 1-1 1h-3c-.553 0-1-.447-1-1v-9c0-.552.447-1 1-1h3c.553 0 1 .448 1 1v9zM7 19c0 .553-.448 1-1 1H3c-.552 0-1-.447-1-1v-9c0-.552.448-1 1-1h3c.552 0 1 .448 1 1v9z"/><path fill="#FFCC4D" d="M28 5c0 2.761-4.478 4-10 4C12.477 9 8 7.761 8 5s4.477-5 10-5c5.522 0 10 2.239 10 5z"/><path fill="#F4900C" d="M25 4.083C25 5.694 21.865 7 18 7c-3.866 0-7-1.306-7-2.917 0-1.611 3.134-2.917 7-2.917 3.865 0 7 1.306 7 2.917z"/><path fill="#269" d="M30 5.5C30 6.881 28.881 7 27.5 7h-19C7.119 7 6 6.881 6 5.5S7.119 3 8.5 3h19C28.881 3 30 4.119 30 5.5z"/><path fill="#55ACEE" d="M30 6H6c-1.104 0-2 .896-2 2v26h28V8c0-1.104-.896-2-2-2z"/><path fill="#3B88C3" d="M35 33v-1c0-1.104-.896-2-2-2H22.071l-3.364 3.364c-.391.391-1.023.391-1.414 0L13.929 30H3c-1.104 0-2 .896-2 2v1c0 1.104-.104 2 1 2h32c1.104 0 1-.896 1-2z"/><circle fill="#FFF" cx="24.5" cy="14.5" r="4.5"/><circle fill="#DD2E44" cx="24.5" cy="14.5" r="2.721"/><circle fill="#FFF" cx="11.5" cy="14.5" r="4.5"/><path fill="#F5F8FA" d="M29 25.5c0 1.381-1.119 2.5-2.5 2.5h-17C8.119 28 7 26.881 7 25.5S8.119 23 9.5 23h17c1.381 0 2.5 1.119 2.5 2.5z"/><path fill="#CCD6DD" d="M17 23h2v5h-2zm-5 0h2v5h-2zm10 0h2v5h-2zM7 25.5c0 1.21.859 2.218 2 2.45v-4.9c-1.141.232-2 1.24-2 2.45zm20-2.45v4.899c1.141-.232 2-1.24 2-2.45s-.859-2.217-2-2.449z"/><circle fill="#DD2E44" cx="11.5" cy="14.5" r="2.721"/></svg> تحليل AI للمدينة</h3>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:1rem;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#3B88C3" d="M0 4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4z"/><path fill="#FFF" d="M20.512 8.071c0 1.395-1.115 2.573-2.511 2.573-1.333 0-2.511-1.209-2.511-2.573 0-1.271 1.178-2.45 2.511-2.45 1.333.001 2.511 1.148 2.511 2.45zm-4.744 6.728c0-1.488.931-2.481 2.232-2.481 1.302 0 2.232.992 2.232 2.481v11.906c0 1.488-.93 2.48-2.232 2.48s-2.232-.992-2.232-2.48V14.799z"/></svg> هذا التحليل يستخدم محركاً قاعدياً (Rule-Based) يعتمد على بيانات المدن المدخلة.</p>
        <div class="ecc-grid-2 ci-mt-4">
          <div class="form-group"><label>القطاع المستهدف</label><input type="text" id="ai-city-sector" value="التجزئة" /></div>
          <div class="form-group"><label>السكان</label><input type="number" id="ai-city-population" value="${population}" /></div>
          <div class="form-group"><label>متوسط الدخل</label><input type="number" id="ai-city-income" value="${avgIncome}" /></div>
          <div class="form-group"><label>عدد المنافسين</label><input type="number" id="ai-city-competitors" value="${competitors.length || 10}" /></div>
          <div class="form-group ecc-form-group--full"><label>حجم السوق التقديري (ر.س)</label><input type="number" id="ai-city-market" value="" placeholder="اختياري" /></div>
        </div>
        <div class="ci-mt-4">
          <button class="ecc-btn ecc-btn--primary" id="ai-city-run" onclick="CityIntelligenceApp.runCityAi()">تشغيل التحليل</button>
          <span id="ai-city-cost" class="ci-text-secondary" style="font-size:0.85rem;margin-right:1rem;"></span>
        </div>
      </div>
      <div id="ai-city-result" class="ecc-card ecc-form-group--full is-hidden ci-mt-6"></div>
    `;
  }

  async function runCityAi() {
    const btn = document.getElementById('ai-city-run');
    const costEl = document.getElementById('ai-city-cost');
    const resultEl = document.getElementById('ai-city-result');
    const city = state.currentCity;
    btn.disabled = true;
    costEl.textContent = 'جارِ التحليل...';
    resultEl.classList.add('is-hidden');
    try {
      const payload = {
        city: city.name,
        sector: document.getElementById('ai-city-sector').value,
        population: Number(document.getElementById('ai-city-population').value) || null,
        market_size: Number(document.getElementById('ai-city-market').value) || null,
        competitors_count: Number(document.getElementById('ai-city-competitors').value) || null,
        avg_income: Number(document.getElementById('ai-city-income').value) || null,
      };
      const res = await AiAnalyzeService.analyze({ type: 'city_analysis', payload });
      resultEl.innerHTML = '<h3>نتيجة تحليل المدينة</h3>' + AiAnalyzeService.renderResult(res.result);
      resultEl.classList.remove('is-hidden');
      costEl.textContent = res.usage ? `التكلفة: $${res.usage.cost_usd || 0}` : '';
    } catch (err) {
      resultEl.innerHTML = `<p class="ci-text-danger"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#DD2E44" d="M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z"/></svg> ${BondsAdminCommon.escapeHtml(err.message)}</p>`;
      resultEl.classList.remove('is-hidden');
      costEl.textContent = '';
    } finally {
      btn.disabled = false;
    }
  }

  function renderOverviewTab(content, city) {
    const score = CityAnalysisEngine.calculateCityScore(city.id);
    const indicatorBars = Object.keys(SVC.INDICATOR_KEYS).map(key => {
      const avg = averageIndicatorForCity(city.id, key);
      return `
        <div class="indicator-bar">
          <div class="indicator-bar__label">${SVC.INDICATOR_KEYS[key]}</div>
          <div class="indicator-bar__track"><div class="indicator-bar__fill" style="width:${Math.min(100, avg)}%"></div></div>
          <div class="indicator-bar__value">${formatNum(avg, 1)}</div>
        </div>`;
    }).join('');

    content.innerHTML = `
      <div class="section-row">
        <div class="ecc-card ci-text-center">
          <h3>درجة الاستثمار الإجمالية</h3>
          <div class="score-ring"><span>${formatNum(score, 1)}</span></div>
          <p class="ci-text-secondary" style="font-size:0.9rem;">${CityAnalysisEngine.rating(score).label}</p>
        </div>
        <div class="ecc-card">
          <h3><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#BE1931" d="M23.651 23.297L12.702 12.348l9.386-7.821 9.385 9.385z"/><path fill="#DD2E44" d="M34.6 13.912c-1.727 1.729-4.528 1.729-6.255 0l-6.257-6.256c-1.729-1.727-1.729-4.53 0-6.258 1.726-1.727 4.528-1.727 6.257 0L34.6 7.656c1.728 1.727 1.728 4.529 0 6.256z"/><path fill="#99AAB5" d="M14 17.823S-.593 35.029.188 35.813C.97 36.596 18.177 22 18.177 22L14 17.823z"/><path fill="#DD2E44" d="M25.215 27.991c-1.726 1.729-4.528 1.729-6.258 0L8.009 17.041c-1.727-1.728-1.727-4.528 0-6.256 1.728-1.729 4.53-1.729 6.258 0l10.948 10.949c1.728 1.729 1.728 4.528 0 6.257z"/></svg> بيانات المدينة</h3>
          <div class="ci-grid-1">
            <div class="form-group"><label>السكان</label><input type="text" value="${formatNum(city.population)}" readonly /></div>
            <div class="form-group"><label>المساحة (كم²)</label><input type="text" value="${formatNum(city.area_km2, 2)}" readonly /></div>
            <div class="form-group"><label>الإحداثيات</label><input type="text" value="${formatNum(city.center_lat, 4)}, ${formatNum(city.center_lng, 4)}" readonly /></div>
          </div>
        </div>
      </div>
      <div class="ecc-card ecc-form-group--full">
        <h3><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#5C913B" d="M13 33H7V16c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v17z"/><path fill="#3B94D9" d="M29 33h-6V9c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v24z"/><path fill="#DD2E44" d="M21 33h-6V23c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v10z"/></svg> المؤشرات الرئيسية</h3>
        ${indicatorBars}
      </div>
      <div class="ecc-card ecc-form-group--full">
        <h3><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#DD2E44" d="M4.998 33c-.32 0-.645-.076-.946-.239-.973-.523-1.336-1.736-.813-2.709l7-13c.299-.557.845-.939 1.47-1.031.626-.092 1.258.118 1.705.565l6.076 6.076 9.738-18.59c.512-.978 1.721-1.357 2.699-.843.979.512 1.356 1.721.844 2.7l-11 21c-.295.564-.841.953-1.47 1.05-.627.091-1.266-.113-1.716-.563l-6.1-6.099-5.724 10.631C6.4 32.619 5.71 33 4.998 33z"/></svg> تحليل المؤشرات</h3>
        <div class="ecc-chart"><canvas id="cityRadarChart"></canvas></div>
      </div>`;

    const scoreRing = content.querySelector('.score-ring');
    if (scoreRing) scoreRing.style.setProperty('--score', score);
    destroyChart('cityRadar');
    state.charts.cityRadar = new Chart(document.getElementById('cityRadarChart'), {
      type: 'radar',
      data: {
        labels: Object.values(SVC.INDICATOR_KEYS),
        datasets: [{
          label: city.name,
          data: Object.keys(SVC.INDICATOR_KEYS).map(key => averageIndicatorForCity(city.id, key)),
          backgroundColor: 'rgba(59,130,246,0.15)',
          borderColor: '#3b82f6',
          pointBackgroundColor: '#3b82f6'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 100 } } }
    });
  }

  function averageIndicatorForCity(cityId, key) {
    const vals = state.indicators.filter(i => i.city_id === cityId && i.indicator_key === key && i.value_numeric != null);
    if (!vals.length) return 0;
    return vals.reduce((a, i) => a + Number(i.value_numeric), 0) / vals.length;
  }

  function renderDistrictsTab(content, city) {
    const rows = state.districts.filter(d => d.city_id === city.id).map(d => {
      const score = d.investment_score ?? CityAnalysisEngine.calculateDistrictScore(d);
      const rating = CityAnalysisEngine.rating(score);
      return `
        <tr>
          <td><strong>${BondsAdminCommon.escapeHtml(d.name)}</strong></td>
          <td>${formatNum(d.population)}</td>
          <td>${formatNum(d.avg_income)} ر.س</td>
          <td>${formatNum(d.urban_growth_rate, 1)}%</td>
          <td><span class="status-badge status-badge--${rating.status}">${formatNum(score, 1)}</span></td>
          <td>
            <button class="ecc-btn ecc-btn--ghost ecc-btn--sm" onclick="CityIntelligenceApp.openDistrictModal('${city.id}', '${d.id}')">تعديل</button>
            <button class="ecc-btn ecc-btn--ghost ci-btn-danger ecc-btn--sm" onclick="CityIntelligenceApp.deleteDistrict('${d.id}')">حذف</button>
          </td>
        </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="table-card">
        <div class="table-header"><h3>الأحياء (${formatNum(state.districts.filter(d => d.city_id === city.id).length)})</h3></div>
        <table class="ecc-table">
          <thead><tr><th>الحي</th><th>السكان</th><th>متوسط الدخل</th><th>النمو العمراني</th><th>الدرجة</th><th>إجراءات</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty-state">لا توجد أحياء</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function renderProjectsTab(content, city) {
    const rows = state.projects.filter(p => p.city_id === city.id).map(p => `
      <tr>
        <td><strong>${BondsAdminCommon.escapeHtml(p.name)}</strong></td>
        <td>${BondsAdminCommon.escapeHtml(p.project_type || '—')}</td>
        <td><span class="status-badge status-badge--${p.status === 'planned' ? 'neutral' : (p.status === 'ongoing' ? 'attention' : (p.status === 'completed' ? 'healthy' : 'neutral'))}">${projectStatusLabel(p.status)}</span></td>
        <td>${formatNum(p.budget)} ر.س</td>
        <td>${formatDate(p.start_date)}</td>
        <td>
          <button class="ecc-btn ecc-btn--ghost ecc-btn--sm" onclick="CityIntelligenceApp.openProjectModal('${city.id}', '${p.id}')">تعديل</button>
          <button class="ecc-btn ecc-btn--ghost ci-btn-danger ecc-btn--sm" onclick="CityIntelligenceApp.deleteProject('${p.id}')">حذف</button>
        </td>
      </tr>`).join('');

    content.innerHTML = `
      <div class="top-actions ci-mb-4">
        <button class="ecc-btn ecc-btn--primary" onclick="CityIntelligenceApp.openProjectModal('${city.id}')">+ مشروع</button>
      </div>
      <div class="table-card">
        <table class="ecc-table">
          <thead><tr><th>المشروع</th><th>النوع</th><th>الحالة</th><th>الميزانية</th><th>البداية</th><th>إجراءات</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty-state">لا توجد مشاريع</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function renderCompetitorsTab(content, city) {
    const rows = state.competitors.filter(c => c.city_id === city.id).map(c => `
      <tr>
        <td><strong>${BondsAdminCommon.escapeHtml(c.name)}</strong></td>
        <td>${BondsAdminCommon.escapeHtml(c.category || '—')}</td>
        <td>${formatNum(c.market_share_estimate, 1)}%</td>
        <td>${BondsAdminCommon.escapeHtml(c.notes || '—')}</td>
        <td>
          <button class="ecc-btn ecc-btn--ghost ecc-btn--sm" onclick="CityIntelligenceApp.openCompetitorModal('${city.id}', '${c.id}')">تعديل</button>
          <button class="ecc-btn ecc-btn--ghost ci-btn-danger ecc-btn--sm" onclick="CityIntelligenceApp.deleteCompetitor('${c.id}')">حذف</button>
        </td>
      </tr>`).join('');

    content.innerHTML = `
      <div class="top-actions ci-mb-4">
        <button class="ecc-btn ecc-btn--primary" onclick="CityIntelligenceApp.openCompetitorModal('${city.id}')">+ منافس</button>
      </div>
      <div class="table-card">
        <table class="ecc-table">
          <thead><tr><th>المنافس</th><th>الفئة</th><th>حصة السوق التقديرية</th><th>ملاحظات</th><th>إجراءات</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty-state">لا يوجد منافسون</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function renderCityReportsTab(content, city) {
    const reps = state.reports.filter(r => r.city_id === city.id);
    const rows = reps.map(r => `
      <tr>
        <td><strong>${BondsAdminCommon.escapeHtml(r.title)}</strong></td>
        <td>${formatNum(r.overall_score, 1)}</td>
        <td>${formatDate(r.created_at)}</td>
        <td>
          ${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" class="ecc-btn ecc-btn--ghost ecc-btn--sm">تحميل PDF</a>` : ''}
          <button class="ecc-btn ecc-btn--ghost ci-btn-danger ecc-btn--sm" onclick="CityIntelligenceApp.deleteReport('${r.id}')">حذف</button>
        </td>
      </tr>`).join('');

    content.innerHTML = `
      <div class="top-actions ci-mb-4">
        <button class="ecc-btn ecc-btn--primary" onclick="CityIntelligenceApp.generateCityReport('${city.id}')">+ إنشاء تقرير PDF</button>
      </div>
      <div class="table-card">
        <table class="ecc-table">
          <thead><tr><th>التقرير</th><th>الدرجة</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="empty-state">لا توجد تقارير</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function projectStatusLabel(s) {
    return { planned: 'مخطط', ongoing: 'جاري', completed: 'مكتمل', cancelled: 'ملغي' }[s] || s;
  }

  // ── Map ────────────────────────────────────────────────────────────
  function renderMapPage(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>${PAGE_TITLES.map}</h1><p>الخرائط التفاعلية للأحياء والمشاريع والمنافسين</p></div>
        <div class="top-actions">
          <select id="mapCityFilter" class="form-group ci-minw-160">
            <option value="">كل المدن</option>
            ${state.cities.map(c => `<option value="${c.id}">${BondsAdminCommon.escapeHtml(c.name)}</option>`).join('')}
          </select>
          <button class="ecc-btn ecc-btn--ghost" onclick="CityIntelligenceApp.refreshMap()">تحديث</button>
        </div>
      </div>
      <div class="ecc-card ecc-form-group--full ci-p-0">
        <div class="map-wrap"><div id="cityMap"></div></div>
      </div>`;

    initMap();
    $('#mapCityFilter').onchange = (e) => filterMapByCity(e.target.value);
  }

  function initMap() {
    if (state.map) { state.map.remove(); state.map = null; }
    const defaultCenter = state.cities[0] ? [state.cities[0].center_lat || 24.7136, state.cities[0].center_lng || 46.6753] : [24.7136, 46.6753];
    state.map = L.map('cityMap').setView(defaultCenter, 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(state.map);
    state.mapLayers = L.layerGroup().addTo(state.map);
    refreshMap();
  }

  function refreshMap() {
    if (!state.map) return;
    state.mapLayers.clearLayers();
    const cityFilter = $('#mapCityFilter')?.value || '';

    state.districts.forEach(d => {
      if (cityFilter && d.city_id !== cityFilter) return;
      const city = state.cities.find(c => c.id === d.city_id);
      if (!d.center_lat || !d.center_lng) return;
      const score = d.investment_score ?? CityAnalysisEngine.calculateDistrictScore(d);
      const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
      const marker = L.circleMarker([d.center_lat, d.center_lng], {
        radius: 8 + Math.min(12, score / 8),
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      });
      marker.bindPopup(`<strong>${BondsAdminCommon.escapeHtml(d.name)}</strong><br/>${BondsAdminCommon.escapeHtml(city?.name || '')}<br/>درجة: ${formatNum(score, 1)}`);
      state.mapLayers.addLayer(marker);
    });

    state.projects.forEach(p => {
      if (cityFilter && p.city_id !== cityFilter) return;
      if (!p.lat || !p.lng) return;
      const icon = L.divIcon({ className: '', html: '<div class="map-marker--city"></div>', iconSize: [12, 12] });
      L.marker([p.lat, p.lng], { icon }).bindPopup(`<strong>مشروع:</strong> ${BondsAdminCommon.escapeHtml(p.name)}<br/>${projectStatusLabel(p.status)}`).addTo(state.mapLayers);
    });

    state.competitors.forEach(c => {
      if (cityFilter && c.city_id !== cityFilter) return;
      if (!c.lat || !c.lng) return;
      const icon = L.divIcon({ className: '', html: '<div class="map-marker--district"></div>', iconSize: [12, 12] });
      L.marker([c.lat, c.lng], { icon }).bindPopup(`<strong>منافس:</strong> ${BondsAdminCommon.escapeHtml(c.name)}`).addTo(state.mapLayers);
    });
  }

  function filterMapByCity(cityId) {
    if (cityId) {
      const city = state.cities.find(c => c.id === cityId);
      if (city?.center_lat) state.map.setView([city.center_lat, city.center_lng], 11);
    }
    refreshMap();
  }

  // ── Reports page ───────────────────────────────────────────────────
  function renderReportsPage(container) {
    const rows = state.reports.map(r => {
      const city = state.cities.find(c => c.id === r.city_id);
      return `
        <tr>
          <td><strong>${BondsAdminCommon.escapeHtml(r.title)}</strong></td>
          <td>${BondsAdminCommon.escapeHtml(city?.name || '—')}</td>
          <td>${formatNum(r.overall_score, 1)}</td>
          <td>${formatDate(r.created_at)}</td>
          <td>
            ${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" class="ecc-btn ecc-btn--ghost ecc-btn--sm">تحميل</a>` : ''}
            <button class="ecc-btn ecc-btn--ghost ci-btn-danger ecc-btn--sm" onclick="CityIntelligenceApp.deleteReport('${r.id}')">حذف</button>
          </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="page-header">
        <div><h1>${PAGE_TITLES.reports}</h1><p>التقارير المحفوظة والتصدير</p></div>
        <button class="ecc-btn ecc-btn--primary" onclick="CityIntelligenceApp.openReportModal()">+ تقرير جديد</button>
      </div>
      <div class="table-card">
        <table class="ecc-table">
          <thead><tr><th>التقرير</th><th>المدينة</th><th>الدرجة</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty-state">لا توجد تقارير</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  // ── Activity page ──────────────────────────────────────────────────
  function renderActivityPage(container) {
    const rows = state.activity.map(a => `
      <tr>
        <td>${BondsAdminCommon.escapeHtml(a.action)}</td>
        <td>${BondsAdminCommon.escapeHtml(a.cities?.name || a.details?.city_id || '—')}</td>
        <td>${BondsAdminCommon.escapeHtml(a.districts?.name || '—')}</td>
        <td>${formatDate(a.created_at)}</td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="page-header">
        <div><h1>${PAGE_TITLES.activity}</h1><p>سجل العمليات والتغييرات</p></div>
      </div>
      <div class="table-card">
        <table class="ecc-table">
          <thead><tr><th>العملية</th><th>المدينة</th><th>الحي</th><th>التاريخ</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="empty-state">لا يوجد سجل</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  // ── Roles management ───────────────────────────────────────────────
  async function renderRolesPage(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>${PAGE_TITLES.roles}</h1><p>إدارة صلاحيات City Intelligence</p></div>
        <button class="ecc-btn ecc-btn--primary" onclick="CityIntelligenceApp.openAssignRoleModal()">+ تعيين دور</button>
      </div>
      <div class="table-card">
        <div class="table-header"><h3>المستخدمون والأدوار</h3></div>
        <table class="ecc-table">
          <thead><tr><th>المستخدم</th><th>البريد</th><th>الدور</th><th>تاريخ التعيين</th><th>إجراءات</th></tr></thead>
          <tbody id="rolesTableBody"><tr><td colspan="5"><div class="spinner">جارِ التحميل...</div></td></tr></tbody>
        </table>
      </div>`;
    await loadRolesTable();
  }

  async function loadRolesTable() {
    const tbody = $('#rolesTableBody');
    if (!tbody) return;
    try {
      const roles = await SVC.getCityRoles();
      tbody.innerHTML = roles.map(r => `
        <tr>
          <td><strong>${BondsAdminCommon.escapeHtml(r.full_name || '—')}</strong></td>
          <td>${BondsAdminCommon.escapeHtml(r.email)}</td>
          <td><span class="status-badge status-badge--${r.role === 'admin' ? 'attention' : (r.role === 'analyst' ? 'neutral' : 'healthy')}">${roleLabel(r.role)}</span></td>
          <td>${formatDate(r.created_at)}</td>
          <td><button class="ecc-btn ecc-btn--ghost ci-btn-danger ecc-btn--sm" onclick="CityIntelligenceApp.removeCityRole('${r.user_id}')">إزالة</button></td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty-state">لا توجد أدوار معينة</td></tr>';
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">خطأ: ${BondsAdminCommon.escapeHtml(err.message)}</td></tr>`;
    }
  }

  function roleLabel(role) {
    return { admin: 'مدير', analyst: 'محلل', viewer: 'مشاهد' }[role] || role;
  }

  let roleSearchResults = [];

  async function openAssignRoleModal() {
    const html = `
      <div class="ci-grid-1">
        <div class="form-group">
          <label>ابحث بالبريد الإلكتروني</label>
          <input type="text" id="roleSearchInput" placeholder="example@domain.com" />
        </div>
        <div class="form-group" id="roleSearchResults"></div>
        <div class="form-group">
          <label>الدور</label>
          <select name="role">
            <option value="admin">مدير</option>
            <option value="analyst">محلل</option>
            <option value="viewer">مشاهد</option>
          </select>
        </div>
      </div>`;
    openModal('تعيين دور', html, async () => {
      const selected = document.querySelector('input[name="selected_user_id"]:checked');
      if (!selected) throw new Error('اختر مستخدمًا أولاً');
      const userId = selected.value;
      const role = document.querySelector('#modalOverlay [name="role"]').value;
      await SVC.assignCityRole(userId, role);
      showToast('تم تعيين الدور', 'success');
      await loadRolesTable();
    });

    const input = $('#roleSearchInput');
    let debounce;
    input.oninput = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => searchRoleUsers(input.value), 350);
    };
  }

  async function searchRoleUsers(query) {
    const resultsEl = $('#roleSearchResults');
    if (!query || query.length < 3) { resultsEl.innerHTML = ''; return; }
    resultsEl.innerHTML = '<div class="spinner">جارِ البحث...</div>';
    try {
      const users = await SVC.searchUsers(query);
      roleSearchResults = users;
      if (!users.length) { resultsEl.innerHTML = '<p class="ci-text-muted">لا توجد نتائج</p>'; return; }
      resultsEl.innerHTML = users.map(u => `
        <label class="ci-radio-option">
          <input type="radio" name="selected_user_id" value="${u.id}" />
          <div>
            <div class="ci-radio-option__name">${BondsAdminCommon.escapeHtml(u.full_name || '—')}</div>
            <div class="ci-radio-option__email">${BondsAdminCommon.escapeHtml(u.email)}</div>
          </div>
        </label>`).join('');
    } catch (err) {
      resultsEl.innerHTML = `<p class="ci-text-danger">${BondsAdminCommon.escapeHtml(err.message)}</p>`;
    }
  }

  async function removeCityRole(userId) {
    if (!confirm('إزالة الدور؟')) return;
    await SVC.removeCityRole(userId);
    showToast('تمت الإزالة', 'success');
    await loadRolesTable();
  }

  // ── Modals & CRUD actions ──────────────────────────────────────────
  function modalInput(label, name, value = '', type = 'text', attrs = '') {
    const val = value != null ? BondsAdminCommon.escapeHtml(String(value)) : '';
    if (type === 'select') {
      return `
        <div class="form-group">
          <label>${BondsAdminCommon.escapeHtml(label)}</label>
          <select name="${name}" ${attrs}>${value}</select>
        </div>`;
    }
    if (type === 'textarea') {
      return `
        <div class="form-group ecc-form-group--full">
          <label>${BondsAdminCommon.escapeHtml(label)}</label>
          <textarea name="${name}" rows="3" ${attrs}>${val}</textarea>
        </div>`;
    }
    return `
      <div class="form-group">
        <label>${BondsAdminCommon.escapeHtml(label)}</label>
        <input type="${type}" name="${name}" value="${val}" ${attrs} />
      </div>`;
  }

  function getFormData() {
    const data = {};
    const inputs = $$$('#modalOverlay [name]');
    inputs.forEach(inp => {
      if (inp.type === 'checkbox') data[inp.name] = inp.checked;
      else if (inp.type === 'number') data[inp.name] = inp.value === '' ? null : Number(inp.value);
      else data[inp.name] = inp.value || null;
    });
    return data;
  }

  function openCityModal(cityId = null) {
    const city = cityId ? state.cities.find(c => c.id === cityId) : {};
    const html = `
      <div class="ecc-grid-2">
        ${modalInput('اسم المدينة', 'name', city.name || '', 'text', 'required')}
        ${modalInput('الاسم الإنجليزي', 'name_en', city.name_en || '')}
        ${modalInput('المنطقة', 'region', city.region || '')}
        ${modalInput('رمز الدولة', 'country_code', city.country_code || '')}
        ${modalInput('عدد السكان', 'population', city.population || '', 'number')}
        ${modalInput('المساحة (كم²)', 'area_km2', city.area_km2 || '', 'number', 'step="0.01"')}
        ${modalInput('خط العرض المركزي', 'center_lat', city.center_lat || '', 'number', 'step="0.0001"')}
        ${modalInput('خط الطول المركزي', 'center_lng', city.center_lng || '', 'number', 'step="0.0001"')}
      </div>`;
    openModal(cityId ? 'تعديل مدينة' : 'مدينة جديدة', html, async () => {
      const data = getFormData();
      if (!data.name) throw new Error('اسم المدينة مطلوب');
      if (city.id) data.id = city.id;
      await SVC.saveCity(data);
      showToast('تم حفظ المدينة', 'success');
      Cache && Cache.invalidate('city-intelligence', 'cities');
      await loadCities();
      router();
    });
  }

  async function deleteCity(id) {
    if (!confirm('هل أنت متأكد من حذف المدينة وجميع بياناتها؟')) return;
    await SVC.deleteCity(id);
    showToast('تم الحذف', 'success');
    Cache && Cache.invalidate('city-intelligence');
    location.hash = '#cities';
  }

  function openDistrictModal(cityId, districtId = null) {
    const district = districtId ? state.districts.find(d => d.id === districtId) : { city_id: cityId };
    const html = `
      <div class="ecc-grid-2">
        ${modalInput('اسم الحي', 'name', district.name || '', 'text', 'required')}
        ${modalInput('الاسم الإنجليزي', 'name_en', district.name_en || '')}
        ${modalInput('خط العرض', 'center_lat', district.center_lat || '', 'number', 'step="0.0001"')}
        ${modalInput('خط الطول', 'center_lng', district.center_lng || '', 'number', 'step="0.0001"')}
        ${modalInput('السكان', 'population', district.population || '', 'number')}
        ${modalInput('عدد الأسر', 'households', district.households || '', 'number')}
        ${modalInput('متوسط الدخل', 'avg_income', district.avg_income || '', 'number')}
        ${modalInput('معدل النمو العمراني %', 'urban_growth_rate', district.urban_growth_rate || '', 'number', 'step="0.01"')}
        ${modalInput('سعر الأرض/م²', 'land_price_per_sqm', district.land_price_per_sqm || '', 'number')}
        ${modalInput('الإيجار/م²', 'rent_per_sqm', district.rent_per_sqm || '', 'number')}
        ${modalInput('كثافة تجارية (0-100)', 'commercial_density_score', district.commercial_density_score || '', 'number', 'min="0" max="100"')}
        ${modalInput('مؤشر المنافسة (0-100)', 'competition_index', district.competition_index || '', 'number', 'min="0" max="100"')}
        ${modalInput('عدد المشاريع الحكومية', 'government_projects_count', district.government_projects_count || 0, 'number')}
        ${modalInput('ملاحظات', 'notes', district.notes || '', 'textarea')}
      </div>`;
    openModal(districtId ? 'تعديل حي' : 'حي جديد', html, async () => {
      const data = getFormData();
      data.city_id = cityId;
      if (!data.name) throw new Error('اسم الحي مطلوب');
      if (district.id) data.id = district.id;
      data.investment_score = CityAnalysisEngine.calculateDistrictScore(data);
      data.investment_rating = CityAnalysisEngine.rating(data.investment_score).label;
      await SVC.saveDistrict(data);
      showToast('تم حفظ الحي', 'success');
      Cache && Cache.invalidate('city-intelligence', 'districts');
      await loadDistricts();
      router();
    });
  }

  async function deleteDistrict(id) {
    if (!confirm('حذف الحي؟')) return;
    await SVC.deleteDistrict(id);
    showToast('تم الحذف', 'success');
    Cache && Cache.invalidate('city-intelligence', 'districts');
    await loadDistricts();
    router();
  }

  function openProjectModal(cityId, projectId = null) {
    const p = projectId ? state.projects.find(x => x.id === projectId) : { city_id: cityId };
    const districts = state.districts.filter(d => d.city_id === cityId);
    const districtOptions = `<option value="">—</option>` + districts.map(d => `<option value="${d.id}" ${p.district_id === d.id ? 'selected' : ''}>${BondsAdminCommon.escapeHtml(d.name)}</option>`).join('');
    const statusOptions = ['planned','ongoing','completed','cancelled'].map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${projectStatusLabel(s)}</option>`).join('');
    const html = `
      <div class="ecc-grid-2">
        ${modalInput('اسم المشروع', 'name', p.name || '', 'text', 'required')}
        ${modalInput('النوع', 'project_type', p.project_type || '')}
        <div class="form-group"><label>الحي</label><select name="district_id">${districtOptions}</select></div>
        <div class="form-group"><label>الحالة</label><select name="status">${statusOptions}</select></div>
        ${modalInput('الميزانية', 'budget', p.budget || '', 'number')}
        ${modalInput('تاريخ البداية', 'start_date', p.start_date || '', 'date')}
        ${modalInput('تاريخ الانتهاء', 'end_date', p.end_date || '', 'date')}
        ${modalInput('تأثير (0-100)', 'impact_score', p.impact_score || '', 'number', 'min="0" max="100"')}
        ${modalInput('خط العرض', 'lat', p.lat || '', 'number', 'step="0.0001"')}
        ${modalInput('خط الطول', 'lng', p.lng || '', 'number', 'step="0.0001"')}
      </div>`;
    openModal(projectId ? 'تعديل مشروع' : 'مشروع جديد', html, async () => {
      const data = getFormData();
      data.city_id = cityId;
      if (!data.name) throw new Error('اسم المشروع مطلوب');
      if (p.id) data.id = p.id;
      await SVC.saveProject(data);
      showToast('تم حفظ المشروع', 'success');
      Cache && Cache.invalidate('city-intelligence', 'projects');
      await loadProjects();
      router();
    });
  }

  async function deleteProject(id) {
    if (!confirm('حذف المشروع؟')) return;
    await SVC.deleteProject(id);
    showToast('تم الحذف', 'success');
    Cache && Cache.invalidate('city-intelligence', 'projects');
    await loadProjects();
    router();
  }

  function openCompetitorModal(cityId, compId = null) {
    const c = compId ? state.competitors.find(x => x.id === compId) : { city_id: cityId };
    const districts = state.districts.filter(d => d.city_id === cityId);
    const districtOptions = `<option value="">—</option>` + districts.map(d => `<option value="${d.id}" ${c.district_id === d.id ? 'selected' : ''}>${BondsAdminCommon.escapeHtml(d.name)}</option>`).join('');
    const html = `
      <div class="ecc-grid-2">
        ${modalInput('الاسم', 'name', c.name || '', 'text', 'required')}
        ${modalInput('الفئة', 'category', c.category || '')}
        <div class="form-group"><label>الحي</label><select name="district_id">${districtOptions}</select></div>
        ${modalInput('حصة السوق التقديرية %', 'market_share_estimate', c.market_share_estimate || '', 'number', 'step="0.1"')}
        ${modalInput('خط العرض', 'lat', c.lat || '', 'number', 'step="0.0001"')}
        ${modalInput('خط الطول', 'lng', c.lng || '', 'number', 'step="0.0001"')}
        ${modalInput('ملاحظات', 'notes', c.notes || '', 'textarea')}
      </div>`;
    openModal(compId ? 'تعديل منافس' : 'منافس جديد', html, async () => {
      const data = getFormData();
      data.city_id = cityId;
      if (!data.name) throw new Error('اسم المنافس مطلوب');
      if (c.id) data.id = c.id;
      await SVC.saveCompetitor(data);
      showToast('تم الحفظ', 'success');
      Cache && Cache.invalidate('city-intelligence', 'competitors');
      await loadCompetitors();
      router();
    });
  }

  async function deleteCompetitor(id) {
    if (!confirm('حذف المنافس؟')) return;
    await SVC.deleteCompetitor(id);
    showToast('تم الحذف', 'success');
    Cache && Cache.invalidate('city-intelligence', 'competitors');
    await loadCompetitors();
    router();
  }

  function openReportModal() {
    const cityOptions = `<option value="">اختر مدينة</option>` + state.cities.map(c => `<option value="${c.id}">${BondsAdminCommon.escapeHtml(c.name)}</option>`).join('');
    const html = `
      <div class="ci-grid-1">
        <div class="form-group"><label>المدينة</label><select name="city_id" required>${cityOptions}</select></div>
        ${modalInput('عنوان التقرير', 'title', '', 'text', 'required')}
      </div>`;
    openModal('تقرير جديد', html, async () => {
      const data = getFormData();
      if (!data.city_id || !data.title) throw new Error('المدينة والعنوان مطلوبان');
      await generateCityReport(data.city_id, data.title);
    });
  }

  async function deleteReport(id) {
    if (!confirm('حذف التقرير؟')) return;
    await SVC.deleteReport(id);
    showToast('تم الحذف', 'success');
    Cache && Cache.invalidate('city-intelligence', 'reports');
    await loadReports();
    router();
  }

  // ── PDF generation ────────────────────────────────────────────────
  async function generateCityReport(cityId, title = null) {
    const city = state.cities.find(c => c.id === cityId);
    if (!city) return;
    const cityDistricts = state.districts.filter(d => d.city_id === cityId);
    const score = CityAnalysisEngine.calculateCityScore(cityId);
    const rating = CityAnalysisEngine.rating(score);

    const reportEl = $('#reportCapture');
    const districtRows = cityDistricts.map(d => {
      const s = d.investment_score ?? CityAnalysisEngine.calculateDistrictScore(d);
      return `<tr><td>${BondsAdminCommon.escapeHtml(d.name)}</td><td>${formatNum(s, 1)}</td><td>${CityAnalysisEngine.rating(s).label}</td></tr>`;
    }).join('');

    reportEl.innerHTML = `
      <div class="report-paper">
        <div class="report-paper__header">
          <img src="/assets/bonds-logo-2026-sm.webp" />
          <h1>City Intelligence Report</h1>
          <h2>${BondsAdminCommon.escapeHtml(title || city.name)}</h2>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
        </div>
        <div class="report-paper__summary">
          <h3>الدرجة الإجمالية: ${formatNum(score, 1)} / 100 — ${rating.label}</h3>
          <p>عدد الأحياء المحللة: ${formatNum(cityDistricts.length)}</p>
        </div>
        <h3>الأحياء</h3>
        <table class="report-paper__table">
          <thead><tr><th>الحي</th><th>الدرجة</th><th>التقييم</th></tr></thead>
          <tbody>${districtRows || '<tr><td colspan="3">لا توجد أحياء</td></tr>'}</tbody>
        </table>
        <h3>ملخص</h3>
        <p>تم إنشاء هذا التقرير تلقائياً بناءً على مؤشرات السكان والدخل والنمو العمراني والمشاريع الحكومية والمنافسة وأسعار الأراضي والإيجارات والكثافة التجارية.</p>
      </div>`;

    const canvas = await html2canvas(reportEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);
    const blob = pdf.output('blob');
    const file = new File([blob], `${city.name}_report.pdf`, { type: 'application/pdf' });
    const { publicUrl } = await SVC.uploadReportPdf(file, cityId);

    await SVC.saveReport({
      city_id: cityId,
      title: title || `تقرير ${city.name}`,
      overall_score: score,
      summary: `درجة الاستثمار ${formatNum(score, 1)} — ${rating.label}`,
      pdf_url: publicUrl
    });

    showToast('تم إنشاء التقرير', 'success');
    await loadReports();
    router();
  }

  // ── Init & events ─────────────────────────────────────────────────
  async function init() {
    try {
      state.user = (await SVC.getCurrentUser()) || {};
      updateUserUI();
      await SVC.init();
    } catch (err) {
      showToast(err.message || 'فشل في المصادقة', 'error');
      return;
    }
    $('#mobileToggle').onclick = () => $('#sidebar').classList.toggle('open');
    window.addEventListener('hashchange', router);
    await router();
  }

  // Expose minimal API
  global.CityIntelligenceApp = {
    init,
    setTab(tab) { state.activeTab = tab; renderCityTab(); },
    openCityModal,
    deleteCity,
    openDistrictModal,
    deleteDistrict,
    openProjectModal,
    deleteProject,
    openCompetitorModal,
    deleteCompetitor,
    openReportModal,
    deleteReport,
    generateCityReport,
    refreshMap,
    openAssignRoleModal,
    removeCityRole,
    runCityAi
  };

  // Auto-init on admin-auth-ready
  function tryInit() {
    if (window.__ADMIN_ROLE || window.BondsAuth) {
      init();
    } else {
      window.addEventListener('admin-auth-ready', init);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})(window);
