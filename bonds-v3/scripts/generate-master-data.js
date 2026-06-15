/**
 * Bonds V3 — Baseline Master Data Generator
 *
 * Reads existing CSVs in master-data/ and generates a baseline chain for any
 * sector that does not yet have sub-sectors. Preserves existing data.
 *
 * Run: node scripts/generate-master-data.js
 */
const fs = require('fs');
const path = require('path');

const MASTER_DIR = path.join(__dirname, '..', 'master-data');
const BACKUP_DIR = path.join(MASTER_DIR, 'backup', Date.now().toString());

const SIZE_PROFILES = {
  small: {
    capex_min: 100000,
    capex_max: 300000,
    revenue_min: 200000,
    revenue_max: 500000,
    employee_count_min: 2,
    employee_count_max: 5,
    typical_roi_months: 18,
    rent_monthly: 5000,
    salaries_monthly: 15000,
    marketing_monthly: 2000,
    utilities_monthly: 1000,
    insurance_monthly: 800,
    risk_adjustment: 5
  },
  medium: {
    capex_min: 400000,
    capex_max: 1000000,
    revenue_min: 800000,
    revenue_max: 2000000,
    employee_count_min: 6,
    employee_count_max: 15,
    typical_roi_months: 24,
    rent_monthly: 15000,
    salaries_monthly: 45000,
    marketing_monthly: 6000,
    utilities_monthly: 3000,
    insurance_monthly: 2000,
    risk_adjustment: 0
  },
  large: {
    capex_min: 1500000,
    capex_max: 5000000,
    revenue_min: 2500000,
    revenue_max: 8000000,
    employee_count_min: 16,
    employee_count_max: 40,
    typical_roi_months: 36,
    rent_monthly: 40000,
    salaries_monthly: 120000,
    marketing_monthly: 18000,
    utilities_monthly: 8000,
    insurance_monthly: 5000,
    risk_adjustment: -5
  }
};

const STANDARD_ASSUMPTIONS = [
  { code: 'rent_monthly', name_ar: 'الإيجار الشهري', name_en: 'Monthly Rent', category: 'opex', unit_type: 'fixed_amount', description: 'Monthly rent for space', default_value: 0 },
  { code: 'salaries_monthly', name_ar: 'الرواتب الشهرية', name_en: 'Monthly Salaries', category: 'opex', unit_type: 'fixed_amount', description: 'Total monthly salaries', default_value: 0 },
  { code: 'marketing_monthly', name_ar: 'التسويق الشهري', name_en: 'Monthly Marketing', category: 'opex', unit_type: 'fixed_amount', description: 'Monthly marketing budget', default_value: 0 },
  { code: 'utilities_monthly', name_ar: 'الخدمات الشهرية', name_en: 'Monthly Utilities', category: 'opex', unit_type: 'fixed_amount', description: 'Electricity water internet', default_value: 0 },
  { code: 'insurance_monthly', name_ar: 'التأمين الشهري', name_en: 'Monthly Insurance', category: 'opex', unit_type: 'fixed_amount', description: 'Monthly insurance premiums', default_value: 0 },
  { code: 'revenue_growth_rate', name_ar: 'معدل نمو الإيرادات', name_en: 'Revenue Growth Rate', category: 'revenue', unit_type: 'percentage', description: 'Annual revenue growth', default_value: 5 },
  { code: 'cogs_ratio', name_ar: 'نسبة تكلفة البضاعة', name_en: 'COGS Ratio', category: 'cogs', unit_type: 'percentage', description: 'Cost of goods sold ratio', default_value: 35 },
  { code: 'vat_rate', name_ar: 'نسبة ضريبة القيمة المضافة', name_en: 'VAT Rate', category: 'tax', unit_type: 'percentage', description: 'VAT percentage', default_value: 15 },
  { code: 'corporate_tax_rate', name_ar: 'نسبة ضريبة الأرباح', name_en: 'Corporate Tax Rate', category: 'tax', unit_type: 'percentage', description: 'Corporate income tax', default_value: 20 },
  { code: 'annual_depreciation_rate', name_ar: 'معدل الإهلاك السنوي', name_en: 'Annual Depreciation Rate', category: 'capex', unit_type: 'percentage', description: 'Depreciation rate', default_value: 10 },
  { code: 'working_capital_days', name_ar: 'أيام رأس المال العامل', name_en: 'Working Capital Days', category: 'working_capital', unit_type: 'fixed_amount', description: 'Days of revenue held as working capital', default_value: 30 },
  { code: 'discount_rate', name_ar: 'معدل الخصم', name_en: 'Discount Rate', category: 'financing', unit_type: 'percentage', description: 'NPV discount rate', default_value: 10 },
  { code: 'loan_ratio', name_ar: 'نسبة التمويل', name_en: 'Loan Ratio', category: 'financing', unit_type: 'percentage', description: 'Share of investment financed by loan', default_value: 50 },
  { code: 'interest_rate', name_ar: 'معدل الفائدة', name_en: 'Interest Rate', category: 'financing', unit_type: 'percentage', description: 'Annual loan interest', default_value: 8 },
  { code: 'loan_term_years', name_ar: 'مدة القرض (سنوات)', name_en: 'Loan Term Years', category: 'financing', unit_type: 'fixed_amount', description: 'Loan repayment term', default_value: 5 }
];

