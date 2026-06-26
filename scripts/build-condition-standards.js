#!/usr/bin/env node
/**
 * Build script for Condition Assessment Standards
 * Generates:
 *   - valuation/condition-assessment-standards.js (UMD data module)
 *   - supabase/migrations/20260714000000_condition_assessment.sql (table + seed)
 */
const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  { id: 'structural', labelAr: 'إنشائي / فيزيائي', labelEn: 'Structural / Physical', defaultWeight: 0.12 },
  { id: 'mechanical', labelAr: 'ميكانيكي / وظيفي', labelEn: 'Mechanical / Functional', defaultWeight: 0.14 },
  { id: 'electrical', labelAr: 'كهربائي / إلكتروني', labelEn: 'Electrical / Electronics', defaultWeight: 0.10 },
  { id: 'safety', labelAr: 'سلامة / امتثال', labelEn: 'Safety / Compliance', defaultWeight: 0.12 },
  { id: 'environmental', labelAr: 'بيئي / استدامة', labelEn: 'Environmental / ESG', defaultWeight: 0.08 },
  { id: 'maintenance', labelAr: 'صيانة / سجلات', labelEn: 'Maintenance / Records', defaultWeight: 0.12 },
  { id: 'operational', labelAr: 'تشغيلي / استخدام', labelEn: 'Operational / Utilization', defaultWeight: 0.12 },
  { id: 'aesthetic', labelAr: 'جمالي / مظهري', labelEn: 'Aesthetics / Cosmetic', defaultWeight: 0.07 },
  { id: 'documentation', labelAr: 'توثيق / قانوني', labelEn: 'Documentation / Legal', defaultWeight: 0.08 },
  { id: 'technology', labelAr: 'تقني / عدم ملاءمة', labelEn: 'Technology / Obsolescence', defaultWeight: 0.05 }
];

function point(id, category, labelAr, labelEn, type, critical, verification) {
  return { id, category, labelAr, labelEn, type, critical: !!critical, verification };
}

