-- Bonds V3 — Cities & Market Data (Auto-generated)
-- Generated at: 2026-06-13T13:42:10.285Z

BEGIN;

-- Cities
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('RUH', 'الرياض', 'Riyadh', 'Riyadh', 'SA', 7500000, 2.1, 140000, 100)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('JED', 'جدة', 'Jeddah', 'Makkah', 'SA', 4500000, 1.8, 120000, 92)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('DMM', 'الدمام', 'Dammam', 'Eastern', 'SA', 1200000, 1.9, 130000, 95)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('KHB', 'الخبر', 'Khobar', 'Eastern', 'SA', 800000, 1.7, 135000, 96)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('MED', 'المدينة المنورة', 'Madinah', 'Madinah', 'SA', 1400000, 1.6, 100000, 82)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('YNB', 'ينبع', 'Yanbu', 'Madinah', 'SA', 350000, 1.4, 115000, 85)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('ABH', 'أبها', 'Abha', 'Asir', 'SA', 700000, 1.5, 90000, 75)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('ELQ', 'بريدة', 'Buraidah', 'Qassim', 'SA', 650000, 1.6, 95000, 78)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('TIF', 'الطائف', 'Taif', 'Makkah', 'SA', 900000, 1.5, 88000, 74)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('TBU', 'تبوك', 'Tabuk', 'Tabuk', 'SA', 600000, 1.7, 98000, 76)
ON CONFLICT (code) DO NOTHING;

-- City Market Data
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 150, 1, 1800, 11700, 7500, 75, 70, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 120, 1.25, 1600, 10400, 7000, 75, 65, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 60, 2.5, 1400, 9100, 6500, 75, 55, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 90, 1.67, 1500, 9750, 8000, 75, 50, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 75, 2, 1700, 11050, 9000, 75, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 105, 1.43, 1500, 9750, 6500, 75, 60, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 83, 1.81, 1550, 10075, 6800, 75, 58, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 45, 3.33, 900, 5850, 7000, 75, 40, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 38, 3.95, 1200, 7800, 8000, 75, 35, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 23, 6.52, 2500, 16250, 8500, 75, 50, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 90, 1.67, 1800, 11700, 6900, 75, 70, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 72, 2.08, 1600, 10400, 6440, 75, 65, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 36, 4.17, 1400, 9100, 5980, 75, 55, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 54, 2.78, 1500, 9750, 7360, 75, 50, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 45, 3.33, 1700, 11050, 8280, 75, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 63, 2.38, 1500, 9750, 5980, 75, 60, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 50, 3, 1550, 10075, 6256, 75, 58, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 27, 5.56, 900, 5850, 6440, 75, 40, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 23, 6.52, 1200, 7800, 7360, 75, 35, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 14, 10.71, 2500, 16250, 7820, 75, 50, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 18, 8.33, 1350, 8775, 7125, 70, 53, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 14, 10.71, 1200, 7800, 6650, 70, 49, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 1050, 6825, 6175, 70, 41, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 11, 13.64, 1125, 7313, 7600, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 9, 16.67, 1275, 8288, 8550, 70, 34, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 13, 11.54, 1125, 7313, 6175, 70, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 10, 15, 1163, 7560, 6460, 70, 44, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 675, 4388, 6650, 70, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 900, 5850, 7600, 70, 26, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1875, 12188, 8075, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 12, 12.5, 1350, 8775, 7200, 70, 53, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 10, 15, 1200, 7800, 6720, 70, 49, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 1050, 6825, 6240, 70, 41, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 1125, 7313, 7680, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 1275, 8288, 8640, 70, 34, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 8, 18.75, 1125, 7313, 6240, 70, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 1163, 7560, 6528, 70, 44, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 675, 4388, 6720, 70, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 900, 5850, 7680, 70, 26, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1875, 12188, 8160, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 21, 7.14, 1350, 8775, 6150, 70, 53, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 17, 8.82, 1200, 7800, 5740, 70, 49, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 8, 18.75, 1050, 6825, 5330, 70, 41, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 13, 11.54, 1125, 7313, 6560, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 11, 13.64, 1275, 8288, 7380, 70, 34, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 15, 10, 1125, 7313, 5330, 70, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 12, 12.5, 1163, 7560, 5576, 70, 44, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 675, 4388, 5740, 70, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 900, 5850, 6560, 70, 26, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1875, 12188, 6970, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 990, 6435, 6375, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 880, 5720, 5950, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 770, 5005, 5525, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 825, 5363, 6800, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 935, 6078, 7650, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 825, 5363, 5525, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 853, 5545, 5780, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5950, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 6800, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 7225, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 8, 18.75, 990, 6435, 5625, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 880, 5720, 5250, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 770, 5005, 4875, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 825, 5363, 6000, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 935, 6078, 6750, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 825, 5363, 4875, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 853, 5545, 5100, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5250, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 6000, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 6375, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 990, 6435, 5850, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 880, 5720, 5460, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 770, 5005, 5070, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 825, 5363, 6240, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 935, 6078, 7020, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 825, 5363, 5070, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 853, 5545, 5304, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5460, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 6240, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 6630, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 10, 15, 990, 6435, 5550, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 8, 18.75, 880, 5720, 5180, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 770, 5005, 4810, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 825, 5363, 5920, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 935, 6078, 6660, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 825, 5363, 4810, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 853, 5545, 5032, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5180, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 5920, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 6290, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 990, 6435, 5700, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 880, 5720, 5320, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 770, 5005, 4940, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 825, 5363, 6080, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 935, 6078, 6840, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 825, 5363, 4940, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 853, 5545, 5168, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5320, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 6080, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 6460, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;

COMMIT;
