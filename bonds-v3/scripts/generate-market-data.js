/**
 * Generates seed SQL for additional cities and city-level market data.
 *
 * Usage:
 *   node scripts/generate-market-data.js > supabase/seed/20260611000003_v3_market_data.sql
 */

const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'supabase', 'seed', '20260611000003_v3_market_data.sql');

const cities = [
  { code: 'RUH', name_ar: 'الرياض', name_en: 'Riyadh', region: 'Riyadh', tier: 1, population: 7500000, growth: 2.1, income: 140000, ppi: 100 },
  { code: 'JED', name_ar: 'جدة', name_en: 'Jeddah', region: 'Makkah', tier: 1, population: 4500000, growth: 1.8, income: 120000, ppi: 92 },
  { code: 'DMM', name_ar: 'الدمام', name_en: 'Dammam', region: 'Eastern', tier: 2, population: 1200000, growth: 1.9, income: 130000, ppi: 95 },
  { code: 'KHB', name_ar: 'الخبر', name_en: 'Khobar', region: 'Eastern', tier: 2, population: 800000, growth: 1.7, income: 135000, ppi: 96 },
  { code: 'MED', name_ar: 'المدينة المنورة', name_en: 'Madinah', region: 'Madinah', tier: 2, population: 1400000, growth: 1.6, income: 100000, ppi: 82 },
  { code: 'YNB', name_ar: 'ينبع', name_en: 'Yanbu', region: 'Madinah', tier: 3, population: 350000, growth: 1.4, income: 115000, ppi: 85 },
  { code: 'ABH', name_ar: 'أبها', name_en: 'Abha', region: 'Asir', tier: 3, population: 700000, growth: 1.5, income: 90000, ppi: 75 },
  { code: 'ELQ', name_ar: 'بريدة', name_en: 'Buraidah', region: 'Qassim', tier: 3, population: 650000, growth: 1.6, income: 95000, ppi: 78 },
  { code: 'TIF', name_ar: 'الطائف', name_en: 'Taif', region: 'Makkah', tier: 3, population: 900000, growth: 1.5, income: 88000, ppi: 74 },
  { code: 'TBU', name_ar: 'تبوك', name_en: 'Tabuk', region: 'Tabuk', tier: 3, population: 600000, growth: 1.7, income: 98000, ppi: 76 }
];

const activities = [
  { code: 'burger_restaurant', base_competitors: 100, density: 0.00002, base_rent: 1800, base_salary: 7500, saturation: 70 },
  { code: 'coffee_shop', base_competitors: 80, density: 0.000016, base_rent: 1600, base_salary: 7000, saturation: 65 },
  { code: 'small_supermarket', base_competitors: 40, density: 0.000008, base_rent: 1400, base_salary: 6500, saturation: 55 },
  { code: 'pharmacy', base_competitors: 60, density: 0.000012, base_rent: 1500, base_salary: 8000, saturation: 50 },
  { code: 'dental_clinic', base_competitors: 50, density: 0.00001, base_rent: 1700, base_salary: 9000, saturation: 45 },
  { code: 'clothing_store', base_competitors: 70, density: 0.000014, base_rent: 1500, base_salary: 6500, saturation: 60 },
  { code: 'mobile_shop', base_competitors: 55, density: 0.000011, base_rent: 1550, base_salary: 6800, saturation: 58 },
  { code: 'last_mile_delivery', base_competitors: 30, density: 0.000006, base_rent: 900, base_salary: 7000, saturation: 40 },
  { code: 'kindergarten', base_competitors: 25, density: 0.000005, base_rent: 1200, base_salary: 8000, saturation: 35 },
  { code: 'boutique_hotel', base_competitors: 15, density: 0.000003, base_rent: 2500, base_salary: 8500, saturation: 50 }
];

function interpolate(min, max, factor) {
  return Math.round(min + (max - min) * factor);
}

function cityFactor(tier, ppi) {
  // Tier 1 = highest rent/saturation, tier 3 = lowest
  const tierFactor = tier === 1 ? 1.0 : tier === 2 ? 0.75 : 0.55;
  const ppiFactor = ppi / 100;
  return { tierFactor, ppiFactor };
}

let sql = `-- Bonds V3 — Cities & Market Data (Auto-generated)\n-- Generated at: ${new Date().toISOString()}\n\nBEGIN;\n\n`;

// Insert cities
sql += `-- Cities\n`;
for (const c of cities) {
  sql += `INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)\n`;
  sql += `VALUES ('${c.code}', '${c.name_ar}', '${c.name_en}', '${c.region}', 'SA', ${c.population}, ${c.growth}, ${c.income}, ${c.ppi})\n`;
  sql += `ON CONFLICT (code) DO NOTHING;\n`;
}

sql += `\n-- City Market Data\n`;
for (const c of cities) {
  const { tierFactor, ppiFactor } = cityFactor(c.tier, c.ppi);

  for (const a of activities) {
    const competitors = Math.max(3, Math.round(a.base_competitors * tierFactor * (c.population / 5000000)));
    const avgMarketShare = Math.max(1, round((100 / competitors) * 1.5));
    const avgRent = Math.round(a.base_rent * tierFactor);
    const avgLandPrice = Math.round(avgRent * 6.5);
    const avgSalary = Math.round(a.base_salary * ppiFactor);
    const laborAvailability = Math.max(30, Math.min(95, Math.round(80 - (c.tier * 5))));
    const marketSaturation = Math.max(20, Math.min(95, Math.round(a.saturation * tierFactor)));

    sql += `INSERT INTO public.city_market_data (\n`;
    sql += `  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,\n`;
    sql += `  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source\n`;
    sql += `)\n`;
    sql += `SELECT c.id, a.id, ${competitors}, ${avgMarketShare}, ${avgRent}, ${avgLandPrice}, ${avgSalary}, ${laborAvailability}, ${marketSaturation}, 2025, 'Bonds market dataset'\n`;
    sql += `FROM public.cities c\n`;
    sql += `CROSS JOIN public.economic_activities a\n`;
    sql += `WHERE c.code = '${c.code}' AND a.code = '${a.code}'\n`;
    sql += `ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;\n`;
  }
}

sql += `\nCOMMIT;\n`;

fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`Generated market data seed: ${outputPath}`);
console.log(`Cities: ${cities.length}, Activities: ${activities.length}, Total rows: ${cities.length * activities.length}`);

function round(num) {
  return Math.round(num * 100) / 100;
}
