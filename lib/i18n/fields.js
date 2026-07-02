/**
 * BONDS Unified Field Dictionary
 *
 * Central source of truth for field labels, help text, and mappings.
 * Used by Client Portal V2, V3 project views, and all future UIs.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BONDS_FIELDS = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const fields = {
    project_name: {
      id: 'project_name',
      ar: 'اسم المشروع',
      en: 'Project Name',
      help_ar: 'الاسم التجاري للمشروع كما سيظهر في التقارير.',
      help_en: 'The commercial name of the project as it appears in reports.',
      table: 'bonds_projects',
      column: 'name'
    },
    sector: {
      id: 'sector',
      ar: 'القطاع',
      en: 'Sector',
      help_ar: 'القطاع الاقتصادي الرئيسي للمشروع.',
      help_en: 'The main economic sector of the project.',
      table: 'bonds_projects',
      column: 'sector'
    },
    activity: {
      id: 'activity',
      ar: 'النشاط',
      en: 'Activity',
      help_ar: 'النشاط التفصيلي ضمن القطاع.',
      help_en: 'The detailed activity within the sector.',
      table: 'bonds_projects',
      column: 'activity'
    },
    country: {
      id: 'country',
      ar: 'الدولة',
      en: 'Country',
      help_ar: 'دولة تنفيذ المشروع.',
      help_en: 'The country where the project is executed.',
      table: 'cities',
      column: 'country_code'
    },
    city: {
      id: 'city',
      ar: 'المدينة',
      en: 'City',
      help_ar: 'المدينة التي سيتم فيها إقامة المشروع.',
      help_en: 'The city where the project will be established.',
      table: 'bonds_projects',
      column: 'city_id'
    },
    currency: {
      id: 'currency',
      ar: 'العملة',
      en: 'Currency',
      help_ar: 'عملة المشروع الافتراضية.',
      help_en: 'The default project currency.',
      table: 'bonds_projects',
      column: 'currency'
    },
    capital: {
      id: 'capital',
      ar: 'رأس المال الاستثماري',
      en: 'Investment Capital',
      help_ar: 'إجمالي الاستثمار الأولي المطلوب لتنفيذ المشروع.',
      help_en: 'Total initial investment required to execute the project.',
      table: 'bonds_projects',
      column: 'capital'
    },
    annual_revenue: {
      id: 'annual_revenue',
      ar: 'الإيرادات السنوية',
      en: 'Annual Revenue',
      help_ar: 'إجمالي الإيرادات المتوقعة سنوياً.',
      help_en: 'Total expected revenue per year.',
      table: 'bonds_projects',
      column: 'revenue'
    },
    annual_net_profit: {
      id: 'annual_net_profit',
      ar: 'صافي الربح السنوي',
      en: 'Annual Net Profit',
      help_ar: 'صافي الربح المتوقع سنوياً بعد جميع التكاليف.',
      help_en: 'Expected net profit per year after all costs.',
      table: 'bonds_projects',
      column: 'annual_profit'
    },
    projection_horizon: {
      id: 'projection_horizon',
      ar: 'أفق التوقعات',
      en: 'Projection Horizon',
      help_ar: 'عدد السنوات التي يتم توقعها في التحليل.',
      help_en: 'Number of years projected in the analysis.',
      table: 'bonds_projects',
      column: 'metadata'
    },
    revenue_growth_rate: {
      id: 'revenue_growth_rate',
      ar: 'معدل نمو الإيرادات',
      en: 'Revenue Growth Rate',
      help_ar: 'النسبة السنوية المتوقعة لنمو الإيرادات.',
      help_en: 'Expected annual percentage growth of revenue.',
      table: 'bonds_projects',
      column: 'metadata'
    },
    required_rate_of_return: {
      id: 'required_rate_of_return',
      ar: 'معدل العائد المطلوب',
      en: 'Required Rate of Return',
      help_ar: 'العائد المطلوب من المستثمر لتبرير المخاطرة.',
      help_en: 'The return an investor requires to justify the risk.',
      table: 'bonds_projects',
      column: 'metadata'
    },
    dscr: {
      id: 'dscr',
      ar: 'نسبة تغطية خدمة الدين (DSCR)',
      en: 'Debt Service Coverage Ratio (DSCR)',
      help_ar: 'قدرة المشروع على سداد أقساط الديون من الأرباح.',
      help_en: 'The project ability to cover debt payments from earnings.',
      table: 'bonds_financing',
      column: 'dscr'
    },
    npv: {
      id: 'npv',
      ar: 'القيمة الحالية الصافية (NPV)',
      en: 'Net Present Value (NPV)',
      help_ar: 'القيمة الحالية للتدفقات النقدية المستقبلية مطروحاً منها الاستثمار.',
      help_en: 'Present value of future cash flows minus the investment.',
      table: 'bonds_valuations',
      column: 'npv'
    },
    irr: {
      id: 'irr',
      ar: 'معدل العائد الداخلي (IRR)',
      en: 'Internal Rate of Return (IRR)',
      help_ar: 'معدل الخصم الذي يجعل القيمة الحالية الصافية تساوي صفر.',
      help_en: 'The discount rate that makes the net present value zero.',
      table: 'bonds_valuations',
      column: 'irr'
    },
    roi: {
      id: 'roi',
      ar: 'العائد على الاستثمار (ROI)',
      en: 'Return on Investment (ROI)',
      help_ar: 'نسبة الربح إلى حجم الاستثمار.',
      help_en: 'Profit ratio relative to the investment size.',
      table: 'bonds_valuations',
      column: 'roi'
    },
    wacc: {
      id: 'wacc',
      ar: 'متوسط تكلفة رأس المال (WACC)',
      en: 'Weighted Average Cost of Capital (WACC)',
      help_ar: 'متوسط تكلفة التمويل من مصادرها المختلفة.',
      help_en: 'Average cost of capital from its different sources.',
      table: 'bonds_financing',
      column: 'wacc'
    },
    payback_period: {
      id: 'payback_period',
      ar: 'مدة الاسترداد',
      en: 'Payback Period',
      help_ar: 'المدة المتوقعة لاسترداد رأس المال المستثمر.',
      help_en: 'Expected time to recover the invested capital.',
      table: 'bonds_valuations',
      column: 'payback_period'
    },
    readiness_score: {
      id: 'readiness_score',
      ar: 'درجة جاهزية الاستثمار',
      en: 'Investment Readiness Score',
      help_ar: 'تقييم مدى جاهزية المشروع للعرض على المستثمرين.',
      help_en: 'Assessment of how ready the project is for investors.',
      table: 'investment_readiness_scores',
      column: 'readiness_score'
    },
    confidence: {
      id: 'confidence',
      ar: 'درجة الثقة',
      en: 'Confidence Score',
      help_ar: 'مدى موثوقية البيانات والتحليلات المعتمدة.',
      help_en: 'Reliability of the underlying data and analyses.',
      table: null,
      column: null
    },
    risk_level: {
      id: 'risk_level',
      ar: 'مستوى المخاطر',
      en: 'Risk Level',
      help_ar: 'تقييم المخاطر المحيطة بالمشروع.',
      help_en: 'Risk assessment surrounding the project.',
      table: null,
      column: null
    },
    project_stage: {
      id: 'project_stage',
      ar: 'مرحلة المشروع',
      en: 'Project Stage',
      help_ar: 'المرحلة الحالية في دورة حياة المشروع.',
      help_en: 'Current stage in the project lifecycle.',
      table: 'enterprise_lifecycle_instances',
      column: 'current_stage'
    }
  };

  function get(id, lang) {
    lang = lang || (typeof window !== 'undefined' && window.__PORTAL_LANG) || 'ar';
    const field = fields[id];
    if (!field) return { label: id, help: '', id };
    return {
      label: field[lang] || field.ar || id,
      help: field['help_' + lang] || field.help_ar || '',
      table: field.table,
      column: field.column,
      id: field.id
    };
  }

  function label(id, lang) {
    return get(id, lang).label;
  }

  function help(id, lang) {
    return get(id, lang).help;
  }

  return {
    fields,
    get,
    label,
    help
  };
}));
