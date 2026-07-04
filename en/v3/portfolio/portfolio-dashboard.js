/**
 * BONDS Portfolio Dashboard — Phase E.1 (English)
 */

(function () {
  const root = document.getElementById('portfolio-root');
  let currentData = null;
  let currentFilter = 'all';
  let currentTab = 'overview';
  let chartInstances = {};
  let notificationsData = { notifications: [], unreadCount: 0 };

  const READ_KEY = 'bonds_ecc_notifications_read';
  const WELCOME_KEY = 'bonds_portfolio_welcome_seen';

  function icon(name, size) {
    if (!window.EccIcons) return '';
    return window.EccIcons.render ? window.EccIcons.render(name, { size: size || 20 }) : window.EccIcons.get(name);
  }

  function getReadIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
    } catch (e) {
      return new Set();
    }
  }

  function saveReadIds(ids) {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
  }

  function computeUnreadCount(notifications) {
    const read = getReadIds();
    return notifications.filter(n => !read.has(n.id)).length;
  }

  function redirectToLogin() {
    const isEn = document.documentElement.lang && document.documentElement.lang.startsWith('en');
    const authUrl = isEn ? '/en/calculators/auth/index.html' : '/calculators/auth/index.html';
    const current = location.pathname + location.search;
    sessionStorage.setItem('auth_redirect', current);
    location.href = `${authUrl}?redirect=${encodeURIComponent(current)}`;
  }

  function fetchWithTimeout(url, options, ms = 20000) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('Server connection timed out'));
      }, ms);
      fetch(url, { ...options, signal: controller.signal })
        .then((res) => { clearTimeout(timeout); resolve(res); })
        .catch((err) => { clearTimeout(timeout); reject(err); });
    });
  }

  async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      if (window.BondsAuth && window.BondsAuth.getSession) {
        const { data } = await Promise.race([
          window.BondsAuth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('session timeout')), 5000))
        ]);
        const token = data?.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('[PortfolioDashboard] unable to read session', e);
    }
    return headers;
  }

  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return Number(num).toLocaleString('en-US');
  }

  function healthClass(health) {
    return 'health--' + (health === 'healthy' ? 'healthy' : health === 'attention' ? 'attention' : 'at-risk');
  }

  function healthLabel(health) {
    return { healthy: 'Healthy', attention: 'Needs Attention', at_risk: 'At Risk' }[health] || health;
  }

  function priorityClass(priority) {
    return 'priority-' + (['critical', 'high', 'medium', 'low'].includes(priority) ? priority : 'medium');
  }

  function alertIcon(type) {
    const map = {
      blocked: 'warning',
      readiness: 'trendingDown',
      valuation: 'dollarSign',
      financing: 'zap'
    };
    return icon(map[type] || 'search', 18);
  }

  function showError(message) {
    root.innerHTML = `<div class="error"><h2 style="display:flex;align-items:center;justify-content:center;gap:0.5rem;">${icon('warning', 24)} <span>Error</span></h2><p>${message}</p><div style="margin-top:1rem;display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;"><button class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.refresh()">${icon('refresh', 16)} Try again</button><button class="ecc-btn ecc-btn--secondary" onclick="PortfolioDashboard.login()">Log in</button></div></div>`;
  }

  function renderSummary(summary) {
    return `
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-card__value">${formatNumber(summary.totalProjects)}</div>
          <div class="summary-card__label">Total Projects</div>
        </div>
        <div class="summary-card">
          <div class="summary-card__value">${formatNumber(summary.healthy)}</div>
          <div class="summary-card__label">Healthy</div>
        </div>
        <div class="summary-card">
          <div class="summary-card__value">${formatNumber(summary.attention)}</div>
          <div class="summary-card__label">Needs Attention</div>
        </div>
        <div class="summary-card">
          <div class="summary-card__value">${formatNumber(summary.atRisk)}</div>
          <div class="summary-card__label">At Risk</div>
        </div>
        <div class="summary-card">
          <div class="summary-card__value">${summary.averageReadiness || 0}</div>
          <div class="summary-card__label">Avg Readiness</div>
        </div>
        <div class="summary-card">
          <div class="summary-card__value">${summary.averageConfidence || 0}%</div>
          <div class="summary-card__label">Avg Confidence</div>
        </div>
        <div class="summary-card">
          <div class="summary-card__value">${formatNumber(summary.totalCapital)}</div>
          <div class="summary-card__label">Total Capital</div>
        </div>
        <div class="summary-card">
          <div class="summary-card__value">${formatNumber(summary.totalRevenue)}</div>
          <div class="summary-card__label">Total Revenue</div>
        </div>
      </div>
    `;
  }

  function scoreClass(score) {
    if (score >= 80) return 'score--healthy';
    if (score >= 50) return 'score--attention';
    return 'score--at-risk';
  }

  function scoreLabel(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 50) return 'Good';
    return 'Needs work';
  }

  function renderActionCenter(summary, actions) {
    const hasProjects = summary.totalProjects > 0;
    const score = hasProjects ? Math.round(summary.averageReadiness || 0) : null;
    const next = actions && actions[0];
    let nextHtml;
    if (next) {
      nextHtml = `
        <div class="next-action__label">Next Action</div>
        <div class="next-action__title">${next.action || 'Recommended action'}</div>
        <div class="next-action__desc">${next.reason || ''}</div>
        <button type="button" class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.doNextAction('${next.projectId || next.project_id || ''}')">Open Project</button>
      `;
    } else if (hasProjects) {
      nextHtml = `
        <div class="next-action__label">Next Action</div>
        <div class="next-action__title">No immediate actions</div>
        <div class="next-action__desc">Check notifications or complete project data to improve readiness.</div>
      `;
    } else {
      nextHtml = `
        <div class="next-action__label">Start now</div>
        <div class="next-action__title">Create your first project</div>
        <div class="next-action__desc">In a few steps you’ll get a feasibility study, risk assessment, and financing options.</div>
        <button type="button" class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.createProject()">${icon('plus', 16)} New Project</button>
      `;
    }
    return `
      <div class="action-center">
        <div class="action-center__main">
          <div class="portfolio-health">
            <div class="portfolio-health__score ${score !== null ? scoreClass(score) : ''}">${score !== null ? score : '—'}</div>
            <div class="portfolio-health__label">Portfolio Health</div>
            <div class="portfolio-health__sublabel">${score !== null ? scoreLabel(score) : 'Add a project to see the score'}</div>
          </div>
          <div class="next-action">
            ${nextHtml}
          </div>
        </div>
        ${canWrite(currentData?.meta?.role || 'viewer') && hasProjects ? `<div class="action-center__create"><button type="button" class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.createProject()">${icon('plus', 16)} New Project</button></div>` : ''}
      </div>
    `;
  }

  function renderFilters() {
    return `
      <div class="filter-bar">
        <span style="color:var(--text-secondary);font-size:0.85rem;">Filter:</span>
        <button type="button" class="ecc-btn ecc-btn--secondary active" data-filter="all" onclick="PortfolioDashboard.filter('all')">All</button>
        <button type="button" class="ecc-btn ecc-btn--secondary" data-filter="healthy" onclick="PortfolioDashboard.filter('healthy')">Healthy</button>
        <button type="button" class="ecc-btn ecc-btn--secondary" data-filter="attention" onclick="PortfolioDashboard.filter('attention')">Needs Attention</button>
        <button type="button" class="ecc-btn ecc-btn--secondary" data-filter="at_risk" onclick="PortfolioDashboard.filter('at_risk')">At Risk</button>
        <button type="button" class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.refresh()">${icon('refresh', 16)} Refresh</button>
      </div>
    `;
  }

  function renderCharts() {
    return `
      <div class="ecc-card chart-section">
        <div class="ecc-card__title">Sector Distribution</div>
        <div class="mini-chart"><canvas id="sectors-chart"></canvas></div>
      </div>
      <div class="ecc-card chart-section">
        <div class="ecc-card__title">Stage Distribution</div>
        <div class="mini-chart"><canvas id="stages-chart"></canvas></div>
      </div>
      <div class="ecc-card chart-section">
        <div class="ecc-card__title">Portfolio Health</div>
        <div class="mini-chart"><canvas id="health-chart"></canvas></div>
      </div>
    `;
  }

  function renderProjects(projects) {
    const canCreate = canWrite(currentData?.meta?.role || 'viewer');
    if (!projects.length) {
      return `
        <div class="ecc-card projects-section empty-state">
          <div class="empty-state__icon">📁</div>
          <div class="empty-state__title">No projects yet</div>
          <p class="empty-state__text">Create your first project. In a few steps you'll get a feasibility study, risk assessment, and financing options.</p>
          ${canCreate ? `<div class="empty-state__actions"><button type="button" class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.createProject()">${icon('plus', 16)} Create New Project</button><button type="button" class="ecc-btn ecc-btn--secondary" onclick="PortfolioDashboard.createDemoProject()">${icon('sparkles', 16)} Try a demo project</button></div>` : ''}
        </div>
      `;
    }
    return `
      <div class="ecc-card projects-section">
        <div class="ecc-card__title">Projects</div>
        <div style="overflow-x:auto;">
          <table class="projects-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Stage</th>
                <th>Readiness</th>
                <th>Confidence</th>
                <th>Health</th>
                <th>Capital</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${projects.map(p => `
                <tr>
                  <td>
                    <div class="project-name" role="link" tabindex="0" aria-label="Open project ${p.name}" onclick="PortfolioDashboard.openProject('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' ')PortfolioDashboard.openProject('${p.id}')">${p.name}</div>
                    <div class="project-meta">${p.sector || ''}${p.activity ? ' · ' + p.activity : ''} · ${p.city || ''}</div>
                  </td>
                  <td><span class="stage-badge">${p.stage}</span></td>
                  <td>${p.readinessScore || 0}</td>
                  <td>${p.confidence || 0}%</td>
                  <td><span class="health-badge ${healthClass(p.health)}">${healthLabel(p.health)}</span></td>
                  <td>${formatNumber(p.capital)}</td>
                  <td>${formatNumber(p.revenue)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAlerts(alerts) {
    return `
      <div class="ecc-card alerts-section">
        <div class="ecc-card__title">Critical Alerts (${alerts.length})</div>
        ${alerts.length ? alerts.slice(0, 10).map(a => `
          <div class="alert">
            <div class="alert__icon" aria-hidden="true">${alertIcon(a.type)}</div>
            <div>
              <div class="alert__title">${a.title_en || a.title}</div>
              <div class="alert__msg">${a.message_en || a.message}</div>
              <div class="alert__project">${a.projectName}</div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-secondary);font-size:0.85rem;">No critical alerts.</p>'}
      </div>
    `;
  }

  function renderActions(actions) {
    return `
      <div class="ecc-card actions-section">
        <div class="ecc-card__title">Recommended Next Actions (${actions.length})</div>
        ${actions.length ? actions.slice(0, 10).map(a => `
          <div class="action-item ${priorityClass(a.priority)}">
            <div aria-hidden="true">${icon('target', 18)}</div>
            <div>
              <div class="action-item__title">${a.action_en || a.action || 'Action'}</div>
              <div class="action-item__desc">${a.reason_en || a.reason || ''}</div>
              <div class="action-item__project">${a.projectName}</div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-secondary);font-size:0.85rem;">No recommended actions.</p>'}
      </div>
    `;
  }

  function destroyCharts() {
    Object.values(chartInstances).forEach(c => c?.destroy && c.destroy());
    chartInstances = {};
  }

  function buildCharts(data, filter) {
    if (!data) return;
    if (typeof Chart === 'undefined') return;
    destroyCharts();

    const projects = filter === 'all' ? data.projects : data.projects.filter(p => p.health === filter);
    const healthCounts = { healthy: 0, attention: 0, at_risk: 0 };
    projects.forEach(p => { healthCounts[p.health] = (healthCounts[p.health] || 0) + 1; });

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } } }
    };

    const ctxHealth = document.getElementById('health-chart');
    if (ctxHealth) {
      chartInstances.health = new Chart(ctxHealth, {
        type: 'doughnut',
        data: {
          labels: ['Healthy', 'Needs Attention', 'At Risk'],
          datasets: [{
            data: [healthCounts.healthy, healthCounts.attention, healthCounts.at_risk],
            backgroundColor: ['rgba(34,197,94,0.7)', 'rgba(234,179,8,0.7)', 'rgba(239,68,68,0.7)'],
            borderWidth: 0
          }]
        },
        options: commonOptions
      });
    }

    const sectors = {};
    projects.forEach(p => { sectors[p.sector || 'Unspecified'] = (sectors[p.sector || 'Unspecified'] || 0) + 1; });
    const ctxSectors = document.getElementById('sectors-chart');
    if (ctxSectors) {
      chartInstances.sectors = new Chart(ctxSectors, {
        type: 'pie',
        data: {
          labels: Object.keys(sectors),
          datasets: [{
            data: Object.values(sectors),
            backgroundColor: ['#d4a853', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#14b8a6'],
            borderWidth: 0
          }]
        },
        options: commonOptions
      });
    }

    const stages = {};
    projects.forEach(p => { stages[p.stage || 'idea'] = (stages[p.stage || 'idea'] || 0) + 1; });
    const ctxStages = document.getElementById('stages-chart');
    if (ctxStages) {
      chartInstances.stages = new Chart(ctxStages, {
        type: 'bar',
        data: {
          labels: Object.keys(stages),
          datasets: [{
            label: 'Projects',
            data: Object.values(stages),
            backgroundColor: 'rgba(212,168,83,0.7)',
            borderRadius: 6
          }]
        },
        options: {
          ...commonOptions,
          scales: {
            y: { beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
          }
        }
      });
    }
  }

  function canWrite(role) {
    return role === 'owner' || role === 'admin';
  }

  function renderHeader() {
    const unread = computeUnreadCount(notificationsData.notifications);
    const role = currentData?.meta?.role || 'viewer';
    const roleBadge = role === 'viewer' ? '<span class="role-badge role-badge--viewer">Read-only</span>' : role === 'advisor' ? '<span class="role-badge role-badge--advisor">Advisor</span>' : '';
    return `
      <div class="ecc-header">
        <div class="ecc-header__title">
          <h1>Action Center</h1>
          <p>Where you stand, what's missing, and what to do next. ${roleBadge}</p>
        </div>
        <div class="ecc-header__actions" style="position:relative;">
          <div class="notification-bell" id="notification-bell" role="button" tabindex="0" aria-label="Notifications" aria-expanded="false" onclick="PortfolioDashboard.toggleNotifications(event)" onkeydown="if(event.key==='Enter'||event.key===' ')PortfolioDashboard.toggleNotifications(event)">
            ${icon('bell', 20)}
            ${unread > 0 ? `<span class="notification-badge" aria-label="${unread} unread notifications">${unread}</span>` : ''}
            <div class="notification-panel" id="notification-panel" onclick="event.stopPropagation()">
              ${renderNotificationPanel()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderNotificationPanel() {
    const notifications = notificationsData.notifications || [];
    const read = getReadIds();
    if (!notifications.length) {
      return '<div class="notification-empty">No notifications yet.</div>';
    }
    return `
      <div class="notification-actions">
        <strong style="font-size:0.85rem;">Notifications</strong>
        <button type="button" class="ecc-btn ecc-btn--secondary" style="padding:0.35rem 0.6rem;font-size:0.7rem;" onclick="PortfolioDashboard.markAllRead()">Mark all read</button>
      </div>
      ${notifications.slice(0, 20).map(n => `
        <div class="notification-item ${read.has(n.id) ? '' : 'unread'} ${priorityClass(n.priority)}" role="button" tabindex="0" aria-label="${n.title_en || n.title}" onclick="PortfolioDashboard.clickNotification('${n.id}', '${n.actionUrl || ''}')" onkeydown="if(event.key==='Enter'||event.key===' ')PortfolioDashboard.clickNotification('${n.id}', '${n.actionUrl || ''}')">
          <div class="notification-item__title">${n.title_en || n.title}</div>
          <div class="notification-item__msg">${n.message_en || n.message}</div>
          <div class="notification-item__meta">${n.projectName}</div>
        </div>
      `).join('')}
    `;
  }

  function renderChecklist(hasProjects) {
    if (hasProjects) return '';
    const steps = [
      { label: 'Create your first project', done: false },
      { label: 'Fill in basic project details', done: false },
      { label: 'Run feasibility & risk assessment', done: false },
      { label: 'Review your investment memorandum', done: false }
    ];
    return `
      <div class="getting-started">
        <div class="getting-started__title">${icon('target', 18)} Get started in a few steps</div>
        <ul class="getting-started__list">
          ${steps.map(s => `
            <li class="getting-started__item">
              <span class="getting-started__check ${s.done ? 'is-done' : ''}">${s.done ? '✓' : ''}</span>
              <span class="getting-started__label ${s.done ? 'is-done' : ''}">${s.label}</span>
            </li>
          `).join('')}
        </ul>
        <button type="button" class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.createDemoProject()">${icon('plus', 16)} Try a demo project</button>
      </div>
    `;
  }

  function renderWelcomeModal() {
    const existing = document.getElementById('portfolioWelcomeModal');
    if (existing) return;
    const modal = document.createElement('div');
    modal.id = 'portfolioWelcomeModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle">
        <div class="modal__header">
          <h2 id="welcomeTitle">Welcome to your Action Center</h2>
          <button type="button" class="modal__close" id="closeWelcome" aria-label="Close">×</button>
        </div>
        <div class="modal__body">
          <p class="modal__intro">Get an investment-ready report in 3 steps:</p>
          <div class="welcome-steps">
            <div class="welcome-step">
              <div class="welcome-step__num">1</div>
              <div class="welcome-step__title">Create a project</div>
              <div class="welcome-step__desc">Name, sector, and city only.</div>
            </div>
            <div class="welcome-step">
              <div class="welcome-step__num">2</div>
              <div class="welcome-step__title">Complete the data</div>
              <div class="welcome-step__desc">Add costs, revenue, and financing.</div>
            </div>
            <div class="welcome-step">
              <div class="welcome-step__num">3</div>
              <div class="welcome-step__title">Receive your report</div>
              <div class="welcome-step__desc">Feasibility study, risk assessment, and investment memorandum.</div>
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <button type="button" class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.dismissWelcome(true)">Start now</button>
          <button type="button" class="ecc-btn ecc-btn--secondary" onclick="PortfolioDashboard.dismissWelcome(false)">Later</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeWelcome').addEventListener('click', () => PortfolioDashboard.dismissWelcome(false));
    modal.addEventListener('click', (e) => { if (e.target === modal) PortfolioDashboard.dismissWelcome(false); });
  }

  function maybeShowWelcome() {
    try {
      if (localStorage.getItem(WELCOME_KEY)) return;
    } catch (e) { return; }
    renderWelcomeModal();
  }

  function renderSearchBar() {
    return `
      <div class="search-bar">
        <input type="text" class="search-input" id="search-input" placeholder="Search your projects, memoranda, tasks, approvals..." aria-label="Search" onkeydown="if(event.key==='Enter')PortfolioDashboard.runSearch()" />
        <button type="button" class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.runSearch()">${icon('search', 16)} Search</button>
      </div>
      <div id="search-results" class="search-results" style="display:none;" role="region" aria-live="polite"></div>
    `;
  }

  function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    if (!container) return;
    if (!results.length) {
      container.innerHTML = '<p style="color:var(--text-secondary);padding:1rem;">No matching results.</p>';
      container.style.display = 'block';
      return;
    }
    container.innerHTML = results.map(r => `
      <div class="search-result" role="link" tabindex="0" aria-label="${r.title_en || r.title}" onclick="window.location.href='${r.url || '#'}'" onkeydown="if(event.key==='Enter'||event.key===' ')window.location.href='${r.url || '#'}'">
        <span class="search-result__source">${r.source}</span>
        <div class="search-result__title">${r.title_en || r.title}</div>
        <div class="search-result__snippet">${r.message_en || r.snippet}</div>
        <div class="search-result__meta">${r.projectName || ''} · relevance ${r.score}</div>
      </div>
    `).join('');
    container.style.display = 'block';
  }

  function renderTabs() {
    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'actions', label: 'Actions' },
      { id: 'search', label: 'Search' }
    ];
    return `
      <div class="ecc-tabs" role="tablist" aria-label="Portfolio dashboard sections">
        ${tabs.map(t => `
          <button type="button" id="tab-btn-${t.id}" class="ecc-tab ${t.id === currentTab ? 'active' : ''}" role="tab" aria-selected="${t.id === currentTab ? 'true' : 'false'}" aria-controls="tab-panel-${t.id}" data-tab="${t.id}" onclick="PortfolioDashboard.switchTab('${t.id}')">${t.label}</button>
        `).join('')}
      </div>
    `;
  }

  function render(data, filter = 'all', tab = 'overview') {
    currentData = data;
    currentFilter = filter;
    currentTab = tab;
    const projects = filter === 'all' ? data.projects : data.projects.filter(p => p.health === filter);
    const hasProjects = data.summary.totalProjects > 0;

    root.innerHTML = `
      ${renderHeader()}
      ${renderActionCenter(data.summary, data.upcomingActions)}
      ${renderChecklist(hasProjects)}
      ${renderTabs()}

      <div id="tab-panel-overview" class="ecc-tab-panel ${tab === 'overview' ? 'active' : ''}" role="tabpanel" aria-labelledby="tab-btn-overview">
        <div class="ecc-grid">
          ${renderSummary(data.summary)}
          ${renderFilters()}
          ${renderCharts()}
          ${renderProjects(projects)}
        </div>
      </div>

      <div id="tab-panel-actions" class="ecc-tab-panel ${tab === 'actions' ? 'active' : ''}" role="tabpanel" aria-labelledby="tab-btn-actions">
        <div class="ecc-grid">
          ${renderAlerts(data.alerts)}
          ${renderActions(data.upcomingActions)}
        </div>
      </div>

      <div id="tab-panel-search" class="ecc-tab-panel ${tab === 'search' ? 'active' : ''}" role="tabpanel" aria-labelledby="tab-btn-search">
        <div class="ecc-grid">
          ${renderSearchBar()}
        </div>
      </div>
    `;

    if (tab === 'overview') {
      buildCharts(data, filter);
    }

    maybeShowWelcome();
  }

  function switchTab(tab) {
    if (!['overview', 'actions', 'search'].includes(tab)) return;
    currentTab = tab;
    document.querySelectorAll('.ecc-tab').forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.ecc-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'tab-panel-' + tab);
    });
    if (tab === 'overview') {
      buildCharts(currentData, currentFilter);
    }
  }

  async function loadNotifications() {
    try {
      const res = await fetch('/api/v3/ecc/notifications', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ limit: 50 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load notifications');
      notificationsData = data;
      if (currentData) {
        const header = root.querySelector('.ecc-header');
        if (header) {
          const temp = document.createElement('div');
          temp.innerHTML = renderHeader();
          header.replaceWith(temp.firstElementChild);
        }
      }
    } catch (err) {
      console.warn('[PortfolioDashboard] notifications load failed', err);
    }
  }

  async function load() {
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        return redirectToLogin();
      }
      const res = await fetchWithTimeout('/api/v3/ecc/portfolio', {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      }, 20000);
      const data = await res.json();
      if (res.status === 401) {
        return redirectToLogin();
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load portfolio');
      const defaultTab = data.projects && data.projects.length ? 'actions' : 'overview';
      render(data, 'all', defaultTab);
      loadNotifications();
    } catch (err) {
      console.error('[PortfolioDashboard]', err);
      showError('Unable to load portfolio: ' + (err.message || 'Unknown error'));
    } finally {
      window.__PORTFOLIO_DASHBOARD_LOADED = true;
    }
  }

  function openCreateProjectModal() {
    const existing = document.getElementById('createProjectModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'createProjectModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="createProjectTitle">
        <div class="modal__header">
          <h2 id="createProjectTitle">Create New Project</h2>
          <button type="button" class="modal__close" id="closeCreateProject" aria-label="Close">×</button>
        </div>
        <form id="createProjectForm" class="modal__body">
          <p class="modal__intro">Just a few basic details. The rest will be completed inside the project.</p>
          <label class="form-field">
            <span>Project Name <span class="required">*</span></span>
            <input type="text" name="name" required placeholder="e.g. Riyadh Restaurant" />
          </label>
          <label class="form-field">
            <span>Sector <span class="required">*</span></span>
            <select name="sector" required>
              <option value="">Select sector</option>
              <option value="Restaurants & Hospitality">Restaurants & Hospitality</option>
              <option value="Real Estate & Construction">Real Estate & Construction</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Contracting">Contracting</option>
              <option value="Medical Facility">Medical Facility</option>
              <option value="Retail & Trade">Retail & Trade</option>
              <option value="Services">Services</option>
              <option value="Education & Training">Education & Training</option>
              <option value="Logistics & Transport">Logistics & Transport</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label class="form-field">
            <span>City</span>
            <input type="text" name="cityCode" placeholder="e.g. Riyadh" />
            <div class="form-help">Enter the city name. Currency and local data will be set automatically inside the project.</div>
          </label>
          <div class="modal__footer">
            <button type="submit" class="ecc-btn ecc-btn--primary" id="submitCreateProject">Create Project</button>
            <button type="button" class="ecc-btn ecc-btn--secondary" id="cancelCreateProject">Cancel</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('closeCreateProject').addEventListener('click', close);
    document.getElementById('cancelCreateProject').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('createProjectForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const submitBtn = document.getElementById('submitCreateProject');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      try {
        const headers = await getAuthHeaders();
        const body = {
          name: form.name.value.trim(),
          sector: form.sector.value,
          activity: form.sector.value,
          cityCode: form.cityCode.value.trim() || undefined,
          currency: 'SAR',
          language: 'en'
        };
        const res = await fetch('/api/v3/projects', { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) return redirectToLogin();
          throw new Error(data.error || 'Failed to create project');
        }
        window.location.href = `/en/v3/project?id=${encodeURIComponent(data.project.id)}`;
      } catch (err) {
        alert('Failed to create project: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${icon('plus', 16)} Create Project`;
      }
    });
  }

  async function createDemoProject() {
    try {
      const headers = await getAuthHeaders();
      const body = {
        name: 'Demo Project — Riyadh Restaurant',
        sector: 'Restaurants & Hospitality',
        activity: 'Demo restaurant',
        cityCode: 'Riyadh',
        currency: 'SAR',
        language: 'en'
      };
      const res = await fetch('/api/v3/projects', { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) return redirectToLogin();
        throw new Error(data.error || 'Failed to create demo project');
      }
      window.location.href = `/en/v3/project?id=${encodeURIComponent(data.project.id)}`;
    } catch (err) {
      alert('Failed to create demo project: ' + err.message);
    }
  }

  function dismissWelcome(startNow) {
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) {}
    const modal = document.getElementById('portfolioWelcomeModal');
    if (modal) modal.remove();
    if (startNow) openCreateProjectModal();
  }

  window.PortfolioDashboard = {
    refresh: load,
    login: redirectToLogin,
    filter: (filter) => {
      if (!currentData) return;
      render(currentData, filter, currentTab);
    },
    switchTab,
    openProject: (id) => {
      window.location.href = `/en/v3/project?id=${encodeURIComponent(id)}`;
    },
    createProject: openCreateProjectModal,
    createDemoProject,
    dismissWelcome,
    doNextAction: (projectId) => {
      if (projectId) window.location.href = `/en/v3/project?id=${encodeURIComponent(projectId)}`;
    },
    toggleNotifications: (e) => {
      if (e) e.stopPropagation();
      const panel = document.getElementById('notification-panel');
      const bell = document.getElementById('notification-bell');
      if (!panel) return;
      const isOpen = panel.classList.contains('open');
      document.querySelectorAll('.notification-panel.open').forEach(p => p.classList.remove('open'));
      document.querySelectorAll('.notification-bell[aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false'));
      if (!isOpen) {
        panel.classList.add('open');
        if (bell) bell.setAttribute('aria-expanded', 'true');
      }
    },
    clickNotification: (id, url) => {
      const read = getReadIds();
      read.add(id);
      saveReadIds(read);
      if (url) window.location.href = url;
      else PortfolioDashboard.refresh();
    },
    markAllRead: () => {
      const read = getReadIds();
      notificationsData.notifications.forEach(n => read.add(n.id));
      saveReadIds(read);
      PortfolioDashboard.refresh();
    },
    runSearch: async () => {
      const input = document.getElementById('search-input');
      const query = input?.value?.trim();
      if (!query) return;
      const btn = input.nextElementSibling;
      if (btn) { btn.disabled = true; btn.innerHTML = `${icon('refresh', 14)}`; }
      try {
        const res = await fetch('/api/v3/ecc/search', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ query, limit: 50 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search failed');
        renderSearchResults(data.results || []);
      } catch (err) {
        alert('Search failed: ' + err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = `${icon('search', 16)} Search`; }
      }
    }
  };

  document.addEventListener('click', () => {
    document.querySelectorAll('.notification-panel.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.notification-bell[aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  });

  load();

  setInterval(() => {
    const searchInput = document.getElementById('search-input');
    if (document.hidden || (searchInput && searchInput === document.activeElement)) return;
    load();
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
})();
