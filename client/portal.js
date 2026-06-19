// Bonds Client Portal — Shared Logic
(function () {
  'use strict';

  const LANG = window.__PORTAL_LANG || 'ar';
  const IS_EN = LANG === 'en';
  const PAGE = window.__PORTAL_PAGE || 'dashboard';

  const LABELS = {
    ar: {
      portal: 'بوابة العميل',
      dashboard: 'لوحة التحكم',
      projects: 'المشاريع',
      reports: 'التقارير',
      logout: 'تسجيل الخروج',
      login: 'تسجيل الدخول',
      switchLang: 'EN',
      welcome: 'مرحباً',
      company: 'الشركة',
      email: 'البريد الإلكتروني',
      phone: 'الجوال',
      status: 'الحالة',
      noClientRecord: 'لم نجد سجلاً مرتبطاً ببريدك الإلكتروني. تواصل مع فريقنا لتفعيل البوابة.',
      projectsCount: 'عدد المشاريع',
      reportsCount: 'عدد التقارير',
      activeProject: 'آخر مشروع نشط',
      latestReport: 'أحدث تقرير',
      noProjects: 'لا توجد مشاريع مرتبطة بعد.',
      noReports: 'لا توجد تقارير مرتبطة بعد.',
      viewReport: 'عرض التقرير',
      viewProject: 'عرض المشروع',
      date: 'التاريخ',
      budget: 'الميزانية',
      workflow: 'مرحلة العمل',
      back: 'العودة',
      print: 'طباعة / PDF',
      notFound: 'الصفحة غير موجودة',
      loading: 'جاري التحميل...',
      errorLoading: 'حدث خطأ أثناء تحميل البيانات.',
      contactUs: 'تواصل معنا'
    },
    en: {
      portal: 'Client Portal',
      dashboard: 'Dashboard',
      projects: 'Projects',
      reports: 'Reports',
      logout: 'Sign out',
      login: 'Sign in',
      switchLang: 'العربية',
      welcome: 'Welcome',
      company: 'Company',
      email: 'Email',
      phone: 'Phone',
      status: 'Status',
      noClientRecord: 'We could not find a client record linked to your email. Please contact our team to activate the portal.',
      projectsCount: 'Projects',
      reportsCount: 'Reports',
      activeProject: 'Latest active project',
      latestReport: 'Latest report',
      noProjects: 'No projects linked yet.',
      noReports: 'No reports linked yet.',
      viewReport: 'View report',
      viewProject: 'View project',
      date: 'Date',
      budget: 'Budget',
      workflow: 'Workflow stage',
      back: 'Back',
      print: 'Print / PDF',
      notFound: 'Page not found',
      loading: 'Loading...',
      errorLoading: 'An error occurred while loading data.',
      contactUs: 'Contact us'
    }
  };

  function t(key) { return LABELS[LANG][key] || key; }

  function getBase() {
    const path = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!path) return '';
    const depth = path.split('/').length - 1;
    return depth === 0 ? '' : Array(depth).fill('../').join('');
  }

  const BASE = window.__PORTAL_BASE || getBase();

  function getSupabase() {
    return window.BondsAuth && window.BondsAuth.getSupabase ? window.BondsAuth.getSupabase() : null;
  }

  async function getUser() {
    if (!window.BondsAuth || !window.BondsAuth.getUser) return { data: { user: null }, error: new Error('Auth not loaded') };
    return window.BondsAuth.getUser();
  }

  async function requireAuth() {
    const { data, error } = await getUser();
    const user = data?.user;
    if (error || !user) {
      window.location.href = BASE + 'client/login.html?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    return user;
  }

  function injectHeader(user) {
    const header = document.getElementById('portal-header');
    if (!header) return;
    const langHref = IS_EN ? BASE + 'client/index.html' : BASE + 'en/client/index.html';
    const dashboardHref = IS_EN ? BASE + 'en/client/index.html' : BASE + 'client/index.html';
    header.innerHTML = `
      <header class="portal-header">
        <div class="portal-header__inner">
          <a class="portal-header__brand" href="${dashboardHref}">
            <img src="${BASE}assets/bonds-logo-2026-header.webp?v=2026" alt="Bonds" />
            <span>${t('portal')}</span>
          </a>
          <div class="portal-header__actions">
            <a class="portal-header__lang" href="${langHref}">${t('switchLang')}</a>
            <span class="portal-user">👤 ${user.email}</span>
            <a class="portal-header__logout" href="#" onclick="BondsClientPortal.logout();return false;">${t('logout')}</a>
          </div>
        </div>
      </header>
    `;
  }

  function injectSidebar() {
    const sidebar = document.getElementById('portal-sidebar');
    if (!sidebar) return;
    const pages = [
      { id: 'dashboard', icon: '📊', href: IS_EN ? BASE + 'en/client/index.html' : BASE + 'client/index.html' },
      { id: 'projects', icon: '📁', href: IS_EN ? BASE + 'en/client/index.html#projects' : BASE + 'client/index.html#projects' },
      { id: 'reports', icon: '📄', href: IS_EN ? BASE + 'en/client/reports.html' : BASE + 'client/reports.html' }
    ];
    sidebar.innerHTML = pages.map(p => `
      <a href="${p.href}" class="portal-sidebar__link ${PAGE === p.id ? 'active' : ''}">
        <span>${p.icon}</span>
        <span>${t(p.id)}</span>
      </a>
    `).join('');
  }

  async function loadClient(user) {
    const sb = getSupabase();
    if (!sb) return { data: null, error: new Error('Supabase not initialized') };
    const { data, error } = await sb
      .from('advisory_clients')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    return { data, error };
  }

  async function loadProjects(clientId) {
    const sb = getSupabase();
    if (!sb) return { data: [], error: new Error('Supabase not initialized') };
    const { data, error } = await sb
      .from('advisory_projects')
      .select('*, entity_workflows(current_state)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  }

  async function loadReports(clientId) {
    const sb = getSupabase();
    if (!sb) return { data: [], error: new Error('Supabase not initialized') };
    const { data, error } = await sb
      .from('ai_advisor_reports')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(IS_EN ? 'en-GB' : 'ar-SA');
  }

  function statusClass(status) {
    const s = (status || '').toLowerCase().replace(/\s+/g, '_');
    if (['new', 'pending', 'draft'].includes(s)) return 'portal-status--new';
    if (['in_progress', 'active', 'processing'].includes(s)) return 'portal-status--in_progress';
    if (['review', 'under_review', 'waiting_approval'].includes(s)) return 'portal-status--review';
    if (['approved', 'completed', 'done', 'success'].includes(s)) return 'portal-status--approved';
    if (['rejected', 'cancelled', 'failed'].includes(s)) return 'portal-status--rejected';
    return 'portal-status--new';
  }

  function showLoading(id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="portal-empty"><div class="portal-empty__icon">⏳</div>${t('loading')}</div>`;
  }

  function renderDashboard(client, projects, reports) {
    const main = document.getElementById('portal-main');
    if (!main) return;

    const latestProject = projects[0];
    const latestReport = reports[0];

    main.innerHTML = `
      <h1 class="portal-page-title">${t('welcome')}، ${client.name || client.company_name || client.email}</h1>
      <p class="portal-page-subtitle">${client.company_name ? `${t('company')}: ${client.company_name}` : ''}</p>

      <div class="portal-grid">
        <div class="portal-card">
          <div class="portal-card__label">${t('projectsCount')}</div>
          <div class="portal-card__value">${projects.length}</div>
        </div>
        <div class="portal-card">
          <div class="portal-card__label">${t('reportsCount')}</div>
          <div class="portal-card__value">${reports.length}</div>
        </div>
        ${latestProject ? `
        <div class="portal-card">
          <div class="portal-card__label">${t('activeProject')}</div>
          <div style="font-weight:700;margin-top:0.5rem;">${latestProject.name}</div>
          <div style="margin-top:0.5rem;"><span class="portal-status ${statusClass(latestProject.status)}">${latestProject.status || 'new'}</span></div>
        </div>` : ''}
        ${latestReport ? `
        <div class="portal-card">
          <div class="portal-card__label">${t('latestReport')}</div>
          <div style="font-weight:700;margin-top:0.5rem;">${latestReport.title}</div>
          <div style="margin-top:0.5rem;"><a class="portal-link" href="${IS_EN ? BASE + 'en/client/report.html?id=' + latestReport.id : BASE + 'client/report.html?id=' + latestReport.id}">${t('viewReport')}</a></div>
        </div>` : ''}
      </div>

      <div class="portal-section" id="projects">
        <div class="portal-section__title">${t('projects')}</div>
        ${projects.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">📁</div>${t('noProjects')}</div>
        ` : `
          <div class="portal-list">
            ${projects.map(p => `
              <div class="portal-list__item">
                <div>
                  <div style="font-weight:700;">${p.name}</div>
                  <div class="portal-list__meta">${t('date')}: ${formatDate(p.created_at)} · ${t('budget')}: ${p.budget || '-'}</div>
                </div>
                <div style="text-align:center;">
                  <span class="portal-status ${statusClass(p.status)}">${p.status || 'new'}</span>
                  ${p.entity_workflows && p.entity_workflows.length ? `
                    <div class="portal-list__meta" style="margin-top:0.35rem;">${t('workflow')}: ${p.entity_workflows[0].current_state}</div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div class="portal-section">
        <div class="portal-section__title">${t('reports')}</div>
        ${reports.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">📄</div>${t('noReports')}</div>
        ` : `
          <div class="portal-list">
            ${reports.map(r => `
              <div class="portal-list__item">
                <div>
                  <div style="font-weight:700;">${r.title}</div>
                  <div class="portal-list__meta">${t('date')}: ${formatDate(r.created_at)}</div>
                </div>
                <a class="portal-btn portal-btn--outline" href="${IS_EN ? BASE + 'en/client/report.html?id=' + r.id : BASE + 'client/report.html?id=' + r.id}">${t('viewReport')}</a>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderReportsList(reports) {
    const main = document.getElementById('portal-main');
    if (!main) return;
    main.innerHTML = `
      <h1 class="portal-page-title">${t('reports')}</h1>
      <p class="portal-page-subtitle"><a class="portal-link" href="${IS_EN ? BASE + 'en/client/index.html' : BASE + 'client/index.html'}">← ${t('back')}</a></p>
      ${reports.length === 0 ? `
        <div class="portal-empty"><div class="portal-empty__icon">📄</div>${t('noReports')}</div>
      ` : `
        <div class="portal-list">
          ${reports.map(r => `
            <div class="portal-list__item">
              <div>
                <div style="font-weight:700;">${r.title}</div>
                <div class="portal-list__meta">${t('date')}: ${formatDate(r.created_at)}</div>
              </div>
              <a class="portal-btn portal-btn--outline" href="${IS_EN ? BASE + 'en/client/report.html?id=' + r.id : BASE + 'client/report.html?id=' + r.id}">${t('viewReport')}</a>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function renderReport(report) {
    const main = document.getElementById('portal-main');
    if (!main) return;
    main.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <div>
          <h1 class="portal-page-title" style="margin-bottom:0.25rem;">${report.title}</h1>
          <p class="portal-page-subtitle" style="margin:0;">${t('date')}: ${formatDate(report.created_at)}</p>
        </div>
        <div style="display:flex;gap:0.75rem;">
          <a class="portal-btn portal-btn--outline" href="${IS_EN ? BASE + 'en/client/index.html' : BASE + 'client/index.html'}">${t('back')}</a>
          <button class="portal-btn" onclick="window.print()">🖨️ ${t('print')}</button>
        </div>
      </div>
      <div class="portal-report">${report.content_html || '<p>' + t('notFound') + '</p>'}</div>
    `;
  }

  async function initDashboard() {
    showLoading('portal-main');
    const user = await requireAuth();
    if (!user) return;
    injectHeader(user);
    injectSidebar();

    const { data: client, error: clientErr } = await loadClient(user);
    if (clientErr) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${t('errorLoading')}</div>`;
      console.error(clientErr);
      return;
    }
    if (!client) {
      document.getElementById('portal-main').innerHTML = `
        <div class="portal-alert portal-alert--info">
          <div style="font-weight:700;margin-bottom:0.5rem;">${t('noClientRecord')}</div>
          <a class="portal-link" href="${BASE}${IS_EN ? 'en/' : ''}contact.html">${t('contactUs')}</a>
        </div>
      `;
      return;
    }

    const [{ data: projects }, { data: reports }] = await Promise.all([
      loadProjects(client.id),
      loadReports(client.id)
    ]);
    renderDashboard(client, projects || [], reports || []);
  }

  async function initReports() {
    showLoading('portal-main');
    const user = await requireAuth();
    if (!user) return;
    injectHeader(user);
    injectSidebar();

    const { data: client, error: clientErr } = await loadClient(user);
    if (clientErr || !client) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${clientErr ? t('errorLoading') : t('noClientRecord')}</div>`;
      return;
    }
    const { data: reports } = await loadReports(client.id);
    renderReportsList(reports || []);
  }

  async function initReportView() {
    showLoading('portal-main');
    const user = await requireAuth();
    if (!user) return;
    injectHeader(user);
    injectSidebar();

    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('id');
    if (!reportId) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${t('notFound')}</div>`;
      return;
    }

    const sb = getSupabase();
    const { data: report, error } = await sb
      .from('ai_advisor_reports')
      .select('*, advisory_clients!inner(auth_user_id)')
      .eq('id', reportId)
      .maybeSingle();

    if (error || !report) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${t('notFound')}</div>`;
      console.error(error);
      return;
    }
    renderReport(report);
  }

  async function logout() {
    if (window.BondsAuth && window.BondsAuth.signOut) {
      await window.BondsAuth.signOut();
    }
    window.location.href = BASE + 'client/login.html';
  }

  window.BondsClientPortal = {
    initDashboard,
    initReports,
    initReportView,
    logout,
    t
  };
})();
