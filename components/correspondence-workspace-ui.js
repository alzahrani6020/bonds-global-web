(function () {
  'use strict';
  // Presentation-only shell. Governed correspondence owns all persistence, transitions and PDF output.
  const isEnglish = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const tr = (ar, en) => isEnglish ? en : ar;

  function activateExisting(id) {
    const action = document.getElementById(id);
    if (!action || action.hidden || action.disabled) return false;
    action.click();
    return true;
  }

  function openCenter(searchTerm) {
    if (!activateExisting('corr-command-open')) {
      window.alert(tr('مركز المراسلات غير جاهز بعد.', 'Correspondence center is not ready yet.'));
      return;
    }
    if (typeof searchTerm === 'string') {
      const input = document.getElementById('corr-command-search');
      if (input) {
        input.value = searchTerm;
        activateExisting('corr-command-search-btn');
      }
    }
  }

  function create(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined) node.textContent = label;
    return node;
  }

  function button(label, action, className) {
    const node = create('button', className || '', label);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function mount() {
    if (new URLSearchParams(location.search).get('workspace') !== 'correspondence') return;
    const toolbar = document.getElementById('letterhead-toolbar');
    const pages = document.getElementById('pages-container');
    if (!toolbar || !pages || document.getElementById('bx-workspace-shell')) return;

    document.body.classList.add('bx-correspondence');
    const root = create('main', 'bx-workspace-shell');
    root.id = 'bx-workspace-shell';

    const top = create('header', 'bx-topbar');
    const brand = create('div', 'bx-brand');
    const symbol = create('span', 'bx-brand-mark', 'B');
    const brandLabel = create('span', '', 'BONDS Global');
    const subtitle = create('small', '', tr('مركز المراسلات المؤسسية', 'Institutional correspondence'));
    brandLabel.appendChild(subtitle);
    brand.append(symbol, brandLabel);
    const back = create('a', 'bx-home', tr('العودة إلى لوحة التحكم', 'Back to dashboard'));
    back.href = '/admin/dashboard';
    top.append(brand, back);

    const heading = create('section', 'bx-main-title');
    const headingText = create('div');
    headingText.append(create('h1', '', tr('مركز المراسلات المؤسسية', 'Correspondence workspace')));
    headingText.append(create('p', '', tr('تحرير الخطابات ومراجعتها وإصدارها ضمن الدورة المعتمدة', 'Author, review and issue within the approved workflow')));
    heading.append(headingText);

    // Counts are mirrored only from the authorized summary returned by the
    // existing correspondence engine. No independent query or placeholder totals.
    const stats = create('section', 'bx-stats');
    stats.setAttribute('aria-label', tr('مؤشرات المراسلات', 'Correspondence statistics'));
    const metricLabels = isEnglish
      ? ['Total', 'Urgent', 'Delivery failures', 'Drafts', 'Under review', 'Issued']
      : ['إجمالي المراسلات', 'العاجل', 'فشل الإرسال', 'المسودات', 'قيد المراجعة', 'الصادر'];
    const metricValues = metricLabels.map(label => {
      const card = create('div', 'bx-metric');
      const number = create('strong', '', '—');
      card.append(number, create('span', '', label));
      stats.append(card);
      return number;
    });

    const layout = create('div', 'bx-layout');
    const nav = create('nav', 'bx-nav');
    nav.setAttribute('aria-label', tr('التنقل في المراسلات', 'Correspondence navigation'));
    nav.append(create('div', 'bx-nav-heading', tr('المراسلات', 'Correspondence')));
    nav.append(button(tr('◈  مركز المراسلات', '◈  Correspondence center'), () => openCenter(), 'bx-active'));
    nav.append(button(tr('＋  مراسلة جديدة', '＋  New correspondence'), () => {
      if (!activateExisting('corr-new')) openCenter();
    }));
    nav.append(button(tr('▤  عرض السجل والبحث', '▤  Search register'), () => openCenter('')));
    nav.append(button(tr('◷  مهامي ومراجعتي', '◷  My work and reviews'), () => openCenter()));
    nav.append(create('div', 'bx-nav-separator'));
    const verification = create('a', '', tr('✓  التحقق من المراسلات', '✓  Correspondence verification'));
    verification.href = '/admin/correspondence-verification/';
    nav.append(verification);

    const editor = create('section', 'bx-editor');
    const editorHeader = create('div', 'bx-editor-header');
    const editorName = create('div');
    editorName.append(create('strong', '', tr('تحرير المراسلة', 'Edit correspondence')));
    editorName.append(create('small', '', tr('المستند الرسمي — البيانات والحالة محفوظة في النظام الحالي', 'Official document — existing governed data and status')));
    const headerActions = create('div', 'bx-editor-actions');
    headerActions.append(button(tr('حفظ', 'Save'), () => {
      if (!activateExisting('corr-save')) window.alert(tr('الحفظ غير متاح في حالة المستند الحالية.', 'Saving is unavailable in the current state.'));
    }));
    headerActions.append(button(tr('إرسال للمراجعة', 'Submit for review'), () => {
      if (!activateExisting('corr-save-submit')) window.alert(tr('الإرسال غير متاح في الحالة الحالية.', 'Submission is unavailable in the current state.'));
    }));
    const toolToggle = button(tr('أدوات التنسيق', 'Formatting tools'), () => {
      const expanded = editor.classList.toggle('bx-show-tools');
      toolToggle.setAttribute('aria-expanded', String(expanded));
    }, 'bx-advanced-toggle');
    toolToggle.setAttribute('aria-controls', 'letterhead-toolbar');
    toolToggle.setAttribute('aria-expanded', 'false');
    headerActions.append(toolToggle);
    editorHeader.append(editorName, headerActions);
    editor.append(editorHeader);

    const tabs = create('div', 'bx-content-tabs');
    tabs.append(button(tr('المستند', 'Document'), () => pages.scrollIntoView({ behavior: 'smooth', block: 'start' })));
    tabs.append(button(tr('بيانات الخطاب', 'Details'), () => {
      activateExisting('corr-details-toggle');
      document.getElementById('corr-details-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
    tabs.append(button(tr('المرفقات وسجل الإجراءات', 'Attachments and activity'), () => openCenter()));
    editor.append(tabs);

    const documentArea = create('div', 'bx-document-area');
    editor.append(toolbar, documentArea);
    documentArea.append(pages);
    // The existing correspondence engine can mount its governance bar before or
    // after DOMContentLoaded. Keep it in the editor in both execution orders.
    const relocateGovernance = () => {
      const governance = document.getElementById('correspondence-governance');
      if (!governance) return false;
      if (governance.parentElement !== editor) editor.insertBefore(governance, toolbar);
      return true;
    };
    const governanceObserver = new MutationObserver(() => {
      if (relocateGovernance()) governanceObserver.disconnect();
    });
    if (!relocateGovernance()) governanceObserver.observe(document.body, { childList: true, subtree: true });

    const panel = create('aside', 'bx-panel');
    panel.setAttribute('aria-label', tr('سجل المراسلات', 'Correspondence register'));
    panel.append(create('h2', '', tr('المراسلات والسجل', 'Correspondence register')));
    panel.append(create('p', '', tr('عرض النتائج الفعلية في مركز المراسلات الحالي، دون إنشاء سجلات أو أرقام افتراضية.', 'View live records in the existing correspondence center; no sample records are created.')));
    panel.append(button(tr('＋ مراسلة جديدة', '＋ New correspondence'), () => {
      if (!activateExisting('corr-new')) openCenter();
    }, 'bx-primary'));
    const filter = create('div', 'bx-filter-list');
    filter.append(button(tr('الكل', 'All'), () => openCenter('')));
    filter.append(button(tr('بحث متقدم', 'Advanced search'), () => openCenter('')));
    panel.append(filter);

    const search = create('input', 'bx-search');
    search.type = 'search';
    search.maxLength = 200;
    search.placeholder = tr('ابحث بالرقم أو المستلم أو الموضوع', 'Search number, recipient or subject');
    search.setAttribute('aria-label', tr('البحث في المراسلات', 'Search correspondence'));
    search.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); openCenter(search.value); }
    });
    panel.append(search);
    panel.append(button(tr('البحث في السجل', 'Search register'), () => openCenter(search.value)));
    panel.append(create('div', 'bx-note', tr('تظهر المراسلات الحقيقية وحالاتها وصلاحياتها داخل مركز المراسلات. لن تعرض هذه المساحة أرقامًا توضيحية أو تنشئ مراسلات مكررة.', 'Real correspondence records and their permissions remain in the existing command center. No placeholder counts or duplicate messages.')));

    const status = create('div', 'bx-status');
    status.append(create('span', 'bx-status-label', tr('حالة المستند:', 'Document status:')));
    const value = create('span', 'bx-status-value', tr('جارٍ تحميل الحالة', 'Loading state'));
    value.id = 'bx-current-status';
    status.append(value);
    panel.append(status);

    panel.append(create('h2', 'bx-work-heading', tr('مهامي الحالية', 'My current tasks')));
    const workList = create('div', 'bx-work-list');
    workList.textContent = tr('جارٍ تحميل المهام…', 'Loading tasks…');
    panel.append(workList);
    const updateStatus = () => {
      const source = document.getElementById('corr-status');
      if (source && source.textContent.trim()) value.textContent = source.textContent.trim();
    };
    const observer = new MutationObserver(updateStatus);
    // Observe only the actual governance status once it is mounted; avoid body observer loops.
    const locateSource = () => {
      const source = document.getElementById('corr-status');
      if (!source) return;
      observer.disconnect();
      observer.observe(source, { childList: true, subtree: true, characterData: true });
      updateStatus();
    };
    const locate = new MutationObserver(() => {
      if (document.getElementById('corr-status')) {
        locateSource();
        locate.disconnect();
      }
    });
    locate.observe(document.body, { childList: true, subtree: true });
    if (document.getElementById('corr-status')) { locateSource(); locate.disconnect(); }

    // Read-only presentation of already-authorized command-center data.
    const attachMirror = (sourceId, render) => {
      let source = document.getElementById(sourceId);
      const mirror = new MutationObserver(() => render(source));
      const start = () => {
        source = document.getElementById(sourceId);
        if (!source) return false;
        mirror.observe(source, { childList: true, subtree: true, characterData: true });
        render(source);
        return true;
      };
      if (start()) return;
      const wait = new MutationObserver(() => { if (start()) wait.disconnect(); });
      wait.observe(document.body, { childList: true, subtree: true });
    };
    attachMirror('corr-summary', source => {
      [...source.children].slice(0, metricValues.length).forEach((card, index) => {
        metricValues[index].textContent = card.firstElementChild?.textContent || '—';
      });
    });
    attachMirror('corr-my-work', source => {
      workList.replaceChildren();
      const tasks = [...source.children].filter(node => node.tagName === 'BUTTON').slice(0, 6);
      if (!tasks.length) {
        workList.textContent = source.textContent.trim() || tr('لا توجد مهام مفتوحة', 'No open tasks');
        return;
      }
      tasks.forEach(original => {
        workList.append(button(original.textContent.trim(), () => original.click(), 'bx-work-item'));
      });
    });

    layout.append(nav, editor, panel);
    root.append(top, heading, stats, layout);
    const insertion = document.querySelector('.preview-exit');
    if (insertion) insertion.insertAdjacentElement('afterend', root);
    else document.body.insertBefore(root, document.body.firstChild);

    // Do not alter the official A4 document DOM or the issuance/approval engine.
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
