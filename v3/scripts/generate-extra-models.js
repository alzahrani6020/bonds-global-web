/**
 * Generates seed SQL for additional V3 project models.
 *
 * Usage:
 *   node scripts/generate-extra-models.js > supabase/seed/20260611000002_v3_more_models.sql
 */

const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'supabase', 'seed', '20260611000002_v3_more_models.sql');

const newSectors = [
  { code: 'education', name_ar: 'التعليم', name_en: 'Education', risk_category: 'low' },
  { code: 'construction', name_ar: 'البناء والتشييد', name_en: 'Construction', risk_category: 'high' },
  { code: 'tourism', name_ar: 'السياحة والسفر', name_en: 'Tourism & Travel', risk_category: 'medium' },
  { code: 'fintech', name_ar: 'التقنية المالية', name_en: 'Fintech', risk_category: 'medium' },
  { code: 'agriculture', name_ar: 'الزراعة', name_en: 'Agriculture', risk_category: 'medium' }
];

const newSubSectors = [
  { sector_code: 'education', code: 'private_schools', name_ar: 'المدارس والمراكز الخاصة', name_en: 'Private Schools & Centers' },
  { sector_code: 'construction', code: 'building_contracting', name_ar: 'المقاولات العامة', name_en: 'General Contracting' },
  { sector_code: 'tourism', code: 'hotels', name_ar: 'الفنادق والضيافة', name_en: 'Hotels & Hospitality' },
  { sector_code: 'tourism', code: 'travel_agencies', name_ar: 'وكالات السفر', name_en: 'Travel Agencies' },
  { sector_code: 'fintech', code: 'payment_solutions', name_ar: 'حلول الدفع', name_en: 'Payment Solutions' },
  { sector_code: 'fintech', code: 'crowdfunding', name_ar: 'التمويل الجماعي', name_en: 'Crowdfunding' },
  { sector_code: 'agriculture', code: 'greenhouses', name_ar: 'البيوت المحمية', name_en: 'Greenhouses' },
  { sector_code: 'food_services', code: 'cafes', name_ar: 'المقاهي', name_en: 'Cafes' },
  { sector_code: 'food_services', code: 'bakeries', name_ar: 'المخابز', name_en: 'Bakeries' },
  { sector_code: 'food_services', code: 'food_trucks', name_ar: 'عربات الطعام', name_en: 'Food Trucks' },
  { sector_code: 'healthcare', code: 'pharmacies', name_ar: 'الصيدليات', name_en: 'Pharmacies' },
  { sector_code: 'healthcare', code: 'medical_labs', name_ar: 'المختبرات الطبية', name_en: 'Medical Labs' },
  { sector_code: 'retail_trade', code: 'electronics', name_ar: 'الإلكترونيات', name_en: 'Electronics' },
  { sector_code: 'retail_trade', code: 'fashion', name_ar: 'الأزياء', name_en: 'Fashion' },
  { sector_code: 'light_manufacturing', code: 'food_processing', name_ar: 'تصنيع الأغذية', name_en: 'Food Processing' },
  { sector_code: 'light_manufacturing', code: 'packaging', name_ar: 'تصنيع التعبئة والتغليف', name_en: 'Packaging Manufacturing' },
  { sector_code: 'logistics_services', code: 'delivery', name_ar: 'خدمات التوصيل', name_en: 'Delivery Services' }
];

