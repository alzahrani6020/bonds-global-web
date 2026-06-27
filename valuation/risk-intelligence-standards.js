/**
 * BONDS Risk Intelligence Standards
 *
 * Catalog of risk factors across 8 risk dimensions for 35 asset classes.
 * Used by BondsRiskIntelligenceEngine to compute a normalized Risk Index.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BondsRiskIntelligenceStandards = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATEGORIES = [
    {
      id: 'asset',
      labelAr: 'مخاطر الأصل',
      labelEn: 'Asset Risk',
      defaultWeight: 0.18,
      mitigations: {
        ar: ['إجراء فحص تقني شامل', 'تحديث سجلات الصيانة', 'تطوير خطة إحلال/تجديد'],
        en: ['Perform a full technical inspection', 'Update maintenance records', 'Develop replacement/renewal plan']
      }
    },
    {
      id: 'market',
      labelAr: 'مخاطر السوق',
      labelEn: 'Market Risk',
      defaultWeight: 0.16,
      mitigations: {
        ar: ['تنويع قاعدة العملاء', 'مراقبة مؤشرات الطلب والعرض', 'تطوير استراتيجية تسعير مرنة'],
        en: ['Diversify customer base', 'Monitor demand/supply indicators', 'Develop flexible pricing strategy']
      }
    },
    {
      id: 'operational',
      labelAr: 'مخاطر التشغيل',
      labelEn: 'Operational Risk',
      defaultWeight: 0.14,
      mitigations: {
        ar: ['تحسين إجراءات التشغيل', 'تدريب الفريق', 'تقليل أوقات التوقف'],
        en: ['Improve operating procedures', 'Train the team', 'Reduce downtime']
      }
    },
    {
      id: 'management',
      labelAr: 'مخاطر الإدارة',
      labelEn: 'Management Risk',
      defaultWeight: 0.12,
      mitigations: {
        ar: ['توثيق السياسات والإجراءات', 'بناء فريق إداري احتياطي', 'تحسين الحوكمة'],
        en: ['Document policies and procedures', 'Build backup management team', 'Improve governance']
      }
    },
    {
      id: 'legal',
      labelAr: 'المخاطر القانونية',
      labelEn: 'Legal Risk',
      defaultWeight: 0.12,
      mitigations: {
        ar: ['مراجعة التراخيص والعقود', 'الاستعانة بمستشار قانوني', 'متابعة التغييرات التنظيمية'],
        en: ['Review licenses and contracts', 'Engage legal counsel', 'Track regulatory changes']
      }
    },
    {
      id: 'environmental',
      labelAr: 'المخاطر البيئية',
      labelEn: 'Environmental Risk',
      defaultWeight: 0.10,
      mitigations: {
        ar: ['تدقيق استهلاك الطاقة والمياه', 'إدارة النفايات بشكل مسؤول', 'الحصول على شهادات بيئية'],
        en: ['Audit energy and water usage', 'Manage waste responsibly', 'Obtain environmental certifications']
      }
    },
    {
      id: 'technological',
      labelAr: 'المخاطر التقنية',
      labelEn: 'Technological Risk',
      defaultWeight: 0.10,
      mitigations: {
        ar: ['تحديث الأنظمة والبرمجيات', 'تطبيق إجراءات الأمن السيبراني', 'وضع خطة استمرار تقني'],
        en: ['Update systems and software', 'Implement cybersecurity measures', 'Create technical continuity plan']
      }
    },
    {
      id: 'future',
      labelAr: 'المخاطر المستقبلية',
      labelEn: 'Future Risk',
      defaultWeight: 0.08,
      mitigations: {
        ar: ['تخطيط السيناريوهات', 'مراقبة التوجهات التنظيمية والتقنية', 'بناء احتياطيات مالية'],
        en: ['Scenario planning', 'Monitor regulatory and technology trends', 'Build financial reserves']
      }
    }
  ];

  function factor(id, category, labelAr, labelEn, type, weight, critical, defaultValue, descriptionAr, descriptionEn) {
    return {
      id,
      category,
      labelAr,
      labelEn,
      type: type || '0-5',
      weight: typeof weight === 'number' ? weight : 1,
      critical: !!critical,
      defaultValue: defaultValue !== undefined ? defaultValue : null,
      descriptionAr: descriptionAr || '',
      descriptionEn: descriptionEn || ''
    };
  }

  const RISK_FACTORS = [
    // Asset Risk
    factor('asset_physical_condition', 'asset', 'الحالة الفيزيائية للأصل', 'Physical asset condition', '0-5', 1.2, true, null, 'مدى تآكل أو تلف الأصل الفعلي', 'Extent of physical wear or damage to the asset'),
    factor('asset_age_obsolescence', 'asset', 'عمر الأصل ومخاطر العفا', 'Asset age / obsolescence', '0-5', 1.1, false, null, 'عدد السنوات منذ الإنشاء أو آخر تجديد', 'Years since construction or last major renewal'),
    factor('asset_maintenance_status', 'asset', 'حالة الصيانة والسجلات', 'Maintenance status & records', '0-5', 1.0, true, null, 'اكتمال سجلات الصيانة وجدولتها', 'Completeness of maintenance records and scheduling'),
    factor('asset_critical_failure_history', 'asset', 'تاريخ الأعطال الحرجة', 'History of critical failures', '0-5', 1.0, true, null, 'عدد الأعطال الحرجة السابقة', 'Number of previous critical failures'),
    factor('asset_safety_compliance', 'asset', 'الامتثال لمعايير السلامة', 'Safety compliance', '0-5', 0.9, true, null, 'مطابقة الأصل لمعايير السلامة', 'Asset compliance with safety standards'),
    factor('asset_residual_life', 'asset', 'العمر الافتراضي المتبقي', 'Remaining useful life', '0-5', 0.9, false, null, 'العمر المتبقي مقابل العمر الاقتصادي', 'Remaining life versus economic life'),
    factor('asset_dependence', 'asset', 'درجة الاعتماد على الأصل', 'Dependence on asset', '0-5', 0.8, false, null, 'مدى أهمية الأصل للعمليات', 'How critical the asset is to operations'),

    // Market Risk
    factor('market_demand_volatility', 'market', 'تقلب الطلب', 'Demand volatility', '0-5', 1.1, false, null, 'مدى تقلب الطلب على المنتج/الخدمة', 'Demand volatility for the product/service'),
    factor('market_supply_pressure', 'market', 'ضغط العرض والمنافسة', 'Supply pressure & competition', '0-5', 1.0, false, null, 'عدد المنافسين وضغط العرض', 'Number of competitors and supply pressure'),
    factor('market_customer_concentration', 'market', 'تركيز العملاء', 'Customer concentration', '0-5', 1.0, true, null, 'الاعتماد على عدد قليل من العملاء', 'Reliance on a small number of customers'),
    factor('market_price_volatility', 'market', 'تقلب الأسعار', 'Price volatility', '0-5', 0.9, false, null, 'مدى تقلب أسعار الأصل أو المدخلات', 'Price volatility of the asset or inputs'),
    factor('market_liquidity', 'market', 'سيولة السوق', 'Market liquidity', '0-5', 0.9, false, null, 'سهولة البيع أو الخروج من السوق', 'Ease of selling or exiting the market'),
    factor('market_economic_cycle', 'market', 'الدور الاقتصادي', 'Economic cycle exposure', '0-5', 0.8, false, null, 'حساسية الأصل للدورات الاقتصادية', 'Asset sensitivity to economic cycles'),

    // Operational Risk
    factor('oper_utilization_rate', 'operational', 'معدل الاستخدام', 'Utilization rate', '0-5', 0.9, false, null, 'نسبة استخدام الطاقة الإنتاجية', 'Percentage of productive capacity used'),
    factor('oper_downtime', 'operational', 'توقفات التشغيل', 'Operational downtime', '0-5', 1.0, false, null, 'مدة التوقفات غير المخططة', 'Duration of unplanned downtime'),
    factor('oper_process_complexity', 'operational', 'تعقيد العمليات', 'Process complexity', '0-5', 0.8, false, null, 'عدد الخطوات والتبعيات التشغيلية', 'Number of steps and operational dependencies'),
    factor('oper_spare_parts_supply', 'operational', 'توفر قطع الغيار', 'Spare parts availability', '0-5', 0.8, false, null, 'سهولة الحصول على قطع الغيار', 'Ease of obtaining spare parts'),
    factor('oper_skill_dependency', 'operational', 'الاعتماد على المهارات الخاصة', 'Specialized skill dependency', '0-5', 0.9, true, null, 'حاجة الأصل لمشغلين متخصصين', 'Need for specialized operators'),
    factor('oper_backup_systems', 'operational', 'أنظمة الطوارئ والاحتياط', 'Backup / contingency systems', '0-5', 0.8, true, null, 'وجود أنظمة احتياطية للطوارئ', 'Availability of emergency backup systems'),

    // Management Risk
    factor('mgmt_key_person_dependency', 'management', 'اعتماد الأشخاص المفاتيح', 'Key person dependency', '0-5', 1.2, true, null, 'الاعتماد على مدير أو مؤسس واحد', 'Reliance on a single manager or founder'),
    factor('mgmt_governance_quality', 'management', 'جودة الحوكمة', 'Governance quality', '0-5', 1.0, false, null, 'جودة الهيكل التنظيمي واللوائح', 'Quality of organizational structure and bylaws'),
    factor('mgmt_reporting_transparency', 'management', 'شفافية التقارير', 'Reporting transparency', '0-5', 0.9, false, null, 'جودة البيانات المالية والتشغيلية', 'Quality of financial and operational data'),
    factor('mgmt_succession_plan', 'management', 'خطة خلافة الإدارة', 'Management succession plan', '0-5', 0.9, true, null, 'وجود خطة خلافة واضحة', 'Existence of clear succession plan'),
    factor('mgmt_experience', 'management', 'خبرة الفريق الإداري', 'Management experience', '0-5', 0.8, false, null, 'خبرة الفريق في القطاع', 'Team experience in the sector'),

    // Legal Risk
    factor('legal_ownership_clarity', 'legal', 'وضوح الملكية', 'Ownership clarity', 'yes/no', 1.2, true, null, 'هل وثائق الملكية واضحة ومحدثة؟', 'Are ownership documents clear and up to date?'),
    factor('legal_licenses_valid', 'legal', 'صحة التراخيص والتصاريح', 'Valid licenses & permits', 'yes/no', 1.1, true, null, 'هل التراخيص سارية وكاملة؟', 'Are all required licenses valid and complete?'),
    factor('legal_litigation_exposure', 'legal', 'التعرض للنزاعات القضائية', 'Litigation exposure', '0-5', 1.0, true, null, 'وجود قضايا أو نزاعات قائمة', 'Existing lawsuits or disputes'),
    factor('legal_contract_risks', 'legal', 'مخاطر العقود', 'Contract risks', '0-5', 0.9, false, null, 'جودة ووضوح العقود الرئيسية', 'Quality and clarity of key contracts'),
    factor('legal_regulatory_changes', 'legal', 'التغييرات التنظيمية', 'Regulatory changes', '0-5', 0.9, false, null, 'احتمالية تغييرات تنظيمية سلبية', 'Likelihood of adverse regulatory changes'),
    factor('legal_compliance_history', 'legal', 'تاريخ الامتثال', 'Compliance history', '0-5', 0.8, false, null, 'تاريخ المخالفات أو العقوبات', 'History of violations or penalties'),

    // Environmental Risk
    factor('env_energy_efficiency', 'environmental', 'كفاءة الطاقة', 'Energy efficiency', '0-5', 0.9, false, null, 'مستوى كفاءة استهلاك الطاقة', 'Level of energy consumption efficiency'),
    factor('env_waste_management', 'environmental', 'إدارة النفايات', 'Waste management', '0-5', 0.8, false, null, 'جودة إدارة النفايات والمخلفات', 'Quality of waste and byproduct management'),
    factor('env_water_usage', 'environmental', 'إدارة المياه', 'Water usage & scarcity', '0-5', 0.8, false, null, 'الاعتماد على المياه ومخاطر الندرة', 'Dependence on water and scarcity risk'),
    factor('env_emissions', 'environmental', 'الانبعاثات والكربون', 'Emissions & carbon', '0-5', 0.8, false, null, 'مستوى الانبعاثات والبصمة الكربونية', 'Emissions level and carbon footprint'),
    factor('env_hazardous_exposure', 'environmental', 'التعرض للمواد الخطرة', 'Hazardous material exposure', 'yes/no', 1.0, true, null, 'هل يتعامل الأصل مع مواد خطرة؟', 'Does the asset handle hazardous materials?'),
    factor('env_climate_exposure', 'environmental', 'التعرض للتغير المناخي', 'Climate exposure', '0-5', 0.8, false, null, 'التعرض للفيضانات/العواصف/الحرارة', 'Exposure to floods/storms/heat'),

    // Technological Risk
    factor('tech_obsolescence', 'technological', 'مخاطر العفا التقني', 'Technology obsolescence', '0-5', 1.2, true, null, 'سرعة عفا التقنية المستخدمة', 'Speed of obsolescence of used technology'),
    factor('tech_cybersecurity', 'technological', 'الأمن السيبراني', 'Cybersecurity risk', '0-5', 1.1, true, null, 'مستوى حماية الأنظمة والبيانات', 'Level of system and data protection'),
    factor('tech_integration', 'technological', 'التكامل مع الأنظمة', 'System integration', '0-5', 0.9, false, null, 'سهولة التكامل مع الأنظمة الأخرى', 'Ease of integration with other systems'),
    factor('tech_vendor_lockin', 'technological', 'الارتباط بمورد تقني', 'Vendor lock-in', '0-5', 0.8, false, null, 'الاعتماد على مورد برمجيات/عتاد واحد', 'Dependence on a single software/hardware vendor'),
    factor('tech_data_portability', 'technological', 'قابلية نقل البيانات', 'Data portability', '0-5', 0.8, false, null, 'سهولة استخراج ونقل البيانات', 'Ease of extracting and migrating data'),
    factor('tech_backup_recovery', 'technological', 'النسخ الاحتياطي والاستعادة', 'Backup & recovery', 'yes/no', 0.9, true, null, 'وجود خطة نسخ احتياطي واستعادة مجربة', 'Existence of tested backup and recovery plan'),

    // Future Risk
    factor('future_regulatory_outlook', 'future', 'الآفاق التنظيمية', 'Regulatory outlook', '0-5', 1.0, false, null, 'توقعات التغييرات التنظيمية', 'Expectations of regulatory changes'),
    factor('future_technology_disruption', 'future', 'الاضطراب التقني', 'Technology disruption', '0-5', 1.0, false, null, 'احتمالية اضطراب التقنية في القطاع', 'Likelihood of technology disruption in sector'),
    factor('future_market_shift', 'future', 'تحولات السوق', 'Market shifts', '0-5', 0.9, false, null, 'احتمالية تغيرات كبيرة في السوق', 'Likelihood of major market shifts'),
    factor('future_geopolitical', 'future', 'المخاطر الجيوسياسية', 'Geopolitical risk', '0-5', 0.9, false, null, 'التعرض للتوترات الجيوسياسية', 'Exposure to geopolitical tensions'),
    factor('future_esg_pressure', 'future', 'ضغوط الاستدامة ESG', 'ESG pressure', '0-5', 0.8, false, null, 'متطلبات الاستدامة والحوكمة البيئية', 'Sustainability and governance requirements'),
    factor('future_financial_reserves', 'future', 'الاحتياطيات المالية', 'Financial reserves', '0-5', 0.8, false, null, 'قدرة تحمل الصدمات المالية', 'Ability to absorb financial shocks')
  ];

  const DEFAULT_CATEGORY_WEIGHTS = {
    asset: 0.18,
    market: 0.16,
    operational: 0.14,
    management: 0.12,
    legal: 0.12,
    environmental: 0.10,
    technological: 0.10,
    future: 0.08
  };

  // Per-asset category weight overrides. Values must sum to 1 per asset class.
  const ASSET_CATEGORY_WEIGHT_OVERRIDES = {
    realEstate: { asset: 0.22, market: 0.18, legal: 0.14 },
    business: { market: 0.20, management: 0.18, legal: 0.12 },
    factory: { asset: 0.20, operational: 0.18, technological: 0.12 },
    machineryEquipment: { asset: 0.24, operational: 0.16, technological: 0.12 },
    vehiclesFleet: { asset: 0.22, operational: 0.18, market: 0.10 },
    agricultureFarms: { environmental: 0.20, market: 0.16, operational: 0.14 },
    livestock: { environmental: 0.18, operational: 0.16, market: 0.14 },
    naturalResourcesMining: { environmental: 0.20, legal: 0.16, future: 0.14 },
    oilGas: { environmental: 0.20, future: 0.16, legal: 0.12 },
    infrastructure: { asset: 0.22, legal: 0.14, future: 0.12 },
    intellectualProperty: { legal: 0.22, technological: 0.18, future: 0.14 },
    brandsTrademarks: { market: 0.22, legal: 0.16, future: 0.14 },
    patents: { legal: 0.24, technological: 0.18, future: 0.12 },
    copyrightsContent: { market: 0.22, technological: 0.16, legal: 0.12 },
    franchises: { legal: 0.20, market: 0.16, management: 0.14 },
    licensesPermits: { legal: 0.28, future: 0.14, market: 0.10 },
    financialAssets: { market: 0.28, future: 0.16, legal: 0.10 },
    cryptoDigital: { technological: 0.24, market: 0.20, legal: 0.14 },
    commodities: { market: 0.24, environmental: 0.14, future: 0.12 },
    artCollectibles: { market: 0.22, asset: 0.16, legal: 0.12 },
    jewelryPreciousMetals: { market: 0.20, asset: 0.18, legal: 0.12 },
    softwareTechnology: { technological: 0.26, market: 0.18, future: 0.14 },
    medicalEquipment: { technological: 0.20, legal: 0.16, operational: 0.14 },
    educationalEquipment: { technological: 0.18, operational: 0.16, market: 0.12 },
    distressedAsset: { future: 0.20, legal: 0.18, asset: 0.16 },
    tourismAsset: { market: 0.22, environmental: 0.14, future: 0.12 },
    personalWealth: { legal: 0.20, market: 0.16, future: 0.14 },
    scrapSalvage: { environmental: 0.18, market: 0.18, asset: 0.14 },
    maritimeAsset: { legal: 0.18, environmental: 0.16, operational: 0.16 },
    logisticsAsset: { operational: 0.20, market: 0.16, technological: 0.12 },
    fuelStation: { environmental: 0.20, legal: 0.16, market: 0.12 },
    beautyWellness: { legal: 0.18, market: 0.16, operational: 0.14 },
    giftsStationery: { market: 0.20, operational: 0.14, future: 0.12 },
    furnitureAsset: { asset: 0.20, market: 0.16, operational: 0.12 },
    retailBusiness: { market: 0.22, management: 0.14, legal: 0.12 }
  };

  function resolveCategoryWeights(assetClass) {
    const override = ASSET_CATEGORY_WEIGHT_OVERRIDES[assetClass] || {};
    const weights = {};
    let total = 0;
    CATEGORIES.forEach(cat => {
      weights[cat.id] = override[cat.id] !== undefined ? override[cat.id] : DEFAULT_CATEGORY_WEIGHTS[cat.id];
      total += weights[cat.id];
    });
    if (total <= 0) return { ...DEFAULT_CATEGORY_WEIGHTS };
    // Normalize to ensure sum = 1
    Object.keys(weights).forEach(k => { weights[k] = weights[k] / total; });
    return weights;
  }

  function listAssetClasses() {
    return Object.keys(ASSET_CATEGORY_WEIGHT_OVERRIDES);
  }

  function getCategoryMeta(categoryId) {
    return CATEGORIES.find(c => c.id === categoryId) || null;
  }

  function getFactorsByCategory(categoryId) {
    return RISK_FACTORS.filter(f => f.category === categoryId);
  }

  return {
    CATEGORIES,
    RISK_FACTORS,
    DEFAULT_CATEGORY_WEIGHTS,
    ASSET_CATEGORY_WEIGHT_OVERRIDES,
    resolveCategoryWeights,
    listAssetClasses,
    getCategoryMeta,
    getFactorsByCategory,
    version: '1.0.0'
  };
}));
