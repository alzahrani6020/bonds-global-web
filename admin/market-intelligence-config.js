/**
 * Bonds Market Intelligence Standards
 * ملف مرجعي موحد لإعدادات الذكاء السوقي (فئات الأصول، الحقول، النظرة).
 * يُستخدم من admin/market-intelligence.html ويمكن استيراده من وحدات أخرى.
 */
(function (global) {
  'use strict';

  const ASSET_CLASSES = [
    { value: 'realEstate', label: 'العقارات' },
    { value: 'business', label: 'الشركات' },
    { value: 'factory', label: 'المصانع' },
    { value: 'machineryEquipment', label: 'الآلات والمعدات' },
    { value: 'vehiclesFleet', label: 'المركبات والأساطيل' },
    { value: 'agricultureFarms', label: 'الزراعة والمزارع' },
    { value: 'livestock', label: 'الثروة الحيوانية' },
    { value: 'naturalResourcesMining', label: 'الموارد الطبيعية والتعدين' },
    { value: 'oilGas', label: 'النفط والغاز' },
    { value: 'infrastructure', label: 'البنية التحتية' },
    { value: 'intellectualProperty', label: 'الملكية الفكرية' },
    { value: 'brandsTrademarks', label: 'العلامات التجارية' },
    { value: 'patents', label: 'براءات الاختراع' },
    { value: 'copyrightsContent', label: 'حقوق المؤلف' },
    { value: 'franchises', label: 'الامتيازات التجارية' },
    { value: 'licensesPermits', label: 'التراخيص والتصاريح' },
    { value: 'financialAssets', label: 'الأصول المالية' },
    { value: 'cryptoDigital', label: 'العملات الرقمية' },
    { value: 'commodities', label: 'السلع' },
    { value: 'artCollectibles', label: 'الفنون والمقتنيات' },
    { value: 'jewelryPreciousMetals', label: 'المجوهرات والمعادن' },
    { value: 'softwareTechnology', label: 'البرمجيات والتقنية' },
    { value: 'medicalEquipment', label: 'الأجهزة الطبية' },
    { value: 'educationalEquipment', label: 'التجهيزات التعليمية' },
    { value: 'distressedAsset', label: 'الأصول المتعثرة' },
    { value: 'tourismAsset', label: 'الأصول السياحية' },
    { value: 'personalWealth', label: 'الثروة الشخصية' },
    { value: 'scrapSalvage', label: 'السكراب والخردة' },
    { value: 'maritimeAsset', label: 'الأصول البحرية' },
    { value: 'logisticsAsset', label: 'الأصول اللوجستية' },
    { value: 'fuelStation', label: 'محطات الوقود' },
    { value: 'beautyWellness', label: 'التجميل والصحة' },
    { value: 'giftsStationery', label: 'الهدايا والماليات' },
    { value: 'furnitureAsset', label: 'الأثاث' },
    { value: 'retailBusiness', label: 'نشاط تجاري عام' }
  ];

  const FIELDS = [
    { key: 'average_selling_price', label: 'سعر البيع', type: 'number' },
    { key: 'average_buying_price', label: 'سعر الشراء', type: 'number' },
    { key: 'transaction_count', label: 'الصفقات', type: 'number' },
    { key: 'supply_index', label: 'العرض', type: 'number', min: 1, max: 10 },
    { key: 'demand_index', label: 'الطلب', type: 'number', min: 1, max: 10 },
    { key: 'competitor_count', label: 'المنافسين', type: 'number' },
    { key: 'average_sale_speed_days', label: 'السرعة', type: 'number' },
    { key: 'inflation_rate', label: 'التضخم', type: 'number', step: 0.001 },
    { key: 'interest_rate', label: 'الفائدة', type: 'number', step: 0.001 },
    { key: 'economic_growth_rate', label: 'النمو', type: 'number', step: 0.001 },
    { key: 'risk_score', label: 'المخاطرة', type: 'number', min: 0, max: 10, step: 0.1 },
    { key: 'confidence', label: 'الثقة', type: 'number', min: 0, max: 1, step: 0.01 },
    { key: 'data_quality_score', label: 'الجودة', type: 'number', min: 0, max: 100, step: 1 }
  ];

  const OUTLOOKS = [
    { value: 'positive', label: 'إيجابية' },
    { value: 'neutral', label: 'محايدة' },
    { value: 'negative', label: 'سلبية' }
  ];

  const Standards = {
    ASSET_CLASSES: Object.freeze(ASSET_CLASSES.map(Object.freeze)),
    FIELDS: Object.freeze(FIELDS.map(Object.freeze)),
    OUTLOOKS: Object.freeze(OUTLOOKS.map(Object.freeze)),
    listAssetClasses: () => ASSET_CLASSES.slice(),
    getFieldDefinitions: () => FIELDS.slice(),
    getOutlooks: () => OUTLOOKS.slice(),
    getAssetClassLabel: (value) => {
      const found = ASSET_CLASSES.find(c => c.value === value);
      return found ? found.label : value;
    }
  };

  global.BondsMarketIntelligenceStandards = Standards;
})(typeof window !== 'undefined' ? window : globalThis);
