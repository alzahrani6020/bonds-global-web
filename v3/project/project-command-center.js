/**
 * BONDS Project Command Center — Phase E.0
 *
 * Loads project status from /api/v3/ecc/project-status and renders the ECC UI.
 */

(function () {
  const root = document.getElementById('ecc-root');
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

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
    return Number(num).toLocaleString('ar-SA');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('ar-SA');
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
    if (health === 'healthy') return 'ممتازة';
    if (health === 'attention') return 'تحتاج اهتمام';
    return 'مرتفعة المخاطر';
  }

  function riskLabel(level) {
    return { low: 'منخفض', medium: 'متوسط', high: 'مرتفع', critical: 'حرج' }[level] || level;
  }

  function showError(message) {
    root.innerHTML = `<div class="error"><h2>⚠️ خطأ</h2><p>${message}</p></div>`;
  }

  function renderHealthCards(health) {
    return `
      <div class="health-cards">
        <div class="health-card">
          <div class="health-card__value">${health.readinessScore || 0}</div>
          <div class="health-card__label">جاهزية الاستثمار</div>
          ${health.readinessGrade ? `<span class="health-card__status ${healthStatusClass(health.projectHealth)}">الدرجة ${health.readinessGrade}</span>` : ''}
        </div>
        <div class="health-card">
          <div class="health-card__value">${health.confidence || 0}%</div>
          <div class="health-card__label">الثقة الإجمالية</div>
          <span class="health-card__status ${healthStatusClass(health.projectHealth)}">${healthStatusLabel(health.projectHealth)}</span>
        </div>
        <div class="health-card">
          <div class="health-card__value">${riskLabel(health.riskLevel)}</div>
          <div class="health-card__label">مستوى المخاطر</div>
        </div>
        <div class="health-card">
          <div class="health-card__value">${health.completionPercentage || 0}%</div>
          <div class="health-card__label">نسبة الإكمال</div>
        </div>
        <div class="health-card">
          <div class="health-card__value">${health.fundingScore || 0}</div>
          <div class="health-card__label">درجة التمويل</div>
        </div>
        <div class="health-card">
          <div class="health-card__value">${health.valuationStatus?.label || 'غير متوفر'}</div>
          <div class="health-card__label">حالة التقييم</div>
        </div>
      </div>
    `;
  }

  function renderMissionControl(mission) {
    const action = mission.nextBestAction || {};
    const alerts = mission.criticalAlerts || [];

    return `
      <div class="ecc-card mission-control">
        <div class="ecc-card__title">مركز المهمة</div>
        <div class="mission-item priority-${action.priority || 'medium'}">
          <div class="mission-item__icon">🎯</div>
          <div>
            <div class="mission-item__title">${action.action_ar || action.action || 'لا يوجد إجراء محدد'}</div>
            <div class="mission-item__desc">${action.reason_ar || action.reason || ''}</div>
          </div>
        </div>
        ${alerts.length ? '<div style="margin-top:1rem;"><strong style="font-size:0.85rem;color:#f0c96a;">تنبيهات حرجة</strong></div>' : ''}
        ${alerts.slice(0, 3).map(a => `
          <div class="mission-item priority-${a.priority || 'medium'}">
            <div class="mission-item__icon">⚠️</div>
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
        <div class="ecc-card__title">مقصورة القرار</div>
        ${pending.length ? pending.map(a => `
          <div class="mission-item priority-high">
            <div class="mission-item__icon">⏳</div>
            <div>
              <div class="mission-item__title">موافقة معلقة</div>
              <div class="mission-item__desc">الانتقال ${a.transition_id || a.stage_id} في انتظار القرار.</div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-secondary);font-size:0.85rem;">لا توجد قرارات معلقة.</p>'}
        ${recentDecisions.length ? '<div style="margin-top:1rem;"><strong style="font-size:0.85rem;color:var(--text-secondary);">آخر القرارات</strong></div>' : ''}
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
          <div class="ecc-card__title">خط الزمن</div>
          <p style="color:var(--text-secondary);font-size:0.85rem;">لا توجد أحداث مسجلة بعد.</p>
        </div>
      `;
    }

    return `
      <div class="ecc-card timeline-section">
        <div class="ecc-card__title">خط الزمن الموحد</div>
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

  function renderAlerts(mission) {
    const alerts = mission.criticalAlerts || [];
    return `
      <div class="ecc-card alerts-section">
        <div class="ecc-card__title">الإنذارات الذكية</div>
        ${alerts.length ? alerts.map(a => `
          <div class="alert">
            <div class="alert__icon">${a.type === 'blocked' ? '🚧' : a.type === 'readiness' ? '📉' : a.type === 'valuation' ? '💰' : a.type === 'financing' ? '⚡' : '🔍'}</div>
            <div>
              <div class="alert__title">${a.title}</div>
              <div class="alert__msg">${a.message}</div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-secondary);font-size:0.85rem;">لا توجد إنذارات حرجة.</p>'}
      </div>
    `;
  }

  function renderActionBar(project, lifecycle) {
    const currentStage = lifecycle?.currentStage || 'idea';
    const nextTransition = (lifecycle?.allowedTransitions || []).find(t => !t.optional);

    return `
      <div class="action-bar">
        ${nextTransition ? `<button class="ecc-btn ecc-btn--primary" onclick="ProjectCommandCenter.transition('${nextTransition.to}')">الانتقال إلى ${nextTransition.to}</button>` : ''}
        <button class="ecc-btn ecc-btn--secondary" onclick="ProjectCommandCenter.runReadiness()">تحديث جاهزية الاستثمار</button>
        <button class="ecc-btn ecc-btn--secondary" onclick="ProjectCommandCenter.generateMemorandum()">إنشاء مذكرة استثمارية</button>
        <button class="ecc-btn ecc-btn--secondary" onclick="ProjectCommandCenter.refresh()">↻ تحديث</button>
      </div>
    `;
  }

  function render(data) {
    const { project, health, lifecycle, mission, documents, financial, timeline, approvals } = data.status;

    root.innerHTML = `
      <div class="ecc-header">
        <div class="ecc-header__title">
          <h1>${project.name}</h1>
          <p>${project.sector}${project.activity ? ' · ' + project.activity : ''} · ${project.city || ''}</p>
        </div>
        <div class="ecc-header__stage">${lifecycle?.currentStage || 'idea'}</div>
      </div>

      <div class="ecc-grid">
        ${renderHealthCards(health)}
        ${renderMissionControl(mission)}
        ${renderDecisionCockpit(approvals, timeline)}
        ${renderTimeline(timeline)}
        ${renderAlerts(mission)}
        ${renderActionBar(project, lifecycle)}
      </div>
    `;

    // Expose instance id for action handlers
    if (lifecycle?.instanceId) {
      window.__ECC_INSTANCE_ID = lifecycle.instanceId;
    } else {
      delete window.__ECC_INSTANCE_ID;
    }

    // Mount AI Chief Advisor
    if (window.BondsAIChat && window.BondsAIChat.mount) {
      window.BondsAIChat.mount({ projectId, mode: 'project' });
    }
  }

  async function load() {
    if (!projectId) {
      showError('معرّف المشروع غير موجود في الرابط. أضف ?id=PROJECT_ID');
      return;
    }

    try {
      const res = await fetch('/api/v3/ecc/project-status', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ projectId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في تحميل الحالة');

      render(data);
    } catch (err) {
      console.error('[ProjectCommandCenter]', err);
      showError('تعذر تحميل بيانات المشروع: ' + err.message);
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
    transition: async (toStage) => {
      const instanceId = window.__ECC_INSTANCE_ID;
      if (!instanceId) {
        alert('لا يوجد دورة حياة نشطة لهذا المشروع.');
        return;
      }
      if (!confirm(`هل تريد الانتقال إلى المرحلة "${toStage}"؟`)) return;
      try {
        await apiCall(`/api/v3/enterprise-lifecycle/instances/${instanceId}/transition`, {
          body: { toStage, reason: 'Triggered from Project Command Center' }
        });
        load();
      } catch (err) {
        alert('فشل الانتقال: ' + err.message);
      }
    },
    runReadiness: async () => {
      try {
        await apiCall(`/api/v3/investment-intelligence/readiness/${projectId}`, { method: 'GET' });
        load();
      } catch (err) {
        alert('فشل تحديث الجاهزية: ' + err.message);
      }
    },
    generateMemorandum: async () => {
      try {
        await apiCall('/api/v3/investment-intelligence/memorandum', {
          body: { projectId, type: 'investment_memorandum' }
        });
        load();
      } catch (err) {
        alert('فشل إنشاء المذكرة: ' + err.message);
      }
    }
  };

  load();
})();