const newActivities = [
  { sub_sector_code: 'private_schools', code: 'kindergarten', name_ar: 'روضة أطفال', name_en: 'Kindergarten' },
  { sub_sector_code: 'private_schools', code: 'training_center', name_ar: 'مركز تدريب', name_en: 'Training Center' },
  { sub_sector_code: 'building_contracting', code: 'residential_contracting', name_ar: 'مقاولات سكنية', name_en: 'Residential Contracting' },
  { sub_sector_code: 'hotels', code: 'boutique_hotel', name_ar: 'فندق بوتيك', name_en: 'Boutique Hotel' },
  { sub_sector_code: 'travel_agencies', code: 'hajj_umrah_agency', name_ar: 'وكالة حج وعمرة', name_en: 'Hajj & Umrah Agency' },
  { sub_sector_code: 'payment_solutions', code: 'payment_gateway', name_ar: 'بوابة دفع', name_en: 'Payment Gateway' },
  { sub_sector_code: 'crowdfunding', code: 'crowdfunding_platform', name_ar: 'منصة تمويل جماعي', name_en: 'Crowdfunding Platform' },
  { sub_sector_code: 'greenhouses', code: 'vegetable_greenhouse', name_ar: 'بيthouse خضروات', name_en: 'Vegetable Greenhouse' },
  { sub_sector_code: 'cafes', code: 'coffee_shop', name_ar: 'مقهى', name_en: 'Coffee Shop' },
  { sub_sector_code: 'bakeries', code: 'bakery', name_ar: 'مخبز', name_en: 'Bakery' },
  { sub_sector_code: 'food_trucks', code: 'food_truck', name_ar: 'عربة طعام', name_en: 'Food Truck' },
  { sub_sector_code: 'pharmacies', code: 'pharmacy', name_ar: 'صيدلية', name_en: 'Pharmacy' },
  { sub_sector_code: 'medical_labs', code: 'medical_lab', name_ar: 'مختبر طبي', name_en: 'Medical Lab' },
  { sub_sector_code: 'electronics', code: 'mobile_shop', name_ar: 'محل جوالات', name_en: 'Mobile Shop' },
  { sub_sector_code: 'fashion', code: 'clothing_store', name_ar: 'محل ملابس', name_en: 'Clothing Store' },
  { sub_sector_code: 'food_processing', code: 'water_bottling_plant', name_ar: 'مصنع تعبئة مياه', name_en: 'Water Bottling Plant' },
  { sub_sector_code: 'packaging', code: 'packaging_factory', name_ar: 'مصنع تعبئة وتغليف', name_en: 'Packaging Factory' },
  { sub_sector_code: 'delivery', code: 'last_mile_delivery', name_ar: 'توصيل لمسافة قصيرة', name_en: 'Last Mile Delivery' }
];

