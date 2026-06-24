// Bonds Client Portal — Shared Logic
(function () {
  'use strict';

  const LANG = window.__PORTAL_LANG || 'ar';
  const IS_EN = LANG === 'en';
  const PAGE = window.__PORTAL_PAGE || 'dashboard';
  const ROOT = '/';

  const LABELS = {
    ar: {
      portal: 'بوابة العميل',
      dashboard: 'لوحة التحكم',
      projects: 'المشاريع',
      reports: 'التقارير',
      logout: 'تسجيل الخروج',
      login: 'تسجيل الدخول',
      switchLang: 'EN',
      welcome: 'مرحباً',
      company: 'الشركة',
      email: 'البريد الإلكتروني',
      phone: 'الجوال',
      status: 'الحالة',
      noClientRecord: 'لم نجد سجلاً مرتبطاً ببريدك الإلكتروني. تواصل مع فريقنا لتفعيل البوابة.',
      projectsCount: 'عدد المشاريع',
      reportsCount: 'عدد التقارير',
      activeProject: 'آخر مشروع نشط',
      latestReport: 'أحدث تقرير',
      noProjects: 'لا توجد مشاريع مرتبطة بعد.',
      noReports: 'لا توجد تقارير مرتبطة بعد.',
      viewReport: 'عرض التقرير',
      viewProject: 'عرض المشروع',
      documents: 'المستندات',
      uploadDocument: 'رفع مستند',
      noDocuments: 'لا توجد مستندات مرفوعة بعد.',
      download: 'تنزيل',
      analyze: 'تحليل',
      analyzing: 'جاري التحليل...',
      uploadError: 'فشل رفع الملف، حاول مرة أخرى.',
      date: 'التاريخ',
      budget: 'الميزانية',
      workflow: 'مرحلة العمل',
      back: 'العودة',
      print: 'طباعة / PDF',
      notFound: 'الصفحة غير موجودة',
      loading: 'جاري التحميل...',
      errorLoading: 'حدث خطأ أثناء تحميل البيانات.',
      contactUs: 'تواصل معنا',
      aiAnalysis: 'التحليل الاستشاري',
      aiType: 'نوع التحليل',
      aiProject: 'المشروع',
      aiNoProject: 'بدون مشروع',
      aiSector: 'نوع النشاط',
      aiCity: 'المدينة',
      aiInvestment: 'حجم الاستثمار (ر.س)',
      aiMonthlyRevenue: 'الإيرادات المتوقعة (شهرياً)',
      aiMonthlyCosts: 'المصاريف المتوقعة (شهرياً)',
      aiAnnualRevenue: 'الإيرادات السنوية (ر.س)',
      aiExistingDebt: 'الديون الحالية (ر.س)',
      aiRunAnalysis: 'تحليل المشروع',
      aiAnalyzing: 'جاري إعداد التحليل...',
      aiRiskScore: 'مؤشر المخاطر',
      aiRiskLevel: 'مستوى الخطر',
      aiFeasibilityScore: 'درجة الجدوى',
      aiFundingReadiness: 'قابلية التمويل',
      aiExpectedReturn: 'العائد المتوقع',
      aiPaybackPeriod: 'مدة الاسترداد',
      aiConfidence: 'درجة الثقة',
      aiRecommendations: 'التوصيات الرئيسية',
      aiStrengths: 'نقاط القوة',
      aiWeaknesses: 'نقاط الضعف',
      aiFinancialSummary: 'المؤشرات المالية',
      aiExecutiveSummary: 'الملخص التنفيذي',
      aiCost: 'تكلفة التحليل',
      aiCached: 'نتيجة مخزنة',
      aiDownloadReport: 'تحميل التقرير التنفيذي PDF',
      aiRequestReview: 'طلب مراجعة استشارية',
      aiReviewRequested: 'تم إرسال طلب المراجعة',
      aiHistory: 'تحليلاتي السابقة',
      aiNoHistory: 'لا توجد تحليلات سابقة.',
      aiViewAnalysis: 'عرض التحليل',
      aiRequestAgain: 'طلب مراجعة',
      aiError: 'فشل إعداد التحليل. حاول مرة أخرى.',
      analyses: 'التحليلات',
      reviewRequests: 'طلبات المراجعة',
      support: 'الدعم الفني',
      createProject: 'إنشاء مشروع جديد',
      analyzeProject: 'تحليل المشروع',
      startAnalysis: 'ابدأ تحليل مشروعك',
      welcomeSubtitle: 'ابدأ رحلتك الاستثمارية من هنا',
      nextBestAction: 'الخطوة التالية الموصى بها',
      actionPlan: 'خطة العمل المقترحة',
      decision: 'القرار',
      recommendation: 'التوصية',
      latestAnalyses: 'آخر التحليلات',
      latestReviews: 'آخر طلبات المراجعة',
      projectStepsTitle: 'رحلتك في 4 خطوات',
      step1: 'بيانات المشروع',
      step2: 'تحليل AI',
      step3: 'مراجعة مستشار',
      step4: 'تقرير معتمد',
      noAnalyses: 'لا توجد تحليلات سابقة.',
      noReviews: 'لا توجد طلبات مراجعة.',
      viewDetails: 'عرض التفاصيل',
      projectData: 'بيانات المشروع',
      projectAnalyses: 'تحليلات المشروع',
      projectReports: 'تقارير المشروع',
      projectDocuments: 'مستندات المشروع',
      projectReviewRequests: 'طلبات المراجعة',
      backToDashboard: 'العودة للوحة التحكم',
      uploadDocForProject: 'رفع مستند لهذا المشروع',
      overallStatus: 'الحالة العامة',
      reviewStatus: 'حالة المراجعة',
      latestUpdate: 'آخر تحديث',
      status_pending_review: 'قيد الانتظار',
      status_assigned: 'معين لمستشار',
      status_under_review: 'قيد المراجعة',
      status_approved: 'معتمد',
      status_returned: 'مُعاد للعميل',
      newClientWelcome: 'مرحباً بك في بوابة Bonds',
      emptyProjectsTitle: 'ابدأ بإنشاء مشروعك الأول',
      emptyProjectsDesc: 'أضف بيانات مشروعك واحصل على تحليل AI ومراجعة استشارية.'
    },
    en: {
      portal: 'Client Portal',
      dashboard: 'Dashboard',
      projects: 'Projects',
      reports: 'Reports',
      logout: 'Sign out',
      login: 'Sign in',
      switchLang: 'العربية',
      welcome: 'Welcome',
      company: 'Company',
      email: 'Email',
      phone: 'Phone',
      status: 'Status',
      noClientRecord: 'We could not find a client record linked to your email. Please contact our team to activate the portal.',
      projectsCount: 'Projects',
      reportsCount: 'Reports',
      activeProject: 'Latest active project',
      latestReport: 'Latest report',
      noProjects: 'No projects linked yet.',
      noReports: 'No reports linked yet.',
      viewReport: 'View report',
      viewProject: 'View project',
      documents: 'Documents',
      uploadDocument: 'Upload document',
      noDocuments: 'No uploaded documents yet.',
      download: 'Download',
      analyze: 'Analyze',
      analyzing: 'Analyzing...',
      uploadError: 'Upload failed, please try again.',
      date: 'Date',
      budget: 'Budget',
      workflow: 'Workflow stage',
      back: 'Back',
      print: 'Print / PDF',
      notFound: 'Page not found',
      loading: 'Loading...',
      errorLoading: 'An error occurred while loading data.',
      contactUs: 'Contact us',
      aiAnalysis: 'Advisory Analysis',
      aiType: 'Analysis type',
      aiProject: 'Project',
      aiNoProject: 'No project',
      aiSector: 'Business activity',
      aiCity: 'City',
      aiInvestment: 'Investment amount (SAR)',
      aiMonthlyRevenue: 'Expected monthly revenue',
      aiMonthlyCosts: 'Expected monthly expenses',
      aiAnnualRevenue: 'Annual revenue (SAR)',
      aiExistingDebt: 'Existing debt (SAR)',
      aiRunAnalysis: 'Analyze project',
      aiAnalyzing: 'Preparing analysis...',
      aiRiskScore: 'Risk indicator',
      aiRiskLevel: 'Risk level',
      aiFeasibilityScore: 'Feasibility score',
      aiFundingReadiness: 'Funding readiness',
      aiExpectedReturn: 'Expected return',
      aiPaybackPeriod: 'Payback period',
      aiConfidence: 'Confidence',
      aiRecommendations: 'Key recommendations',
      aiStrengths: 'Strengths',
      aiWeaknesses: 'Weaknesses',
      aiFinancialSummary: 'Financial indicators',
      aiExecutiveSummary: 'Executive summary',
      aiCost: 'Analysis cost',
      aiCached: 'Cached result',
      aiDownloadReport: 'Download executive report PDF',
      aiRequestReview: 'Request expert review',
      aiReviewRequested: 'Review request sent',
      aiHistory: 'My previous analyses',
      aiNoHistory: 'No previous analyses.',
      aiViewAnalysis: 'View analysis',
      aiRequestAgain: 'Request review',
      aiError: 'Failed to prepare analysis. Please try again.',
      analyses: 'Analyses',
      reviewRequests: 'Review Requests',
      support: 'Support',
      createProject: 'Create new project',
      analyzeProject: 'Analyze project',
      startAnalysis: 'Start analyzing your project',
      welcomeSubtitle: 'Start your investment journey here',
      nextBestAction: 'Recommended next step',
      actionPlan: 'Recommended action plan',
      decision: 'Decision',
      recommendation: 'Recommendation',
      latestAnalyses: 'Latest analyses',
      latestReviews: 'Latest review requests',
      projectStepsTitle: 'Your journey in 4 steps',
      step1: 'Project data',
      step2: 'AI analysis',
      step3: 'Expert review',
      step4: 'Approved report',
      noAnalyses: 'No previous analyses.',
      noReviews: 'No review requests.',
      viewDetails: 'View details',
      projectData: 'Project data',
      projectAnalyses: 'Project analyses',
      projectReports: 'Project reports',
      projectDocuments: 'Project documents',
      projectReviewRequests: 'Review requests',
      backToDashboard: 'Back to dashboard',
      uploadDocForProject: 'Upload document for this project',
      overallStatus: 'Overall status',
      reviewStatus: 'Review status',
      latestUpdate: 'Latest update',
      status_pending_review: 'Pending review',
      status_assigned: 'Assigned',
      status_under_review: 'Under review',
      status_approved: 'Approved',
      status_returned: 'Returned',
      newClientWelcome: 'Welcome to Bonds Portal',
      emptyProjectsTitle: 'Start with your first project',
      emptyProjectsDesc: 'Add your project details and get AI analysis and expert review.'
    }
  };

  function t(key) { return LABELS[LANG][key] || key; }

  function typeLabel(type) {
    const labels = {
      ar: {
        feasibility_study: 'دراسة جدوى',
        credit_assessment: 'تقييم ائتماني',
        distressed_project: 'مشروع متعثر',
        city_analysis: 'تحليل مدينة'
      },
      en: {
        feasibility_study: 'Feasibility Study',
        credit_assessment: 'Credit Assessment',
        distressed_project: 'Distressed Project',
        city_analysis: 'City Analysis'
      }
    };
    return labels[LANG][type] || type;
  }

  function clientPath(page) {
    return IS_EN ? ROOT + 'en/client/' + page : ROOT + 'client/' + page;
  }

  function getSupabase() {
    return window.BondsAuth && window.BondsAuth.getSupabase ? window.BondsAuth.getSupabase() : null;
  }

  async function getUser() {
    if (!window.BondsAuth || !window.BondsAuth.getUser) return { data: { user: null }, error: new Error('Auth not loaded') };
    return window.BondsAuth.getUser();
  }

  async function requireAuth() {
    const { data, error } = await getUser();
    const user = data?.user;
    if (error || !user) {
      window.location.href = clientPath('login.html') + '?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    return user;
  }

  function injectHeader(user) {
    const header = document.getElementById('portal-header');
    if (!header) return;
    const langHref = IS_EN ? '/client/index.html' : '/en/client/index.html';
    const dashboardHref = clientPath('index.html');
    header.innerHTML = `
      <header class="portal-header">
        <div class="portal-header__inner">
          <a class="portal-header__brand" href="${dashboardHref}">
            <img src="/assets/bonds-logo-2026-header.webp?v=2026" alt="Bonds" />
            <span>${t('portal')}</span>
          </a>
          <div class="portal-header__actions">
            <a class="portal-header__lang" href="${langHref}">${t('switchLang')}</a>
            <span class="portal-user">👤 ${user.email}</span>
            <a class="portal-header__logout" href="#" onclick="BondsClientPortal.logout();return false;">${t('logout')}</a>
          </div>
        </div>
      </header>
    `;
  }

  function injectSidebar() {
    const sidebar = document.getElementById('portal-sidebar');
    if (!sidebar) return;
    const pages = [
      { id: 'dashboard', icon: '📊', href: clientPath('index.html') },
      { id: 'projects', icon: '📁', href: clientPath('index.html#projectsSection') },
      { id: 'analyses', icon: '🧠', href: clientPath('index.html#aiHistorySection') },
      { id: 'reports', icon: '📄', href: clientPath('reports.html') },
      { id: 'reviewRequests', icon: '👨‍💼', href: clientPath('index.html#reviewRequestsSection') },
      { id: 'documents', icon: '📎', href: clientPath('index.html#documentsSection') },
      { id: 'support', icon: '🎧', href: IS_EN ? '/en/contact.html' : '/contact.html' }
    ];
    sidebar.innerHTML = pages.map(p => {
      const isActive = PAGE === p.id || (p.id === 'projects' && PAGE === 'project');
      return `
        <a href="${p.href}" class="portal-sidebar__link ${isActive ? 'active' : ''}">
          <span>${p.icon}</span>
          <span>${t(p.id)}</span>
        </a>
      `;
    }).join('');
  }

  async function loadClient(user) {
    const sb = getSupabase();
    if (!sb) return { data: null, error: new Error('Supabase not initialized') };
    const { data, error } = await sb
      .from('advisory_clients')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    return { data, error };
  }

  async function loadProjects(clientId) {
    const sb = getSupabase();
    if (!sb) return { data: [], error: new Error('Supabase not initialized') };
    const { data, error } = await sb
      .from('advisory_projects')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  }

  async function loadWorkflows(projectIds) {
    const sb = getSupabase();
    if (!sb || !projectIds || projectIds.length === 0) return { data: [], error: null };
    const { data, error } = await sb
      .from('entity_workflows')
      .select('entity_id, current_state')
      .eq('entity_type', 'advisory_project')
      .in('entity_id', projectIds);
    return { data: data || [], error };
  }

  async function loadReports(clientId) {
    const sb = getSupabase();
    if (!sb) return { data: [], error: new Error('Supabase not initialized') };
    const { data, error } = await sb
      .from('ai_advisor_reports')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  }

  async function loadDocuments(clientId) {
    const sb = getSupabase();
    if (!sb) return { data: [], error: new Error('Supabase not initialized') };
    const { data, error } = await sb
      .from('client_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  }

  async function loadProjectDetails(projectId) {
    const sb = getSupabase();
    if (!sb || !projectId) return { data: null, error: null };

    const { data: project, error: projectError } = await sb
      .from('advisory_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) return { data: null, error: projectError };

    const [{ data: feasibility }, { data: financialModels }] = await Promise.all([
      sb.from('advisory_feasibility_studies')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from('advisory_financial_models')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
    ]);

    return {
      data: { project, feasibility: feasibility || null, financialModels: financialModels || [] },
      error: null
    };
  }

  async function createProject(clientId, fields) {
    const sb = getSupabase();
    if (!sb || !clientId) return { data: null, error: new Error('Missing client') };
    const { data, error } = await sb
      .from('advisory_projects')
      .insert({
        client_id: clientId,
        name: fields.name,
        sector: fields.sector,
        city: fields.city,
        budget: fields.budget,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    return { data, error };
  }

  async function loadAiAnalyses(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return { data: [], error: null };
    const { data, error } = await sb
      .from('ai_requests')
      .select('*, ai_results(result, risk_score)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    return { data: data || [], error };
  }

  async function loadAiReviewRequests(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return { data: [], error: null };
    const { data, error } = await sb
      .from('ai_review_requests')
      .select('*, ai_requests!inner(type, project_id, ai_results(result, risk_score))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    return { data: data || [], error };
  }

  async function uploadDocument(file, clientId) {
    const sb = getSupabase();
    if (!sb || !file) return { data: null, error: new Error('Missing file or client') };

    const safeName = file.name.replace(/[^a-zA-Z0-9_.\u0600-\u06FF-]/g, '_');
    const path = `client/${clientId}/${Date.now()}-${safeName}`;

    const { data: uploadData, error: uploadError } = await sb.storage
      .from('client-documents')
      .upload(path, file, { upsert: false });
    if (uploadError) return { data: null, error: uploadError };

    const { data: doc, error: insertError } = await sb
      .from('client_documents')
      .insert({
        client_id: clientId,
        filename: file.name,
        storage_path: uploadData.path,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size || 0,
        status: 'uploaded'
      })
      .select()
      .single();
    if (insertError) return { data: null, error: insertError };

    return { data: doc, error: null };
  }

  async function getDocumentDownloadUrl(storagePath) {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.storage
      .from('client-documents')
      .createSignedUrl(storagePath, 3600);
    if (error) return null;
    return data?.signedUrl || null;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(IS_EN ? 'en-GB' : 'ar-SA');
  }

  function statusClass(status) {
    const s = (status || '').toLowerCase().replace(/\s+/g, '_');
    if (['new', 'pending', 'draft'].includes(s)) return 'portal-status--new';
    if (['in_progress', 'active', 'processing'].includes(s)) return 'portal-status--in_progress';
    if (['review', 'under_review', 'waiting_approval'].includes(s)) return 'portal-status--review';
    if (['approved', 'completed', 'done', 'success'].includes(s)) return 'portal-status--approved';
    if (['rejected', 'cancelled', 'failed'].includes(s)) return 'portal-status--rejected';
    return 'portal-status--new';
  }

  function showLoading(id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="portal-empty"><div class="portal-empty__icon">⏳</div>${t('loading')}</div>`;
  }

  function reviewStatusLabel(status) {
    return t('status_' + (status || 'pending_review')) || (status || 'pending_review');
  }

  function decisionFromResult(result) {
    const risk = Number(result?.risk_score) || 0;
    const funding = result?.funding_readiness || '';
    if (funding.toLowerCase().includes('high') || funding.includes('ممتازة') || risk < 40) {
      return { text: IS_EN ? 'Recommended for funding' : 'مُوصى بالتمويل', class: 'portal-decision--success', recommendation: IS_EN ? 'Proceed with the project after reviewing the action plan.' : 'المتابعة بعد مراجعة خطة العمل.' };
    }
    if (risk >= 75) {
      return { text: IS_EN ? 'High risk — review required' : 'مخاطر عالية — يحتاج مراجعة', class: 'portal-decision--danger', recommendation: IS_EN ? 'Address the main weaknesses before requesting funding.' : 'معالجة نقاط الضعف الرئيسية قبل طلب التمويل.' };
    }
    return { text: IS_EN ? 'Conditional approval' : 'موافقة مشروطة', class: 'portal-decision--warning', recommendation: IS_EN ? 'Improve cash flow and reduce risks, then re-evaluate.' : 'تحسين التدفق النقدي وتقليل المخاطر، ثم إعادة التقييم.' };
  }

  function actionPlanFromResult(result) {
    const recs = result?.recommendations || [];
    const steps = [];
    if (recs.length > 0) steps.push({ week: IS_EN ? 'Week 1' : 'الأسبوع 1', task: recs[0] });
    if (recs.length > 1) steps.push({ week: IS_EN ? 'Week 2' : 'الأسبوع 2', task: recs[1] });
    if (recs.length > 2) steps.push({ week: IS_EN ? 'Week 3' : 'الأسبوع 3', task: recs[2] });
    if (steps.length === 0) steps.push({ week: IS_EN ? 'Week 1' : 'الأسبوع 1', task: IS_EN ? 'Prepare the required financial documents.' : 'إعداد المستندات المالية المطلوبة.' });
    return steps;
  }

  function nextBestAction(client, projects, analyses, reviewRequests) {
    if (!projects || projects.length === 0) {
      return { label: t('createProject'), action: 'create-project', icon: '📁' };
    }
    const pendingReviews = (reviewRequests || []).filter(r => ['pending_review', 'assigned', 'under_review'].includes(r.status));
    if (pendingReviews.length > 0) {
      return { label: IS_EN ? 'Review in progress' : 'مراجعة قيد التنفيذ', action: 'view-reviews', icon: '👨‍💼' };
    }
    const lastAnalysis = analyses && analyses[0];
    if (!lastAnalysis || Date.now() - new Date(lastAnalysis.created_at).getTime() > 7 * 24 * 60 * 60 * 1000) {
      return { label: t('analyzeProject'), action: 'analyze', icon: '🧠' };
    }
    return { label: t('aiRequestReview'), action: 'request-review', icon: '✅' };
  }

  function renderDashboard(client, projects, reports, workflowsMap, documents, analyses, reviewRequests) {
    const main = document.getElementById('portal-main');
    if (!main) return;

    const wf = workflowsMap || {};
    const docs = documents || [];
    const latestAnalysis = analyses && analyses[0];
    const latestAnalysisResult = latestAnalysis?.ai_results?.result || {};
    const decision = decisionFromResult(latestAnalysisResult);
    const actionPlan = actionPlanFromResult(latestAnalysisResult);
    const nextAction = nextBestAction(client, projects, analyses, reviewRequests);

    const hasProjects = projects.length > 0;
    const welcomeTitle = hasProjects
      ? `${t('welcome')}، ${client.name || client.company_name || client.email}`
      : t('newClientWelcome');
    const welcomeSubtitle = hasProjects ? t('welcomeSubtitle') : t('emptyProjectsDesc');

    main.innerHTML = `
      <section class="portal-welcome-card">
        <div class="portal-welcome-card__content">
          <h1 class="portal-welcome-card__title">${welcomeTitle}</h1>
          <p class="portal-welcome-card__subtitle">${welcomeSubtitle}</p>
          <div class="portal-welcome-card__actions">
            <button class="portal-btn portal-btn--primary" id="dashboardPrimaryAction">${nextAction.icon} ${nextAction.label}</button>
            ${hasProjects ? `<a class="portal-btn portal-btn--outline" href="${clientPath('index.html#aiAnalyzerSection')}">${t('analyzeProject')}</a>` : ''}
          </div>
        </div>
      </section>

      <div class="portal-stats-grid">
        <div class="portal-stat-card">
          <div class="portal-stat-card__icon">📁</div>
          <div class="portal-stat-card__value">${projects.length}</div>
          <div class="portal-stat-card__label">${t('projects')}</div>
        </div>
        <div class="portal-stat-card">
          <div class="portal-stat-card__icon">🧠</div>
          <div class="portal-stat-card__value">${analyses.length}</div>
          <div class="portal-stat-card__label">${t('analyses')}</div>
        </div>
        <div class="portal-stat-card">
          <div class="portal-stat-card__icon">📄</div>
          <div class="portal-stat-card__value">${reports.length}</div>
          <div class="portal-stat-card__label">${t('reports')}</div>
        </div>
        <div class="portal-stat-card">
          <div class="portal-stat-card__icon">👨‍💼</div>
          <div class="portal-stat-card__value">${reviewRequests.length}</div>
          <div class="portal-stat-card__label">${t('reviewRequests')}</div>
        </div>
      </div>

      <section class="portal-next-action">
        <div class="portal-next-action__label">${t('nextBestAction')}</div>
        <div class="portal-next-action__content">
          <span class="portal-next-action__icon">${nextAction.icon}</span>
          <span class="portal-next-action__text">${nextAction.label}</span>
          <button class="portal-btn portal-btn--sm" id="nextActionBtn">${t('viewDetails')}</button>
        </div>
      </section>

      <section class="portal-steps">
        <div class="portal-section__title">${t('projectStepsTitle')}</div>
        <div class="portal-steps__list">
          <div class="portal-step ${hasProjects ? 'portal-step--done' : 'portal-step--active'}">
            <div class="portal-step__num">1</div>
            <div class="portal-step__title">${t('step1')}</div>
          </div>
          <div class="portal-step ${analyses.length > 0 ? 'portal-step--done' : (hasProjects ? 'portal-step--active' : '')}">
            <div class="portal-step__num">2</div>
            <div class="portal-step__title">${t('step2')}</div>
          </div>
          <div class="portal-step ${reviewRequests.length > 0 ? 'portal-step--done' : (analyses.length > 0 ? 'portal-step--active' : '')}">
            <div class="portal-step__num">3</div>
            <div class="portal-step__title">${t('step3')}</div>
          </div>
          <div class="portal-step ${reviewRequests.some(r => r.status === 'approved') ? 'portal-step--done' : (reviewRequests.length > 0 ? 'portal-step--active' : '')}">
            <div class="portal-step__num">4</div>
            <div class="portal-step__title">${t('step4')}</div>
          </div>
        </div>
      </section>

      ${latestAnalysis && latestAnalysisResult.risk_score !== undefined ? `
      <section class="portal-section">
        <div class="portal-section__title">${t('decision')}</div>
        <div class="portal-decision ${decision.class}">
          <div class="portal-decision__title">${decision.text}</div>
          <div class="portal-decision__rec">${decision.recommendation}</div>
        </div>
      </section>
      ` : ''}

      ${actionPlan.length ? `
      <section class="portal-section">
        <div class="portal-section__title">${t('actionPlan')}</div>
        <div class="portal-action-plan">
          ${actionPlan.map(s => `
            <div class="portal-action-plan__item">
              <div class="portal-action-plan__week">${s.week}</div>
              <div class="portal-action-plan__task">${escapeHtml(s.task)}</div>
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}

      <section class="portal-section" id="projectsSection">
        <div class="portal-section__header">
          <div class="portal-section__title">${t('projects')}</div>
          <button class="portal-btn portal-btn--outline portal-btn--sm" id="createProjectBtn">${t('createProject')}</button>
        </div>
        ${projects.length === 0 ? `
          <div class="portal-empty">
            <div class="portal-empty__icon">📁</div>
            <div class="portal-empty__title">${t('emptyProjectsTitle')}</div>
            <div class="portal-empty__desc">${t('emptyProjectsDesc')}</div>
            <button class="portal-btn" id="createProjectBtnEmpty">${t('createProject')}</button>
          </div>
        ` : `
          <div class="portal-project-grid">
            ${projects.map(p => `
              <a class="portal-project-card" href="${clientPath('project.html?id=' + p.id)}">
                <div class="portal-project-card__header">
                  <div class="portal-project-card__name">${escapeHtml(p.name)}</div>
                  <span class="portal-status ${statusClass(p.status)}">${p.status || 'new'}</span>
                </div>
                <div class="portal-project-card__meta">${t('date')}: ${formatDate(p.created_at)} · ${t('budget')}: ${p.budget || '-'}</div>
                ${wf[p.id] ? `<div class="portal-project-card__meta">${t('workflow')}: ${wf[p.id].current_state}</div>` : ''}
                <div class="portal-project-card__footer">${t('viewDetails')}</div>
              </a>
            `).join('')}
          </div>
        `}
      </section>

      <section class="portal-section" id="aiHistorySection">
        <div class="portal-section__header">
          <div class="portal-section__title">${t('latestAnalyses')}</div>
          <a class="portal-btn portal-btn--outline portal-btn--sm" href="${clientPath('index.html#aiAnalyzerSection')}">${t('analyzeProject')}</a>
        </div>
        ${analyses.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">🧠</div>${t('noAnalyses')}</div>
        ` : `
          <div class="portal-list">
            ${analyses.slice(0, 5).map(a => {
              const result = a.ai_results?.result || {};
              const risk = result.risk_score ?? '-';
              const projectName = a.project_id ? (projects.find(p => p.id === a.project_id)?.name || '') : '';
              return `
                <div class="portal-list__item" data-ai-request-id="${a.id}" data-ai-result='${escapeHtml(JSON.stringify(result))}'>
                  <div>
                    <div style="font-weight:700;">${typeLabel(a.type)}${projectName ? ' — ' + escapeHtml(projectName) : ''}</div>
                    <div class="portal-list__meta">${formatDate(a.created_at)} · ${t('aiRiskScore')}: ${risk}</div>
                  </div>
                  <div style="display:flex;gap:0.5rem;">
                    <button class="portal-btn portal-btn--outline ai-history-view-btn">${t('aiViewAnalysis')}</button>
                    <button class="portal-btn portal-btn--outline ai-history-review-btn">${t('aiRequestAgain')}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>

      <section class="portal-section" id="reviewRequestsSection">
        <div class="portal-section__header">
          <div class="portal-section__title">${t('latestReviews')}</div>
        </div>
        ${reviewRequests.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">👨‍💼</div>${t('noReviews')}</div>
        ` : `
          <div class="portal-list">
            ${reviewRequests.slice(0, 5).map(r => {
              const req = r.ai_requests || {};
              const result = req.ai_results?.result || {};
              return `
                <div class="portal-list__item">
                  <div>
                    <div style="font-weight:700;">${typeLabel(req.type) || '-'}</div>
                    <div class="portal-list__meta">${formatDate(r.created_at)} · ${t('aiRiskScore')}: ${result.risk_score ?? '-'} · ${t('reviewStatus')}: <span class="portal-status ${statusClass(r.status)}">${reviewStatusLabel(r.status)}</span></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>

      <section class="portal-section" id="documentsSection">
        <div class="portal-section__header">
          <div class="portal-section__title">${t('documents')}</div>
        </div>
        <div style="margin-bottom:1rem;">
          <input type="file" id="docUploadInput" style="display:none;" />
          <button class="portal-btn portal-btn--outline portal-btn--sm" id="docUploadBtn">⬆️ ${t('uploadDocument')}</button>
          <span id="docUploadMsg" style="margin-right:0.75rem;color:var(--text-secondary);"></span>
        </div>
        ${docs.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">📎</div>${t('noDocuments')}</div>
        ` : `
          <div class="portal-list" id="documentsList">
            ${docs.map(d => `
              <div class="portal-list__item" data-doc-id="${d.id}" data-doc-path="${d.storage_path}" data-doc-mime="${escapeHtml(d.mime_type || '')}" data-doc-filename="${escapeHtml(d.filename)}">
                <div>
                  <div style="font-weight:700;">${escapeHtml(d.filename)}</div>
                  <div class="portal-list__meta">${formatDate(d.created_at)} · ${(d.size_bytes / 1024).toFixed(1)} KB · ${d.status}</div>
                  ${d.extracted_data && d.extracted_data.summary ? `<div class="portal-list__meta" style="margin-top:0.35rem;">${d.extracted_data.summary}</div>` : ''}
                </div>
                <div style="display:flex;gap:0.5rem;">
                  <button class="portal-btn portal-btn--outline doc-analyze-btn" ${d.status === 'analyzing' ? 'disabled' : ''}>${d.status === 'analyzing' ? t('analyzing') : t('analyze')}</button>
                  <button class="portal-btn portal-btn--outline doc-download-btn">${t('download')}</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </section>

      ${renderAiAnalyzer(client, projects)}

      <div class="portal-modal-overlay" id="createProjectModal">
        <div class="portal-modal">
          <div class="portal-modal__header">
            <h3>${t('createProject')}</h3>
            <button class="portal-modal__close" id="closeCreateProjectModal">&times;</button>
          </div>
          <div class="portal-modal__body">
            <div class="portal-form-group">
              <label>${t('aiProject')}</label>
              <input type="text" id="newProjectName" placeholder="${IS_EN ? 'Restaurant in Jeddah' : 'مطعم في جدة'}" />
            </div>
            <div class="portal-form-group">
              <label>${t('aiSector')}</label>
              <input type="text" id="newProjectSector" placeholder="${IS_EN ? 'Restaurant' : 'مطعم'}" />
            </div>
            <div class="portal-form-group">
              <label>${t('aiCity')}</label>
              <input type="text" id="newProjectCity" placeholder="${IS_EN ? 'Jeddah' : 'جدة'}" />
            </div>
            <div class="portal-form-group">
              <label>${t('budget')}</label>
              <input type="number" id="newProjectBudget" placeholder="500000" />
            </div>
          </div>
          <div class="portal-modal__footer">
            <button class="portal-btn portal-btn--outline" id="cancelCreateProject">${t('back')}</button>
            <button class="portal-btn" id="saveCreateProject">${t('createProject')}</button>
          </div>
        </div>
      </div>
    `;

    if (window.initUniversalDropdowns) window.initUniversalDropdowns(main);

    function handleNextAction() {
      if (nextAction.action === 'create-project') {
        openCreateProjectModal();
      } else if (nextAction.action === 'view-reviews') {
        document.getElementById('reviewRequestsSection')?.scrollIntoView({ behavior: 'smooth' });
      } else if (nextAction.action === 'request-review') {
        document.getElementById('aiHistorySection')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        document.getElementById('aiAnalyzerSection')?.scrollIntoView({ behavior: 'smooth' });
      }
    }

    const primaryBtn = document.getElementById('dashboardPrimaryAction');
    if (primaryBtn) primaryBtn.addEventListener('click', handleNextAction);
    const nextActionBtn = document.getElementById('nextActionBtn');
    if (nextActionBtn) nextActionBtn.addEventListener('click', handleNextAction);

    function openCreateProjectModal() {
      const modal = document.getElementById('createProjectModal');
      if (modal) modal.classList.add('open');
    }
    function closeCreateProjectModal() {
      const modal = document.getElementById('createProjectModal');
      if (modal) modal.classList.remove('open');
    }

    document.querySelectorAll('#createProjectBtn, #createProjectBtnEmpty').forEach(function(btn) {
      if (btn) btn.addEventListener('click', openCreateProjectModal);
    });
    document.getElementById('closeCreateProjectModal')?.addEventListener('click', closeCreateProjectModal);
    document.getElementById('cancelCreateProject')?.addEventListener('click', closeCreateProjectModal);
    document.getElementById('saveCreateProject')?.addEventListener('click', async function() {
      const name = document.getElementById('newProjectName').value.trim();
      const sector = document.getElementById('newProjectSector').value.trim();
      const city = document.getElementById('newProjectCity').value.trim();
      const budget = Number(document.getElementById('newProjectBudget').value);
      if (!name) { alert(IS_EN ? 'Project name is required' : 'اسم المشروع مطلوب'); return; }
      const { error } = await createProject(client.id, { name, sector, city, budget });
      if (error) { alert(IS_EN ? 'Failed to create project' : 'فشل إنشاء المشروع'); return; }
      closeCreateProjectModal();
      initDashboard();
    });
    document.getElementById('createProjectModal')?.addEventListener('click', function(e) {
      if (e.target === this) closeCreateProjectModal();
    });

    // Document upload handlers
    const uploadBtn = document.getElementById('docUploadBtn');
    const uploadInput = document.getElementById('docUploadInput');
    const uploadMsg = document.getElementById('docUploadMsg');
    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', function() { uploadInput.click(); });
      uploadInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;
        if (uploadMsg) uploadMsg.textContent = t('analyzing');
        const { data, error } = await uploadDocument(file, client.id);
        if (error || !data) {
          if (uploadMsg) uploadMsg.textContent = t('uploadError');
          console.error('Document upload failed:', error);
          return;
        }
        if (uploadMsg) uploadMsg.textContent = '';
        initDashboard();
      });
    }

    document.querySelectorAll('.doc-download-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const item = this.closest('[data-doc-path]');
        const path = item ? item.dataset.docPath : null;
        if (!path) return;
        const url = await getDocumentDownloadUrl(path);
        if (url) window.open(url, '_blank');
      });
    });

    document.querySelectorAll('.doc-analyze-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const item = this.closest('[data-doc-id]');
        const docId = item ? item.dataset.docId : null;
        const mime = item ? item.dataset.docMime : '';
        const filename = item ? item.dataset.docFilename : '';
        const path = item ? item.dataset.docPath : null;
        if (!docId || !path) return;
        btn.disabled = true;
        btn.textContent = t('analyzing');

        try {
          if (mime && mime.startsWith('image/')) {
            await analyzeImageClientSide(docId, filename, path);
          } else {
            const session = await window.BondsAuth.getSession();
            const token = session?.data?.session?.access_token;
            if (!token) throw new Error('No session');
            const res = await fetch('/api/v3/analyze-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({ documentId: docId })
            });
            if (!res.ok) throw new Error('Analysis failed');
          }
        } catch (e) {
          console.error(e);
          btn.textContent = t('analyze');
          btn.disabled = false;
          return;
        }
        initDashboard();
      });
    });

    attachAiHandlers();

    // AI history handlers
    document.querySelectorAll('.ai-history-view-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const item = this.closest('[data-ai-result]');
        const resultJson = item ? item.dataset.aiResult : '{}';
        const resultEl = document.getElementById('aiResult');
        if (!resultEl) return;
        try {
          const result = JSON.parse(resultJson);
          renderAiResult(resultEl, { result, cached: true, usage: { cost_usd: 0 } });
          resultEl.scrollIntoView({ behavior: 'smooth' });
        } catch (e) {
          console.error('Failed to parse stored AI result', e);
        }
      });
    });

    document.querySelectorAll('.ai-history-review-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const item = this.closest('[data-ai-request-id]');
        const requestId = item ? item.dataset.aiRequestId : null;
        if (!requestId) return;
        btn.disabled = true;
        btn.textContent = '⏳';
        const ok = await requestAiReview(requestId, {});
        btn.textContent = ok ? `✓ ${t('aiReviewRequested')}` : t('aiRequestAgain');
        btn.disabled = ok;
      });
    });
  }
  async function getSessionToken() {
    if (!window.BondsAuth || !window.BondsAuth.getSession) return null;
    const { data } = await window.BondsAuth.getSession();
    return data?.session?.access_token || null;
  }

  function renderAiAnalyzer(client, projects) {
    const projectOptions = projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    const typeOptions = [
      { value: 'feasibility_study', label: IS_EN ? 'Feasibility Study' : 'دراسة جدوى' },
      { value: 'credit_assessment', label: IS_EN ? 'Credit Assessment' : 'تقييم جدارة ائتمانية' },
      { value: 'city_analysis', label: IS_EN ? 'City Analysis' : 'تحليل مدينة' },
      { value: 'distressed_project', label: IS_EN ? 'Distressed Project' : 'مشروع متعثر' }
    ];
    return `
      <div class="portal-section" id="aiAnalyzerSection">
        <div class="portal-section__title">🤖 ${t('aiAnalysis')}</div>
        <div id="aiMsg" class="portal-msg portal-msg--error" style="display:none;"></div>
        <div class="portal-form-group">
          <label>${t('aiType')}</label>
          <select id="aiType" data-universal-dropdown="true">
            ${typeOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="portal-form-group">
          <label>${t('aiProject')}</label>
          <select id="aiProject" data-universal-dropdown="true">
            <option value="">${t('aiNoProject')}</option>
            ${projectOptions}
          </select>
        </div>
        <div class="portal-form-group">
          <label>${t('aiSector')}</label>
          <input type="text" id="aiSector" placeholder="restaurant" />
        </div>
        <div class="portal-form-group">
          <label>${t('aiCity')}</label>
          <input type="text" id="aiCity" placeholder="Jeddah" />
        </div>
        <div class="portal-form-group ai-field--feasibility">
          <label>${t('aiInvestment')}</label>
          <input type="number" id="aiInvestment" placeholder="500000" />
        </div>
        <div class="portal-form-group ai-field--feasibility">
          <label>${t('aiMonthlyRevenue')}</label>
          <input type="number" id="aiMonthlyRevenue" placeholder="120000" />
        </div>
        <div class="portal-form-group ai-field--feasibility">
          <label>${t('aiMonthlyCosts')}</label>
          <input type="number" id="aiMonthlyCosts" placeholder="85000" />
        </div>
        <div class="portal-form-group ai-field--credit" style="display:none;">
          <label>${t('aiAnnualRevenue')}</label>
          <input type="number" id="aiAnnualRevenue" placeholder="1000000" />
        </div>
        <div class="portal-form-group ai-field--credit" style="display:none;">
          <label>${t('aiExistingDebt')}</label>
          <input type="number" id="aiExistingDebt" placeholder="200000" />
        </div>
        <button id="aiRunBtn" class="portal-btn">${t('aiRunAnalysis')}</button>
        <div id="aiResult" style="margin-top:1.5rem;"></div>
      </div>

      ${renderAiHistory(analyses)}
    `;
  }

  function renderAiHistory(analyses) {
    if (!analyses || analyses.length === 0) {
      return `
        <div class="portal-section">
          <div class="portal-section__title">📚 ${t('aiHistory')}</div>
          <div class="portal-empty"><div class="portal-empty__icon">📚</div>${t('aiNoHistory')}</div>
        </div>
      `;
    }
    return `
      <div class="portal-section" id="aiHistorySection">
        <div class="portal-section__title">📚 ${t('aiHistory')}</div>
        <div class="portal-list">
          ${analyses.map(a => {
            const result = (a.ai_results && a.ai_results[0]) ? a.ai_results[0].result : {};
            const risk = result.risk_score ?? '-';
            const date = formatDate(a.created_at);
            const title = typeLabel(a.type);
            return `
              <div class="portal-list__item" data-ai-request-id="${a.id}" data-ai-result='${escapeHtml(JSON.stringify(result))}'>
                <div>
                  <div style="font-weight:700;">${title}</div>
                  <div class="portal-list__meta">${date} · ${t('aiRiskScore')}: ${risk}</div>
                </div>
                <div style="display:flex;gap:0.5rem;">
                  <button class="portal-btn portal-btn--outline ai-history-view-btn">${t('aiViewAnalysis')}</button>
                  <button class="portal-btn portal-btn--outline ai-history-review-btn">${t('aiRequestAgain')}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderAiResult(container, data) {
    const result = data.result || {};
    const risk = Number(result.risk_score) || 0;
    let riskColor = 'var(--success)';
    let riskIcon = '✓';
    if (risk >= 75) { riskColor = 'var(--danger)'; riskIcon = '!' }
    else if (risk >= 50) { riskColor = 'var(--warning)'; riskIcon = '⚠' }
    else if (risk >= 25) { riskColor = 'var(--gold)'; riskIcon = '●' }

    const metrics = result.financial_summary?.key_metrics || [];

    function findMetric(names) {
      for (const name of names) {
        const found = metrics.find(m => String(m.name).toLowerCase().includes(name.toLowerCase()));
        if (found) return found;
      }
      return null;
    }

    const feasibility = findMetric(['جدوى', 'feasibility']);
    const funding = findMetric(['تمويل', 'funding']);
    const expectedReturn = findMetric(['عائد', 'return']);
    const payback = findMetric(['استرداد', 'payback']);

    function metricCard(label, value, sub, colorClass) {
      return `
        <div class="portal-ai-card ${colorClass || ''}">
          <div class="portal-ai-card__label">${label}</div>
          <div class="portal-ai-card__value">${value}</div>
          ${sub ? `<div class="portal-ai-card__sub">${sub}</div>` : ''}
        </div>
      `;
    }

    const topCards = `
      <div class="portal-ai-cards">
        ${metricCard(t('aiRiskScore'), `${risk}<small>/100</small>`, result.risk_level || '', 'ai-card--risk')}
        ${feasibility ? metricCard(t('aiFeasibilityScore'), `${feasibility.value}<small>/100</small>`, '', 'ai-card--success') : ''}
        ${funding ? metricCard(t('aiFundingReadiness'), funding.value, '', 'ai-card--info') : ''}
        ${expectedReturn ? metricCard(t('aiExpectedReturn'), expectedReturn.value, '', 'ai-card--success') : ''}
        ${payback ? metricCard(t('aiPaybackPeriod'), payback.value, '', 'ai-card--info') : ''}
        ${metricCard(t('aiConfidence'), `${result.confidence ?? '-'}<small>%</small>`, '', '')}
      </div>
    `;

    const strengths = result.strengths || [];
    const weaknesses = result.weaknesses || [];
    const recommendations = result.recommendations || [];

    const listHtml = (items, icon) => items.length ? `
      <ul class="portal-ai-list">
        ${items.map(item => `<li><span class="portal-ai-list__icon">${icon}</span>${escapeHtml(item)}</li>`).join('')}
      </ul>
    ` : `<div class="portal-empty" style="padding:1rem;">${IS_EN ? 'No items returned.' : 'لا توجد عناصر.'}</div>`;

    const metricsTable = metrics.length ? `
      <table class="portal-ai-table">
        <thead><tr><th>${IS_EN ? 'Indicator' : 'المؤشر'}</th><th>${IS_EN ? 'Value' : 'القيمة'}</th><th>${IS_EN ? 'Confidence' : 'الثقة'}</th></tr></thead>
        <tbody>
          ${metrics.map(m => `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(String(m.value))}</td><td>${m.confidence ?? '-'}%</td></tr>`).join('')}
        </tbody>
      </table>
    ` : '';

    const cachedBadge = data.cached ? `<span class="portal-status portal-status--approved">${t('aiCached')}</span>` : '';
    const costBadge = data.usage?.cost_usd ? `<span class="portal-status portal-status--info">${t('aiCost')}: $${data.usage.cost_usd.toFixed(4)}</span>` : '';

    container.innerHTML = `
      <div class="portal-ai-result" id="aiResultBox" data-request-id="${data.request_id || ''}">
        <div class="portal-ai-result__badges">
          ${cachedBadge}
          ${costBadge}
        </div>

        <div class="portal-ai-gauge">
          <div class="portal-ai-gauge__ring" style="--risk-color: ${riskColor}; --risk: ${risk};">
            <div class="portal-ai-gauge__value" style="color:${riskColor};">${riskIcon}<br>${risk}<small>/100</small></div>
          </div>
          <div class="portal-ai-gauge__label">${t('aiRiskLevel')}: <strong>${escapeHtml(result.risk_level || '-')}</strong></div>
        </div>

        ${topCards}

        <div class="portal-ai-block">
          <div class="portal-section__title" style="margin-top:0;">${t('aiExecutiveSummary')}</div>
          <div class="portal-ai-summary">${escapeHtml(result.executive_summary || result.analysis || '')}</div>
        </div>

        <div class="portal-ai-columns">
          <div class="portal-ai-block">
            <div class="portal-section__title" style="margin-top:0;">${t('aiStrengths')}</div>
            ${listHtml(strengths, '✓')}
          </div>
          <div class="portal-ai-block">
            <div class="portal-section__title" style="margin-top:0;">${t('aiWeaknesses')}</div>
            ${listHtml(weaknesses, '⚠')}
          </div>
        </div>

        <div class="portal-ai-block">
          <div class="portal-section__title" style="margin-top:0;">${t('aiRecommendations')}</div>
          ${listHtml(recommendations, '→')}
        </div>

        ${metricsTable ? `<div class="portal-ai-block">
          <div class="portal-section__title" style="margin-top:0;">${t('aiFinancialSummary')}</div>
          ${metricsTable}
        </div>` : ''}

        <div class="portal-ai-actions">
          <button id="aiDownloadReportBtn" class="portal-btn portal-btn--outline">📄 ${t('aiDownloadReport')}</button>
          <button id="aiRequestReviewBtn" class="portal-btn">👨‍💼 ${t('aiRequestReview')}</button>
        </div>
      </div>
    `;

    const downloadBtn = container.querySelector('#aiDownloadReportBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => downloadAiReport(data));
    }

    const reviewBtn = container.querySelector('#aiRequestReviewBtn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', async () => {
        reviewBtn.disabled = true;
        reviewBtn.textContent = '⏳ ...';
        const ok = await requestAiReview(data.request_id, result);
        reviewBtn.textContent = ok ? `✓ ${t('aiReviewRequested')}` : t('aiRequestReview');
        reviewBtn.disabled = !ok;
      });
    }
  }

  function downloadAiReport(data) {
    const result = data.result || {};
    const risk = Number(result.risk_score) || 0;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const metrics = result.financial_summary?.key_metrics || [];
    const metricsRows = metrics.map(m => `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(String(m.value))}</td><td>${m.confidence ?? '-'}%</td></tr>`).join('');
    const recommendations = (result.recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');
    const strengths = (result.strengths || []).map(s => `<li>✓ ${escapeHtml(s)}</li>`).join('');
    const weaknesses = (result.weaknesses || []).map(w => `<li>⚠ ${escapeHtml(w)}</li>`).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="${LANG}" dir="${IS_EN ? 'ltr' : 'rtl'}">
      <head>
        <meta charset="UTF-8" />
        <title>${IS_EN ? 'Bonds Executive Report' : 'التقرير التنفيذي - بوندز'}</title>
        <style>
          body { font-family: 'Vazirmatn', 'Inter', system-ui, sans-serif; margin: 2rem; color: #1a1a1a; line-height: 1.7; }
          h1 { color: #0a0f1a; border-bottom: 3px solid #d4a853; padding-bottom: 0.5rem; }
          h2 { color: #0a0f1a; margin-top: 1.5rem; }
          .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
          .risk-box { background: #f8f4e8; border-right: 5px solid #d4a853; padding: 1rem; margin: 1rem 0; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { padding: 0.75rem; border-bottom: 1px solid #ddd; text-align: start; }
          th { background: #f4f4f4; }
          ul { line-height: 1.9; }
          @media print { body { margin: 1cm; } button { display: none; } }
        </style>
      </head>
      <body>
        <h1>${IS_EN ? 'Bonds Executive Report' : 'التقرير التنفيذي - بوندز'}</h1>
        <div class="meta">${new Date().toLocaleDateString(IS_EN ? 'en-GB' : 'ar-SA')}</div>
        <div class="risk-box">
          <strong>${t('aiRiskScore')}:</strong> ${risk}/100 — ${escapeHtml(result.risk_level || '')}<br>
          <strong>${t('aiConfidence')}:</strong> ${result.confidence ?? '-'}%
        </div>
        <h2>${t('aiExecutiveSummary')}</h2>
        <p>${escapeHtml(result.executive_summary || result.analysis || '')}</p>
        <h2>${t('aiStrengths')}</h2>
        <ul>${strengths || '<li>-</li>'}</ul>
        <h2>${t('aiWeaknesses')}</h2>
        <ul>${weaknesses || '<li>-</li>'}</ul>
        <h2>${t('aiRecommendations')}</h2>
        <ul>${recommendations || '<li>-</li>'}</ul>
        ${metricsRows ? `<h2>${t('aiFinancialSummary')}</h2><table><thead><tr><th>${IS_EN ? 'Indicator' : 'المؤشر'}</th><th>${IS_EN ? 'Value' : 'القيمة'}</th><th>${IS_EN ? 'Confidence' : 'الثقة'}</th></tr></thead><tbody>${metricsRows}</tbody></table>` : ''}
        <button onclick="window.print()" style="margin-top:2rem;padding:0.75rem 1.5rem;background:#d4a853;border:none;border-radius:8px;cursor:pointer;font-weight:700;">${IS_EN ? 'Print / Save as PDF' : 'طباعة / حفظ PDF'}</button>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  async function requestAiReview(requestId, result) {
    if (!requestId) {
      alert(IS_EN ? 'Analysis request not saved yet.' : 'لم يتم حفظ طلب التحليل بعد.');
      return false;
    }
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/v3/ai/request-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ requestId, note: IS_EN ? 'Client requested expert review' : 'العميل طلب مراجعة استشارية' })
      });
      if (!res.ok) throw new Error('Request failed');
      return true;
    } catch (err) {
      console.error('[ai/request-review]', err);
      return false;
    }
  }

  async function attachAiHandlers() {
    const typeSelect = document.getElementById('aiType');
    if (!typeSelect) return;

    function toggleFields() {
      const type = typeSelect.value;
      document.querySelectorAll('.ai-field--feasibility').forEach(el => {
        el.style.display = type === 'feasibility_study' ? 'block' : 'none';
      });
      document.querySelectorAll('.ai-field--credit').forEach(el => {
        el.style.display = type === 'credit_assessment' ? 'block' : 'none';
      });
    }
    typeSelect.addEventListener('change', toggleFields);
    toggleFields();

    const projectSelect = document.getElementById('aiProject');
    if (projectSelect) {
      projectSelect.addEventListener('change', async function() {
        const pid = this.value;
        if (!pid) return;
        const { data } = await loadProjectDetails(pid);
        if (!data) return;

        const project = data.project || {};
        const feas = data.feasibility || {};
        const fin = (data.financialModels || [])[0] || {};
        const financials = feas.financials || fin.projections || {};

        const sectorInput = document.getElementById('aiSector');
        const cityInput = document.getElementById('aiCity');
        const investmentInput = document.getElementById('aiInvestment');
        const revenueInput = document.getElementById('aiMonthlyRevenue');
        const costsInput = document.getElementById('aiMonthlyCosts');

        if (sectorInput) sectorInput.value = project.sector || feas.sector || sectorInput.value;
        if (cityInput) cityInput.value = project.city || feas.country || cityInput.value;
        if (investmentInput) investmentInput.value = financials.investment || project.budget || investmentInput.value;
        if (revenueInput) revenueInput.value = financials.monthly_revenue || project.monthly_revenue || revenueInput.value;
        if (costsInput) costsInput.value = financials.monthly_costs || project.monthly_costs || costsInput.value;
      });
    }

    const runBtn = document.getElementById('aiRunBtn');
    runBtn.addEventListener('click', async function() {
      const type = typeSelect.value;
      const projectId = document.getElementById('aiProject').value || undefined;
      const sector = document.getElementById('aiSector').value.trim();
      const city = document.getElementById('aiCity').value.trim();

      let payload = { sector, city };
      if (type === 'feasibility_study') {
        payload.investment = Number(document.getElementById('aiInvestment').value);
        payload.monthly_revenue = Number(document.getElementById('aiMonthlyRevenue').value);
        payload.monthly_costs = Number(document.getElementById('aiMonthlyCosts').value);
      } else if (type === 'credit_assessment') {
        payload.entity_name = sector || (IS_EN ? 'Unnamed entity' : 'جهة غير مسماة');
        payload.annual_revenue = Number(document.getElementById('aiAnnualRevenue').value);
        payload.existing_debt = Number(document.getElementById('aiExistingDebt').value);
      } else if (type === 'distressed_project') {
        payload.project_name = sector || (IS_EN ? 'Unnamed project' : 'مشروع غير مسماة');
        payload.current_status = city || (IS_EN ? 'Unknown' : 'غير معروف');
        payload.distress_reasons = [];
      }

      const msgEl = document.getElementById('aiMsg');
      const resultEl = document.getElementById('aiResult');
      msgEl.style.display = 'none';
      resultEl.innerHTML = `<div class="portal-empty"><div class="portal-empty__icon">⏳</div>${t('aiAnalyzing')}</div>`;
      runBtn.disabled = true;
      runBtn.textContent = t('aiAnalyzing');

      try {
        const token = await getSessionToken();
        if (!token) throw new Error(IS_EN ? 'Not authenticated' : 'لم يتم تسجيل الدخول');
        const res = await fetch('/api/v3/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ type, projectId, payload })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || (IS_EN ? 'Analysis failed' : 'فشل التحليل'));
        }
        renderAiResult(resultEl, data);
      } catch (err) {
        msgEl.textContent = t('aiError') + ' ' + err.message;
        msgEl.style.display = 'block';
        resultEl.innerHTML = '';
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = t('aiRunAnalysis');
      }
    });
  }

  async function analyzeImageClientSide(docId, filename, storagePath) {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase not initialized');
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract not loaded');

    const url = await getDocumentDownloadUrl(storagePath);
    if (!url) throw new Error('Could not get image URL');

    const result = await Tesseract.recognize(url, 'ara+eng', { logger: function(){} });
    const text = result?.data?.text || '';

    const extracted = {
      mime: 'image/*',
      text: text,
      rows: null,
      summary: text ? `تم استخراج ${text.length} حرف من الصورة` : 'لم يُستخرج نص من الصورة',
      method: 'tesseract-ocr'
    };

    const { error } = await sb.from('client_documents').update({
      status: 'analyzed',
      extracted_data: extracted
    }).eq('id', docId);

    if (error) throw error;
  }

  function renderReportsList(reports) {
    const main = document.getElementById('portal-main');
    if (!main) return;
    main.innerHTML = `
      <h1 class="portal-page-title">${t('reports')}</h1>
      <p class="portal-page-subtitle"><a class="portal-link" href="${IS_EN ? clientPath('index.html') : clientPath('index.html')}">← ${t('back')}</a></p>
      ${reports.length === 0 ? `
        <div class="portal-empty"><div class="portal-empty__icon">📄</div>${t('noReports')}</div>
      ` : `
        <div class="portal-list">
          ${reports.map(r => `
            <div class="portal-list__item">
              <div>
                <div style="font-weight:700;">${r.title}</div>
                <div class="portal-list__meta">${t('date')}: ${formatDate(r.created_at)}</div>
              </div>
              <a class="portal-btn portal-btn--outline" href="${IS_EN ? clientPath('report.html?id=' + r.id) : clientPath('report.html?id=' + r.id)}">${t('viewReport')}</a>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function renderReport(report) {
    const main = document.getElementById('portal-main');
    if (!main) return;
    main.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <div>
          <h1 class="portal-page-title" style="margin-bottom:0.25rem;">${report.title}</h1>
          <p class="portal-page-subtitle" style="margin:0;">${t('date')}: ${formatDate(report.created_at)}</p>
        </div>
        <div style="display:flex;gap:0.75rem;">
          <a class="portal-btn portal-btn--outline" href="${clientPath('index.html')}">${t('back')}</a>
          <button class="portal-btn" onclick="window.print()">🖨️ ${t('print')}</button>
        </div>
      </div>
      <div class="portal-report">${report.content_html || '<p>' + t('notFound') + '</p>'}</div>
    `;
  }


  function renderProjectDetail(project, details, analyses, reviewRequests, documents, reports) {
    const main = document.getElementById('portal-main');
    if (!main) return;
    const projectAnalyses = analyses.filter(a => a.project_id === project.id);
    const projectReviewRequests = reviewRequests.filter(r => {
      const req = r.ai_requests || {};
      return req.project_id === project.id;
    });
    const projectDocs = documents.filter(d => d.project_id === project.id);
    const latestAnalysis = projectAnalyses[0];
    const latestResult = latestAnalysis?.ai_results?.result || {};
    const decision = latestResult.risk_score !== undefined ? decisionFromResult(latestResult) : null;
    const actionPlan = latestResult.recommendations ? actionPlanFromResult(latestResult) : [];

    main.innerHTML = `
      <div class="portal-page-header">
        <div>
          <h1 class="portal-page-title">${escapeHtml(project.name)}</h1>
          <p class="portal-page-subtitle">${escapeHtml(project.sector || '')} ${project.city ? '· ' + escapeHtml(project.city) : ''}</p>
        </div>
        <a class="portal-btn portal-btn--outline" href="${clientPath('index.html')}">${t('backToDashboard')}</a>
      </div>

      <div class="portal-project-summary">
        <div class="portal-project-summary__stats">
          <div class="portal-stat-card">
            <div class="portal-stat-card__label">${t('status')}</div>
            <div class="portal-stat-card__value"><span class="portal-status ${statusClass(project.status)}">${project.status || 'new'}</span></div>
          </div>
          <div class="portal-stat-card">
            <div class="portal-stat-card__label">${t('budget')}</div>
            <div class="portal-stat-card__value">${project.budget || '-'}</div>
          </div>
          <div class="portal-stat-card">
            <div class="portal-stat-card__label">${t('latestUpdate')}</div>
            <div class="portal-stat-card__value">${formatDate(project.updated_at || project.created_at)}</div>
          </div>
        </div>
        ${decision ? `
        <div class="portal-decision ${decision.class}">
          <div class="portal-decision__title">${decision.text}</div>
          <div class="portal-decision__rec">${decision.recommendation}</div>
        </div>
        ` : ''}
      </div>

      <section class="portal-section">
        <div class="portal-section__header">
          <div class="portal-section__title">${t('projectData')}</div>
        </div>
        <div class="portal-detail-grid">
          <div class="portal-detail-item"><strong>${t('aiSector')}:</strong> ${project.sector || '-'}</div>
          <div class="portal-detail-item"><strong>${t('aiCity')}:</strong> ${project.city || '-'}</div>
          <div class="portal-detail-item"><strong>${t('budget')}:</strong> ${project.budget || '-'}</div>
          <div class="portal-detail-item"><strong>${t('aiMonthlyRevenue')}:</strong> ${project.monthly_revenue || '-'}</div>
          <div class="portal-detail-item"><strong>${t('aiMonthlyCosts')}:</strong> ${project.monthly_costs || '-'}</div>
          <div class="portal-detail-item"><strong>${t('date')}:</strong> ${formatDate(project.created_at)}</div>
        </div>
      </section>

      ${actionPlan.length ? `
      <section class="portal-section">
        <div class="portal-section__title">${t('actionPlan')}</div>
        <div class="portal-action-plan">
          ${actionPlan.map(s => `
            <div class="portal-action-plan__item">
              <div class="portal-action-plan__week">${s.week}</div>
              <div class="portal-action-plan__task">${escapeHtml(s.task)}</div>
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}

      <section class="portal-section">
        <div class="portal-section__header">
          <div class="portal-section__title">${t('projectAnalyses')}</div>
          <a class="portal-btn portal-btn--outline portal-btn--sm" href="${clientPath('index.html#aiAnalyzerSection')}">${t('analyzeProject')}</a>
        </div>
        ${projectAnalyses.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">🧠</div>${t('noAnalyses')}</div>
        ` : `
          <div class="portal-list">
            ${projectAnalyses.map(a => {
              const result = a.ai_results?.result || {};
              return `
                <div class="portal-list__item" data-ai-request-id="${a.id}" data-ai-result='${escapeHtml(JSON.stringify(result))}'>
                  <div>
                    <div style="font-weight:700;">${typeLabel(a.type)}</div>
                    <div class="portal-list__meta">${formatDate(a.created_at)} · ${t('aiRiskScore')}: ${result.risk_score ?? '-'}</div>
                  </div>
                  <div style="display:flex;gap:0.5rem;">
                    <button class="portal-btn portal-btn--outline ai-history-view-btn">${t('aiViewAnalysis')}</button>
                    <button class="portal-btn portal-btn--outline ai-history-review-btn">${t('aiRequestAgain')}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>

      <section class="portal-section">
        <div class="portal-section__title">${t('projectReviewRequests')}</div>
        ${projectReviewRequests.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">👨‍💼</div>${t('noReviews')}</div>
        ` : `
          <div class="portal-list">
            ${projectReviewRequests.map(r => {
              const req = r.ai_requests || {};
              return `
                <div class="portal-list__item">
                  <div>
                    <div style="font-weight:700;">${typeLabel(req.type) || '-'}</div>
                    <div class="portal-list__meta">${formatDate(r.created_at)} · ${t('reviewStatus')}: <span class="portal-status ${statusClass(r.status)}">${reviewStatusLabel(r.status)}</span></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>

      <section class="portal-section">
        <div class="portal-section__title">${t('projectDocuments')}</div>
        ${projectDocs.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">📎</div>${t('noDocuments')}</div>
        ` : `
          <div class="portal-list">
            ${projectDocs.map(d => `
              <div class="portal-list__item">
                <div>
                  <div style="font-weight:700;">${escapeHtml(d.filename)}</div>
                  <div class="portal-list__meta">${formatDate(d.created_at)} · ${d.status}</div>
                </div>
                <button class="portal-btn portal-btn--outline doc-download-btn" data-doc-path="${d.storage_path}">${t('download')}</button>
              </div>
            `).join('')}
          </div>
        `}
      </section>

      <section class="portal-section">
        <div class="portal-section__title">${t('projectReports')}</div>
        ${reports.length === 0 ? `
          <div class="portal-empty"><div class="portal-empty__icon">📄</div>${t('noReports')}</div>
        ` : `
          <div class="portal-list">
            ${reports.map(r => `
              <div class="portal-list__item">
                <div>
                  <div style="font-weight:700;">${r.title}</div>
                  <div class="portal-list__meta">${formatDate(r.created_at)}</div>
                </div>
                <a class="portal-btn portal-btn--outline" href="${clientPath('report.html?id=' + r.id)}">${t('viewReport')}</a>
              </div>
            `).join('')}
          </div>
        `}
      </section>
    `;

    document.querySelectorAll('.ai-history-view-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const item = this.closest('[data-ai-result]');
        const resultJson = item ? item.dataset.aiResult : '{}';
        const resultEl = document.createElement('div');
        resultEl.className = 'portal-section portal-ai-result-inline';
        resultEl.style.marginTop = '1rem';
        const parent = item.parentElement;
        const existing = parent.nextElementSibling;
        if (existing && existing.classList.contains('portal-ai-result-inline')) existing.remove();
        parent.after(resultEl);
        try {
          const result = JSON.parse(resultJson);
          renderAiResult(resultEl, { result, cached: true, usage: { cost_usd: 0 } });
        } catch (e) {
          console.error('Failed to parse stored AI result', e);
        }
      });
    });

    document.querySelectorAll('.ai-history-review-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const item = this.closest('[data-ai-request-id]');
        const requestId = item ? item.dataset.aiRequestId : null;
        if (!requestId) return;
        btn.disabled = true;
        btn.textContent = '⏳';
        const ok = await requestAiReview(requestId, {});
        btn.textContent = ok ? `✓ ${t('aiReviewRequested')}` : t('aiRequestAgain');
        btn.disabled = ok;
      });
    });

    document.querySelectorAll('.doc-download-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const path = btn.dataset.docPath;
        if (!path) return;
        const url = await getDocumentDownloadUrl(path);
        if (url) window.open(url, '_blank');
      });
    });
  }

  async function initProject() {
    showLoading('portal-main');
    const user = await requireAuth();
    if (!user) return;
    injectHeader(user);
    injectSidebar();

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    if (!projectId) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${t('notFound')}</div>`;
      return;
    }

    const { data: client, error: clientErr } = await loadClient(user);
    if (clientErr || !client) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${clientErr ? t('errorLoading') : t('noClientRecord')}</div>`;
      return;
    }

    const [{ data: details, error: projectErr }, { data: analyses }, { data: reviewRequests }, { data: documents }, { data: reports }] = await Promise.all([
      loadProjectDetails(projectId),
      loadAiAnalyses(user.id),
      loadAiReviewRequests(user.id),
      loadDocuments(client.id),
      loadReports(client.id)
    ]);

    if (projectErr || !details || !details.project) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${t('notFound')}</div>`;
      console.error(projectErr);
      return;
    }

    renderProjectDetail(details.project, details, analyses || [], reviewRequests || [], documents || [], reports || []);
  }
  async function initDashboard() {
    showLoading('portal-main');
    const user = await requireAuth();
    if (!user) return;
    injectHeader(user);
    injectSidebar();

    const { data: client, error: clientErr } = await loadClient(user);
    if (clientErr) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${t('errorLoading')}</div>`;
      console.error(clientErr);
      return;
    }
    if (!client) {
      document.getElementById('portal-main').innerHTML = `
        <div class="portal-alert portal-alert--info">
          <div style="font-weight:700;margin-bottom:0.5rem;">${t('noClientRecord')}</div>
          <a class="portal-link" href="${IS_EN ? '/en/contact.html' : '/contact.html'}">${t('contactUs')}</a>
        </div>
      `;
      return;
    }

    const [{ data: projects, error: projectsErr }, { data: reports }, { data: documents }, { data: analyses }, { data: reviewRequests }] = await Promise.all([
      loadProjects(client.id),
      loadReports(client.id),
      loadDocuments(client.id),
      loadAiAnalyses(user.id),
      loadAiReviewRequests(user.id)
    ]);
    if (projectsErr) console.error('Projects load error:', projectsErr);
    const projectList = projects || [];
    const projectIds = projectList.map(p => p.id);
    const { data: workflows } = await loadWorkflows(projectIds);
    const workflowsMap = {};
    (workflows || []).forEach(w => { workflowsMap[w.entity_id] = w; });
    renderDashboard(client, projectList, reports || [], workflowsMap, documents || [], analyses || [], reviewRequests || []);
  }

  async function initReports() {
    showLoading('portal-main');
    const user = await requireAuth();
    if (!user) return;
    injectHeader(user);
    injectSidebar();

    const { data: client, error: clientErr } = await loadClient(user);
    if (clientErr || !client) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${clientErr ? t('errorLoading') : t('noClientRecord')}</div>`;
      return;
    }
    const { data: reports } = await loadReports(client.id);
    renderReportsList(reports || []);
  }

  async function initReportView() {
    showLoading('portal-main');
    const user = await requireAuth();
    if (!user) return;
    injectHeader(user);
    injectSidebar();

    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('id');
    if (!reportId) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${t('notFound')}</div>`;
      return;
    }

    const sb = getSupabase();
    const { data: report, error } = await sb
      .from('ai_advisor_reports')
      .select('*, advisory_clients!inner(auth_user_id)')
      .eq('id', reportId)
      .maybeSingle();

    if (error || !report) {
      document.getElementById('portal-main').innerHTML = `<div class="portal-alert">${t('notFound')}</div>`;
      console.error(error);
      return;
    }
    renderReport(report);
  }

  async function logout() {
    if (window.BondsAuth && window.BondsAuth.signOut) {
      await window.BondsAuth.signOut();
    }
    window.location.href = clientPath('login.html');
  }

  window.BondsClientPortal = {
    initDashboard,
    initReports,
    initReportView,
    initProject,
    logout,
    t
  };
})();
