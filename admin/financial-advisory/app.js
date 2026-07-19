/**
 * Financial Advisory Module — Admin SPA
 */

(function (root) {
  'use strict';

  const VIEWS = {
    DASHBOARD: 'dashboard',
    CLIENTS: 'clients',
    PROJECTS: 'projects',
    STUDIES: 'studies',
    MODELS: 'models',
    ACTIVITY: 'activity'
  };

  const STATUS_LABELS = {
    client: { active: 'نشط', inactive: 'غير نشط', archived: 'مؤرشف' },
    project: { lead: 'محتمل', active: 'نشط', on_hold: 'معلق', completed: 'مكتمل', cancelled: 'ملغى' },
    study: { draft: 'مسودة', review: 'تحت المراجعة', approved: 'معتمدة', rejected: 'مرفوضة' },
    model: { draft: 'مسودة', review: 'تحت المراجعة', approved: 'معتمد', archived: 'مؤرشف' }
  };

  const ACTION_LABELS = {
    client_created: 'إنشاء عميل',
    client_updated: 'تحديث عميل',
    client_deleted: 'حذف عميل',
    project_created: 'إنشاء مشروع',
    project_updated: 'تحديث مشروع',
    project_deleted: 'حذف مشروع',
    study_created: 'إنشاء دراسة جدوى',
    study_updated: 'تحديث دراسة جدوى',
    study_deleted: 'حذف دراسة جدوى',
    model_created: 'إنشاء نموذج مالي',
    model_updated: 'تحديث نموذج مالي',
    model_deleted: 'حذف نموذج مالي',
    document_uploaded: 'رفع مستند',
    document_deleted: 'حذف مستند',
    note_created: 'إضافة ملاحظة',
    note_updated: 'تحديث ملاحظة',
    note_deleted: 'حذف ملاحظة'
  };

  const state = {
    view: VIEWS.DASHBOARD,
    role: null,
    user: null,
    loading: false,
    clients: [],
    projects: []
  };

  function $(sel) { return document.querySelector(sel); }
  function $$ (sel) { return Array.from(document.querySelectorAll(sel)); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('ar-SA') : '—'; }
  function fmtDateTime(d) { return d ? new Date(d).toLocaleString('ar-SA') : '—'; }
  function fmtMoney(n) {
    if (n === undefined || n === null) return '—';
    return Number(n).toLocaleString('ar-SA') + ' ر.س';
  }
  const BADGE_CLASS = {
    active: 'status-badge--healthy',
    inactive: 'status-badge--neutral',
    archived: 'status-badge--neutral',
    lead: 'status-badge--attention',
    draft: 'status-badge--neutral',
    review: 'status-badge--attention',
    approved: 'status-badge--healthy',
    rejected: 'status-badge--at-risk',
    on_hold: 'status-badge--attention',
    completed: 'status-badge--healthy',
    cancelled: 'status-badge--at-risk'
  };

  function badge(status, type) {
    const label = STATUS_LABELS[type]?.[status] || status;
    return `<span class="status-badge ${BADGE_CLASS[status] || 'status-badge--neutral'}">${label}</span>`;
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
    if (state.role) return true;
    try {
      const { role, user } = await AdvisoryService.getUserRole();
      if (!role) {
        $('#fa-content').innerHTML = `
          <div class="fa-empty">
            <h2>لا توجد صلاحية وصول</h2>
            <p>يجب أن تكون مستشاراً أو مديراً للوصول إلى هذه الوحدة.</p>
            <a href="/calculators/auth/index.html" class="ecc-btn ecc-btn--primary" style="margin-top:1rem;">تسجيل الدخول</a>
          </div>`;
        return false;
      }
      state.role = role;
      state.user = user;
      $('#fa-user').textContent = `${user.email} (${role === 'manager' ? 'مدير' : role === 'advisor' ? 'مستشار' : 'مشاهد'})`;
      return true;
    } catch (err) {
      $('#fa-content').innerHTML = `
        <div class="fa-empty">

          <h2>يجب تسجيل الدخول</h2>
          <p>${err.message}</p>
          <a href="/calculators/auth/index.html?redirect=${encodeURIComponent(location.href)}" class="ecc-btn ecc-btn--primary" style="margin-top:1rem;">تسجيل الدخول</a>
        </div>`;
      return false;
    }
  }

  function setLoading(show) {
    state.loading = show;
    const main = $('#fa-content');
    if (show) main.classList.add('fa-loading');
    else main.classList.remove('fa-loading');
  }

  function setActiveNav(view) {
    $$('.fa-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  }

  async function showView(view) {
    if (!(await guard())) return;
    state.view = view;
    setActiveNav(view);
    const content = $('#fa-content');
    content.innerHTML = '<div class="fa-empty"><div class="fa-spinner"></div></div>';
    try {
      switch (view) {
        case VIEWS.DASHBOARD: await renderDashboard(); break;
        case VIEWS.CLIENTS: await renderClients(); break;
        case VIEWS.PROJECTS: await renderProjects(); break;
        case VIEWS.STUDIES: await renderStudies(); break;
        case VIEWS.MODELS: await renderModels(); break;
        case VIEWS.ACTIVITY: await renderActivity(); break;
      }
    } catch (err) {
      console.error(err);
      content.innerHTML = `<div class="fa-empty">حدث خطأ: ${err.message}</div>`;
    }
  }

  // ========== Dashboard ==========
  async function renderDashboard() {
    $('#fa-content').innerHTML = '<div class="fa-empty"><div class="fa-spinner"></div><p>جارِ تحميل لوحة الاستشارات...</p></div>';
    const stats = await AdvisoryService.getDashboardStats();
    const content = $('#fa-content');
    const errorsHtml = stats.errors?.length ? `
      <div class="ecc-alert ecc-alert--danger">
        <div>
          <div class="ecc-alert__title">تحذير: بعض البيانات لم تُحمل</div>
          <div class="ecc-alert__msg">
            <ul style="margin:0.5rem 0 0;padding-right:1.25rem;">
              ${stats.errors.map(e => `<li><strong>${e.key}:</strong> ${e.message}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    ` : '';
    content.innerHTML = `
      <div class="fa-header"><h1>لوحة الاستشارات المالية</h1></div>
      ${errorsHtml}
      <div class="ecc-grid-auto">
        <div class="ecc-metric"><div class="ecc-metric__value">${stats.counts.clients}</div><div class="ecc-metric__label">العملاء</div></div>
        <div class="ecc-metric"><div class="ecc-metric__value">${stats.counts.projects}</div><div class="ecc-metric__label">المشاريع</div></div>
        <div class="ecc-metric"><div class="ecc-metric__value">${stats.counts.studies}</div><div class="ecc-metric__label">دراسات الجدوى</div></div>
        <div class="ecc-metric"><div class="ecc-metric__value">${stats.counts.models}</div><div class="ecc-metric__label">النماذج المالية</div></div>
      </div>
      <div class="ecc-grid-auto">
        <div class="ecc-card">
          <div class="ecc-card__title">آخر النشاطات</div>
          ${renderActivityList(stats.recentActivity)}
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title">آخر العملاء</div>
          ${stats.recentClients.length ? `<div class="ecc-table-wrap"><table class="ecc-table"><tbody>${stats.recentClients.map(c => `<tr><td><a href="#" onclick="AdvisoryApp.openDetail('client','${c.id}');return false;">${c.name}</a></td><td>${badge(c.status,'client')}</td><td>${fmtDate(c.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="fa-empty">لا يوجد عملاء</div>'}
        </div>
        <div class="ecc-card fa-card--full">
          <div class="ecc-card__title">مشاريع نشطة</div>
          ${stats.activeProjects.length ? `<div class="ecc-table-wrap"><table class="ecc-table"><thead><tr><th>المشروع</th><th>العميل</th><th>الحالة</th><th>الميزانية</th></tr></thead><tbody>${stats.activeProjects.map(p => `<tr><td><a href="#" onclick="AdvisoryApp.openDetail('project','${p.id}');return false;">${p.name}</a></td><td>${p.advisory_clients?.name || '—'}</td><td>${badge(p.status,'project')}</td><td>${fmtMoney(p.budget)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="fa-empty">لا توجد مشاريع نشطة</div>'}
        </div>
      </div>
    `;
  }

  function renderActivityList(items) {
    if (!items.length) return '<div class="fa-empty">لا توجد نشاطات</div>';
    return items.map(item => `
      <div class="fa-activity-item">
        <div class="fa-activity-dot"></div>
        <div>
          <div>${ACTION_LABELS[item.action] || item.action}</div>
          <div class="fa-activity-meta">${item.actor_email || '—'} • ${fmtDateTime(item.created_at)}</div>
        </div>
      </div>
    `).join('');
  }

  // ========== Generic List View ==========
  function renderListView({ title, addLabel, onAdd, searchPlaceholder, tableHeaders, rowsHtml, onSearch, filtersHtml }) {
    return `
      <div class="fa-header">
        <h1>${title}</h1>
        ${state.role !== 'viewer' ? `<button class="ecc-btn ecc-btn--primary" onclick="${onAdd}">${addLabel}</button>` : ''}
      </div>
      <div class="fa-search">
        <input type="text" class="fa-input" id="fa-search-input" placeholder="${searchPlaceholder}" oninput="${onSearch}" />
        ${filtersHtml || ''}
      </div>
      <div class="ecc-card">
        <div class="ecc-table-wrap">
          <table class="ecc-table">
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="99"><div class="fa-empty">لا توجد بيانات</div></td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  }


  // ========== Clients ==========
  async function renderClients() {
    const search = $('#fa-search-input')?.value?.trim() || '';
    state.clients = await AdvisoryService.listClients({ search });
    const rows = state.clients.map(c => `
      <tr>
        <td><a href="#" onclick="AdvisoryApp.openDetail('client','${c.id}');return false;">${c.name}</a></td>
        <td>${c.company_name || '—'}</td>
        <td>${c.email || '—'}</td>
        <td>${c.country || '—'}</td>
        <td>${badge(c.status,'client')}</td>
        <td>${fmtDate(c.created_at)}</td>
        <td>
          ${state.role !== 'viewer' ? `<button class="ecc-btn ecc-btn--ghost ecc-btn--sm" onclick="AdvisoryApp.editClient('${c.id}')">تعديل</button>` : ''}
          ${state.role === 'manager' ? `<button class="ecc-btn ecc-btn--ghost ecc-btn--sm fa-btn--danger" onclick="AdvisoryApp.deleteClient('${c.id}')">حذف</button>` : ''}
        </td>
      </tr>
    `).join('');
    $('#fa-content').innerHTML = renderListView({
      title: 'إدارة العملاء',
      addLabel: 'عميل جديد',
      onAdd: 'AdvisoryApp.addClient()',
      searchPlaceholder: 'ابحث بالاسم أو البريد أو الشركة...',
      tableHeaders: '<th>الاسم</th><th>الشركة</th><th>البريد</th><th>الدولة</th><th>الحالة</th><th>تاريخ الإنشاء</th><th>إجراءات</th>',
      rowsHtml: rows,
      onSearch: 'AdvisoryApp.renderClients()'
    });
  }

  function clientForm(client) {
    const isEdit = !!client;
    return `
      <form id="fa-client-form" onsubmit="AdvisoryApp.saveClient(event,'${client?.id || ''}')">
        <div class="fa-form-grid">
          <div class="fa-form-group"><label>الاسم *</label><input class="fa-input" name="name" value="${esc(client?.name || '')}" required /></div>
          <div class="fa-form-group"><label>الشركة</label><input class="fa-input" name="company_name" value="${esc(client?.company_name || '')}" /></div>
          <div class="fa-form-group"><label>البريد الإلكتروني</label><input class="fa-input" type="email" name="email" value="${esc(client?.email || '')}" /></div>
          <div class="fa-form-group"><label>رقم الهاتف</label><input class="fa-input" name="phone" value="${esc(client?.phone || '')}" /></div>
          <div class="fa-form-group"><label>الدولة</label><input class="fa-input" name="country" value="${esc(client?.country || '')}" /></div>
          <div class="fa-form-group"><label>المدينة</label><input class="fa-input" name="city" value="${esc(client?.city || '')}" /></div>
          <div class="fa-form-group"><label>القطاع</label><input class="fa-input" name="sector" value="${esc(client?.sector || '')}" /></div>
          <div class="fa-form-group"><label>الرقم الضريبي</label><input class="fa-input" name="tax_number" value="${esc(client?.tax_number || '')}" /></div>
          <div class="fa-form-group ecc-form-group--full"><label>العنوان</label><input class="fa-input" name="address" value="${esc(client?.address || '')}" /></div>
          <div class="fa-form-group">
            <label>الحالة</label>
            <select class="fa-select" name="status">
              <option value="active" ${client?.status==='active'?'selected':''}>نشط</option>
              <option value="inactive" ${client?.status==='inactive'?'selected':''}>غير نشط</option>
              <option value="archived" ${client?.status==='archived'?'selected':''}>مؤرشف</option>
            </select>
          </div>
        </div>
        <div style="margin-top:1.5rem;display:flex;gap:0.75rem;justify-content:flex-end;">
          <button type="button" class="ecc-btn ecc-btn--ghost" onclick="AdvisoryApp.closeModal()">إلغاء</button>
          <button type="submit" class="ecc-btn ecc-btn--primary">حفظ</button>
        </div>
      </form>
    `;
  }

  async function addClient() { openModal('عميل جديد', clientForm()); }
  async function editClient(id) {
    const client = state.clients.find(c => c.id === id);
    if (!client) return toast('العميل غير موجود', 'error');
    openModal('تعديل العميل', clientForm(client));
  }
  async function saveClient(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {};
    fd.forEach((v, k) => payload[k] = v);
    try {
      if (id) await AdvisoryService.updateClient(id, payload);
      else await AdvisoryService.createClient(payload);
      closeModal();
      toast('تم حفظ العميل', 'success');
      renderClients();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function deleteClient(id) {
    if (!confirm('هل أنت متأكد من حذف هذا العميل وجميع بياناته؟')) return;
    try { await AdvisoryService.deleteClient(id); toast('تم الحذف', 'success'); renderClients(); }
    catch (err) { toast(err.message, 'error'); }
  }

  // ========== Projects ==========
  async function renderProjects() {
    const search = $('#fa-search-input')?.value?.trim() || '';
    const clientFilter = $('#fa-project-client')?.value || '';
    state.projects = await AdvisoryService.listProjects({ search, client_id: clientFilter || undefined });
    const rows = state.projects.map(p => `
      <tr>
        <td><a href="#" onclick="AdvisoryApp.openDetail('project','${p.id}');return false;">${p.name}</a></td>
        <td>${p.advisory_clients?.name || '—'}</td>
        <td>${badge(p.status,'project')}</td>
        <td>${fmtMoney(p.budget)}</td>
        <td>${fmtDate(p.start_date)}</td>
        <td>
          ${state.role !== 'viewer' ? `<button class="ecc-btn ecc-btn--ghost ecc-btn--sm" onclick="AdvisoryApp.editProject('${p.id}')">تعديل</button>` : ''}
          ${state.role === 'manager' ? `<button class="ecc-btn ecc-btn--ghost ecc-btn--sm fa-btn--danger" onclick="AdvisoryApp.deleteProject('${p.id}')">حذف</button>` : ''}
        </td>
      </tr>
    `).join('');
    const clientOptions = state.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    $('#fa-content').innerHTML = renderListView({
      title: 'إدارة المشاريع',
      addLabel: 'مشروع جديد',
      onAdd: 'AdvisoryApp.addProject()',
      searchPlaceholder: 'ابحث باسم المشروع...',
      tableHeaders: '<th>المشروع</th><th>العميل</th><th>الحالة</th><th>الميزانية</th><th>تاريخ البدء</th><th>إجراءات</th>',
      rowsHtml: rows,
      onSearch: 'AdvisoryApp.renderProjects()',
      filtersHtml: `<select class="fa-select fa-select--fixed" id="fa-project-client" onchange="AdvisoryApp.renderProjects()"><option value="">كل العملاء</option>${clientOptions}</select>`
    });
    if (clientFilter) $('#fa-project-client').value = clientFilter;
  }

  async function projectForm(project) {
    const clients = state.clients.length ? state.clients : await AdvisoryService.listClients({});
    const clientOptions = clients.map(c => `<option value="${c.id}" ${project?.client_id===c.id?'selected':''}>${c.name}</option>`).join('');
    return `
      <form id="fa-project-form" onsubmit="AdvisoryApp.saveProject(event,'${project?.id || ''}')">
        <div class="fa-form-grid">
          <div class="fa-form-group"><label>اسم المشروع *</label><input class="fa-input" name="name" value="${esc(project?.name || '')}" required /></div>
          <div class="fa-form-group"><label>العميل *</label><select class="fa-select" name="client_id" required>${clientOptions}</select></div>
          <div class="fa-form-group"><label>الحالة</label><select class="fa-select" name="status">
            <option value="lead" ${project?.status==='lead'?'selected':''}>محتمل</option>
            <option value="active" ${project?.status==='active'?'selected':''}>نشط</option>
            <option value="on_hold" ${project?.status==='on_hold'?'selected':''}>معلق</option>
            <option value="completed" ${project?.status==='completed'?'selected':''}>مكتمل</option>
            <option value="cancelled" ${project?.status==='cancelled'?'selected':''}>ملغى</option>
          </select></div>
          <div class="fa-form-group"><label>الميزانية</label><input class="fa-input" type="number" name="budget" value="${project?.budget || ''}" /></div>
          <div class="fa-form-group"><label>تاريخ البدء</label><input class="fa-input" type="date" name="start_date" value="${project?.start_date || ''}" /></div>
          <div class="fa-form-group"><label>تاريخ الانتهاء</label><input class="fa-input" type="date" name="end_date" value="${project?.end_date || ''}" /></div>
          <div class="fa-form-group ecc-form-group--full"><label>الوصف</label><textarea class="fa-textarea" name="description">${esc(project?.description || '')}</textarea></div>
        </div>
        <div style="margin-top:1.5rem;display:flex;gap:0.75rem;justify-content:flex-end;">
          <button type="button" class="ecc-btn ecc-btn--ghost" onclick="AdvisoryApp.closeModal()">إلغاء</button>
          <button type="submit" class="ecc-btn ecc-btn--primary">حفظ</button>
        </div>
      </form>
    `;
  }

  async function addProject() { openModal('مشروع جديد', await projectForm()); }
  async function editProject(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return toast('المشروع غير موجود', 'error');
    openModal('تعديل المشروع', await projectForm(project));
  }
  async function saveProject(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {};
    fd.forEach((v, k) => payload[k] = v);
    if (payload.budget) payload.budget = parseFloat(payload.budget);
    try {
      if (id) await AdvisoryService.updateProject(id, payload);
      else await AdvisoryService.createProject(payload);
      closeModal(); toast('تم حفظ المشروع', 'success'); renderProjects();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function deleteProject(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟')) return;
    try { await AdvisoryService.deleteProject(id); toast('تم الحذف', 'success'); renderProjects(); }
    catch (err) { toast(err.message, 'error'); }
  }


  // ========== Feasibility Studies ==========
  async function renderStudies() {
    const search = $('#fa-search-input')?.value?.trim() || '';
    const clientFilter = $('#fa-study-client')?.value || '';
    const studies = await AdvisoryService.listStudies({ search, client_id: clientFilter || undefined });
    const rows = studies.map(s => `
      <tr>
        <td><a href="#" onclick="AdvisoryApp.openDetail('study','${s.id}');return false;">${s.title}</a></td>
        <td>${s.advisory_clients?.name || '—'}</td>
        <td>${s.sector || '—'}</td>
        <td>${badge(s.status,'study')}</td>
        <td>${fmtDate(s.updated_at)}</td>
        <td>
          ${state.role !== 'viewer' ? `<button class="ecc-btn ecc-btn--ghost ecc-btn--sm" onclick="AdvisoryApp.editStudy('${s.id}')">تعديل</button>` : ''}
          ${state.role === 'manager' ? `<button class="ecc-btn ecc-btn--ghost ecc-btn--sm fa-btn--danger" onclick="AdvisoryApp.deleteStudy('${s.id}')">حذف</button>` : ''}
        </td>
      </tr>
    `).join('');
    const clientOptions = state.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    $('#fa-content').innerHTML = renderListView({
      title: 'إدارة دراسات الجدوى',
      addLabel: 'دراسة جديدة',
      onAdd: 'AdvisoryApp.addStudy()',
      searchPlaceholder: 'ابحث بعنوان الدراسة...',
      tableHeaders: '<th>العنوان</th><th>العميل</th><th>القطاع</th><th>الحالة</th><th>آخر تحديث</th><th>إجراءات</th>',
      rowsHtml: rows,
      onSearch: 'AdvisoryApp.renderStudies()',
      filtersHtml: `<select class="fa-select fa-select--fixed" id="fa-study-client" onchange="AdvisoryApp.renderStudies()"><option value="">كل العملاء</option>${clientOptions}</select>`
    });
    if (clientFilter) $('#fa-study-client').value = clientFilter;
  }

  async function studyForm(study) {
    const clients = state.clients.length ? state.clients : await AdvisoryService.listClients({});
    const clientProjects = study ? await AdvisoryService.listProjects({ client_id: study.client_id }) : [];
    const clientOptions = clients.map(c => `<option value="${c.id}" ${study?.client_id===c.id?'selected':''}>${c.name}</option>`).join('');
    const projectOptions = clientProjects.map(p => `<option value="${p.id}" ${study?.project_id===p.id?'selected':''}>${p.name}</option>`).join('');
    return `
      <form id="fa-study-form" onsubmit="AdvisoryApp.saveStudy(event,'${study?.id || ''}')">
        <div class="fa-form-grid">
          <div class="fa-form-group"><label>العنوان *</label><input class="fa-input" name="title" value="${esc(study?.title || '')}" required /></div>
          <div class="fa-form-group"><label>العميل *</label><select class="fa-select" name="client_id" required onchange="AdvisoryApp.refreshProjectOptions(this.value,'fa-study-project')">${clientOptions}</select></div>
          <div class="fa-form-group"><label>المشروع</label><select class="fa-select" name="project_id" id="fa-study-project"><option value="">بدون مشروع</option>${projectOptions}</select></div>
          <div class="fa-form-group"><label>القطاع</label><input class="fa-input" name="sector" value="${esc(study?.sector || '')}" /></div>
          <div class="fa-form-group"><label>الدولة</label><input class="fa-input" name="country" value="${esc(study?.country || '')}" /></div>
          <div class="fa-form-group"><label>الحالة</label><select class="fa-select" name="status">
            <option value="draft" ${study?.status==='draft'?'selected':''}>مسودة</option>
            <option value="review" ${study?.status==='review'?'selected':''}>تحت المراجعة</option>
            <option value="approved" ${study?.status==='approved'?'selected':''}>معتمدة</option>
            <option value="rejected" ${study?.status==='rejected'?'selected':''}>مرفوضة</option>
          </select></div>
          <div class="fa-form-group ecc-form-group--full"><label>الافتراضات (JSON)</label><textarea class="fa-textarea" name="assumptions_json" dir="ltr">${esc(JSON.stringify(study?.assumptions || {}, null, 2))}</textarea></div>
          <div class="fa-form-group ecc-form-group--full"><label>البيانات المالية (JSON)</label><textarea class="fa-textarea" name="financials_json" dir="ltr">${esc(JSON.stringify(study?.financials || {}, null, 2))}</textarea></div>
          <div class="fa-form-group ecc-form-group--full"><label>النتيجة (JSON)</label><textarea class="fa-textarea" name="result_json" dir="ltr">${esc(JSON.stringify(study?.result || {}, null, 2))}</textarea></div>
        </div>
        <div style="margin-top:1.5rem;display:flex;gap:0.75rem;justify-content:flex-end;">
          <button type="button" class="ecc-btn ecc-btn--ghost" onclick="AdvisoryApp.closeModal()">إلغاء</button>
          <button type="submit" class="ecc-btn ecc-btn--primary">حفظ</button>
        </div>
      </form>
    `;
  }

  async function addStudy() { openModal('دراسة جدوى جديدة', await studyForm()); }
  async function editStudy(id) {
    const study = await AdvisoryService.getStudy(id);
    openModal('تعديل دراسة الجدوى', await studyForm(study));
  }
  async function saveStudy(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {};
    fd.forEach((v, k) => { if (k !== 'assumptions_json' && k !== 'financials_json' && k !== 'result_json') payload[k] = v; });
    try {
      payload.assumptions = JSON.parse(fd.get('assumptions_json') || '{}');
      payload.financials = JSON.parse(fd.get('financials_json') || '{}');
      payload.result = JSON.parse(fd.get('result_json') || '{}');
    } catch (err) { return toast('JSON غير صالح: ' + err.message, 'error'); }
    if (payload.project_id === '') payload.project_id = null;
    try {
      if (id) await AdvisoryService.updateStudy(id, payload);
      else await AdvisoryService.createStudy(payload);
      closeModal(); toast('تم حفظ الدراسة', 'success'); renderStudies();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function deleteStudy(id) {
    if (!confirm('هل أنت متأكد من حذف الدراسة؟')) return;
    try { await AdvisoryService.deleteStudy(id); toast('تم الحذف', 'success'); renderStudies(); }
    catch (err) { toast(err.message, 'error'); }
  }

  // ========== Financial Models ==========
  async function renderModels() {
    const search = $('#fa-search-input')?.value?.trim() || '';
    const clientFilter = $('#fa-model-client')?.value || '';
    const models = await AdvisoryService.listModels({ search, client_id: clientFilter || undefined });
    const rows = models.map(m => `
      <tr>
        <td><a href="#" onclick="AdvisoryApp.openDetail('model','${m.id}');return false;">${m.name}</a></td>
        <td>${m.advisory_clients?.name || '—'}</td>
        <td>${m.model_type}</td>
        <td>${badge(m.status,'model')}</td>
        <td>${fmtDate(m.updated_at)}</td>
        <td>
          ${state.role !== 'viewer' ? `<button class="ecc-btn ecc-btn--ghost ecc-btn--sm" onclick="AdvisoryApp.editModel('${m.id}')">تعديل</button>` : ''}
          ${state.role === 'manager' ? `<button class="ecc-btn ecc-btn--ghost ecc-btn--sm fa-btn--danger" onclick="AdvisoryApp.deleteModel('${m.id}')">حذف</button>` : ''}
        </td>
      </tr>
    `).join('');
    const clientOptions = state.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    $('#fa-content').innerHTML = renderListView({
      title: 'إدارة النماذج المالية',
      addLabel: 'نموذج جديد',
      onAdd: 'AdvisoryApp.addModel()',
      searchPlaceholder: 'ابحث باسم النموذج...',
      tableHeaders: '<th>الاسم</th><th>العميل</th><th>النوع</th><th>الحالة</th><th>آخر تحديث</th><th>إجراءات</th>',
      rowsHtml: rows,
      onSearch: 'AdvisoryApp.renderModels()',
      filtersHtml: `<select class="fa-select fa-select--fixed" id="fa-model-client" onchange="AdvisoryApp.renderModels()"><option value="">كل العملاء</option>${clientOptions}</select>`
    });
    if (clientFilter) $('#fa-model-client').value = clientFilter;
  }

  async function modelForm(model) {
    const clients = state.clients.length ? state.clients : await AdvisoryService.listClients({});
    const clientProjects = model ? await AdvisoryService.listProjects({ client_id: model.client_id }) : [];
    const clientOptions = clients.map(c => `<option value="${c.id}" ${model?.client_id===c.id?'selected':''}>${c.name}</option>`).join('');
    const projectOptions = clientProjects.map(p => `<option value="${p.id}" ${model?.project_id===p.id?'selected':''}>${p.name}</option>`).join('');
    return `
      <form id="fa-model-form" onsubmit="AdvisoryApp.saveModel(event,'${model?.id || ''}')">
        <div class="fa-form-grid">
          <div class="fa-form-group"><label>اسم النموذج *</label><input class="fa-input" name="name" value="${esc(model?.name || '')}" required /></div>
          <div class="fa-form-group"><label>العميل *</label><select class="fa-select" name="client_id" required onchange="AdvisoryApp.refreshProjectOptions(this.value,'fa-model-project')">${clientOptions}</select></div>
          <div class="fa-form-group"><label>المشروع</label><select class="fa-select" name="project_id" id="fa-model-project"><option value="">بدون مشروع</option>${projectOptions}</select></div>
          <div class="fa-form-group"><label>نوع النموذج</label><select class="fa-select" name="model_type">
            <option value="valuation" ${model?.model_type==='valuation'?'selected':''}>تقييم</option>
            <option value="dcf" ${model?.model_type==='dcf'?'selected':''}>DCF</option>
            <option value="budget" ${model?.model_type==='budget'?'selected':''}>ميزانية</option>
            <option value="projection" ${model?.model_type==='projection'?'selected':''}>توقعات</option>
            <option value="custom" ${model?.model_type==='custom'?'selected':''}>مخصص</option>
          </select></div>
          <div class="fa-form-group"><label>الحالة</label><select class="fa-select" name="status">
            <option value="draft" ${model?.status==='draft'?'selected':''}>مسودة</option>
            <option value="review" ${model?.status==='review'?'selected':''}>تحت المراجعة</option>
            <option value="approved" ${model?.status==='approved'?'selected':''}>معتمد</option>
            <option value="archived" ${model?.status==='archived'?'selected':''}>مؤرشف</option>
          </select></div>
          <div class="fa-form-group ecc-form-group--full"><label>الافتراضات (JSON)</label><textarea class="fa-textarea" name="assumptions_json" dir="ltr">${esc(JSON.stringify(model?.assumptions || {}, null, 2))}</textarea></div>
          <div class="fa-form-group ecc-form-group--full"><label>التوقعات (JSON)</label><textarea class="fa-textarea" name="projections_json" dir="ltr">${esc(JSON.stringify(model?.projections || {}, null, 2))}</textarea></div>
        </div>
        <div style="margin-top:1.5rem;display:flex;gap:0.75rem;justify-content:flex-end;">
          <button type="button" class="ecc-btn ecc-btn--ghost" onclick="AdvisoryApp.closeModal()">إلغاء</button>
          <button type="submit" class="ecc-btn ecc-btn--primary">حفظ</button>
        </div>
      </form>
    `;
  }

  async function addModel() { openModal('نموذج مالي جديد', await modelForm()); }
  async function editModel(id) {
    const model = await AdvisoryService.getModel(id);
    openModal('تعديل النموذج المالي', await modelForm(model));
  }
  async function saveModel(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {};
    fd.forEach((v, k) => { if (k !== 'assumptions_json' && k !== 'projections_json') payload[k] = v; });
    try {
      payload.assumptions = JSON.parse(fd.get('assumptions_json') || '{}');
      payload.projections = JSON.parse(fd.get('projections_json') || '{}');
    } catch (err) { return toast('JSON غير صالح: ' + err.message, 'error'); }
    if (payload.project_id === '') payload.project_id = null;
    try {
      if (id) await AdvisoryService.updateModel(id, payload);
      else await AdvisoryService.createModel(payload);
      closeModal(); toast('تم حفظ النموذج', 'success'); renderModels();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function deleteModel(id) {
    if (!confirm('هل أنت متأكد من حذف النموذج؟')) return;
    try { await AdvisoryService.deleteModel(id); toast('تم الحذف', 'success'); renderModels(); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function refreshProjectOptions(clientId, selectId) {
    const projects = await AdvisoryService.listProjects({ client_id: clientId });
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">بدون مشروع</option>' + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }


  // ========== Detail Modal with Tabs ==========
  const ENTITY_NAMES = { client: 'عميل', project: 'مشروع', study: 'دراسة جدوى', model: 'نموذج مالي' };

  async function openDetail(type, id) {
    let entity;
    try {
      if (type === 'client') entity = await AdvisoryService.getClient(id);
      else if (type === 'project') entity = await AdvisoryService.getProject(id);
      else if (type === 'study') entity = await AdvisoryService.getStudy(id);
      else if (type === 'model') entity = await AdvisoryService.getModel(id);
    } catch (err) { return toast(err.message, 'error'); }

    const title = `${ENTITY_NAMES[type]}: ${entity.name || entity.title}`;
    const html = `
      <div class="ecc-tabs">
        <div class="ecc-tab active" data-tab="overview" onclick="AdvisoryApp.switchDetailTab(this,'overview')">نظرة عامة</div>
        <div class="ecc-tab" data-tab="documents" onclick="AdvisoryApp.switchDetailTab(this,'documents')">المستندات</div>
        <div class="ecc-tab" data-tab="notes" onclick="AdvisoryApp.switchDetailTab(this,'notes')">الملاحظات</div>
        <div class="ecc-tab" data-tab="activity" onclick="AdvisoryApp.switchDetailTab(this,'activity')">السجل الزمني</div>
      </div>
      <div id="fa-detail-content" data-type="${type}" data-id="${id}">
        ${renderOverview(type, entity)}
      </div>
    `;
    openModal(title, html, 'ecc-modal--wide');
  }

  function renderOverview(type, entity) {
    const fields = [];
    if (type === 'client') {
      fields.push(['الاسم', entity.name], ['الشركة', entity.company_name], ['البريد', entity.email], ['الهاتف', entity.phone], ['الدولة', entity.country], ['المدينة', entity.city], ['القطاع', entity.sector], ['العنوان', entity.address], ['الحالة', badge(entity.status, 'client')]);
    } else if (type === 'project') {
      fields.push(['الاسم', entity.name], ['العميل', entity.advisory_clients?.name], ['الحالة', badge(entity.status, 'project')], ['الميزانية', fmtMoney(entity.budget)], ['تاريخ البدء', fmtDate(entity.start_date)], ['تاريخ الانتهاء', fmtDate(entity.end_date)], ['الوصف', entity.description]);
    } else if (type === 'study') {
      fields.push(['العنوان', entity.title], ['العميل', entity.advisory_clients?.name], ['المشروع', entity.advisory_projects?.name], ['القطاع', entity.sector], ['الحالة', badge(entity.status, 'study')]);
    } else if (type === 'model') {
      fields.push(['الاسم', entity.name], ['العميل', entity.advisory_clients?.name], ['المشروع', entity.advisory_projects?.name], ['النوع', entity.model_type], ['الحالة', badge(entity.status, 'model')]);
    }
    return `
      <div class="fa-form-grid">
        ${fields.map(([k, v]) => `<div class="fa-form-group"><label>${k}</label><div class="fa-input" style="background:transparent;">${v || '—'}</div></div>`).join('')}
      </div>
      ${type === 'client' && entity.advisory_projects?.length ? `
        <div style="margin-top:1.5rem;"><strong style="color:var(--gold);">مشاريع العميل:</strong>
        <div class="ecc-table-wrap"><table class="ecc-table"><tbody>${entity.advisory_projects.map(p => `<tr><td><a href="#" onclick="AdvisoryApp.openDetail('project','${p.id}');return false;">${p.name}</a></td><td>${badge(p.status,'project')}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    `;
  }

  async function switchDetailTab(tabEl, tab) {
    $$('.ecc-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
    const container = $('#fa-detail-content');
    const type = container.dataset.type;
    const id = container.dataset.id;
    container.innerHTML = '<div class="fa-empty"><div class="fa-spinner"></div></div>';
    try {
      if (tab === 'overview') {
        let entity;
        if (type === 'client') entity = await AdvisoryService.getClient(id);
        else if (type === 'project') entity = await AdvisoryService.getProject(id);
        else if (type === 'study') entity = await AdvisoryService.getStudy(id);
        else if (type === 'model') entity = await AdvisoryService.getModel(id);
        container.innerHTML = renderOverview(type, entity);
      } else if (tab === 'documents') {
        container.innerHTML = await renderDocumentsSection(type, id);
      } else if (tab === 'notes') {
        container.innerHTML = await renderNotesSection(type, id);
      } else if (tab === 'activity') {
        container.innerHTML = await renderActivitySection(type, id);
      }
    } catch (err) { container.innerHTML = `<div class="fa-empty">${err.message}</div>`; }
  }

  // ========== Documents ==========
  async function renderDocumentsSection(entityType, entityId) {
    const docs = await AdvisoryService.listDocuments(entityType, entityId);
    const list = docs.length ? docs.map(d => `
      <div class="fa-file-item">
        <div>
          <div style="font-weight:700;">${d.file_name}</div>
          <div class="fa-activity-meta">${(d.file_size / 1024).toFixed(1)} KB • ${fmtDateTime(d.created_at)}</div>
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button class="ecc-btn ecc-btn--ghost ecc-btn--sm" onclick="AdvisoryApp.downloadDocument('${d.storage_path}')">تحميل</button>
          ${state.role !== 'viewer' ? `<button class="ecc-btn ecc-btn--ghost ecc-btn--sm fa-btn--danger" onclick="AdvisoryApp.deleteDocument('${d.id}')">حذف</button>` : ''}
        </div>
      </div>
    `).join('') : '<div class="fa-empty">لا توجد مستندات</div>';
    return `
      ${state.role !== 'viewer' ? `<div style="margin-bottom:1rem;"><input type="file" id="fa-doc-input" onchange="AdvisoryApp.handleFileUpload('${entityType}','${entityId}')" /></div>` : ''}
      ${list}
    `;
  }

  async function handleFileUpload(entityType, entityId) {
    const input = document.getElementById('fa-doc-input');
    if (!input.files?.length) return;
    try {
      await AdvisoryService.uploadDocument(entityType, entityId, input.files[0]);
      toast('تم رفع المستند', 'success');
      const container = $('#fa-detail-content');
      container.innerHTML = await renderDocumentsSection(container.dataset.type, container.dataset.id);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function downloadDocument(path) {
    try {
      const url = await AdvisoryService.getSignedUrl(path);
      window.open(url, '_blank');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteDocument(id) {
    if (!confirm('حذف المستند؟')) return;
    try {
      await AdvisoryService.deleteDocument(id);
      toast('تم الحذف', 'success');
      const container = $('#fa-detail-content');
      container.innerHTML = await renderDocumentsSection(container.dataset.type, container.dataset.id);
    } catch (err) { toast(err.message, 'error'); }
  }

  // ========== Notes ==========
  async function renderNotesSection(entityType, entityId) {
    const notes = await AdvisoryService.listNotes(entityType, entityId);
    const list = notes.length ? notes.map(n => `
      <div class="fa-activity-item" style="align-items:flex-start;">
        <div class="fa-activity-dot"></div>
        <div style="flex:1;">
          <div>${esc(n.content).replace(/\n/g,'<br>')}</div>
          <div class="fa-activity-meta">${n.profiles?.email || '—'} • ${fmtDateTime(n.created_at)}</div>
          ${state.role !== 'viewer' ? `<div style="margin-top:0.5rem;"><button class="ecc-btn ecc-btn--ghost ecc-btn--sm fa-btn--danger" onclick="AdvisoryApp.deleteNote('${n.id}')">حذف</button></div>` : ''}
        </div>
      </div>
    `).join('') : '<div class="fa-empty">لا توجد ملاحظات</div>';
    return `
      ${state.role !== 'viewer' ? `
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">
          <textarea class="fa-textarea" id="fa-note-input" placeholder="اكتب ملاحظة..." style="min-height:60px;flex:1;"></textarea>
          <button class="ecc-btn ecc-btn--primary" onclick="AdvisoryApp.addNote('${entityType}','${entityId}')" style="align-self:flex-start;">إضافة</button>
        </div>` : ''}
      ${list}
    `;
  }

  async function addNote(entityType, entityId) {
    const input = document.getElementById('fa-note-input');
    const content = input.value.trim();
    if (!content) return;
    try {
      await AdvisoryService.createNote(entityType, entityId, content);
      toast('تمت إضافة الملاحظة', 'success');
      const container = $('#fa-detail-content');
      container.innerHTML = await renderNotesSection(container.dataset.type, container.dataset.id);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteNote(id) {
    if (!confirm('حذف الملاحظة؟')) return;
    try {
      await AdvisoryService.deleteNote(id);
      toast('تم الحذف', 'success');
      const container = $('#fa-detail-content');
      container.innerHTML = await renderNotesSection(container.dataset.type, container.dataset.id);
    } catch (err) { toast(err.message, 'error'); }
  }

  // ========== Activity ==========
  async function renderActivitySection(entityType, entityId) {
    const logs = await AdvisoryService.listActivity({ entity_type: entityType, entity_id: entityId });
    return renderActivityList(logs);
  }

  async function renderActivity() {
    const logs = await AdvisoryService.listActivity({});
    $('#fa-content').innerHTML = `
      <div class="fa-header"><h1>السجل الزمني</h1></div>
      <div class="ecc-card">
        ${renderActivityList(logs)}
      </div>
    `;
  }

  // ========== Modal ==========
  function openModal(title, html, modalClass) {
    closeModal();
    const overlay = el('div', 'fa-modal-overlay');
    overlay.id = 'fa-modal';
    overlay.innerHTML = `
      <div class="fa-modal ${modalClass || ''}">
        <div class="fa-modal-header">
          <h2>${title}</h2>
          <button class="fa-close" onclick="AdvisoryApp.closeModal()">&times;</button>
        </div>
        <div>${html}</div>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const m = $('#fa-modal');
    if (m) { m.remove(); document.body.style.overflow = ''; }
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ========== Init ==========
  function init() {
    $$('.fa-nav a').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const view = a.dataset.view;
        if (view) showView(view);
      });
    });
    // Refresh when parent dashboard sends session token.
    window.addEventListener('admin-session-ready', () => {
      state.role = null;
      showView(VIEWS.DASHBOARD);
    });
    showView(VIEWS.DASHBOARD);
  }

  root.AdvisoryApp = {
    init, showView,
    renderClients, addClient, editClient, saveClient, deleteClient,
    renderProjects, addProject, editProject, saveProject, deleteProject,
    renderStudies, addStudy, editStudy, saveStudy, deleteStudy,
    renderModels, addModel, editModel, saveModel, deleteModel,
    openDetail, switchDetailTab,
    handleFileUpload, downloadDocument, deleteDocument,
    addNote, deleteNote,
    refreshProjectOptions,
    closeModal
  };
})(window);

document.addEventListener('DOMContentLoaded', window.AdvisoryApp.init);