const newModels = [
  { activity_code: 'kindergarten', code: 'small_kindergarten', name_ar: 'روضة أطفال صغيرة', name_en: 'Small Kindergarten', size: 'small', capex: [800000, 1500000], revenue: [600000, 1200000], employees: [8, 15], roi: 30, tags: ['education', 'children'] },
  { activity_code: 'training_center', code: 'small_training_center', name_ar: 'مركز تدريب صغير', name_en: 'Small Training Center', size: 'small', capex: [300000, 600000], revenue: [400000, 800000], employees: [4, 8], roi: 18, tags: ['education', 'training'] },
  { activity_code: 'residential_contracting', code: 'small_contracting_company', name_ar: 'شركة مقاولات صغيرة', name_en: 'Small Contracting Company', size: 'small', capex: [1000000, 3000000], revenue: [2000000, 5000000], employees: [15, 30], roi: 36, tags: ['construction', 'contracting'] },
  { activity_code: 'boutique_hotel', code: 'small_boutique_hotel', name_ar: 'فندق بوتيك صغير', name_en: 'Small Boutique Hotel', size: 'small', capex: [5000000, 10000000], revenue: [2000000, 4000000], employees: [10, 20], roi: 48, tags: ['tourism', 'hotel'] },
  { activity_code: 'hajj_umrah_agency', code: 'small_hajj_agency', name_ar: 'وكالة حج وعمرة صغيرة', name_en: 'Small Hajj & Umrah Agency', size: 'small', capex: [500000, 1000000], revenue: [1000000, 2000000], employees: [5, 10], roi: 24, tags: ['tourism', 'hajj'] },
  { activity_code: 'payment_gateway', code: 'small_payment_gateway', name_ar: 'بوابة دفع صغيرة', name_en: 'Small Payment Gateway', size: 'small', capex: [1500000, 3000000], revenue: [800000, 1500000], employees: [8, 15], roi: 36, tags: ['fintech', 'payments'] },
  { activity_code: 'crowdfunding_platform', code: 'small_crowdfunding_platform', name_ar: 'منصة تمويل جماعي صغيرة', name_en: 'Small Crowdfunding Platform', size: 'small', capex: [1000000, 2000000], revenue: [500000, 1000000], employees: [5, 10], roi: 30, tags: ['fintech', 'crowdfunding'] },
  { activity_code: 'vegetable_greenhouse', code: 'medium_vegetable_greenhouse', name_ar: 'بيthouse خضروات متوسط', name_en: 'Medium Vegetable Greenhouse', size: 'medium', capex: [1000000, 2500000], revenue: [800000, 1800000], employees: [6, 12], roi: 30, tags: ['agriculture', 'greenhouse'] },
  { activity_code: 'coffee_shop', code: 'small_coffee_shop', name_ar: 'مقهى صغير', name_en: 'Small Coffee Shop', size: 'small', capex: [250000, 500000], revenue: [350000, 700000], employees: [3, 6], roi: 20, tags: ['food', 'cafe'] },
  { activity_code: 'bakery', code: 'small_bakery', name_ar: 'مخبز صغير', name_en: 'Small Bakery', size: 'small', capex: [200000, 400000], revenue: [300000, 600000], employees: [3, 5], roi: 18, tags: ['food', 'bakery'] },
  { activity_code: 'food_truck', code: 'food_truck', name_ar: 'عربة طعام', name_en: 'Food Truck', size: 'small', capex: [100000, 200000], revenue: [200000, 400000], employees: [2, 4], roi: 14, tags: ['food', 'food-truck'] },
  { activity_code: 'pharmacy', code: 'small_pharmacy', name_ar: 'صيدلية صغيرة', name_en: 'Small Pharmacy', size: 'small', capex: [400000, 800000], revenue: [500000, 1000000], employees: [2, 4], roi: 22, tags: ['healthcare', 'pharmacy'] },
  { activity_code: 'medical_lab', code: 'small_medical_lab', name_ar: 'مختبر طبي صغير', name_en: 'Small Medical Lab', size: 'small', capex: [700000, 1400000], revenue: [600000, 1200000], employees: [4, 8], roi: 26, tags: ['healthcare', 'lab'] },
  { activity_code: 'mobile_shop', code: 'small_mobile_shop', name_ar: 'محل جوالات صغير', name_en: 'Small Mobile Shop', size: 'small', capex: [300000, 600000], revenue: [600000, 1200000], employees: [2, 4], roi: 20, tags: ['retail', 'electronics'] },
  { activity_code: 'clothing_store', code: 'small_clothing_store', name_ar: 'محل ملابس صغير', name_en: 'Small Clothing Store', size: 'small', capex: [350000, 700000], revenue: [500000, 1000000], employees: [2, 5], roi: 22, tags: ['retail', 'fashion'] },
  { activity_code: 'water_bottling_plant', code: 'small_water_bottling_plant', name_ar: 'مصنع تعبئة مياه صغير', name_en: 'Small Water Bottling Plant', size: 'small', capex: [2000000, 4000000], revenue: [1500000, 3000000], employees: [10, 20], roi: 36, tags: ['manufacturing', 'water'] },
  { activity_code: 'packaging_factory', code: 'small_packaging_factory', name_ar: 'مصنع تعبئة وتغليف صغير', name_en: 'Small Packaging Factory', size: 'small', capex: [1500000, 3000000], revenue: [1200000, 2500000], employees: [8, 15], roi: 30, tags: ['manufacturing', 'packaging'] },
  { activity_code: 'last_mile_delivery', code: 'small_last_mile_delivery', name_ar: 'شركة توصيل لمسافة قصيرة', name_en: 'Small Last Mile Delivery', size: 'small', capex: [400000, 800000], revenue: [800000, 1500000], employees: [6, 12], roi: 24, tags: ['logistics', 'delivery'] }
];

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

let sql = `-- Bonds V3 — Additional Project Models (Auto-generated)\n-- Generated at: ${new Date().toISOString()}\n\nBEGIN;\n\n`;