const MASTER_POINTS = [
  // Structural / Physical (12)
  point('struct_foundation', 'structural', 'استقرار الأساسات', 'Foundation stability', '0-5', true, 'Structural engineer report'),
  point('struct_cracks', 'structural', 'التشققات الهيكلية', 'Structural cracks', '0-5', true, 'Visual inspection'),
  point('struct_settlement', 'structural', 'الهبوط أو عدم الاستواء', 'Settlement / unevenness', '0-5', false, 'Level survey'),
  point('struct_roof', 'structural', 'حالة السطح', 'Roof condition', '0-5', false, 'Roof inspection'),
  point('struct_floors', 'structural', 'حالة الأرضيات', 'Floor condition', '0-5', false, 'Visual inspection'),
  point('struct_walls', 'structural', 'حالة الجدران', 'Wall condition', '0-5', false, 'Visual inspection'),
  point('struct_corrosion', 'structural', 'التآكل والصدأ', 'Corrosion / rust', '0-5', false, 'Material inspection'),
  point('struct_load_capacity', 'structural', 'قدرة التحمل', 'Load capacity', '0-5', true, 'Structural assessment'),
  point('struct_dampness', 'structural', 'الرطوبة والتسربات', 'Dampness / water damage', '0-5', false, 'Moisture survey'),
  point('struct_insulation', 'structural', 'العزل الحراري والمائي', 'Insulation', '0-5', false, 'Thermal imaging'),
  point('struct_pest', 'structural', 'الآفات والتآكل الحيوي', 'Pest / termite damage', '0-5', false, 'Pest control report'),
  point('struct_seismic', 'structural', 'مقاومة الزلازل', 'Seismic resistance', '0-5', true, 'Seismic assessment'),

  // Mechanical / Functional (12)
  point('mech_operation', 'mechanical', 'الأداء التشغيلي', 'Operational performance', '0-5', false, 'Functional test'),
  point('mech_vibration', 'mechanical', 'الاهتزاز غير الطبيعي', 'Abnormal vibration', '0-5', false, 'Vibration analysis'),
  point('mech_noise', 'mechanical', 'الضوضاء غير الطبيعية', 'Abnormal noise', '0-5', false, 'Acoustic check'),
  point('mech_wear', 'mechanical', 'تآكل الأجزاء المتحركة', 'Wear of moving parts', '0-5', false, 'Wear measurement'),
  point('mech_lubrication', 'mechanical', 'حالة التزييت', 'Lubrication status', '0-5', false, 'Maintenance records'),
  point('mech_alignment', 'mechanical', 'المحاذاة', 'Alignment', '0-5', false, 'Laser alignment'),
  point('mech_leaks', 'mechanical', 'تسربات السوائل', 'Fluid leaks', '0-5', false, 'Visual inspection'),
  point('mech_calibration', 'mechanical', 'المعايرة', 'Calibration', '0-5', false, 'Calibration certificate'),
  point('mech_spare_parts', 'mechanical', 'توفر قطع الغيار', 'Spare parts availability', '0-5', false, 'Vendor confirmation'),
  point('mech_capacity', 'mechanical', 'القدرة الاسمية مقابل الفعلية', 'Rated vs actual capacity', '0-5', false, 'Production data'),
  point('mech_overhaul', 'mechanical', 'آخر عملية تجديد', 'Last overhaul', '0-5', false, 'Service records'),
  point('mech_safety_devices', 'mechanical', 'أجهزة السلامة الميكانيكية', 'Mechanical safety devices', '0-5', true, 'Safety inspection'),

  // Electrical / Electronics (12)
  point('elec_wiring', 'electrical', 'حالة الأسلاك', 'Wiring condition', '0-5', true, 'Electrical inspection'),
  point('elec_panel', 'electrical', 'لوحات الكهرباء', 'Electrical panels', '0-5', true, 'Electrical inspection'),
  point('elec_grounding', 'electrical', 'التأريض', 'Grounding', '0-5', true, 'Ground test'),
  point('elec_backup_power', 'electrical', 'أنظمة الطاقة الاحتياطية', 'Backup power', '0-5', false, 'Load test'),
  point('elec_lighting', 'electrical', 'أنظمة الإضاءة', 'Lighting systems', '0-5', false, 'Visual inspection'),
  point('elec_automation', 'electrical', 'التحكم والأتمتة', 'Controls / automation', '0-5', false, 'System test'),
  point('elec_sensors', 'electrical', 'المستشعرات', 'Sensors', '0-5', false, 'Sensor test'),
  point('elec_battery', 'electrical', 'البطاريات', 'Batteries', '0-5', false, 'Battery test'),
  point('elec_emergency_systems', 'electrical', 'أنظمة الطوارئ الكهربائية', 'Emergency electrical systems', '0-5', true, 'Functional test'),
  point('elec_energy_efficiency', 'electrical', 'كفاءة الطاقة', 'Energy efficiency', '0-5', false, 'Energy audit'),
  point('elec_code_compliance', 'electrical', 'الامتثال للكود الكهربائي', 'Electrical code compliance', 'yes/no', true, 'Code inspection'),
  point('elec_thermal', 'electrical', 'الفحص الحراري', 'Thermal imaging', '0-5', false, 'Thermal scan'),

  // Safety / Compliance (12)
  point('safety_fire_systems', 'safety', 'أنظمة الحريق', 'Fire suppression', '0-5', true, 'Fire safety certificate'),
  point('safety_alarm', 'safety', 'أنظمة الإنذار', 'Alarms', '0-5', true, 'Alarm test'),
  point('safety_emergency_exits', 'safety', 'مخارج الطوارئ', 'Emergency exits', 'yes/no', true, 'Safety inspection'),
  point('safety_ppe', 'safety', 'معدات الحماية الشخصية', 'PPE availability', 'yes/no', false, 'Site check'),
  point('safety_signage', 'safety', 'اللوحات الإرشادية', 'Safety signage', '0-5', false, 'Visual inspection'),
  point('safety_chemical_storage', 'safety', 'تخزين المواد الكيميائية', 'Chemical storage', '0-5', true, 'Hazmat audit'),
  point('safety_hazmat', 'safety', 'المواد الخطرة', 'Hazardous materials', '0-5', true, 'MSDS / audit'),
  point('safety_lifting_equipment', 'safety', 'معدات الرفع', 'Lifting equipment certification', 'yes/no', true, 'Certification'),
  point('safety_confined_spaces', 'safety', 'الأماكن المغلقة', 'Confined spaces', 'yes/no', false, 'Safety audit'),
  point('safety_lockout', 'safety', 'إجراءات العزل', 'Lockout/tagout', 'yes/no', false, 'Procedure review'),
  point('safety_incident_record', 'safety', 'سجل الحوادث', 'Incident records', '0-5', false, 'Incident log'),
  point('safety_training', 'safety', 'تدريب السلامة', 'Safety training', '0-5', false, 'Training records'),

  // Environmental / ESG (12)
  point('env_energy_efficiency', 'environmental', 'كفاءة الطاقة', 'Energy efficiency', '0-5', false, 'Energy audit'),
  point('env_water_usage', 'environmental', 'إدارة المياه', 'Water usage', '0-5', false, 'Water audit'),
  point('env_waste_management', 'environmental', 'إدارة النفايات', 'Waste management', '0-5', false, 'Waste audit'),
  point('env_emissions', 'environmental', 'الانبعاثات', 'Emissions', '0-5', false, 'Emissions report'),
  point('env_hazardous_waste', 'environmental', 'التخلص من النفايات الخطرة', 'Hazardous waste disposal', 'yes/no', true, 'Disposal records'),
  point('env_green_cert', 'environmental', 'الشهادات الخضراء', 'Green certification', 'yes/no', false, 'Certificate'),
  point('env_carbon_footprint', 'environmental', 'البصمة الكربونية', 'Carbon footprint', '0-5', false, 'Carbon report'),
  point('env_noise_pollution', 'environmental', 'التلوث الضوضائي', 'Noise pollution', '0-5', false, 'Noise survey'),
  point('env_soil_contamination', 'environmental', 'تلوث التربة', 'Soil contamination', '0-5', true, 'Soil test'),
  point('env_biodiversity', 'environmental', 'التأثير على التنوع البيولوجي', 'Biodiversity impact', '0-5', false, 'Environmental study'),
  point('env_lighting_efficiency', 'environmental', 'كفاءة الإضاءة', 'Lighting efficiency', '0-5', false, 'Lighting audit'),
  point('env_chemical_spill', 'environmental', 'تسربات كيميائية سابقة', 'Chemical spill history', 'yes/no', true, 'Incident records'),

  // Maintenance / Records (12)
  point('maint_records', 'maintenance', 'اكتمال سجلات الصيانة', 'Maintenance records completeness', '0-5', false, 'Records review'),
  point('maint_preventive', 'maintenance', 'جدولة الصيانة الوقائية', 'Preventive maintenance schedule', '0-5', false, 'CMMS / planner'),
  point('maint_contracts', 'maintenance', 'عقود الصيانة', 'Service contracts', 'yes/no', false, 'Contract review'),
  point('maint_spare_inventory', 'maintenance', 'مخزون قطع الغيار', 'Spare parts inventory', '0-5', false, 'Inventory check'),
  point('maint_downtime', 'maintenance', 'سجل توقفات التشغيل', 'Downtime history', '0-5', false, 'OEE / logs'),
  point('maint_repair_backlog', 'maintenance', 'تراكم الإصلاحات', 'Repair backlog', '0-5', false, 'Work orders'),
  point('maint_oem_support', 'maintenance', 'دعم الشركة المصنعة', 'OEM support', 'yes/no', false, 'Vendor confirmation'),
  point('maint_staff_skill', 'maintenance', 'مهارة فريق الصيانة', 'Maintenance staff skill', '0-5', false, 'Certifications'),
  point('maint_cmms', 'maintenance', 'استخدام نظام CMMS', 'CMMS usage', 'yes/no', false, 'System check'),
  point('maint_warranty', 'maintenance', 'حالة الضمان', 'Warranty status', 'yes/no', false, 'Warranty records'),
  point('maint_cleanliness', 'maintenance', 'النظافة العامة', 'Cleanliness', '0-5', false, 'Site inspection'),
  point('maint_lubrication_records', 'maintenance', 'سجلات التزييت', 'Lubrication records', '0-5', false, 'Maintenance records'),

  // Operational / Utilization (12)
  point('op_utilization', 'operational', 'معدل الاستخدام', 'Utilization rate', '0-10', false, 'Utilization report'),
  point('op_availability', 'operational', 'مدى التوفر', 'Availability / uptime', '0-10', false, 'Uptime logs'),
  point('op_cycle_time', 'operational', 'زمن الدورة', 'Cycle time', '0-5', false, 'Process data'),
  point('op_output_quality', 'operational', 'جودة الناتج', 'Output quality', '0-5', false, 'Quality report'),
  point('op_operator_training', 'operational', 'تدريب المشغلين', 'Operator training', '0-5', false, 'Training records'),
  point('op_shift_coverage', 'operational', 'تغطية الورديات', 'Shift coverage', '0-5', false, 'Rosters'),
  point('op_idle_time', 'operational', 'وقت الخمول', 'Idle time', '0-5', false, 'OEE data'),
  point('op_bottlenecks', 'operational', 'الاختناقات', 'Bottlenecks', '0-5', false, 'Process analysis'),
  point('op_technology_integration', 'operational', 'تكامل التقنية', 'Technology integration', '0-5', false, 'System review'),
  point('op_software_version', 'operational', 'إصدار البرمجيات', 'Software version', '0-5', false, 'Version check'),
  point('op_data_backup', 'operational', 'النسخ الاحتياطي للبيانات', 'Data backup', 'yes/no', false, 'Backup audit'),
  point('op_redundancy', 'operational', 'التكرار', 'Redundancy', 'yes/no', false, 'Architecture review'),

  // Aesthetics / Cosmetic (12)
  point('aesthetic_exterior', 'aesthetic', 'المظهر الخارجي', 'Exterior appearance', '0-5', false, 'Visual inspection'),
  point('aesthetic_interior', 'aesthetic', 'المظهر الداخلي', 'Interior appearance', '0-5', false, 'Visual inspection'),
  point('aesthetic_paint', 'aesthetic', 'الدهان والتشطيب', 'Paint / finish', '0-5', false, 'Visual inspection'),
  point('aesthetic_signage', 'aesthetic', 'اللوحات والإرشادات', 'Signage', '0-5', false, 'Visual inspection'),
  point('aesthetic_cleanliness', 'aesthetic', 'النظافة', 'Cleanliness', '0-5', false, 'Visual inspection'),
  point('aesthetic_landscaping', 'aesthetic', 'المساحات الخضراء', 'Landscaping', '0-5', false, 'Visual inspection'),
  point('aesthetic_flooring', 'aesthetic', 'حالة الأرضيات', 'Flooring condition', '0-5', false, 'Visual inspection'),
  point('aesthetic_ceiling', 'aesthetic', 'حالة الأسقف', 'Ceiling condition', '0-5', false, 'Visual inspection'),
  point('aesthetic_windows', 'aesthetic', 'النوافذ والأبواب', 'Windows / doors', '0-5', false, 'Visual inspection'),
  point('aesthetic_furniture', 'aesthetic', 'الأثاث والتجهيزات', 'Furniture / fixtures', '0-5', false, 'Visual inspection'),
  point('aesthetic_branding', 'aesthetic', 'الهوية البصرية', 'Branding', '0-5', false, 'Brand review'),
  point('aesthetic_odors', 'aesthetic', 'الروائح', 'Odors', '0-5', false, 'Sensory check'),

  // Documentation / Legal (12)
  point('doc_ownership', 'documentation', 'وثائق الملكية', 'Ownership documents', 'yes/no', true, 'Title deed / registry'),
  point('doc_insurance', 'documentation', 'التأمين', 'Insurance coverage', 'yes/no', false, 'Insurance policy'),
  point('doc_registration', 'documentation', 'السجل التجاري', 'Registration', 'yes/no', false, 'Commercial register'),
  point('doc_licenses', 'documentation', 'التراخيص', 'Licenses / permits', 'yes/no', true, 'Permit records'),
  point('doc_warranty', 'documentation', 'الضمانات', 'Warranties', 'yes/no', false, 'Warranty records'),
  point('doc_manuals', 'documentation', 'كتيبات التشغيل', 'Manuals', 'yes/no', false, 'OEM manuals'),
  point('doc_service_history', 'documentation', 'سجل الخدمة', 'Service history', '0-5', false, 'Service records'),
  point('doc_inspection_reports', 'documentation', 'تقارير الفحص', 'Inspection reports', 'yes/no', false, 'Inspection records'),
  point('doc_compliance_cert', 'documentation', 'شهادات الامتثال', 'Compliance certificates', 'yes/no', false, 'Certificates'),
  point('doc_environmental_permits', 'documentation', 'التصاريح البيئية', 'Environmental permits', 'yes/no', true, 'Permit records'),
  point('doc_tax_records', 'documentation', 'السجلات الضريبية', 'Tax records', 'yes/no', false, 'Tax filings'),
  point('doc_leases', 'documentation', 'العقود والإيجارات', 'Leases / contracts', 'yes/no', false, 'Contracts'),

  // Technology / Obsolescence (12)
  point('tech_age', 'technology', 'عمر التقنية', 'Technology age', '0-5', false, 'Tech roadmap'),
  point('tech_compatibility', 'technology', 'التوافق', 'Compatibility', '0-5', false, 'System review'),
  point('tech_upgrade_path', 'technology', 'مسار الترقية', 'Upgrade path', '0-5', false, 'Vendor roadmap'),
  point('tech_software_support', 'technology', 'دعم البرمجيات', 'Software support', '0-5', false, 'Support contract'),
  point('tech_hardware_support', 'technology', 'دعم العتاد', 'Hardware support', '0-5', false, 'Support contract'),
  point('tech_obsolescence_risk', 'technology', 'مخاطر العطل التقني', 'Obsolescence risk', '0-5', false, 'Market research'),
  point('tech_cybersecurity', 'technology', 'الأمن السيبراني', 'Cybersecurity', '0-5', true, 'Security audit'),
  point('tech_data_portability', 'technology', 'قابلية نقل البيانات', 'Data portability', '0-5', false, 'Data review'),
  point('tech_cloud_migration', 'technology', 'جاهزية السحابة', 'Cloud readiness', '0-5', false, 'Architecture review'),
  point('tech_iot_sensors', 'technology', 'IoT / المستشعرات', 'IoT / sensors', '0-5', false, 'IoT assessment'),
  point('tech_ai_automation', 'technology', 'الذكاء الاصطناعي / الأتمتة', 'AI / automation', '0-5', false, 'Automation review'),
  point('tech_digital_twin', 'technology', 'النموذج الرقمي / BIM', 'Digital twin / BIM', '0-5', false, 'Digital model review')
];

