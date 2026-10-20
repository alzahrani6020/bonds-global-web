-- Bonds Global — canonical ADM1 bootstrap from the existing 22-country master.
-- Local deterministic seed only; no runtime API, AI API, key, or provider token.

begin;

create or replace function private.normalize_geo_admin_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $func$
  select nullif(
    btrim(
      regexp_replace(
        translate(
          replace(lower(coalesce(p_value,'')),'ـ',''),
          'أإآٱى',
          'ااااي'
        ),
        '^(منطقة|محافظة|ولاية|إقليم|اقليم|جهة|إمارة|امارة|بلدية|المحافظة|الولاية|الإقليم|الاقليم|الجهة|الإمارة|الامارة|البلدية)[[:space:]]+',
        '',
        'i'
      )
    ),
    ''
  );
$func$;

revoke all on function private.normalize_geo_admin_name(text) from public,anon,authenticated;
grant execute on function private.normalize_geo_admin_name(text) to service_role;

insert into public.geo_admin_areas(
  canonical_code,country_code,admin_level,name_ar,name_en,
  source_code,source_id,confidence,metadata,is_active
)
values
  ('BG-ADM1-SA-01','SA',1,'منطقة الرياض','Riyadh Region','bonds_legacy','legacy-admin1:SA:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-02','SA',1,'منطقة مكة المكرمة','Makkah Region','bonds_legacy','legacy-admin1:SA:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-03','SA',1,'منطقة المدينة المنورة','Madinah Region','bonds_legacy','legacy-admin1:SA:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-04','SA',1,'منطقة القصيم','Qassim Region','bonds_legacy','legacy-admin1:SA:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-05','SA',1,'المنطقة الشرقية','Eastern Region','bonds_legacy','legacy-admin1:SA:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-06','SA',1,'منطقة عسير','Asir Region','bonds_legacy','legacy-admin1:SA:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-07','SA',1,'منطقة تبوك','Tabuk Region','bonds_legacy','legacy-admin1:SA:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-08','SA',1,'منطقة حائل','Hail Region','bonds_legacy','legacy-admin1:SA:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-09','SA',1,'منطقة الحدود الشمالية','Northern Borders Region','bonds_legacy','legacy-admin1:SA:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-10','SA',1,'منطقة الجوف','Al Jawf Region','bonds_legacy','legacy-admin1:SA:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-11','SA',1,'منطقة جازان','Jazan Region','bonds_legacy','legacy-admin1:SA:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-12','SA',1,'منطقة نجران','Najran Region','bonds_legacy','legacy-admin1:SA:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-SA-13','SA',1,'منطقة الباحة','Al Baha Region','bonds_legacy','legacy-admin1:SA:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','السعودية','country_name_en','Saudi Arabia'),true),
  ('BG-ADM1-AE-01','AE',1,'إمارة دبي','Dubai','bonds_legacy','legacy-admin1:AE:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','الإمارات العربية المتحدة','country_name_en','United Arab Emirates'),true),
  ('BG-ADM1-AE-02','AE',1,'إمارة أبوظبي','Abu Dhabi','bonds_legacy','legacy-admin1:AE:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','الإمارات العربية المتحدة','country_name_en','United Arab Emirates'),true),
  ('BG-ADM1-AE-03','AE',1,'إمارة الشارقة','Sharjah','bonds_legacy','legacy-admin1:AE:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','الإمارات العربية المتحدة','country_name_en','United Arab Emirates'),true),
  ('BG-ADM1-AE-04','AE',1,'إمارة عجمان','Ajman','bonds_legacy','legacy-admin1:AE:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','الإمارات العربية المتحدة','country_name_en','United Arab Emirates'),true),
  ('BG-ADM1-AE-05','AE',1,'إمارة أم القيوين','Umm Al Quwain','bonds_legacy','legacy-admin1:AE:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','الإمارات العربية المتحدة','country_name_en','United Arab Emirates'),true),
  ('BG-ADM1-AE-06','AE',1,'إمارة رأس الخيمة','Ras Al Khaimah','bonds_legacy','legacy-admin1:AE:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','الإمارات العربية المتحدة','country_name_en','United Arab Emirates'),true),
  ('BG-ADM1-AE-07','AE',1,'إمارة الفجيرة','Fujairah','bonds_legacy','legacy-admin1:AE:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','الإمارات العربية المتحدة','country_name_en','United Arab Emirates'),true),
  ('BG-ADM1-KW-01','KW',1,'محافظة العاصمة','Capital Governorate','bonds_legacy','legacy-admin1:KW:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','الكويت','country_name_en','Kuwait'),true),
  ('BG-ADM1-KW-02','KW',1,'محافظة حولي','Hawalli Governorate','bonds_legacy','legacy-admin1:KW:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','الكويت','country_name_en','Kuwait'),true),
  ('BG-ADM1-KW-03','KW',1,'محافظة الفروانية','Farwaniya Governorate','bonds_legacy','legacy-admin1:KW:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','الكويت','country_name_en','Kuwait'),true),
  ('BG-ADM1-KW-04','KW',1,'محافظة مبارك الكبير','Mubarak Al-Kabeer Governorate','bonds_legacy','legacy-admin1:KW:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','الكويت','country_name_en','Kuwait'),true),
  ('BG-ADM1-KW-05','KW',1,'محافظة الأحمدي','Ahmadi Governorate','bonds_legacy','legacy-admin1:KW:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','الكويت','country_name_en','Kuwait'),true),
  ('BG-ADM1-KW-06','KW',1,'محافظة الجهراء','Jahra Governorate','bonds_legacy','legacy-admin1:KW:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','الكويت','country_name_en','Kuwait'),true),
  ('BG-ADM1-QA-01','QA',1,'بلدية الدوحة','Doha Municipality','bonds_legacy','legacy-admin1:QA:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','قطر','country_name_en','Qatar'),true),
  ('BG-ADM1-QA-02','QA',1,'بلدية الريان','Al Rayyan Municipality','bonds_legacy','legacy-admin1:QA:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','قطر','country_name_en','Qatar'),true),
  ('BG-ADM1-QA-03','QA',1,'بلدية أم صلال','Umm Salal Municipality','bonds_legacy','legacy-admin1:QA:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','قطر','country_name_en','Qatar'),true),
  ('BG-ADM1-QA-04','QA',1,'بلدية الخور والذخيرة','Al Khor and Al Thakhira Municipality','bonds_legacy','legacy-admin1:QA:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','قطر','country_name_en','Qatar'),true),
  ('BG-ADM1-QA-05','QA',1,'بلدية الوكرة','Al Wakrah Municipality','bonds_legacy','legacy-admin1:QA:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','قطر','country_name_en','Qatar'),true),
  ('BG-ADM1-QA-06','QA',1,'بلدية الضعاين','Al Daayen Municipality','bonds_legacy','legacy-admin1:QA:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','قطر','country_name_en','Qatar'),true),
  ('BG-ADM1-QA-07','QA',1,'بلدية الشمال','Al Shamal Municipality','bonds_legacy','legacy-admin1:QA:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','قطر','country_name_en','Qatar'),true),
  ('BG-ADM1-QA-08','QA',1,'بلدية الشحانية','Al Shahaniya Municipality','bonds_legacy','legacy-admin1:QA:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','قطر','country_name_en','Qatar'),true),
  ('BG-ADM1-BH-01','BH',1,'محافظة العاصمة','Capital Governorate','bonds_legacy','legacy-admin1:BH:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','البحرين','country_name_en','Bahrain'),true),
  ('BG-ADM1-BH-02','BH',1,'محافظة المحرق','Muharraq Governorate','bonds_legacy','legacy-admin1:BH:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','البحرين','country_name_en','Bahrain'),true),
  ('BG-ADM1-BH-03','BH',1,'المحافظة الشمالية','Northern Governorate','bonds_legacy','legacy-admin1:BH:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','البحرين','country_name_en','Bahrain'),true),
  ('BG-ADM1-BH-04','BH',1,'المحافظة الجنوبية','Southern Governorate','bonds_legacy','legacy-admin1:BH:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','البحرين','country_name_en','Bahrain'),true),
  ('BG-ADM1-OM-01','OM',1,'محافظة مسقط','Muscat Governorate','bonds_legacy','legacy-admin1:OM:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-02','OM',1,'محافظة الباطنة','Al Batinah Governorate','bonds_legacy','legacy-admin1:OM:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-03','OM',1,'محافظة الداخلية','Ad Dakhiliyah Governorate','bonds_legacy','legacy-admin1:OM:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-04','OM',1,'محافظة الظاهرة','Ad Dhahirah Governorate','bonds_legacy','legacy-admin1:OM:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-05','OM',1,'محافظة البريمي','Al Buraimi Governorate','bonds_legacy','legacy-admin1:OM:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-06','OM',1,'محافظة الوسطى','Al Wusta Governorate','bonds_legacy','legacy-admin1:OM:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-07','OM',1,'محافظة الشرقية','Ash Sharqiyah Governorate','bonds_legacy','legacy-admin1:OM:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-08','OM',1,'محافظة ظفار','Dhofar Governorate','bonds_legacy','legacy-admin1:OM:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-09','OM',1,'محافظة مسندم','Musandam Governorate','bonds_legacy','legacy-admin1:OM:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-10','OM',1,'محافظة شمال الباطنة','Al Batinah North Governorate','bonds_legacy','legacy-admin1:OM:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-11','OM',1,'محافظة جنوب الباطنة','Al Batinah South Governorate','bonds_legacy','legacy-admin1:OM:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-12','OM',1,'محافظة شمال الشرقية','Ash Sharqiyah North Governorate','bonds_legacy','legacy-admin1:OM:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-13','OM',1,'محافظة جنوب الشرقية','Ash Sharqiyah South Governorate','bonds_legacy','legacy-admin1:OM:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-OM-14','OM',1,'محافظة الوسطى','Al Wusta Governorate','bonds_legacy','legacy-admin1:OM:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','عمان','country_name_en','Oman'),true),
  ('BG-ADM1-EG-01','EG',1,'القاهرة','Cairo','bonds_legacy','legacy-admin1:EG:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-02','EG',1,'الإسكندرية','Alexandria','bonds_legacy','legacy-admin1:EG:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-03','EG',1,'الجيزة','Giza','bonds_legacy','legacy-admin1:EG:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-04','EG',1,'القليوبية','Qalyubia','bonds_legacy','legacy-admin1:EG:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-05','EG',1,'المنوفية','Monufia','bonds_legacy','legacy-admin1:EG:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-06','EG',1,'الغربية','Gharbia','bonds_legacy','legacy-admin1:EG:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-07','EG',1,'الدقهلية','Dakahlia','bonds_legacy','legacy-admin1:EG:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-08','EG',1,'الشرقية','Sharqia','bonds_legacy','legacy-admin1:EG:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-09','EG',1,'كفر الشيخ','Kafr El Sheikh','bonds_legacy','legacy-admin1:EG:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-10','EG',1,'البحيرة','Beheira','bonds_legacy','legacy-admin1:EG:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-11','EG',1,'دمياط','Damietta','bonds_legacy','legacy-admin1:EG:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-12','EG',1,'بورسعيد','Port Said','bonds_legacy','legacy-admin1:EG:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-13','EG',1,'الإسماعيلية','Ismailia','bonds_legacy','legacy-admin1:EG:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-14','EG',1,'السويس','Suez','bonds_legacy','legacy-admin1:EG:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-15','EG',1,'شمال سيناء','North Sinai','bonds_legacy','legacy-admin1:EG:15',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',15,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-16','EG',1,'جنوب سيناء','South Sinai','bonds_legacy','legacy-admin1:EG:16',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',16,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-17','EG',1,'البحر الأحمر','Red Sea','bonds_legacy','legacy-admin1:EG:17',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',17,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-18','EG',1,'الفيوم','Faiyum','bonds_legacy','legacy-admin1:EG:18',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',18,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-19','EG',1,'بني سويف','Beni Suef','bonds_legacy','legacy-admin1:EG:19',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',19,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-20','EG',1,'المنيا','Minya','bonds_legacy','legacy-admin1:EG:20',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',20,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-21','EG',1,'أسيوط','Assiut','bonds_legacy','legacy-admin1:EG:21',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',21,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-22','EG',1,'سوهاج','Sohag','bonds_legacy','legacy-admin1:EG:22',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',22,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-23','EG',1,'قنا','Qena','bonds_legacy','legacy-admin1:EG:23',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',23,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-24','EG',1,'الأقصر','Luxor','bonds_legacy','legacy-admin1:EG:24',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',24,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-25','EG',1,'أسوان','Aswan','bonds_legacy','legacy-admin1:EG:25',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',25,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-26','EG',1,'الوادي الجديد','New Valley','bonds_legacy','legacy-admin1:EG:26',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',26,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-EG-27','EG',1,'مطروح','Matrouh','bonds_legacy','legacy-admin1:EG:27',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',27,'country_name_ar','مصر','country_name_en','Egypt'),true),
  ('BG-ADM1-JO-01','JO',1,'محافظة العاصمة','Amman Governorate','bonds_legacy','legacy-admin1:JO:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-02','JO',1,'محافظة الزرقاء','Zarqa Governorate','bonds_legacy','legacy-admin1:JO:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-03','JO',1,'محافظة إربد','Irbid Governorate','bonds_legacy','legacy-admin1:JO:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-04','JO',1,'محافظة المفرق','Mafraq Governorate','bonds_legacy','legacy-admin1:JO:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-05','JO',1,'محافظة عجلون','Ajloun Governorate','bonds_legacy','legacy-admin1:JO:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-06','JO',1,'محافظة جرش','Jerash Governorate','bonds_legacy','legacy-admin1:JO:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-07','JO',1,'محافظة البلقاء','Balqa Governorate','bonds_legacy','legacy-admin1:JO:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-08','JO',1,'محافظة مأدبا','Madaba Governorate','bonds_legacy','legacy-admin1:JO:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-09','JO',1,'محافظة الكرك','Karak Governorate','bonds_legacy','legacy-admin1:JO:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-10','JO',1,'محافظة الطفيلة','Tafilah Governorate','bonds_legacy','legacy-admin1:JO:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-11','JO',1,'محافظة معان','Ma''an Governorate','bonds_legacy','legacy-admin1:JO:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-JO-12','JO',1,'محافظة العقبة','Aqaba Governorate','bonds_legacy','legacy-admin1:JO:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','الأردن','country_name_en','Jordan'),true),
  ('BG-ADM1-IQ-01','IQ',1,'محافظة بغداد','Baghdad Governorate','bonds_legacy','legacy-admin1:IQ:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-02','IQ',1,'محافظة البصرة','Basra Governorate','bonds_legacy','legacy-admin1:IQ:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-03','IQ',1,'محافظة نينوى','Nineveh Governorate','bonds_legacy','legacy-admin1:IQ:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-04','IQ',1,'محافظة أربيل','Erbil Governorate','bonds_legacy','legacy-admin1:IQ:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-05','IQ',1,'محافظة السليمانية','Sulaymaniyah Governorate','bonds_legacy','legacy-admin1:IQ:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-06','IQ',1,'محافظة دهوك','Duhok Governorate','bonds_legacy','legacy-admin1:IQ:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-07','IQ',1,'محافظة كركوك','Kirkuk Governorate','bonds_legacy','legacy-admin1:IQ:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-08','IQ',1,'محافظة الأنبار','Anbar Governorate','bonds_legacy','legacy-admin1:IQ:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-09','IQ',1,'محافظة ديالى','Diyala Governorate','bonds_legacy','legacy-admin1:IQ:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-10','IQ',1,'محافظة صلاح الدين','Saladin Governorate','bonds_legacy','legacy-admin1:IQ:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-11','IQ',1,'محافظة بابل','Babil Governorate','bonds_legacy','legacy-admin1:IQ:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-12','IQ',1,'محافظة كربلاء','Karbala Governorate','bonds_legacy','legacy-admin1:IQ:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-13','IQ',1,'محافظة النجف','Najaf Governorate','bonds_legacy','legacy-admin1:IQ:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-14','IQ',1,'محافظة واسط','Wasit Governorate','bonds_legacy','legacy-admin1:IQ:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-15','IQ',1,'محافظة ميسان','Maysan Governorate','bonds_legacy','legacy-admin1:IQ:15',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',15,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-16','IQ',1,'محافظة ذي قار','Dhi Qar Governorate','bonds_legacy','legacy-admin1:IQ:16',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',16,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-17','IQ',1,'محافظة مثنى','Muthanna Governorate','bonds_legacy','legacy-admin1:IQ:17',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',17,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-18','IQ',1,'محافظة قادسية','Qadisiyyah Governorate','bonds_legacy','legacy-admin1:IQ:18',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',18,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-IQ-19','IQ',1,'محافظة النجف الأشرف','Najaf Governorate','bonds_legacy','legacy-admin1:IQ:19',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',19,'country_name_ar','العراق','country_name_en','Iraq'),true),
  ('BG-ADM1-LB-01','LB',1,'محافظة بيروت','Beirut Governorate','bonds_legacy','legacy-admin1:LB:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','لبنان','country_name_en','Lebanon'),true),
  ('BG-ADM1-LB-02','LB',1,'محافظة جبل لبنان','Mount Lebanon Governorate','bonds_legacy','legacy-admin1:LB:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','لبنان','country_name_en','Lebanon'),true),
  ('BG-ADM1-LB-03','LB',1,'محافظة الشمال','North Governorate','bonds_legacy','legacy-admin1:LB:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','لبنان','country_name_en','Lebanon'),true),
  ('BG-ADM1-LB-04','LB',1,'محافظة الجنوب','South Governorate','bonds_legacy','legacy-admin1:LB:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','لبنان','country_name_en','Lebanon'),true),
  ('BG-ADM1-LB-05','LB',1,'محافظة البقاع','Bekaa Governorate','bonds_legacy','legacy-admin1:LB:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','لبنان','country_name_en','Lebanon'),true),
  ('BG-ADM1-LB-06','LB',1,'محافظة النبطية','Nabatieh Governorate','bonds_legacy','legacy-admin1:LB:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','لبنان','country_name_en','Lebanon'),true),
  ('BG-ADM1-LB-07','LB',1,'محافظة عكار','Akkar Governorate','bonds_legacy','legacy-admin1:LB:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','لبنان','country_name_en','Lebanon'),true),
  ('BG-ADM1-LB-08','LB',1,'محافظة بعلبك الهرمل','Baalbek-Hermel Governorate','bonds_legacy','legacy-admin1:LB:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','لبنان','country_name_en','Lebanon'),true),
  ('BG-ADM1-SY-01','SY',1,'محافظة دمشق','Damascus Governorate','bonds_legacy','legacy-admin1:SY:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-02','SY',1,'محافظة ريف دمشق','Rif Dimashq Governorate','bonds_legacy','legacy-admin1:SY:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-03','SY',1,'محافظة حلب','Aleppo Governorate','bonds_legacy','legacy-admin1:SY:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-04','SY',1,'محافظة حمص','Homs Governorate','bonds_legacy','legacy-admin1:SY:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-05','SY',1,'محافظة حماة','Hama Governorate','bonds_legacy','legacy-admin1:SY:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-06','SY',1,'محافظة اللاذقية','Latakia Governorate','bonds_legacy','legacy-admin1:SY:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-07','SY',1,'محافظة طرطوس','Tartus Governorate','bonds_legacy','legacy-admin1:SY:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-08','SY',1,'محافظة إدلب','Idlib Governorate','bonds_legacy','legacy-admin1:SY:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-09','SY',1,'محافظة الحسكة','Al-Hasakah Governorate','bonds_legacy','legacy-admin1:SY:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-10','SY',1,'محافظة دير الزور','Deir ez-Zor Governorate','bonds_legacy','legacy-admin1:SY:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-11','SY',1,'محافظة الرقة','Raqqa Governorate','bonds_legacy','legacy-admin1:SY:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-12','SY',1,'محافظة السويداء','As-Suwayda Governorate','bonds_legacy','legacy-admin1:SY:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-13','SY',1,'محافظة درعا','Daraa Governorate','bonds_legacy','legacy-admin1:SY:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-SY-14','SY',1,'محافظة القنيطرة','Quneitra Governorate','bonds_legacy','legacy-admin1:SY:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','سوريا','country_name_en','Syria'),true),
  ('BG-ADM1-PS-01','PS',1,'محافظة القدس','Jerusalem Governorate','bonds_legacy','legacy-admin1:PS:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-02','PS',1,'محافظة رام الله والبيرة','Ramallah and Al-Bireh Governorate','bonds_legacy','legacy-admin1:PS:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-03','PS',1,'محافظة نابلس','Nablus Governorate','bonds_legacy','legacy-admin1:PS:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-04','PS',1,'محافظة بيت لحم','Bethlehem Governorate','bonds_legacy','legacy-admin1:PS:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-05','PS',1,'محافظة الخليل','Hebron Governorate','bonds_legacy','legacy-admin1:PS:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-06','PS',1,'محافظة أريحا','Jericho Governorate','bonds_legacy','legacy-admin1:PS:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-07','PS',1,'محافظة طوباس','Tubas Governorate','bonds_legacy','legacy-admin1:PS:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-08','PS',1,'محافظة سلفيت','Salfit Governorate','bonds_legacy','legacy-admin1:PS:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-09','PS',1,'محافظة غزة','Gaza Governorate','bonds_legacy','legacy-admin1:PS:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-10','PS',1,'محافظة شمال غزة','North Gaza Governorate','bonds_legacy','legacy-admin1:PS:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-11','PS',1,'محافظة دير البلح','Deir Al-Balah Governorate','bonds_legacy','legacy-admin1:PS:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-12','PS',1,'محافظة خان يونس','Khan Yunis Governorate','bonds_legacy','legacy-admin1:PS:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-PS-13','PS',1,'محافظة رفح','Rafah Governorate','bonds_legacy','legacy-admin1:PS:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','فلسطين','country_name_en','Palestine'),true),
  ('BG-ADM1-TN-01','TN',1,'ولاية تونس','Tunis Governorate','bonds_legacy','legacy-admin1:TN:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-02','TN',1,'ولاية أريانة','Ariana Governorate','bonds_legacy','legacy-admin1:TN:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-03','TN',1,'ولاية منوبة','Manouba Governorate','bonds_legacy','legacy-admin1:TN:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-04','TN',1,'ولاية بن عروس','Ben Arous Governorate','bonds_legacy','legacy-admin1:TN:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-05','TN',1,'ولاية نابل','Nabeul Governorate','bonds_legacy','legacy-admin1:TN:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-06','TN',1,'ولاية زغوان','Zaghouan Governorate','bonds_legacy','legacy-admin1:TN:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-07','TN',1,'ولاية بنزرت','Bizerte Governorate','bonds_legacy','legacy-admin1:TN:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-08','TN',1,'ولاية باجة','Beja Governorate','bonds_legacy','legacy-admin1:TN:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-09','TN',1,'ولاية جندوبة','Jendouba Governorate','bonds_legacy','legacy-admin1:TN:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-10','TN',1,'ولاية الكاف','Le Kef Governorate','bonds_legacy','legacy-admin1:TN:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-11','TN',1,'ولاية سليانة','Siliana Governorate','bonds_legacy','legacy-admin1:TN:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-12','TN',1,'ولاية القيروان','Kairouan Governorate','bonds_legacy','legacy-admin1:TN:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-13','TN',1,'ولاية القصرين','Kasserine Governorate','bonds_legacy','legacy-admin1:TN:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-14','TN',1,'ولاية سيدي بوزيد','Sidi Bouzid Governorate','bonds_legacy','legacy-admin1:TN:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-15','TN',1,'ولاية القصرين','Kasserine Governorate','bonds_legacy','legacy-admin1:TN:15',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',15,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-16','TN',1,'ولاية قفصة','Gafsa Governorate','bonds_legacy','legacy-admin1:TN:16',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',16,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-17','TN',1,'ولاية توزر','Tozeur Governorate','bonds_legacy','legacy-admin1:TN:17',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',17,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-18','TN',1,'ولاية قبلي','Kebili Governorate','bonds_legacy','legacy-admin1:TN:18',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',18,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-19','TN',1,'ولاية مدنين','Medenine Governorate','bonds_legacy','legacy-admin1:TN:19',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',19,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-20','TN',1,'ولاية تطاوين','Tataouine Governorate','bonds_legacy','legacy-admin1:TN:20',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',20,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-21','TN',1,'ولاية صفاقس','Sfax Governorate','bonds_legacy','legacy-admin1:TN:21',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',21,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-22','TN',1,'ولاية المهدية','Mahdia Governorate','bonds_legacy','legacy-admin1:TN:22',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',22,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-23','TN',1,'ولاية منستير','Monastir Governorate','bonds_legacy','legacy-admin1:TN:23',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',23,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-TN-24','TN',1,'ولاية سوسة','Sousse Governorate','bonds_legacy','legacy-admin1:TN:24',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',24,'country_name_ar','تونس','country_name_en','Tunisia'),true),
  ('BG-ADM1-DZ-01','DZ',1,'ولاية الجزائر','Algiers Province','bonds_legacy','legacy-admin1:DZ:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-02','DZ',1,'ولاية وهران','Oran Province','bonds_legacy','legacy-admin1:DZ:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-03','DZ',1,'ولاية قسنطينة','Constantine Province','bonds_legacy','legacy-admin1:DZ:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-04','DZ',1,'ولاية عنابة','Annaba Province','bonds_legacy','legacy-admin1:DZ:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-05','DZ',1,'ولاية باتنة','Batna Province','bonds_legacy','legacy-admin1:DZ:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-06','DZ',1,'ولاية بجاية','Bejaia Province','bonds_legacy','legacy-admin1:DZ:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-07','DZ',1,'ولاية سطيف','Setif Province','bonds_legacy','legacy-admin1:DZ:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-08','DZ',1,'ولاية تيزي وزو','Tizi Ouzou Province','bonds_legacy','legacy-admin1:DZ:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-09','DZ',1,'ولاية تلمسان','Tlemcen Province','bonds_legacy','legacy-admin1:DZ:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-10','DZ',1,'ولاية سيدي بلعباس','Sidi Bel Abbes Province','bonds_legacy','legacy-admin1:DZ:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-11','DZ',1,'ولاية بسكرة','Biskra Province','bonds_legacy','legacy-admin1:DZ:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-12','DZ',1,'ولاية ورقلة','Ouargla Province','bonds_legacy','legacy-admin1:DZ:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-13','DZ',1,'ولاية بشار','Bechar Province','bonds_legacy','legacy-admin1:DZ:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-14','DZ',1,'ولاية الأغواط','Laghouat Province','bonds_legacy','legacy-admin1:DZ:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-15','DZ',1,'ولاية مستغانم','Mostaganem Province','bonds_legacy','legacy-admin1:DZ:15',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',15,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-16','DZ',1,'ولاية الشلف','Chlef Province','bonds_legacy','legacy-admin1:DZ:16',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',16,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-17','DZ',1,'ولاية تيارت','Tiaret Province','bonds_legacy','legacy-admin1:DZ:17',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',17,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-18','DZ',1,'ولاية مدية','Medea Province','bonds_legacy','legacy-admin1:DZ:18',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',18,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-19','DZ',1,'ولاية بومرداس','Boumerdes Province','bonds_legacy','legacy-admin1:DZ:19',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',19,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-20','DZ',1,'ولاية تيبازة','Tipaza Province','bonds_legacy','legacy-admin1:DZ:20',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',20,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-21','DZ',1,'ولاية سوق أهراس','Souk Ahras Province','bonds_legacy','legacy-admin1:DZ:21',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',21,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-22','DZ',1,'ولاية الطارف','El Tarf Province','bonds_legacy','legacy-admin1:DZ:22',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',22,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-23','DZ',1,'ولاية خنشلة','Khenchela Province','bonds_legacy','legacy-admin1:DZ:23',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',23,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-24','DZ',1,'ولاية أم البواقي','Oum El Bouaghi Province','bonds_legacy','legacy-admin1:DZ:24',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',24,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-25','DZ',1,'ولاية برج بوعريريج','Bordj Bou Arreridj Province','bonds_legacy','legacy-admin1:DZ:25',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',25,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-26','DZ',1,'ولاية المسيلة','Msila Province','bonds_legacy','legacy-admin1:DZ:26',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',26,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-27','DZ',1,'ولاية جيجل','Jijel Province','bonds_legacy','legacy-admin1:DZ:27',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',27,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-28','DZ',1,'ولاية سكيكدة','Skikda Province','bonds_legacy','legacy-admin1:DZ:28',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',28,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-29','DZ',1,'ولاية قالمة','Guelma Province','bonds_legacy','legacy-admin1:DZ:29',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',29,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-30','DZ',1,'ولاية ميلة','Mila Province','bonds_legacy','legacy-admin1:DZ:30',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',30,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-31','DZ',1,'ولاية الجلفة','Djelfa Province','bonds_legacy','legacy-admin1:DZ:31',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',31,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-32','DZ',1,'ولاية الأغواط','Laghouat Province','bonds_legacy','legacy-admin1:DZ:32',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',32,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-33','DZ',1,'ولاية غرداية','Ghardaia Province','bonds_legacy','legacy-admin1:DZ:33',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',33,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-34','DZ',1,'ولاية إليزي','Illizi Province','bonds_legacy','legacy-admin1:DZ:34',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',34,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-35','DZ',1,'ولاية تمنراست','Tamanrasset Province','bonds_legacy','legacy-admin1:DZ:35',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',35,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-36','DZ',1,'ولاية أدرار','Adrar Province','bonds_legacy','legacy-admin1:DZ:36',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',36,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-37','DZ',1,'ولاية تندوف','Tindouf Province','bonds_legacy','legacy-admin1:DZ:37',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',37,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-38','DZ',1,'ولاية بشار','Bechar Province','bonds_legacy','legacy-admin1:DZ:38',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',38,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-39','DZ',1,'ولاية النعامة','Naama Province','bonds_legacy','legacy-admin1:DZ:39',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',39,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-40','DZ',1,'ولاية السعيدة','El Bayadh Province','bonds_legacy','legacy-admin1:DZ:40',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',40,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-41','DZ',1,'ولاية البيض','El Bayadh Province','bonds_legacy','legacy-admin1:DZ:41',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',41,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-42','DZ',1,'ولاية تسمسيلت','Tissemsilt Province','bonds_legacy','legacy-admin1:DZ:42',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',42,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-43','DZ',1,'ولاية عين الدفلى','Ain Defla Province','bonds_legacy','legacy-admin1:DZ:43',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',43,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-44','DZ',1,'ولاية عين تموشنت','Ain Temouchent Province','bonds_legacy','legacy-admin1:DZ:44',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',44,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-45','DZ',1,'ولاية غليزان','Relizane Province','bonds_legacy','legacy-admin1:DZ:45',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',45,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-46','DZ',1,'ولاية معسكر','Mascara Province','bonds_legacy','legacy-admin1:DZ:46',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',46,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-47','DZ',1,'ولاية سعيدة','Saida Province','bonds_legacy','legacy-admin1:DZ:47',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',47,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-DZ-48','DZ',1,'ولاية الوادي','El Oued Province','bonds_legacy','legacy-admin1:DZ:48',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',48,'country_name_ar','الجزائر','country_name_en','Algeria'),true),
  ('BG-ADM1-MA-01','MA',1,'جهة الرباط سلا القنيطرة','Rabat-Sale-Kenitra','bonds_legacy','legacy-admin1:MA:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-02','MA',1,'جهة الدار البيضاء سطات','Casablanca-Settat','bonds_legacy','legacy-admin1:MA:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-03','MA',1,'جهة فاس مكناس','Fes-Meknes','bonds_legacy','legacy-admin1:MA:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-04','MA',1,'جهة طنجة تطوان الحسيمة','Tanger-Tetouan-Al Hoceima','bonds_legacy','legacy-admin1:MA:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-05','MA',1,'جهة مراكش آسفي','Marrakech-Safi','bonds_legacy','legacy-admin1:MA:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-06','MA',1,'جهة سوس ماسة','Souss-Massa','bonds_legacy','legacy-admin1:MA:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-07','MA',1,'جهة الشرق','Oriental','bonds_legacy','legacy-admin1:MA:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-08','MA',1,'جهة بني ملال خنيفرة','Beni Mellal-Khenifra','bonds_legacy','legacy-admin1:MA:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-09','MA',1,'جهة درعة تافيلالت','Draa-Tafilalet','bonds_legacy','legacy-admin1:MA:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-10','MA',1,'جهة كلميم واد نون','Guelmim-Oued Noun','bonds_legacy','legacy-admin1:MA:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-11','MA',1,'جهة العيون الساقية الحمراء','Laayoune-Sakia El Hamra','bonds_legacy','legacy-admin1:MA:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-MA-12','MA',1,'جهة الداخلة وادي الذهب','Dakhla-Oued Ed-Dahab','bonds_legacy','legacy-admin1:MA:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','المغرب','country_name_en','Morocco'),true),
  ('BG-ADM1-LY-01','LY',1,'محافظة طرابلس','Tripoli','bonds_legacy','legacy-admin1:LY:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-02','LY',1,'محافظة بنغازي','Benghazi','bonds_legacy','legacy-admin1:LY:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-03','LY',1,'محافظة مصراتة','Misrata','bonds_legacy','legacy-admin1:LY:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-04','LY',1,'محافظة الزاوية','Zawiya','bonds_legacy','legacy-admin1:LY:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-05','LY',1,'محافظة سبها','Sabha','bonds_legacy','legacy-admin1:LY:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-06','LY',1,'محافظة درنة','Derna','bonds_legacy','legacy-admin1:LY:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-07','LY',1,'محافظة البيضاء','Bayda','bonds_legacy','legacy-admin1:LY:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-08','LY',1,'محافظة الخمس','Al Khums','bonds_legacy','legacy-admin1:LY:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-09','LY',1,'محافظة الجفارة','Al Jafara','bonds_legacy','legacy-admin1:LY:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-10','LY',1,'محافظة الجبل الأخضر','Al Jabal al Akhdar','bonds_legacy','legacy-admin1:LY:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-11','LY',1,'محافظة مرزق','Murzuq','bonds_legacy','legacy-admin1:LY:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-12','LY',1,'محافظة غات','Ghat','bonds_legacy','legacy-admin1:LY:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-13','LY',1,'محافظة الكفرة','Kufra','bonds_legacy','legacy-admin1:LY:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-14','LY',1,'محافظة أوباري','Ubari','bonds_legacy','legacy-admin1:LY:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-LY-15','LY',1,'محافظة ترهونة','Tarhuna','bonds_legacy','legacy-admin1:LY:15',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',15,'country_name_ar','ليبيا','country_name_en','Libya'),true),
  ('BG-ADM1-SD-01','SD',1,'ولاية الخرطوم','Khartoum State','bonds_legacy','legacy-admin1:SD:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-02','SD',1,'ولاية الجزيرة','Gezira State','bonds_legacy','legacy-admin1:SD:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-03','SD',1,'ولاية شمال كردفان','North Kordofan','bonds_legacy','legacy-admin1:SD:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-04','SD',1,'ولاية جنوب كردفان','South Kordofan','bonds_legacy','legacy-admin1:SD:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-05','SD',1,'ولاية شمال دارفور','North Darfur','bonds_legacy','legacy-admin1:SD:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-06','SD',1,'ولاية جنوب دارفور','South Darfur','bonds_legacy','legacy-admin1:SD:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-07','SD',1,'ولاية غرب دارفور','West Darfur','bonds_legacy','legacy-admin1:SD:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-08','SD',1,'ولاية شرق دارفور','East Darfur','bonds_legacy','legacy-admin1:SD:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-09','SD',1,'ولاية وسط دارفور','Central Darfur','bonds_legacy','legacy-admin1:SD:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-10','SD',1,'ولاية البحر الأحمر','Red Sea State','bonds_legacy','legacy-admin1:SD:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-11','SD',1,'ولاية كسلا','Kassala State','bonds_legacy','legacy-admin1:SD:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-12','SD',1,'ولاية القضارف','Al Qadarif State','bonds_legacy','legacy-admin1:SD:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-13','SD',1,'ولاية سنار','Sennar State','bonds_legacy','legacy-admin1:SD:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-14','SD',1,'ولاية النيل الأبيض','White Nile State','bonds_legacy','legacy-admin1:SD:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-15','SD',1,'ولاية النيل الأزرق','Blue Nile State','bonds_legacy','legacy-admin1:SD:15',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',15,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-16','SD',1,'ولاية نهر النيل','River Nile State','bonds_legacy','legacy-admin1:SD:16',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',16,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-17','SD',1,'ولاية الشمالية','Northern State','bonds_legacy','legacy-admin1:SD:17',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',17,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-SD-18','SD',1,'ولاية غرب كردفان','West Kordofan','bonds_legacy','legacy-admin1:SD:18',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',18,'country_name_ar','السودان','country_name_en','Sudan'),true),
  ('BG-ADM1-YE-01','YE',1,'محافظة صنعاء','Sanaa Governorate','bonds_legacy','legacy-admin1:YE:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-02','YE',1,'محافظة عدن','Aden Governorate','bonds_legacy','legacy-admin1:YE:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-03','YE',1,'محافظة الحديدة','Hodeidah Governorate','bonds_legacy','legacy-admin1:YE:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-04','YE',1,'محافظة إب','Ibb Governorate','bonds_legacy','legacy-admin1:YE:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-05','YE',1,'محافظة تعز','Taiz Governorate','bonds_legacy','legacy-admin1:YE:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-06','YE',1,'محافظة حضرموت','Hadramaut Governorate','bonds_legacy','legacy-admin1:YE:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-07','YE',1,'محافظة مأرب','Marib Governorate','bonds_legacy','legacy-admin1:YE:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-08','YE',1,'محافظة الجوف','Al Jawf Governorate','bonds_legacy','legacy-admin1:YE:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-09','YE',1,'محافظة عمران','Amran Governorate','bonds_legacy','legacy-admin1:YE:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-10','YE',1,'محافظة ذمار','Dhamar Governorate','bonds_legacy','legacy-admin1:YE:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-11','YE',1,'محافظة المحويت','Al Mahwit Governorate','bonds_legacy','legacy-admin1:YE:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-12','YE',1,'محافظة ريمة','Raymah Governorate','bonds_legacy','legacy-admin1:YE:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-13','YE',1,'محافظة حجة','Hajjah Governorate','bonds_legacy','legacy-admin1:YE:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-14','YE',1,'محافظة صعدة','Saada Governorate','bonds_legacy','legacy-admin1:YE:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-15','YE',1,'محافظة أبين','Abyan Governorate','bonds_legacy','legacy-admin1:YE:15',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',15,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-16','YE',1,'محافظة لحج','Lahij Governorate','bonds_legacy','legacy-admin1:YE:16',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',16,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-17','YE',1,'محافظة الضالع','Al Dhale Governorate','bonds_legacy','legacy-admin1:YE:17',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',17,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-18','YE',1,'محافظة شبوة','Shabwah Governorate','bonds_legacy','legacy-admin1:YE:18',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',18,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-19','YE',1,'محافظة المهرة','Al Mahrah Governorate','bonds_legacy','legacy-admin1:YE:19',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',19,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-20','YE',1,'محافظة سقطرى','Socotra Governorate','bonds_legacy','legacy-admin1:YE:20',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',20,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-YE-21','YE',1,'محافظة البيضاء','Al Bayda Governorate','bonds_legacy','legacy-admin1:YE:21',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',21,'country_name_ar','اليمن','country_name_en','Yemen'),true),
  ('BG-ADM1-DJ-01','DJ',1,'إقليم جيبوتي','Djibouti Region','bonds_legacy','legacy-admin1:DJ:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','جيبوتي','country_name_en','Djibouti'),true),
  ('BG-ADM1-DJ-02','DJ',1,'إقليم علي صبيح','Ali Sabieh Region','bonds_legacy','legacy-admin1:DJ:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','جيبوتي','country_name_en','Djibouti'),true),
  ('BG-ADM1-DJ-03','DJ',1,'إقليم دخيل','Dikhil Region','bonds_legacy','legacy-admin1:DJ:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','جيبوتي','country_name_en','Djibouti'),true),
  ('BG-ADM1-DJ-04','DJ',1,'إقليم تاجورة','Tadjourah Region','bonds_legacy','legacy-admin1:DJ:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','جيبوتي','country_name_en','Djibouti'),true),
  ('BG-ADM1-DJ-05','DJ',1,'إقليم أوبوك','Obock Region','bonds_legacy','legacy-admin1:DJ:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','جيبوتي','country_name_en','Djibouti'),true),
  ('BG-ADM1-DJ-06','DJ',1,'إقليم أرتا','Arta Region','bonds_legacy','legacy-admin1:DJ:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','جيبوتي','country_name_en','Djibouti'),true),
  ('BG-ADM1-SO-01','SO',1,'إقليم بنادر','Banaadir Region','bonds_legacy','legacy-admin1:SO:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-02','SO',1,'إقليم أرض البنط','Puntland','bonds_legacy','legacy-admin1:SO:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-03','SO',1,'إقليم أرض الصومال','Somaliland','bonds_legacy','legacy-admin1:SO:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-04','SO',1,'إقليم جيدو','Gedo Region','bonds_legacy','legacy-admin1:SO:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-05','SO',1,'إقليم شبيلي السفلى','Lower Shabelle','bonds_legacy','legacy-admin1:SO:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-06','SO',1,'إقليم شبيلي الوسطى','Middle Shabelle','bonds_legacy','legacy-admin1:SO:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-07','SO',1,'إقليم هيران','Hiran Region','bonds_legacy','legacy-admin1:SO:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-08','SO',1,'إقليم باي وباكول','Bay and Bakool','bonds_legacy','legacy-admin1:SO:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-09','SO',1,'إقليم مودج','Mudug Region','bonds_legacy','legacy-admin1:SO:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-10','SO',1,'إقليم نوجال','Nugal Region','bonds_legacy','legacy-admin1:SO:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-11','SO',1,'إقليم توجر','Togdheer Region','bonds_legacy','legacy-admin1:SO:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-12','SO',1,'إقليم صول','Sool Region','bonds_legacy','legacy-admin1:SO:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-SO-13','SO',1,'إقليم سناج','Sanaag Region','bonds_legacy','legacy-admin1:SO:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','الصومال','country_name_en','Somalia'),true),
  ('BG-ADM1-MR-01','MR',1,'ولاية نواكشوط الغربية','Nouakchott-Ouest','bonds_legacy','legacy-admin1:MR:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-02','MR',1,'ولاية نواكشوط الجنوبية','Nouakchott-Sud','bonds_legacy','legacy-admin1:MR:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-03','MR',1,'ولاية نواكشوط الشمالية','Nouakchott-Nord','bonds_legacy','legacy-admin1:MR:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-04','MR',1,'ولاية الحوض الغربي','Hodh El Gharbi','bonds_legacy','legacy-admin1:MR:04',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',4,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-05','MR',1,'ولاية الحوض الشرقي','Hodh Ech Chargui','bonds_legacy','legacy-admin1:MR:05',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',5,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-06','MR',1,'ولاية اترارزة','Trarza','bonds_legacy','legacy-admin1:MR:06',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',6,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-07','MR',1,'ولاية أدرار','Adrar','bonds_legacy','legacy-admin1:MR:07',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',7,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-08','MR',1,'ولاية داخلت نواذيبو','Dakhlet Nouadhibou','bonds_legacy','legacy-admin1:MR:08',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',8,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-09','MR',1,'ولاية تاجانت','Tagant','bonds_legacy','legacy-admin1:MR:09',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',9,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-10','MR',1,'ولاية العصابة','Assaba','bonds_legacy','legacy-admin1:MR:10',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',10,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-11','MR',1,'ولاية غورغول','Gorgol','bonds_legacy','legacy-admin1:MR:11',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',11,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-12','MR',1,'ولاية براكنة','Brakna','bonds_legacy','legacy-admin1:MR:12',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',12,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-13','MR',1,'ولاية لبراكنة','Guidimaka','bonds_legacy','legacy-admin1:MR:13',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',13,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-MR-14','MR',1,'ولاية إينشيري','Inchiri','bonds_legacy','legacy-admin1:MR:14',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',14,'country_name_ar','موريتانيا','country_name_en','Mauritania'),true),
  ('BG-ADM1-KM-01','KM',1,'جزيرة نجازيجا','Grande Comore','bonds_legacy','legacy-admin1:KM:01',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',1,'country_name_ar','جزر القمر','country_name_en','Comoros'),true),
  ('BG-ADM1-KM-02','KM',1,'جزيرة موالي','Mohéli','bonds_legacy','legacy-admin1:KM:02',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',2,'country_name_ar','جزر القمر','country_name_en','Comoros'),true),
  ('BG-ADM1-KM-03','KM',1,'جزيرة أنجوان','Anjouan','bonds_legacy','legacy-admin1:KM:03',85,jsonb_build_object('seed','v3/master-data/countries-governorates-cities.js','master_index',3,'country_name_ar','جزر القمر','country_name_en','Comoros'),true)
on conflict(canonical_code) do update set
  country_code=excluded.country_code,
  admin_level=excluded.admin_level,
  name_ar=excluded.name_ar,
  name_en=excluded.name_en,
  source_code=excluded.source_code,
  source_id=excluded.source_id,
  confidence=greatest(public.geo_admin_areas.confidence,excluded.confidence),
  metadata=public.geo_admin_areas.metadata || excluded.metadata,
  is_active=true,
  updated_at=now();

create unique index if not exists uq_geo_admin_source_identity
  on public.geo_admin_areas(source_code,source_id)
  where source_code is not null and source_id is not null;

update public.geo_places gp
set admin1_id=ga.id,
    metadata=gp.metadata || jsonb_build_object(
      'admin1_resolution','legacy_city_code_index',
      'admin1_resolved_at',now()
    ),
    updated_at=now()
from public.cities c
join public.geo_admin_areas ga
  on ga.country_code=c.country_code
 and ga.admin_level=1
 and ga.canonical_code=(
   'BG-ADM1-' || c.country_code || '-' || split_part(c.code,'-',2)
 )
where gp.id=c.geo_place_id
  and c.code ~ '^[A-Z]{2}-[0-9]{2}-[0-9]{3}$'
  and gp.admin1_id is distinct from ga.id;

with candidates as (
  select
    gp.id as place_id,
    min(ga.id::text)::uuid as admin1_id,
    count(distinct ga.id) as matches
  from public.geo_places gp
  join public.cities c on c.geo_place_id=gp.id
  join public.geo_admin_areas ga
    on ga.country_code=c.country_code
   and ga.admin_level=1
   and ga.is_active=true
   and private.normalize_geo_admin_name(c.region)
       = private.normalize_geo_admin_name(coalesce(ga.name_ar,ga.name_en))
  where gp.admin1_id is null
    and nullif(btrim(c.region),'') is not null
  group by gp.id
)
update public.geo_places gp
set admin1_id=c.admin1_id,
    metadata=gp.metadata || jsonb_build_object(
      'admin1_resolution','normalized_unique_legacy_region',
      'admin1_resolved_at',now()
    ),
    updated_at=now()
from candidates c
where gp.id=c.place_id
  and c.matches=1
  and gp.admin1_id is null;

-- Second deterministic bridge: if an unlinked legacy place has the same
-- normalized Arabic or English name as already-linked places in the same
-- country, inherit ADM1 only when all matching references agree on one ADM1.
with linked_names as (
  select
    c.country_code,
    private.normalize_geo_admin_name(c.name_ar) as norm_ar,
    lower(nullif(btrim(c.name_en),'')) as norm_en,
    gp.admin1_id
  from public.cities c
  join public.geo_places gp on gp.id=c.geo_place_id
  where gp.admin1_id is not null
    and coalesce(c.is_active,true)=true
),
candidates as (
  select
    target_gp.id as place_id,
    min(ln.admin1_id::text)::uuid as admin1_id,
    count(distinct ln.admin1_id) as adm1_matches
  from public.cities target_c
  join public.geo_places target_gp on target_gp.id=target_c.geo_place_id
  join linked_names ln
    on ln.country_code=target_c.country_code
   and (
     (
       private.normalize_geo_admin_name(target_c.name_ar) is not null
       and ln.norm_ar=private.normalize_geo_admin_name(target_c.name_ar)
     )
     or
     (
       nullif(btrim(target_c.name_en),'') is not null
       and ln.norm_en=lower(btrim(target_c.name_en))
     )
   )
  where target_gp.admin1_id is null
    and coalesce(target_c.is_active,true)=true
  group by target_gp.id
)
update public.geo_places gp
set admin1_id=c.admin1_id,
    metadata=gp.metadata || jsonb_build_object(
      'admin1_resolution','unique_same_country_place_name',
      'admin1_resolved_at',now()
    ),
    updated_at=now()
from candidates c
where gp.id=c.place_id
  and c.adm1_matches=1
  and gp.admin1_id is null;

-- Third deterministic bridge: some legacy supplemental rows use a parent
-- city name in cities.region (e.g. ports/free zones). Resolve that parent city
-- to ADM1 only when all same-country linked matches agree on one ADM1.
with linked_place_names as (
  select
    c.country_code,
    private.normalize_geo_admin_name(c.name_ar) as norm_ar,
    lower(nullif(btrim(c.name_en),'')) as norm_en,
    gp.admin1_id
  from public.cities c
  join public.geo_places gp on gp.id=c.geo_place_id
  where gp.admin1_id is not null
    and coalesce(c.is_active,true)=true
),
candidates as (
  select
    target_gp.id as place_id,
    min(lp.admin1_id::text)::uuid as admin1_id,
    count(distinct lp.admin1_id) as adm1_matches
  from public.cities target_c
  join public.geo_places target_gp on target_gp.id=target_c.geo_place_id
  join linked_place_names lp
    on lp.country_code=target_c.country_code
   and (
     (
       private.normalize_geo_admin_name(target_c.region) is not null
       and lp.norm_ar=private.normalize_geo_admin_name(target_c.region)
     )
     or
     (
       nullif(btrim(target_c.region),'') is not null
       and lp.norm_en=lower(btrim(target_c.region))
     )
   )
  where target_gp.admin1_id is null
    and coalesce(target_c.is_active,true)=true
  group by target_gp.id
)
update public.geo_places gp
set admin1_id=c.admin1_id,
    metadata=gp.metadata || jsonb_build_object(
      'admin1_resolution','unique_parent_place_region',
      'admin1_resolved_at',now()
    ),
    updated_at=now()
from candidates c
where gp.id=c.place_id
  and c.adm1_matches=1
  and gp.admin1_id is null;

alter table public.data_quality_issues
  drop constraint if exists data_quality_issues_check_type_check;
alter table public.data_quality_issues
  add constraint data_quality_issues_check_type_check
  check (check_type in (
    'duplicate','missing','broken_relation','orphan_file','incomplete','invalid','geo_integrity'
  ));

create or replace function public.dq_find_geo_admin_hierarchy()
returns bigint
language plpgsql
security definer
set search_path to 'public','auth'
as $func$
declare
  v_count bigint := 0;
begin
  insert into public.data_quality_issues(
    check_type,entity_type,entity_id,field_name,severity,message,metadata
  )
  select 'geo_integrity','geo_place',gp.id,'admin1_id','high',
         'السجل الجغرافي غير مربوط بمستوى إداري أول canonical',
         jsonb_build_object(
           'canonical_geo_code',gp.canonical_code,
           'country_code',gp.country_code,
           'place_type',gp.place_type
         )
  from public.geo_places gp
  where gp.is_active=true
    and gp.place_type in ('city','town','village','hijra','hamlet','oasis','district','settlement')
    and gp.admin1_id is null

  union all

  select 'geo_integrity','geo_admin_area',null,'country_code','critical',
         'الدولة لا تحتوي مستوى ADM1 canonical نشط',
         jsonb_build_object('country_code',cp.country_code)
  from public.country_profiles cp
  where cp.is_active=true
    and not exists (
      select 1
      from public.geo_admin_areas ga
      where ga.country_code=cp.country_code
        and ga.admin_level=1
        and ga.is_active=true
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$func$;

revoke all on function public.dq_find_geo_admin_hierarchy() from public,anon,authenticated;
grant execute on function public.dq_find_geo_admin_hierarchy() to service_role;

create or replace function public.dq_run_all_checks()
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $func$
declare
  v_dup bigint;
  v_miss bigint;
  v_broken bigint;
  v_incomp bigint;
  v_geo bigint;
  v_geo_admin bigint;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') <> 'service_role'
     and not public.is_advisory_manager() then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  perform public.clear_data_quality_issues();
  v_dup := public.dq_find_duplicate_clients();
  v_miss := public.dq_find_missing_fields();
  v_broken := public.dq_find_broken_relations();
  v_incomp := public.dq_find_incomplete_projects();
  v_geo := public.dq_find_geo_integrity();
  v_geo_admin := public.dq_find_geo_admin_hierarchy();

  return jsonb_build_object(
    'duplicates',v_dup,
    'missing_fields',v_miss,
    'broken_relations',v_broken,
    'incomplete_projects',v_incomp,
    'geo_integrity',v_geo + v_geo_admin,
    'geo_admin_hierarchy',v_geo_admin
  );
end;
$func$;

commit;