const STANDARD_RISKS = [
  { code: 'competition', name_ar: 'المنافسة', name_en: 'Competition', category: 'market', default_score: 60, description: 'Level of market competition' },
  { code: 'regulatory', name_ar: 'التنظيم والتراخيص', name_en: 'Regulatory & Licensing', category: 'legal', default_score: 40, description: 'Government regulation and licensing risk' },
  { code: 'demand', name_ar: 'طلب السوق', name_en: 'Market Demand', category: 'market', default_score: 50, description: 'Customer demand fluctuation' },
  { code: 'location', name_ar: 'موقع المشروع', name_en: 'Location Risk', category: 'operational', default_score: 55, description: 'Impact of location on performance' },
  { code: 'staff', name_ar: 'توظيف الكوادر', name_en: 'Staff Recruitment', category: 'operational', default_score: 45, description: 'Availability of qualified staff' },
  { code: 'technology', name_ar: 'التقنية والمعدات', name_en: 'Technology & Equipment', category: 'operational', default_score: 35, description: 'Equipment failure or obsolescence' },
  { code: 'financial', name_ar: 'المخاطر المالية', name_en: 'Financial Risk', category: 'financial', default_score: 50, description: 'Cash flow and financing risk' },
  { code: 'reputation', name_ar: 'السمعة', name_en: 'Reputation Risk', category: 'market', default_score: 40, description: 'Brand and reputation risk' }
];

function detectCategory(sector) {
  const text = (sector.name_en + ' ' + sector.name_ar + ' ' + sector.code).toLowerCase();
  if (/manufactur|صناعي|تصنيع|مصانع/.test(text)) return 'manufacturing';
  if (/health|صحي|طبي|مستشف|عيادة|صيدل/.test(text)) return 'health';
  if (/edu|تعليم|مدرس|جامع|تدريب/.test(text)) return 'education';
  if (/financ|bank|insur|مصرف|تأمين|مالي|استثمار/.test(text)) return 'finance';
  if (/tech|software|it|تقنية|برمج|حاسب/.test(text)) return 'technology';
  if (/retail|trade|تجارة|تجزئة|بيع|سوق/.test(text)) return 'trade';
  if (/real estate|عقار|إسكان|بناء|تطوير/.test(text)) return 'real_estate';
  if (/logistics|transport|shipping|نقل|لوجست|مستودع/.test(text)) return 'logistics';
  if (/energy|oil|gas|renewable|طاقة|نفط|كهرباء/.test(text)) return 'energy';
  if (/agri|farm|livestock|زراعة|حيوان|مزرع/.test(text)) return 'agriculture';
  if (/tourism|entertainment|media|sport|سياحة|ترفيه|رياضة|إعلام/.test(text)) return 'entertainment';
  if (/food|restaurant|cafe|catering|مطعم|مأكول|مقهى/.test(text)) return 'food';
  if (/government|public|service|حكومة|بلدية|خدمات عامة/.test(text)) return 'government';
  return 'services';
}