const CATEGORY_ORDER = CATEGORIES.map(c => c.id);

const ASSET_CLASS_LABELS = {
  realEstate: { ar: 'العقارات', en: 'Real Estate' },
  business: { ar: 'الشركات', en: 'Business' },
  factory: { ar: 'المصانع', en: 'Factory' },
  machineryEquipment: { ar: 'الآلات والمعدات', en: 'Machinery & Equipment' },
  vehiclesFleet: { ar: 'المركبات والأساطيل', en: 'Vehicles & Fleet' },
  agricultureFarms: { ar: 'الزراعة والمزارع', en: 'Agriculture & Farms' },
  livestock: { ar: 'الثروة الحيوانية', en: 'Livestock' },
  naturalResourcesMining: { ar: 'الموارد الطبيعية والتعدين', en: 'Natural Resources & Mining' },
  oilGas: { ar: 'النفط والغاز', en: 'Oil & Gas Assets' },
  infrastructure: { ar: 'البنية التحتية', en: 'Infrastructure' },
  intellectualProperty: { ar: 'الملكية الفكرية', en: 'Intellectual Property' },
  brandsTrademarks: { ar: 'العلامات التجارية', en: 'Brands & Trademarks' },
  patents: { ar: 'براءات الاختراع', en: 'Patents' },
  copyrightsContent: { ar: 'حقوق المؤلف والمحتوى', en: 'Copyrights & Content' },
  franchises: { ar: 'الامتيازات التجارية', en: 'Franchises' },
  licensesPermits: { ar: 'التراخيص والتصاريح', en: 'Licenses & Permits' },
  financialAssets: { ar: 'الأصول المالية', en: 'Financial Assets' },
  cryptoDigital: { ar: 'العملات الرقمية والأصول الرقمية', en: 'Crypto & Digital Assets' },
  commodities: { ar: 'السلع', en: 'Commodities' },
  artCollectibles: { ar: 'الفنون والمقتنيات', en: 'Art & Collectibles' },
  jewelryPreciousMetals: { ar: 'المجوهرات والمعادن الثمينة', en: 'Jewelry & Precious Metals' },
  softwareTechnology: { ar: 'البرمجيات والتقنية', en: 'Software & Technology' },
  medicalEquipment: { ar: 'الأجهزة والمعدات الطبية', en: 'Medical Equipment' },
  educationalEquipment: { ar: 'التجهيزات التعليمية', en: 'Educational Equipment' },
  distressedAsset: { ar: 'الأصول المتعثرة', en: 'Distressed Assets' },
  tourismAsset: { ar: 'الأصول السياحية', en: 'Tourism Assets' },
  personalWealth: { ar: 'الثروة الشخصية', en: 'Personal Wealth' },
  scrapSalvage: { ar: 'السكراب والخردة', en: 'Scrap & Salvage' },
  maritimeAsset: { ar: 'الأصول البحرية', en: 'Maritime Assets' },
  logisticsAsset: { ar: 'الأصول اللوجستية', en: 'Logistics Assets' },
  fuelStation: { ar: 'محطات الوقود', en: 'Fuel Stations' },
  beautyWellness: { ar: 'التجميل والصحة', en: 'Beauty & Wellness' },
  giftsStationery: { ar: 'الهدايا والماليات', en: 'Gifts & Stationery' },
  furnitureAsset: { ar: 'الأثاث المنزلي والمكتبي', en: 'Furniture Assets' },
  retailBusiness: { ar: 'نشاط تجاري عام', en: 'Retail Business' }
};

