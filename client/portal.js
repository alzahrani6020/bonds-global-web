// Bonds Client Portal — Shared Logic
(function () {
  'use strict';

  const LANG = window.__PORTAL_LANG || 'ar';
  const IS_EN = LANG === 'en';
  const PAGE = window.__PORTAL_PAGE || 'dashboard';
  const ROOT = '/';

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
      documents: 'المستندات',
      uploadDocument: 'رفع مستند',
      noDocuments: 'لا توجد مستندات مرفوعة بعد.',
      download: 'تنزيل',
      analyze: 'تحليل',
      analyzing: 'جاري التحليل...',
      uploadError: 'فشل رفع الملف، حاول مرة أخرى.',
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
      documents: 'Documents',
      uploadDocument: 'Upload document',
      noDocuments: 'No uploaded documents yet.',
      download: 'Download',
      analyze: 'Analyze',
      analyzing: 'Analyzing...',
      uploadError: 'Upload failed, please try again.',
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

  function clientPath(page) {
    return IS_EN ? ROOT + 'en/client/' + page : ROOT + 'client/' + page;
  }

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
      window.location.href = clientPath('login.html') + '?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    return user;
  }

  function injectHeader(user) {
    const header = document.getElementById('portal-header');
    if (!header) return;
    const langHref = IS_EN ? '/client/index.html' : '/en/client/index.html';
    const dashboardHref = clientPath('index.html');
    header.innerHTML = `
      <header class="portal-header">
        <div class="portal-header__inner">
          <a class="portal-header__brand" href="${dashboardHref}">
            <img src="/assets/bonds-logo-2026-header.webp?v=2026" alt="Bonds" />
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
      { id: 'dashboard', icon: '📊', href: IS_EN ? clientPath('index.html') : clientPath('index.html') },
      { id: 'projects', icon: '📁', href: IS_EN ? clientPath('index.html#projects') : clientPath('index.html#projects') },
      { id: 'reports', icon: '📄', href: IS_EN ? clientPath('reports.html') : clientPath('reports.html') }
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
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  }

  async function loadWorkflows(projectIds) {
    const sb = getSupabase();
    if (!sb || !projectIds || projectIds.length === 0) return { data: [], error: null };
    const { data, error } = await sb
      .from('entity_workflows')
      .select('entity_id, current_state')
      .eq('entity_type', 'advisory_project')
      .in('entity_id', projectIds);
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

  async function loadDocuments(clientId) {
    const sb = getSupabase();
    if (!sb) return { data: [], error: new Error('Supabase not initialized') };
    const { data, error } = await sb
      .from('client_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  }

  async function uploadDocument(file, clientId) {
    const sb = getSupabase();
    if (!sb || !file) return { data: null, error: new Error('Missing file or client') };

    const safeName = file.name.replace(/[^a-zA-Z0-9_.\u0600-\u06FF-]/g, '_');
    const path = `client/${clientId}/${Date.now()}-${safeName}`;

    const { data: uploadData, error: uploadError } = await sb.storage
      .from('client-documents')
      .upload(path, file, { upsert: false });
    if (uploadError) return { data: null, error: uploadError };

    const { data: doc, error: insertError } = await sb
      .from('client_documents')
      .insert({
        client_id: clientId,
        filename: file.name,
        storage_path: uploadData.path,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size || 0,
        status: 'uploaded'
      })
      .select()
      .single();
    if (insertError) return { data: null, error: insertError };

    return { data: doc, error: null };
  }

  async function getDocumentDownloadUrl(storagePath) {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.storage
      .from('client-documents')
      .createSignedUrl(storagePath, 3600);
    if (error) return null;
    return data?.signedUrl || null;
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

  function renderDashboard(client, projects, reports, workflowsMap, documents) {
    const main = document.getElementById('portal-main');
    if (!main) return;

    const latestProject = projects[0];
    const latestReport = reports[0];
    const wf = workflowsMap || {};
    const docs = documents || [];

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
          <div style="margin-top:0.5rem;"><a class="portal-link" href="${IS_EN ? clientPath('report.html?id=' + latestReport.id) : clientPath('report.html?id=' + latestReport.id)}">${t('viewReport')}</a></div>
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
                  ${wf[p.id] ? `
                    <div class="portal-list__meta" style="margin-top:0.35rem;">${t('workflow')}: ${wf[p.id].current_state}</div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div class="portal-section">
        <div class="portal-section__title">${t('documents')}</div>
        <div style="margin-bottom:1rem;">
          <input type="file" id="docUploadInput" style="display:none;" />
          <button class="portal-btn" id="docUploadBtn">⬆️ ${t('uploadDocument')}</button>
          <span id="docUploadMsg" style="margin-right:0.75rem;color:var(--text-secondary);"></span>
        </div>
        ${docs.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">📎</div>${t('noDocuments')}</div>
        ` : `
          <div class="portal-list" id="documentsList">
            ${docs.map(d => `
              <div class="portal-list__item" data-doc-id="${d.id}" data-doc-path="${d.storage_path}">
                <div>
                  <div style="font-weight:700;">${d.filename}</div>
                  <div class="portal-list__meta">${formatDate(d.created_at)} · ${(d.size_bytes / 1024).toFixed(1)} KB · ${d.status}</div>
                  ${d.extracted_data && d.extracted_data.summary ? `<div class="portal-list__meta" style="margin-top:0.35rem;">${d.extracted_data.summary}</div>` : ''}
                </div>
                <div style="display:flex;gap:0.5rem;">
                  <button class="portal-btn portal-btn--outline doc-analyze-btn" ${d.status === 'analyzing' ? 'disabled' : ''}>${d.status === 'analyzing' ? t('analyzing') : t('analyze')}</button>
                  <button class="portal-btn portal-btn--outline doc-download-btn">${t('download')}</button>
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
                <a class="portal-btn portal-btn--outline" href="${clientPath('report.html?id=' + r.id)}">${t('viewReport')}</a>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    // Document upload handlers
    const uploadBtn = document.getElementById('docUploadBtn');
    const uploadInput = document.getElementById('docUploadInput');
    const uploadMsg = document.getElementById('docUploadMsg');
    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', function() { uploadInput.click(); });
      uploadInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;
        if (uploadMsg) uploadMsg.textContent = t('analyzing');
        const { data, error } = await uploadDocument(file, client.id);
        if (error || !data) {
          if (uploadMsg) uploadMsg.textContent = t('uploadError');
          console.error('Document upload failed:', error);
          return;
        }
        if (uploadMsg) uploadMsg.textContent = '';
        initDashboard();
      });
    }

    document.querySelectorAll('.doc-download-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const item = this.closest('[data-doc-path]');
        const path = item ? item.dataset.docPath : null;
        if (!path) return;
        const url = await getDocumentDownloadUrl(path);
        if (url) window.open(url, '_blank');
      });
    });

    document.querySelectorAll('.doc-analyze-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const item = this.closest('[data-doc-id]');
        const docId = item ? item.dataset.docId : null;
        if (!docId) return;
        btn.disabled = true;
        btn.textContent = t('analyzing');
        try {
          const session = await window.BondsAuth.getSession();
          const token = session?.data?.session?.access_token;
          if (!token) throw new Error('No session');
          const res = await fetch('/api/analyze-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ documentId: docId })
          });
          if (!res.ok) throw new Error('Analysis failed');
        } catch (e) {
          console.error(e);
          btn.textContent = t('analyze');
          btn.disabled = false;
          return;
        }
        initDashboard();
      });
    });
  }

  function renderReportsList(reports) {
    const main = document.getElementById('portal-main');
    if (!main) return;
    main.innerHTML = `
      <h1 class="portal-page-title">${t('reports')}</h1>
      <p class="portal-page-subtitle"><a class="portal-link" href="${IS_EN ? clientPath('index.html') : clientPath('index.html')}">← ${t('back')}</a></p>
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
              <a class="portal-btn portal-btn--outline" href="${IS_EN ? clientPath('report.html?id=' + r.id) : clientPath('report.html?id=' + r.id)}">${t('viewReport')}</a>
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
          <a class="portal-btn portal-btn--outline" href="${clientPath('index.html')}">${t('back')}</a>
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
          <a class="portal-link" href="${IS_EN ? '/en/contact.html' : '/contact.html'}">${t('contactUs')}</a>
        </div>
      `;
      return;
    }

    const [{ data: projects, error: projectsErr }, { data: reports }, { data: documents }] = await Promise.all([
      loadProjects(client.id),
      loadReports(client.id),
      loadDocuments(client.id)
    ]);
    if (projectsErr) console.error('Projects load error:', projectsErr);
    const projectList = projects || [];
    const projectIds = projectList.map(p => p.id);
    const { data: workflows } = await loadWorkflows(projectIds);
    const workflowsMap = {};
    (workflows || []).forEach(w => { workflowsMap[w.entity_id] = w; });
    renderDashboard(client, projectList, reports || [], workflowsMap, documents || []);
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
    window.location.href = clientPath('login.html');
  }

  window.BondsClientPortal = {
    initDashboard,
    initReports,
    initReportView,
    logout,
    t
  };
})();
