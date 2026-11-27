(async function () {
  'use strict';
  const english = document.documentElement.lang === 'en';
  const tr = (ar, en) => english ? en : ar;
  const $ = id => document.getElementById(id);
  const status = $('directory-status');
  const results = $('directory-results');
  const select = $('workspace-select');
  const form = $('directory-form');
  const submit = $('search-directory');
  if (!status || !results || !select || !form || !submit) return;
  let sb = null;
  let busy = false;

  function say(message) { status.textContent = message; }
  function element(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined && value !== null) el.textContent = String(value);
    return el;
  }
  function row(label, value) {
    if (value === undefined || value === null || value === '') return null;
    return element('p', 'item', label + ': ' + String(value));
  }
  function renderItems(items, type) {
    results.replaceChildren();
    if (!items.length) {
      results.append(element('div', 'empty', tr('لا توجد سجلات مطابقة في مساحة الشركة المحددة.','No matching records in the selected company workspace.')));
      return;
    }
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const card = element('article','entity');
      card.append(element('h2','',item.name || tr('بدون اسم','Unnamed')));
      const attributes = type === 'contacts'
        ? [[tr('الصفة','Role'),item.role],[tr('البريد','Email'),item.email],[tr('الهاتف','Phone'),item.phone],[tr('الحالة','Status'),item.status]]
        : [[tr('الاسم القانوني','Legal name'),item.legal_name],[tr('القطاع','Sector'),item.sector],[tr('المدينة','City'),item.city],
           [tr('الدولة','Country'),item.country],[tr('البريد','Email'),item.email],[tr('الهاتف','Phone'),item.phone],[tr('الحالة','Status'),item.status]];
      for (const [label,value] of attributes) {
        const line = row(label,value);
        if (line) card.append(line);
      }
      frag.append(card);
    }
    results.append(frag);
  }
  async function authenticatedSession() {
    const { data, error } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (error || !token) throw new Error('AUTH_REQUIRED');
    return token;
  }
  async function loadResults() {
    if (busy || !sb) return;
    const workspace = select.value;
    const type = $('entity-type').value;
    const q = $('directory-query').value.trim();
    if (!workspace) { say(tr('اختر مساحة شركة مصرحًا بها أولًا.','Choose an authorized company workspace first.')); return; }
    if (q.length > 80 || /[^\p{L}\p{N}\s._-]/u.test(q)) {
      say(tr('استخدم الاسم أو جزءًا منه دون رموز البحث الخاصة.','Search by name without special wildcard symbols.')); return;
    }
    busy = true;
    submit.disabled = true;
    say(tr('جارٍ تحميل الجهات المصرح بها...','Loading authorized records...'));
    results.replaceChildren();
    try {
      const token = await authenticatedSession();
      const params = new URLSearchParams({workspace_id:workspace,type,q,limit:'25'});
      const response = await fetch('/api/institutional-directory?' + params.toString(), {
        method:'GET', cache:'no-store', credentials:'same-origin',
        headers: {'Authorization':'Bearer ' + token, 'Accept':'application/json'}
      });
      if (response.status === 401) throw new Error('AUTH_REQUIRED');
      if (response.status === 404) throw new Error('WORKSPACE_NOT_FOUND');
      if (!response.ok) throw new Error('DIRECTORY_UNAVAILABLE');
      const payload = await response.json();
      if (payload.workspace_id !== workspace || !Array.isArray(payload.items)) throw new Error('DIRECTORY_UNAVAILABLE');
      renderItems(payload.items,type);
      say(tr('عدد النتائج المعروضة: ','Displayed records: ') + payload.items.length + tr(' (الحد الأقصى 25 سجلًا لكل بحث).',' (maximum 25 records per search).'));
    } catch (error) {
      const message = error?.message === 'AUTH_REQUIRED'
        ? tr('انتهت جلسة الدخول. سجّل الدخول إلى BONDS ثم أعد المحاولة.','Your session has expired. Sign in to BONDS and retry.')
        : error?.message === 'WORKSPACE_NOT_FOUND'
          ? tr('مساحة الشركة غير متاحة لهذا الحساب.','This company workspace is not available to your account.')
          : tr('تعذر تحميل دليل الجهات حاليًا. لم تُغيّر أي بيانات.','Unable to load the directory. No data was changed.');
      say(message);
    } finally {
      submit.disabled = false;
      busy = false;
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); void loadResults(); });
  select.addEventListener('change', () => { void loadResults(); });
  $('entity-type').addEventListener('change', () => { void loadResults(); });

  try {
    if (!window.BondsAuth?.ensureEnv || !window.BondsAuth?.getSupabase) throw new Error('AUTH_UNAVAILABLE');
    await window.BondsAuth.ensureEnv();
    sb = window.BondsAuth.getSupabase();
    if (!sb) throw new Error('AUTH_UNAVAILABLE');
    await authenticatedSession();
    // CRM's RLS-protected existing workspace selector; server rechecks owner/
    // active membership for the actual directory request.
    const {data:spaces,error} = await sb.from('crm_app_workspaces')
      .select('id,name').order('created_at',{ascending:true}).limit(100);
    if (error) throw error;
    select.replaceChildren();
    if (!spaces?.length) {
      select.append(new Option(tr('لا توجد مساحات CRM مصرح بها','No authorized CRM workspaces'),''));
      say(tr('لا توجد مساحة CRM متاحة لهذا الحساب. يمكنك فتح CRM لإنشاء مساحة إذا كانت لديك الصلاحية.','No CRM workspace is available. Open CRM to create one if authorized.'));
      return;
    }
    for (const space of spaces) {
      select.append(new Option(space.name || tr('مساحة بلا اسم','Unnamed workspace'),space.id));
    }
    say(tr('تم تحديد مساحة الشركة. يعرض الدليل السجلات الحقيقية المسموح لك بها.','Company selected. Showing only permitted CRM records.'));
    await loadResults();
  } catch (_err) {
    select.replaceChildren(new Option(tr('تسجيل الدخول مطلوب','Sign-in required'),''));
    say(tr('يلزم تسجيل الدخول إلى BONDS لعرض دليل الجهات. لن تظهر بيانات أي شركة دون جلسة مصرح بها.','Sign in to BONDS to view the directory. Company records require an authorized session.'));
  }
})();