function getSubSectorTemplates(category) {
  const map = {
    manufacturing: [
      { code: 'factories', name_ar: 'المصانع', name_en: 'Factories' },
      { code: 'workshops', name_ar: 'الورش', name_en: 'Workshops' },
      { code: 'assembly', name_ar: 'التجميع', name_en: 'Assembly' },
      { code: 'packaging', name_ar: 'التعبئة والتغليف', name_en: 'Packaging' }
    ],
    health: [
      { code: 'clinics', name_ar: 'العيادات', name_en: 'Clinics' },
      { code: 'hospitals', name_ar: 'المستشفيات', name_en: 'Hospitals' },
      { code: 'pharmacies', name_ar: 'الصيدليات', name_en: 'Pharmacies' },
      { code: 'medical_labs', name_ar: 'المختبرات الطبية', name_en: 'Medical Labs' }
    ],
    education: [
      { code: 'schools', name_ar: 'المدارس', name_en: 'Schools' },
      { code: 'training', name_ar: 'مراكز التدريب', name_en: 'Training Centers' },
      { code: 'universities', name_ar: 'الجامعات', name_en: 'Universities' },
      { code: 'elearning', name_ar: 'التعليم الإلكتروني', name_en: 'E-Learning' }
    ],
    finance: [
      { code: 'banking', name_ar: 'الخدمات المصرفية', name_en: 'Banking Services' },
      { code: 'insurance', name_ar: 'التأمين', name_en: 'Insurance' },
      { code: 'fintech', name_ar: 'التقنية المالية', name_en: 'Fintech' },
      { code: 'investment', name_ar: 'الاستثمار', name_en: 'Investment' }
    ],
    technology: [
      { code: 'software', name_ar: 'البرمجيات', name_en: 'Software' },
      { code: 'hardware', name_ar: 'الأجهزة', name_en: 'Hardware' },
      { code: 'it_services', name_ar: 'خدمات تكنولوجيا المعلومات', name_en: 'IT Services' },
      { code: 'telecom', name_ar: 'الاتصالات', name_en: 'Telecommunications' }
    ],
    trade: [
      { code: 'retail', name_ar: 'التجزئة', name_en: 'Retail' },
      { code: 'wholesale', name_ar: 'الجملة', name_en: 'Wholesale' },
      { code: 'ecommerce', name_ar: 'التجارة الإلكترونية', name_en: 'E-Commerce' },
      { code: 'import_export', name_ar: 'الاستيراد والتصدير', name_en: 'Import & Export' }
    ],
    real_estate: [
      { code: 'residential', name_ar: 'السكني', name_en: 'Residential' },
      { code: 'commercial', name_ar: 'التجاري', name_en: 'Commercial' },
      { code: 'industrial', name_ar: 'الصناعي', name_en: 'Industrial' },
      { code: 'brokerage', name_ar: 'الوساطة العقارية', name_en: 'Real Estate Brokerage' }
    ],
    logistics: [
      { code: 'transport', name_ar: 'النقل', name_en: 'Transport' },
      { code: 'warehousing', name_ar: 'التخزين', name_en: 'Warehousing' },
      { code: 'shipping', name_ar: 'الشحن', name_en: 'Shipping' },
      { code: 'last_mile', name_ar: 'التوصيل الأخير', name_en: 'Last Mile Delivery' }
    ],
    energy: [
      { code: 'renewable', name_ar: 'الطاقة المتجددة', name_en: 'Renewable Energy' },
      { code: 'oil_gas', name_ar: 'النفط والغاز', name_en: 'Oil & Gas' },
      { code: 'utilities', name_ar: 'الخدمات العامة', name_en: 'Utilities' },
      { code: 'efficiency', name_ar: 'كفاءة الطاقة', name_en: 'Energy Efficiency' }
    ],
    agriculture: [
      { code: 'farming', name_ar: 'الزراعة', name_en: 'Farming' },
      { code: 'livestock', name_ar: 'تربية الحيوان', name_en: 'Livestock' },
      { code: 'processing', name_ar: 'تجهيز المنتجات', name_en: 'Processing' },
      { code: 'distribution', name_ar: 'التوزيع', name_en: 'Distribution' }
    ],
    entertainment: [
      { code: 'events', name_ar: 'الفعاليات', name_en: 'Events' },
      { code: 'media', name_ar: 'الإعلام', name_en: 'Media' },
      { code: 'sports', name_ar: 'الرياضة', name_en: 'Sports' },
      { code: 'tourism', name_ar: 'السياحة', name_en: 'Tourism' }
    ],
    food: [
      { code: 'restaurants', name_ar: 'المطاعم', name_en: 'Restaurants' },
      { code: 'cafes', name_ar: 'المقاهي', name_en: 'Cafes' },
      { code: 'catering', name_ar: 'التموين', name_en: 'Catering' },
      { code: 'fast_food', name_ar: 'الوجبات السريعة', name_en: 'Fast Food' }
    ],
    government: [
      { code: 'public_services', name_ar: 'الخدمات العامة', name_en: 'Public Services' },
      { code: 'consulting', name_ar: 'الاستشارات الحكومية', name_en: 'Government Consulting' },
      { code: 'facilities', name_ar: 'إدارة المرافق', name_en: 'Facilities Management' },
      { code: 'digital', name_ar: 'التحول الرقمي', name_en: 'Digital Transformation' }
    ],
    services: [
      { code: 'consulting', name_ar: 'الاستشارات', name_en: 'Consulting' },
      { code: 'maintenance', name_ar: 'الصيانة', name_en: 'Maintenance' },
      { code: 'cleaning', name_ar: 'النظافة', name_en: 'Cleaning Services' },
      { code: 'security', name_ar: 'الأمن والحراسة', name_en: 'Security Services' }
    ]
  };
  return map[category] || map.services;
}

