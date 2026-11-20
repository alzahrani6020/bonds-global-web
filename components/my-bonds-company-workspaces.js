/* Authorized company workspaces shown in My Bonds; data is filtered by existing Supabase RLS. */
(function () {
  'use strict';
  const root = document.getElementById('companyWorkspacesSection');
  if (!root) return;
  const list = document.getElementById('companyWorkspacesList');
  const en = document.documentElement.lang === 'en';
  const words = en
    ? { empty: 'No company workspaces are available to this account.', error: 'Company workspaces could not be loaded.', crm: 'Open CRM', hr: 'Human Resources', pending: 'Not yet available' }
    : { empty: 'لا توجد مساحات عمل شركات متاحة لهذا الحساب.', error: 'تعذر تحميل مساحات عمل الشركات.', crm: 'فتح CRM', hr: 'الموارد البشرية', pending: 'غير متاح حاليًا' };
  const crmPath = en ? '/en/my-bonds/crm/' : '/my-bonds/crm/';

  function message(value) {
    list.replaceChildren();
    const p = document.createElement('p');
    p.className = 'my-bonds-workspace-status';
    p.textContent = value;
    list.appendChild(p);
  }

  async function load() {
    try {
      if (!window.BondsAuth || typeof window.BondsAuth.getUser !== 'function') return;
      const result = await window.BondsAuth.getUser();
      if (!result?.data?.user) {
        root.hidden = true;
        return;
      }
      root.hidden = false;
      message(en ? 'Loading company workspaces…' : 'جارٍ تحميل مساحات عمل الشركات...');
      await window.BondsAuth.ensureEnv();
      const sb = window.BondsAuth.getSupabase();
      if (!sb) throw new Error('Supabase client unavailable');
      // No service role, admin bypass, workspace creation, or user-supplied owner IDs.
      const { data, error } = await sb.from('crm_app_workspaces')
        .select('id,name')
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      if (!Array.isArray(data) || !data.length) return message(words.empty);
      list.replaceChildren();
      for (const workspace of data) {
        const item = document.createElement('article');
        item.className = 'bonds-card my-bonds-workspace-card';
        const name = document.createElement('h4');
        name.textContent = workspace.name || (en ? 'Company workspace' : 'مساحة شركة');
        const programs = document.createElement('div');
        programs.className = 'my-bonds-workspace-programs';
        const crm = document.createElement('a');
        crm.className = 'bonds-btn bonds-btn-primary';
        crm.href = crmPath;
        crm.textContent = words.crm;
        const hr = document.createElement('span');
        hr.className = 'my-bonds-workspace-unavailable';
        hr.textContent = words.hr + ' — ' + words.pending;
        programs.append(crm, hr);
        item.append(name, programs);
        list.appendChild(item);
      }
    } catch (error) {
      console.error('[my-bonds] company workspaces unavailable:', error);
      root.hidden = false;
      message(words.error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
}());
