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
      if (score >= 75) return { label: 'ممتاز', class: 'score-high' };
      if (score >= 50) return { label: 'جيد', class: 'score-medium' };
      return { label: 'ضعيف', class: 'score-low' };
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
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }
  function scoreClass(score) {
    return CityAnalysisEngine.rating(score).class;
  }

  // ── UI helpers ─────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast toast--${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function setLoading(el, text = 'جارِ التحميل...') {
    el.innerHTML = `<div class="spinner">${escapeHtml(text)}</div>`;
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
          <h3>${escapeHtml(title)}</h3>
          <button class="modal-close" aria-label="إغلاق">&times;</button>
        </div>
        <div class="modal-body">${html}</div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modalCancel">إلغاء</button>
          <button class="btn btn-primary" id="modalSave">${escapeHtml(submitText)}</button>
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
  async function loadCities() {
    state.cities = await SVC.getCities();
  }
  async function loadDistricts() {
    state.districts = await SVC.getDistricts();
  }
  async function loadIndicators() {
    state.indicators = await SVC.getIndicatorValues({});
  }
  async function loadProjects() {
    state.projects = await SVC.getProjects();
  }
  async function loadCompetitors() {
    state.competitors = await SVC.getCompetitors();
  }
  async function loadReports() {
    state.reports = await SVC.getReports();
  }
  async function loadActivity() {
    state.activity = await SVC.getActivity(100);
  }

  async function refreshAll() {
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
      app.innerHTML = `<div class="empty-state"><h4>خطأ في التحميل</h4><p>${escapeHtml(err.message)}</p></div>`;
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
          <button class="btn btn-primary" onclick="CityIntelligenceApp.openCityModal()">+ مدينة جديدة</button>
          <button class="btn btn-secondary" onclick="location.hash='#map'">فتح الخريطة</button>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card__header"><div class="stat-card__icon stat-card__icon--gold">🏙️</div></div>
          <div class="stat-card__num">${formatNum(totalCities)}</div>
          <div class="stat-card__label">المدن</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__header"><div class="stat-card__icon stat-card__icon--blue">📍</div></div>
          <div class="stat-card__num">${formatNum(totalDistricts)}</div>
          <div class="stat-card__label">الأحياء</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__header"><div class="stat-card__icon stat-card__icon--green">⭐</div></div>
          <div class="stat-card__num">${formatNum(avgScore, 1)}</div>
          <div class="stat-card__label">متوسط درجة الاستثمار</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__header"><div class="stat-card__icon stat-card__icon--purple">🚀</div></div>
          <div class="stat-card__num">${formatNum(highOpportunity)}</div>
          <div class="stat-card__label">فرص عالية (≥75)</div>
        </div>
      </div>
      <div class="section-row">
        <div class="card">
          <h3>🏆 أفضل الأحياء</h3>
          <div class="chart-box"><canvas id="topDistrictsChart"></canvas></div>
        </div>
        <div class="card">
          <h3>📊 توزيع التقييمات</h3>
          <div class="chart-box"><canvas id="scoreDistChart"></canvas></div>
        </div>
      </div>
      <div class="card card--full">
        <h3>📈 مؤشرات الأداء</h3>
        <div class="chart-box"><canvas id="radarChart"></canvas></div>
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
        <button class="btn btn-primary" onclick="CityIntelligenceApp.openCityModal()">+ مدينة جديدة</button>
      </div>
      <div class="city-grid" id="cityGrid"></div>`;
    const grid = $('#cityGrid');
    if (!state.cities.length) {
      grid.innerHTML = `<div class="empty-state card card--full"><h4>لا توجد مدن</h4><p>أضف أول مدينة لبدء التحليل</p></div>`;
      return;
    }
    grid.innerHTML = state.cities.map(c => {
      const cityDistricts = state.districts.filter(d => d.city_id === c.id);
      const score = CityAnalysisEngine.calculateCityScore(c.id);
      const rating = CityAnalysisEngine.rating(score);
      return `
        <div class="city-card" onclick="location.hash='#city/${c.id}'">
          <div class="city-card__name">${escapeHtml(c.name)}</div>
          <div class="city-card__meta">${escapeHtml(c.region || '')} · ${formatNum(cityDistricts.length)} حي</div>
          <div class="city-card__score ${rating.class}">${formatNum(score, 1)} · ${rating.label}</div>
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
          <h1>${escapeHtml(city.name)} <span class="city-card__score ${rating.class}">${formatNum(score, 1)} · ${rating.label}</span></h1>
          <p>${escapeHtml(city.region || '')} · ${formatNum(cityDistricts.length)} حي</p>
        </div>
        <div class="top-actions">
          <button class="btn btn-primary" onclick="CityIntelligenceApp.openDistrictModal('${city.id}')">+ حي</button>
          <button class="btn btn-secondary" onclick="CityIntelligenceApp.openCityModal('${city.id}')">تعديل المدينة</button>
          <button class="btn btn-secondary" onclick="CityIntelligenceApp.generateCityReport('${city.id}')">📄 تقرير PDF</button>
          <button class="btn btn-danger btn-sm" onclick="CityIntelligenceApp.deleteCity('${city.id}')">حذف</button>
        </div>
      </div>
      <div class="tabs">
        <button class="tab ${state.activeTab === 'overview' ? 'active' : ''}" data-tab="overview" onclick="CityIntelligenceApp.setTab('overview')">نظرة عامة</button>
        <button class="tab ${state.activeTab === 'districts' ? 'active' : ''}" data-tab="districts" onclick="CityIntelligenceApp.setTab('districts')">الأحياء</button>
        <button class="tab ${state.activeTab === 'projects' ? 'active' : ''}" data-tab="projects" onclick="CityIntelligenceApp.setTab('projects')">المشاريع</button>
        <button class="tab ${state.activeTab === 'competitors' ? 'active' : ''}" data-tab="competitors" onclick="CityIntelligenceApp.setTab('competitors')">المنافسون</button>
        <button class="tab ${state.activeTab === 'reports' ? 'active' : ''}" data-tab="reports" onclick="CityIntelligenceApp.setTab('reports')">تقارير</button>
      </div>
      <div id="cityTabContent"></div>
      <div id="reportCapture" style="position:absolute;left:-9999px;top:-9999px;width:800px;background:#fff;padding:2rem;"></div>`;

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
        <div class="card" style="text-align:center;">
          <h3>درجة الاستثمار الإجمالية</h3>
          <div class="score-ring" style="--score:${score}"><span>${formatNum(score, 1)}</span></div>
          <p style="color:var(--text-secondary);font-size:0.9rem;">${CityAnalysisEngine.rating(score).label}</p>
        </div>
        <div class="card">
          <h3>📌 بيانات المدينة</h3>
          <div class="form-grid" style="grid-template-columns:1fr;">
            <div class="form-group"><label>السكان</label><input type="text" value="${formatNum(city.population)}" readonly /></div>
            <div class="form-group"><label>المساحة (كم²)</label><input type="text" value="${formatNum(city.area_km2, 2)}" readonly /></div>
            <div class="form-group"><label>الإحداثيات</label><input type="text" value="${formatNum(city.center_lat, 4)}, ${formatNum(city.center_lng, 4)}" readonly /></div>
          </div>
        </div>
      </div>
      <div class="card card--full">
        <h3>📊 المؤشرات الرئيسية</h3>
        ${indicatorBars}
      </div>
      <div class="card card--full">
        <h3>📈 تحليل المؤشرات</h3>
        <div class="chart-box"><canvas id="cityRadarChart"></canvas></div>
      </div>`;

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
          <td><strong>${escapeHtml(d.name)}</strong></td>
          <td>${formatNum(d.population)}</td>
          <td>${formatNum(d.avg_income)} ر.س</td>
          <td>${formatNum(d.urban_growth_rate, 1)}%</td>
          <td><span class="city-card__score ${rating.class}">${formatNum(score, 1)}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="CityIntelligenceApp.openDistrictModal('${city.id}', '${d.id}')">تعديل</button>
            <button class="btn btn-danger btn-sm" onclick="CityIntelligenceApp.deleteDistrict('${d.id}')">حذف</button>
          </td>
        </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="table-card">
        <div class="table-header"><h3>الأحياء (${formatNum(state.districts.filter(d => d.city_id === city.id).length)})</h3></div>
        <table class="data-table">
          <thead><tr><th>الحي</th><th>السكان</th><th>متوسط الدخل</th><th>النمو العمراني</th><th>الدرجة</th><th>إجراءات</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty-state">لا توجد أحياء</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function renderProjectsTab(content, city) {
    const rows = state.projects.filter(p => p.city_id === city.id).map(p => `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.project_type || '—')}</td>
        <td><span class="badge badge--${p.status}">${projectStatusLabel(p.status)}</span></td>
        <td>${formatNum(p.budget)} ر.س</td>
        <td>${formatDate(p.start_date)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="CityIntelligenceApp.openProjectModal('${city.id}', '${p.id}')">تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="CityIntelligenceApp.deleteProject('${p.id}')">حذف</button>
        </td>
      </tr>`).join('');

    content.innerHTML = `
      <div class="top-actions" style="margin-bottom:1rem;">
        <button class="btn btn-primary" onclick="CityIntelligenceApp.openProjectModal('${city.id}')">+ مشروع</button>
      </div>
      <div class="table-card">
        <table class="data-table">
          <thead><tr><th>المشروع</th><th>النوع</th><th>الحالة</th><th>الميزانية</th><th>البداية</th><th>إجراءات</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty-state">لا توجد مشاريع</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function renderCompetitorsTab(content, city) {
    const rows = state.competitors.filter(c => c.city_id === city.id).map(c => `
      <tr>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${escapeHtml(c.category || '—')}</td>
        <td>${formatNum(c.market_share_estimate, 1)}%</td>
        <td>${escapeHtml(c.notes || '—')}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="CityIntelligenceApp.openCompetitorModal('${city.id}', '${c.id}')">تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="CityIntelligenceApp.deleteCompetitor('${c.id}')">حذف</button>
        </td>
      </tr>`).join('');

    content.innerHTML = `
      <div class="top-actions" style="margin-bottom:1rem;">
        <button class="btn btn-primary" onclick="CityIntelligenceApp.openCompetitorModal('${city.id}')">+ منافس</button>
      </div>
      <div class="table-card">
        <table class="data-table">
          <thead><tr><th>المنافس</th><th>الفئة</th><th>حصة السوق التقديرية</th><th>ملاحظات</th><th>إجراءات</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty-state">لا يوجد منافسون</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function renderCityReportsTab(content, city) {
    const reps = state.reports.filter(r => r.city_id === city.id);
    const rows = reps.map(r => `
      <tr>
        <td><strong>${escapeHtml(r.title)}</strong></td>
        <td>${formatNum(r.overall_score, 1)}</td>
        <td>${formatDate(r.created_at)}</td>
        <td>
          ${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" class="btn btn-secondary btn-sm">تحميل PDF</a>` : ''}
          <button class="btn btn-danger btn-sm" onclick="CityIntelligenceApp.deleteReport('${r.id}')">حذف</button>
        </td>
      </tr>`).join('');

    content.innerHTML = `
      <div class="top-actions" style="margin-bottom:1rem;">
        <button class="btn btn-primary" onclick="CityIntelligenceApp.generateCityReport('${city.id}')">+ إنشاء تقرير PDF</button>
      </div>
      <div class="table-card">
        <table class="data-table">
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
          <select id="mapCityFilter" class="form-group" style="min-width:160px;">
            <option value="">كل المدن</option>
            ${state.cities.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" onclick="CityIntelligenceApp.refreshMap()">تحديث</button>
        </div>
      </div>
      <div class="card card--full" style="padding:0;">
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
      marker.bindPopup(`<strong>${escapeHtml(d.name)}</strong><br/>${escapeHtml(city?.name || '')}<br/>درجة: ${formatNum(score, 1)}`);
      state.mapLayers.addLayer(marker);
    });

    state.projects.forEach(p => {
      if (cityFilter && p.city_id !== cityFilter) return;
      if (!p.lat || !p.lng) return;
      const icon = L.divIcon({ className: '', html: '<div style="background:#3b82f6;width:12px;height:12px;border-radius:50%;border:2px solid #fff;"></div>', iconSize: [12, 12] });
      L.marker([p.lat, p.lng], { icon }).bindPopup(`<strong>مشروع:</strong> ${escapeHtml(p.name)}<br/>${projectStatusLabel(p.status)}`).addTo(state.mapLayers);
    });

    state.competitors.forEach(c => {
      if (cityFilter && c.city_id !== cityFilter) return;
      if (!c.lat || !c.lng) return;
      const icon = L.divIcon({ className: '', html: '<div style="background:#a855f7;width:12px;height:12px;border-radius:50%;border:2px solid #fff;"></div>', iconSize: [12, 12] });
      L.marker([c.lat, c.lng], { icon }).bindPopup(`<strong>منافس:</strong> ${escapeHtml(c.name)}`).addTo(state.mapLayers);
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
          <td><strong>${escapeHtml(r.title)}</strong></td>
          <td>${escapeHtml(city?.name || '—')}</td>
          <td>${formatNum(r.overall_score, 1)}</td>
          <td>${formatDate(r.created_at)}</td>
          <td>
            ${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" class="btn btn-secondary btn-sm">تحميل</a>` : ''}
            <button class="btn btn-danger btn-sm" onclick="CityIntelligenceApp.deleteReport('${r.id}')">حذف</button>
          </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="page-header">
        <div><h1>${PAGE_TITLES.reports}</h1><p>التقارير المحفوظة والتصدير</p></div>
        <button class="btn btn-primary" onclick="CityIntelligenceApp.openReportModal()">+ تقرير جديد</button>
      </div>
      <div class="table-card">
        <table class="data-table">
          <thead><tr><th>التقرير</th><th>المدينة</th><th>الدرجة</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty-state">لا توجد تقارير</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  // ── Activity page ──────────────────────────────────────────────────
  function renderActivityPage(container) {
    const rows = state.activity.map(a => `
      <tr>
        <td>${escapeHtml(a.action)}</td>
        <td>${escapeHtml(a.cities?.name || a.details?.city_id || '—')}</td>
        <td>${escapeHtml(a.districts?.name || '—')}</td>
        <td>${formatDate(a.created_at)}</td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="page-header">
        <div><h1>${PAGE_TITLES.activity}</h1><p>سجل العمليات والتغييرات</p></div>
      </div>
      <div class="table-card">
        <table class="data-table">
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
        <button class="btn btn-primary" onclick="CityIntelligenceApp.openAssignRoleModal()">+ تعيين دور</button>
      </div>
      <div class="table-card">
        <div class="table-header"><h3>المستخدمون والأدوار</h3></div>
        <table class="data-table">
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
          <td><strong>${escapeHtml(r.full_name || '—')}</strong></td>
          <td>${escapeHtml(r.email)}</td>
          <td><span class="badge badge--${r.role === 'admin' ? 'ongoing' : (r.role === 'analyst' ? 'planned' : 'completed')}">${roleLabel(r.role)}</span></td>
          <td>${formatDate(r.created_at)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="CityIntelligenceApp.removeCityRole('${r.user_id}')">إزالة</button></td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty-state">لا توجد أدوار معينة</td></tr>';
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">خطأ: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function roleLabel(role) {
    return { admin: 'مدير', analyst: 'محلل', viewer: 'مشاهد' }[role] || role;
  }

  let roleSearchResults = [];

  async function openAssignRoleModal() {
    const html = `
      <div class="form-grid" style="grid-template-columns:1fr;">
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
      if (!users.length) { resultsEl.innerHTML = '<p style="color:var(--text-muted)">لا توجد نتائج</p>'; return; }
      resultsEl.innerHTML = users.map(u => `
        <label style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;border:1px solid var(--border);border-radius:10px;cursor:pointer;margin-bottom:0.5rem;">
          <input type="radio" name="selected_user_id" value="${u.id}" />
          <div>
            <div style="font-weight:700;">${escapeHtml(u.full_name || '—')}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(u.email)}</div>
          </div>
        </label>`).join('');
    } catch (err) {
      resultsEl.innerHTML = `<p style="color:var(--danger)">${escapeHtml(err.message)}</p>`;
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
    const val = value != null ? escapeHtml(String(value)) : '';
    if (type === 'select') {
      return `
        <div class="form-group">
          <label>${escapeHtml(label)}</label>
          <select name="${name}" ${attrs}>${value}</select>
        </div>`;
    }
    if (type === 'textarea') {
      return `
        <div class="form-group">
          <label>${escapeHtml(label)}</label>
          <textarea name="${name}" rows="3" ${attrs}>${val}</textarea>
        </div>`;
    }
    return `
      <div class="form-group">
        <label>${escapeHtml(label)}</label>
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
      <div class="form-grid">
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
      await loadCities();
      router();
    });
  }

  async function deleteCity(id) {
    if (!confirm('هل أنت متأكد من حذف المدينة وجميع بياناتها؟')) return;
    await SVC.deleteCity(id);
    showToast('تم الحذف', 'success');
    location.hash = '#cities';
  }

  function openDistrictModal(cityId, districtId = null) {
    const district = districtId ? state.districts.find(d => d.id === districtId) : { city_id: cityId };
    const html = `
      <div class="form-grid">
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
      await loadDistricts();
      router();
    });
  }

  async function deleteDistrict(id) {
    if (!confirm('حذف الحي؟')) return;
    await SVC.deleteDistrict(id);
    showToast('تم الحذف', 'success');
    await loadDistricts();
    router();
  }

  function openProjectModal(cityId, projectId = null) {
    const p = projectId ? state.projects.find(x => x.id === projectId) : { city_id: cityId };
    const districts = state.districts.filter(d => d.city_id === cityId);
    const districtOptions = `<option value="">—</option>` + districts.map(d => `<option value="${d.id}" ${p.district_id === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('');
    const statusOptions = ['planned','ongoing','completed','cancelled'].map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${projectStatusLabel(s)}</option>`).join('');
    const html = `
      <div class="form-grid">
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
      await loadProjects();
      router();
    });
  }

  async function deleteProject(id) {
    if (!confirm('حذف المشروع؟')) return;
    await SVC.deleteProject(id);
    showToast('تم الحذف', 'success');
    await loadProjects();
    router();
  }

  function openCompetitorModal(cityId, compId = null) {
    const c = compId ? state.competitors.find(x => x.id === compId) : { city_id: cityId };
    const districts = state.districts.filter(d => d.city_id === cityId);
    const districtOptions = `<option value="">—</option>` + districts.map(d => `<option value="${d.id}" ${c.district_id === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('');
    const html = `
      <div class="form-grid">
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
      await loadCompetitors();
      router();
    });
  }

  async function deleteCompetitor(id) {
    if (!confirm('حذف المنافس؟')) return;
    await SVC.deleteCompetitor(id);
    showToast('تم الحذف', 'success');
    await loadCompetitors();
    router();
  }

  function openReportModal() {
    const cityOptions = `<option value="">اختر مدينة</option>` + state.cities.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    const html = `
      <div class="form-grid" style="grid-template-columns:1fr;">
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
      return `<tr><td>${escapeHtml(d.name)}</td><td>${formatNum(s, 1)}</td><td>${CityAnalysisEngine.rating(s).label}</td></tr>`;
    }).join('');

    reportEl.innerHTML = `
      <div style="font-family:'Vazirmatn',Arial,sans-serif;direction:rtl;color:#1a1a1a;">
        <div style="text-align:center;margin-bottom:1.5rem;">
          <img src="/assets/bonds-logo-2026.webp" style="height:50px;" />
          <h1 style="color:#b8954e;margin-top:0.5rem;">City Intelligence Report</h1>
          <h2>${escapeHtml(title || city.name)}</h2>
          <p style="color:#555;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
        </div>
        <div style="background:#f5f0e8;padding:1rem;border-radius:12px;margin-bottom:1rem;">
          <h3 style="margin-top:0;">الدرجة الإجمالية: ${formatNum(score, 1)} / 100 — ${rating.label}</h3>
          <p>عدد الأحياء المحللة: ${formatNum(cityDistricts.length)}</p>
        </div>
        <h3>الأحياء</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:1rem;">
          <thead><tr style="background:#b8954e;color:#fff;"><th style="padding:8px;border:1px solid #ddd;text-align:right;">الحي</th><th style="padding:8px;border:1px solid #ddd;">الدرجة</th><th style="padding:8px;border:1px solid #ddd;">التقييم</th></tr></thead>
          <tbody>${districtRows || '<tr><td colspan="3" style="padding:8px;border:1px solid #ddd;">لا توجد أحياء</td></tr>'}</tbody>
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
    removeCityRole
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
