/**
 * Generates small/medium/large variants for all V3 activities.
 *
 * Usage:
 *   node scripts/generate-model-variants.js > supabase/seed/20260611000004_v3_model_variants.sql
 */

const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'supabase', 'seed', '20260611000004_v3_model_variants.sql');

const activities = [
  { code: 'burger_restaurant', name_ar: 'مطعم برجر', base: { capex: [300000, 600000], revenue: [400000, 800000], emp: [4, 8], roi: 18 }, tags: ['food', 'fast-food'] },
  { code: 'dental_clinic', name_ar: 'عيادة أسنان', base: { capex: [800000, 1500000], revenue: [600000, 1200000], emp: [5, 10], roi: 24 }, tags: ['healthcare', 'clinic'] },
  { code: 'small_supermarket', name_ar: 'سوبرماركت', base: { capex: [500000, 1000000], revenue: [800000, 1500000], emp: [3, 6], roi: 20 }, tags: ['retail', 'grocery'] },
  { code: 'plastic_products_factory', name_ar: 'مصنع منتجات بلاستيكية', base: { capex: [2000000, 5000000], revenue: [1500000, 4000000], emp: [10, 25], roi: 36 }, tags: ['manufacturing', 'plastic'] },
  { code: 'cold_storage_warehouse', name_ar: 'مستودع تخزين مبرد', base: { capex: [1500000, 3000000], revenue: [1000000, 2500000], emp: [4, 10], roi: 30 }, tags: ['logistics', 'cold-storage'] },
  { code: 'kindergarten', name_ar: 'روضة أطفال', base: { capex: [800000, 1500000], revenue: [600000, 1200000], emp: [8, 15], roi: 30 }, tags: ['education', 'children'] },
  { code: 'training_center', name_ar: 'مركز تدريب', base: { capex: [300000, 600000], revenue: [400000, 800000], emp: [4, 8], roi: 18 }, tags: ['education', 'training'] },
  { code: 'residential_contracting', name_ar: 'مقاولات سكنية', base: { capex: [1000000, 3000000], revenue: [2000000, 5000000], emp: [15, 30], roi: 36 }, tags: ['construction', 'contracting'] },
  { code: 'boutique_hotel', name_ar: 'فندق بوتيك', base: { capex: [5000000, 10000000], revenue: [2000000, 4000000], emp: [10, 20], roi: 48 }, tags: ['tourism', 'hotel'] },
  { code: 'hajj_umrah_agency', name_ar: 'وكالة حج وعمرة', base: { capex: [500000, 1000000], revenue: [1000000, 2000000], emp: [5, 10], roi: 24 }, tags: ['tourism', 'hajj'] },
  { code: 'payment_gateway', name_ar: 'بوابة دفع', base: { capex: [1500000, 3000000], revenue: [800000, 1500000], emp: [8, 15], roi: 36 }, tags: ['fintech', 'payments'] },
  { code: 'crowdfunding_platform', name_ar: 'منصة تمويل جماعي', base: { capex: [1000000, 2000000], revenue: [500000, 1000000], emp: [5, 10], roi: 30 }, tags: ['fintech', 'crowdfunding'] },
  { code: 'vegetable_greenhouse', name_ar: 'بيthouse خضروات', base: { capex: [1000000, 2500000], revenue: [800000, 1800000], emp: [6, 12], roi: 30 }, tags: ['agriculture', 'greenhouse'] },
  { code: 'coffee_shop', name_ar: 'مقهى', base: { capex: [250000, 500000], revenue: [350000, 700000], emp: [3, 6], roi: 20 }, tags: ['food', 'cafe'] },
  { code: 'bakery', name_ar: 'مخبز', base: { capex: [200000, 400000], revenue: [300000, 600000], emp: [3, 5], roi: 18 }, tags: ['food', 'bakery'] },
  { code: 'food_truck', name_ar: 'عربة طعام', base: { capex: [100000, 200000], revenue: [200000, 400000], emp: [2, 4], roi: 14 }, tags: ['food', 'food-truck'] },
  { code: 'pharmacy', name_ar: 'صيدلية', base: { capex: [400000, 800000], revenue: [500000, 1000000], emp: [2, 4], roi: 22 }, tags: ['healthcare', 'pharmacy'] },
  { code: 'medical_lab', name_ar: 'مختبر طبي', base: { capex: [700000, 1400000], revenue: [600000, 1200000], emp: [4, 8], roi: 26 }, tags: ['healthcare', 'lab'] },
  { code: 'mobile_shop', name_ar: 'محل جوالات', base: { capex: [300000, 600000], revenue: [600000, 1200000], emp: [2, 4], roi: 20 }, tags: ['retail', 'electronics'] },
  { code: 'clothing_store', name_ar: 'محل ملابس', base: { capex: [350000, 700000], revenue: [500000, 1000000], emp: [2, 5], roi: 22 }, tags: ['retail', 'fashion'] },
  { code: 'water_bottling_plant', name_ar: 'مصنع تعبئة مياه', base: { capex: [2000000, 4000000], revenue: [1500000, 3000000], emp: [10, 20], roi: 36 }, tags: ['manufacturing', 'water'] },
  { code: 'packaging_factory', name_ar: 'مصنع تعبئة وتغليف', base: { capex: [1500000, 3000000], revenue: [1200000, 2500000], emp: [8, 15], roi: 30 }, tags: ['manufacturing', 'packaging'] },
  { code: 'last_mile_delivery', name_ar: 'توصيل لمسافة قصيرة', base: { capex: [400000, 800000], revenue: [800000, 1500000], emp: [6, 12], roi: 24 }, tags: ['logistics', 'delivery'] }
];