// How many points to pick from each category per asset class.
const ASSET_CATEGORY_COUNTS = {
  realEstate: { structural: 10, safety: 5, environmental: 4, maintenance: 4, aesthetic: 8, documentation: 5 },
  business: { operational: 8, documentation: 6, technology: 7, maintenance: 4, safety: 2 },
  factory: { structural: 5, mechanical: 8, electrical: 5, safety: 5, environmental: 4, maintenance: 5, operational: 4, documentation: 4, technology: 3 },
  machineryEquipment: { mechanical: 8, electrical: 5, safety: 4, maintenance: 5, operational: 5, aesthetic: 3, documentation: 4, technology: 4 },
  vehiclesFleet: { structural: 4, mechanical: 8, electrical: 4, safety: 5, environmental: 3, maintenance: 5, operational: 4, aesthetic: 3, documentation: 4, technology: 3 },
  agricultureFarms: { structural: 4, mechanical: 4, environmental: 5, operational: 5, maintenance: 4, documentation: 4, safety: 3 },
  livestock: { structural: 2, safety: 4, environmental: 4, operational: 5, maintenance: 3, documentation: 4 },
  naturalResourcesMining: { structural: 5, mechanical: 6, electrical: 4, safety: 6, environmental: 5, maintenance: 4, operational: 4, documentation: 4, technology: 3 },
  oilGas: { structural: 3, mechanical: 5, electrical: 4, safety: 6, environmental: 5, maintenance: 4, operational: 4, documentation: 4, technology: 3 },
  infrastructure: { structural: 6, safety: 5, environmental: 4, maintenance: 5, operational: 4, documentation: 4, technology: 2 },
  intellectualProperty: { documentation: 5, technology: 8, operational: 4, maintenance: 2 },
  brandsTrademarks: { documentation: 5, technology: 3, operational: 3, aesthetic: 2 },
  patents: { documentation: 5, technology: 7 },
  copyrightsContent: { documentation: 4, technology: 6, operational: 3 },
  franchises: { documentation: 6, operational: 5, technology: 3 },
  licensesPermits: { documentation: 8 },
  financialAssets: { documentation: 5, operational: 4, technology: 4 },
  cryptoDigital: { documentation: 4, technology: 8, operational: 2 },
  commodities: { documentation: 5, structural: 2, operational: 3, environmental: 2 },
  artCollectibles: { aesthetic: 8, documentation: 5, environmental: 3, structural: 2 },
  jewelryPreciousMetals: { aesthetic: 4, documentation: 5, safety: 3, structural: 1 },
  softwareTechnology: { technology: 10, documentation: 4, operational: 5, maintenance: 3 },
  medicalEquipment: { mechanical: 6, electrical: 4, safety: 5, maintenance: 5, operational: 4, documentation: 4, technology: 3 },
  educationalEquipment: { mechanical: 4, electrical: 4, safety: 4, maintenance: 4, operational: 4, aesthetic: 3, documentation: 4, technology: 3 },
  distressedAsset: { structural: 4, mechanical: 4, safety: 4, environmental: 3, documentation: 4, aesthetic: 2 },
  tourismAsset: { structural: 4, aesthetic: 6, safety: 5, operational: 4, maintenance: 3, documentation: 4 },
  personalWealth: { documentation: 6, aesthetic: 3, safety: 2 },
  scrapSalvage: { structural: 4, mechanical: 3, environmental: 4, safety: 3, documentation: 3 },
  maritimeAsset: { structural: 5, mechanical: 6, electrical: 4, safety: 5, environmental: 4, maintenance: 4, operational: 3, documentation: 4, technology: 2 },
  logisticsAsset: { structural: 4, mechanical: 5, electrical: 4, safety: 5, operational: 5, maintenance: 4, documentation: 4, technology: 3 },
  fuelStation: { safety: 6, environmental: 5, structural: 3, electrical: 3, maintenance: 3, operational: 3, documentation: 4 },
  beautyWellness: { aesthetic: 6, safety: 5, operational: 4, maintenance: 3, documentation: 4, technology: 2 },
  giftsStationery: { aesthetic: 5, operational: 4, documentation: 4, technology: 2 },
  furnitureAsset: { structural: 5, aesthetic: 6, documentation: 3, maintenance: 3 },
  retailBusiness: { operational: 6, documentation: 5, aesthetic: 4, technology: 3, safety: 2 }
};

