/**
 * BONDS Valuation Intelligence Platform — Shared Locale Definitions
 *
 * Contains both Arabic (ar) and English (en) locales for the valuation wizard.
 * This file is imported by valuation/index.html (ar) and en/valuation/index.html (en).
 */
(function () {
  'use strict';

  const VALUATION_LOCALES = {
    ar: {
      lang: 'ar',
      dir: 'rtl',
      texts: {
        activeBadge: 'متاح',
        comingSoonBadge: 'قريباً',
        restorePrompt: 'لديك مسودة سابقة: {asset}',
        assetQuality: 'جودة الأصل',
        marketStrength: 'قوة السوق',
        risk: 'إدارة المخاطر',
        liquidity: 'السيولة',
        growth: 'النمو',
        management: 'الإدارة',
        brandStrength: 'قوة العلامة',
        investmentAttractiveness: 'جاذبية الاستثمار',
        bookValue: 'القيمة الدفترية',
        marketValue: 'القيمة السوقية',
        fairValue: 'القيمة العادلة',
        investmentValue: 'قيمة الاستثمار',
        liquidationValue: 'قيمة التصفية',
        insuranceValue: 'القيمة التأمينية',
        operatingValue: 'القيمة التشغيلية',
        quickExitValue: 'قيمة التخارج السريع',
        restructuredValue: 'القيمة بعد إعادة الهيكلة',
        goodwillValue: 'قيمة الشهرة',
        goodwillImpairmentFlag: 'علامة إنقاص الشهرة',
        replacementValue: 'قيمة الاستبدال',
        scenarioBase: 'السيناريو الأساسي',
        scenarioOptimistic: 'السيناريو الإيجابي',
        scenarioPessimistic: 'السيناريو السلبي',
        projections: 'التوقعات المستقبلية',
        swotAnalysis: 'تحليل SWOT',
        strengths: 'نقاط القوة',
        weaknesses: 'نقاط الضعف',
        opportunities: 'الفرص',
        threats: 'المخاطر',
        executiveSummary: 'الملخص التنفيذي',
        depreciationAnalysis: 'تحليل الاستهلاك',
        accountingDepreciation: 'الاستهلاك المحاسبي',
        economicDepreciation: 'الاستهلاك الاقتصادي',
        operationalDepreciation: 'الاستهلاك التشغيلي',
        environmentalDepreciation: 'الاستهلاك البيئي',
        technicalDepreciation: 'الاستهلاك التقني',
        functionalDepreciation: 'الاستهلاك الوظيفي',
        maintenanceDepreciation: 'الاستهلاك بسبب قلة الصيانة',
        misuseDepreciation: 'الاستهلاك بسبب سوء الاستخدام',
        totalDepreciation: 'إجمالي الاستهلاك',
        depreciationCurrentValue: 'القيمة الحالية (بعد الاستهلاك)',
        depreciationFutureValue: 'القيمة المستقبلية',
        depreciationReplacementValue: 'قيمة الاستبدال',
        environmentalExposure: 'التعرض البيئي (0-1)',
        techObsolescenceRate: 'معدل عدم مواكبة التقنية (0-1)',
        functionalObsolescence: 'العجز الوظيفي (0-1)',
        maintenanceNeglect: 'إهمال الصيانة (0-1)',
        misuseFactor: 'معامل سوء الاستخدام (0-1)',
        projectionYears: 'سنوات التوقع المستقبلي',
        inflationRate: 'معدل التضخم السنوي',
        submitError: 'حدث خطأ أثناء إنشاء التقييم. يرجى التحقق من البيانات المدخلة.',
        marketIntelligence: 'الذكاء السوقي',
        averageSellingPrice: 'متوسط سعر البيع',
        averageBuyingPrice: 'متوسط سعر الشراء',
        transactionCount: 'عدد الصفقات',
        supplyIndex: 'مؤشر العرض',
        demandIndex: 'مؤشر الطلب',
        competitorCount: 'عدد المنافسين',
        averageSaleSpeedDays: 'متوسط سرعة البيع (يوم)',
        marketInflationRate: 'معدل التضخم السوقي',
        marketInterestRate: 'معدل الفائدة السوقي',
        economicGrowthRate: 'معدل النمو الاقتصادي',
        marketDataSource: 'مصدر البيانات',
        marketScope: 'النطاق',
        globalScope: 'عالمي',
        outlook: 'النظرة المستقبلية',
        outlookPositive: 'إيجابية',
        outlookNeutral: 'محايدة',
        outlookNegative: 'سلبية',
        riskScore: 'درجة المخاطرة',
        confidence: 'الثقة',
        dataQualityScore: 'جودة البيانات',
        conditionAssessmentTitle: 'تقييم الحالة التفصيلي',
        conditionAssessmentDesc: 'أجب عن نقاط الفحص أدناه لحساب درجة الحالة بدقة. سيتم تحديث الحقول الأساسية تلقائيًا.',
        conditionAssessmentCalculate: 'احتساب درجة الحالة',
        conditionAssessmentReset: 'إعادة تعيين',
        conditionScoreResult: 'درجة الحالة',
        conditionGradeResult: 'التقدير',
        conditionConfidenceResult: 'نسبة الثقة',
        conditionCriticalWarning: 'هناك إخفاقات حرجة — تم تقصير الدرجة.',
        yes: 'نعم',
        no: 'لا',
        pass: 'مطابق',
        fail: 'غير مطابق',
        conditionAssetName: 'اسم الأصل',
        conditionAssetIdentifier: 'معرّف الأصل',
        conditionAssessmentDate: 'تاريخ الفحص',
        conditionStatus: 'حالة الفحص',
        conditionNotes: 'ملاحظات',
        conditionSaveAssessment: 'حفظ تقييم الحالة',
        conditionLoadPrevious: 'تحميل تقييم سابق',
        conditionSavedSuccess: 'تم حفظ التقييم بنجاح',
        conditionSaveError: 'فشل الحفظ: ',
        conditionNoAssessments: 'لا توجد تقييمات سابقة',
        conditionDraft: 'مسودة',
        conditionFinal: 'نهائي',
        conditionArchived: 'مؤرشف',
        conditionExportPdf: 'تصدير PDF',
        conditionReportTitle: 'تقرير تقييم الحالة',
        conditionReportGenerated: 'تم الإنشاء',
        conditionReportAsset: 'الأصل',
        conditionReportScore: 'درجة الحالة',
        conditionReportGrade: 'التقدير',
        conditionReportConfidence: 'نسبة الثقة',
        conditionReportPoints: 'نقاط الفحص',
        conditionReportCritical: 'إخفاقات حرجة',
        conditionReportNotes: 'ملاحظات',
        conditionHistoryTitle: 'تاريخ تقييمات الحالة',
        conditionHistoryNoData: 'لا توجد تقييمات سابقة لهذه الفئة'
      },
      icons: {
        realEstate: '🏢', business: '🏭', factory: '🏭', machineryEquipment: '⚙️',
        vehiclesFleet: '🚛', agricultureFarms: '🌾', livestock: '🐄',
        naturalResourcesMining: '⛏️', oilGas: '🛢️', infrastructure: '🌉',
        intellectualProperty: '💡', brandsTrademarks: '™️', patents: '📜',
        copyrightsContent: '©️', franchises: '📋', licensesPermits: '📄',
        financialAssets: '📈', cryptoDigital: '₿', commodities: '🌾',
        artCollectibles: '🎨', jewelryPreciousMetals: '💎', softwareTechnology: '💻',
        medicalEquipment: '🏥', educationalEquipment: '🎓', distressedAsset: '⚠️',
        tourismAsset: '🏖️', personalWealth: '💼', scrapSalvage: '🔩',
        maritimeAsset: '⚓', logisticsAsset: '📦', fuelStation: '⛽',
        beautyWellness: '💆', giftsStationery: '🎁', furnitureAsset: '🛋️',
        retailBusiness: '🛒'
      },
      steps: [
        { title: 'الهوية', description: 'بيانات التعريف الأساسية للأصل والموقع والقطاع.' },
        { title: 'الحالة', description: 'التقييم الفني والتشغيلي والصيانة والجودة.' },
        { title: 'التكلفة التاريخية', description: 'التكلفة الأصلية والتحسينات والمصاريف المرتبطة.' },
        { title: 'الإهلاكات', description: 'العمر الافتراضي والإهلاك المتراكم والعوامل التقنية.' },
        { title: 'السوق', description: 'المقارنات السوقية ومؤشرات الطلب والعرض والنمو.' },
        { title: 'الإيراد', description: 'الإيرادات والتدفقات النقدية ومعدلات العائد.' },
        { title: 'المخاطر', description: 'المخاطر التنظيمية والبيئية والسوقية والتشغيلية.' },
        { title: 'الأصول غير الملموسة', description: 'العلامة التجارية والتراخيص والعلاقات والموقع.' },
        { title: 'التخارج', description: 'تكاليف البيع وعمق سوق المشترين وفترة التصفية.' },
        { title: 'التوقعات المستقبلية', description: 'نمو السوق والبنية التحتية والاستدامة والابتكار.' }
      ],
      fieldsByClass: {
        realEstate: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل', type: 'text', placeholder: 'مثلاً: فيلا الرياض', default: 'عقار نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'propertyType', label: 'نوع العقار', type: 'select', options: [
              { value: 'residential', label: 'سكني' },
              { value: 'commercial', label: 'تجاري' },
              { value: 'industrial', label: 'صناعي' },
              { value: 'office', label: 'مكتبي' },
              { value: 'retail', label: 'تجزئة' },
              { value: 'land', label: 'أرض' }
            ], default: 'commercial' },
            { name: 'areaSqm', label: 'المساحة (م²)', type: 'number', min: 1, default: 500 },
            { name: 'yearBuilt', label: 'سنة البناء', type: 'number', min: 1900, max: 2030, default: 2015 },
            { name: 'ownershipType', label: 'نوع الملكية', type: 'select', options: [
              { value: 'freehold', label: 'ملكية حرة' },
              { value: 'leasehold', label: 'إيجار طويل الأمد' }
            ], default: 'freehold' }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'مستوى الصيانة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'renovationInvestment', label: 'استثمارات التجديد', type: 'number', min: 0, default: 100000 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء', type: 'number', min: 0, default: 2000000 },
            { name: 'improvementCosts', label: 'تكاليف التحسينات', type: 'number', min: 0, default: 200000 },
            { name: 'acquisitionCosts', label: 'مصاريف الاكتساب', type: 'number', min: 0, default: 100000 },
            { name: 'legalCosts', label: 'المصاريف القانونية', type: 'number', min: 0, default: 50000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 50 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 300000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 }
          ],
          // 5. Market
          [
            { name: 'comparablePricePerSqm', label: 'السعر المقارن للم²', type: 'number', min: 0, default: 4500 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'transactionVolume', label: 'حجم التداول (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 6. Income
          [
            { name: 'monthlyRent', label: 'الإيجار الشهري', type: 'number', min: 0, default: 20000 },
            { name: 'occupancyRate', label: 'نسبة الإشغال (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.9 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'capRate', label: 'معدل العائد الرأسمالي (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.07 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'environmentalRisk', label: 'المخاطر البيئية (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Intangibles
          [
            { name: 'locationPremium', label: 'علاوة الموقع (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'permitsValue', label: 'قيمة التراخيص/الإعفاءات', type: 'number', min: 0, default: 50000 }
          ],
          // 9. Exit
          [
            { name: 'holdingYears', label: 'فترة الاحتفاظ (سنوات)', type: 'number', min: 0, default: 5 },
            { name: 'transactionCostsRate', label: 'نسبة تكاليف التسويق (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 10. Future
          [
            { name: 'gdpGrowth', label: 'نمو الناتج المحلي (0-1)', type: 'number', min: 0, max: 0.2, step: 0.01, default: 0.03 },
            { name: 'populationGrowth', label: 'نمو السكان (0-1)', type: 'number', min: 0, max: 0.1, step: 0.001, default: 0.015 },
            { name: 'infrastructurePlans', label: 'خطط البنية التحتية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 65 }
          ]
        ],
        business: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الشركة', type: 'text', placeholder: 'شركة نموذجية', default: 'شركة نموذجية' },
            { name: 'industrySector', label: 'القطاع الصناعي', type: 'text', placeholder: 'التجزئة', default: 'التجزئة' },
            { name: 'yearsInOperation', label: 'سنوات التشغيل', type: 'number', min: 0, default: 8 },
            { name: 'employeeCount', label: 'عدد الموظفين', type: 'number', min: 0, default: 45 }
          ],
          // 2. Condition
          [
            { name: 'operationalStatus', label: 'الحالة التشغيلية', type: 'select', options: [
              { value: 'operating', label: 'يعمل بكامل الطاقة' },
              { value: 'partial', label: 'يعمل جزئياً' },
              { value: 'distressed', label: 'متعثر' }
            ], default: 'operating' },
            { name: 'managementQuality', label: 'جودة الإدارة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'governanceScore', label: 'درجة الحوكمة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'techMaturity', label: 'نضج التقنية (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 3. Historical Cost
          [
            { name: 'equityBookValue', label: 'القيمة الدفترية للحقوق', type: 'number', min: 0, default: 2500000 },
            { name: 'retainedEarnings', label: 'الأرباح المحتجزة', type: 'number', default: 800000 },
            { name: 'intangibleAssetsBook', label: 'الأصول غير الملموسة (دفترية)', type: 'number', min: 0, default: 400000 },
            { name: 'totalDebt', label: 'إجمالي الديون', type: 'number', min: 0, default: 600000 },
            { name: 'cashAndEquiv', label: 'النقدية وما يعادلها', type: 'number', min: 0, default: 300000 }
          ],
          // 4. Depreciation
          [
            { name: 'amortizationExpense', label: 'الإطفاء السنوي', type: 'number', min: 0, default: 80000 },
            { name: 'goodwillImpairment', label: 'مخصص إنقاص الشهرة', type: 'number', min: 0, default: 0 },
            { name: 'annualCapex', label: 'الاستثمار الرأسمالي السنوي', type: 'number', min: 0, default: 200000 }
          ],
          // 5. Market
          [
            { name: 'evRevenueMultiple', label: 'مضاعف القيمة/الإيرادات', type: 'number', min: 0, step: 0.1, default: 1.2 },
            { name: 'evEbitdaMultiple', label: 'مضاعف القيمة/EBITDA', type: 'number', min: 0, step: 0.5, default: 7 },
            { name: 'sectorMultiple', label: 'مضاعف القطاع', type: 'number', min: 0.5, step: 0.1, default: 1 },
            { name: 'transactionPremium', label: 'علاوة الصفقة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
            { name: 'marketLiquidity', label: 'سيولة السوق (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'الإيرادات السنوية', type: 'number', min: 0, default: 5000000 },
            { name: 'revenueGrowthRate', label: 'معدل نمو الإيرادات (0-1)', type: 'number', min: -0.1, max: 0.5, step: 0.01, default: 0.08 },
            { name: 'ebitdaMargin', label: 'هامش EBITDA (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.18 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
            { name: 'projectionYears', label: 'سنوات الإسقاط', type: 'number', min: 1, max: 20, default: 5 }
          ],
          // 7. Risks
          [
            { name: 'customerConcentration', label: 'تركيز العملاء (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'competitiveIntensity', label: 'شدة المنافسة (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'successionRisk', label: 'مخاطر الاستمرارية (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 60 },
            { name: 'proprietaryTechnology', label: 'التقنية الملكية (0-100)', type: 'number', min: 0, max: 100, default: 40 },
            { name: 'patentsValue', label: 'قيمة براءات الاختراع', type: 'number', min: 0, default: 100000 },
            { name: 'customerRelationships', label: 'علاقات العملاء (0-100)', type: 'number', min: 0, max: 100, default: 55 }
          ],
          // 9. Exit
          [
            { name: 'exitMultiple', label: 'مضاعف الخروج', type: 'number', min: 0, step: 0.5, default: 7 },
            { name: 'strategicBuyerPremium', label: 'علاوة المشتري الاستراتيجي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'marketabilityDiscount', label: 'خصم السيولة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 10. Future
          [
            { name: 'marketGrowth', label: 'نمو السوق (0-1)', type: 'number', min: 0, max: 0.2, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'خط الإنتاج الابتكاري (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 60 }
          ]
        ],
        factory: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم المصنع', type: 'text', placeholder: 'مصنع نموذجي', default: 'مصنع نموذجي' },
            { name: 'factorySector', label: 'قطاع المصنع', type: 'select', options: [
              { value: 'food', label: 'غذائي' },
              { value: 'plastic', label: 'بلاستيك' },
              { value: 'water', label: 'مياه' },
              { value: 'building', label: 'مواد بناء' },
              { value: 'textiles', label: 'منسوجات' },
              { value: 'chemicals', label: 'كيماويات' },
              { value: 'packaging', label: 'تعبئة وتغليف' },
              { value: 'furniture', label: 'أثاث' },
              { value: 'other', label: 'أخرى' }
            ], default: 'food' },
            { name: 'builtYear', label: 'سنة البناء', type: 'number', min: 1900, max: 2030, default: 2012 },
            { name: 'floorAreaSqm', label: 'المساحة المبنية (م²)', type: 'number', min: 1, default: 3000 }
          ],
          // 2. Condition
          [
            { name: 'equipmentAgeYears', label: 'عمر المعدات (سنوات)', type: 'number', min: 0, default: 8 },
            { name: 'utilizationRate', label: 'معدل الاستخدام (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.75 },
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'safetyCertificationScore', label: 'شهادات السلامة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'digitalMaturity', label: 'النضج الرقمي (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'تكلفة الأرض', type: 'number', min: 0, default: 800000 },
            { name: 'buildingCost', label: 'تكلفة المبنى', type: 'number', min: 0, default: 1500000 },
            { name: 'machineryCost', label: 'تكلفة الآلات', type: 'number', min: 0, default: 2000000 },
            { name: 'installationCost', label: 'تكلفة التركيب', type: 'number', min: 0, default: 250000 },
            { name: 'workingCapital', label: 'رأس المال العامل', type: 'number', min: 0, default: 400000 }
          ],
          // 4. Depreciation
          [
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 900000 },
            { name: 'functionalObsolescence', label: 'العطل الوظيفي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'تكلفة الاستبدال الجديدة', type: 'number', min: 0, default: 5000000 },
            { name: 'costIndex', label: 'مؤشر التكلفة', type: 'number', min: 0.5, max: 2, step: 0.05, default: 1.05 },
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 4500000 },
            { name: 'scrapValueRate', label: 'نسبة الخردة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 }
          ],
          // 6. Income
          [
            { name: 'annualCapacityUnits', label: 'الطاقة السنوية (وحدة)', type: 'number', min: 1, default: 100000 },
            { name: 'capacityUtilization', label: 'استغلال الطاقة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'unitPrice', label: 'سعر الوحدة', type: 'number', min: 0, default: 50 },
            { name: 'variableCostPerUnit', label: 'التكلفة المتغيرة للوحدة', type: 'number', min: 0, default: 28 },
            { name: 'annualFixedCosts', label: 'التكاليف الثابتة السنوية', type: 'number', min: 0, default: 600000 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 }
          ],
          // 7. Risks
          [
            { name: 'rawMaterialRisk', label: 'مخاطر المواد الخام (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'energyRisk', label: 'مخاطر الطاقة (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'demandRisk', label: 'مخاطر الطلب (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'geopoliticalRisk', label: 'المخاطر الجيوسياسية (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Intangibles
          [
            { name: 'patentsValue', label: 'قيمة براءات الاختراع', type: 'number', min: 0, default: 150000 },
            { name: 'licensesValue', label: 'قيمة التراخيص', type: 'number', min: 0, default: 100000 },
            { name: 'workforceSkill', label: 'مهارة القوى العاملة (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 9. Exit
          [
            { name: 'dismantlingCost', label: 'تكلفة الفك', type: 'number', min: 0, default: 200000 },
            { name: 'salvageValue', label: 'قيمة الخردة', type: 'number', min: 0, default: 300000 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 12 }
          ],
          // 10. Future
          [
            { name: 'marketGrowth', label: 'نمو السوق (0-1)', type: 'number', min: 0, max: 0.2, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'خطة الأتمتة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 }
          ]
        ],
        machineryEquipment: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل', type: 'text', placeholder: 'خط إنتاج نموذجي', default: 'آلة نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الآلة', type: 'select', options: [
              { value: 'industrial', label: 'صناعية' },
              { value: 'construction', label: 'إنشاءات' },
              { value: 'production', label: 'إنتاج' },
              { value: 'packaging', label: 'تعبئة' },
              { value: 'other', label: 'أخرى' }
            ], default: 'industrial' },
            { name: 'quantity', label: 'الكمية', type: 'number', min: 1, default: 1 },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2018 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'مستوى الصيانة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'operatingHours', label: 'ساعات التشغيل', type: 'number', min: 0, default: 8000 },
            { name: 'inspectionScore', label: 'درجة الفحص (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء', type: 'number', min: 0, default: 800000 },
            { name: 'installationCost', label: 'تكلفة التركيب', type: 'number', min: 0, default: 80000 },
            { name: 'transportCost', label: 'تكلفة النقل', type: 'number', min: 0, default: 30000 },
            { name: 'improvementCosts', label: 'تكاليف التحسينات', type: 'number', min: 0, default: 50000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 15 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 200000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'residualValueRate', label: 'نسبة القيمة المتبقية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'تكلفة الاستبدال الجديدة', type: 'number', min: 0, default: 900000 },
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 700000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 }
          ],
          // 6. Income
          [
            { name: 'monthlyOperatingRevenue', label: 'الإيراد التشغيلي الشهري', type: 'number', min: 0, default: 30000 },
            { name: 'utilizationRate', label: 'معدل الاستخدام (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'قيمة الشهادات/التراخيص', type: 'number', min: 0, default: 30000 },
            { name: 'maintenanceContractValue', label: 'قيمة عقود الصيانة', type: 'number', min: 0, default: 20000 },
            { name: 'brandPremium', label: 'علاوة العلامة التجارية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
            { name: 'workforceSkill', label: 'مهارة القوى العاملة (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 9 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'خطة الأتمتة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 }
          ]
        ],
        vehiclesFleet: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأسطول', type: 'text', placeholder: 'أسطول توصيل نموذجي', default: 'أسطول نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'جدة', default: 'جدة' },
            { name: 'assetType', label: 'نوع المركبات', type: 'select', options: [
              { value: 'trucks', label: 'شاحنات' },
              { value: 'vans', label: 'باصات صغيرة' },
              { value: 'buses', label: 'حافلات' },
              { value: 'heavyEquipment', label: 'معدات ثقيلة' },
              { value: 'cars', label: 'سيارات' },
              { value: 'other', label: 'أخرى' }
            ], default: 'trucks' },
            { name: 'quantity', label: 'عدد المركبات', type: 'number', min: 1, default: 10 },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2019 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'مستوى الصيانة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'operatingHours', label: 'إجمالي الأميال/الساعات', type: 'number', min: 0, default: 150000 },
            { name: 'inspectionScore', label: 'درجة الفحص (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء الإجمالي', type: 'number', min: 0, default: 2000000 },
            { name: 'installationCost', label: 'تكاليف التجهيز', type: 'number', min: 0, default: 100000 },
            { name: 'transportCost', label: 'تكاليف النقل', type: 'number', min: 0, default: 50000 },
            { name: 'improvementCosts', label: 'تكاليف التحسينات', type: 'number', min: 0, default: 80000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 10 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 600000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
            { name: 'residualValueRate', label: 'نسبة القيمة المتبقية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'تكلفة الاستبدال الجديدة', type: 'number', min: 0, default: 2200000 },
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 1600000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 }
          ],
          // 6. Income
          [
            { name: 'monthlyOperatingRevenue', label: 'الإيراد الشهري', type: 'number', min: 0, default: 50000 },
            { name: 'utilizationRate', label: 'معدل الاستخدام (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.75 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'قيمة التراخيص/الشهادات', type: 'number', min: 0, default: 40000 },
            { name: 'maintenanceContractValue', label: 'قيمة عقود الصيانة', type: 'number', min: 0, default: 30000 },
            { name: 'brandPremium', label: 'علاوة العلامة التجارية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
            { name: 'workforceSkill', label: 'مهارة السائقين/المشغلين (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 6 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'خطة التحول للكهرباء/الأتمتة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 }
          ]
        ],
        medicalEquipment: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الجهاز', type: 'text', placeholder: 'جهاز أشعة نموذجي', default: 'جهاز طبي نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الجهاز', type: 'select', options: [
              { value: 'diagnostic', label: 'تشخيصي' },
              { value: 'surgical', label: 'جراحي' },
              { value: 'laboratory', label: 'مختبري' },
              { value: 'imaging', label: 'تصوير طبي' },
              { value: 'rehabilitation', label: 'تأهيلي' },
              { value: 'other', label: 'أخرى' }
            ], default: 'diagnostic' },
            { name: 'quantity', label: 'الكمية', type: 'number', min: 1, default: 1 },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2019 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'maintenanceLevel', label: 'مستوى الصيانة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'operatingHours', label: 'عدد الاستخدامات/الساعات', type: 'number', min: 0, default: 5000 },
            { name: 'inspectionScore', label: 'درجة الفحص الطبي (1-10)', type: 'number', min: 1, max: 10, default: 8 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء', type: 'number', min: 0, default: 1200000 },
            { name: 'installationCost', label: 'تكلفة التركيب والتدريب', type: 'number', min: 0, default: 120000 },
            { name: 'transportCost', label: 'تكلفة النقل', type: 'number', min: 0, default: 40000 },
            { name: 'improvementCosts', label: 'تكاليف التحديث', type: 'number', min: 0, default: 60000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 12 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 300000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'residualValueRate', label: 'نسبة القيمة المتبقية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'تكلفة الاستبدال الجديدة', type: 'number', min: 0, default: 1400000 },
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 1000000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.06 }
          ],
          // 6. Income
          [
            { name: 'monthlyOperatingRevenue', label: 'الإيراد الشهري', type: 'number', min: 0, default: 45000 },
            { name: 'utilizationRate', label: 'معدل الاستخدام (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.65 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'قيمة شهادات الاعتماد', type: 'number', min: 0, default: 80000 },
            { name: 'maintenanceContractValue', label: 'قيمة عقود الصيانة', type: 'number', min: 0, default: 50000 },
            { name: 'regulatoryCertification', label: 'التصنيف التنظيمي', type: 'select', options: [
              { value: 'sfda', label: 'SFDA' },
              { value: 'fda', label: 'FDA' },
              { value: 'ce', label: 'CE' },
              { value: 'other', label: 'أخرى' }
            ], default: 'sfda' },
            { name: 'workforceSkill', label: 'مهارة الكوادر الطبية (1-10)', type: 'number', min: 1, max: 10, default: 8 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 12 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.06 },
            { name: 'automationPlan', label: 'خطة التحديث الرقمي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 60 }
          ]
        ],
        educationalEquipment: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل', type: 'text', placeholder: 'معمل علوم نموذجي', default: 'معدات تعليمية نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع التجهيز', type: 'select', options: [
              { value: 'lab', label: 'مختبر' },
              { value: 'classroom', label: 'فصل دراسي' },
              { value: 'vocational', label: 'مهني/تقني' },
              { value: 'library', label: 'مكتبة' },
              { value: 'it', label: 'تقنية معلومات' },
              { value: 'other', label: 'أخرى' }
            ], default: 'lab' },
            { name: 'quantity', label: 'الكمية', type: 'number', min: 1, default: 1 },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2020 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'مستوى الصيانة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'operatingHours', label: 'ساعات الاستخدام', type: 'number', min: 0, default: 3000 },
            { name: 'inspectionScore', label: 'درجة الفحص (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء', type: 'number', min: 0, default: 500000 },
            { name: 'installationCost', label: 'تكلفة التركيب والتدريب', type: 'number', min: 0, default: 50000 },
            { name: 'transportCost', label: 'تكلفة النقل', type: 'number', min: 0, default: 20000 },
            { name: 'improvementCosts', label: 'تكاليف التحسينات', type: 'number', min: 0, default: 30000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 15 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 100000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'residualValueRate', label: 'نسبة القيمة المتبقية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'تكلفة الاستبدال الجديدة', type: 'number', min: 0, default: 600000 },
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 450000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 }
          ],
          // 6. Income
          [
            { name: 'monthlyOperatingRevenue', label: 'الإيراد الشهري', type: 'number', min: 0, default: 20000 },
            { name: 'utilizationRate', label: 'معدل الاستخدام (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.6 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'قيمة الشهادات/الاعتمادات', type: 'number', min: 0, default: 40000 },
            { name: 'accreditationValue', label: 'قيمة الاعتماد الأكاديمي', type: 'number', min: 0, default: 30000 },
            { name: 'maintenanceContractValue', label: 'قيمة عقود الصيانة', type: 'number', min: 0, default: 15000 },
            { name: 'workforceSkill', label: 'مهارة الكوادر التعليمية (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 9 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'automationPlan', label: 'خطة التحول الرقمي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 60 }
          ]
        ],
        jewelryPreciousMetals: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل', type: 'text', placeholder: 'سبائك ذهب نموذجية', default: 'ذهب نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'جدة', default: 'جدة' },
            { name: 'commodityType', label: 'نوع المعدن/المجوهرات', type: 'select', options: [
              { value: 'gold', label: 'ذهب' },
              { value: 'silver', label: 'فضة' },
              { value: 'platinum', label: 'بلاتين' },
              { value: 'diamond', label: 'ألماس' },
              { value: 'jewelry', label: 'مجوهرات مصنعة' },
              { value: 'other', label: 'أخرى' }
            ], default: 'gold' },
            { name: 'quantityUnits', label: 'الوزن/الكمية بالجرام', type: 'number', min: 0, step: 0.1, default: 1000 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 9 },
            { name: 'purityFactor', label: 'عيار/نقاوة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.999 },
            { name: 'authenticationScore', label: 'درجة المصداقية (1-10)', type: 'number', min: 1, max: 10, default: 9 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء', type: 'number', min: 0, default: 250000 },
            { name: 'storageCost', label: 'تكلفة التخزين السنوية', type: 'number', min: 0, default: 2000 },
            { name: 'insuranceCost', label: 'تكلفة التأمين السنوية', type: 'number', min: 0, default: 1500 }
          ],
          // 4. Holding
          [
            { name: 'holdingPeriodYears', label: 'فترة الاحتفاظ (سنوات)', type: 'number', min: 0, default: 3 }
          ],
          // 5. Market
          [
            { name: 'spotPricePerUnit', label: 'السعر الفوري للجرام', type: 'number', min: 0, step: 0.01, default: 250 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 6. Premium
          [
            { name: 'premiumRate', label: 'علاوة الصناعة/العلامة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'brandPremium', label: 'علاوة العلامة التجارية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'قيمة العلامة التجارية', type: 'number', min: 0, default: 10000 },
            { name: 'rarityPremium', label: 'علاوة الندرة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 3 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 }
          ]
        ],
        commodities: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم السلعة', type: 'text', placeholder: 'مخزون قمح نموذجي', default: 'سلعة نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'جدة', default: 'جدة' },
            { name: 'commodityType', label: 'نوع السلعة', type: 'select', options: [
              { value: 'grains', label: 'حبوب' },
              { value: 'metals', label: 'معادن أساسية' },
              { value: 'energy', label: 'طاقة' },
              { value: 'livestock', label: 'مواشٍ' },
              { value: 'inventory', label: 'مخزون تجاري' },
              { value: 'other', label: 'أخرى' }
            ], default: 'grains' },
            { name: 'quantityUnits', label: 'الكمية بالوحدة', type: 'number', min: 0, step: 0.01, default: 10000 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'purityFactor', label: 'جودة/درجة نقاوة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.95 },
            { name: 'authenticationScore', label: 'درجة التحقق (1-10)', type: 'number', min: 1, max: 10, default: 8 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء', type: 'number', min: 0, default: 200000 },
            { name: 'storageCost', label: 'تكلفة التخزين السنوية', type: 'number', min: 0, default: 10000 },
            { name: 'insuranceCost', label: 'تكلفة التأمين السنوية', type: 'number', min: 0, default: 3000 }
          ],
          // 4. Holding
          [
            { name: 'holdingPeriodYears', label: 'فترة الاحتفاظ (سنوات)', type: 'number', min: 0, default: 1 }
          ],
          // 5. Market
          [
            { name: 'spotPricePerUnit', label: 'السعر الفوري للوحدة', type: 'number', min: 0, step: 0.01, default: 25 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 6. Premium
          [
            { name: 'premiumRate', label: 'علاوة الجودة/التسليم (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.02 },
            { name: 'brandPremium', label: 'علاوة العلامة التجارية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'قيمة العلامة التجارية', type: 'number', min: 0, default: 0 },
            { name: 'rarityPremium', label: 'علاوة الندرة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.04 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 2 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 }
          ]
        ],
        distressedAsset: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل المتعثر', type: 'text', placeholder: 'أصل متعثر نموذجي', default: 'أصل متعثر نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الأصل', type: 'select', options: [
              { value: 'realEstate', label: 'عقار' },
              { value: 'business', label: 'شركة' },
              { value: 'machinery', label: 'آلات ومعدات' },
              { value: 'inventory', label: 'مخزون' },
              { value: 'other', label: 'أخرى' }
            ], default: 'business' },
            { name: 'distressReason', label: 'سبب التعثر', type: 'select', options: [
              { value: 'cashFlow', label: 'نقدية' },
              { value: 'operational', label: 'تشغيلية' },
              { value: 'regulatory', label: 'تنظيمية' },
              { value: 'market', label: 'سوقية' },
              { value: 'legal', label: 'قضائية' }
            ], default: 'cashFlow' }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'distressSeverity', label: 'شدة التعثر (0-10)', type: 'number', min: 0, max: 10, default: 7 },
            { name: 'legalHoldStatus', label: 'حالة الحجز القضائي', type: 'select', options: [
              { value: 'none', label: 'لا يوجد' },
              { value: 'partial', label: 'جزئي' },
              { value: 'full', label: 'كامل' }
            ], default: 'none' }
          ],
          // 3. Book / Debt
          [
            { name: 'bookValue', label: 'القيمة الدفترية', type: 'number', min: 0, default: 2000000 },
            { name: 'accumulatedDebt', label: 'الديون المتراكمة', type: 'number', min: 0, default: 800000 },
            { name: 'legalHoldCost', label: 'تكاليف الحجز القضائي', type: 'number', min: 0, default: 100000 }
          ],
          // 4. Discounts
          [
            { name: 'forcedSaleDiscount', label: 'خصم البيع الإجباري (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'recoveryRate', label: 'معدل الاسترداد (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.55 },
            { name: 'restructuringCost', label: 'تكلفة إعادة الهيكلة', type: 'number', min: 0, default: 200000 }
          ],
          // 5. Market
          [
            { name: 'marketValue', label: 'القيمة السوقية (بدون تعثر)', type: 'number', min: 0, default: 1800000 },
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 1500000 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 }
          ],
          // 6. Income
          [
            { name: 'stabilizedNOI', label: 'صافي الدخل التشغيلي المستقر', type: 'number', min: 0, default: 200000 },
            { name: 'stabilizedCapRate', label: 'معدل العائد الرأسمالي المستقر (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.08 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.15 },
            { name: 'timeToStabilizeMonths', label: 'الوقت حتى الاستقرار (شهر)', type: 'number', min: 1, max: 60, default: 18 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'litigationRisk', label: 'المخاطر القضائية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 5 }
          ],
          // 8. Intangibles
          [
            { name: 'restructuringPlanValue', label: 'قيمة خطة إعادة الهيكلة', type: 'number', min: 0, default: 100000 },
            { name: 'strategicValue', label: 'القيمة الاستراتيجية', type: 'number', min: 0, default: 150000 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.07 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 6 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'خطة التحسين (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 45 }
          ]
        ],
        tourismAsset: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل السياحي', type: 'text', placeholder: 'منتجع نموذجي', default: 'منتجع نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'جدة', default: 'جدة' },
            { name: 'assetType', label: 'نوع الأصل السياحي', type: 'select', options: [
              { value: 'hotel', label: 'فندق' },
              { value: 'resort', label: 'منتجع' },
              { value: 'attraction', label: 'معلم سياحي' },
              { value: 'restaurant', label: 'مطعم/مقهى' },
              { value: 'tourOperator', label: 'منظم رحلات' },
              { value: 'other', label: 'أخرى' }
            ], default: 'resort' },
            { name: 'yearBuilt', label: 'سنة التأسيس', type: 'number', min: 1900, max: 2030, default: 2015 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'starRating', label: 'التصنيف النجمي (1-5)', type: 'number', min: 1, max: 5, default: 4 },
            { name: 'renovationInvestment', label: 'استثمارات التجديد', type: 'number', min: 0, default: 200000 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء', type: 'number', min: 0, default: 5000000 },
            { name: 'improvementCosts', label: 'تكاليف التحسينات', type: 'number', min: 0, default: 800000 },
            { name: 'acquisitionCosts', label: 'مصاريف الاكتساب', type: 'number', min: 0, default: 200000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 30 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 800000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 }
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'قيمة الصفقات المقارنة', type: 'number', min: 0, default: 8000000 },
            { name: 'tourismGrowthRate', label: 'معدل نمو السياحة (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.06 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 6. Income
          [
            { name: 'dailyVisitors', label: 'عدد الزوار اليومي', type: 'number', min: 0, default: 500 },
            { name: 'avgSpendPerVisitor', label: 'متوسط الإنفاق للزائر', type: 'number', min: 0, default: 250 },
            { name: 'occupancyRate', label: 'نسبة الإشغال (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'seasonalityFactor', label: 'معامل الموسمية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.8 },
            { name: 'capRate', label: 'معدل العائد الرأسمالي (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.08 }
          ],
          // 7. Costs / Risks
          [
            { name: 'staffCost', label: 'تكلفة الموظفين سنوياً', type: 'number', min: 0, default: 1200000 },
            { name: 'maintenanceCost', label: 'تكلفة الصيانة سنوياً', type: 'number', min: 0, default: 300000 },
            { name: 'utilitiesCost', label: 'تكلفة المرافق سنوياً', type: 'number', min: 0, default: 200000 },
            { name: 'marketingCost', label: 'تكلفة التسويق سنوياً', type: 'number', min: 0, default: 150000 },
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'qualityMultiplier', label: 'مضاعف الجودة (0.5-2)', type: 'number', min: 0.5, max: 2, step: 0.05, default: 1 },
            { name: 'locationQualityScore', label: 'جودة الموقع (0-10)', type: 'number', min: 0, max: 10, default: 8 },
            { name: 'permitsValue', label: 'قيمة التراخيص السياحية', type: 'number', min: 0, default: 300000 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 12 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'infrastructurePlans', label: 'خطط البنية التحتية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 60 }
          ]
        ],
        personalWealth: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم المحفظة', type: 'text', placeholder: 'محفظة عائلة نموذجية', default: 'محفظة عائلة نموذجية' },
            { name: 'ownerName', label: 'اسم المالك', type: 'text', placeholder: 'محمد أحمد', default: 'محمد أحمد' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'currency', label: 'العملة', type: 'text', placeholder: 'SAR', default: 'SAR' }
          ],
          // 2. Condition
          [
            { name: 'creditScore', label: 'درجة الائتمان (0-10)', type: 'number', min: 0, max: 10, default: 8 },
            { name: 'authenticationScore', label: 'درجة توثيق الأصول (1-10)', type: 'number', min: 1, max: 10, default: 8 }
          ],
          // 3. Assets
          [
            { name: 'realEstateValue', label: 'قيمة العقارات', type: 'number', min: 0, default: 2000000 },
            { name: 'securitiesValue', label: 'قيمة الأوراق المالية', type: 'number', min: 0, default: 800000 },
            { name: 'cashValue', label: 'قيمة النقد', type: 'number', min: 0, default: 300000 },
            { name: 'personalAssetsValue', label: 'قيمة الأصول الشخصية', type: 'number', min: 0, default: 400000 },
            { name: 'vehicleValue', label: 'قيمة المركبات', type: 'number', min: 0, default: 200000 }
          ],
          // 4. Liabilities
          [
            { name: 'mortgageBalance', label: 'رصيد الرهن العقاري', type: 'number', min: 0, default: 600000 },
            { name: 'loansBalance', label: 'رصيد القروض', type: 'number', min: 0, default: 200000 },
            { name: 'creditBalance', label: 'رصيد البطاقات الائتمانية', type: 'number', min: 0, default: 30000 },
            { name: 'otherLiabilities', label: 'التزامات أخرى', type: 'number', min: 0, default: 50000 }
          ],
          // 5. Market
          [
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 6. Income
          [
            { name: 'annualIncome', label: 'الدخل السنوي', type: 'number', min: 0, default: 600000 },
            { name: 'passiveIncome', label: 'الدخل السلبي السنوي', type: 'number', min: 0, default: 80000 }
          ],
          // 7. Risks
          [
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'successionRisk', label: 'مخاطر الاستمرارية (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'قوة السمعة/العلامة (0-100)', type: 'number', min: 0, max: 100, default: 50 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف التسويق (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 10. Future
          [
            { name: 'innovationPipeline', label: 'خطط النمو الاستثمارية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'projectedDecline', label: 'انخفاض متوقع في القيمة', type: 'number', min: 0, default: 0 }
          ]
        ],
        scrapSalvage: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم المادة/الأصل', type: 'text', placeholder: 'خردة نحاس نموذجية', default: 'خردة نحاس نموذجية' },
            { name: 'materialType', label: 'نوع المادة', type: 'select', options: [
              { value: 'metal', label: 'معادن' },
              { value: 'plastic', label: 'بلاستيك' },
              { value: 'wood', label: 'خشب' },
              { value: 'electronics', label: 'إلكترونيات' },
              { value: 'paper', label: 'ورق' },
              { value: 'other', label: 'أخرى' }
            ], default: 'metal' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'purityRate', label: 'نسبة النقاء (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.9 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء/التكلفة', type: 'number', min: 0, default: 100000 }
          ],
          // 4. Quantity
          [
            { name: 'weightKg', label: 'الوزن (كجم)', type: 'number', min: 0, default: 10000 },
            { name: 'volumeM3', label: 'الحجم (م³)', type: 'number', min: 0, default: 50 }
          ],
          // 5. Market
          [
            { name: 'marketPricePerKg', label: 'السعر السوقي للكجم', type: 'number', min: 0, default: 25 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 }
          ],
          // 6. Costs
          [
            { name: 'dismantlingCost', label: 'تكلفة الفك', type: 'number', min: 0, default: 30000 },
            { name: 'transportCost', label: 'تكلفة النقل', type: 'number', min: 0, default: 15000 },
            { name: 'storageCost', label: 'تكلفة التخزين', type: 'number', min: 0, default: 5000 }
          ],
          // 7. Risks
          [
            { name: 'priceVolatility', label: 'تقلب الأسعار (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Quality
          [
            { name: 'recoveryRate', label: 'معدل الاسترداد (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.85 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.04 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 3 }
          ],
          // 10. Future
          [
            { name: 'infrastructurePlans', label: 'خطط البنية التحتية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'projectedDecline', label: 'انخفاض متوقع في القيمة', type: 'number', min: 0, default: 0 }
          ]
        ],
        agricultureFarms: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم المزرعة', type: 'text', placeholder: 'مزرعة نموذجية', default: 'مزرعة نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع المزرعة', type: 'select', options: [ { value: 'crop', label: 'محاصيل حقلية' }, { value: 'orchard', label: 'أشجار مثمرة' }, { value: 'greenhouse', label: 'بيوت محمية' }, { value: 'livestock', label: 'تربية حيوانية' }, { value: 'mixed', label: 'مختلطة' } ], default: 'crop' },
            { name: 'areaUnits', label: 'المساحة (هكتار)', type: 'number', min: 0.1, step: 0.1, default: 10 },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2018 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'qualityScore', label: 'جودة المحصول/الإنتاج (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'landQualityScore', label: 'جودة الأرض (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'waterAvailabilityScore', label: 'توفر المياه (1-10)', type: 'number', min: 1, max: 10, default: 6 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر شراء الأرض/المزرعة', type: 'number', min: 0, default: 500000 },
            { name: 'developmentCost', label: 'تكاليف التطوير', type: 'number', min: 0, default: 200000 },
            { name: 'equipmentCost', label: 'تكلفة المعدات', type: 'number', min: 0, default: 100000 },
            { name: 'installationCost', label: 'تكاليف التركيب', type: 'number', min: 0, default: 30000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'usefulLifeYears', label: 'العمر الإنتاجي (سنة)', type: 'number', min: 1, default: 20 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 80000 },
            { name: 'biologicalAgeYears', label: 'العمر البيولوجي (سنوات)', type: 'number', min: 0, default: 5 },
            { name: 'mortalityRate', label: 'معدل الهلاك/الفقد (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
          ],
          // 5. Market
          [
            { name: 'yieldPerUnit', label: 'الإنتاجية للوحدة (طن/هكتار)', type: 'number', min: 0, step: 0.1, default: 5 },
            { name: 'marketPricePerUnit', label: 'السعر السوقي للوحدة', type: 'number', min: 0, default: 1000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'الإيراد السنوي', type: 'number', min: 0, default: 100000 },
            { name: 'feedCost', label: 'تكلفة التغذية/الأسمدة', type: 'number', min: 0, default: 20000 },
            { name: 'veterinaryCost', label: 'تكلفة الرعاية البيطرية/المبيدات', type: 'number', min: 0, default: 10000 },
            { name: 'storageCost', label: 'تكلفة التخزين', type: 'number', min: 0, default: 8000 },
            { name: 'otherOperatingCosts', label: 'تكاليف تشغيلية أخرى', type: 'number', min: 0, default: 15000 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'environmentalRisk', label: 'المخاطر البيئية/المناخية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'قيمة شهادات العضوية/الحلال', type: 'number', min: 0, default: 20000 },
            { name: 'brandPremium', label: 'علاوة العلامة التجارية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
            { name: 'waterRightsValue', label: 'قيمة حقوق المياه', type: 'number', min: 0, default: 30000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'خطة الأتمتة/الرقمنة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        livestock: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الثروة الحيوانية', type: 'text', placeholder: 'قطيع نموذجي', default: 'قطيع نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الثروة', type: 'select', options: [ { value: 'cattle', label: 'أبقار' }, { value: 'sheep', label: 'أغنام' }, { value: 'poultry', label: 'دواجن' }, { value: 'camels', label: 'إبل' }, { value: 'other', label: 'أخرى' } ], default: 'cattle' },
            { name: 'quantityUnits', label: 'عدد الرؤوس', type: 'number', min: 1, default: 100 },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2020 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'healthScore', label: 'الصحة العامة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'qualityScore', label: 'جودة السلالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'biologicalAgeYears', label: 'متوسط العمر (سنوات)', type: 'number', min: 0, default: 3 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'تكلفة الشراء', type: 'number', min: 0, default: 300000 },
            { name: 'developmentCost', label: 'تكاليف الحظيرة/المسكن', type: 'number', min: 0, default: 80000 },
            { name: 'equipmentCost', label: 'تكلفة المعدات', type: 'number', min: 0, default: 30000 },
            { name: 'installationCost', label: 'تكاليف التجهيز', type: 'number', min: 0, default: 10000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'usefulLifeYears', label: 'العمر الإنتاجي (سنة)', type: 'number', min: 1, default: 8 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 50000 },
            { name: 'mortalityRate', label: 'معدل الهلاك السنوي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
          ],
          // 5. Market
          [
            { name: 'marketPricePerUnit', label: 'السعر السوقي للرأس', type: 'number', min: 0, default: 3500 },
            { name: 'yieldPerUnit', label: 'الإنتاجية السنوية للرأس (حليب/لحم كجم)', type: 'number', min: 0, default: 200 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'الإيراد السنوي', type: 'number', min: 0, default: 120000 },
            { name: 'feedCost', label: 'تكلفة العلف', type: 'number', min: 0, default: 40000 },
            { name: 'veterinaryCost', label: 'الرعاية البيطرية', type: 'number', min: 0, default: 12000 },
            { name: 'storageCost', label: 'تكلفة التخزين/النقل', type: 'number', min: 0, default: 8000 },
            { name: 'otherOperatingCosts', label: 'تكاليف تشغيلية أخرى', type: 'number', min: 0, default: 10000 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'environmentalRisk', label: 'المخاطر البيئية/الوبائية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'قيمة الشهادات/التسجيلات', type: 'number', min: 0, default: 15000 },
            { name: 'brandPremium', label: 'علاوة المزرعة/العلامة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
            { name: 'waterRightsValue', label: 'قيمة حقوق المراعي/المياه', type: 'number', min: 0, default: 10000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 6 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'خطة التحسين الوراثي/الأتمتة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        naturalResourcesMining: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل', type: 'text', placeholder: 'منجم نموذجي', default: 'منجم نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع المورد', type: 'select', options: [ { value: 'mineral', label: 'معدني' }, { value: 'quarry', label: 'محجر' }, { value: 'salt', label: 'ملح' }, { value: 'other', label: 'أخرى' } ], default: 'mineral' },
            { name: 'reserveUnits', label: 'الاحتياطي (طن/وحدة)', type: 'number', min: 0, default: 100000 },
            { name: 'operatingYears', label: 'سنوات التشغيل', type: 'number', min: 0, default: 5 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'reserveGrade', label: 'درجة الاحتياطي/الجودة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.8 },
            { name: 'environmentalComplianceScore', label: 'الالتزام البيئي (1-10)', type: 'number', min: 1, max: 10, default: 7 },
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'تكلفة الأرض/الترخيص', type: 'number', min: 0, default: 1000000 },
            { name: 'developmentCost', label: 'تكاليف التطوير/الاستكشاف', type: 'number', min: 0, default: 2000000 },
            { name: 'equipmentCost', label: 'تكلفة المعدات', type: 'number', min: 0, default: 1500000 },
            { name: 'acquisitionCost', label: 'تكاليف الاكتساب', type: 'number', min: 0, default: 200000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'depletionRate', label: 'معدل الاستنزاف (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'accumulatedDepletion', label: 'الاستنزاف المتراكم', type: 'number', min: 0, default: 500000 },
            { name: 'licenseExpiryYears', label: 'سنوات باقية من الترخيص', type: 'number', min: 1, max: 100, default: 15 },
          ],
          // 5. Market
          [
            { name: 'commodityPricePerUnit', label: 'السعر السوقي للوحدة', type: 'number', min: 0, default: 500 },
            { name: 'extractionCostPerUnit', label: 'تكلفة الاستخراج للوحدة', type: 'number', min: 0, default: 250 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
          ],
          // 6. Income
          [
            { name: 'utilizationRate', label: 'معدل الاستغلال السنوي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
            { name: 'annualFixedCosts', label: 'التكاليف الثابتة السنوية', type: 'number', min: 0, default: 500000 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.1 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'environmentalRisk', label: 'المخاطر البيئية (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'تقلب السلعة (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'geopoliticalRisk', label: 'المخاطر الجيوسياسية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'licensesValue', label: 'قيمة التراخيص', type: 'number', min: 0, default: 300000 },
            { name: 'strategicValue', label: 'القيمة الاستراتيجية', type: 'number', min: 0, default: 200000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.07 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 18 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'خطة الأتمتة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        oilGas: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل', type: 'text', placeholder: 'حقل نفطي نموذجي', default: 'حقل نفطي نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الظهران', default: 'الظهران' },
            { name: 'assetType', label: 'نوع الأصل', type: 'select', options: [ { value: 'oilField', label: 'حقل نفط' }, { value: 'gasField', label: 'حقل غاز' }, { value: 'well', label: 'بئر' }, { value: 'pipeline', label: 'أنابيب' }, { value: 'other', label: 'أخرى' } ], default: 'oilField' },
            { name: 'reserveUnits', label: 'الاحتياطي (برميل/مليون قدم مكعب)', type: 'number', min: 0, default: 5000000 },
            { name: 'operatingYears', label: 'سنوات التشغيل', type: 'number', min: 0, default: 8 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'reserveGrade', label: 'جودة الاحتياطي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.85 },
            { name: 'environmentalComplianceScore', label: 'الالتزام البيئي (1-10)', type: 'number', min: 1, max: 10, default: 8 },
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'تكلفة الامتياز/الأرض', type: 'number', min: 0, default: 5000000 },
            { name: 'developmentCost', label: 'تكاليف الحفر/التطوير', type: 'number', min: 0, default: 10000000 },
            { name: 'equipmentCost', label: 'تكلفة المنشآت/الآبار', type: 'number', min: 0, default: 8000000 },
            { name: 'acquisitionCost', label: 'تكاليف الاكتساب', type: 'number', min: 0, default: 1000000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'depletionRate', label: 'معدل الاستنزاف (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'accumulatedDepletion', label: 'الاستنزاف المتراكم', type: 'number', min: 0, default: 3000000 },
            { name: 'licenseExpiryYears', label: 'سنوات باقية من الامتياز', type: 'number', min: 1, max: 100, default: 20 },
          ],
          // 5. Market
          [
            { name: 'commodityPricePerUnit', label: 'سعر النفط/الغاز للوحدة', type: 'number', min: 0, default: 75 },
            { name: 'extractionCostPerUnit', label: 'تكلفة الاستخراج للوحدة', type: 'number', min: 0, default: 25 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.02 },
          ],
          // 6. Income
          [
            { name: 'utilizationRate', label: 'معدل الإنتاج السنوي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.08 },
            { name: 'annualFixedCosts', label: 'التكاليف الثابتة السنوية', type: 'number', min: 0, default: 2000000 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.1 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'environmentalRisk', label: 'المخاطر البيئية (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'تقلب الأسعار (0-10)', type: 'number', min: 0, max: 10, default: 7 },
            { name: 'geopoliticalRisk', label: 'المخاطر الجيوسياسية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
          ],
          // 8. Intangibles
          [
            { name: 'licensesValue', label: 'قيمة تراخيص/امتيازات', type: 'number', min: 0, default: 1000000 },
            { name: 'strategicValue', label: 'القيمة الاستراتيجية', type: 'number', min: 0, default: 2000000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 18 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.02 },
            { name: 'automationPlan', label: 'خطة الأتمتة/التقنية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        infrastructure: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل', type: 'text', placeholder: 'طريق/برج اتصالات نموذجي', default: 'أصل بنية تحتية نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الأصل', type: 'select', options: [ { value: 'road', label: 'طريق' }, { value: 'bridge', label: 'جسر' }, { value: 'tower', label: 'برج اتصالات' }, { value: 'utility', label: 'مرافق عامة' }, { value: 'logistics', label: 'بنية تحتية لوجستية' }, { value: 'other', label: 'أخرى' } ], default: 'tower' },
            { name: 'capacityUnits', label: 'السعة/الطول (كم/وحدة)', type: 'number', min: 0, default: 10 },
            { name: 'operatingYears', label: 'سنوات التشغيل', type: 'number', min: 0, default: 5 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'utilizationRate', label: 'معدل الاستخدام (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'environmentalComplianceScore', label: 'الالتزام البيئي (1-10)', type: 'number', min: 1, max: 10, default: 7 },
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'تكلفة الأرض/الحقوق', type: 'number', min: 0, default: 2000000 },
            { name: 'developmentCost', label: 'تكاليف البناء/التطوير', type: 'number', min: 0, default: 5000000 },
            { name: 'equipmentCost', label: 'تكلفة المعدات', type: 'number', min: 0, default: 1500000 },
            { name: 'acquisitionCost', label: 'تكاليف الاكتساب', type: 'number', min: 0, default: 300000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'depletionRate', label: 'معدل الإهلاك/الاستنزاف (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
            { name: 'accumulatedDepletion', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 800000 },
            { name: 'licenseExpiryYears', label: 'سنوات باقية من العقد/الترخيص', type: 'number', min: 1, max: 100, default: 25 },
          ],
          // 5. Market
          [
            { name: 'tariffRevenuePerUnit', label: 'الإيراد للوحدة/رسوم الاستخدام', type: 'number', min: 0, default: 50000 },
            { name: 'comparableTransactionValue', label: 'قيمة صفقات مقارنة', type: 'number', min: 0, default: 8000000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'annualFixedCosts', label: 'التكاليف الثابتة السنوية', type: 'number', min: 0, default: 800000 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.08 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'environmentalRisk', label: 'المخاطر البيئية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب الطلب (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'geopoliticalRisk', label: 'المخاطر الجيوسياسية (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'licensesValue', label: 'قيمة العقود/التراخيص', type: 'number', min: 0, default: 500000 },
            { name: 'strategicValue', label: 'القيمة الاستراتيجية', type: 'number', min: 0, default: 1000000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 15 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'خطة الرقمنة/الصيانة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
        ],
        intellectualProperty: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم المحفظة', type: 'text', placeholder: 'محفظة ملكية فكرية نموذجية', default: 'محفظة ملكية فكرية نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الملكية الفكرية', type: 'select', options: [ { value: 'portfolio', label: 'محفظة متنوعة' }, { value: 'tradeSecrets', label: 'أسرار تجارية' }, { value: 'industrialDesigns', label: 'تصاميم صناعية' }, { value: 'other', label: 'أخرى' } ], default: 'portfolio' },
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 10 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحماية/القوة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'intangibleStrength', label: 'قوة الملكية (0-100)', type: 'number', min: 0, max: 100, default: 65 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'تكلفة التطوير/الشراء', type: 'number', min: 0, default: 1000000 },
            { name: 'accumulatedAmortization', label: 'الإطفاء المتراكم', type: 'number', min: 0, default: 200000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 10 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'قيمة صفقات مقارنة', type: 'number', min: 0, default: 2500000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'الإيرادات السنوية المرتبطة', type: 'number', min: 0, default: 2000000 },
            { name: 'royaltyRate', label: 'معدل الاستحقاق (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'growthRate', label: 'معدل النمو (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.04 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 60 },
            { name: 'marketShare', label: 'حصة السوق (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'خط الإنتاج الابتكاري (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        brandsTrademarks: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم العلامة', type: 'text', placeholder: 'علامة تجارية نموذجية', default: 'علامة تجارية نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع العلامة', type: 'select', options: [ { value: 'brand', label: 'علامة تجارية' }, { value: 'trademark', label: 'علامة مسجلة' }, { value: 'domain', label: 'اسم نطاق' }, { value: 'other', label: 'أخرى' } ], default: 'brand' },
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 15 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الاعتراف (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 70 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'تكلفة التطوير/الشراء', type: 'number', min: 0, default: 500000 },
            { name: 'accumulatedAmortization', label: 'الإطفاء المتراكم', type: 'number', min: 0, default: 100000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 15 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'قيمة صفقات مقارنة', type: 'number', min: 0, default: 3000000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'الإيرادات السنوية المرتبطة', type: 'number', min: 0, default: 3000000 },
            { name: 'royaltyRate', label: 'معدل الاستحقاق (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.04 },
            { name: 'growthRate', label: 'معدل النمو (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.05 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 70 },
            { name: 'marketShare', label: 'حصة السوق (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 10 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'خط الإنتاج الابتكاري (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.45 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
        ],
        patents: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم البراءة/المحفظة', type: 'text', placeholder: 'براءة اختراع نموذجية', default: 'براءة اختراع نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع البراءة', type: 'select', options: [ { value: 'invention', label: 'اختراع' }, { value: 'utilityModel', label: 'نموذج منفعة' }, { value: 'design', label: 'تصميم صناعي' }, { value: 'portfolio', label: 'محفظة' } ], default: 'invention' },
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 12 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة القوة التقنية (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'intangibleStrength', label: 'قوة البراءة (0-100)', type: 'number', min: 0, max: 100, default: 65 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'تكلفة التطوير/الشراء', type: 'number', min: 0, default: 400000 },
            { name: 'accumulatedAmortization', label: 'الإطفاء المتراكم', type: 'number', min: 0, default: 80000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 12 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'قيمة صفقات مقارنة', type: 'number', min: 0, default: 1500000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'الإيرادات السنوية المرتبطة', type: 'number', min: 0, default: 1500000 },
            { name: 'royaltyRate', label: 'معدل الاستحقاق (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'growthRate', label: 'معدل النمو (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.03 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 7 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 5 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'قوة التقنية (0-100)', type: 'number', min: 0, max: 100, default: 60 },
            { name: 'marketShare', label: 'حصة السوق (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.08 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'innovationPipeline', label: 'خط الإنتاج الابتكاري (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        copyrightsContent: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم المحتوى/المحفظة', type: 'text', placeholder: 'مكتبة محتوى نموذجية', default: 'مكتبة محتوى نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع المحتوى', type: 'select', options: [ { value: 'books', label: 'كتب' }, { value: 'music', label: 'موسيقى' }, { value: 'video', label: 'فيديو/أفلام' }, { value: 'software', label: 'برمجيات' }, { value: 'database', label: 'قواعد بيانات' }, { value: 'other', label: 'أخرى' } ], default: 'video' },
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 10 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الجودة/الشهرة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'intangibleStrength', label: 'قوة المحتوى (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'تكلفة الإنتاج/الشراء', type: 'number', min: 0, default: 300000 },
            { name: 'accumulatedAmortization', label: 'الإطفاء المتراكم', type: 'number', min: 0, default: 60000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 10 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'قيمة صفقات مقارنة', type: 'number', min: 0, default: 800000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'الإيرادات السنوية من المحتوى', type: 'number', min: 0, default: 600000 },
            { name: 'royaltyRate', label: 'معدل الاستحقاق (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.07 },
            { name: 'growthRate', label: 'معدل النمو (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.04 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 55 },
            { name: 'marketShare', label: 'حصة السوق (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.08 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 10 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'خط الإنتاج الابتكاري (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        franchises: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الامتياز', type: 'text', placeholder: 'امتياز تجاري نموذجي', default: 'امتياز تجاري نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الامتياز', type: 'select', options: [ { value: 'restaurant', label: 'مطاعم' }, { value: 'retail', label: 'تجزئة' }, { value: 'service', label: 'خدمات' }, { value: 'education', label: 'تعليم' }, { value: 'healthcare', label: 'صحة' }, { value: 'other', label: 'أخرى' } ], default: 'restaurant' },
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 10 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة أداء الامتياز (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'legalProtectionScore', label: 'قوة اتفاقية الامتياز (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'intangibleStrength', label: 'قوة العلامة المانحة (0-100)', type: 'number', min: 0, max: 100, default: 70 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'رسوم الامتياز الأولية', type: 'number', min: 0, default: 400000 },
            { name: 'accumulatedAmortization', label: 'الإطفاء المتراكم', type: 'number', min: 0, default: 80000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 10 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'قيمة صفقات مقارنة', type: 'number', min: 0, default: 1200000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'إيرادات الامتياز السنوية', type: 'number', min: 0, default: 1500000 },
            { name: 'royaltyRate', label: 'نسبة الامتياز (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'growthRate', label: 'معدل النمو (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.05 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'قوة العلامة المانحة (0-100)', type: 'number', min: 0, max: 100, default: 75 },
            { name: 'marketShare', label: 'حصة السوق (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.07 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 9 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'خط التوسع الجغرافي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
        ],
        licensesPermits: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الترخيص/التصريح', type: 'text', placeholder: 'ترخيص نموذجي', default: 'ترخيص نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الترخيص', type: 'select', options: [ { value: 'commercial', label: 'تجاري' }, { value: 'industrial', label: 'صناعي' }, { value: 'telecom', label: 'اتصالات' }, { value: 'healthcare', label: 'صحي' }, { value: 'financial', label: 'مالي' }, { value: 'other', label: 'أخرى' } ], default: 'commercial' },
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 8 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة صلاحية الترخيص (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'intangibleStrength', label: 'ندرة/قوة الترخيص (0-100)', type: 'number', min: 0, max: 100, default: 65 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'تكلفة الحصول على الترخيص', type: 'number', min: 0, default: 250000 },
            { name: 'accumulatedAmortization', label: 'الإطفاء المتراكم', type: 'number', min: 0, default: 50000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'العمر المتبقي (سنوات)', type: 'number', min: 1, max: 30, default: 8 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'قيمة صفقات مقارنة', type: 'number', min: 0, default: 600000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'الإيرادات السنوية المرتبطة', type: 'number', min: 0, default: 800000 },
            { name: 'royaltyRate', label: 'رسوم الترخيص (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
            { name: 'growthRate', label: 'معدل النمو (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.03 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.1 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'قيمة الترخيص للعلامة (0-100)', type: 'number', min: 0, max: 100, default: 60 },
            { name: 'marketShare', label: 'حصة السوق (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 8 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'innovationPipeline', label: 'فرص التجديد/التوسع (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        financialAssets: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل', type: 'text', placeholder: 'محفظة أسهم نموذجية', default: 'محفظة أسهم نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الأصل المالي', type: 'select', options: [ { value: 'stocks', label: 'أسهم' }, { value: 'bonds', label: 'سندات' }, { value: 'etf', label: 'صناديق متداولة' }, { value: 'loan', label: 'قرض/دين' }, { value: 'portfolio', label: 'محفظة مختلطة' } ], default: 'stocks' },
            { name: 'quantityUnits', label: 'الكمية/عدد الوحدات', type: 'number', min: 0, step: 0.01, default: 1000 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الجودة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'liquidityScore', label: 'درجة السيولة (0-10)', type: 'number', min: 0, max: 10, default: 8 },
            { name: 'custodyScore', label: 'درجة أمن الحفظ (1-10)', type: 'number', min: 1, max: 10, default: 9 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'التكلفة الأصلية', type: 'number', min: 0, default: 250000 },
            { name: 'storageCost', label: 'رسوم الحفظ السنوية', type: 'number', min: 0, default: 1000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'holdingPeriodYears', label: 'فترة الاحتفاظ (سنوات)', type: 'number', min: 0, default: 2 },
          ],
          // 5. Market
          [
            { name: 'marketPricePerUnit', label: 'السعر السوقي للوحدة', type: 'number', min: 0, step: 0.01, default: 250 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'dividendYield', label: 'عائد التوزيعات (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'قيمة الاستراتيجية/العلامة', type: 'number', min: 0, default: 0 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.015 },
            { name: 'buyerPoolDepth', label: 'عمق السيولة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 1 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        cryptoDigital: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم الأصل الرقمي', type: 'text', placeholder: 'بيتكوين/محفظة رقمية', default: 'أصل رقمي نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الأصل الرقمي', type: 'select', options: [ { value: 'bitcoin', label: 'بيتكوين' }, { value: 'ethereum', label: 'إيثيريوم' }, { value: 'altcoin', label: 'عملة بديلة' }, { value: 'nft', label: 'NFT' }, { value: 'token', label: 'رمز رقمي' }, { value: 'other', label: 'أخرى' } ], default: 'bitcoin' },
            { name: 'quantityUnits', label: 'الكمية', type: 'number', min: 0, step: 1e-06, default: 1 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الجودة/الندرة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'authenticationScore', label: 'درجة التحقق/الأمان (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'liquidityScore', label: 'درجة السيولة (0-10)', type: 'number', min: 0, max: 10, default: 7 },
            { name: 'custodyScore', label: 'درجة أمن الحفظ (1-10)', type: 'number', min: 1, max: 10, default: 8 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'التكلفة الأصلية', type: 'number', min: 0, default: 100000 },
            { name: 'storageCost', label: 'رسوم الحفظ السنوية', type: 'number', min: 0, default: 500 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'holdingPeriodYears', label: 'فترة الاحتفاظ (سنوات)', type: 'number', min: 0, default: 1 },
          ],
          // 5. Market
          [
            { name: 'marketPricePerUnit', label: 'السعر السوقي', type: 'number', min: 0, step: 0.01, default: 250000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'stakingYield', label: 'عائد Staking (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.04 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'التقلب (0-10)', type: 'number', min: 0, max: 10, default: 8 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 5 },
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'قيمة الندرة/المجتمع', type: 'number', min: 0, default: 0 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.025 },
            { name: 'buyerPoolDepth', label: 'عمق السيولة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 1 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 45 },
          ],
        ],
        artCollectibles: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم العمل/المجموعة', type: 'text', placeholder: 'عمل فني نموذجي', default: 'عمل فني نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الأصل', type: 'select', options: [ { value: 'painting', label: 'لوحة' }, { value: 'sculpture', label: 'نحت' }, { value: 'antique', label: 'تحفة' }, { value: 'watch', label: 'ساعة فاخرة' }, { value: 'collectible', label: 'قطعة نادرة' }, { value: 'other', label: 'أخرى' } ], default: 'painting' },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2018 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 9 },
            { name: 'authenticationScore', label: 'درجة المصداقية/التوثيق (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'rarityScore', label: 'درجة الندرة (0-100)', type: 'number', min: 0, max: 100, default: 70 },
            { name: 'provenanceScore', label: 'درجة الأصالة/المصدر (0-100)', type: 'number', min: 0, max: 100, default: 75 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'سعر الشراء', type: 'number', min: 0, default: 500000 },
            { name: 'storageCost', label: 'تكلفة التخزين/التأمين السنوية', type: 'number', min: 0, default: 5000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'holdingPeriodYears', label: 'فترة الاحتفاظ (سنوات)', type: 'number', min: 0, default: 5 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'قيمة صفقات مقارنة', type: 'number', min: 0, default: 800000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'dividendYield', label: 'عائد الإيجار/عرض (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.0 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 5 },
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'قيمة الفنان/العلامة', type: 'number', min: 0, default: 0 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.1 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        softwareTechnology: [
          // 1. Identity
          [
            { name: 'assetName', label: 'اسم المنتج/الشركة', type: 'text', placeholder: 'منتج SaaS نموذجي', default: 'منتج SaaS نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع التقنية', type: 'select', options: [ { value: 'saas', label: 'SaaS' }, { value: 'mobileApp', label: 'تطبيق جوال' }, { value: 'platform', label: 'منصة' }, { value: 'ai', label: 'AI/تعلم آلي' }, { value: 'other', label: 'أخرى' } ], default: 'saas' },
            { name: 'customerCount', label: 'عدد العملاء', type: 'number', min: 0, default: 500 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'جودة المنتج (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'techMoatScore', label: 'درجة الحماية التقنية (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'churnRate', label: 'معدل الرحيل (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
          ],
          // 3. Historical Cost
          [
            { name: 'developmentCost', label: 'تكلفة التطوير', type: 'number', min: 0, default: 800000 },
            { name: 'accumulatedAmortization', label: 'الإطفاء المتراكم', type: 'number', min: 0, default: 150000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'annualRecurringRevenue', label: 'ARR (الإيراد المتكرر السنوي)', type: 'number', min: 0, default: 1200000 },
            { name: 'averageRevenuePerUser', label: 'متوسط الإيراد للعميل (ARPU)', type: 'number', min: 0, default: 200 },
            { name: 'grossMargin', label: 'هامش الربح الإجمالي (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.75 },
          ],
          // 5. Market
          [
            { name: 'revenueMultiple', label: 'مضاعف الإيرادات', type: 'number', min: 0, step: 0.5, default: 8 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualOpex', label: 'المصاريف التشغيلية السنوية', type: 'number', min: 0, default: 600000 },
            { name: 'growthRate', label: 'معدل نمو الإيرادات (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.2 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.15 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'technologyObsolescenceRisk', label: 'مخاطر العطل التقني (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'lifetimeValue', label: 'قيمة العميل مدى الحياة (LTV)', type: 'number', min: 0, default: 1200 },
            { name: 'customerAcquisitionCost', label: 'تكلفة اكتساب العميل (CAC)', type: 'number', min: 0, default: 200 },
            { name: 'proprietaryTechnology', label: 'التقنية الملكية (0-100)', type: 'number', min: 0, max: 100, default: 70 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 9 },
          ],
          // 10. Future / Growth
          [
            { name: 'terminalGrowth', label: 'نمو النهاية (0-1)', type: 'number', min: 0, max: 0.1, step: 0.01, default: 0.03 },
            { name: 'projectionYears', label: 'سنوات الإسقاط', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
        ],
        maritimeAsset: [
          // 1. الهوية
          [
            { name: 'assetName', label: 'اسم الناقلة/السفينة', type: 'text', placeholder: 'سفينة نموذجية', default: 'سفينة نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة/الموانئ', type: 'text', placeholder: 'جدة', default: 'جدة' },
            { name: 'assetType', label: 'نوع الأصل البحري', type: 'select', options: [ { value: 'vessel', label: 'سفينة شحن' }, { value: 'tanker', label: 'ناقلة نفط' }, { value: 'passenger', label: 'سفينة ركاب' }, { value: 'tugboat', label: 'قاطرة بحرية' }, { value: 'fishing', label: 'سفينة صيد' }, { value: 'other', label: 'أخرى' } ], default: 'vessel' },
            { name: 'yearBuilt', label: 'سنة البناء', type: 'number', min: 1900, max: 2030, default: 2010 },
          ],
          // 2. الحالة
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'مستوى الصيانة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'inspectionScore', label: 'درجة الفحص الصنفي (1-10)', type: 'number', min: 1, max: 10, default: 7 },
          ],
          // 3. التكلفة التاريخية
          [
            { name: 'purchasePrice', label: 'سعر الشراء', type: 'number', min: 0, default: 5000000 },
            { name: 'refitCosts', label: 'تكاليف التجديد', type: 'number', min: 0, default: 500000 },
            { name: 'regulatoryCertificationValue', label: 'قيمة الشهادات/التصنيفات', type: 'number', min: 0, default: 200000 },
            { name: 'acquisitionCosts', label: 'مصاريف الاكتساب', type: 'number', min: 0, default: 150000 },
          ],
          // 4. الإهلاك
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 25 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 1200000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 5. السوق
          [
            { name: 'replacementCostNew', label: 'تكلفة الاستبدال الجديدة', type: 'number', min: 0, default: 6000000 },
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 4500000 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
          ],
          // 6. الإيراد
          [
            { name: 'dailyCharterRate', label: 'أجر التأجير اليومي', type: 'number', min: 0, default: 15000 },
            { name: 'operatingDaysPerYear', label: 'أيام التشغيل السنوية', type: 'number', min: 0, max: 365, default: 220 },
            { name: 'utilizationRate', label: 'معدل الاستخدام (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'annualOperatingCost', label: 'التكلفة التشغيلية السنوية', type: 'number', min: 0, default: 1200000 },
            { name: 'capRate', label: 'معدل العائد الرأسمالي (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.1 },
          ],
          // 7. المخاطر
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'تقلب سوق الشحن (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'environmentalRisk', label: 'المخاطر البيئية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'geopoliticalRisk', label: 'المخاطر الجيوسياسية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. الأصول غير الملموسة
          [
            { name: 'licensesValue', label: 'قيمة التراخيص/التسجيل', type: 'number', min: 0, default: 300000 },
            { name: 'routeValue', label: 'قيمة العقود/الخطوط', type: 'number', min: 0, default: 500000 },
            { name: 'brandStrength', label: 'قوة المشغل/العلامة (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
          // 9. التخارج
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. المستقبل
          [
            { name: 'marketGrowthRate', label: 'نمو سوق الشحن (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'خطط التحديث/الكفاءة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        logisticsAsset: [
          // 1. الهوية
          [
            { name: 'assetName', label: 'اسم المنشأة اللوجستية', type: 'text', placeholder: 'مستودع نموذجي', default: 'مستودع نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الأصل اللوجستي', type: 'select', options: [ { value: 'warehouse', label: 'مستودع' }, { value: 'distributionCenter', label: 'مركز توزيع' }, { value: 'fleet', label: 'أسطول نقل' }, { value: 'coldStorage', label: 'تخزين مبرد' }, { value: 'other', label: 'أخرى' } ], default: 'warehouse' },
            { name: 'areaSqm', label: 'المساحة (م²)', type: 'number', min: 1, default: 5000 },
            { name: 'yearBuilt', label: 'سنة البناء', type: 'number', min: 1900, max: 2030, default: 2015 },
          ],
          // 2. الحالة
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'occupancyRate', label: 'نسبة الإشغال/الاستخدام (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.75 },
            { name: 'automationPlan', label: 'مستوى الأتمتة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
          ],
          // 3. التكلفة التاريخية
          [
            { name: 'landCost', label: 'تكلفة الأرض', type: 'number', min: 0, default: 2000000 },
            { name: 'buildingCost', label: 'تكلفة المبنى', type: 'number', min: 0, default: 4000000 },
            { name: 'equipmentCost', label: 'تكلفة المعدات/الرافعات', type: 'number', min: 0, default: 800000 },
            { name: 'rackingCost', label: 'تكلفة الرفوف/أنظمة التخزين', type: 'number', min: 0, default: 400000 },
            { name: 'improvementCosts', label: 'تكاليف التحسينات', type: 'number', min: 0, default: 300000 },
          ],
          // 4. الإهلاك
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 40 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 1200000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 5. السوق
          [
            { name: 'comparablePricePerSqm', label: 'السعر المقارن للم²', type: 'number', min: 0, default: 1500 },
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 0 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. الإيراد
          [
            { name: 'annualRentalRevenue', label: 'الإيراد السنوي (إيجار/عقود)', type: 'number', min: 0, default: 0 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'capRate', label: 'معدل العائد الرأسمالي (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.08 },
          ],
          // 7. المخاطر
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. الأصول غير الملموسة
          [
            { name: 'locationPremium', label: 'علاوة الموقع (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'permitsValue', label: 'قيمة التراخيص/التصاريح', type: 'number', min: 0, default: 200000 },
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
          // 9. التخارج
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. المستقبل
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'automationPlan', label: 'خطة الأتمتة/الرقمنة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        fuelStation: [
          // 1. الهوية
          [
            { name: 'assetName', label: 'اسم المحطة', type: 'text', placeholder: 'محطة وقود نموذجية', default: 'محطة وقود نموذجية' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع المحطة', type: 'select', options: [ { value: 'highway', label: 'طريق سريع' }, { value: 'urban', label: 'حضرية' }, { value: 'remote', label: 'منطقة نائية' }, { value: 'truckStop', label: 'استراحة شاحنات' }, { value: 'other', label: 'أخرى' } ], default: 'highway' },
            { name: 'yearBuilt', label: 'سنة البناء', type: 'number', min: 1900, max: 2030, default: 2015 },
          ],
          // 2. الحالة
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'occupancyRate', label: 'معدل الاستخدام (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.9 },
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
          // 3. التكلفة التاريخية
          [
            { name: 'landCost', label: 'تكلفة الأرض', type: 'number', min: 0, default: 1500000 },
            { name: 'constructionCost', label: 'تكلفة الإنشاء', type: 'number', min: 0, default: 1200000 },
            { name: 'equipmentCost', label: 'تكلفة المعدات', type: 'number', min: 0, default: 800000 },
            { name: 'tanksPumpsCost', label: 'تكلفة الخزانات/المضخات', type: 'number', min: 0, default: 600000 },
            { name: 'improvementCosts', label: 'تكاليف التحسينات', type: 'number', min: 0, default: 200000 },
          ],
          // 4. الإهلاك
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 30 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 1000000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 5. السوق
          [
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 0 },
            { name: 'trafficGrowthRate', label: 'معدل نمو الحركة (0-1)', type: 'number', min: 0, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
          ],
          // 6. الإيراد
          [
            { name: 'dailyFuelVolume', label: 'حجم الوقود اليومي (لتر)', type: 'number', min: 0, default: 5000 },
            { name: 'marginPerLiter', label: 'هامش الربح للتر (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'annualConvenienceRevenue', label: 'إيرادات المتجر/الخدمات سنوياً', type: 'number', min: 0, default: 400000 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'capRate', label: 'معدل العائد الرأسمالي (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.1 },
          ],
          // 7. المخاطر
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'environmentalRisk', label: 'المخاطر البيئية (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'تقلب الأسعار (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. الأصول غير الملموسة
          [
            { name: 'permitsValue', label: 'قيمة التراخيص', type: 'number', min: 0, default: 300000 },
            { name: 'locationPremium', label: 'علاوة الموقع (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
          ],
          // 9. التخارج
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 9 },
          ],
          // 10. المستقبل
          [
            { name: 'trafficGrowthRate', label: 'نمو الحركة (0-1)', type: 'number', min: 0, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'خطة التحسين/الخدمات (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        beautyWellness: [
          // 1. الهوية
          [
            { name: 'assetName', label: 'اسم المركز', type: 'text', placeholder: 'صالون/سبا نموذجي', default: 'مركز تجميل وصحة نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع النشاط', type: 'select', options: [ { value: 'salon', label: 'صالون تجميل' }, { value: 'spa', label: 'سبا' }, { value: 'wellness', label: 'مركز عافية' }, { value: 'clinic', label: 'عيادة جلدية/تجميل' }, { value: 'other', label: 'أخرى' } ], default: 'salon' },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2018 },
          ],
          // 2. الحالة
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'occupancyRate', label: 'نسبة الإشغال/الحجوزات (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
          // 3. التكلفة التاريخية
          [
            { name: 'equipmentCost', label: 'تكلفة المعدات', type: 'number', min: 0, default: 300000 },
            { name: 'leaseholdImprovements', label: 'تكاليف تأثيث المكان', type: 'number', min: 0, default: 400000 },
            { name: 'inventoryCost', label: 'تكلفة المخزون/المنتجات', type: 'number', min: 0, default: 150000 },
            { name: 'furnitureCost', label: 'تكلفة الأثاث', type: 'number', min: 0, default: 100000 },
          ],
          // 4. الإهلاك
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 10 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 150000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 5. السوق
          [
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 0 },
            { name: 'revenueMultiple', label: 'مضاعف الإيرادات', type: 'number', min: 0, step: 0.1, default: 1.2 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. الإيراد
          [
            { name: 'dailyCustomers', label: 'عدد العملاء اليومي', type: 'number', min: 0, default: 30 },
            { name: 'avgSpendPerCustomer', label: 'متوسط الإنفاق للعميل', type: 'number', min: 0, default: 200 },
            { name: 'cogsRate', label: 'نسبة تكلفة البضاعة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
            { name: 'capRate', label: 'معدل العائد الرأسمالي (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.12 },
          ],
          // 7. المخاطر
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'successionRisk', label: 'مخاطر الاستمرارية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. الأصول غير الملموسة
          [
            { name: 'recurringRevenueShare', label: 'نسبة الإيراد المتكرر (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'membershipsValue', label: 'قيمة العضويات/الباقات', type: 'number', min: 0, default: 50000 },
            { name: 'locationPremium', label: 'علاوة الموقع (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 9. التخارج
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 6 },
          ],
          // 10. المستقبل
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'automationPlan', label: 'خطة التحسين/الحجز الرقمي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        giftsStationery: [
          // 1. الهوية
          [
            { name: 'assetName', label: 'اسم المتجر', type: 'text', placeholder: 'متجر هدايا نموذجي', default: 'متجر هدايا وماليات نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع المتجر', type: 'select', options: [ { value: 'gifts', label: 'هدايا' }, { value: 'stationery', label: 'ماليات' }, { value: 'mixed', label: 'مختلط' }, { value: 'online', label: 'متجر إلكتروني' }, { value: 'other', label: 'أخرى' } ], default: 'mixed' },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2019 },
          ],
          // 2. الحالة
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'inventoryTurnover', label: 'معدل دوران المخزون (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
          // 3. التكلفة التاريخية
          [
            { name: 'inventoryCost', label: 'تكلفة المخزون', type: 'number', min: 0, default: 200000 },
            { name: 'fixturesCost', label: 'تكلفة الرفوف/الديكور', type: 'number', min: 0, default: 120000 },
            { name: 'leaseholdImprovements', label: 'تكاليف تأثيث المكان', type: 'number', min: 0, default: 150000 },
          ],
          // 4. الإهلاك
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 10 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 80000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 5. السوق
          [
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 0 },
            { name: 'revenueMultiple', label: 'مضاعف الإيرادات', type: 'number', min: 0, step: 0.1, default: 0.8 },
            { name: 'locationPremium', label: 'علاوة الموقع (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. الإيراد
          [
            { name: 'monthlyRevenue', label: 'الإيراد الشهري', type: 'number', min: 0, default: 50000 },
            { name: 'cogsRate', label: 'نسبة تكلفة البضاعة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'capRate', label: 'معدل العائد الرأسمالي (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.12 },
          ],
          // 7. المخاطر
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. الأصول غير الملموسة
          [
            { name: 'locationPremium', label: 'علاوة الموقع (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
          // 9. التخارج
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 4 },
          ],
          // 10. المستقبل
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'خطة التحول الرقمي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        furnitureAsset: [
          // 1. الهوية
          [
            { name: 'assetName', label: 'اسم المتجر/المعرض', type: 'text', placeholder: 'معرض أثاث نموذجي', default: 'معرض أثاث نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع الأثاث', type: 'select', options: [ { value: 'home', label: 'منزلي' }, { value: 'office', label: 'مكتبي' }, { value: 'mixed', label: 'مختلط' }, { value: 'custom', label: 'مخصص/حسب الطلب' }, { value: 'other', label: 'أخرى' } ], default: 'mixed' },
            { name: 'yearAcquired', label: 'سنة الاقتناء', type: 'number', min: 1900, max: 2030, default: 2018 },
          ],
          // 2. الحالة
          [
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'inventoryTurnover', label: 'معدل دوران المخزون (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
          // 3. التكلفة التاريخية
          [
            { name: 'inventoryValue', label: 'قيمة المخزون', type: 'number', min: 0, default: 500000 },
            { name: 'showroomCost', label: 'تكلفة المعرض', type: 'number', min: 0, default: 300000 },
            { name: 'warehouseCost', label: 'تكلفة المستودع', type: 'number', min: 0, default: 200000 },
            { name: 'deliveryFleetValue', label: 'قيمة أسطول التوصيل', type: 'number', min: 0, default: 150000 },
          ],
          // 4. الإهلاك
          [
            { name: 'usefulLifeYears', label: 'العمر الافتراضي (سنة)', type: 'number', min: 1, default: 15 },
            { name: 'accumulatedDepreciation', label: 'الإهلاك المتراكم', type: 'number', min: 0, default: 200000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 5. السوق
          [
            { name: 'replacementCostNew', label: 'تكلفة الاستبدال الجديدة', type: 'number', min: 0, default: 0 },
            { name: 'comparableSalesValue', label: 'قيمة المبيعات المقارنة', type: 'number', min: 0, default: 0 },
            { name: 'demandIndex', label: 'مؤشر الطلب (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'مؤشر العرض (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. الإيراد
          [
            { name: 'monthlyRevenue', label: 'الإيراد الشهري', type: 'number', min: 0, default: 80000 },
            { name: 'cogsRate', label: 'نسبة تكلفة البضاعة (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.55 },
            { name: 'operatingExpensesRate', label: 'نسبة المصاريف التشغيلية (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'capRate', label: 'معدل العائد الرأسمالي (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.12 },
          ],
          // 7. المخاطر
          [
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'تقلب السوق (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'مخاطر التركيز (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. الأصول غير الملموسة
          [
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 55 },
            { name: 'warrantyValue', label: 'قيمة الضمان/الخدمة', type: 'number', min: 0, default: 30000 },
            { name: 'locationPremium', label: 'علاوة الموقع (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 9. التخارج
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'مدة التصفية (شهر)', type: 'number', min: 1, max: 36, default: 6 },
          ],
          // 10. المستقبل
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'خطة التحول الرقمي (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        retailBusiness: [
          // 1. الهوية
          [
            { name: 'assetName', label: 'اسم النشاط التجاري', type: 'text', placeholder: 'نشاط تجزئة نموذجي', default: 'نشاط تجاري عام نموذجي' },
            { name: 'country', label: 'الدولة', type: 'text', placeholder: 'السعودية', default: 'السعودية' },
            { name: 'city', label: 'المدينة', type: 'text', placeholder: 'الرياض', default: 'الرياض' },
            { name: 'assetType', label: 'نوع التجارة', type: 'select', options: [ { value: 'general', label: 'تجارة عامة' }, { value: 'fashion', label: 'أزياء' }, { value: 'electronics', label: 'إلكترونيات' }, { value: 'food', label: 'مواد غذائية' }, { value: 'mixed', label: 'متنوعة' }, { value: 'other', label: 'أخرى' } ], default: 'general' },
            { name: 'yearsInOperation', label: 'سنوات التشغيل', type: 'number', min: 0, default: 6 },
          ],
          // 2. الحالة
          [
            { name: 'managementQuality', label: 'جودة الإدارة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'governanceScore', label: 'درجة الحوكمة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'conditionScore', label: 'درجة الحالة (1-10)', type: 'number', min: 1, max: 10, default: 7 },
          ],
          // 3. التكلفة التاريخية
          [
            { name: 'equityBookValue', label: 'القيمة الدفترية للحقوق', type: 'number', min: 0, default: 800000 },
            { name: 'inventoryValue', label: 'قيمة المخزون', type: 'number', min: 0, default: 400000 },
            { name: 'fixedAssetsValue', label: 'قيمة الأصول الثابتة', type: 'number', min: 0, default: 300000 },
            { name: 'totalLiabilities', label: 'إجمالي الالتزامات', type: 'number', min: 0, default: 250000 },
          ],
          // 4. الإهلاك
          [
            { name: 'annualCapex', label: 'الاستثمار الرأسمالي السنوي', type: 'number', min: 0, default: 80000 },
            { name: 'obsolescenceFactor', label: 'معامل العطل التقني (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 5. السوق
          [
            { name: 'annualRevenue', label: 'الإيرادات السنوية', type: 'number', min: 0, default: 2500000 },
            { name: 'ebitdaMargin', label: 'هامش EBITDA (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.12 },
            { name: 'revenueMultiple', label: 'مضاعف الإيرادات', type: 'number', min: 0, step: 0.1, default: 0.6 },
            { name: 'ebitdaMultiple', label: 'مضاعف EBITDA', type: 'number', min: 0, step: 0.5, default: 5 },
            { name: 'marketGrowthRate', label: 'معدل نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. الإيراد
          [
            { name: 'growthRate', label: 'معدل نمو الإيرادات (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'taxRate', label: 'معدل الضريبة (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'معدل الخصم (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
            { name: 'projectionYears', label: 'سنوات الإسقاط', type: 'number', min: 1, max: 10, default: 5 },
          ],
          // 7. المخاطر
          [
            { name: 'customerConcentration', label: 'تركيز العملاء (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'competitiveIntensity', label: 'شدة المنافسة (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'regulatoryRisk', label: 'المخاطر التنظيمية (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'مخاطر العملة (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. الأصول غير الملموسة
          [
            { name: 'brandStrength', label: 'قوة العلامة (0-100)', type: 'number', min: 0, max: 100, default: 55 },
            { name: 'locationPremium', label: 'علاوة الموقع (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'inventoryTurnover', label: 'معدل دوران المخزون (1-10)', type: 'number', min: 1, max: 10, default: 5 },
          ],
          // 9. التخارج
          [
            { name: 'transactionCostsRate', label: 'نسبة تكاليف البيع (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'عمق سوق المشترين (1-10)', type: 'number', min: 1, max: 10, default: 6 },
          ],
          // 10. المستقبل
          [
            { name: 'marketGrowthRate', label: 'نمو السوق (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'innovationPipeline', label: 'خطط التوسع/الابتكار (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'درجة الاستدامة ESG (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
      }
    },
    en: {
      lang: 'en',
      dir: 'ltr',
      texts: {
        activeBadge: 'Available',
        comingSoonBadge: 'Coming Soon',
        restorePrompt: 'You have a saved draft: {asset}',
        assetQuality: 'Asset Quality',
        marketStrength: 'Market Strength',
        risk: 'Risk Management',
        liquidity: 'Liquidity',
        growth: 'Growth',
        management: 'Management',
        brandStrength: 'Brand Strength',
        investmentAttractiveness: 'Investment Attractiveness',
        bookValue: 'Book Value',
        marketValue: 'Market Value',
        fairValue: 'Fair Value',
        investmentValue: 'Investment Value',
        liquidationValue: 'Liquidation Value',
        insuranceValue: 'Insurance Value',
        operatingValue: 'Operating Value',
        quickExitValue: 'Quick Exit Value',
        restructuredValue: 'Restructured Value',
        goodwillValue: 'Goodwill Value',
        goodwillImpairmentFlag: 'Goodwill Impairment Flag',
        replacementValue: 'Replacement Value',
        scenarioBase: 'Base Scenario',
        scenarioOptimistic: 'Optimistic Scenario',
        scenarioPessimistic: 'Pessimistic Scenario',
        projections: 'Future Projections',
        swotAnalysis: 'SWOT Analysis',
        strengths: 'Strengths',
        weaknesses: 'Weaknesses',
        opportunities: 'Opportunities',
        threats: 'Threats',
        executiveSummary: 'Executive Summary',
        depreciationAnalysis: 'Depreciation Analysis',
        accountingDepreciation: 'Accounting Depreciation',
        economicDepreciation: 'Economic Depreciation',
        operationalDepreciation: 'Operational Depreciation',
        environmentalDepreciation: 'Environmental Depreciation',
        technicalDepreciation: 'Technical Depreciation',
        functionalDepreciation: 'Functional Depreciation',
        maintenanceDepreciation: 'Maintenance Depreciation',
        misuseDepreciation: 'Misuse Depreciation',
        totalDepreciation: 'Total Depreciation',
        depreciationCurrentValue: 'Current Value (Depreciated)',
        depreciationFutureValue: 'Future Value',
        depreciationReplacementValue: 'Replacement Value',
        environmentalExposure: 'Environmental Exposure (0-1)',
        techObsolescenceRate: 'Tech Obsolescence Rate (0-1)',
        functionalObsolescence: 'Functional Obsolescence (0-1)',
        maintenanceNeglect: 'Maintenance Neglect (0-1)',
        misuseFactor: 'Misuse Factor (0-1)',
        projectionYears: 'Projection Years',
        inflationRate: 'Annual Inflation Rate',
        submitError: 'An error occurred while generating the valuation. Please check your inputs.',
        marketIntelligence: 'Market Intelligence',
        averageSellingPrice: 'Average Selling Price',
        averageBuyingPrice: 'Average Buying Price',
        transactionCount: 'Transaction Count',
        supplyIndex: 'Supply Index',
        demandIndex: 'Demand Index',
        competitorCount: 'Competitor Count',
        averageSaleSpeedDays: 'Avg Sale Speed (days)',
        marketInflationRate: 'Market Inflation Rate',
        marketInterestRate: 'Market Interest Rate',
        economicGrowthRate: 'Economic Growth Rate',
        marketDataSource: 'Data Source',
        marketScope: 'Scope',
        globalScope: 'Global',
        outlook: 'Outlook',
        outlookPositive: 'Positive',
        outlookNeutral: 'Neutral',
        outlookNegative: 'Negative',
        riskScore: 'Risk Score',
        confidence: 'Confidence',
        dataQualityScore: 'Data Quality',
        conditionAssessmentTitle: 'Detailed Condition Assessment',
        conditionAssessmentDesc: 'Answer the inspection points below to compute an accurate condition score. Core fields update automatically.',
        conditionAssessmentCalculate: 'Calculate Condition Score',
        conditionAssessmentReset: 'Reset',
        conditionScoreResult: 'Condition Score',
        conditionGradeResult: 'Grade',
        conditionConfidenceResult: 'Confidence',
        conditionCriticalWarning: 'Critical failures detected — score capped.',
        yes: 'Yes',
        no: 'No',
        pass: 'Pass',
        fail: 'Fail',
        conditionAssetName: 'Asset Name',
        conditionAssetIdentifier: 'Asset Identifier',
        conditionAssessmentDate: 'Assessment Date',
        conditionStatus: 'Status',
        conditionNotes: 'Notes',
        conditionSaveAssessment: 'Save Condition Assessment',
        conditionLoadPrevious: 'Load Previous Assessment',
        conditionSavedSuccess: 'Assessment saved successfully',
        conditionSaveError: 'Save failed: ',
        conditionNoAssessments: 'No previous assessments',
        conditionDraft: 'Draft',
        conditionFinal: 'Final',
        conditionArchived: 'Archived',
        conditionExportPdf: 'Export PDF',
        conditionReportTitle: 'Condition Assessment Report',
        conditionReportGenerated: 'Generated',
        conditionReportAsset: 'Asset',
        conditionReportScore: 'Condition Score',
        conditionReportGrade: 'Grade',
        conditionReportConfidence: 'Confidence',
        conditionReportPoints: 'Inspection Points',
        conditionReportCritical: 'Critical Failures',
        conditionReportNotes: 'Notes',
        conditionHistoryTitle: 'Condition Assessment History',
        conditionHistoryNoData: 'No previous assessments for this asset class'
      },
      icons: {
        realEstate: '🏢', business: '🏭', factory: '🏭', machineryEquipment: '⚙️',
        vehiclesFleet: '🚛', agricultureFarms: '🌾', livestock: '🐄',
        naturalResourcesMining: '⛏️', oilGas: '🛢️', infrastructure: '🌉',
        intellectualProperty: '💡', brandsTrademarks: '™️', patents: '📜',
        copyrightsContent: '©️', franchises: '📋', licensesPermits: '📄',
        financialAssets: '📈', cryptoDigital: '₿', commodities: '🌾',
        artCollectibles: '🎨', jewelryPreciousMetals: '💎', softwareTechnology: '💻',
        medicalEquipment: '🏥', educationalEquipment: '🎓', distressedAsset: '⚠️',
        tourismAsset: '🏖️', personalWealth: '💼', scrapSalvage: '🔩',
        maritimeAsset: '⚓', logisticsAsset: '📦', fuelStation: '⛽',
        beautyWellness: '💆', giftsStationery: '🎁', furnitureAsset: '🛋️',
        retailBusiness: '🛒'
      },
      steps: [
        { title: 'Identity', description: 'Basic identification, location and sector of the asset.' },
        { title: 'Condition', description: 'Technical, operational, maintenance and quality assessment.' },
        { title: 'Historical Cost', description: 'Original cost, improvements and acquisition expenses.' },
        { title: 'Depreciation', description: 'Useful life, accumulated depreciation and obsolescence factors.' },
        { title: 'Market', description: 'Comparable pricing, demand/supply indices and growth.' },
        { title: 'Income', description: 'Revenue, cash flows and capitalization/discount rates.' },
        { title: 'Risks', description: 'Regulatory, environmental, market and operational risks.' },
        { title: 'Intangibles', description: 'Brand, licenses, customer relationships and location premium.' },
        { title: 'Exit', description: 'Transaction costs, buyer pool depth and liquidation horizon.' },
        { title: 'Future Outlook', description: 'Market growth, infrastructure, sustainability and innovation.' }
      ],
      fieldsByClass: {
        realEstate: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'e.g. Riyadh Villa', default: 'Sample Property' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'propertyType', label: 'Property Type', type: 'select', options: [
              { value: 'residential', label: 'Residential' },
              { value: 'commercial', label: 'Commercial' },
              { value: 'industrial', label: 'Industrial' },
              { value: 'office', label: 'Office' },
              { value: 'retail', label: 'Retail' },
              { value: 'land', label: 'Land' }
            ], default: 'commercial' },
            { name: 'areaSqm', label: 'Area (m²)', type: 'number', min: 1, default: 500 },
            { name: 'yearBuilt', label: 'Year Built', type: 'number', min: 1900, max: 2030, default: 2015 },
            { name: 'ownershipType', label: 'Ownership Type', type: 'select', options: [
              { value: 'freehold', label: 'Freehold' },
              { value: 'leasehold', label: 'Long-term Leasehold' }
            ], default: 'freehold' }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'Maintenance Level (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'renovationInvestment', label: 'Renovation Investment', type: 'number', min: 0, default: 100000 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 2000000 },
            { name: 'improvementCosts', label: 'Improvement Costs', type: 'number', min: 0, default: 200000 },
            { name: 'acquisitionCosts', label: 'Acquisition Costs', type: 'number', min: 0, default: 100000 },
            { name: 'legalCosts', label: 'Legal Costs', type: 'number', min: 0, default: 50000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 50 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 300000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 }
          ],
          // 5. Market
          [
            { name: 'comparablePricePerSqm', label: 'Comparable Price per m²', type: 'number', min: 0, default: 4500 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'transactionVolume', label: 'Transaction Volume (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 6. Income
          [
            { name: 'monthlyRent', label: 'Monthly Rent', type: 'number', min: 0, default: 20000 },
            { name: 'occupancyRate', label: 'Occupancy Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.9 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'capRate', label: 'Capitalization Rate (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.07 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'environmentalRisk', label: 'Environmental Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Intangibles
          [
            { name: 'locationPremium', label: 'Location Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'permitsValue', label: 'Permits / Incentives Value', type: 'number', min: 0, default: 50000 }
          ],
          // 9. Exit
          [
            { name: 'holdingYears', label: 'Expected Holding Period (years)', type: 'number', min: 0, default: 5 },
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 10. Future
          [
            { name: 'gdpGrowth', label: 'GDP Growth (0-1)', type: 'number', min: 0, max: 0.2, step: 0.01, default: 0.03 },
            { name: 'populationGrowth', label: 'Population Growth (0-1)', type: 'number', min: 0, max: 0.1, step: 0.001, default: 0.015 },
            { name: 'infrastructurePlans', label: 'Infrastructure Plans (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 65 }
          ]
        ],
        business: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Company Name', type: 'text', placeholder: 'Sample Company', default: 'Sample Company' },
            { name: 'industrySector', label: 'Industry Sector', type: 'text', placeholder: 'Retail', default: 'Retail' },
            { name: 'yearsInOperation', label: 'Years in Operation', type: 'number', min: 0, default: 8 },
            { name: 'employeeCount', label: 'Employee Count', type: 'number', min: 0, default: 45 }
          ],
          // 2. Condition
          [
            { name: 'operationalStatus', label: 'Operational Status', type: 'select', options: [
              { value: 'operating', label: 'Fully Operating' },
              { value: 'partial', label: 'Partially Operating' },
              { value: 'distressed', label: 'Distressed' }
            ], default: 'operating' },
            { name: 'managementQuality', label: 'Management Quality (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'governanceScore', label: 'Governance Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'techMaturity', label: 'Technology Maturity (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 3. Historical Cost
          [
            { name: 'equityBookValue', label: 'Equity Book Value', type: 'number', min: 0, default: 2500000 },
            { name: 'retainedEarnings', label: 'Retained Earnings', type: 'number', default: 800000 },
            { name: 'intangibleAssetsBook', label: 'Intangible Assets (Book)', type: 'number', min: 0, default: 400000 },
            { name: 'totalDebt', label: 'Total Debt', type: 'number', min: 0, default: 600000 },
            { name: 'cashAndEquiv', label: 'Cash & Equivalents', type: 'number', min: 0, default: 300000 }
          ],
          // 4. Depreciation
          [
            { name: 'amortizationExpense', label: 'Annual Amortization', type: 'number', min: 0, default: 80000 },
            { name: 'goodwillImpairment', label: 'Goodwill Impairment', type: 'number', min: 0, default: 0 },
            { name: 'annualCapex', label: 'Annual CapEx', type: 'number', min: 0, default: 200000 }
          ],
          // 5. Market
          [
            { name: 'evRevenueMultiple', label: 'EV/Revenue Multiple', type: 'number', min: 0, step: 0.1, default: 1.2 },
            { name: 'evEbitdaMultiple', label: 'EV/EBITDA Multiple', type: 'number', min: 0, step: 0.5, default: 7 },
            { name: 'sectorMultiple', label: 'Sector Multiple', type: 'number', min: 0.5, step: 0.1, default: 1 },
            { name: 'transactionPremium', label: 'Transaction Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
            { name: 'marketLiquidity', label: 'Market Liquidity (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 5000000 },
            { name: 'revenueGrowthRate', label: 'Revenue Growth Rate (0-1)', type: 'number', min: -0.1, max: 0.5, step: 0.01, default: 0.08 },
            { name: 'ebitdaMargin', label: 'EBITDA Margin (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.18 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
            { name: 'projectionYears', label: 'Projection Years', type: 'number', min: 1, max: 20, default: 5 }
          ],
          // 7. Risks
          [
            { name: 'customerConcentration', label: 'Customer Concentration (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'competitiveIntensity', label: 'Competitive Intensity (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'successionRisk', label: 'Succession Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 60 },
            { name: 'proprietaryTechnology', label: 'Proprietary Technology (0-100)', type: 'number', min: 0, max: 100, default: 40 },
            { name: 'patentsValue', label: 'Patents Value', type: 'number', min: 0, default: 100000 },
            { name: 'customerRelationships', label: 'Customer Relationships (0-100)', type: 'number', min: 0, max: 100, default: 55 }
          ],
          // 9. Exit
          [
            { name: 'exitMultiple', label: 'Exit Multiple', type: 'number', min: 0, step: 0.5, default: 7 },
            { name: 'strategicBuyerPremium', label: 'Strategic Buyer Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'marketabilityDiscount', label: 'Marketability Discount (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 10. Future
          [
            { name: 'marketGrowth', label: 'Market Growth (0-1)', type: 'number', min: 0, max: 0.2, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'Innovation Pipeline (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 60 }
          ]
        ],
        factory: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Factory Name', type: 'text', placeholder: 'Sample Factory', default: 'Sample Factory' },
            { name: 'factorySector', label: 'Factory Sector', type: 'select', options: [
              { value: 'food', label: 'Food' },
              { value: 'plastic', label: 'Plastic' },
              { value: 'water', label: 'Water' },
              { value: 'building', label: 'Building Materials' },
              { value: 'textiles', label: 'Textiles' },
              { value: 'chemicals', label: 'Chemicals' },
              { value: 'packaging', label: 'Packaging' },
              { value: 'furniture', label: 'Furniture' },
              { value: 'other', label: 'Other' }
            ], default: 'food' },
            { name: 'builtYear', label: 'Year Built', type: 'number', min: 1900, max: 2030, default: 2012 },
            { name: 'floorAreaSqm', label: 'Built-up Area (m²)', type: 'number', min: 1, default: 3000 }
          ],
          // 2. Condition
          [
            { name: 'equipmentAgeYears', label: 'Equipment Age (years)', type: 'number', min: 0, default: 8 },
            { name: 'utilizationRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.75 },
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'safetyCertificationScore', label: 'Safety Certifications (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'digitalMaturity', label: 'Digital Maturity (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'Land Cost', type: 'number', min: 0, default: 800000 },
            { name: 'buildingCost', label: 'Building Cost', type: 'number', min: 0, default: 1500000 },
            { name: 'machineryCost', label: 'Machinery Cost', type: 'number', min: 0, default: 2000000 },
            { name: 'installationCost', label: 'Installation Cost', type: 'number', min: 0, default: 250000 },
            { name: 'workingCapital', label: 'Working Capital', type: 'number', min: 0, default: 400000 }
          ],
          // 4. Depreciation
          [
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 900000 },
            { name: 'functionalObsolescence', label: 'Functional Obsolescence (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'Replacement Cost New', type: 'number', min: 0, default: 5000000 },
            { name: 'costIndex', label: 'Cost Index', type: 'number', min: 0.5, max: 2, step: 0.05, default: 1.05 },
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 4500000 },
            { name: 'scrapValueRate', label: 'Scrap Value Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 }
          ],
          // 6. Income
          [
            { name: 'annualCapacityUnits', label: 'Annual Capacity (units)', type: 'number', min: 1, default: 100000 },
            { name: 'capacityUtilization', label: 'Capacity Utilization (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'unitPrice', label: 'Unit Price', type: 'number', min: 0, default: 50 },
            { name: 'variableCostPerUnit', label: 'Variable Cost per Unit', type: 'number', min: 0, default: 28 },
            { name: 'annualFixedCosts', label: 'Annual Fixed Costs', type: 'number', min: 0, default: 600000 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 }
          ],
          // 7. Risks
          [
            { name: 'rawMaterialRisk', label: 'Raw Material Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'energyRisk', label: 'Energy Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'demandRisk', label: 'Demand Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'geopoliticalRisk', label: 'Geopolitical Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Intangibles
          [
            { name: 'patentsValue', label: 'Patents Value', type: 'number', min: 0, default: 150000 },
            { name: 'licensesValue', label: 'Licenses Value', type: 'number', min: 0, default: 100000 },
            { name: 'workforceSkill', label: 'Workforce Skill (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 9. Exit
          [
            { name: 'dismantlingCost', label: 'Dismantling Cost', type: 'number', min: 0, default: 200000 },
            { name: 'salvageValue', label: 'Salvage Value', type: 'number', min: 0, default: 300000 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 12 }
          ],
          // 10. Future
          [
            { name: 'marketGrowth', label: 'Market Growth (0-1)', type: 'number', min: 0, max: 0.2, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'Automation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 }
          ]
        ],
        machineryEquipment: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Sample production line', default: 'Sample Machinery' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Machinery Type', type: 'select', options: [
              { value: 'industrial', label: 'Industrial' },
              { value: 'construction', label: 'Construction' },
              { value: 'production', label: 'Production' },
              { value: 'packaging', label: 'Packaging' },
              { value: 'other', label: 'Other' }
            ], default: 'industrial' },
            { name: 'quantity', label: 'Quantity', type: 'number', min: 1, default: 1 },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2018 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'Maintenance Level (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'operatingHours', label: 'Operating Hours', type: 'number', min: 0, default: 8000 },
            { name: 'inspectionScore', label: 'Inspection Score (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 800000 },
            { name: 'installationCost', label: 'Installation Cost', type: 'number', min: 0, default: 80000 },
            { name: 'transportCost', label: 'Transport Cost', type: 'number', min: 0, default: 30000 },
            { name: 'improvementCosts', label: 'Improvement Costs', type: 'number', min: 0, default: 50000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 15 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 200000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'residualValueRate', label: 'Residual Value Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'Replacement Cost New', type: 'number', min: 0, default: 900000 },
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 700000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 }
          ],
          // 6. Income
          [
            { name: 'monthlyOperatingRevenue', label: 'Monthly Operating Revenue', type: 'number', min: 0, default: 30000 },
            { name: 'utilizationRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'Certifications / Licenses Value', type: 'number', min: 0, default: 30000 },
            { name: 'maintenanceContractValue', label: 'Maintenance Contract Value', type: 'number', min: 0, default: 20000 },
            { name: 'brandPremium', label: 'Brand Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
            { name: 'workforceSkill', label: 'Workforce Skill (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 9 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'Automation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 }
          ]
        ],
        vehiclesFleet: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Fleet Name', type: 'text', placeholder: 'Sample delivery fleet', default: 'Sample Fleet' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Jeddah', default: 'Jeddah' },
            { name: 'assetType', label: 'Vehicle Type', type: 'select', options: [
              { value: 'trucks', label: 'Trucks' },
              { value: 'vans', label: 'Vans' },
              { value: 'buses', label: 'Buses' },
              { value: 'heavyEquipment', label: 'Heavy Equipment' },
              { value: 'cars', label: 'Cars' },
              { value: 'other', label: 'Other' }
            ], default: 'trucks' },
            { name: 'quantity', label: 'Number of Vehicles', type: 'number', min: 1, default: 10 },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2019 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'Maintenance Level (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'operatingHours', label: 'Total Miles / Hours', type: 'number', min: 0, default: 150000 },
            { name: 'inspectionScore', label: 'Inspection Score (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Total Purchase Price', type: 'number', min: 0, default: 2000000 },
            { name: 'installationCost', label: 'Fitting / Upfitting Costs', type: 'number', min: 0, default: 100000 },
            { name: 'transportCost', label: 'Transport Cost', type: 'number', min: 0, default: 50000 },
            { name: 'improvementCosts', label: 'Improvement Costs', type: 'number', min: 0, default: 80000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 10 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 600000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
            { name: 'residualValueRate', label: 'Residual Value Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'Replacement Cost New', type: 'number', min: 0, default: 2200000 },
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 1600000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 }
          ],
          // 6. Income
          [
            { name: 'monthlyOperatingRevenue', label: 'Monthly Operating Revenue', type: 'number', min: 0, default: 50000 },
            { name: 'utilizationRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.75 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'Licenses / Certifications Value', type: 'number', min: 0, default: 40000 },
            { name: 'maintenanceContractValue', label: 'Maintenance Contract Value', type: 'number', min: 0, default: 30000 },
            { name: 'brandPremium', label: 'Brand Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
            { name: 'workforceSkill', label: 'Driver / Operator Skill (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 6 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'Electrification / Automation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 }
          ]
        ],
        medicalEquipment: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Sample X-ray machine', default: 'Sample Medical Device' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Device Type', type: 'select', options: [
              { value: 'diagnostic', label: 'Diagnostic' },
              { value: 'surgical', label: 'Surgical' },
              { value: 'laboratory', label: 'Laboratory' },
              { value: 'imaging', label: 'Imaging' },
              { value: 'rehabilitation', label: 'Rehabilitation' },
              { value: 'other', label: 'Other' }
            ], default: 'diagnostic' },
            { name: 'quantity', label: 'Quantity', type: 'number', min: 1, default: 1 },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2019 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'maintenanceLevel', label: 'Maintenance Level (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'operatingHours', label: 'Usage Count / Hours', type: 'number', min: 0, default: 5000 },
            { name: 'inspectionScore', label: 'Medical Inspection Score (1-10)', type: 'number', min: 1, max: 10, default: 8 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 1200000 },
            { name: 'installationCost', label: 'Installation & Training Cost', type: 'number', min: 0, default: 120000 },
            { name: 'transportCost', label: 'Transport Cost', type: 'number', min: 0, default: 40000 },
            { name: 'improvementCosts', label: 'Upgrade Costs', type: 'number', min: 0, default: 60000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 12 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 300000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'residualValueRate', label: 'Residual Value Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'Replacement Cost New', type: 'number', min: 0, default: 1400000 },
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 1000000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.06 }
          ],
          // 6. Income
          [
            { name: 'monthlyOperatingRevenue', label: 'Monthly Operating Revenue', type: 'number', min: 0, default: 45000 },
            { name: 'utilizationRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.65 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'Accreditation Value', type: 'number', min: 0, default: 80000 },
            { name: 'maintenanceContractValue', label: 'Maintenance Contract Value', type: 'number', min: 0, default: 50000 },
            { name: 'regulatoryCertification', label: 'Regulatory Classification', type: 'select', options: [
              { value: 'sfda', label: 'SFDA' },
              { value: 'fda', label: 'FDA' },
              { value: 'ce', label: 'CE' },
              { value: 'other', label: 'Other' }
            ], default: 'sfda' },
            { name: 'workforceSkill', label: 'Medical Staff Skill (1-10)', type: 'number', min: 1, max: 10, default: 8 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 12 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.06 },
            { name: 'automationPlan', label: 'Digital Upgrade Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 60 }
          ]
        ],
        educationalEquipment: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Sample science lab', default: 'Sample Educational Equipment' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Equipment Type', type: 'select', options: [
              { value: 'lab', label: 'Laboratory' },
              { value: 'classroom', label: 'Classroom' },
              { value: 'vocational', label: 'Vocational / Technical' },
              { value: 'library', label: 'Library' },
              { value: 'it', label: 'IT' },
              { value: 'other', label: 'Other' }
            ], default: 'lab' },
            { name: 'quantity', label: 'Quantity', type: 'number', min: 1, default: 1 },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2020 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'Maintenance Level (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'operatingHours', label: 'Usage Hours', type: 'number', min: 0, default: 3000 },
            { name: 'inspectionScore', label: 'Inspection Score (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 500000 },
            { name: 'installationCost', label: 'Installation & Training Cost', type: 'number', min: 0, default: 50000 },
            { name: 'transportCost', label: 'Transport Cost', type: 'number', min: 0, default: 20000 },
            { name: 'improvementCosts', label: 'Improvement Costs', type: 'number', min: 0, default: 30000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 15 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 100000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'residualValueRate', label: 'Residual Value Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 }
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'Replacement Cost New', type: 'number', min: 0, default: 600000 },
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 450000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 }
          ],
          // 6. Income
          [
            { name: 'monthlyOperatingRevenue', label: 'Monthly Operating Revenue', type: 'number', min: 0, default: 20000 },
            { name: 'utilizationRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.6 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'Certifications Value', type: 'number', min: 0, default: 40000 },
            { name: 'accreditationValue', label: 'Academic Accreditation Value', type: 'number', min: 0, default: 30000 },
            { name: 'maintenanceContractValue', label: 'Maintenance Contract Value', type: 'number', min: 0, default: 15000 },
            { name: 'workforceSkill', label: 'Educational Staff Skill (1-10)', type: 'number', min: 1, max: 10, default: 7 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 9 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'automationPlan', label: 'Digital Transformation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 60 }
          ]
        ],
        jewelryPreciousMetals: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Sample gold bars', default: 'Sample Gold' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Jeddah', default: 'Jeddah' },
            { name: 'commodityType', label: 'Metal / Jewelry Type', type: 'select', options: [
              { value: 'gold', label: 'Gold' },
              { value: 'silver', label: 'Silver' },
              { value: 'platinum', label: 'Platinum' },
              { value: 'diamond', label: 'Diamond' },
              { value: 'jewelry', label: 'Manufactured Jewelry' },
              { value: 'other', label: 'Other' }
            ], default: 'gold' },
            { name: 'quantityUnits', label: 'Weight / Quantity (grams)', type: 'number', min: 0, step: 0.1, default: 1000 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 9 },
            { name: 'purityFactor', label: 'Purity / Karat (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.999 },
            { name: 'authenticationScore', label: 'Authentication Score (1-10)', type: 'number', min: 1, max: 10, default: 9 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 250000 },
            { name: 'storageCost', label: 'Annual Storage Cost', type: 'number', min: 0, default: 2000 },
            { name: 'insuranceCost', label: 'Annual Insurance Cost', type: 'number', min: 0, default: 1500 }
          ],
          // 4. Holding
          [
            { name: 'holdingPeriodYears', label: 'Holding Period (years)', type: 'number', min: 0, default: 3 }
          ],
          // 5. Market
          [
            { name: 'spotPricePerUnit', label: 'Spot Price per Gram', type: 'number', min: 0, step: 0.01, default: 250 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 6. Premium
          [
            { name: 'premiumRate', label: 'Craftsmanship / Brand Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'brandPremium', label: 'Brand Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'Brand Value', type: 'number', min: 0, default: 10000 },
            { name: 'rarityPremium', label: 'Rarity Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 3 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 }
          ]
        ],
        commodities: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Commodity Name', type: 'text', placeholder: 'Sample wheat inventory', default: 'Sample Commodity' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Jeddah', default: 'Jeddah' },
            { name: 'commodityType', label: 'Commodity Type', type: 'select', options: [
              { value: 'grains', label: 'Grains' },
              { value: 'metals', label: 'Base Metals' },
              { value: 'energy', label: 'Energy' },
              { value: 'livestock', label: 'Livestock' },
              { value: 'inventory', label: 'Commercial Inventory' },
              { value: 'other', label: 'Other' }
            ], default: 'grains' },
            { name: 'quantityUnits', label: 'Quantity (units)', type: 'number', min: 0, step: 0.01, default: 10000 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'purityFactor', label: 'Quality / Purity Grade (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.95 },
            { name: 'authenticationScore', label: 'Verification Score (1-10)', type: 'number', min: 1, max: 10, default: 8 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 200000 },
            { name: 'storageCost', label: 'Annual Storage Cost', type: 'number', min: 0, default: 10000 },
            { name: 'insuranceCost', label: 'Annual Insurance Cost', type: 'number', min: 0, default: 3000 }
          ],
          // 4. Holding
          [
            { name: 'holdingPeriodYears', label: 'Holding Period (years)', type: 'number', min: 0, default: 1 }
          ],
          // 5. Market
          [
            { name: 'spotPricePerUnit', label: 'Spot Price per Unit', type: 'number', min: 0, step: 0.01, default: 25 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 6. Premium
          [
            { name: 'premiumRate', label: 'Quality / Delivery Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.02 },
            { name: 'brandPremium', label: 'Brand Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'Brand Value', type: 'number', min: 0, default: 0 },
            { name: 'rarityPremium', label: 'Rarity Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.04 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 2 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 }
          ]
        ],
        distressedAsset: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Distressed Asset Name', type: 'text', placeholder: 'Sample distressed asset', default: 'Sample Distressed Asset' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [
              { value: 'realEstate', label: 'Real Estate' },
              { value: 'business', label: 'Business' },
              { value: 'machinery', label: 'Machinery & Equipment' },
              { value: 'inventory', label: 'Inventory' },
              { value: 'other', label: 'Other' }
            ], default: 'business' },
            { name: 'distressReason', label: 'Distress Reason', type: 'select', options: [
              { value: 'cashFlow', label: 'Cash Flow' },
              { value: 'operational', label: 'Operational' },
              { value: 'regulatory', label: 'Regulatory' },
              { value: 'market', label: 'Market' },
              { value: 'legal', label: 'Legal' }
            ], default: 'cashFlow' }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'distressSeverity', label: 'Distress Severity (0-10)', type: 'number', min: 0, max: 10, default: 7 },
            { name: 'legalHoldStatus', label: 'Legal Hold Status', type: 'select', options: [
              { value: 'none', label: 'None' },
              { value: 'partial', label: 'Partial' },
              { value: 'full', label: 'Full' }
            ], default: 'none' }
          ],
          // 3. Book / Debt
          [
            { name: 'bookValue', label: 'Book Value', type: 'number', min: 0, default: 2000000 },
            { name: 'accumulatedDebt', label: 'Accumulated Debt', type: 'number', min: 0, default: 800000 },
            { name: 'legalHoldCost', label: 'Legal Hold Costs', type: 'number', min: 0, default: 100000 }
          ],
          // 4. Discounts
          [
            { name: 'forcedSaleDiscount', label: 'Forced Sale Discount (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'recoveryRate', label: 'Recovery Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.55 },
            { name: 'restructuringCost', label: 'Restructuring Cost', type: 'number', min: 0, default: 200000 }
          ],
          // 5. Market
          [
            { name: 'marketValue', label: 'Market Value (no distress)', type: 'number', min: 0, default: 1800000 },
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 1500000 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 }
          ],
          // 6. Income
          [
            { name: 'stabilizedNOI', label: 'Stabilized Net Operating Income', type: 'number', min: 0, default: 200000 },
            { name: 'stabilizedCapRate', label: 'Stabilized Cap Rate (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.08 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.15 },
            { name: 'timeToStabilizeMonths', label: 'Time to Stabilize (months)', type: 'number', min: 1, max: 60, default: 18 }
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'litigationRisk', label: 'Litigation Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 }
          ],
          // 8. Intangibles
          [
            { name: 'restructuringPlanValue', label: 'Restructuring Plan Value', type: 'number', min: 0, default: 100000 },
            { name: 'strategicValue', label: 'Strategic Value', type: 'number', min: 0, default: 150000 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.07 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 6 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'Improvement Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 45 }
          ]
        ],
        tourismAsset: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Tourism Asset Name', type: 'text', placeholder: 'Sample Resort', default: 'Sample Resort' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Jeddah', default: 'Jeddah' },
            { name: 'assetType', label: 'Tourism Asset Type', type: 'select', options: [
              { value: 'hotel', label: 'Hotel' },
              { value: 'resort', label: 'Resort' },
              { value: 'attraction', label: 'Attraction' },
              { value: 'restaurant', label: 'Restaurant/Cafe' },
              { value: 'tourOperator', label: 'Tour Operator' },
              { value: 'other', label: 'Other' }
            ], default: 'resort' },
            { name: 'yearBuilt', label: 'Year Established', type: 'number', min: 1900, max: 2030, default: 2015 }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'starRating', label: 'Star Rating (1-5)', type: 'number', min: 1, max: 5, default: 4 },
            { name: 'renovationInvestment', label: 'Renovation Investment', type: 'number', min: 0, default: 200000 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 5000000 },
            { name: 'improvementCosts', label: 'Improvement Costs', type: 'number', min: 0, default: 800000 },
            { name: 'acquisitionCosts', label: 'Acquisition Costs', type: 'number', min: 0, default: 200000 }
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 30 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 800000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 }
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'Comparable Transaction Value', type: 'number', min: 0, default: 8000000 },
            { name: 'tourismGrowthRate', label: 'Tourism Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.06 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 6. Income
          [
            { name: 'dailyVisitors', label: 'Daily Visitors', type: 'number', min: 0, default: 500 },
            { name: 'avgSpendPerVisitor', label: 'Average Spend per Visitor', type: 'number', min: 0, default: 250 },
            { name: 'occupancyRate', label: 'Occupancy Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'seasonalityFactor', label: 'Seasonality Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.8 },
            { name: 'capRate', label: 'Capitalization Rate (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.08 }
          ],
          // 7. Costs / Risks
          [
            { name: 'staffCost', label: 'Annual Staff Cost', type: 'number', min: 0, default: 1200000 },
            { name: 'maintenanceCost', label: 'Annual Maintenance Cost', type: 'number', min: 0, default: 300000 },
            { name: 'utilitiesCost', label: 'Annual Utilities Cost', type: 'number', min: 0, default: 200000 },
            { name: 'marketingCost', label: 'Annual Marketing Cost', type: 'number', min: 0, default: 150000 },
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'qualityMultiplier', label: 'Quality Multiplier (0.5-2)', type: 'number', min: 0.5, max: 2, step: 0.05, default: 1 },
            { name: 'locationQualityScore', label: 'Location Quality (0-10)', type: 'number', min: 0, max: 10, default: 8 },
            { name: 'permitsValue', label: 'Tourism Permits Value', type: 'number', min: 0, default: 300000 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 12 }
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'infrastructurePlans', label: 'Infrastructure Plans (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 60 }
          ]
        ],
        personalWealth: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Portfolio Name', type: 'text', placeholder: 'Sample Family Portfolio', default: 'Sample Family Portfolio' },
            { name: 'ownerName', label: 'Owner Name', type: 'text', placeholder: 'Mohammed Ahmed', default: 'Mohammed Ahmed' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'currency', label: 'Currency', type: 'text', placeholder: 'SAR', default: 'SAR' }
          ],
          // 2. Condition
          [
            { name: 'creditScore', label: 'Credit Score (0-10)', type: 'number', min: 0, max: 10, default: 8 },
            { name: 'authenticationScore', label: 'Asset Authentication Score (1-10)', type: 'number', min: 1, max: 10, default: 8 }
          ],
          // 3. Assets
          [
            { name: 'realEstateValue', label: 'Real Estate Value', type: 'number', min: 0, default: 2000000 },
            { name: 'securitiesValue', label: 'Securities Value', type: 'number', min: 0, default: 800000 },
            { name: 'cashValue', label: 'Cash Value', type: 'number', min: 0, default: 300000 },
            { name: 'personalAssetsValue', label: 'Personal Assets Value', type: 'number', min: 0, default: 400000 },
            { name: 'vehicleValue', label: 'Vehicles Value', type: 'number', min: 0, default: 200000 }
          ],
          // 4. Liabilities
          [
            { name: 'mortgageBalance', label: 'Mortgage Balance', type: 'number', min: 0, default: 600000 },
            { name: 'loansBalance', label: 'Loans Balance', type: 'number', min: 0, default: 200000 },
            { name: 'creditBalance', label: 'Credit Card Balance', type: 'number', min: 0, default: 30000 },
            { name: 'otherLiabilities', label: 'Other Liabilities', type: 'number', min: 0, default: 50000 }
          ],
          // 5. Market
          [
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 }
          ],
          // 6. Income
          [
            { name: 'annualIncome', label: 'Annual Income', type: 'number', min: 0, default: 600000 },
            { name: 'passiveIncome', label: 'Annual Passive Income', type: 'number', min: 0, default: 80000 }
          ],
          // 7. Risks
          [
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'successionRisk', label: 'Succession Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 }
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Reputation/Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 50 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 }
          ],
          // 10. Future
          [
            { name: 'innovationPipeline', label: 'Investment Growth Plans (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'projectedDecline', label: 'Projected Value Decline', type: 'number', min: 0, default: 0 }
          ]
        ],
        scrapSalvage: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Material/Asset Name', type: 'text', placeholder: 'Sample Copper Scrap', default: 'Sample Copper Scrap' },
            { name: 'materialType', label: 'Material Type', type: 'select', options: [
              { value: 'metal', label: 'Metal' },
              { value: 'plastic', label: 'Plastic' },
              { value: 'wood', label: 'Wood' },
              { value: 'electronics', label: 'Electronics' },
              { value: 'paper', label: 'Paper' },
              { value: 'other', label: 'Other' }
            ], default: 'metal' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' }
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'purityRate', label: 'Purity Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.9 }
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase/Carrying Cost', type: 'number', min: 0, default: 100000 }
          ],
          // 4. Quantity
          [
            { name: 'weightKg', label: 'Weight (kg)', type: 'number', min: 0, default: 10000 },
            { name: 'volumeM3', label: 'Volume (m³)', type: 'number', min: 0, default: 50 }
          ],
          // 5. Market
          [
            { name: 'marketPricePerKg', label: 'Market Price per kg', type: 'number', min: 0, default: 25 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 }
          ],
          // 6. Costs
          [
            { name: 'dismantlingCost', label: 'Dismantling Cost', type: 'number', min: 0, default: 30000 },
            { name: 'transportCost', label: 'Transport Cost', type: 'number', min: 0, default: 15000 },
            { name: 'storageCost', label: 'Storage Cost', type: 'number', min: 0, default: 5000 }
          ],
          // 7. Risks
          [
            { name: 'priceVolatility', label: 'Price Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 }
          ],
          // 8. Quality
          [
            { name: 'recoveryRate', label: 'Recovery Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.85 }
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.04 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 3 }
          ],
          // 10. Future
          [
            { name: 'infrastructurePlans', label: 'Infrastructure Plans (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'projectedDecline', label: 'Projected Value Decline', type: 'number', min: 0, default: 0 }
          ]
        ],
        agricultureFarms: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'مزرعة نموذجية' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'crop', label: 'Field Crops' }, { value: 'orchard', label: 'Orchard' }, { value: 'greenhouse', label: 'Greenhouse' }, { value: 'livestock', label: 'Livestock Farming' }, { value: 'mixed', label: 'Mixed' } ], default: 'crop' },
            { name: 'areaUnits', label: 'Area (hectares)', type: 'number', min: 0.1, step: 0.1, default: 10 },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2018 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'qualityScore', label: 'Quality Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'landQualityScore', label: 'Land Quality (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'waterAvailabilityScore', label: 'Water Availability (1-10)', type: 'number', min: 1, max: 10, default: 6 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 500000 },
            { name: 'developmentCost', label: 'Development Cost', type: 'number', min: 0, default: 200000 },
            { name: 'equipmentCost', label: 'Equipment Cost', type: 'number', min: 0, default: 100000 },
            { name: 'installationCost', label: 'Installation Cost', type: 'number', min: 0, default: 30000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 20 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 80000 },
            { name: 'biologicalAgeYears', label: 'Biological Age (years)', type: 'number', min: 0, default: 5 },
            { name: 'mortalityRate', label: 'Mortality Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
          ],
          // 5. Market
          [
            { name: 'yieldPerUnit', label: 'Yield per Unit', type: 'number', min: 0, step: 0.1, default: 5 },
            { name: 'marketPricePerUnit', label: 'Market Price per Unit', type: 'number', min: 0, default: 1000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 100000 },
            { name: 'feedCost', label: 'Feed Cost', type: 'number', min: 0, default: 20000 },
            { name: 'veterinaryCost', label: 'Veterinary Cost', type: 'number', min: 0, default: 10000 },
            { name: 'storageCost', label: 'Storage Cost', type: 'number', min: 0, default: 8000 },
            { name: 'otherOperatingCosts', label: 'Other Operating Costs', type: 'number', min: 0, default: 15000 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'environmentalRisk', label: 'Environmental Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'Certifications Value', type: 'number', min: 0, default: 20000 },
            { name: 'brandPremium', label: 'Brand Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
            { name: 'waterRightsValue', label: 'Water Rights Value', type: 'number', min: 0, default: 30000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'Automation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        livestock: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'قطيع نموذجي' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'cattle', label: 'Cattle' }, { value: 'sheep', label: 'Sheep' }, { value: 'poultry', label: 'Poultry' }, { value: 'camels', label: 'Camels' }, { value: 'other', label: 'Other' } ], default: 'cattle' },
            { name: 'quantityUnits', label: 'Quantity', type: 'number', min: 1, default: 100 },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2020 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'healthScore', label: 'Health Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'qualityScore', label: 'Quality Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'biologicalAgeYears', label: 'Biological Age (years)', type: 'number', min: 0, default: 3 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 300000 },
            { name: 'developmentCost', label: 'Development Cost', type: 'number', min: 0, default: 80000 },
            { name: 'equipmentCost', label: 'Equipment Cost', type: 'number', min: 0, default: 30000 },
            { name: 'installationCost', label: 'Installation Cost', type: 'number', min: 0, default: 10000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 8 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 50000 },
            { name: 'mortalityRate', label: 'Mortality Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
          ],
          // 5. Market
          [
            { name: 'marketPricePerUnit', label: 'Market Price per Unit', type: 'number', min: 0, default: 3500 },
            { name: 'yieldPerUnit', label: 'Yield per Unit', type: 'number', min: 0, default: 200 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 120000 },
            { name: 'feedCost', label: 'Feed Cost', type: 'number', min: 0, default: 40000 },
            { name: 'veterinaryCost', label: 'Veterinary Cost', type: 'number', min: 0, default: 12000 },
            { name: 'storageCost', label: 'Storage Cost', type: 'number', min: 0, default: 8000 },
            { name: 'otherOperatingCosts', label: 'Other Operating Costs', type: 'number', min: 0, default: 10000 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'environmentalRisk', label: 'Environmental Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'certificationValue', label: 'Certifications Value', type: 'number', min: 0, default: 15000 },
            { name: 'brandPremium', label: 'Brand Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.05 },
            { name: 'waterRightsValue', label: 'Water Rights Value', type: 'number', min: 0, default: 10000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 6 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'Automation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        naturalResourcesMining: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'منجم نموذجي' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'mineral', label: 'Mineral' }, { value: 'quarry', label: 'Quarry' }, { value: 'salt', label: 'Salt' }, { value: 'other', label: 'Other' } ], default: 'mineral' },
            { name: 'reserveUnits', label: 'Reserve Units', type: 'number', min: 0, default: 100000 },
            { name: 'operatingYears', label: 'Operating Years', type: 'number', min: 0, default: 5 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'reserveGrade', label: 'Reserve Grade (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.8 },
            { name: 'environmentalComplianceScore', label: 'Environmental Compliance (1-10)', type: 'number', min: 1, max: 10, default: 7 },
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'Land Cost', type: 'number', min: 0, default: 1000000 },
            { name: 'developmentCost', label: 'Development Cost', type: 'number', min: 0, default: 2000000 },
            { name: 'equipmentCost', label: 'Equipment Cost', type: 'number', min: 0, default: 1500000 },
            { name: 'acquisitionCost', label: 'Acquisition Cost', type: 'number', min: 0, default: 200000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'depletionRate', label: 'Depletion Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'accumulatedDepletion', label: 'Accumulated Depletion', type: 'number', min: 0, default: 500000 },
            { name: 'licenseExpiryYears', label: 'License Remaining (years)', type: 'number', min: 1, max: 100, default: 15 },
          ],
          // 5. Market
          [
            { name: 'commodityPricePerUnit', label: 'Commodity Price per Unit', type: 'number', min: 0, default: 500 },
            { name: 'extractionCostPerUnit', label: 'Extraction Cost per Unit', type: 'number', min: 0, default: 250 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
          ],
          // 6. Income
          [
            { name: 'utilizationRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
            { name: 'annualFixedCosts', label: 'Annual Fixed Costs', type: 'number', min: 0, default: 500000 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.1 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'environmentalRisk', label: 'Environmental Risk (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'geopoliticalRisk', label: 'Geopolitical Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'licensesValue', label: 'Licenses Value', type: 'number', min: 0, default: 300000 },
            { name: 'strategicValue', label: 'Strategic Value', type: 'number', min: 0, default: 200000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.07 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 18 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'Automation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        oilGas: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'حقل نفطي نموذجي' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الظهران' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'oilField', label: 'Oil Field' }, { value: 'gasField', label: 'Gas Field' }, { value: 'well', label: 'Well' }, { value: 'pipeline', label: 'Pipeline' }, { value: 'other', label: 'Other' } ], default: 'oilField' },
            { name: 'reserveUnits', label: 'Reserve Units', type: 'number', min: 0, default: 5000000 },
            { name: 'operatingYears', label: 'Operating Years', type: 'number', min: 0, default: 8 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'reserveGrade', label: 'Reserve Grade (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.85 },
            { name: 'environmentalComplianceScore', label: 'Environmental Compliance (1-10)', type: 'number', min: 1, max: 10, default: 8 },
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'Land Cost', type: 'number', min: 0, default: 5000000 },
            { name: 'developmentCost', label: 'Development Cost', type: 'number', min: 0, default: 10000000 },
            { name: 'equipmentCost', label: 'Equipment Cost', type: 'number', min: 0, default: 8000000 },
            { name: 'acquisitionCost', label: 'Acquisition Cost', type: 'number', min: 0, default: 1000000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'depletionRate', label: 'Depletion Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'accumulatedDepletion', label: 'Accumulated Depletion', type: 'number', min: 0, default: 3000000 },
            { name: 'licenseExpiryYears', label: 'License Remaining (years)', type: 'number', min: 1, max: 100, default: 20 },
          ],
          // 5. Market
          [
            { name: 'commodityPricePerUnit', label: 'Commodity Price per Unit', type: 'number', min: 0, default: 75 },
            { name: 'extractionCostPerUnit', label: 'Extraction Cost per Unit', type: 'number', min: 0, default: 25 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.02 },
          ],
          // 6. Income
          [
            { name: 'utilizationRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.08 },
            { name: 'annualFixedCosts', label: 'Annual Fixed Costs', type: 'number', min: 0, default: 2000000 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.1 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'environmentalRisk', label: 'Environmental Risk (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 7 },
            { name: 'geopoliticalRisk', label: 'Geopolitical Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
          ],
          // 8. Intangibles
          [
            { name: 'licensesValue', label: 'Licenses Value', type: 'number', min: 0, default: 1000000 },
            { name: 'strategicValue', label: 'Strategic Value', type: 'number', min: 0, default: 2000000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 18 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.02 },
            { name: 'automationPlan', label: 'Automation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        infrastructure: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'أصل بنية تحتية نموذجي' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'road', label: 'Road' }, { value: 'bridge', label: 'Bridge' }, { value: 'tower', label: 'Telecom Tower' }, { value: 'utility', label: 'Utility' }, { value: 'logistics', label: 'Logistics Infrastructure' }, { value: 'other', label: 'Other' } ], default: 'tower' },
            { name: 'capacityUnits', label: 'Capacity/Length', type: 'number', min: 0, default: 10 },
            { name: 'operatingYears', label: 'Operating Years', type: 'number', min: 0, default: 5 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'utilizationRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'environmentalComplianceScore', label: 'Environmental Compliance (1-10)', type: 'number', min: 1, max: 10, default: 7 },
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'Land Cost', type: 'number', min: 0, default: 2000000 },
            { name: 'developmentCost', label: 'Development Cost', type: 'number', min: 0, default: 5000000 },
            { name: 'equipmentCost', label: 'Equipment Cost', type: 'number', min: 0, default: 1500000 },
            { name: 'acquisitionCost', label: 'Acquisition Cost', type: 'number', min: 0, default: 300000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'depletionRate', label: 'Depletion Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
            { name: 'accumulatedDepletion', label: 'Accumulated Depletion', type: 'number', min: 0, default: 800000 },
            { name: 'licenseExpiryYears', label: 'License Remaining (years)', type: 'number', min: 1, max: 100, default: 25 },
          ],
          // 5. Market
          [
            { name: 'tariffRevenuePerUnit', label: 'Tariff Revenue per Unit', type: 'number', min: 0, default: 50000 },
            { name: 'comparableTransactionValue', label: 'Comparable Transaction Value', type: 'number', min: 0, default: 8000000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'annualFixedCosts', label: 'Annual Fixed Costs', type: 'number', min: 0, default: 800000 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.08 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'environmentalRisk', label: 'Environmental Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'geopoliticalRisk', label: 'Geopolitical Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'licensesValue', label: 'Licenses Value', type: 'number', min: 0, default: 500000 },
            { name: 'strategicValue', label: 'Strategic Value', type: 'number', min: 0, default: 1000000 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 15 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'Automation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
        ],
        intellectualProperty: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'محفظة ملكية فكرية نموذجية' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'portfolio', label: 'Portfolio' }, { value: 'tradeSecrets', label: 'Trade Secrets' }, { value: 'industrialDesigns', label: 'Industrial Designs' }, { value: 'other', label: 'Other' } ], default: 'portfolio' },
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 10 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'intangibleStrength', label: 'Intangible Strength (0-100)', type: 'number', min: 0, max: 100, default: 65 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 1000000 },
            { name: 'accumulatedAmortization', label: 'Accumulated Amortization', type: 'number', min: 0, default: 200000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 10 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'Comparable Transaction Value', type: 'number', min: 0, default: 2500000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 2000000 },
            { name: 'royaltyRate', label: 'Royalty Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'growthRate', label: 'Growth Rate (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.04 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 60 },
            { name: 'marketShare', label: 'Market Share (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'Innovation Pipeline (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        brandsTrademarks: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'علامة تجارية نموذجية' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'brand', label: 'Brand' }, { value: 'trademark', label: 'Trademark' }, { value: 'domain', label: 'Domain' }, { value: 'other', label: 'Other' } ], default: 'brand' },
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 15 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 70 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 500000 },
            { name: 'accumulatedAmortization', label: 'Accumulated Amortization', type: 'number', min: 0, default: 100000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 15 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'Comparable Transaction Value', type: 'number', min: 0, default: 3000000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 3000000 },
            { name: 'royaltyRate', label: 'Royalty Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.04 },
            { name: 'growthRate', label: 'Growth Rate (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.05 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 70 },
            { name: 'marketShare', label: 'Market Share (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 10 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'Innovation Pipeline (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.45 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
        ],
        patents: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'براءة اختراع نموذجية' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'invention', label: 'Invention' }, { value: 'utilityModel', label: 'Utility Model' }, { value: 'design', label: 'Design' }, { value: 'portfolio', label: 'Portfolio' } ], default: 'invention' },
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 12 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'intangibleStrength', label: 'Intangible Strength (0-100)', type: 'number', min: 0, max: 100, default: 65 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 400000 },
            { name: 'accumulatedAmortization', label: 'Accumulated Amortization', type: 'number', min: 0, default: 80000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 12 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'Comparable Transaction Value', type: 'number', min: 0, default: 1500000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 1500000 },
            { name: 'royaltyRate', label: 'Royalty Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'growthRate', label: 'Growth Rate (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.03 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 7 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 60 },
            { name: 'marketShare', label: 'Market Share (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.08 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'innovationPipeline', label: 'Innovation Pipeline (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        copyrightsContent: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'مكتبة محتوى نموذجية' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'books', label: 'Books' }, { value: 'music', label: 'Music' }, { value: 'video', label: 'Video/Film' }, { value: 'software', label: 'Software' }, { value: 'database', label: 'Database' }, { value: 'other', label: 'Other' } ], default: 'video' },
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 10 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'intangibleStrength', label: 'Intangible Strength (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 300000 },
            { name: 'accumulatedAmortization', label: 'Accumulated Amortization', type: 'number', min: 0, default: 60000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 10 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'Comparable Transaction Value', type: 'number', min: 0, default: 800000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 600000 },
            { name: 'royaltyRate', label: 'Royalty Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.07 },
            { name: 'growthRate', label: 'Growth Rate (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.04 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 55 },
            { name: 'marketShare', label: 'Market Share (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.08 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.08 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 10 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'Innovation Pipeline (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        franchises: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'امتياز تجاري نموذجي' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'restaurant', label: 'Restaurant' }, { value: 'retail', label: 'Retail' }, { value: 'service', label: 'Service' }, { value: 'education', label: 'Education' }, { value: 'healthcare', label: 'Healthcare' }, { value: 'other', label: 'Other' } ], default: 'restaurant' },
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 10 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'legalProtectionScore', label: 'قوة اتفاقية الامتياز (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'intangibleStrength', label: 'Intangible Strength (0-100)', type: 'number', min: 0, max: 100, default: 70 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 400000 },
            { name: 'accumulatedAmortization', label: 'Accumulated Amortization', type: 'number', min: 0, default: 80000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 10 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'Comparable Transaction Value', type: 'number', min: 0, default: 1200000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 1500000 },
            { name: 'royaltyRate', label: 'Royalty Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'growthRate', label: 'Growth Rate (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.05 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 75 },
            { name: 'marketShare', label: 'Market Share (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.07 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 9 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'innovationPipeline', label: 'Innovation Pipeline (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
        ],
        licensesPermits: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'ترخيص نموذجي' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'commercial', label: 'Commercial' }, { value: 'industrial', label: 'Industrial' }, { value: 'telecom', label: 'Telecom' }, { value: 'healthcare', label: 'Healthcare' }, { value: 'financial', label: 'Financial' }, { value: 'other', label: 'Other' } ], default: 'commercial' },
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 8 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'legalProtectionScore', label: 'درجة الحماية القانونية (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'intangibleStrength', label: 'Intangible Strength (0-100)', type: 'number', min: 0, max: 100, default: 65 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 250000 },
            { name: 'accumulatedAmortization', label: 'Accumulated Amortization', type: 'number', min: 0, default: 50000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'remainingLifeYears', label: 'Remaining Life (years)', type: 'number', min: 1, max: 30, default: 8 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'Comparable Transaction Value', type: 'number', min: 0, default: 600000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 800000 },
            { name: 'royaltyRate', label: 'Royalty Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
            { name: 'growthRate', label: 'Growth Rate (0-1)', type: 'number', min: -0.1, max: 0.2, step: 0.01, default: 0.03 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.1 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 60 },
            { name: 'marketShare', label: 'Market Share (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 8 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'innovationPipeline', label: 'Innovation Pipeline (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        financialAssets: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'محفظة أسهم نموذجية' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'stocks', label: 'Stocks' }, { value: 'bonds', label: 'Bonds' }, { value: 'etf', label: 'ETF' }, { value: 'loan', label: 'Loan/Debt' }, { value: 'portfolio', label: 'Portfolio' } ], default: 'stocks' },
            { name: 'quantityUnits', label: 'Quantity', type: 'number', min: 0, step: 0.01, default: 1000 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'liquidityScore', label: 'Liquidity Score (0-10)', type: 'number', min: 0, max: 10, default: 8 },
            { name: 'custodyScore', label: 'Custody Score (1-10)', type: 'number', min: 1, max: 10, default: 9 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 250000 },
            { name: 'storageCost', label: 'Storage Cost', type: 'number', min: 0, default: 1000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'holdingPeriodYears', label: 'Holding Period (years)', type: 'number', min: 0, default: 2 },
          ],
          // 5. Market
          [
            { name: 'marketPricePerUnit', label: 'Market Price per Unit', type: 'number', min: 0, step: 0.01, default: 250 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'dividendYield', label: 'Dividend Yield (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.03 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'Brand/Strategic Value', type: 'number', min: 0, default: 0 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.015 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 1 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        cryptoDigital: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'أصل رقمي نموذجي' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'bitcoin', label: 'Bitcoin' }, { value: 'ethereum', label: 'Ethereum' }, { value: 'altcoin', label: 'Altcoin' }, { value: 'nft', label: 'NFT' }, { value: 'token', label: 'Token' }, { value: 'other', label: 'Other' } ], default: 'bitcoin' },
            { name: 'quantityUnits', label: 'Quantity', type: 'number', min: 0, step: 1e-06, default: 1 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'authenticationScore', label: 'Authentication Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'liquidityScore', label: 'Liquidity Score (0-10)', type: 'number', min: 0, max: 10, default: 7 },
            { name: 'custodyScore', label: 'Custody Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 100000 },
            { name: 'storageCost', label: 'Storage Cost', type: 'number', min: 0, default: 500 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'holdingPeriodYears', label: 'Holding Period (years)', type: 'number', min: 0, default: 1 },
          ],
          // 5. Market
          [
            { name: 'marketPricePerUnit', label: 'Market Price per Unit', type: 'number', min: 0, step: 0.01, default: 250000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'stakingYield', label: 'Staking Yield (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.04 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 8 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'Brand/Strategic Value', type: 'number', min: 0, default: 0 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.025 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 1 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 45 },
          ],
        ],
        artCollectibles: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'عمل فني نموذجي' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'painting', label: 'Painting' }, { value: 'sculpture', label: 'Sculpture' }, { value: 'antique', label: 'Antique' }, { value: 'watch', label: 'Luxury Watch' }, { value: 'collectible', label: 'Collectible' }, { value: 'other', label: 'Other' } ], default: 'painting' },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2018 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 9 },
            { name: 'authenticationScore', label: 'Authentication Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'rarityScore', label: 'Rarity Score (0-100)', type: 'number', min: 0, max: 100, default: 70 },
            { name: 'provenanceScore', label: 'Provenance Score (0-100)', type: 'number', min: 0, max: 100, default: 75 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 500000 },
            { name: 'storageCost', label: 'Storage Cost', type: 'number', min: 0, default: 5000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'holdingPeriodYears', label: 'Holding Period (years)', type: 'number', min: 0, default: 5 },
          ],
          // 5. Market
          [
            { name: 'comparableTransactionValue', label: 'Comparable Transaction Value', type: 'number', min: 0, default: 800000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 4 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'dividendYield', label: 'Dividend Yield (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.0 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
          ],
          // 8. Intangibles
          [
            { name: 'brandValue', label: 'Brand/Strategic Value', type: 'number', min: 0, default: 0 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.1 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future / Growth
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        softwareTechnology: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Asset Name', default: 'منتج SaaS نموذجي' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Country', default: 'السعودية' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'City', default: 'الرياض' },
            { name: 'assetType', label: 'Asset Type', type: 'select', options: [ { value: 'saas', label: 'SaaS' }, { value: 'mobileApp', label: 'Mobile App' }, { value: 'platform', label: 'Platform' }, { value: 'ai', label: 'AI/Machine Learning' }, { value: 'other', label: 'Other' } ], default: 'saas' },
            { name: 'customerCount', label: 'Customer Count', type: 'number', min: 0, default: 500 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'techMoatScore', label: 'Tech Moat Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'churnRate', label: 'Churn Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
          ],
          // 3. Historical Cost
          [
            { name: 'developmentCost', label: 'Development Cost', type: 'number', min: 0, default: 800000 },
            { name: 'accumulatedAmortization', label: 'Accumulated Amortization', type: 'number', min: 0, default: 150000 },
          ],
          // 4. Depreciation / Life
          [
            { name: 'annualRecurringRevenue', label: 'Annual Recurring Revenue (ARR)', type: 'number', min: 0, default: 1200000 },
            { name: 'averageRevenuePerUser', label: 'Average Revenue per User (ARPU)', type: 'number', min: 0, default: 200 },
            { name: 'grossMargin', label: 'Gross Margin (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.75 },
          ],
          // 5. Market
          [
            { name: 'revenueMultiple', label: 'Revenue Multiple', type: 'number', min: 0, step: 0.5, default: 8 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualOpex', label: 'Annual OpEx', type: 'number', min: 0, default: 600000 },
            { name: 'growthRate', label: 'Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.2 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.15 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'technologyObsolescenceRisk', label: 'Technology Obsolescence Risk (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'lifetimeValue', label: 'Lifetime Value (LTV)', type: 'number', min: 0, default: 1200 },
            { name: 'customerAcquisitionCost', label: 'Customer Acquisition Cost (CAC)', type: 'number', min: 0, default: 200 },
            { name: 'proprietaryTechnology', label: 'Proprietary Technology (0-100)', type: 'number', min: 0, max: 100, default: 70 },
          ],
          // 9. Exit / Liquidity
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 9 },
          ],
          // 10. Future / Growth
          [
            { name: 'terminalGrowth', label: 'Terminal Growth (0-1)', type: 'number', min: 0, max: 0.1, step: 0.01, default: 0.03 },
            { name: 'projectionYears', label: 'Projection Years', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
        ],
        maritimeAsset: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Sample vessel', default: 'Sample Vessel' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City / Ports', type: 'text', placeholder: 'Jeddah', default: 'Jeddah' },
            { name: 'assetType', label: 'Maritime Asset Type', type: 'select', options: [ { value: 'vessel', label: 'Cargo Vessel' }, { value: 'tanker', label: 'Tanker' }, { value: 'passenger', label: 'Passenger Ship' }, { value: 'tugboat', label: 'Tugboat' }, { value: 'fishing', label: 'Fishing Vessel' }, { value: 'other', label: 'Other' } ], default: 'vessel' },
            { name: 'yearBuilt', label: 'Year Built', type: 'number', min: 1900, max: 2030, default: 2010 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'maintenanceLevel', label: 'Maintenance Level (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'inspectionScore', label: 'Class Inspection Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
          ],
          // 3. Historical Cost
          [
            { name: 'purchasePrice', label: 'Purchase Price', type: 'number', min: 0, default: 5000000 },
            { name: 'refitCosts', label: 'Refit Costs', type: 'number', min: 0, default: 500000 },
            { name: 'regulatoryCertificationValue', label: 'Certification Value', type: 'number', min: 0, default: 200000 },
            { name: 'acquisitionCosts', label: 'Acquisition Costs', type: 'number', min: 0, default: 150000 },
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 25 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 1200000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'Replacement Cost New', type: 'number', min: 0, default: 6000000 },
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 4500000 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
          ],
          // 6. Income
          [
            { name: 'dailyCharterRate', label: 'Daily Charter Rate', type: 'number', min: 0, default: 15000 },
            { name: 'operatingDaysPerYear', label: 'Operating Days per Year', type: 'number', min: 0, max: 365, default: 220 },
            { name: 'utilizationRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'annualOperatingCost', label: 'Annual Operating Cost', type: 'number', min: 0, default: 1200000 },
            { name: 'capRate', label: 'Capitalization Rate (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.1 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'Freight Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 6 },
            { name: 'environmentalRisk', label: 'Environmental Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'geopoliticalRisk', label: 'Geopolitical Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'licensesValue', label: 'Licenses / Registration Value', type: 'number', min: 0, default: 300000 },
            { name: 'routeValue', label: 'Route / Contract Value', type: 'number', min: 0, default: 500000 },
            { name: 'brandStrength', label: 'Operator Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'Efficiency / Upgrade Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        logisticsAsset: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Sample warehouse', default: 'Sample Logistics Facility' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Logistics Asset Type', type: 'select', options: [ { value: 'warehouse', label: 'Warehouse' }, { value: 'distributionCenter', label: 'Distribution Center' }, { value: 'fleet', label: 'Transport Fleet' }, { value: 'coldStorage', label: 'Cold Storage' }, { value: 'other', label: 'Other' } ], default: 'warehouse' },
            { name: 'areaSqm', label: 'Area (m²)', type: 'number', min: 1, default: 5000 },
            { name: 'yearBuilt', label: 'Year Built', type: 'number', min: 1900, max: 2030, default: 2015 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'occupancyRate', label: 'Occupancy / Utilization (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.75 },
            { name: 'automationPlan', label: 'Automation Level (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'Land Cost', type: 'number', min: 0, default: 2000000 },
            { name: 'buildingCost', label: 'Building Cost', type: 'number', min: 0, default: 4000000 },
            { name: 'equipmentCost', label: 'Equipment / Handling Cost', type: 'number', min: 0, default: 800000 },
            { name: 'rackingCost', label: 'Racking / Storage Systems Cost', type: 'number', min: 0, default: 400000 },
            { name: 'improvementCosts', label: 'Improvement Costs', type: 'number', min: 0, default: 300000 },
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 40 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 1200000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 5. Market
          [
            { name: 'comparablePricePerSqm', label: 'Comparable Price per m²', type: 'number', min: 0, default: 1500 },
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 0 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'annualRentalRevenue', label: 'Annual Rental / Contract Revenue', type: 'number', min: 0, default: 0 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'capRate', label: 'Capitalization Rate (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.08 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'locationPremium', label: 'Location Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'permitsValue', label: 'Permits Value', type: 'number', min: 0, default: 200000 },
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 12 },
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'automationPlan', label: 'Automation / Digital Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        fuelStation: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Station Name', type: 'text', placeholder: 'Sample Fuel Station', default: 'Sample Fuel Station' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Station Type', type: 'select', options: [ { value: 'highway', label: 'Highway' }, { value: 'urban', label: 'Urban' }, { value: 'remote', label: 'Remote' }, { value: 'truckStop', label: 'Truck Stop' }, { value: 'other', label: 'Other' } ], default: 'highway' },
            { name: 'yearBuilt', label: 'Year Built', type: 'number', min: 1900, max: 2030, default: 2015 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'occupancyRate', label: 'Utilization Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.9 },
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
          // 3. Historical Cost
          [
            { name: 'landCost', label: 'Land Cost', type: 'number', min: 0, default: 1500000 },
            { name: 'constructionCost', label: 'Construction Cost', type: 'number', min: 0, default: 1200000 },
            { name: 'equipmentCost', label: 'Equipment Cost', type: 'number', min: 0, default: 800000 },
            { name: 'tanksPumpsCost', label: 'Tanks / Pumps Cost', type: 'number', min: 0, default: 600000 },
            { name: 'improvementCosts', label: 'Improvement Costs', type: 'number', min: 0, default: 200000 },
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 30 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 1000000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 5. Market
          [
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 0 },
            { name: 'trafficGrowthRate', label: 'Traffic Growth Rate (0-1)', type: 'number', min: 0, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
          ],
          // 6. Income
          [
            { name: 'dailyFuelVolume', label: 'Daily Fuel Volume (liters)', type: 'number', min: 0, default: 5000 },
            { name: 'marginPerLiter', label: 'Margin per Liter (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'annualConvenienceRevenue', label: 'Annual Convenience Revenue', type: 'number', min: 0, default: 400000 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'capRate', label: 'Capitalization Rate (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.1 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'environmentalRisk', label: 'Environmental Risk (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'marketVolatility', label: 'Price Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'permitsValue', label: 'Permits Value', type: 'number', min: 0, default: 300000 },
            { name: 'locationPremium', label: 'Location Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 9 },
          ],
          // 10. Future
          [
            { name: 'trafficGrowthRate', label: 'Traffic Growth (0-1)', type: 'number', min: 0, max: 0.5, step: 0.01, default: 0.03 },
            { name: 'automationPlan', label: 'Upgrade / Services Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        beautyWellness: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Sample salon/spa', default: 'Sample Beauty & Wellness Center' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Business Type', type: 'select', options: [ { value: 'salon', label: 'Salon' }, { value: 'spa', label: 'Spa' }, { value: 'wellness', label: 'Wellness Center' }, { value: 'clinic', label: 'Aesthetic Clinic' }, { value: 'other', label: 'Other' } ], default: 'salon' },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2018 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 8 },
            { name: 'occupancyRate', label: 'Appointment / Chair Utilization (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.7 },
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 60 },
          ],
          // 3. Historical Cost
          [
            { name: 'equipmentCost', label: 'Equipment Cost', type: 'number', min: 0, default: 300000 },
            { name: 'leaseholdImprovements', label: 'Leasehold Improvements', type: 'number', min: 0, default: 400000 },
            { name: 'inventoryCost', label: 'Products / Consumables Inventory', type: 'number', min: 0, default: 150000 },
            { name: 'furnitureCost', label: 'Furniture Cost', type: 'number', min: 0, default: 100000 },
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 10 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 150000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 5. Market
          [
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 0 },
            { name: 'revenueMultiple', label: 'Revenue Multiple', type: 'number', min: 0, step: 0.1, default: 1.2 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
          ],
          // 6. Income
          [
            { name: 'dailyCustomers', label: 'Daily Customers', type: 'number', min: 0, default: 30 },
            { name: 'avgSpendPerCustomer', label: 'Average Spend per Customer', type: 'number', min: 0, default: 200 },
            { name: 'cogsRate', label: 'COGS Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
            { name: 'capRate', label: 'Capitalization Rate (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'successionRisk', label: 'Succession Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
          ],
          // 8. Intangibles
          [
            { name: 'recurringRevenueShare', label: 'Recurring Revenue Share (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'membershipsValue', label: 'Memberships / Packages Value', type: 'number', min: 0, default: 50000 },
            { name: 'locationPremium', label: 'Location Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.06 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 6 },
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'automationPlan', label: 'Digital Booking / Upgrade Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
        giftsStationery: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Sample gift shop', default: 'Sample Gifts & Stationery Shop' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Store Type', type: 'select', options: [ { value: 'gifts', label: 'Gifts' }, { value: 'stationery', label: 'Stationery' }, { value: 'mixed', label: 'Mixed' }, { value: 'online', label: 'Online Store' }, { value: 'other', label: 'Other' } ], default: 'mixed' },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2019 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'inventoryTurnover', label: 'Inventory Turnover (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
          // 3. Historical Cost
          [
            { name: 'inventoryCost', label: 'Inventory Cost', type: 'number', min: 0, default: 200000 },
            { name: 'fixturesCost', label: 'Fixtures / Display Cost', type: 'number', min: 0, default: 120000 },
            { name: 'leaseholdImprovements', label: 'Leasehold Improvements', type: 'number', min: 0, default: 150000 },
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 10 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 80000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 5. Market
          [
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 0 },
            { name: 'revenueMultiple', label: 'Revenue Multiple', type: 'number', min: 0, step: 0.1, default: 0.8 },
            { name: 'locationPremium', label: 'Location Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'monthlyRevenue', label: 'Monthly Revenue', type: 'number', min: 0, default: 50000 },
            { name: 'cogsRate', label: 'COGS Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'capRate', label: 'Capitalization Rate (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'locationPremium', label: 'Location Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 4 },
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'Digital Transformation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        furnitureAsset: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Asset Name', type: 'text', placeholder: 'Sample furniture showroom', default: 'Sample Furniture Showroom' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Furniture Type', type: 'select', options: [ { value: 'home', label: 'Home Furniture' }, { value: 'office', label: 'Office Furniture' }, { value: 'mixed', label: 'Mixed' }, { value: 'custom', label: 'Custom Made' }, { value: 'other', label: 'Other' } ], default: 'mixed' },
            { name: 'yearAcquired', label: 'Year Acquired', type: 'number', min: 1900, max: 2030, default: 2018 },
          ],
          // 2. Condition
          [
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'inventoryTurnover', label: 'Inventory Turnover (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
          // 3. Historical Cost
          [
            { name: 'inventoryValue', label: 'Inventory Value', type: 'number', min: 0, default: 500000 },
            { name: 'showroomCost', label: 'Showroom Cost', type: 'number', min: 0, default: 300000 },
            { name: 'warehouseCost', label: 'Warehouse Cost', type: 'number', min: 0, default: 200000 },
            { name: 'deliveryFleetValue', label: 'Delivery Fleet Value', type: 'number', min: 0, default: 150000 },
          ],
          // 4. Depreciation
          [
            { name: 'usefulLifeYears', label: 'Useful Life (years)', type: 'number', min: 1, default: 15 },
            { name: 'accumulatedDepreciation', label: 'Accumulated Depreciation', type: 'number', min: 0, default: 200000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 5. Market
          [
            { name: 'replacementCostNew', label: 'Replacement Cost New', type: 'number', min: 0, default: 0 },
            { name: 'comparableSalesValue', label: 'Comparable Sales Value', type: 'number', min: 0, default: 0 },
            { name: 'demandIndex', label: 'Demand Index (1-10)', type: 'number', min: 1, max: 10, default: 6 },
            { name: 'supplyIndex', label: 'Supply Index (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'monthlyRevenue', label: 'Monthly Revenue', type: 'number', min: 0, default: 80000 },
            { name: 'cogsRate', label: 'COGS Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.55 },
            { name: 'operatingExpensesRate', label: 'Operating Expenses Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'capRate', label: 'Capitalization Rate (0-1)', type: 'number', min: 0.01, max: 0.5, step: 0.005, default: 0.12 },
          ],
          // 7. Risks
          [
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'marketVolatility', label: 'Market Volatility (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'concentrationRisk', label: 'Concentration Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 55 },
            { name: 'warrantyValue', label: 'Warranty / Service Value', type: 'number', min: 0, default: 30000 },
            { name: 'locationPremium', label: 'Location Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.1 },
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 5 },
            { name: 'liquidationTimeMonths', label: 'Liquidation Time (months)', type: 'number', min: 1, max: 36, default: 6 },
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'automationPlan', label: 'Digital Transformation Plan (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 50 },
          ],
        ],
        retailBusiness: [
          // 1. Identity
          [
            { name: 'assetName', label: 'Business Name', type: 'text', placeholder: 'Sample retail business', default: 'Sample Retail Business' },
            { name: 'country', label: 'Country', type: 'text', placeholder: 'Saudi Arabia', default: 'Saudi Arabia' },
            { name: 'city', label: 'City', type: 'text', placeholder: 'Riyadh', default: 'Riyadh' },
            { name: 'assetType', label: 'Retail Type', type: 'select', options: [ { value: 'general', label: 'General Retail' }, { value: 'fashion', label: 'Fashion' }, { value: 'electronics', label: 'Electronics' }, { value: 'food', label: 'Food Retail' }, { value: 'mixed', label: 'Mixed' }, { value: 'other', label: 'Other' } ], default: 'general' },
            { name: 'yearsInOperation', label: 'Years in Operation', type: 'number', min: 0, default: 6 },
          ],
          // 2. Condition
          [
            { name: 'managementQuality', label: 'Management Quality (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'governanceScore', label: 'Governance Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
            { name: 'conditionScore', label: 'Condition Score (1-10)', type: 'number', min: 1, max: 10, default: 7 },
          ],
          // 3. Historical Cost
          [
            { name: 'equityBookValue', label: 'Equity Book Value', type: 'number', min: 0, default: 800000 },
            { name: 'inventoryValue', label: 'Inventory Value', type: 'number', min: 0, default: 400000 },
            { name: 'fixedAssetsValue', label: 'Fixed Assets Value', type: 'number', min: 0, default: 300000 },
            { name: 'totalLiabilities', label: 'Total Liabilities', type: 'number', min: 0, default: 250000 },
          ],
          // 4. Depreciation
          [
            { name: 'annualCapex', label: 'Annual CapEx', type: 'number', min: 0, default: 80000 },
            { name: 'obsolescenceFactor', label: 'Obsolescence Factor (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
          ],
          // 5. Market
          [
            { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', min: 0, default: 2500000 },
            { name: 'ebitdaMargin', label: 'EBITDA Margin (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.12 },
            { name: 'revenueMultiple', label: 'Revenue Multiple', type: 'number', min: 0, step: 0.1, default: 0.6 },
            { name: 'ebitdaMultiple', label: 'EBITDA Multiple', type: 'number', min: 0, step: 0.5, default: 5 },
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
          ],
          // 6. Income
          [
            { name: 'growthRate', label: 'Revenue Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
            { name: 'taxRate', label: 'Tax Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.2 },
            { name: 'discountRate', label: 'Discount Rate (0-1)', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.12 },
            { name: 'projectionYears', label: 'Projection Years', type: 'number', min: 1, max: 10, default: 5 },
          ],
          // 7. Risks
          [
            { name: 'customerConcentration', label: 'Customer Concentration (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'competitiveIntensity', label: 'Competitive Intensity (0-10)', type: 'number', min: 0, max: 10, default: 5 },
            { name: 'regulatoryRisk', label: 'Regulatory Risk (0-10)', type: 'number', min: 0, max: 10, default: 4 },
            { name: 'currencyRisk', label: 'Currency Risk (0-10)', type: 'number', min: 0, max: 10, default: 3 },
          ],
          // 8. Intangibles
          [
            { name: 'brandStrength', label: 'Brand Strength (0-100)', type: 'number', min: 0, max: 100, default: 55 },
            { name: 'locationPremium', label: 'Location Premium (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.15 },
            { name: 'inventoryTurnover', label: 'Inventory Turnover (1-10)', type: 'number', min: 1, max: 10, default: 5 },
          ],
          // 9. Exit
          [
            { name: 'transactionCostsRate', label: 'Transaction Costs Rate (0-1)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
            { name: 'buyerPoolDepth', label: 'Buyer Pool Depth (1-10)', type: 'number', min: 1, max: 10, default: 6 },
          ],
          // 10. Future
          [
            { name: 'marketGrowthRate', label: 'Market Growth Rate (0-1)', type: 'number', min: -0.2, max: 0.5, step: 0.01, default: 0.04 },
            { name: 'innovationPipeline', label: 'Expansion / Innovation Pipeline (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
            { name: 'esgScore', label: 'ESG Score (0-100)', type: 'number', min: 0, max: 100, default: 55 },
          ],
        ],
      }
    }
  };

  // Expose globally for both browser and Node/test environments
  if (typeof window !== 'undefined') {
    window.VALUATION_LOCALES = VALUATION_LOCALES;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.VALUATION_LOCALES = VALUATION_LOCALES;
  }
})();