function getRegulatoryTemplates(category) {
  const base = [
    { requirement_name_ar: 'سجل تجاري', requirement_name_en: 'Commercial Registration', issuing_authority: 'Ministry of Commerce', estimated_cost: 2000, mandatory: true, sort_order: 1 },
    { requirement_name_ar: 'ترخيص بلدية', requirement_name_en: 'Municipality License', issuing_authority: 'Municipality', estimated_cost: 5000, mandatory: true, sort_order: 2 }
  ];
  const extras = {
    health: [
      { requirement_name_ar: 'ترخيص وزارة الصحة', requirement_name_en: 'Ministry of Health License', issuing_authority: 'Ministry of Health', estimated_cost: 15000, mandatory: true, sort_order: 3 },
      { requirement_name_ar: 'ترخيص مزاولة مهنة طبية', requirement_name_en: 'Medical Practice License', issuing_authority: 'Saudi Commission for Health Specialties', estimated_cost: 3000, mandatory: true, sort_order: 4 }
    ],
    food: [
      { requirement_name_ar: 'ترخيص هيئة الغذاء والدواء', requirement_name_en: 'SFDA License', issuing_authority: 'SFDA', estimated_cost: 8000, mandatory: true, sort_order: 3 },
      { requirement_name_ar: 'شهادة سلامة الغذاء', requirement_name_en: 'Food Safety Certificate', issuing_authority: 'Municipality', estimated_cost: 2500, mandatory: true, sort_order: 4 }
    ],
    manufacturing: [
      { requirement_name_ar: 'ترخيص مصنع', requirement_name_en: 'Factory License', issuing_authority: 'Ministry of Industry', estimated_cost: 20000, mandatory: true, sort_order: 3 },
      { requirement_name_ar: 'تصريح بيئي', requirement_name_en: 'Environmental Permit', issuing_authority: 'Ministry of Environment', estimated_cost: 10000, mandatory: true, sort_order: 4 }
    ],
    education: [
      { requirement_name_ar: 'ترخيص وزارة التعليم', requirement_name_en: 'Ministry of Education License', issuing_authority: 'Ministry of Education', estimated_cost: 10000, mandatory: true, sort_order: 3 },
      { requirement_name_ar: 'اعتماد برامج تدريبية', requirement_name_en: 'Training Program Accreditation', issuing_authority: 'TVTC', estimated_cost: 5000, mandatory: true, sort_order: 4 }
    ],
    finance: [
      { requirement_name_ar: 'ترخيص من البنك المركزي', requirement_name_en: 'Central Bank License', issuing_authority: 'SAMA', estimated_cost: 50000, mandatory: true, sort_order: 3 },
      { requirement_name_ar: 'اعتماد مؤسسي', requirement_name_en: 'Institutional Approval', issuing_authority: 'Ministry of Finance', estimated_cost: 15000, mandatory: true, sort_order: 4 }
    ],
    energy: [
      { requirement_name_ar: 'ترخيص وزارة الطاقة', requirement_name_en: 'Ministry of Energy License', issuing_authority: 'Ministry of Energy', estimated_cost: 30000, mandatory: true, sort_order: 3 },
      { requirement_name_ar: 'موافقة هيئة الكهرباء', requirement_name_en: 'Electricity Authority Approval', issuing_authority: 'Saudi Electricity Company', estimated_cost: 12000, mandatory: true, sort_order: 4 }
    ],
    logistics: [
      { requirement_name_ar: 'ترخيص نقل', requirement_name_en: 'Transport License', issuing_authority: 'Ministry of Transport', estimated_cost: 8000, mandatory: true, sort_order: 3 },
      { requirement_name_ar: 'تأمين مركبات', requirement_name_en: 'Vehicle Insurance', issuing_authority: 'Insurance Company', estimated_cost: 5000, mandatory: true, sort_order: 4 }
    ],
    real_estate: [
      { requirement_name_ar: 'ترخيص تطوير عقاري', requirement_name_en: 'Real Estate Development License', issuing_authority: 'Ministry of Municipalities', estimated_cost: 25000, mandatory: true, sort_order: 3 },
      { requirement_name_ar: 'رخصة بناء', requirement_name_en: 'Building Permit', issuing_authority: 'Municipality', estimated_cost: 15000, mandatory: true, sort_order: 4 }
    ],
    agriculture: [
      { requirement_name_ar: 'ترخيص زراعي', requirement_name_en: 'Agricultural License', issuing_authority: 'Ministry of Environment', estimated_cost: 4000, mandatory: true, sort_order: 3 },
      { requirement_name_ar: 'شهادة صحة حيوانية', requirement_name_en: 'Veterinary Health Certificate', issuing_authority: 'Ministry of Agriculture', estimated_cost: 3000, mandatory: true, sort_order: 4 }
    ]
  };
  return base.concat(extras[category] || [
    { requirement_name_ar: 'ترخيص مزاولة مهنة', requirement_name_en: 'Professional Practice License', issuing_authority: 'Relevant Authority', estimated_cost: 3000, mandatory: true, sort_order: 3 },
    { requirement_name_ar: 'تأمين المسؤولية المهنية', requirement_name_en: 'Professional Liability Insurance', issuing_authority: 'Insurance Company', estimated_cost: 4000, mandatory: true, sort_order: 4 }
  ]);
}