// Insert sectors
sql += `-- Sectors\n`;
for (const s of newSectors) {
  sql += `INSERT INTO public.economic_sectors (code, name_ar, name_en, risk_category, sort_order)\n`;
  sql += `VALUES ('${s.code}', '${escapeSql(s.name_ar)}', '${escapeSql(s.name_en)}', '${s.risk_category}', 10)\n`;
  sql += `ON CONFLICT (code) DO NOTHING;\n`;
}

sql += `\n`;

// Insert sub-sectors
sql += `-- Sub-sectors\n`;
for (const ss of newSubSectors) {
  sql += `INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)\n`;
  sql += `SELECT s.id, '${ss.code}', '${escapeSql(ss.name_ar)}', '${escapeSql(ss.name_en)}', 1\n`;
  sql += `FROM public.economic_sectors s WHERE s.code = '${ss.sector_code}'\n`;
  sql += `ON CONFLICT (code) DO NOTHING;\n`;
}

sql += `\n`;

// Insert activities
sql += `-- Activities\n`;
for (const a of newActivities) {
  sql += `INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)\n`;
  sql += `SELECT s.id, ss.id, '${a.code}', '${escapeSql(a.name_ar)}', '${escapeSql(a.name_en)}', 1\n`;
  sql += `FROM public.economic_sectors s\n`;
  sql += `JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id\n`;
  sql += `WHERE ss.code = '${a.sub_sector_code}'\n`;
  sql += `ON CONFLICT (code) DO NOTHING;\n`;
}

sql += `\n`;

// Insert project models
sql += `-- Project models\n`;
for (const m of newModels) {
  sql += `INSERT INTO public.project_models (\n`;
  sql += `  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,\n`;
  sql += `  model_type, size_category, default_currency,\n`;
  sql += `  capex_min, capex_max, revenue_min, revenue_max,\n`;
  sql += `  employee_count_min, employee_count_max, typical_roi_months,\n`;
  sql += `  tags, is_published\n`;
  sql += `)\n`;
  sql += `SELECT\n`;
  sql += `  s.id, ss.id, a.id,\n`;
  sql += `  '${m.code}', '${escapeSql(m.name_ar)}', '${escapeSql(m.name_en)}',\n`;
  sql += `  'greenfield', '${m.size}', 'SAR',\n`;
  sql += `  ${m.capex[0]}, ${m.capex[1]}, ${m.revenue[0]}, ${m.revenue[1]},\n`;
  sql += `  ${m.employees[0]}, ${m.employees[1]}, ${m.roi},\n`;
  sql += `  ARRAY['${m.tags.join("','")}'], true\n`;
  sql += `FROM public.economic_sectors s\n`;
  sql += `JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id\n`;
  sql += `JOIN public.economic_activities a ON a.sub_sector_id = ss.id\n`;
  sql += `WHERE a.code = '${m.activity_code}'\n`;
  sql += `ON CONFLICT (code) DO NOTHING;\n\n`;
}

// Link assumptions and risks for all published models
sql += `-- Link all published models to all assumptions\n`;
sql += `INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)\n`;
sql += `SELECT pm.id, fa.id, fa.default_value\n`;
sql += `FROM public.project_models pm\n`;
sql += `CROSS JOIN public.financial_assumptions fa\n`;
sql += `WHERE pm.is_published = true\n`;
sql += `ON CONFLICT (project_model_id, assumption_id) DO NOTHING;\n\n`;

sql += `-- Link all published models to all risk factors\n`;
sql += `INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)\n`;
sql += `SELECT pm.id, rf.id, rf.default_score, 'Initial default risk score'\n`;
sql += `FROM public.project_models pm\n`;
sql += `CROSS JOIN public.risk_factors rf\n`;
sql += `WHERE pm.is_published = true\n`;
sql += `ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;\n\n`;

sql += `COMMIT;\n`;

fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`Generated seed file: ${outputPath}`);
console.log(`Added ${newSectors.length} sectors, ${newSubSectors.length} sub-sectors, ${newActivities.length} activities, ${newModels.length} models.`);
