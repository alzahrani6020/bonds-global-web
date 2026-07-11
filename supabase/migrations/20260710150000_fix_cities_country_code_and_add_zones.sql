-- Fix city country codes and add special economic zones / ports / industrial cities

-- Ensure the code column exists (used by City Intelligence APIs)
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_code ON public.cities(code);

-- Derive country_code from the ISO prefix of the city code (e.g. SA-01-001 => SA)
UPDATE public.cities
SET country_code = UPPER(SPLIT_PART(code, '-', 1))
WHERE code IS NOT NULL
  AND (country_code IS NULL OR country_code = '' OR country_code = 'SA');

-- Add major special economic zones, industrial cities and ports
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, status) VALUES
  -- Saudi Arabia
  ('SA-99-001','مدينة الملك عبدالله الاقتصادية','King Abdullah Economic City','منطقة مكة المكرمة','SA','active'),
  ('SA-99-002','ميناء الملك عبدالله','King Abdullah Port','منطقة مكة المكرمة','SA','active'),
  ('SA-99-003','المدينة الصناعية في الجبيل','Jubail Industrial City','المنطقة الشرقية','SA','active'),
  ('SA-99-004','ميناء الجبيل الصناعي','Jubail Industrial Port','المنطقة الشرقية','SA','active'),
  ('SA-99-005','المدينة الصناعية في ينبع','Yanbu Industrial City','منطقة المدينة المنورة','SA','active'),
  ('SA-99-006','ميناء ينبع الصناعي','Yanbu Industrial Port','منطقة المدينة المنورة','SA','active'),
  ('SA-99-007','مدينة رأس الخير للصناعات التعدينية','Ras Al-Khair Minerals Industrial City','المنطقة الشرقية','SA','active'),
  ('SA-99-008','مدينة جازان للصناعات الأساسية والتحويلية','Jazan City for Primary and Downstream Industries','منطقة جازان','SA','active'),
  ('SA-99-009','ميناء جدة الإسلامي','Jeddah Islamic Port','منطقة مكة المكرمة','SA','active'),
  ('SA-99-010','ميناء الملك عبدالعزيز','King Abdulaziz Port','المنطقة الشرقية','SA','active'),
  ('SA-99-011','مدينة سدير للصناعة والأعمال','Sudair Industrial City','منطقة الرياض','SA','active'),
  -- UAE
  ('AE-99-001','مدينة دبي الصناعية','Dubai Industrial City','دبي','AE','active'),
  ('AE-99-002','ميناء جبل علي','Jebel Ali Port','دبي','AE','active'),
  ('AE-99-003','مدينة خليفة الصناعية','KIZAD','أبوظبي','AE','active'),
  ('AE-99-004','ميناء خليفة','Khalifa Port','أبوظبي','AE','active'),
  ('AE-99-005','المنطقة الحرة في مطار دبي','Dubai Airport Free Zone','دبي','AE','active'),
  -- Egypt
  ('EG-99-001','ميناء الإسكندرية','Alexandria Port','الإسكندرية','EG','active'),
  ('EG-99-002','ميناء الدخيلة','Dekheila Port','الإسكندرية','EG','active'),
  ('EG-99-003','ميناء السخنة','Ain Sokhna Port','السويس','EG','active'),
  ('EG-99-004','منطقة قناة السويس الاقتصادية','Suez Canal Economic Zone','السويس','EG','active'),
  ('EG-99-005','مدينة السادس من أكتوبر الصناعية','6th of October Industrial City','الجيزة','EG','active'),
  ('EG-99-006','مدينة العاشر من رمضان الصناعية','10th of Ramadan Industrial City','الشرقية','EG','active'),
  -- Qatar
  ('QA-99-001','مدينة راس لفان الصناعية','Ras Laffan Industrial City','الخور','QA','active'),
  ('QA-99-002','ميناء حمد','Hamad Port','أم صلال','QA','active'),
  ('QA-99-003','المنطقة اللوجستية الجنوبية','South Logistics Zone','الوكرة','QA','active'),
  -- Kuwait
  ('KW-99-001','ميناء الأحمدي','Ahmadi Port','الأحمدي','KW','active'),
  ('KW-99-002','ميناء الشعيبة','Shuaiba Port','الأحمدي','KW','active'),
  ('KW-99-003','ميناء مبارك الكبير','Mubarak Al Kabeer Port','مبارك الكبير','KW','active'),
  -- Oman
  ('OM-99-001','ميناء صحار','Sohar Port','صحار','OM','active'),
  ('OM-99-002','المنطقة الحرة بصحار','Sohar Free Zone','صحار','OM','active'),
  ('OM-99-003','ميناء صلالة','Salalah Port','صلالة','OM','active'),
  ('OM-99-004','ميناء الدقم','Duqm Port','الدقم','OM','active'),
  -- Bahrain
  ('BH-99-001','ميناء خليفة بن سلمان','Khalifa Bin Salman Port','المحرق','BH','active'),
  ('BH-99-002','منطقة البحرين اللوجستية','Bahrain Logistics Zone','المحرق','BH','active'),
  -- Jordan
  ('JO-99-001','ميناء العقبة','Aqaba Port','العقبة','JO','active'),
  ('JO-99-002','المنطقة الخاصة بالعقبة','Aqaba Special Economic Zone','العقبة','JO','active'),
  ('JO-99-003','مدينة سحاب الصناعية','Sahab Industrial City','عمان','JO','active'),
  -- Iraq
  ('IQ-99-001','ميناء أم قصر','Umm Qasr Port','أم قصر','IQ','active'),
  ('IQ-99-002','ميناء البصرة','Basra Port','البصرة','IQ','active'),
  ('IQ-99-003','ميناء خور الزبير','Khor Al Zubair Port','خور الزبير','IQ','active'),
  -- Lebanon
  ('LB-99-001','ميناء بيروت','Beirut Port','بيروت','LB','active'),
  ('LB-99-002','المنطقة الحرة في بيروت','Beirut Free Zone','بيروت','LB','active'),
  -- Syria
  ('SY-99-001','ميناء طرطوس','Tartus Port','طرطوس','SY','active'),
  ('SY-99-002','ميناء اللاذقية','Latakia Port','اللاذقية','SY','active'),
  -- Palestine
  ('PS-99-001','ميناء غزة','Gaza Port','غزة','PS','active'),
  -- Tunisia
  ('TN-99-001','ميناء رادس','Rades Port','بن عروس','TN','active'),
  ('TN-99-002','ميناء حلق الوادي','La Goulette Port','تونس','TN','active'),
  ('TN-99-003','ميناء صفاقس','Sfax Port','صفاقس','TN','active'),
  -- Algeria
  ('DZ-99-001','ميناء الجزائر','Algiers Port','الجزائر','DZ','active'),
  ('DZ-99-002','ميناء وهران','Oran Port','وهران','DZ','active'),
  ('DZ-99-003','ميناء عنابة','Annaba Port','عنابة','DZ','active'),
  -- Morocco
  ('MA-99-001','ميناء طنجة المتوسط','Tanger Med Port','طنجة','MA','active'),
  ('MA-99-002','المنطقة الحرة لطنجة المتوسط','Tanger Med Free Zone','طنجة','MA','active'),
  ('MA-99-003','ميناء الدار البيضاء','Casablanca Port','الدار البيضاء','MA','active'),
  ('MA-99-004','ميناء أكادير','Agadir Port','أكادير','MA','active'),
  -- Libya
  ('LY-99-001','ميناء طرابلس','Tripoli Port','طرابلس','LY','active'),
  ('LY-99-002','ميناء بنغازي','Benghazi Port','بنغازي','LY','active'),
  ('LY-99-003','ميناء مصراتة','Misrata Port','مصراتة','LY','active'),
  -- Sudan
  ('SD-99-001','ميناء بورتسودان','Port Sudan Port','بورتسودان','SD','active'),
  ('SD-99-002','ميناء سواكن','Suakin Port','سواكن','SD','active'),
  -- Yemen
  ('YE-99-001','ميناء الحديدة','Hodeidah Port','الحديدة','YE','active'),
  ('YE-99-002','ميناء عدن','Aden Port','عدن','YE','active'),
  -- Somalia
  ('SO-99-001','ميناء مقديشو','Mogadishu Port','مقديشو','SO','active'),
  ('SO-99-002','ميناء بربرة','Berbera Port','بربرة','SO','active'),
  -- Djibouti
  ('DJ-99-001','ميناء جيبوتي','Djibouti Port','جيبوتي','DJ','active'),
  ('DJ-99-002','المنطقة الحرة في جيبوتي','Djibouti Free Zone','جيبوتي','DJ','active'),
  -- Mauritania
  ('MR-99-001','ميناء نواكشوط','Nouakchott Port','نواكشوط','MR','active'),
  ('MR-99-002','ميناء نواذيبو','Nouadhibou Port','نواذيبو','MR','active'),
  -- Comoros
  ('KM-99-001','ميناء موروني','Moroni Port','موروني','KM','active')
ON CONFLICT (code) DO NOTHING;