function getRiskScores(category, sizeProfile) {
  const base = {
    competition: 60,
    regulatory: 40,
    demand: 50,
    location: 55,
    staff: 45,
    technology: 35,
    financial: 50,
    reputation: 40
  };
  // category adjustments
  const adjustments = {
    finance: { regulatory: 30, financial: 55, competition: 70 },
    health: { regulatory: 20, reputation: 55, staff: 35 },
    food: { regulatory: 35, reputation: 55, demand: 65 },
    manufacturing: { technology: 50, supply_chain: 60, financial: 55 },
    technology: { technology: 60, competition: 75, financial: 45 },
    energy: { regulatory: 30, financial: 65, technology: 55 },
    agriculture: { climate: 60, demand: 45, supply_chain: 50 },
    entertainment: { demand: 65, reputation: 55, competition: 70 }
  };
  const adj = adjustments[category] || {};
  const scores = {};
  for (const code of Object.keys(base)) {
    let s = base[code] + (adj[code] || 0) + sizeProfile.risk_adjustment;
    s = Math.min(100, Math.max(0, s));
    scores[code] = s;
  }
  return scores;
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => row[h] = values[i] !== undefined ? values[i] : '');
    return row;
  });
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => row[h] !== undefined && row[h] !== null ? String(row[h]) : '').join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function backupExisting() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const files = [
    'sectors.csv', 'sub-sectors.csv', 'activities.csv', 'activity-details.csv',
    'project-models.csv', 'financial-assumptions.csv', 'project-model-assumptions.csv',
    'risk-factors.csv', 'project-model-risks.csv', 'regulatory-requirements.csv'
  ];
  for (const f of files) {
    const src = path.join(MASTER_DIR, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(BACKUP_DIR, f));
  }
  console.log('Backup created at', BACKUP_DIR);
}

function mergeByCode(existing, generated, codeField = 'code') {
  const map = new Map(existing.map(r => [r[codeField], r]));
  for (const r of generated) {
    map.set(r[codeField], r);
  }
  return Array.from(map.values());
}

