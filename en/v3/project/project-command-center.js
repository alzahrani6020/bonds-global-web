/**
 * BONDS Project Command Center — English Version (Phase E.0)
 *
 * Loads project status from /api/v3/ecc/project-status and renders the ECC UI.
 */

(function () {
  const root = document.getElementById('ecc-root');
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  let currentTab = 'overview';
  let currentData = null;
  const lang = document.documentElement.lang && document.documentElement.lang.startsWith('en') ? 'en' : 'ar';
  const fmt = window.BondsFormatting || { formatNumber: (n) => n };

  function icon(name, size) {
    if (!window.EccIcons) return '';
    return window.EccIcons.render ? window.EccIcons.render(name, { size: size || 20 }) : window.EccIcons.get(name);
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
      console.warn('[ProjectCommandCenter] unable to read session', e);
    }
    return headers;
  }

  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return fmt.formatNumber(num, lang);
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US');
    } catch (e) {
      return iso;
    }
  }

  function healthStatusClass(health) {
    if (health === 'healthy') return 'status--healthy';
    if (health === 'attention') return 'status--attention';
    return 'status--at-risk';
  }

  function healthStatusLabel(health) {
    if (health === 'healthy') return 'Healthy';
    if (health === 'attention') return 'Needs Attention';
    return 'At Risk';
  }

  function riskLabel(level) {
    return { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }[level] || level;
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
    root.innerHTML = `<div class="error"><h2 style="display:flex;align-items:center;justify-content:center;gap:0.5rem;">${icon('warning', 24)} <span>Error</span></h2><p>${message}</p></div>`;
  }

  function renderHeader(project, lifecycle, role) {
    const roleBadge = role === 'viewer' ? '<span class="role-badge role-badge--viewer">Read-only</span>' : role === 'advisor' ? '<span class="role-badge role-badge--advisor">Advisor</span>' : '';
    return `
      <div class="ecc-header">
        <div class="ecc-header__title">
          <div style="margin-bottom:0.35rem;">
            <a href="/en/v3/portfolio" style="font-size:0.8rem;color:var(--gold);text-decoration:none;display:inline-flex;align-items:center;gap:0.35rem;">${icon('arrowLeft', 14)} Back to Portfolio Dashboard</a>
          </div>
          <h1>${project.name}</h1>
          <p>${project.sector}${project.activity ? ' · ' + project.activity : ''} · ${project.city || ''} ${roleBadge}</p>
        </div>
        <div class="ecc-header__stage">${lifecycle?.currentStage || 'idea'}</div>
      </div>
    `;
  }

  function renderJourney(lifecycle) {
    const current = (lifecycle?.currentStage || 'idea').toLowerCase().replace(/\s/g, '_');
    const steps = [
      { id: 'idea', label: 'Idea' },
      { id: 'feasibility', label: 'Feasibility' },
      { id: 'valuation', label: 'Valuation' },
      { id: 'financing', label: 'Financing' },
      { id: 'readiness', label: 'Readiness' },
      { id: 'memorandum', label: 'Memorandum' },
      { id: 'investors', label: 'Investors' },
      { id: 'data_room', label: 'Data Room' },
      { id: 'publish', label: 'Publish' }
    ];
    const currentIndex = steps.findIndex(s => s.id === current);
    return `
      <div class="ecc-journey" role="list" aria-label="Project journey stages">
        ${steps.map((s, idx) => {
          const state = currentIndex === -1 ? '' : idx < currentIndex ? 'done' : idx === currentIndex ? 'current' : '';
          const dotContent = state === 'done' ? icon('check', 8) : '';
          return `
            <div class="ecc-journey__step ${state ? 'ecc-journey__step--' + state : ''}" role="listitem" aria-current="${state === 'current' ? 'step' : 'false'}">
              <div class="ecc-journey__dot" aria-hidden="true">${dotContent}</div>
              <div class="ecc-journey__label">${s.label}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderTabs() {
    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'timeline', label: 'Timeline' },
      { id: 'approvals', label: 'Approvals' },
      { id: 'alerts', label: 'Alerts' },
      { id: 'documents', label: 'Documents' }
    ];
    return `
      <div class="ecc-tabs" role="tablist" aria-label="Project command center sections">
        ${tabs.map(t => `
          <button type="button" id="tab-btn-${t.id}" class="ecc-tab ${t.id === currentTab ? 'active' : ''}" role="tab" aria-selected="${t.id === currentTab ? 'true' : 'false'}" aria-controls="tab-panel-${t.id}" data-tab="${t.id}" onclick="ProjectCommandCenter.switchTab('${t.id}')">${t.label}</button>
        `).join('')}
      </div>
    `;
  }

  function renderHealthCards(health) {
    return `
      <div class="health-cards">
        <div class="health-card">
          <div class="health-card__value">${health.readinessScore || 0}</div>
          <div class="health-card__label">Investment Readiness</div>
          ${health.readinessGrade ? `<span class="health-card__status ${healthStatusClass(health.projectHealth)}">Grade ${health.readinessGrade}</span>` : ''}
        </div>
        <div class="health-card">
          <div class="health-card__value">${health.confidence || 0}%</div>
          <div class="health-card__label">Overall Confidence</div>
          <span class="health-card__status ${healthStatusClass(health.projectHealth)}">${healthStatusLabel(health.projectHealth)}</span>
        </div>
        <div class="health-card">
          <div class="health-card__value">${riskLabel(health.riskLevel)}</div>
          <div class="health-card__label">Risk Level</div>
        </div>
        <div class="health-card">
          <div class="health-card__value">${health.completionPercentage || 0}%</div>
          <div class="health-card__label">Completion</div>
        </div>
        <div class="health-card">
          <div class="health-card__value">${health.fundingScore || 0}</div>
          <div class="health-card__label">Funding Score</div>
        </div>
        <div class="health-card">
          <div class="health-card__value">${health.valuationStatus?.label || 'Not Available'}</div>
          <div class="health-card__label">Valuation Status</div>
        </div>
      </div>
    `;
  }

  function renderMissionControl(mission) {
    const action = mission.nextBestAction || {};
    const alerts = mission.criticalAlerts || [];

    return `
      <div class="ecc-card mission-control">
        <div class="ecc-card__title">Mission Control</div>
        <div class="mission-item priority-${action.priority || 'medium'}">
          <div class="mission-item__icon" aria-hidden="true">${icon('target', 20)}</div>
          <div>
            <div class="mission-item__title">${action.action || 'No action defined'}</div>
            <div class="mission-item__desc">${action.reason || ''}</div>
          </div>
        </div>
        ${alerts.length ? '<div style="margin-top:1rem;"><strong style="font-size:0.85rem;color:#f0c96a;">Critical Alerts</strong></div>' : ''}
        ${alerts.slice(0, 3).map(a => `
          <div class="mission-item priority-${a.priority || 'medium'}">
            <div class="mission-item__icon" aria-hidden="true">${icon('warning', 20)}</div>
            <div>
              <div class="mission-item__title">${a.title}</div>
              <div class="mission-item__desc">${a.message}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderDecisionCockpit(approvals, timeline) {
    const pending = (approvals || []).filter(a => a.status === 'pending');
    const recentDecisions = (timeline || [])
      .filter(t => t.entry_type === 'decision' || t.entry_type === 'approval')
      .slice(0, 5);

    return `
      <div class="ecc-card decision-cockpit">
        <div class="ecc-card__title">Decision Cockpit</div>
        ${pending.length ? pending.map(a => `
          <div class="mission-item priority-high">
            <div class="mission-item__icon" aria-hidden="true">${icon('clock', 20)}</div>
            <div>
              <div class="mission-item__title">Pending Approval</div>
              <div class="mission-item__desc">Transition ${a.transition_id || a.stage_id} awaiting decision.</div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-secondary);font-size:0.85rem;">No pending decisions.</p>'}
        ${recentDecisions.length ? '<div style="margin-top:1rem;"><strong style="font-size:0.85rem;color:var(--text-secondary);">Recent Decisions</strong></div>' : ''}
        ${recentDecisions.map(d => `
          <div class="timeline__item" style="padding:0.5rem 0;">
            <div class="timeline__dot"></div>
            <div>
              <div class="timeline__title">${d.title}</div>
              <div class="timeline__meta">${formatDate(d.occurred_at)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderTimeline(timeline) {
    const items = (timeline || []).slice(0, 50);
    if (!items.length) {
      return `
        <div class="ecc-card timeline-section">
          <div class="ecc-card__title">Timeline</div>
          <p style="color:var(--text-secondary);font-size:0.85rem;">No recorded events yet.</p>
        </div>
      `;
    }

    return `
      <div class="ecc-card timeline-section">
        <div class="ecc-card__title">Unified Timeline</div>
        <div class="timeline">
          ${items.map(t => `
            <div class="timeline__item">
              <div class="timeline__dot"></div>
              <div>
                <div class="timeline__title">${t.title}</div>
                <div class="timeline__meta">${t.entry_type} · ${formatDate(t.occurred_at)}</div>
                ${t.description ? `<div class="mission-item__desc">${t.description}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderApprovals(approvals) {
    const list = approvals || [];
    const statusLabel = {
      pending: { text: 'Pending', class: 'status--attention' },
      approved: { text: 'Approved', class: 'status--healthy' },
      rejected: { text: 'Rejected', class: 'status--at-risk' }
    };
    return `
      <div class="ecc-card approvals-section">
        <div class="ecc-card__title">Approvals (${list.length})</div>
        ${list.length ? list.map(a => {
          const status = statusLabel[a.status] || { text: a.status, class: 'status--attention' };
          const iconName = a.status === 'pending' ? 'clock' : a.status === 'approved' ? 'checkCircle' : 'xCircle';
          return `
            <div class="mission-item priority-${a.priority || 'medium'}">
              <div class="mission-item__icon" aria-hidden="true">${icon(iconName, 20)}</div>
              <div>
                <div class="mission-item__title">${a.transition_id || a.stage_id || 'Approval'}</div>
                <div class="mission-item__desc">${a.approver_name || a.approver_id || ''} · ${formatDate(a.created_at)}</div>
                <span class="health-card__status ${status.class}">${status.text}</span>
              </div>
            </div>
          `;
        }).join('') : '<p style="color:var(--text-secondary);font-size:0.85rem;">No approvals recorded.</p>'}
      </div>
    `;
  }

  function renderDocuments(documents) {
    const docs = documents || [];
    return `
      <div class="ecc-card documents-section">
        <div class="ecc-card__title">Documents (${docs.length})</div>
        ${docs.length ? `
          <div class="documents-list">
            ${docs.map(d => `
              <div class="document-item">
                <div class="document-item__icon" aria-hidden="true">${icon('fileText', 20)}</div>
                <div>
                  <div class="document-item__title">${d.name || d.title || 'Document'}</div>
                  <div class="document-item__meta">${d.type || ''}${d.updated_at ? ' · ' + formatDate(d.updated_at) : ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color:var(--text-secondary);font-size:0.85rem;">No documents recorded yet.</p>'}
      </div>
    `;
  }

  function renderAlerts(mission) {
    const alerts = mission.criticalAlerts || [];
    return `
      <div class="ecc-card alerts-section">
        <div class="ecc-card__title">Smart Alerts</div>
        ${alerts.length ? alerts.map(a => `
          <div class="alert">
            <div class="alert__icon" aria-hidden="true">${alertIcon(a.type)}</div>
            <div>
              <div class="alert__title">${a.title}</div>
              <div class="alert__msg">${a.message}</div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-secondary);font-size:0.85rem;">No critical alerts.</p>'}
      </div>
    `;
  }

  function canWrite(role) {
    return role === 'owner' || role === 'admin';
  }

  function renderActionBar(project, lifecycle, role) {
    const currentStage = lifecycle?.currentStage || 'idea';
    const nextTransition = (lifecycle?.allowedTransitions || []).find(t => !t.optional);
    const writable = canWrite(role);

    return `
      <div class="action-bar">
        ${writable && nextTransition ? `<button type="button" class="ecc-btn ecc-btn--primary" onclick="ProjectCommandCenter.transition('${nextTransition.to}')">Move to ${nextTransition.to}</button>` : ''}
        ${writable ? `<button type="button" class="ecc-btn ecc-btn--secondary" onclick="ProjectCommandCenter.runReadiness()">Refresh Investment Readiness</button>` : ''}
        ${writable ? `<button type="button" class="ecc-btn ecc-btn--secondary" onclick="ProjectCommandCenter.generateMemorandum()">Generate Memorandum</button>` : ''}
        <button type="button" class="ecc-btn ecc-btn--secondary" onclick="ProjectCommandCenter.refresh()">${icon('refresh', 16)} Refresh</button>
      </div>
    `;
  }

  function switchTab(tab) {
    const valid = ['overview', 'timeline', 'approvals', 'alerts', 'documents'];
    if (!valid.includes(tab)) return;
    currentTab = tab;
    document.querySelectorAll('.ecc-tab').forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.ecc-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'tab-panel-' + tab);
    });
  }

  function render(data) {
    currentData = data;
    const { project, health, lifecycle, mission, documents, timeline, approvals } = data.status;
    const role = data.status.meta?.role || 'viewer';

    root.innerHTML = `
      ${renderHeader(project, lifecycle, role)}
      ${renderJourney(lifecycle)}
      ${renderTabs()}

      <div id="tab-panel-overview" class="ecc-tab-panel active" role="tabpanel" aria-labelledby="tab-btn-overview">
        <div class="ecc-grid">
          ${renderHealthCards(health)}
          ${renderMissionControl(mission)}
          ${renderDecisionCockpit(approvals, timeline)}
          ${renderActionBar(project, lifecycle, role)}
        </div>
      </div>

      <div id="tab-panel-timeline" class="ecc-tab-panel" role="tabpanel" aria-labelledby="tab-btn-timeline">
        <div class="ecc-grid">
          ${renderTimeline(timeline)}
        </div>
      </div>

      <div id="tab-panel-approvals" class="ecc-tab-panel" role="tabpanel" aria-labelledby="tab-btn-approvals">
        <div class="ecc-grid">
          ${renderApprovals(approvals)}
        </div>
      </div>

      <div id="tab-panel-alerts" class="ecc-tab-panel" role="tabpanel" aria-labelledby="tab-btn-alerts">
        <div class="ecc-grid">
          ${renderAlerts(mission)}
        </div>
      </div>

      <div id="tab-panel-documents" class="ecc-tab-panel" role="tabpanel" aria-labelledby="tab-btn-documents">
        <div class="ecc-grid">
          ${renderDocuments(documents)}
        </div>
      </div>
    `;

    if (lifecycle?.instanceId) {
      window.__ECC_INSTANCE_ID = lifecycle.instanceId;
    } else {
      delete window.__ECC_INSTANCE_ID;
    }

    if (window.BondsAIChat && window.BondsAIChat.mount) {
      window.BondsAIChat.mount({ projectId, mode: 'project' });
    }
  }

  async function load() {
    if (!projectId) {
      showError('Project ID is missing from the URL. Add ?id=PROJECT_ID');
      return;
    }

    try {
      const res = await fetch('/api/v3/ecc/project-status', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ projectId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load status');

      render(data);
    } catch (err) {
      console.error('[ProjectCommandCenter]', err);
      showError('Unable to load project data: ' + err.message);
    }
  }

  async function apiCall(path, { method = 'POST', body = null } = {}) {
    const options = {
      method,
      headers: await getAuthHeaders()
    };
    if (body !== null) options.body = JSON.stringify(body);
    const res = await fetch(path, options);
    return res.json();
  }

  window.ProjectCommandCenter = {
    refresh: load,
    switchTab,
    transition: async (toStage) => {
      const instanceId = window.__ECC_INSTANCE_ID;
      if (!instanceId) {
        alert('No active lifecycle for this project.');
        return;
      }
      if (!confirm(`Move to stage "${toStage}"?`)) return;
      try {
        await apiCall(`/api/v3/enterprise-lifecycle/instances/${instanceId}/transition`, {
          body: { toStage, reason: 'Triggered from Project Command Center' }
        });
        load();
      } catch (err) {
        alert('Transition failed: ' + err.message);
      }
    },
    runReadiness: async () => {
      try {
        await apiCall(`/api/v3/investment-intelligence/readiness/${projectId}`, { method: 'GET' });
        load();
      } catch (err) {
        alert('Refresh failed: ' + err.message);
      }
    },
    generateMemorandum: async () => {
      try {
        await apiCall('/api/v3/investment-intelligence/memorandum', {
          body: { projectId, type: 'investment_memorandum' }
        });
        load();
      } catch (err) {
        alert('Generate failed: ' + err.message);
      }
    }
  };

  load();
})();
