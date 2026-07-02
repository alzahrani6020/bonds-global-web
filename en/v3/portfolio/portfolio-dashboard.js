/**
 * BONDS Portfolio Dashboard — Phase E.1 (English)
 */

(function () {
  const root = document.getElementById('portfolio-root');
  let currentData = null;
  let chartInstances = {};
  let notificationsData = { notifications: [], unreadCount: 0 };

  const READ_KEY = 'bonds_ecc_notifications_read';

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

  async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      if (window.BondsAuth && window.BondsAuth.getSession) {
        const { data } = await window.BondsAuth.getSession();
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

  function showError(message) {
    root.innerHTML = `<div class="error"><h2>⚠️ Error</h2><p>${message}</p></div>`;
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

  function renderFilters() {
    return `
      <div class="filter-bar">
        <span style="color:var(--text-secondary);font-size:0.85rem;">Filter:</span>
        <button class="ecc-btn ecc-btn--secondary active" data-filter="all" onclick="PortfolioDashboard.filter('all')">All</button>
        <button class="ecc-btn ecc-btn--secondary" data-filter="healthy" onclick="PortfolioDashboard.filter('healthy')">Healthy</button>
        <button class="ecc-btn ecc-btn--secondary" data-filter="attention" onclick="PortfolioDashboard.filter('attention')">Needs Attention</button>
        <button class="ecc-btn ecc-btn--secondary" data-filter="at_risk" onclick="PortfolioDashboard.filter('at_risk')">At Risk</button>
        <button class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.refresh()">↻ Refresh</button>
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
    if (!projects.length) {
      return `
        <div class="ecc-card projects-section">
          <div class="ecc-card__title">Projects</div>
          <p style="color:var(--text-secondary);font-size:0.85rem;">No projects match the selected filter.</p>
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
                    <div class="project-name" onclick="PortfolioDashboard.openProject('${p.id}')">${p.name}</div>
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
            <div class="alert__icon">${a.type === 'blocked' ? '🚧' : a.type === 'readiness' ? '📉' : a.type === 'valuation' ? '💰' : a.type === 'financing' ? '⚡' : '🔍'}</div>
            <div>
              <div class="alert__title">${a.title}</div>
              <div class="alert__msg">${a.message}</div>
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
            <div>🎯</div>
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
    const role = currentData?.meta?.role || 'owner';
    const showCreate = canWrite(role);
    return `
      <div class="ecc-header">
        <div class="ecc-header__title">
          <h1>Investment Portfolio Dashboard</h1>
          <p>Executive overview of all your investment projects in one place.</p>
        </div>
        <div class="ecc-header__actions" style="position:relative;">
          ${showCreate ? `<button class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.createProject()">+ New Project</button>` : ''}
          <div class="notification-bell" id="notification-bell" onclick="PortfolioDashboard.toggleNotifications(event)">
            🔔
            ${unread > 0 ? `<span class="notification-badge">${unread}</span>` : ''}
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
        <button class="ecc-btn ecc-btn--secondary" style="padding:0.35rem 0.6rem;font-size:0.7rem;" onclick="PortfolioDashboard.markAllRead()">Mark all read</button>
      </div>
      ${notifications.slice(0, 20).map(n => `
        <div class="notification-item ${read.has(n.id) ? '' : 'unread'} ${priorityClass(n.priority)}" onclick="PortfolioDashboard.clickNotification('${n.id}', '${n.actionUrl || ''}')">
          <div class="notification-item__title">${n.title_en || n.title}</div>
          <div class="notification-item__msg">${n.message_en || n.message}</div>
          <div class="notification-item__meta">${n.projectName}</div>
        </div>
      `).join('')}
    `;
  }

  function renderSearchBar() {
    return `
      <div class="search-bar">
        <input type="text" class="search-input" id="search-input" placeholder="Search your projects, memoranda, tasks, approvals..." onkeydown="if(event.key==='Enter')PortfolioDashboard.runSearch()" />
        <button class="ecc-btn ecc-btn--primary" onclick="PortfolioDashboard.runSearch()">Search</button>
      </div>
      <div id="search-results" class="search-results" style="display:none;"></div>
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
      <div class="search-result" onclick="window.location.href='${r.url || '#'}'">
        <span class="search-result__source">${r.source}</span>
        <div class="search-result__title">${r.title_en || r.title}</div>
        <div class="search-result__snippet">${r.message_en || r.snippet}</div>
        <div class="search-result__meta">${r.projectName || ''} · relevance ${r.score}</div>
      </div>
    `).join('');
    container.style.display = 'block';
  }

  function render(data, filter = 'all') {
    currentData = data;
    const projects = filter === 'all' ? data.projects : data.projects.filter(p => p.health === filter);

    root.innerHTML = `
      ${renderHeader()}

      <div class="ecc-grid">
        ${renderSearchBar()}
        ${renderSummary(data.summary)}
        ${renderFilters()}
        ${renderCharts()}
        ${renderProjects(projects)}
        ${renderAlerts(data.alerts)}
        ${renderActions(data.upcomingActions)}
      </div>
    `;

    document.querySelectorAll('.filter-bar .ecc-btn[data-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    buildCharts(data, filter);
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
      const res = await fetch('/api/v3/ecc/portfolio', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load portfolio');
      render(data, 'all');
      loadNotifications();
    } catch (err) {
      console.error('[PortfolioDashboard]', err);
      showError('Unable to load portfolio: ' + err.message);
    }
  }

  window.PortfolioDashboard = {
    refresh: load,
    filter: (filter) => {
      if (!currentData) return;
      render(currentData, filter);
    },
    openProject: (id) => {
      window.location.href = `/en/v3/project?id=${encodeURIComponent(id)}`;
    },
    createProject: () => {
      window.location.href = '/en/v3/project/new';
    },
    toggleNotifications: (e) => {
      e.stopPropagation();
      const panel = document.getElementById('notification-panel');
      if (!panel) return;
      const isOpen = panel.classList.contains('open');
      document.querySelectorAll('.notification-panel.open').forEach(p => p.classList.remove('open'));
      if (!isOpen) panel.classList.add('open');
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
      if (btn) { btn.disabled = true; btn.textContent = '...'; }
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
        if (btn) { btn.disabled = false; btn.textContent = 'Search'; }
      }
    }
  };

  document.addEventListener('click', () => {
    document.querySelectorAll('.notification-panel.open').forEach(p => p.classList.remove('open'));
  });

  load();

  // Live radar: refresh every 60 seconds, unless user is typing a search
  setInterval(() => {
    const searchInput = document.getElementById('search-input');
    if (document.hidden || (searchInput && searchInput === document.activeElement)) return;
    load();
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
})();