function main() {
  backupExisting();

  const sectors = parseCsv(path.join(MASTER_DIR, 'sectors.csv'));
  let subSectors = parseCsv(path.join(MASTER_DIR, 'sub-sectors.csv'));
  let activities = parseCsv(path.join(MASTER_DIR, 'activities.csv'));
  let activityDetails = parseCsv(path.join(MASTER_DIR, 'activity-details.csv'));
  let projectModels = parseCsv(path.join(MASTER_DIR, 'project-models.csv'));
  let financialAssumptions = parseCsv(path.join(MASTER_DIR, 'financial-assumptions.csv'));
  let projectModelAssumptions = parseCsv(path.join(MASTER_DIR, 'project-model-assumptions.csv'));
  let riskFactors = parseCsv(path.join(MASTER_DIR, 'risk-factors.csv'));
  let projectModelRisks = parseCsv(path.join(MASTER_DIR, 'project-model-risks.csv'));
  let regulatoryRequirements = parseCsv(path.join(MASTER_DIR, 'regulatory-requirements.csv'));

  // Find sectors that already have sub-sectors (preserve existing chains)
  const sectorsWithData = new Set(subSectors.map(s => s.sector_code));

  let sortOrderSub = subSectors.length ? Math.max(...subSectors.map(s => Number(s.sort_order) || 0)) : 0;
  let sortOrderAct = activities.length ? Math.max(...activities.map(a => Number(a.sort_order) || 0)) : 0;
  let sortOrderDet = activityDetails.length ? Math.max(...activityDetails.map(d => Number(d.sort_order) || 0)) : 0;
  let sortOrderReq = regulatoryRequirements.length ? Math.max(...regulatoryRequirements.map(r => Number(r.sort_order) || 0)) : 0;

  const generatedModelCodes = [];

  for (const sector of sectors) {
    if (sectorsWithData.has(sector.code)) continue;

    const category = detectCategory(sector);
    const templates = getSubSectorTemplates(category);

    for (const tpl of templates) {
      sortOrderSub++;
      const subCode = `${sector.code}_${tpl.code}`;
      subSectors.push({
        sector_code: sector.code,
        code: subCode,
        name_ar: `${tpl.name_ar} - ${sector.name_ar}`,
        name_en: `${tpl.name_en} - ${sector.name_en}`,
        description: `${tpl.name_en} within ${sector.name_en}`,
        sort_order: sortOrderSub
      });

      sortOrderAct++;
      const activityCode = `${subCode}_activity`;
      activities.push({
        sub_sector_code: subCode,
        code: activityCode,
        name_ar: `نشاط ${tpl.name_ar}`,
        name_en: `${tpl.name_en} Activity`,
        description: `Main activity for ${tpl.name_en}`,
        sort_order: sortOrderAct
      });

      for (const size of ['small', 'medium', 'large']) {
        sortOrderDet++;
        const detailCode = `${activityCode}_${size}`;
        const sizeNameAr = size === 'small' ? 'صغير' : size === 'medium' ? 'متوسط' : 'كبير';
        const sizeNameEn = size === 'small' ? 'Small' : size === 'medium' ? 'Medium' : 'Large';
        activityDetails.push({
          activity_code: activityCode,
          code: detailCode,
          name_ar: `${tpl.name_ar} ${sizeNameAr}`,
          name_en: `${sizeNameEn} ${tpl.name_en}`,
          description: `${sizeNameEn} scale operation`,
          sort_order: sortOrderDet
        });

        const profile = SIZE_PROFILES[size];
        const modelCode = `${detailCode}_model`;
        generatedModelCodes.push(modelCode);
        projectModels.push({
          activity_detail_code: detailCode,
          code: modelCode,
          name_ar: `نموذج ${tpl.name_ar} ${sizeNameAr}`,
          name_en: `${sizeNameEn} ${tpl.name_en} Model`,
          size_category: size,
          model_type: 'greenfield',
          capex_min: profile.capex_min,
          capex_max: profile.capex_max,
          revenue_min: profile.revenue_min,
          revenue_max: profile.revenue_max,
          employee_count_min: profile.employee_count_min,
          employee_count_max: profile.employee_count_max,
          typical_roi_months: profile.typical_roi_months,
          is_published: 'true'
        });

        // assumptions per model
        for (const a of STANDARD_ASSUMPTIONS) {
          let value = a.default_value;
          if (a.code === 'rent_monthly') value = profile.rent_monthly;
          else if (a.code === 'salaries_monthly') value = profile.salaries_monthly;
          else if (a.code === 'marketing_monthly') value = profile.marketing_monthly;
          else if (a.code === 'utilities_monthly') value = profile.utilities_monthly;
          else if (a.code === 'insurance_monthly') value = profile.insurance_monthly;
          projectModelAssumptions.push({
            model_code: modelCode,
            assumption_code: a.code,
            value: value
          });
        }

        // risks per model
        const riskScores = getRiskScores(category, profile);
        for (const rf of STANDARD_RISKS) {
          projectModelRisks.push({
            model_code: modelCode,
            risk_factor_code: rf.code,
            score: riskScores[rf.code]
          });
        }

        // regulatory only for medium size
        if (size === 'medium') {
          const regs = getRegulatoryTemplates(category);
          for (const reg of regs) {
            sortOrderReq++;
            regulatoryRequirements.push({
              activity_detail_code: detailCode,
              requirement_name_ar: reg.requirement_name_ar,
              requirement_name_en: reg.requirement_name_en,
              issuing_authority: reg.issuing_authority,
              estimated_cost: reg.estimated_cost,
              mandatory: reg.mandatory ? 'true' : 'false',
              sort_order: sortOrderReq
            });
          }
        }
      }
    }
  }

  // Merge standard assumptions/risk factors with existing
  financialAssumptions = mergeByCode(financialAssumptions, STANDARD_ASSUMPTIONS);
  riskFactors = mergeByCode(riskFactors, STANDARD_RISKS);

  // Write CSVs
  writeCsv(path.join(MASTER_DIR, 'sub-sectors.csv'),
    ['sector_code', 'code', 'name_ar', 'name_en', 'description', 'sort_order'],
    subSectors
  );
  writeCsv(path.join(MASTER_DIR, 'activities.csv'),
    ['sub_sector_code', 'code', 'name_ar', 'name_en', 'description', 'sort_order'],
    activities
  );
  writeCsv(path.join(MASTER_DIR, 'activity-details.csv'),
    ['activity_code', 'code', 'name_ar', 'name_en', 'description', 'sort_order'],
    activityDetails
  );
  writeCsv(path.join(MASTER_DIR, 'project-models.csv'),
    ['activity_detail_code', 'code', 'name_ar', 'name_en', 'size_category', 'model_type', 'capex_min', 'capex_max', 'revenue_min', 'revenue_max', 'employee_count_min', 'employee_count_max', 'typical_roi_months', 'is_published'],
    projectModels
  );
  writeCsv(path.join(MASTER_DIR, 'financial-assumptions.csv'),
    ['code', 'name_ar', 'name_en', 'category', 'unit_type', 'description', 'default_value'],
    financialAssumptions
  );
  writeCsv(path.join(MASTER_DIR, 'project-model-assumptions.csv'),
    ['model_code', 'assumption_code', 'value'],
    projectModelAssumptions
  );
  writeCsv(path.join(MASTER_DIR, 'risk-factors.csv'),
    ['code', 'name_ar', 'name_en', 'category', 'default_score', 'description'],
    riskFactors
  );
  writeCsv(path.join(MASTER_DIR, 'project-model-risks.csv'),
    ['model_code', 'risk_factor_code', 'score'],
    projectModelRisks
  );
  writeCsv(path.join(MASTER_DIR, 'regulatory-requirements.csv'),
    ['activity_detail_code', 'requirement_name_ar', 'requirement_name_en', 'issuing_authority', 'estimated_cost', 'mandatory', 'sort_order'],
    regulatoryRequirements
  );

  console.log('Generated baseline master data:');
  console.log('  Sectors:', sectors.length);
  console.log('  Sub-sectors:', subSectors.length);
  console.log('  Activities:', activities.length);
  console.log('  Activity details:', activityDetails.length);
  console.log('  Project models:', projectModels.length);
  console.log('  Financial assumptions:', financialAssumptions.length);
  console.log('  Project model assumptions:', projectModelAssumptions.length);
  console.log('  Risk factors:', riskFactors.length);
  console.log('  Project model risks:', projectModelRisks.length);
  console.log('  Regulatory requirements:', regulatoryRequirements.length);
}

main();