const GRADING_SCALE = { A: 90, B: 80, C: 70, D: 60, E: 0 };

function pointsByCategory(categoryId) {
  return MASTER_POINTS.filter(p => p.category === categoryId);
}

function resolveAssetStandards(assetClass) {
  const labels = ASSET_CLASS_LABELS[assetClass];
  const counts = ASSET_CATEGORY_COUNTS[assetClass];
  if (!labels || !counts) return null;

  const points = [];
  const categoryMeta = {};

  CATEGORY_ORDER.forEach(catId => {
    const count = counts[catId];
    if (!count) return;
    const catPoints = pointsByCategory(catId);
    const selected = catPoints.slice(0, Math.min(count, catPoints.length));
    const catWeight = (CATEGORIES.find(c => c.id === catId)?.defaultWeight || 0.1);
    const perPointWeight = selected.length ? round4(catWeight / selected.length) : 0;

    categoryMeta[catId] = {
      weight: catWeight,
      pointCount: selected.length,
      pointWeight: perPointWeight
    };

    selected.forEach(master => {
      points.push({
        id: master.id,
        category: master.category,
        labelAr: master.labelAr,
        labelEn: master.labelEn,
        type: master.type,
        weight: perPointWeight,
        critical: master.critical,
        verification: master.verification
      });
    });
  });

  // Normalize point weights so they sum to 1 for this asset class
  const totalWeight = points.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight > 0) {
    points.forEach(p => { p.weight = round4(p.weight / totalWeight); });
  }

  return {
    assetClass,
    nameAr: labels.ar,
    nameEn: labels.en,
    categories: CATEGORIES,
    gradingScale: GRADING_SCALE,
    criticalCap: 60,
    points,
    _categoryMeta: categoryMeta
  };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function generateJs() {
  const resolved = Object.keys(ASSET_CLASS_LABELS).map(resolveAssetStandards).filter(Boolean);
  const standardsObj = {};
  resolved.forEach(r => { standardsObj[r.assetClass] = r; });

  return `/**
 * BONDS Condition Assessment Standards
 * Auto-generated by scripts/build-condition-standards.js
 * DO NOT EDIT THIS FILE DIRECTLY — edit the build script and re-run it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BondsConditionStandards = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATEGORIES = ${JSON.stringify(CATEGORIES, null, 2)};

  const MASTER_POINTS = ${JSON.stringify(MASTER_POINTS, null, 2)};

  const ASSET_STANDARDS = ${JSON.stringify(standardsObj)};

  const GRADING_SCALE = ${JSON.stringify(GRADING_SCALE)};

  function resolveStandards(assetClass) {
    return ASSET_STANDARDS[assetClass] || null;
  }

  function getDefaultStandards(assetClass) {
    return resolveStandards(assetClass);
  }

  function listAssetClasses() {
    return Object.keys(ASSET_STANDARDS);
  }

  function getPointDefinition(pointId) {
    return MASTER_POINTS.find(p => p.id === pointId) || null;
  }

  return {
    CATEGORIES,
    MASTER_POINTS,
    ASSET_STANDARDS,
    GRADING_SCALE,
    resolveStandards,
    getDefaultStandards,
    listAssetClasses,
    getPointDefinition,
    version: '1.0.0'
  };
}));
`;
}

