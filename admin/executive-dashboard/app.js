/**
 * Executive Dashboard App
 */
(function (root) {
  'use strict';

  const VIEWS = { OVERVIEW: 'overview', REVENUE: 'revenue', PROJECTS: 'projects' };
  const LS_MARGIN = 'bonds_exec_margin';
  const LS_FIXED = 'bonds_exec_fixed_costs';

  const state = {
    view: VIEWS.OVERVIEW,
    stats: null,
    role: null,
    user: null,
    settings: { margin: 0.65, fixedCosts: 0 },
    charts: {},
    realtime: false,
    refreshTimer: null
  };

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function fmtMoney(n) {
    if (n === undefined || n === null) return '—';
    return Number(n).toLocaleString('ar-SA') + ' ر.س';
  }

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('ar-SA') : '—';
  }

  function fmtDateTime(d) {
    return d ? new Date(d).toLocaleString('ar-SA') : '—';
  }

  function loadSettings() {
    try {
      const m = parseFloat(localStorage.getItem(LS_MARGIN));
      const f = parseFloat(localStorage.getItem(LS_FIXED));
      if (!isNaN(m) && m >= 0 && m <= 1) state.settings.margin = m;
      if (!isNaN(f) && f >= 0) state.settings.fixedCosts = f;
    } catch (e) {}
  }

  async function loadServerSettings() {
    try {
      const token = await BondsAdminCommon.getAdminToken();
      if (!token) return;
      const res = await fetch('/api/admin?action=settings', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return;
      const data = await res.json();
      const serverMargin = parseFloat(data.exec_dashboard_margin);
      const serverFixed = parseFloat(data.exec_dashboard_fixed_costs);
      if (!isNaN(serverMargin) && serverMargin >= 0 && serverMargin <= 1) {
        state.settings.margin = serverMargin;
      }
      if (!isNaN(serverFixed) && serverFixed >= 0) {
        state.settings.fixedCosts = serverFixed;
      }
      try {
        localStorage.setItem(LS_MARGIN, state.settings.margin);
        localStorage.setItem(LS_FIXED, state.settings.fixedCosts);
      } catch (e) {}
    } catch (e) {
      console.warn('[ExecutiveApp] failed to load server settings:', e);
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(LS_MARGIN, state.settings.margin);
      localStorage.setItem(LS_FIXED, state.settings.fixedCosts);
    } catch (e) {}
  }

  async function persistServerSettings() {
    persistSettings();
    try {
      const token = await BondsAdminCommon.getAdminToken();
      if (!token) return;
      const res = await fetch('/api/admin?action=settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          exec_dashboard_margin: state.settings.margin,
          exec_dashboard_fixed_costs: state.settings.fixedCosts
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      console.warn('[ExecutiveApp] failed to save server settings:', e);
      toast('تم الحفظ محلياً فقط — تعذر الاتصال بالسيرفر', 'info');
    }
  }

  function calcProfit(revenue) {
    return revenue * state.settings.margin - state.settings.fixedCosts;
  }

  function calcMonthlyProfit(monthRevenue) {
    return monthRevenue * state.settings.margin - (state.settings.fixedCosts / 12);
  }

  function calcCashFlow(monthRevenue) {
    return monthRevenue - (state.settings.fixedCosts / 12);
  }

  function toast(message, type) {
    type = type || 'info';
    const div = el('div', '', message);
    div.style.cssText = 'position:fixed;top:1rem;left:1rem;z-index:9999;padding:0.75rem 1.25rem;border-radius:10px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.3);';
    const colors = {
      success: 'background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);',
      error: 'background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);',
      info: 'background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);'
    };
    div.style.cssText += colors[type];
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  }

  async function guard() {
    try {
      const { role, user } = await ExecutiveService.ensureAccess();
      state.role = role;
      state.user = user;
      $('#ex-user').textContent = `${user.email} (${role === 'owner' ? 'مالك' : role === 'admin' ? 'مدير' : 'مشرف'})`;
      return true;
    } catch (err) {
      $('#ex-content').innerHTML = `
        <div class="ecc-empty">
          <div style="font-size:3rem;margin-bottom:1rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#DD2E44" d="M18 0C8.059 0 0 8.059 0 18s8.059 18 18 18 18-8.059 18-18S27.941 0 18 0zm13 18c0 2.565-.753 4.95-2.035 6.965L11.036 7.036C13.05 5.753 15.435 5 18 5c7.18 0 13 5.821 13 13zM5 18c0-2.565.753-4.95 2.036-6.964l17.929 17.929C22.95 30.247 20.565 31 18 31c-7.179 0-13-5.82-13-13z"/></svg></div>
          <h2>لا توجد صلاحية وصول</h2>
          <p>${err.message}</p>
          <a href="/calculators/auth/index.html" class="ecc-btn ecc-btn--primary" style="margin-top:1rem;">تسجيل الدخول</a>
        </div>`;
      return false;
    }
  }

  function setActiveNav(view) {
    $$('.ex-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  }

  async function showView(view) {
    if (!(await guard())) return;
    state.view = view;
    setActiveNav(view);
    $('#ex-content').innerHTML = '<div class="ecc-empty"><div class="loading__spinner"></div><p>جارِ تحميل المؤشرات...</p></div>';
    try {
      if (!state.stats) state.stats = await ExecutiveService.getStats();
      updateLastUpdate();
      switch (view) {
        case VIEWS.OVERVIEW: renderOverview(); break;
        case VIEWS.REVENUE: renderRevenue(); break;
        case VIEWS.PROJECTS: renderProjects(); break;
        default: renderOverview();
      }
    } catch (err) {
      console.error(err);
      $('#ex-content').innerHTML = `<div class="ecc-empty"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#DD2E44" d="M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z"/></svg> حدث خطأ: ${err.message}</div>`;
    }
  }

  function updateLastUpdate() {
    $('#ex-last-update').textContent = 'آخر تحديث: ' + fmtDateTime(new Date());
  }

  function renderErrors() {
    if (!state.stats?.errors?.length) return '';
    return `
      <div class="ecc-alert ecc-alert--warning">
        <strong><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> بعض البيانات غير متوفرة:</strong>
        <ul>${state.stats.errors.map(e => `<li><strong>${e.key}:</strong> ${e.message}</li>`).join('')}</ul>
      </div>
    `;
  }

  function kpiCard(icon, label, value, sub) {
    return `
      <div class="ecc-metric">
        <div style="font-size:1.5rem;margin-bottom:0.25rem;">${icon}</div>
        <div class="ecc-metric__value">${value}</div>
        <div class="ecc-metric__label">${label}</div>
        ${sub ? `<div class="ecc-metric__status">${sub}</div>` : ''}
      </div>
    `;
  }

  function destroyCharts() {
    Object.values(state.charts).forEach(c => { try { c.destroy(); } catch (e) {} });
    state.charts = {};
  }

  function chartConfig(type, labels, datasets, options = {}) {
    return {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e8ecf4', font: { family: 'Vazirmatn' } } }
        },
        scales: type !== 'doughnut' ? {
          x: { ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } }, grid: { color: 'rgba(197,160,40,0.05)' } },
          y: { ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } }, grid: { color: 'rgba(197,160,40,0.05)' } }
        } : {},
        ...options
      }
    };
  }

  function renderOverview() {
    destroyCharts();
    const s = state.stats;
    const totalProfit = calcProfit(s.totalRevenue);
    const netCashFlow = calcCashFlow(s.mrr);

    $('#ex-content').innerHTML = `
      ${renderErrors()}
      <div class="ecc-grid-auto">
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#FDD888\" d=\"M31.898 23.938C31.3 17.32 28 14 28 14l-6-8h-8l-6 8s-1.419 1.433-2.567 4.275C3.444 18.935 2 20.789 2 23c0 1.448.625 2.742 1.609 3.655C3.233 27.357 3 28.147 3 29c0 1.958 1.136 3.636 2.775 4.456C7.058 35.378 8.772 36 10 36h16c1.379 0 3.373-.779 4.678-3.31C32.609 31.999 34 30.17 34 28c0-1.678-.834-3.154-2.102-4.062zM18 6c.55 0 1.058-.158 1.5-.416.443.258.951.416 1.5.416 1.657 0 4-2.344 4-4 0 0 0-2-2-2-.788 0-1 1-2 1s-1-1-3-1-2 1-3 1-1.211-1-2-1c-2 0-2 2-2 2 0 1.656 2.344 4 4 4 .549 0 1.057-.158 1.5-.416.443.258.951.416 1.5.416z\"/><path fill=\"#BF6952\" d=\"M24 6c0 .552-.447 1-1 1H13c-.552 0-1-.448-1-1s.448-1 1-1h10c.553 0 1 .448 1 1z\"/><path fill=\"#67757F\" d=\"M23.901 24.542c0-4.477-8.581-4.185-8.581-6.886 0-1.308 1.301-1.947 2.811-1.947 2.538 0 2.99 1.569 4.139 1.569.813 0 1.205-.493 1.205-1.046 0-1.284-2.024-2.256-3.965-2.592V12.4c0-.773-.65-1.4-1.454-1.4-.805 0-1.456.627-1.456 1.4v1.283c-2.116.463-3.937 1.875-3.937 4.176 0 4.299 8.579 4.125 8.579 7.145 0 1.047-1.178 2.093-3.111 2.093-2.901 0-3.867-1.889-5.045-1.889-.574 0-1.087.464-1.087 1.164 0 1.113 1.938 2.451 4.603 2.824l-.001.01v1.398c0 .772.652 1.4 1.456 1.4.804 0 1.455-.628 1.455-1.4v-1.398c0-.017-.008-.03-.009-.045 2.398-.43 4.398-1.932 4.398-4.619z\"/></svg>", 'إجمالي الإيرادات', fmtMoney(s.totalRevenue), 'اشتراكات نشطة')}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#CCD6DD\" d=\"M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z\"/><path fill=\"#E1E8ED\" d=\"M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z\"/><path fill=\"#DD2E44\" d=\"M4.998 33c-.32 0-.645-.076-.946-.239-.973-.523-1.336-1.736-.813-2.709l7-13c.299-.557.845-.939 1.47-1.031.626-.092 1.258.118 1.705.565l6.076 6.076 9.738-18.59c.512-.978 1.721-1.357 2.699-.843.979.512 1.356 1.721.844 2.7l-11 21c-.295.564-.841.953-1.47 1.05-.627.091-1.266-.113-1.716-.563l-6.1-6.099-5.724 10.631C6.4 32.619 5.71 33 4.998 33z\"/></svg>", 'صافي الربح المقدر', fmtMoney(totalProfit), `هامش ${Math.round(state.settings.margin * 100)}%`)}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#5C913B\" d=\"M2 11c-2 0-2 2-2 2v21s0 2 2 2h32c2 0 2-2 2-2V13s0-2-2-2H2z\"/><path fill=\"#A7D28B\" d=\"M2 6C0 6 0 8 0 8v20s0 2 2 2h32c2 0 2-2 2-2V8s0-2-2-2H2z\"/><circle fill=\"#77B255\" cx=\"25\" cy=\"18\" r=\"6.5\"/><path fill=\"#5C913B\" d=\"M33 28.5H3c-.827 0-1.5-.673-1.5-1.5V9c0-.827.673-1.5 1.5-1.5h30c.827 0 1.5.673 1.5 1.5v18c0 .827-.673 1.5-1.5 1.5zM3 8.5c-.275 0-.5.224-.5.5v18c0 .275.225.5.5.5h30c.275 0 .5-.225.5-.5V9c0-.276-.225-.5-.5-.5H3z\"/><path fill=\"#FFE8B6\" d=\"M14 6h8v24.062h-8z\"/><path fill=\"#FFAC33\" d=\"M14 30h8v6h-8z\"/><path fill=\"#5C913B\" d=\"M11.81 20.023c0-2.979-5.493-2.785-5.493-4.584 0-.871.833-1.296 1.799-1.296 1.625 0 1.914 1.044 2.65 1.044.521 0 .772-.328.772-.696 0-.856-1.296-1.502-2.539-1.726v-.825c0-.515-.417-.932-.932-.932s-.932.418-.932.932v.853c-1.354.31-2.521 1.25-2.521 2.781 0 2.862 5.493 2.746 5.493 4.758 0 .695-.754 1.391-1.992 1.391-1.857 0-2.476-1.257-3.229-1.257-.368 0-.696.309-.696.775 0 .741 1.24 1.631 2.947 1.881l-.001.004v.934c0 .514.418.932.933.932.514-.001.931-.419.931-.932v-.934c0-.01-.005-.019-.006-.028 1.535-.287 2.816-1.286 2.816-3.075z\"/></svg>", 'التدفق النقدي الصافي المقدر', fmtMoney(netCashFlow), 'شهرياً')}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#269\" d=\"M0 29c0 2.209 1.791 4 4 4h24c2.209 0 4-1.791 4-4V12c0-2.209-1.791-4-4-4h-9c-3.562 0-3-5-8.438-5H4C1.791 3 0 4.791 0 7v22z\"/><path fill=\"#55ACEE\" d=\"M30 10h-6.562C18 10 18.562 15 15 15H6c-2.209 0-4 1.791-4 4v10c0 .553-.448 1-1 1s-1-.447-1-1c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V14c0-2.209-1.791-4-4-4z\"/></svg>", 'المشاريع النشطة', s.activeProjectsCount.toLocaleString('ar-SA'), fmtMoney(s.activeProjectsValue))}
        ${kpiCard("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>", 'المشاريع المتعثرة', s.distressedProjectsCount.toLocaleString('ar-SA'), 'معلق / ملغى')}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><circle fill=\"#DD2E44\" cx=\"18\" cy=\"18\" r=\"18\"/><circle fill=\"#FFF\" cx=\"18\" cy=\"18\" r=\"13.5\"/><circle fill=\"#DD2E44\" cx=\"18\" cy=\"18\" r=\"10\"/><circle fill=\"#FFF\" cx=\"18\" cy=\"18\" r=\"6\"/><circle fill=\"#DD2E44\" cx=\"18\" cy=\"18\" r=\"3\"/><path opacity=\".2\" d=\"M18.24 18.282l13.144 11.754s-2.647 3.376-7.89 5.109L17.579 18.42l.661-.138z\"/><path fill=\"#FFAC33\" d=\"M18.294 19c-.255 0-.509-.097-.704-.292-.389-.389-.389-1.018 0-1.407l.563-.563c.389-.389 1.018-.389 1.408 0 .388.389.388 1.018 0 1.407l-.564.563c-.194.195-.448.292-.703.292z\"/><path fill=\"#55ACEE\" d=\"M24.016 6.981c-.403 2.079 0 4.691 0 4.691l7.054-7.388c.291-1.454-.528-3.932-1.718-4.238-1.19-.306-4.079.803-5.336 6.935zm5.003 5.003c-2.079.403-4.691 0-4.691 0l7.388-7.054c1.454-.291 3.932.528 4.238 1.718.306 1.19-.803 4.079-6.935 5.336z\"/><path fill=\"#3A87C2\" d=\"M32.798 4.485L21.176 17.587c-.362.362-1.673.882-2.51.046-.836-.836-.419-2.08-.057-2.443L31.815 3.501s.676-.635 1.159-.152-.176 1.136-.176 1.136z\"/></svg>", 'الفرص الاستثمارية', s.investmentOpportunitiesCount.toLocaleString('ar-SA'), fmtMoney(s.totalOpportunityValue))}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#55ACEE\" d=\"M29 20.729v-1.963c1-1.03 2.914-2.89 3.391-5.273.142.079.055.13.213.13.758 0 1.256-.983 1.256-2.197 0-1.194-.656-2.161-1.399-2.191.143-.516.212-1.206.212-2.092 0-2.956-2.549-6.505-8.253-6.505-5.068 0-8.244 3.549-8.244 6.505 0 .858.051 1.562.142 2.107-.697.105-1.247 1.033-1.247 2.175 0 1.214.614 2.197 1.373 2.197.157 0-.069-.051.072-.13.477 2.384 2.484 4.243 3.484 5.274v1.847c-4 .492-7 2.628-7 4.765v.81c0 .812.823.812 1.634.812h18.73c.813 0 1.636 0 1.636-.812v-.81c0-2.001-3-3.997-6-4.649z\"/><path fill=\"#269\" d=\"M17 28.729v-1.963c1-1.03 2.914-2.89 3.391-5.273.142.079.055.13.213.13.758 0 1.256-.983 1.256-2.197 0-1.194-.656-2.161-1.399-2.191.143-.516.212-1.206.212-2.092 0-2.956-2.549-6.505-8.253-6.505-5.069 0-8.244 3.549-8.244 6.505 0 .858.051 1.562.142 2.107-.697.105-1.247 1.033-1.247 2.175 0 1.214.614 2.197 1.373 2.197.157 0-.069-.051.072-.13C4.993 23.876 7 25.735 8 26.766v1.847c-4 .492-7 2.628-7 4.765v.811C1 35 1.823 35 2.634 35h18.73c.813 0 1.636 0 1.636-.812v-.811c0-2-3-3.996-6-4.648z\"/></svg>", 'العملاء', (s.totalAdvisoryClients + s.totalProfiles).toLocaleString('ar-SA'), `${s.totalProfiles} مستخدم + ${s.totalAdvisoryClients} عميل استشاري`)}
      </div>

      <div class="ecc-grid-2">
        <div class="ecc-card">
          <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#5C913B" d="M13 33H7V16c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v17z"/><path fill="#3B94D9" d="M29 33h-6V9c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v24z"/><path fill="#DD2E44" d="M21 33h-6V23c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v10z"/></svg> الإيرادات والأرباح (12 شهر)</div>
          <div class="ecc-chart"><canvas id="ex-revenue-chart"></canvas></div>
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#DD2E44" d="M4.998 33c-.32 0-.645-.076-.946-.239-.973-.523-1.336-1.736-.813-2.709l7-13c.299-.557.845-.939 1.47-1.031.626-.092 1.258.118 1.705.565l6.076 6.076 9.738-18.59c.512-.978 1.721-1.357 2.699-.843.979.512 1.356 1.721.844 2.7l-11 21c-.295.564-.841.953-1.47 1.05-.627.091-1.266-.113-1.716-.563l-6.1-6.099-5.724 10.631C6.4 32.619 5.71 33 4.998 33z"/></svg> نمو العملاء (12 شهر)</div>
          <div class="ecc-chart"><canvas id="ex-clients-chart"></canvas></div>
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#269" d="M0 29c0 2.209 1.791 4 4 4h24c2.209 0 4-1.791 4-4V12c0-2.209-1.791-4-4-4h-9c-3.562 0-3-5-8.438-5H4C1.791 3 0 4.791 0 7v22z"/><path fill="#55ACEE" d="M30 10h-6.562C18 10 18.562 15 15 15H6c-2.209 0-4 1.791-4 4v10c0 .553-.448 1-1 1s-1-.447-1-1c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V14c0-2.209-1.791-4-4-4z"/></svg> حالات المشاريع الاستشارية</div>
          <div class="ecc-chart ecc-chart--sm"><canvas id="ex-projects-chart"></canvas></div>
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#5C913B" d="M2 11c-2 0-2 2-2 2v21s0 2 2 2h32c2 0 2-2 2-2V13s0-2-2-2H2z"/><path fill="#A7D28B" d="M2 6C0 6 0 8 0 8v20s0 2 2 2h32c2 0 2-2 2-2V8s0-2-2-2H2z"/><circle fill="#77B255" cx="25" cy="18" r="6.5"/><path fill="#5C913B" d="M33 28.5H3c-.827 0-1.5-.673-1.5-1.5V9c0-.827.673-1.5 1.5-1.5h30c.827 0 1.5.673 1.5 1.5v18c0 .827-.673 1.5-1.5 1.5zM3 8.5c-.275 0-.5.224-.5.5v18c0 .275.225.5.5.5h30c.275 0 .5-.225.5-.5V9c0-.276-.225-.5-.5-.5H3z"/><path fill="#FFE8B6" d="M14 6h8v24.062h-8z"/><path fill="#FFAC33" d="M14 30h8v6h-8z"/><path fill="#5C913B" d="M11.81 20.023c0-2.979-5.493-2.785-5.493-4.584 0-.871.833-1.296 1.799-1.296 1.625 0 1.914 1.044 2.65 1.044.521 0 .772-.328.772-.696 0-.856-1.296-1.502-2.539-1.726v-.825c0-.515-.417-.932-.932-.932s-.932.418-.932.932v.853c-1.354.31-2.521 1.25-2.521 2.781 0 2.862 5.493 2.746 5.493 4.758 0 .695-.754 1.391-1.992 1.391-1.857 0-2.476-1.257-3.229-1.257-.368 0-.696.309-.696.775 0 .741 1.24 1.631 2.947 1.881l-.001.004v.934c0 .514.418.932.933.932.514-.001.931-.419.931-.932v-.934c0-.01-.005-.019-.006-.028 1.535-.287 2.816-1.286 2.816-3.075z"/></svg> التدفق النقدي الصافي المقدر (12 شهر)</div>
          <div class="ecc-chart"><canvas id="ex-cashflow-chart"></canvas></div>
        </div>
      </div>

      <div class="ecc-grid-2">
        <div class="ecc-card">
          <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle fill="#DD2E44" cx="18" cy="18" r="18"/><circle fill="#FFF" cx="18" cy="18" r="13.5"/><circle fill="#DD2E44" cx="18" cy="18" r="10"/><circle fill="#FFF" cx="18" cy="18" r="6"/><circle fill="#DD2E44" cx="18" cy="18" r="3"/><path opacity=".2" d="M18.24 18.282l13.144 11.754s-2.647 3.376-7.89 5.109L17.579 18.42l.661-.138z"/><path fill="#FFAC33" d="M18.294 19c-.255 0-.509-.097-.704-.292-.389-.389-.389-1.018 0-1.407l.563-.563c.389-.389 1.018-.389 1.408 0 .388.389.388 1.018 0 1.407l-.564.563c-.194.195-.448.292-.703.292z"/><path fill="#55ACEE" d="M24.016 6.981c-.403 2.079 0 4.691 0 4.691l7.054-7.388c.291-1.454-.528-3.932-1.718-4.238-1.19-.306-4.079.803-5.336 6.935zm5.003 5.003c-2.079.403-4.691 0-4.691 0l7.388-7.054c1.454-.291 3.932.528 4.238 1.718.306 1.19-.803 4.079-6.935 5.336z"/><path fill="#3A87C2" d="M32.798 4.485L21.176 17.587c-.362.362-1.673.882-2.51.046-.836-.836-.419-2.08-.057-2.443L31.815 3.501s.676-.635 1.159-.152-.176 1.136-.176 1.136z"/></svg> أبرز الفرص الاستثمارية</div>
          ${renderOpportunitiesTable(s.topOpportunities)}
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle fill="#99AAB5" cx="18" cy="18" r="18"/><circle fill="#E1E8ED" cx="18" cy="18" r="14"/><path fill="#66757F" d="M17 18c0 .553.448 1 1 1 .553 0 1-.447 1-1V7c0-.552-.447-1-1-1-.552 0-1 .448-1 1v11z"/><path fill="#66757F" d="M8 18c0 .552.447 1 1 1h9c.553 0 1-.448 1-1s-.447-1-1-1H9c-.553 0-1 .448-1 1z"/></svg> آخر الاشتراكات</div>
          ${renderSubscriptionsTable(s.recentSubscriptions)}
        </div>
      </div>
    `;

    drawRevenueChart('ex-revenue-chart');
    drawClientsChart('ex-clients-chart');
    drawProjectsChart('ex-projects-chart');
    drawCashFlowChart('ex-cashflow-chart');
  }

  function renderRevenue() {
    destroyCharts();
    const s = state.stats;
    const monthlyProfit = s.revenueByMonth.map(calcMonthlyProfit);
    const totalProfit = calcProfit(s.totalRevenue);
    const annualRevenue = s.revenueByMonth.reduce((a, b) => a + b, 0);
    const annualProfit = monthlyProfit.reduce((a, b) => a + b, 0);

    $('#ex-content').innerHTML = `
      ${renderErrors()}
      <div class="ecc-grid-auto">
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#FDD888\" d=\"M31.898 23.938C31.3 17.32 28 14 28 14l-6-8h-8l-6 8s-1.419 1.433-2.567 4.275C3.444 18.935 2 20.789 2 23c0 1.448.625 2.742 1.609 3.655C3.233 27.357 3 28.147 3 29c0 1.958 1.136 3.636 2.775 4.456C7.058 35.378 8.772 36 10 36h16c1.379 0 3.373-.779 4.678-3.31C32.609 31.999 34 30.17 34 28c0-1.678-.834-3.154-2.102-4.062zM18 6c.55 0 1.058-.158 1.5-.416.443.258.951.416 1.5.416 1.657 0 4-2.344 4-4 0 0 0-2-2-2-.788 0-1 1-2 1s-1-1-3-1-2 1-3 1-1.211-1-2-1c-2 0-2 2-2 2 0 1.656 2.344 4 4 4 .549 0 1.057-.158 1.5-.416.443.258.951.416 1.5.416z\"/><path fill=\"#BF6952\" d=\"M24 6c0 .552-.447 1-1 1H13c-.552 0-1-.448-1-1s.448-1 1-1h10c.553 0 1 .448 1 1z\"/><path fill=\"#67757F\" d=\"M23.901 24.542c0-4.477-8.581-4.185-8.581-6.886 0-1.308 1.301-1.947 2.811-1.947 2.538 0 2.99 1.569 4.139 1.569.813 0 1.205-.493 1.205-1.046 0-1.284-2.024-2.256-3.965-2.592V12.4c0-.773-.65-1.4-1.454-1.4-.805 0-1.456.627-1.456 1.4v1.283c-2.116.463-3.937 1.875-3.937 4.176 0 4.299 8.579 4.125 8.579 7.145 0 1.047-1.178 2.093-3.111 2.093-2.901 0-3.867-1.889-5.045-1.889-.574 0-1.087.464-1.087 1.164 0 1.113 1.938 2.451 4.603 2.824l-.001.01v1.398c0 .772.652 1.4 1.456 1.4.804 0 1.455-.628 1.455-1.4v-1.398c0-.017-.008-.03-.009-.045 2.398-.43 4.398-1.932 4.398-4.619z\"/></svg>", 'إجمالي الإيرادات المتكررة (MRR)', fmtMoney(s.mrr), 'شهرياً')}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#E0E7EC\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V9c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v23z\"/><path d=\"M23.657 19.12H17.87c-1.22 0-1.673-.791-1.673-1.56 0-.791.429-1.56 1.673-1.56h8.184c1.154 0 1.628 1.04 1.628 1.628 0 .452-.249.927-.52 1.492l-5.607 11.395c-.633 1.266-.882 1.717-1.899 1.717-1.244 0-1.877-.949-1.877-1.605 0-.271.068-.474.226-.791l5.652-10.716zM10.889 19h-.5c-1.085 0-1.538-.731-1.538-1.5 0-.792.565-1.5 1.538-1.5h2.015c.972 0 1.515.701 1.515 1.605V30.47c0 1.13-.558 1.763-1.53 1.763s-1.5-.633-1.5-1.763V19z\" fill=\"#66757F\"/><path fill=\"#DD2F45\" d=\"M34 0h-3.277c.172.295.277.634.277 1 0 1.104-.896 2-2 2s-2-.896-2-2c0-.366.105-.705.277-1H8.723C8.895.295 9 .634 9 1c0 1.104-.896 2-2 2s-2-.896-2-2c0-.366.105-.705.277-1H2C.896 0 0 .896 0 2v11h36V2c0-1.104-.896-2-2-2z\"/><path d=\"M13.182 4.604c0-.5.32-.78.75-.78.429 0 .749.28.749.78v5.017h1.779c.51 0 .73.38.72.72-.02.33-.28.659-.72.659h-2.498c-.49 0-.78-.319-.78-.819V4.604zm-6.91 0c0-.5.32-.78.75-.78s.75.28.75.78v3.488c0 .92.589 1.649 1.539 1.649.909 0 1.529-.769 1.529-1.649V4.604c0-.5.319-.78.749-.78s.75.28.75.78v3.568c0 1.679-1.38 2.949-3.028 2.949-1.669 0-3.039-1.25-3.039-2.949V4.604zM5.49 9.001c0 1.679-1.069 2.119-1.979 2.119-.689 0-1.839-.27-1.839-1.14 0-.269.23-.609.56-.609.4 0 .75.37 1.199.37.56 0 .56-.52.56-.84V4.604c0-.5.32-.78.749-.78.431 0 .75.28.75.78v4.397z\" fill=\"#F5F8FA\"/><path d=\"M32 10c0 .552.447 1 1 1s1-.448 1-1-.447-1-1-1-1 .448-1 1m0-3c0 .552.447 1 1 1s1-.448 1-1-.447-1-1-1-1 .448-1 1m-3 3c0 .552.447 1 1 1s1-.448 1-1-.447-1-1-1-1 .448-1 1m0-3c0 .552.447 1 1 1s1-.448 1-1-.447-1-1-1-1 .448-1 1m-3 3c0 .552.447 1 1 1s1-.448 1-1-.447-1-1-1-1 .448-1 1m0-3c0 .552.447 1 1 1s1-.448 1-1-.447-1-1-1-1 .448-1 1m-3 0c0 .552.447 1 1 1s1-.448 1-1-.447-1-1-1-1 .448-1 1m0 3c0 .552.447 1 1 1s1-.448 1-1-.447-1-1-1-1 .448-1 1\" fill=\"#F4ABBA\"/></svg>", 'إجمالي الإيرادات السنوية', fmtMoney(annualRevenue), '12 شهر')}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#CCD6DD\" d=\"M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z\"/><path fill=\"#E1E8ED\" d=\"M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z\"/><path fill=\"#DD2E44\" d=\"M4.998 33c-.32 0-.645-.076-.946-.239-.973-.523-1.336-1.736-.813-2.709l7-13c.299-.557.845-.939 1.47-1.031.626-.092 1.258.118 1.705.565l6.076 6.076 9.738-18.59c.512-.978 1.721-1.357 2.699-.843.979.512 1.356 1.721.844 2.7l-11 21c-.295.564-.841.953-1.47 1.05-.627.091-1.266-.113-1.716-.563l-6.1-6.099-5.724 10.631C6.4 32.619 5.71 33 4.998 33z\"/></svg>", 'صافي الربح السنوي المقدر', fmtMoney(annualProfit), `هامش ${Math.round(state.settings.margin * 100)}%`)}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#5C913B\" d=\"M2 11c-2 0-2 2-2 2v21s0 2 2 2h32c2 0 2-2 2-2V13s0-2-2-2H2z\"/><path fill=\"#A7D28B\" d=\"M2 6C0 6 0 8 0 8v20s0 2 2 2h32c2 0 2-2 2-2V8s0-2-2-2H2z\"/><circle fill=\"#77B255\" cx=\"25\" cy=\"18\" r=\"6.5\"/><path fill=\"#5C913B\" d=\"M33 28.5H3c-.827 0-1.5-.673-1.5-1.5V9c0-.827.673-1.5 1.5-1.5h30c.827 0 1.5.673 1.5 1.5v18c0 .827-.673 1.5-1.5 1.5zM3 8.5c-.275 0-.5.224-.5.5v18c0 .275.225.5.5.5h30c.275 0 .5-.225.5-.5V9c0-.276-.225-.5-.5-.5H3z\"/><path fill=\"#FFE8B6\" d=\"M14 6h8v24.062h-8z\"/><path fill=\"#FFAC33\" d=\"M14 30h8v6h-8z\"/><path fill=\"#5C913B\" d=\"M11.81 20.023c0-2.979-5.493-2.785-5.493-4.584 0-.871.833-1.296 1.799-1.296 1.625 0 1.914 1.044 2.65 1.044.521 0 .772-.328.772-.696 0-.856-1.296-1.502-2.539-1.726v-.825c0-.515-.417-.932-.932-.932s-.932.418-.932.932v.853c-1.354.31-2.521 1.25-2.521 2.781 0 2.862 5.493 2.746 5.493 4.758 0 .695-.754 1.391-1.992 1.391-1.857 0-2.476-1.257-3.229-1.257-.368 0-.696.309-.696.775 0 .741 1.24 1.631 2.947 1.881l-.001.004v.934c0 .514.418.932.933.932.514-.001.931-.419.931-.932v-.934c0-.01-.005-.019-.006-.028 1.535-.287 2.816-1.286 2.816-3.075z\"/></svg>", 'التدفق النقدي الصافي الشهري', fmtMoney(calcCashFlow(s.mrr)), 'بعد التكاليف')}
      </div>
      <div class="ecc-card">
        <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#5C913B" d="M13 33H7V16c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v17z"/><path fill="#3B94D9" d="M29 33h-6V9c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v24z"/><path fill="#DD2E44" d="M21 33h-6V23c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v10z"/></svg> تفصيل الإيرادات والأرباح شهراً بشهر</div>
        <div class="ecc-chart ecc-chart--tall"><canvas id="ex-revenue-detail-chart"></canvas></div>
      </div>
      <div class="ecc-card">
        <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle fill="#99AAB5" cx="18" cy="18" r="18"/><circle fill="#E1E8ED" cx="18" cy="18" r="14"/><path fill="#66757F" d="M17 18c0 .553.448 1 1 1 .553 0 1-.447 1-1V7c0-.552-.447-1-1-1-.552 0-1 .448-1 1v11z"/><path fill="#66757F" d="M8 18c0 .552.447 1 1 1h9c.553 0 1-.448 1-1s-.447-1-1-1H9c-.553 0-1 .448-1 1z"/></svg> آخر الاشتراكات</div>
        ${renderSubscriptionsTable(s.recentSubscriptions)}
      </div>
    `;

    const ctx = document.getElementById('ex-revenue-detail-chart').getContext('2d');
    state.charts.revenueDetail = new Chart(ctx, chartConfig('bar', s.monthLabels, [
      { label: 'الإيرادات', data: s.revenueByMonth, backgroundColor: 'rgba(212,168,83,0.7)', borderColor: '#d4a853', borderWidth: 1 },
      { label: 'الربح المقدر', data: monthlyProfit, backgroundColor: 'rgba(34,197,94,0.7)', borderColor: '#22c55e', borderWidth: 1 }
    ]));
  }

  function renderProjects() {
    destroyCharts();
    const s = state.stats;
    $('#ex-content').innerHTML = `
      ${renderErrors()}
      <div class="ecc-grid-auto">
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#269\" d=\"M0 29c0 2.209 1.791 4 4 4h24c2.209 0 4-1.791 4-4V12c0-2.209-1.791-4-4-4h-9c-3.562 0-3-5-8.438-5H4C1.791 3 0 4.791 0 7v22z\"/><path fill=\"#55ACEE\" d=\"M30 10h-6.562C18 10 18.562 15 15 15H6c-2.209 0-4 1.791-4 4v10c0 .553-.448 1-1 1s-1-.447-1-1c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V14c0-2.209-1.791-4-4-4z\"/></svg>", 'إجمالي المشاريع', s.projectCounts.total.toLocaleString('ar-SA'), '')}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg>", 'المشاريع النشطة', s.projectCounts.active.toLocaleString('ar-SA'), fmtMoney(s.activeProjectsValue))}
        ${kpiCard("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>", 'المشاريع المتعثرة', s.distressedProjectsCount.toLocaleString('ar-SA'), 'معلق / ملغى')}
        ${kpiCard("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><circle fill=\"#DD2E44\" cx=\"18\" cy=\"18\" r=\"18\"/><circle fill=\"#FFF\" cx=\"18\" cy=\"18\" r=\"13.5\"/><circle fill=\"#DD2E44\" cx=\"18\" cy=\"18\" r=\"10\"/><circle fill=\"#FFF\" cx=\"18\" cy=\"18\" r=\"6\"/><circle fill=\"#DD2E44\" cx=\"18\" cy=\"18\" r=\"3\"/><path opacity=\".2\" d=\"M18.24 18.282l13.144 11.754s-2.647 3.376-7.89 5.109L17.579 18.42l.661-.138z\"/><path fill=\"#FFAC33\" d=\"M18.294 19c-.255 0-.509-.097-.704-.292-.389-.389-.389-1.018 0-1.407l.563-.563c.389-.389 1.018-.389 1.408 0 .388.389.388 1.018 0 1.407l-.564.563c-.194.195-.448.292-.703.292z\"/><path fill=\"#55ACEE\" d=\"M24.016 6.981c-.403 2.079 0 4.691 0 4.691l7.054-7.388c.291-1.454-.528-3.932-1.718-4.238-1.19-.306-4.079.803-5.336 6.935zm5.003 5.003c-2.079.403-4.691 0-4.691 0l7.388-7.054c1.454-.291 3.932.528 4.238 1.718.306 1.19-.803 4.079-6.935 5.336z\"/><path fill=\"#3A87C2\" d=\"M32.798 4.485L21.176 17.587c-.362.362-1.673.882-2.51.046-.836-.836-.419-2.08-.057-2.443L31.815 3.501s.676-.635 1.159-.152-.176 1.136-.176 1.136z\"/></svg>", 'فرص الإنقاذ المتاحة', s.investmentOpportunitiesCount.toLocaleString('ar-SA'), fmtMoney(s.totalOpportunityValue))}
      </div>
      <div class="ecc-grid-2">
        <div class="ecc-card">
          <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#269" d="M0 29c0 2.209 1.791 4 4 4h24c2.209 0 4-1.791 4-4V12c0-2.209-1.791-4-4-4h-9c-3.562 0-3-5-8.438-5H4C1.791 3 0 4.791 0 7v22z"/><path fill="#55ACEE" d="M30 10h-6.562C18 10 18.562 15 15 15H6c-2.209 0-4 1.791-4 4v10c0 .553-.448 1-1 1s-1-.447-1-1c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V14c0-2.209-1.791-4-4-4z"/></svg> توزيع حالات المشاريع</div>
          <div class="ecc-chart ecc-chart--sm"><canvas id="ex-projects-detail-chart"></canvas></div>
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle fill="#DD2E44" cx="18" cy="18" r="18"/><circle fill="#FFF" cx="18" cy="18" r="13.5"/><circle fill="#DD2E44" cx="18" cy="18" r="10"/><circle fill="#FFF" cx="18" cy="18" r="6"/><circle fill="#DD2E44" cx="18" cy="18" r="3"/><path opacity=".2" d="M18.24 18.282l13.144 11.754s-2.647 3.376-7.89 5.109L17.579 18.42l.661-.138z"/><path fill="#FFAC33" d="M18.294 19c-.255 0-.509-.097-.704-.292-.389-.389-.389-1.018 0-1.407l.563-.563c.389-.389 1.018-.389 1.408 0 .388.389.388 1.018 0 1.407l-.564.563c-.194.195-.448.292-.703.292z"/><path fill="#55ACEE" d="M24.016 6.981c-.403 2.079 0 4.691 0 4.691l7.054-7.388c.291-1.454-.528-3.932-1.718-4.238-1.19-.306-4.079.803-5.336 6.935zm5.003 5.003c-2.079.403-4.691 0-4.691 0l7.388-7.054c1.454-.291 3.932.528 4.238 1.718.306 1.19-.803 4.079-6.935 5.336z"/><path fill="#3A87C2" d="M32.798 4.485L21.176 17.587c-.362.362-1.673.882-2.51.046-.836-.836-.419-2.08-.057-2.443L31.815 3.501s.676-.635 1.159-.152-.176 1.136-.176 1.136z"/></svg> توزيع فرص الإنقاذ حسب القيمة</div>
          <div class="ecc-chart ecc-chart--sm"><canvas id="ex-opportunities-chart"></canvas></div>
        </div>
      </div>
      <div class="ecc-card">
        <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#269" d="M0 29c0 2.209 1.791 4 4 4h24c2.209 0 4-1.791 4-4V12c0-2.209-1.791-4-4-4h-9c-3.562 0-3-5-8.438-5H4C1.791 3 0 4.791 0 7v22z"/><path fill="#55ACEE" d="M30 10h-6.562C18 10 18.562 15 15 15H6c-2.209 0-4 1.791-4 4v10c0 .553-.448 1-1 1s-1-.447-1-1c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V14c0-2.209-1.791-4-4-4z"/></svg> أحدث المشاريع الاستشارية</div>
        ${renderProjectsTable(s.recentProjects)}
      </div>
      <div class="ecc-card">
        <div class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle fill="#DD2E44" cx="18" cy="18" r="18"/><circle fill="#FFF" cx="18" cy="18" r="13.5"/><circle fill="#DD2E44" cx="18" cy="18" r="10"/><circle fill="#FFF" cx="18" cy="18" r="6"/><circle fill="#DD2E44" cx="18" cy="18" r="3"/><path opacity=".2" d="M18.24 18.282l13.144 11.754s-2.647 3.376-7.89 5.109L17.579 18.42l.661-.138z"/><path fill="#FFAC33" d="M18.294 19c-.255 0-.509-.097-.704-.292-.389-.389-.389-1.018 0-1.407l.563-.563c.389-.389 1.018-.389 1.408 0 .388.389.388 1.018 0 1.407l-.564.563c-.194.195-.448.292-.703.292z"/><path fill="#55ACEE" d="M24.016 6.981c-.403 2.079 0 4.691 0 4.691l7.054-7.388c.291-1.454-.528-3.932-1.718-4.238-1.19-.306-4.079.803-5.336 6.935zm5.003 5.003c-2.079.403-4.691 0-4.691 0l7.388-7.054c1.454-.291 3.932.528 4.238 1.718.306 1.19-.803 4.079-6.935 5.336z"/><path fill="#3A87C2" d="M32.798 4.485L21.176 17.587c-.362.362-1.673.882-2.51.046-.836-.836-.419-2.08-.057-2.443L31.815 3.501s.676-.635 1.159-.152-.176 1.136-.176 1.136z"/></svg> أبرز فرص الإنقاذ</div>
        ${renderOpportunitiesTable(s.topOpportunities)}
      </div>
    `;

    drawProjectsChart('ex-projects-detail-chart');
    drawOpportunitiesChart('ex-opportunities-chart');
  }

  function drawRevenueChart(canvasId) {
    const s = state.stats;
    const profitData = s.revenueByMonth.map(calcMonthlyProfit);
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.revenue = new Chart(ctx, chartConfig('line', s.monthLabels, [
      { label: 'الإيرادات', data: s.revenueByMonth, borderColor: '#d4a853', backgroundColor: 'rgba(212,168,83,0.1)', fill: true, tension: 0.4 },
      { label: 'الربح المقدر', data: profitData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.05)', fill: true, tension: 0.4 }
    ]));
  }

  function drawClientsChart(canvasId) {
    const s = state.stats;
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.clients = new Chart(ctx, chartConfig('line', s.monthLabels, [
      { label: 'المستخدمون الجدد', data: s.clientsByMonth, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 }
    ]));
  }

  function drawProjectsChart(canvasId) {
    const p = state.stats.projectCounts;
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.projects = new Chart(ctx, chartConfig('doughnut', ['محتمل','نشط','معلق','مكتمل','ملغى'], [
      { data: [p.lead, p.active, p.on_hold, p.completed, p.cancelled], backgroundColor: ['#94a3b8','#22c55e','#f59e0b','#3b82f6','#ef4444'] }
    ], { plugins: { legend: { position: 'right' } } }));
  }

  function drawCashFlowChart(canvasId) {
    const s = state.stats;
    const cashFlowData = s.revenueByMonth.map(calcCashFlow);
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.cashflow = new Chart(ctx, chartConfig('bar', s.monthLabels, [
      { label: 'التدفق الصافي', data: cashFlowData, backgroundColor: cashFlowData.map(v => v >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)') }
    ]));
  }

  function drawOpportunitiesChart(canvasId) {
    const s = state.stats;
    const labels = s.topOpportunities.slice(0, 5).map(a => a.name || 'فرصة');
    const data = s.topOpportunities.slice(0, 5).map(a => Number(a.distressed_value) || 0);
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.opportunities = new Chart(ctx, chartConfig('pie', labels, [
      { data, backgroundColor: ['#d4a853','#3b82f6','#22c55e','#f59e0b','#ef4444'] }
    ], { plugins: { legend: { position: 'right' } } }));
  }

  function renderSubscriptionsTable(rows) {
    if (!rows.length) return '<div class="ecc-empty">لا توجد اشتراكات</div>';
    return `
      <div class="ecc-table-wrap">
        <table class="ecc-table">
          <thead><tr><th>الباقة</th><th>الحالة</th><th>القيمة</th><th>التاريخ</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.tier === 'enterprise' ? 'Enterprise' : r.tier === 'pro' ? 'Pro' : r.tier || '—'}</td>
                <td><span class="status-badge ${r.status === 'active' ? 'status-badge--healthy' : r.status === 'canceled' ? 'status-badge--at-risk' : 'status-badge--neutral'}">${r.status === 'active' ? 'نشط' : r.status === 'canceled' ? 'ملغى' : r.status}</span></td>
                <td>${fmtMoney(ExecutiveService.TIER_PRICE[r.tier] || 0)}</td>
                <td>${fmtDate(r.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderProjectsTable(rows) {
    if (!rows.length) return '<div class="ecc-empty">لا توجد مشاريع</div>';
    const statusLabels = { lead: 'محتمل', active: 'نشط', on_hold: 'معلق', completed: 'مكتمل', cancelled: 'ملغى' };
    const statusClasses = { lead: 'status-badge--neutral', active: 'status-badge--healthy', on_hold: 'status-badge--attention', completed: 'status-badge--healthy', cancelled: 'status-badge--at-risk' };
    return `
      <div class="ecc-table-wrap">
        <table class="ecc-table">
          <thead><tr><th>المشروع</th><th>العميل</th><th>الحالة</th><th>الميزانية</th><th>تاريخ البدء</th></tr></thead>
          <tbody>
            ${rows.map(p => `
              <tr>
                <td>${p.name || '—'}</td>
                <td>${p.advisory_clients?.name || '—'}</td>
                <td><span class="status-badge ${statusClasses[p.status] || 'status-badge--neutral'}">${statusLabels[p.status] || p.status}</span></td>
                <td>${fmtMoney(p.budget)}</td>
                <td>${fmtDate(p.start_date)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderOpportunitiesTable(rows) {
    if (!rows.length) return '<div class="ecc-empty">لا توجد فرص</div>';
    const catLabels = { real_estate: 'عقار', equipment: 'معدات', vehicle: 'مركبة', inventory: 'مخزون', receivable: 'ذمم مدينة', investment: 'استثمار', other: 'أخرى' };
    return `
      <div class="ecc-table-wrap">
        <table class="ecc-table">
          <thead><tr><th>الأصل</th><th>الفئة</th><th>القيمة الأصلية</th><th>القيمة المتعثرة</th></tr></thead>
          <tbody>
            ${rows.map(a => `
              <tr>
                <td>${a.name || '—'}</td>
                <td>${catLabels[a.category] || a.category || '—'}</td>
                <td>${fmtMoney(a.original_value)}</td>
                <td>${fmtMoney(a.distressed_value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function refresh() {
    state.stats = null;
    destroyCharts();
    await showView(state.view);
    toast('تم تحديث المؤشرات', 'success');
  }

  function openSettings() {
    closeModal();
    const overlay = el('div', 'ex-modal-overlay');
    overlay.id = 'ex-modal';
    overlay.innerHTML = `
      <div class="ex-modal">
        <div class="ex-modal-header">
          <h2>إعدادات لوحة المؤشرات</h2>
          <button class="ex-close" onclick="ExecutiveApp.closeModal()">&times;</button>
        </div>
        <form id="ex-settings-form" onsubmit="ExecutiveApp.saveSettings(event)">
          <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:0.75rem 1rem;margin-bottom:1rem;color:var(--text-secondary);font-size:0.8rem;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#3B88C3" d="M0 4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4z"/><path fill="#FFF" d="M20.512 8.071c0 1.395-1.115 2.573-2.511 2.573-1.333 0-2.511-1.209-2.511-2.573 0-1.271 1.178-2.45 2.511-2.45 1.333.001 2.511 1.148 2.511 2.45zm-4.744 6.728c0-1.488.931-2.481 2.232-2.481 1.302 0 2.232.992 2.232 2.481v11.906c0 1.488-.93 2.48-2.232 2.48s-2.232-.992-2.232-2.48V14.799z"/></svg> هذه الإعدادات تُحفظ في السيرفر وتُشارك بين جميع المشرفين. تُستخدم لحساب الأرباح والتدفقات النقدية التقديرية.
          </div>
          <div class="ex-form-group">
            <label>نسبة صافي الربح المقدرة (%)</label>
            <input class="ex-input" type="number" name="margin" min="0" max="100" step="1" value="${Math.round(state.settings.margin * 100)}" required />
            <small>تُستخدم لحساب الأرباح والتدفقات النقدية من الإيرادات.</small>
          </div>
          <div class="ex-form-group">
            <label>التكاليف الثابتة الشهرية (ر.س)</label>
            <input class="ex-input" type="number" name="fixedCosts" min="0" step="1" value="${state.settings.fixedCosts}" required />
            <small>تُخصم من الإيرادات الشهرية لحساب الربح والتدفق النقدي.</small>
          </div>
          <div class="ex-modal-actions">
            <button type="button" class="ecc-btn ecc-btn--ghost" onclick="ExecutiveApp.closeModal()">إلغاء</button>
            <button type="submit" class="ecc-btn ecc-btn--primary">حفظ</button>
          </div>
        </form>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
  }

  async function saveSettings(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.settings.margin = Math.max(0, Math.min(100, parseFloat(fd.get('margin')) || 0)) / 100;
    state.settings.fixedCosts = Math.max(0, parseFloat(fd.get('fixedCosts')) || 0);
    await persistServerSettings();
    closeModal();
    refresh();
  }

  function closeModal() {
    const m = $('#ex-modal');
    if (m) m.remove();
  }

  function initRealtime() {
    try {
      const sb = (typeof getSupabase === 'function') ? getSupabase() : window.supabaseClient;
      if (!sb || !sb.channel) return;
      const channel = sb.channel('executive-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => debouncedRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => debouncedRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'advisory_projects' }, () => debouncedRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'advisory_clients' }, () => debouncedRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recovery_assets' }, () => debouncedRefresh())
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            state.realtime = true;
            $('#ex-live').classList.add('active');
          }
        });
    } catch (e) {
      console.warn('[ExecutiveApp] realtime init failed:', e.message);
    }
  }

  let debounceTimer = null;
  function debouncedRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.stats = null;
      showView(state.view);
    }, 800);
  }

  function initPolling() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
      state.stats = null;
      showView(state.view);
    }, 60000);
  }

  window.addEventListener('beforeunload', () => {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  async function init() {
    loadSettings();
    await loadServerSettings();
    const exNav = document.querySelector('.ex-nav');
    if (exNav) {
      exNav.addEventListener('click', e => {
        const a = e.target.closest('.ex-nav a');
        if (!a) return;
        e.preventDefault();
        const view = a.dataset.view;
        if (view) showView(view);
      });
    }
    // Refresh when parent dashboard sends session token.
    window.addEventListener('admin-session-ready', () => {
      state.role = null;
      showView(VIEWS.OVERVIEW);
    });
    // When loaded inside the unified admin iframe, wait for the parent token
    // bridge before hitting Supabase auth (avoids iframe storage issues).
    const inIframe = window.parent !== window;
    const hasBridge = !!window.__ADMIN_TOKEN || !!window.__ADMIN_SESSION;
    if (inIframe && !hasBridge) {
      let started = false;
      const start = () => {
        if (started) return;
        started = true;
        showView(VIEWS.OVERVIEW);
        initRealtime();
        initPolling();
      };
      window.addEventListener('admin-token-ready', start, { once: true });
      window.addEventListener('admin-session-ready', start, { once: true });
      setTimeout(start, 2500);
    } else {
      showView(VIEWS.OVERVIEW);
      initRealtime();
      initPolling();
    }
  }

  root.ExecutiveApp = {
    init, showView, refresh, openSettings, saveSettings, closeModal
  };
})(window);

document.addEventListener('DOMContentLoaded', window.ExecutiveApp.init);
