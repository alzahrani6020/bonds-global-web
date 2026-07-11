-- Add city type taxonomy and seed economic/health/media/free-zone cities

-- City type taxonomy column
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS city_types text[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_cities_city_types ON public.cities USING GIN (city_types);

-- Classify existing special economic zones / ports / industrial cities
UPDATE public.cities SET city_types = ARRAY['economic_city'] WHERE code = 'SA-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SA-99-002';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'SA-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SA-99-004';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'SA-99-005';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SA-99-006';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'SA-99-007';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'SA-99-008';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SA-99-009';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SA-99-010';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'SA-99-011';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'AE-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'AE-99-002';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'AE-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'AE-99-004';
UPDATE public.cities SET city_types = ARRAY['free_zone'] WHERE code = 'AE-99-005';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'EG-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'EG-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'EG-99-003';
UPDATE public.cities SET city_types = ARRAY['economic_city'] WHERE code = 'EG-99-004';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'EG-99-005';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'EG-99-006';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'QA-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'QA-99-002';
UPDATE public.cities SET city_types = ARRAY['free_zone'] WHERE code = 'QA-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'KW-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'KW-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'KW-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'OM-99-001';
UPDATE public.cities SET city_types = ARRAY['free_zone'] WHERE code = 'OM-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'OM-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'OM-99-004';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'BH-99-001';
UPDATE public.cities SET city_types = ARRAY['free_zone'] WHERE code = 'BH-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'JO-99-001';
UPDATE public.cities SET city_types = ARRAY['free_zone'] WHERE code = 'JO-99-002';
UPDATE public.cities SET city_types = ARRAY['industrial_city'] WHERE code = 'JO-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'IQ-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'IQ-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'IQ-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'LB-99-001';
UPDATE public.cities SET city_types = ARRAY['free_zone'] WHERE code = 'LB-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SY-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SY-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'PS-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'TN-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'TN-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'TN-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'DZ-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'DZ-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'DZ-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'MA-99-001';
UPDATE public.cities SET city_types = ARRAY['free_zone'] WHERE code = 'MA-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'MA-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'MA-99-004';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'LY-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'LY-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'LY-99-003';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SD-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SD-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'YE-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'YE-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SO-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'SO-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'DJ-99-001';
UPDATE public.cities SET city_types = ARRAY['free_zone'] WHERE code = 'DJ-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'MR-99-001';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'MR-99-002';
UPDATE public.cities SET city_types = ARRAY['port'] WHERE code = 'KM-99-001';

-- Add new curated economic/health/media/free-zone cities
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, city_types, status) VALUES
  ('SA-97-001','مدينة الملك سلمان للطاقة','King Salman Energy Park','منطقة الرياض','SA',ARRAY['economic_city', 'industrial_city'],'active'),
  ('SA-97-002','مدينة المعرفة الاقتصادية','Knowledge Economic City','منطقة المدينة المنورة','SA',ARRAY['economic_city'],'active'),
  ('SA-97-003','مدينة الملك فهد الطبية','King Fahad Medical City','منطقة الرياض','SA',ARRAY['health_city'],'active'),
  ('SA-97-004','مدينة الإعلام السعودية','Saudi Media City','منطقة الرياض','SA',ARRAY['media_city'],'active'),
  ('SA-97-005','نيوم','NEOM','منطقة تبوك','SA',ARRAY['economic_city'],'active'),
  ('AE-97-001','مدينة مصدر','Masdar City','أبوظبي','AE',ARRAY['economic_city'],'active'),
  ('AE-97-002','مدينة دبي الطبية','Dubai Healthcare City','دبي','AE',ARRAY['health_city', 'free_zone'],'active'),
  ('AE-97-003','مدينة دبي للإعلام','Dubai Media City','دبي','AE',ARRAY['media_city', 'free_zone'],'active'),
  ('AE-97-004','تواصل أبوظبي','twofour54 Abu Dhabi','أبوظبي','AE',ARRAY['media_city', 'free_zone'],'active'),
  ('AE-97-005','المنطقة الحرة لإمارة الشارقة','Sharjah Free Zone','الشارقة','AE',ARRAY['free_zone'],'active'),
  ('AE-97-006','المنطقة الحرة بعجمان','Ajman Free Zone','عجمان','AE',ARRAY['free_zone'],'active'),
  ('AE-97-007','منطقة رأس الخيمة الاقتصادية','RAKEZ','رأس الخيمة','AE',ARRAY['free_zone'],'active'),
  ('EG-97-001','العاصمة الإدارية الجديدة','New Administrative Capital','القاهرة','EG',ARRAY['economic_city'],'active'),
  ('EG-97-002','مدينة العلمين الجديدة','New Alamein City','مطروح','EG',ARRAY['economic_city'],'active'),
  ('EG-97-003','مدينة الإنتاج الإعلامي','Egypt Media Production City','الجيزة','EG',ARRAY['media_city'],'active'),
  ('EG-97-004','المنطقة الحرة ببورسعيد','Port Said Free Zone','بورسعيد','EG',ARRAY['free_zone'],'active'),
  ('EG-97-005','المنطقة الحرة بالإسماعيلية','Ismailia Free Zone','الإسماعيلية','EG',ARRAY['free_zone'],'active'),
  ('QA-97-001','مدينة لوسيل','Lusail City','الدوحة','QA',ARRAY['economic_city'],'active'),
  ('QA-97-002','مدينة قطر للإعلام','Media City Qatar','الدوحة','QA',ARRAY['media_city', 'free_zone'],'active'),
  ('QA-97-003','المناطق الحرة القطرية','Qatar Free Zones','أم صلال','QA',ARRAY['free_zone'],'active'),
  ('KW-97-001','مدينة الحرير','Silk City','الأحمدي','KW',ARRAY['economic_city'],'active'),
  ('KW-97-002','مدينة جابر الأحمد الصحية','Jaber Al-Ahmad Health City','الأحمدي','KW',ARRAY['health_city'],'active'),
  ('KW-97-003','المنطقة الحرة الكويتية','Kuwait Free Trade Zone','الكويت','KW',ARRAY['free_zone'],'active'),
  ('OM-97-001','المنطقة الاقتصادية الخاصة بالدقم','Duqm Special Economic Zone','الدقم','OM',ARRAY['economic_city', 'free_zone'],'active'),
  ('OM-97-002','المدينة الطبية الجامعية','University Medical City','مسقط','OM',ARRAY['health_city'],'active'),
  ('OM-97-003','المنطقة الحرة بصلالة','Salalah Free Zone','صلالة','OM',ARRAY['free_zone'],'active'),
  ('BH-97-001','مدينة البحرين المالية','Bahrain Financial Harbour','المنامة','BH',ARRAY['economic_city', 'free_zone'],'active'),
  ('BH-97-002','مدينة البحرين للإعلام','Bahrain Media City','المحرق','BH',ARRAY['media_city', 'free_zone'],'active'),
  ('BH-97-003','المنطقة الحرة بمطار البحرين','Bahrain Airport Free Zone','المحرق','BH',ARRAY['free_zone'],'active'),
  ('JO-97-001','منطقة الملك حسين بن طلال التنموية','King Hussein Bin Talal Development Area','عمان','JO',ARRAY['economic_city'],'active'),
  ('JO-97-002','مدينة الحسين الطبية','King Hussein Medical City','عمان','JO',ARRAY['health_city'],'active'),
  ('JO-97-003','مدينة الأردن للإعلام','Jordan Media City','عمان','JO',ARRAY['media_city', 'free_zone'],'active'),
  ('JO-97-004','المنطقة الحرة الأردنية','Jordan Free Zone','الزرقاء','JO',ARRAY['free_zone'],'active'),
  ('IQ-97-001','مدينة بغداد الطبية','Baghdad Medical City','بغداد','IQ',ARRAY['health_city'],'active'),
  ('IQ-97-002','مدينة العراق للإعلام','Iraq Media City','بغداد','IQ',ARRAY['media_city'],'active'),
  ('IQ-97-003','المنطقة الحرة في البصرة','Basra Free Zone','البصرة','IQ',ARRAY['free_zone'],'active'),
  ('LB-97-001','مدينة بيروت للإعلام','Beirut Media City','بيروت','LB',ARRAY['media_city'],'active'),
  ('LB-97-002','المنطقة الحرة في طرابلس','Tripoli Free Zone','طرابلس','LB',ARRAY['free_zone'],'active'),
  ('SY-97-001','مدينة عدرا الصناعية','Adra Industrial City','ريف دمشق','SY',ARRAY['economic_city', 'industrial_city'],'active'),
  ('SY-97-002','مدينة دمشق الطبية','Damascus Medical City','دمشق','SY',ARRAY['health_city'],'active'),
  ('SY-97-003','مدينة الإعلام السوري','Syria Media City','دمشق','SY',ARRAY['media_city'],'active'),
  ('SY-97-004','المنطقة الحرة في دمشق','Damascus Free Zone','دمشق','SY',ARRAY['free_zone'],'active'),
  ('PS-97-001','مدينة روابي','Rawabi','رام الله','PS',ARRAY['economic_city'],'active'),
  ('PS-97-002','مدينة فلسطين الطبية','Palestine Medical City','رام الله','PS',ARRAY['health_city'],'active'),
  ('PS-97-003','مدينة فلسطين للإعلام','Palestine Media City','رام الله','PS',ARRAY['media_city'],'active'),
  ('PS-97-004','المنطقة الحرة الزراعية في أريحا','Jericho Agro-Industrial Park','أريحا','PS',ARRAY['free_zone'],'active'),
  ('TN-97-001','المدينة الاقتصادية التونسية','Tunisia Economic City','بنزرت','TN',ARRAY['economic_city'],'active'),
  ('TN-97-002','الحمامات الصحية','Hammamet Health Resort','الناظور','TN',ARRAY['health_city'],'active'),
  ('TN-97-003','مدينة الإعلام بالمدينة الاقتصادية التونسية','Media City Tunisia Economic City','بنزرت','TN',ARRAY['media_city'],'active'),
  ('TN-97-004','المنطقة الحرة ببنزرت','Bizerte Free Zone','بنزرت','TN',ARRAY['free_zone'],'active'),
  ('DZ-97-001','المنطقة الحرة بالجزائر','Algiers Free Zone','الجزائر','DZ',ARRAY['free_zone'],'active'),
  ('DZ-97-002','مدينة الجزائر للإعلام','Algiers Media City','الجزائر','DZ',ARRAY['media_city'],'active'),
  ('MA-97-001','مدينة الدار البيضاء المالية','Casablanca Finance City','الدار البيضاء','MA',ARRAY['economic_city', 'free_zone'],'active'),
  ('MA-97-002','كازا ميديا سيتي','Casa Media City','الدار البيضاء','MA',ARRAY['media_city'],'active'),
  ('MA-97-003','المنطقة الحرة بأكادير','Agadir Free Zone','أكادير','MA',ARRAY['free_zone'],'active'),
  ('MA-97-004','المنطقة الحرة بالقنيطرة','Kenitra Free Zone','القنيطرة','MA',ARRAY['free_zone'],'active'),
  ('LY-97-001','مدينة طرابلس الطبية','Tripoli Medical City','طرابلس','LY',ARRAY['health_city'],'active'),
  ('LY-97-002','المنطقة الحرة بمصراتة','Misrata Free Zone','مصراتة','LY',ARRAY['free_zone'],'active'),
  ('SD-97-001','مدينة سوبا الصناعية','Soba Industrial City','الخرطوم','SD',ARRAY['economic_city', 'industrial_city'],'active'),
  ('SD-97-002','مدينة الخرطوم الطبية','Khartoum Medical City','الخرطوم','SD',ARRAY['health_city'],'active'),
  ('SD-97-003','المنطقة الحرة ببورتسودان','Port Sudan Free Zone','بورتسودان','SD',ARRAY['free_zone'],'active'),
  ('YE-97-001','المنطقة الحرة بعدن','Aden Free Zone','عدن','YE',ARRAY['free_zone'],'active'),
  ('YE-97-002','مدينة صنعاء الطبية','Sana''a Medical City','صنعاء','YE',ARRAY['health_city'],'active'),
  ('YE-97-003','مدينة اليمن للإعلام','Yemen Media City','صنعاء','YE',ARRAY['media_city'],'active'),
  ('SO-97-001','مدينة بربرة الاقتصادية','Berbera Economic Zone','بربرة','SO',ARRAY['economic_city', 'free_zone'],'active'),
  ('SO-97-002','مدينة مقديشو الطبية','Mogadishu Medical City','مقديشو','SO',ARRAY['health_city'],'active'),
  ('SO-97-003','مدينة الصومال للإعلام','Somalia Media City','مقديشو','SO',ARRAY['media_city'],'active'),
  ('DJ-97-001','المنطقة الحرة الدولية بجيبوتي','Djibouti International Free Trade Zone','جيبوتي','DJ',ARRAY['free_zone'],'active'),
  ('DJ-97-002','مدينة جيبوتي الطبية','Djibouti Medical City','جيبوتي','DJ',ARRAY['health_city'],'active'),
  ('DJ-97-003','مدينة جيبوتي للإعلام','Djibouti Media City','جيبوتي','DJ',ARRAY['media_city'],'active'),
  ('MR-97-001','المنطقة الحرة بنواذيبو','Nouadhibou Free Zone','نواذيبو','MR',ARRAY['free_zone'],'active'),
  ('MR-97-002','مدينة نواكشوط الطبية','Nouakchott Medical City','نواكشوط','MR',ARRAY['health_city'],'active'),
  ('MR-97-003','مدينة موريتانيا للإعلام','Mauritania Media City','نواكشوط','MR',ARRAY['media_city'],'active'),
  ('KM-97-001','المنطقة الحرة بموروني','Moroni Free Zone','موروني','KM',ARRAY['free_zone'],'active'),
  ('KM-97-002','مدينة موروني الطبية','Moroni Medical City','موروني','KM',ARRAY['health_city'],'active'),
  ('KM-97-003','مدينة جزر القمر للإعلام','Comoros Media City','موروني','KM',ARRAY['media_city'],'active')
ON CONFLICT (code) DO NOTHING;
