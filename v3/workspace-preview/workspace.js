(function () {
  'use strict';

  const root = document.getElementById('workspace-root');
  const THEME_KEY = 'bonds_workspace_theme';
  const API_PORTFOLIO = '/api/v3/ecc/portfolio';
  const API_NOTIFICATIONS = '/api/v3/ecc/notifications';

  const stageMeta = [
    { id: 'idea', label: 'Evidence', sub: 'Collect & Validate', icon: '▧' },
    { id: 'feasibility', label: 'Analysis', sub: 'Research & Assess', icon: '▤' },
    { id: 'risk', label: 'Risk', sub: 'Identify & Mitigate', icon: '◇' },
    { id: 'valuation', label: 'Valuation', sub: 'Model & Value', icon: '◔' },
    { id: 'readiness', label: 'Approval', sub: 'Committee Review', icon: '⌁' },
    { id: 'financing', label: 'Funding', sub: 'Close & Deploy', icon: '▰' }
  ];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  }

  function fmtNumber(value, decimals = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n);
  }

  function fmtMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${fmtNumber(n)}`;
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const diff = Math.max(0, Date.now() - t);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  async function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      if (window.BondsAuth && window.BondsAuth.getSession) {
        const { data } = await window.BondsAuth.getSession();
        const token = data?.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[WorkspacePreview] session unavailable', err);
    }
    return headers;
  }

  async function postJson(url, body) {
    const headers = await authHeaders();
    if (!headers.Authorization) return { __unauthenticated: true };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body || {}),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return { __unauthenticated: true };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function applyTheme(theme) {
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem(THEME_KEY, value);
  }

  function toggleTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }

  function renderSidebar() {
    const items = [
      ['Workspace','⌂','#'],
      ['Pipeline','▽','/v3/portfolio'],
      ['Projects','▦','/v3/portfolio'],
      ['Companies','▥','#'],
      ['Reports','▤','/reports/'],
      ['Market Intelligence','◉','/v3/city-intelligence.html'],
      ['Risk Center','△','/v3/project-readiness.html'],
      ['Contacts','♙','#'],
      ['Calendar','□','#'],
      ['Documents','▧','#'],
      ['Settings','⚙','#']
    ];
    return `
      <aside class="sidebar">
        <a class="brand" href="/" aria-label="Bonds Global home">
          <div class="brand-mark">◆</div>
          <div><strong>BONDS</strong><span>GLOBAL</span></div>
        </a>
        <nav class="nav">
          ${items.map((x,i)=>`<a class="nav-item ${i===0?'active':''}" href="${x[2]}"><span>${x[1]}</span><b>${x[0]}</b></a>`).join('')}
        </nav>
        <div class="ai-card">
          <div class="spark">✦</div><h3>AI Assistant</h3>
          <p>Project intelligence is provided by the existing Bonds engines.</p>
          <button type="button" disabled title="Will be connected in the next safe phase">Ask Bonds AI</button>
        </div>
        <div class="sidebar-user">
          <div class="avatar">BG</div>
          <div><strong>Bonds User</strong><span>Workspace Preview</span></div>
        </div>
      </aside>`;
  }

  function renderTopbar(unread) {
    return `
      <header class="topbar">
        <div class="title-block"><h1>Project Workspace</h1><p>End-to-End Investment Intelligence</p></div>
        <div class="search-wrap">
          <input id="workspace-search" placeholder="Search projects, sectors, cities…" autocomplete="off" />
          <span>⌕</span>
        </div>
        <div class="top-actions">
          <button class="icon-btn" type="button" title="${unread || 0} notifications">♢${unread ? `<sup>${unread}</sup>` : ''}</button>
          <button class="icon-btn" type="button" title="Language">EN</button>
          <button class="theme-btn" id="themeToggle" type="button" title="Switch theme"><span class="theme-dark">☾</span><span class="theme-light">☀</span></button>
          <button class="primary-btn" type="button" id="newProjectBtn">＋ New Project</button>
        </div>
      </header>`;
  }

  function renderKpis(summary, alerts) {
    const cards = [
      ['Active Projects', summary.totalProjects, `${summary.healthy || 0} healthy`, 'featured'],
      ['Total Capital', fmtMoney(summary.totalCapital), 'Across owned projects', ''],
      ['Avg. Readiness', `${fmtNumber(summary.averageReadiness,1)}%`, `${fmtNumber(summary.averageConfidence,1)}% avg. confidence`, ''],
      ['Total Revenue', fmtMoney(summary.totalRevenue), 'Portfolio reported revenue', ''],
      ['Watchlist', alerts.length, `${summary.atRisk || 0} at risk`, '']
    ];
    return `<section class="kpis">${cards.map((c,i)=>`
      <article class="kpi ${c[3]}">
        <div class="kpi-label">${c[0]}</div><div class="kpi-value">${c[1]}</div>
        <div class="${i===2?'trend up':'kpi-foot'}">${c[2]}</div>
        ${i===0?'<svg class="sparkline" viewBox="0 0 110 38"><polyline points="2,34 15,28 24,30 34,18 47,24 57,11 68,15 79,9 90,19 108,3"/></svg>':''}
      </article>`).join('')}</section>`;
  }

  function stageCount(stages, id) {
    if (!stages) return 0;
    if (id === 'risk') {
      return Number(stages.risk || stages.risk_assessment || 0);
    }
    if (id === 'readiness') {
      return Number(stages.readiness || stages.approval || stages.investment_committee || 0);
    }
    return Number(stages[id] || 0);
  }

  function renderLifecycle(stages) {
    const counts = stageMeta.map(s => stageCount(stages, s.id));
    const activeIndex = counts.findLastIndex ? counts.findLastIndex(x => x > 0) : counts.reduce((a,x,i)=>x>0?i:a,-1);
    return `
      <article class="panel lifecycle-panel">
        <div class="panel-head"><div><h2>Investment Lifecycle</h2><p>From Evidence to Execution</p></div></div>
        <div class="lifecycle">
          ${stageMeta.map((s,i)=>`
            <div class="life-stage ${i===activeIndex?'current':''} ${s.id==='financing'?'success':''}">
              <div class="node">${s.icon}</div><strong>${i+1}. ${s.label}</strong><span>${s.sub}</span>
              <b>${counts[i]}</b><small>Projects</small>
            </div>`).join('')}
        </div>
        <div class="conversion-row">
          <div><span>Average Readiness</span><b id="conv-readiness">—</b></div>
          <div><span>Average Confidence</span><b id="conv-confidence">—</b></div>
          <div><span>Healthy Projects</span><b id="conv-healthy">—</b></div>
          <div><span>Needs Attention</span><b id="conv-attention">—</b></div>
          <div><span>At Risk</span><b id="conv-risk">—</b></div>
        </div>
      </article>`;
  }

  function renderNotifications(notifications) {
    const rows = (notifications || []).slice(0,4);
    const palette = ['blue','gold','green','violet'];
    return `
      <article class="panel notifications">
        <div class="panel-head"><h2>Notifications</h2><button type="button">View all</button></div>
        ${rows.length ? rows.map((n,i)=>`
          <div class="notice">
            <i class="${palette[i%palette.length]}">${i===0?'▧':i===1?'◇':i===2?'◉':'□'}</i>
            <div><strong>${esc(n.title_en || n.title || n.message_en || n.message || 'Update')}</strong>
            <span>${esc(n.projectName || n.project_name || '')}</span></div>
            <time>${relativeTime(n.createdAt || n.created_at || n.timestamp)}</time>
          </div>`).join('') : '<div class="empty">No notifications.</div>'}
      </article>`;
  }

  function sectorEntries(sectors, projects) {
    const entries = Object.entries(sectors || {}).map(([name,count]) => ({name,count:Number(count)||0}));
    if (entries.length) return entries.sort((a,b)=>b.count-a.count).slice(0,6);
    const map = {};
    (projects || []).forEach(p => { const key=p.sector || 'Other'; map[key]=(map[key]||0)+1; });
    return Object.entries(map).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,6);
  }

  function renderSector(sectors, projects) {
    const entries = sectorEntries(sectors, projects);
    const total = entries.reduce((s,x)=>s+x.count,0) || 1;
    const colors = ['c1','c2','c3','c4','c5','c6'];
    return `
      <article class="panel sector-panel">
        <div class="panel-head"><h2>Pipeline by Sector</h2><button>Live portfolio</button></div>
        <div class="sector-content">
          <div class="donut"><span><b>${fmtNumber(total)}</b><small>Projects</small></span></div>
          <ul class="legend">
            ${entries.length ? entries.map((x,i)=>`<li><i class="${colors[i]}"></i><span>${esc(x.name)}</span><b>${Math.round(x.count/total*100)}%</b><em>${x.count}</em></li>`).join('') : '<li>No sector data</li>'}
          </ul>
        </div>
      </article>`;
  }

  function renderGeography(projects) {
    const countries = {};
    (projects || []).forEach(p => {
      const key = p.country || p.city || 'Unspecified';
      countries[key] = (countries[key] || 0) + 1;
    });
    const top = Object.entries(countries).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const total = (projects || []).length || 1;
    return `
      <article class="panel geo-panel">
        <div class="panel-head"><h2>Geographic Exposure</h2><button>Project locations</button></div>
        <div class="world-map"><svg viewBox="0 0 620 270"><path d="M46 78l42-26 65 8 31 21 41 2 29 30-34 18-28 2-25 32-24-11-10-28-34-6-25-21zm213-8 45-14 32 16 37-12 58 22 30 43-25 22-36-8-28 14-27-9-13-34-31-3-25-31zm184 58 31-15 35 12 22 33-14 32-35 15-30-22 4-29zM175 178l28 13 13 38-24 20-19-34z"/><circle cx="350" cy="107" r="7"/><circle cx="393" cy="121" r="5"/><circle cx="484" cy="161" r="6"/></svg></div>
        <div class="geo-stats">${top.length ? top.map(([name,count])=>`<div><span>${esc(name)}</span><b>${Math.round(count/total*100)}%</b><small>${count} projects</small></div>`).join('') : '<div><span>No location data</span><b>—</b><small>—</small></div>'}</div>
      </article>`;
  }

  function healthBadge(health) {
    const map = { healthy:['Healthy','green-b'], attention:['Needs Attention','gold-b'], at_risk:['At Risk','violet-b'] };
    return map[health] || ['Review','blue-b'];
  }

  function renderProjects(projects) {
    const rows = (projects || []).slice(0,4);
    return `
      <article class="panel recent">
        <div class="panel-head"><h2>Recent Projects</h2><button type="button">View all</button></div>
        ${rows.length ? rows.map((p,i)=>{
          const badge=healthBadge(p.health);
          return `<a class="project-row" href="/v3/project?id=${encodeURIComponent(p.id)}">
            <span class="thumb t${(i%4)+1}"></span>
            <div><strong>${esc(p.name || 'Untitled project')}</strong><small>${esc(p.sector || '')}${p.city ? ' • '+esc(p.city):''}</small></div>
            <em class="badge ${badge[1]}">${badge[0]}</em>
          </a>`;
        }).join('') : '<div class="empty">No projects yet.</div>'}
      </article>`;
  }

  function renderMarket(meta) {
    const generated = meta?.generatedAt ? new Date(meta.generatedAt).toLocaleString() : '—';
    return `
      <section class="market-pulse">
        <div><strong>Portfolio Pulse</strong><span>Existing ECC data only</span></div>
        <div><span>Aggregated</span><b>${fmtNumber(meta?.aggregatedCount)}</b></div>
        <div><span>Failed aggregation</span><b>${fmtNumber(meta?.failedCount)}</b></div>
        <div><span>Role</span><b>${esc(meta?.role || '—')}</b></div>
        <div><span>Updated</span><b>${esc(generated)}</b></div>
        <a class="market-link" href="/v3/portfolio">Open Existing Portfolio →</a>
      </section>`;
  }

  function renderApp(data, notifications) {
    const summary = data.summary || {};
    const projects = data.projects || [];
    const alerts = data.alerts || [];
    root.className = '';
    root.innerHTML = `
      <div class="app-shell">
        ${renderSidebar()}
        <main class="main">
          ${renderTopbar(notifications.unreadCount || 0)}
          ${renderKpis(summary, alerts)}
          <section class="dashboard-grid">
            ${renderLifecycle(data.stages || {})}
            ${renderNotifications(notifications.notifications || [])}
            ${renderSector(data.sectors || {}, projects)}
            ${renderGeography(projects)}
            ${renderProjects(projects)}
          </section>
          ${renderMarket(data.meta || {})}
          <div class="preview-note">SAFE PREVIEW · Uses existing read-only portfolio/notification endpoints · No database schema changes · No production route replacement.</div>
        </main>
      </div>`;

    const set = (id,value) => { const el=document.getElementById(id); if(el) el.textContent=value; };
    set('conv-readiness', `${fmtNumber(summary.averageReadiness,1)}%`);
    set('conv-confidence', `${fmtNumber(summary.averageConfidence,1)}%`);
    set('conv-healthy', fmtNumber(summary.healthy));
    set('conv-attention', fmtNumber(summary.attention));
    set('conv-risk', fmtNumber(summary.atRisk));

    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    document.getElementById('newProjectBtn')?.addEventListener('click', () => {
      // Deliberately route to the existing portfolio instead of creating data here.
      location.href = '/v3/portfolio';
    });

    const input = document.getElementById('workspace-search');
    input?.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      document.querySelectorAll('.project-row').forEach(row => {
        row.hidden = q && !row.textContent.toLowerCase().includes(q);
      });
    });
  }

  function renderUnauthenticated() {
    root.className = '';
    root.innerHTML = `
      <div class="gate">
        <div class="gate-card">
          <div class="gate-logo">◆ BONDS GLOBAL</div>
          <h1>Project Workspace Preview</h1>
          <p>This preview is connected to the existing ECC portfolio endpoint. Sign in first so no public or demo data is invented.</p>
          <a href="/calculators/auth/index.html?redirect=${encodeURIComponent(location.pathname)}">Sign in</a>
          <a class="secondary" href="/v3/portfolio">Open current portfolio</a>
        </div>
      </div>`;
  }

  function renderError(err) {
    root.className = '';
    root.innerHTML = `<div class="gate"><div class="gate-card"><h1>Workspace could not load</h1><p>${esc(err.message || err)}</p><button onclick="location.reload()">Try again</button><a class="secondary" href="/v3/portfolio">Open current portfolio</a></div></div>`;
  }

  async function init() {
    const saved = localStorage.getItem(THEME_KEY);
    const systemLight = matchMedia && matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(saved || (systemLight ? 'light' : 'dark'));

    try {
      const [portfolio, notifications] = await Promise.all([
        postJson(API_PORTFOLIO, {}),
        postJson(API_NOTIFICATIONS, { limit: 20 })
      ]);
      if (portfolio.__unauthenticated) return renderUnauthenticated();
      renderApp(portfolio, notifications.__unauthenticated ? { notifications: [], unreadCount: 0 } : notifications);
    } catch (err) {
      console.error('[WorkspacePreview]', err);
      renderError(err);
    }
  }

  init();
})();