function generateSql() {
  const resolved = Object.keys(ASSET_CLASS_LABELS).map(resolveAssetStandards).filter(Boolean);

  let seed = resolved.map(r => {
    const payload = {
      asset_class: r.assetClass,
      name_ar: r.nameAr,
      name_en: r.nameEn,
      inspection_points: r.points,
      categories: r.categories,
      grading_scale: r.gradingScale,
      critical_rules: [{ cap: r.criticalCap, appliesTo: 'any_critical_failure' }],
      version: 1
    };
    return `    (${JSON.stringify(JSON.stringify(payload))})`;
  }).join(',\n');

  return `-- Condition Assessment Standards migration
-- Auto-generated by scripts/build-condition-standards.js
-- DO NOT EDIT THIS FILE DIRECTLY — edit the build script and re-run it.

CREATE TABLE IF NOT EXISTS public.condition_assessment_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL UNIQUE,
  name_ar text,
  name_en text,
  inspection_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  grading_scale jsonb NOT NULL DEFAULT '{"A":90,"B":80,"C":70,"D":60,"E":0}'::jsonb,
  critical_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.condition_assessment_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Condition assessment standards are readable by everyone"
  ON public.condition_assessment_standards FOR SELECT USING (true);

CREATE POLICY "Condition assessment standards editable by admins"
  ON public.condition_assessment_standards FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ));

CREATE INDEX IF NOT EXISTS idx_condition_assessment_asset_class
  ON public.condition_assessment_standards(asset_class);

-- Seed default standards for all asset classes
INSERT INTO public.condition_assessment_standards (asset_class, name_ar, name_en, inspection_points, categories, grading_scale, critical_rules, version)
VALUES
${seed}
ON CONFLICT (asset_class) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  inspection_points = EXCLUDED.inspection_points,
  categories = EXCLUDED.categories,
  grading_scale = EXCLUDED.grading_scale,
  critical_rules = EXCLUDED.critical_rules,
  version = EXCLUDED.version,
  updated_at = now();
`;
}

const root = path.join(__dirname, '..');
const jsPath = path.join(root, 'valuation', 'condition-assessment-standards.js');
const sqlPath = path.join(root, 'supabase', 'migrations', '20260714000000_condition_assessment.sql');

fs.writeFileSync(jsPath, generateJs(), 'utf8');
fs.writeFileSync(sqlPath, generateSql(), 'utf8');

console.log(`✓ Wrote ${jsPath}`);
console.log(`✓ Wrote ${sqlPath}`);
console.log(`✓ Total master points: ${MASTER_POINTS.length}`);
console.log(`✓ Asset classes covered: ${Object.keys(ASSET_CLASS_LABELS).length}`);