const sizes = {
  small: { multiplier: 1, label_ar: 'صغير', label_en: 'Small' },
  medium: { multiplier: 1.5, label_ar: 'متوسط', label_en: 'Medium' },
  large: { multiplier: 3, label_ar: 'كبير', label_en: 'Large' }
};

function scale(arr, m) {
  return arr.map(v => Math.round(v * m));
}

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

let sql = `-- Bonds V3 — Model Size Variants (Auto-generated)\n-- Generated at: ${new Date().toISOString()}\n\nBEGIN;\n\n`;

let generatedCount = 0;

for (const a of activities) {
  for (const [sizeKey, size] of Object.entries(sizes)) {
    const code = `${a.code}_${sizeKey}`;
    const nameAr = `${a.name_ar} ${size.label_ar}`;
    const nameEn = `${size.label_en} ${a.name_en || a.name_ar}`;
    const capex = scale(a.base.capex, size.multiplier);
    const revenue = scale(a.base.revenue, size.multiplier);
    const emp = scale(a.base.emp, size.multiplier);
    const roi = Math.round(a.base.roi * (size.multiplier === 1 ? 1 : size.multiplier === 1.5 ? 1.2 : 1.4));

    sql += `INSERT INTO public.project_models (\n`;
    sql += `  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,\n`;
    sql += `  model_type, size_category, default_currency,\n`;
    sql += `  capex_min, capex_max, revenue_min, revenue_max,\n`;
    sql += `  employee_count_min, employee_count_max, typical_roi_months,\n`;
    sql += `  tags, is_published\n`;
    sql += `)\n`;
    sql += `SELECT\n`;
    sql += `  s.id, ss.id, a.id,\n`;
    sql += `  '${code}', '${escapeSql(nameAr)}', '${escapeSql(nameEn)}',\n`;
    sql += `  'greenfield', '${sizeKey}', 'SAR',\n`;
    sql += `  ${capex[0]}, ${capex[1]}, ${revenue[0]}, ${revenue[1]},\n`;
    sql += `  ${emp[0]}, ${emp[1]}, ${roi},\n`;
    sql += `  ARRAY['${a.tags.join("','")}'], true\n`;
    sql += `FROM public.economic_sectors s\n`;
    sql += `JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id\n`;
    sql += `JOIN public.economic_activities a ON a.sub_sector_id = ss.id\n`;
    sql += `WHERE a.code = '${a.code}'\n`;
    sql += `ON CONFLICT (code) DO NOTHING;\n\n`;
    generatedCount++;
  }
}

sql += `-- Link all published models to default assumptions and risks\n`;
sql += `INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)\n`;
sql += `SELECT pm.id, fa.id, fa.default_value\n`;
sql += `FROM public.project_models pm\n`;
sql += `CROSS JOIN public.financial_assumptions fa\n`;
sql += `WHERE pm.is_published = true\n`;
sql += `ON CONFLICT (project_model_id, assumption_id) DO NOTHING;\n\n`;

sql += `INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)\n`;
sql += `SELECT pm.id, rf.id, rf.default_score, 'Initial default risk score'\n`;
sql += `FROM public.project_models pm\n`;
sql += `CROSS JOIN public.risk_factors rf\n`;
sql += `WHERE pm.is_published = true\n`;
sql += `ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;\n\n`;

sql += `COMMIT;\n`;

fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`Generated ${generatedCount} model variants at: ${outputPath}`);
