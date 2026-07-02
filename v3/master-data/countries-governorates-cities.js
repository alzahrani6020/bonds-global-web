/**
 * Bonds Global — Arab Countries, Governorates/Regions, and Major Cities
 * Centralized geographic master data used by calculators, auth pages, and V3 engine.
 * Covers all 22 Arab League member states.
 *
 * Structure per country:
 *   code (ISO-3166), name, nameEn, flag,
 *   governorates[]: { name, nameEn, cities[]: { name, nameEn, code } }
 *
 * City code convention: <COUNTRY>-<GOV_INDEX>-<CITY_INDEX>
 * e.g. SA-01-001 = Riyadh, EG-01-001 = Cairo
 */

const ARAB_COUNTRIES_GEO = {
  SA: {
    code: 'SA',
    name: 'السعودية',
    nameEn: 'Saudi Arabia',
    flag: '🇸🇦',
    governorates: [
      { name: 'منطقة الرياض', nameEn: 'Riyadh Region', cities: [
        { name: 'الرياض', nameEn: 'Riyadh', code: 'SA-01-001' },
        { name: 'الدرعية', nameEn: 'Diriyah', code: 'SA-01-002' },
        { name: 'الخرج', nameEn: 'Al Kharj', code: 'SA-01-003' },
        { name: 'المزاحمية', nameEn: 'Al Muzahimiyah', code: 'SA-01-004' },
        { name: 'الحريق', nameEn: 'Al Hariq', code: 'SA-01-005' },
        { name: 'القويعية', nameEn: 'Al Quwayiyah', code: 'SA-01-006' },
        { name: 'وادي الدواسر', nameEn: 'Wadi ad Dawasir', code: 'SA-01-007' },
        { name: 'الأفلاج', nameEn: 'Al Aflaj', code: 'SA-01-008' },
        { name: 'رماح', nameEn: 'Rumah', code: 'SA-01-009' },
        { name: 'ثادق', nameEn: 'Thadiq', code: 'SA-01-010' },
        { name: 'حوطة بني تميم', nameEn: 'Hawtat Bani Tamim', code: 'SA-01-011' },
        { name: 'شقراء', nameEn: 'Shaqra', code: 'SA-01-012' },
        { name: 'المجمعة', nameEn: 'Al Majmaah', code: 'SA-01-013' },
        { name: 'سدير', nameEn: 'Sudair', code: 'SA-01-014' },
        { name: 'الزلفي', nameEn: 'Al Zulfi', code: 'SA-01-015' },
        { name: 'عفيف', nameEn: 'Afif', code: 'SA-01-016' },
        { name: 'ضرماء', nameEn: 'Dhurma', code: 'SA-01-017' },
        { name: 'الغاط', nameEn: 'Al Ghat', code: 'SA-01-018' },
        { name: 'السليل', nameEn: 'As Sulayyil', code: 'SA-01-019' },
        { name: 'دومة الجندل', nameEn: 'Dawmat al Jandal', code: 'SA-01-020' }
      ]},
      { name: 'منطقة مكة المكرمة', nameEn: 'Makkah Region', cities: [
        { name: 'مكة المكرمة', nameEn: 'Makkah', code: 'SA-02-001' },
        { name: 'جدة', nameEn: 'Jeddah', code: 'SA-02-002' },
        { name: 'الطائف', nameEn: 'Taif', code: 'SA-02-003' },
        { name: 'القنفذة', nameEn: 'Al Qunfidhah', code: 'SA-02-004' },
        { name: 'رابغ', nameEn: 'Rabigh', code: 'SA-02-005' },
        { name: 'الليث', nameEn: 'Al Lith', code: 'SA-02-006' },
        { name: 'الخرمة', nameEn: 'Al Khurmah', code: 'SA-02-007' },
        { name: 'الجموم', nameEn: 'Al Jumum', code: 'SA-02-008' },
        { name: 'الكامل', nameEn: 'Al Kamil', code: 'SA-02-009' },
        { name: 'العرضيات', nameEn: 'Al Ardiyat', code: 'SA-02-010' },
        { name: 'تربة', nameEn: 'Turbah', code: 'SA-02-011' },
        { name: 'المويه', nameEn: 'Al Mawiyah', code: 'SA-02-012' },
        { name: 'رنية', nameEn: 'Ranyah', code: 'SA-02-013' },
        { name: 'خليص', nameEn: 'Khulais', code: 'SA-02-014' },
        { name: 'أضم', nameEn: 'Adham', code: 'SA-02-015' },
        { name: 'البرك', nameEn: 'Al Birk', code: 'SA-02-016' }
      ]},
      { name: 'منطقة المدينة المنورة', nameEn: 'Madinah Region', cities: [
        { name: 'المدينة المنورة', nameEn: 'Madinah', code: 'SA-03-001' },
        { name: 'ينبع', nameEn: 'Yanbu', code: 'SA-03-002' },
        { name: 'العلا', nameEn: 'Al Ula', code: 'SA-03-003' },
        { name: 'بدر', nameEn: 'Badr', code: 'SA-03-004' },
        { name: 'خيبر', nameEn: 'Khaybar', code: 'SA-03-005' },
        { name: 'المهد', nameEn: 'Al Mahd', code: 'SA-03-006' },
        { name: 'الحناكية', nameEn: 'Al Hinakiyah', code: 'SA-03-007' }
      ]},
      { name: 'منطقة القصيم', nameEn: 'Qassim Region', cities: [
        { name: 'بريدة', nameEn: 'Buraidah', code: 'SA-04-001' },
        { name: 'عنيزة', nameEn: 'Unaizah', code: 'SA-04-002' },
        { name: 'الرس', nameEn: 'Ar Rass', code: 'SA-04-003' },
        { name: 'المذنب', nameEn: 'Al Mithnab', code: 'SA-04-004' },
        { name: 'البكيرية', nameEn: 'Al Bukayriyah', code: 'SA-04-005' },
        { name: 'البدائع', nameEn: 'Al Badai', code: 'SA-04-006' },
        { name: 'الأسياح', nameEn: 'Al Asyah', code: 'SA-04-007' },
        { name: 'النبهانية', nameEn: 'An Nabhaniyah', code: 'SA-04-008' },
        { name: 'الشماسية', nameEn: 'Ash Shimasiyah', code: 'SA-04-009' },
        { name: 'عيون الجواء', nameEn: 'Uyun al Jawa', code: 'SA-04-010' },
        { name: 'رياض الخبراء', nameEn: 'Riyad al Khabra', code: 'SA-04-011' }
      ]},
      { name: 'المنطقة الشرقية', nameEn: 'Eastern Region', cities: [
        { name: 'الدمام', nameEn: 'Dammam', code: 'SA-05-001' },
        { name: 'الخبر', nameEn: 'Al Khobar', code: 'SA-05-002' },
        { name: 'الظهران', nameEn: 'Dhahran', code: 'SA-05-003' },
        { name: 'الأحساء', nameEn: 'Al Ahsa', code: 'SA-05-004' },
        { name: 'القطيف', nameEn: 'Qatif', code: 'SA-05-005' },
        { name: 'الجبيل', nameEn: 'Jubail', code: 'SA-05-006' },
        { name: 'الخفجي', nameEn: 'Al Khafji', code: 'SA-05-007' },
        { name: 'حفر الباطن', nameEn: 'Hafar al Batin', code: 'SA-05-008' },
        { name: 'بقيق', nameEn: 'Buqayq', code: 'SA-05-009' },
        { name: 'النعيرية', nameEn: 'An Nuayriyah', code: 'SA-05-010' },
        { name: 'قرية العليا', nameEn: 'Qaryat al Ulya', code: 'SA-05-011' },
      ]},
      { name: 'منطقة عسير', nameEn: 'Asir Region', cities: [
        { name: 'أبها', nameEn: 'Abha', code: 'SA-06-001' },
        { name: 'خميس مشيط', nameEn: 'Khamis Mushait', code: 'SA-06-002' },
        { name: 'بيشة', nameEn: 'Bisha', code: 'SA-06-003' },
        { name: 'النماص', nameEn: 'An Namas', code: 'SA-06-004' },
        { name: 'محايل عسير', nameEn: 'Muhayil', code: 'SA-06-005' },
        { name: 'تثليث', nameEn: 'Tathlith', code: 'SA-06-006' },
        { name: 'ظهران الجنوب', nameEn: 'Dhahran al Janub', code: 'SA-06-007' },
        { name: 'تنومة', nameEn: 'Tanumah', code: 'SA-06-008' },
        { name: 'سراة عبيدة', nameEn: 'Sarat Abidah', code: 'SA-06-009' },
        { name: 'رجال المع', nameEn: 'Rijal Almaa', code: 'SA-06-010' },
        { name: 'بللسمر', nameEn: 'Balqarn', code: 'SA-06-011' },
        { name: 'البرك', nameEn: 'Al Birk', code: 'SA-06-012' }
      ]},
      { name: 'منطقة تبوك', nameEn: 'Tabuk Region', cities: [
        { name: 'تبوك', nameEn: 'Tabuk', code: 'SA-07-001' },
        { name: 'الوجه', nameEn: 'Al Wajh', code: 'SA-07-002' },
        { name: 'ضبا', nameEn: 'Duba', code: 'SA-07-003' },
        { name: 'تيماء', nameEn: 'Tayma', code: 'SA-07-004' },
        { name: 'أملج', nameEn: 'Umluj', code: 'SA-07-005' },
        { name: 'حقل', nameEn: 'Haql', code: 'SA-07-006' }
      ]},
      { name: 'منطقة حائل', nameEn: 'Hail Region', cities: [
        { name: 'حائل', nameEn: 'Hail', code: 'SA-08-001' },
        { name: 'بقعاء', nameEn: 'Baqaa', code: 'SA-08-002' },
        { name: 'الغزالة', nameEn: 'Al Ghazalah', code: 'SA-08-003' },
        { name: 'الشنان', nameEn: 'Ash Shinan', code: 'SA-08-004' },
        { name: 'الحائط', nameEn: 'Al Hait', code: 'SA-08-005' },
        { name: 'السليمي', nameEn: 'As Sulaymi', code: 'SA-08-006' },
        { name: 'الشملي', nameEn: 'Ash Shamli', code: 'SA-08-007' },
        { name: 'موقق', nameEn: 'Mawqaq', code: 'SA-08-008' }
      ]},
      { name: 'منطقة الحدود الشمالية', nameEn: 'Northern Borders Region', cities: [
        { name: 'عرعر', nameEn: 'Arar', code: 'SA-09-001' },
        { name: 'رفحاء', nameEn: 'Rafha', code: 'SA-09-002' },
        { name: 'طريف', nameEn: 'Turaif', code: 'SA-09-003' },
        { name: 'العويقيلة', nameEn: 'Al Uwayqilah', code: 'SA-09-004' }
      ]},
      { name: 'منطقة الجوف', nameEn: 'Al Jawf Region', cities: [
        { name: 'سكاكا', nameEn: 'Sakaka', code: 'SA-10-001' },
        { name: 'القريات', nameEn: 'Al Qurayyat', code: 'SA-10-002' },
        { name: 'دومة الجندل', nameEn: 'Dawmat al Jandal', code: 'SA-10-003' },
        { name: 'طبرجل', nameEn: 'Tabarjal', code: 'SA-10-004' }
      ]},
      { name: 'منطقة جازان', nameEn: 'Jazan Region', cities: [
        { name: 'جازان', nameEn: 'Jazan', code: 'SA-11-001' },
        { name: 'صبيا', nameEn: 'Sabya', code: 'SA-11-002' },
        { name: 'أبو عريش', nameEn: 'Abu Arish', code: 'SA-11-003' },
        { name: 'صامطة', nameEn: 'Samtah', code: 'SA-11-004' },
        { name: 'بيش', nameEn: 'Bish', code: 'SA-11-005' },
        { name: 'الدرب', nameEn: 'Ad Darb', code: 'SA-11-006' },
        { name: 'العارضة', nameEn: 'Al Aridah', code: 'SA-11-007' },
        { name: 'ضمد', nameEn: 'Dhamad', code: 'SA-11-008' },
        { name: 'الريث', nameEn: 'Ar Rayth', code: 'SA-11-009' },
        { name: 'فرسان', nameEn: 'Farasan', code: 'SA-11-010' },
        { name: 'الحريق', nameEn: 'Al Harith', code: 'SA-11-011' },
        { name: 'أحد المسارحة', nameEn: 'Ahad al Musarihah', code: 'SA-11-012' }
      ]},
      { name: 'منطقة نجران', nameEn: 'Najran Region', cities: [
        { name: 'نجران', nameEn: 'Najran', code: 'SA-12-001' },
        { name: 'شرورة', nameEn: 'Sharurah', code: 'SA-12-002' },
        { name: 'حبونا', nameEn: 'Hubuna', code: 'SA-12-003' },
        { name: 'بدر الجنوب', nameEn: 'Badr al Janub', code: 'SA-12-004' },
        { name: 'يثرب', nameEn: 'Yathrib', code: 'SA-12-005' },
        { name: 'خباش', nameEn: 'Khubash', code: 'SA-12-006' },
        { name: 'الخرخير', nameEn: 'Al Kharkhir', code: 'SA-12-007' },
        { name: 'الدغارير', nameEn: 'Ad Dagarir', code: 'SA-12-008' }
      ]},
      { name: 'منطقة الباحة', nameEn: 'Al Baha Region', cities: [
        { name: 'الباحة', nameEn: 'Al Baha', code: 'SA-13-001' },
        { name: 'بلجرشي', nameEn: 'Baljurashi', code: 'SA-13-002' },
        { name: 'المندق', nameEn: 'Al Mindak', code: 'SA-13-003' },
        { name: 'المخواة', nameEn: 'Al Makhwah', code: 'SA-13-004' },
        { name: 'قلوة', nameEn: 'Qilwah', code: 'SA-13-005' },
        { name: 'العقيق', nameEn: 'Aqiq', code: 'SA-13-006' },
        { name: 'حلباء', nameEn: 'Halaba', code: 'SA-13-007' }
      ]}
    ]
  },

  AE: {
    code: 'AE',
    name: 'الإمارات العربية المتحدة',
    nameEn: 'United Arab Emirates',
    flag: '🇦🇪',
    governorates: [
      { name: 'إمارة دبي', nameEn: 'Dubai', cities: [
        { name: 'دبي', nameEn: 'Dubai', code: 'AE-01-001' },
        { name: 'جبل علي', nameEn: 'Jebel Ali', code: 'AE-01-002' },
        { name: 'المدينة العالمية', nameEn: 'International City', code: 'AE-01-003' }
      ]},
      { name: 'إمارة أبوظبي', nameEn: 'Abu Dhabi', cities: [
        { name: 'أبوظبي', nameEn: 'Abu Dhabi', code: 'AE-02-001' },
        { name: 'العين', nameEn: 'Al Ain', code: 'AE-02-002' },
        { name: 'مدينة زايد', nameEn: 'Madinat Zayed', code: 'AE-02-003' },
        { name: 'دلما', nameEn: 'Dalma', code: 'AE-02-004' }
      ]},
      { name: 'إمارة الشارقة', nameEn: 'Sharjah', cities: [
        { name: 'الشارقة', nameEn: 'Sharjah', code: 'AE-03-001' },
        { name: 'خورفكان', nameEn: 'Khor Fakkan', code: 'AE-03-002' },
        { name: 'الذيد', nameEn: 'Dhaid', code: 'AE-03-003' },
        { name: 'كلباء', nameEn: 'Kalba', code: 'AE-03-004' }
      ]},
      { name: 'إمارة عجمان', nameEn: 'Ajman', cities: [
        { name: 'عجمان', nameEn: 'Ajman', code: 'AE-04-001' },
        { name: 'مصفوت', nameEn: 'Masfout', code: 'AE-04-002' }
      ]},
      { name: 'إمارة أم القيوين', nameEn: 'Umm Al Quwain', cities: [
        { name: 'أم القيوين', nameEn: 'Umm Al Quwain', code: 'AE-05-001' },
        { name: 'الفلج', nameEn: 'Al Falaj', code: 'AE-05-002' }
      ]},
      { name: 'إمارة رأس الخيمة', nameEn: 'Ras Al Khaimah', cities: [
        { name: 'رأس الخيمة', nameEn: 'Ras Al Khaimah', code: 'AE-06-001' },
        { name: 'الرمس', nameEn: 'Al Rams', code: 'AE-06-002' },
        { name: 'شعم', nameEn: 'Shaam', code: 'AE-06-003' }
      ]},
      { name: 'إمارة الفجيرة', nameEn: 'Fujairah', cities: [
        { name: 'الفجيرة', nameEn: 'Fujairah', code: 'AE-07-001' },
        { name: 'دبا', nameEn: 'Dibba', code: 'AE-07-002' },
        { name: 'مسافي', nameEn: 'Masafi', code: 'AE-07-003' }
      ]}
    ]
  },

  KW: {
    code: 'KW',
    name: 'الكويت',
    nameEn: 'Kuwait',
    flag: '🇰🇼',
    governorates: [
      { name: 'محافظة العاصمة', nameEn: 'Capital Governorate', cities: [
        { name: 'الكويت', nameEn: 'Kuwait City', code: 'KW-01-001' },
        { name: 'شرق', nameEn: 'Sharq', code: 'KW-01-002' },
        { name: 'المرقاب', nameEn: 'Mirqab', code: 'KW-01-003' }
      ]},
      { name: 'محافظة حولي', nameEn: 'Hawalli Governorate', cities: [
        { name: 'حولي', nameEn: 'Hawalli', code: 'KW-02-001' },
        { name: 'السالمية', nameEn: 'Salmiya', code: 'KW-02-002' },
        { name: 'الجابرية', nameEn: 'Jabriya', code: 'KW-02-003' }
      ]},
      { name: 'محافظة الفروانية', nameEn: 'Farwaniya Governorate', cities: [
        { name: 'الفروانية', nameEn: 'Farwaniya', code: 'KW-03-001' },
        { name: 'العبدلي', nameEn: 'Abdali', code: 'KW-03-002' },
        { name: 'الأندلس', nameEn: 'Andalus', code: 'KW-03-003' }
      ]},
      { name: 'محافظة مبارك الكبير', nameEn: 'Mubarak Al-Kabeer Governorate', cities: [
        { name: 'مبارك الكبير', nameEn: 'Mubarak Al-Kabeer', code: 'KW-04-001' },
        { name: 'أبو فطيرة', nameEn: 'Abu Faiterah', code: 'KW-04-002' }
      ]},
      { name: 'محافظة الأحمدي', nameEn: 'Ahmadi Governorate', cities: [
        { name: 'الأحمدي', nameEn: 'Ahmadi', code: 'KW-05-001' },
        { name: 'الفحيحيل', nameEn: 'Fahaheel', code: 'KW-05-002' },
        { name: 'ميناء الأحمدي', nameEn: 'Ahmadi Port', code: 'KW-05-003' }
      ]},
      { name: 'محافظة الجهراء', nameEn: 'Jahra Governorate', cities: [
        { name: 'الجهراء', nameEn: 'Jahra', code: 'KW-06-001' },
        { name: 'السالمي', nameEn: 'Al Salmi', code: 'KW-06-002' },
        { name: 'الواحة', nameEn: 'Al Waha', code: 'KW-06-003' }
      ]}
    ]
  },

  QA: {
    code: 'QA',
    name: 'قطر',
    nameEn: 'Qatar',
    flag: '🇶🇦',
    governorates: [
      { name: 'بلدية الدوحة', nameEn: 'Doha Municipality', cities: [
        { name: 'الدوحة', nameEn: 'Doha', code: 'QA-01-001' },
        { name: 'الريان', nameEn: 'Al Rayyan', code: 'QA-01-002' },
        { name: 'الوكرة', nameEn: 'Al Wakra', code: 'QA-01-003' }
      ]},
      { name: 'بلدية الريان', nameEn: 'Al Rayyan Municipality', cities: [
        { name: 'الشحانية', nameEn: 'Al Shahaniya', code: 'QA-02-001' },
        { name: 'روضة راشد', nameEn: 'Rawdat Rashed', code: 'QA-02-002' }
      ]},
      { name: 'بلدية أم صلال', nameEn: 'Umm Salal Municipality', cities: [
        { name: 'أم صلال', nameEn: 'Umm Salal', code: 'QA-03-001' },
        { name: 'الخريطيات', nameEn: 'Al Kharaitiyat', code: 'QA-03-002' }
      ]},
      { name: 'بلدية الخور والذخيرة', nameEn: 'Al Khor and Al Thakhira Municipality', cities: [
        { name: 'الخور', nameEn: 'Al Khor', code: 'QA-04-001' },
        { name: 'الذخيرة', nameEn: 'Al Thakhira', code: 'QA-04-002' }
      ]},
      { name: 'بلدية الوكرة', nameEn: 'Al Wakrah Municipality', cities: [
        { name: 'مسيعيد', nameEn: 'Mesaieed', code: 'QA-05-001' },
        { name: 'الوكرة', nameEn: 'Al Wakrah', code: 'QA-05-002' }
      ]},
      { name: 'بلدية الضعاين', nameEn: 'Al Daayen Municipality', cities: [
        { name: 'لوسيل', nameEn: 'Lusail', code: 'QA-06-001' },
        { name: 'الضعاين', nameEn: 'Al Daayen', code: 'QA-06-002' }
      ]},
      { name: 'بلدية الشمال', nameEn: 'Al Shamal Municipality', cities: [
        { name: 'الشمال', nameEn: 'Al Shamal', code: 'QA-07-001' },
        { name: 'أبو الظلوف', nameEn: 'Abu Dhalouf', code: 'QA-07-002' }
      ]},
      { name: 'بلدية الشحانية', nameEn: 'Al Shahaniya Municipality', cities: [
        { name: 'الشحانية', nameEn: 'Al Shahaniya', code: 'QA-08-001' },
        { name: 'أم باب', nameEn: 'Umm Bab', code: 'QA-08-002' }
      ]}
    ]
  },

  BH: {
    code: 'BH',
    name: 'البحرين',
    nameEn: 'Bahrain',
    flag: '🇧🇭',
    governorates: [
      { name: 'محافظة العاصمة', nameEn: 'Capital Governorate', cities: [
        { name: 'المنامة', nameEn: 'Manama', code: 'BH-01-001' },
        { name: 'جفير', nameEn: 'Juffair', code: 'BH-01-002' }
      ]},
      { name: 'محافظة المحرق', nameEn: 'Muharraq Governorate', cities: [
        { name: 'المحرق', nameEn: 'Muharraq', code: 'BH-02-001' },
        { name: 'الحد', nameEn: 'Al Hidd', code: 'BH-02-002' },
        { name: 'عراد', nameEn: 'Arad', code: 'BH-02-003' }
      ]},
      { name: 'المحافظة الشمالية', nameEn: 'Northern Governorate', cities: [
        { name: 'البديع', nameEn: 'Al Budaiya', code: 'BH-03-001' },
        { name: 'جزر أمواج', nameEn: 'Amwaj Islands', code: 'BH-03-002' },
        { name: 'مدينة حمد', nameEn: 'Hamad Town', code: 'BH-03-003' }
      ]},
      { name: 'المحافظة الجنوبية', nameEn: 'Southern Governorate', cities: [
        { name: 'رفاع', nameEn: 'Riffa', code: 'BH-04-001' },
        { name: 'عيسى', nameEn: 'Isa Town', code: 'BH-04-002' },
        { name: 'الزَّلاق', nameEn: 'Zallaq', code: 'BH-04-003' }
      ]}
    ]
  },

  OM: {
    code: 'OM',
    name: 'عمان',
    nameEn: 'Oman',
    flag: '🇴🇲',
    governorates: [
      { name: 'محافظة مسقط', nameEn: 'Muscat Governorate', cities: [
        { name: 'مسقط', nameEn: 'Muscat', code: 'OM-01-001' },
        { name: 'بوشر', nameEn: 'Bawshar', code: 'OM-01-002' },
        { name: 'السيب', nameEn: 'Al Seeb', code: 'OM-01-003' },
        { name: 'قريات', nameEn: 'Qurayyat', code: 'OM-01-004' },
        { name: 'المعبيلة', nameEn: 'Maabilah', code: 'OM-01-005' }
      ]},
      { name: 'محافظة الباطنة', nameEn: 'Al Batinah Governorate', cities: [
        { name: 'صحار', nameEn: 'Sohar', code: 'OM-02-001' },
        { name: 'عبري', nameEn: 'Ibri', code: 'OM-02-002' },
        { name: 'الخابورة', nameEn: 'Al Khabourah', code: 'OM-02-003' },
        { name: 'السويق', nameEn: 'Al Suwaiq', code: 'OM-02-004' },
        { name: 'شناص', nameEn: 'Shinas', code: 'OM-02-005' },
        { name: 'لوى', nameEn: 'Liwa', code: 'OM-02-006' },
        { name: 'صحم', nameEn: 'Saham', code: 'OM-02-007' }
      ]},
      { name: 'محافظة الداخلية', nameEn: 'Ad Dakhiliyah Governorate', cities: [
        { name: 'نزوى', nameEn: 'Nizwa', code: 'OM-03-001' },
        { name: 'سمائل', nameEn: 'Samail', code: 'OM-03-002' },
        { name: 'بهلا', nameEn: 'Bahla', code: 'OM-03-003' },
        { name: 'الحمراء', nameEn: 'Al Hamra', code: 'OM-03-004' }
      ]},
      { name: 'محافظة الظاهرة', nameEn: 'Ad Dhahirah Governorate', cities: [
        { name: 'عبري', nameEn: 'Ibri', code: 'OM-04-001' },
        { name: 'ينقل', nameEn: 'Yanqul', code: 'OM-04-002' },
        { name: 'ضنك', nameEn: 'Dank', code: 'OM-04-003' }
      ]},
      { name: 'محافظة البريمي', nameEn: 'Al Buraimi Governorate', cities: [
        { name: 'البريمي', nameEn: 'Al Buraimi', code: 'OM-05-001' },
        { name: 'محضة', nameEn: 'Mahdah', code: 'OM-05-002' }
      ]},
      { name: 'محافظة الوسطى', nameEn: 'Al Wusta Governorate', cities: [
        { name: 'هيما', nameEn: 'Haima', code: 'OM-06-001' },
        { name: 'الدقم', nameEn: 'Duqm', code: 'OM-06-002' },
        { name: 'محوت', nameEn: 'Mahoot', code: 'OM-06-003' }
      ]},
      { name: 'محافظة الشرقية', nameEn: 'Ash Sharqiyah Governorate', cities: [
        { name: 'صور', nameEn: 'Sur', code: 'OM-07-001' },
        { name: 'إبراء', nameEn: 'Ibra', code: 'OM-07-002' },
        { name: 'المصنعة', nameEn: 'Al Masnaah', code: 'OM-07-003' },
        { name: 'بدية', nameEn: 'Bidiya', code: 'OM-07-004' },
        { name: 'جعلان', nameEn: 'Jalan', code: 'OM-07-005' }
      ]},
      { name: 'محافظة ظفار', nameEn: 'Dhofar Governorate', cities: [
        { name: 'صلالة', nameEn: 'Salalah', code: 'OM-08-001' },
        { name: 'مرباط', nameEn: 'Mirbat', code: 'OM-08-002' },
        { name: 'ثمريت', nameEn: 'Thumrait', code: 'OM-08-003' },
        { name: 'سدح', nameEn: 'Sadah', code: 'OM-08-004' }
      ]},
      { name: 'محافظة مسندم', nameEn: 'Musandam Governorate', cities: [
        { name: 'خصب', nameEn: 'Khasab', code: 'OM-09-001' },
        { name: 'بخا', nameEn: 'Bukha', code: 'OM-09-002' },
        { name: 'دبا', nameEn: 'Dibba', code: 'OM-09-003' }
      ]},
      { name: 'محافظة شمال الباطنة', nameEn: 'Al Batinah North Governorate', cities: [
        { name: 'صحار', nameEn: 'Sohar', code: 'OM-10-001' },
        { name: 'شناص', nameEn: 'Shinas', code: 'OM-10-002' },
        { name: 'لوى', nameEn: 'Liwa', code: 'OM-10-003' },
        { name: 'صحم', nameEn: 'Saham', code: 'OM-10-004' }
      ]},
      { name: 'محافظة جنوب الباطنة', nameEn: 'Al Batinah South Governorate', cities: [
        { name: 'الرستاق', nameEn: 'Rustaq', code: 'OM-11-001' },
        { name: 'العوابي', nameEn: 'Al Awabi', code: 'OM-11-002' },
        { name: 'وادي المعاول', nameEn: 'Wadi Al Maawil', code: 'OM-11-003' }
      ]},
      { name: 'محافظة شمال الشرقية', nameEn: 'Ash Sharqiyah North Governorate', cities: [
        { name: 'إبراء', nameEn: 'Ibra', code: 'OM-12-001' },
        { name: 'المصنعة', nameEn: 'Al Masnaah', code: 'OM-12-002' },
        { name: 'بدية', nameEn: 'Bidiya', code: 'OM-12-003' }
      ]},
      { name: 'محافظة جنوب الشرقية', nameEn: 'Ash Sharqiyah South Governorate', cities: [
        { name: 'صور', nameEn: 'Sur', code: 'OM-13-001' },
        { name: 'جعلان بني بوعلي', nameEn: 'Jalan Bani Bu Ali', code: 'OM-13-002' }
      ]},
      { name: 'محافظة الوسطى', nameEn: 'Al Wusta Governorate', cities: [
        { name: 'هيما', nameEn: 'Haima', code: 'OM-14-001' }
      ]}
    ]
  },

  EG: {
    code: 'EG',
    name: 'مصر',
    nameEn: 'Egypt',
    flag: '🇪🇬',
    governorates: [
      { name: 'القاهرة', nameEn: 'Cairo', cities: [
        { name: 'القاهرة', nameEn: 'Cairo', code: 'EG-01-001' },
        { name: 'القاهرة الجديدة', nameEn: 'New Cairo', code: 'EG-01-002' },
        { name: 'شبرا', nameEn: 'Shubra', code: 'EG-01-003' },
        { name: 'مدينة نصر', nameEn: 'Nasr City', code: 'EG-01-004' },
        { name: 'المعادي', nameEn: 'Maadi', code: 'EG-01-005' },
        { name: 'الزمالك', nameEn: 'Zamalek', code: 'EG-01-006' },
        { name: 'مصر الجديدة', nameEn: 'Heliopolis', code: 'EG-01-007' }
      ]},
      { name: 'الإسكندرية', nameEn: 'Alexandria', cities: [
        { name: 'الإسكندرية', nameEn: 'Alexandria', code: 'EG-02-001' },
        { name: 'برج العرب', nameEn: 'Borg El Arab', code: 'EG-02-002' },
        { name: 'المنتزه', nameEn: 'Montaza', code: 'EG-02-003' }
      ]},
      { name: 'الجيزة', nameEn: 'Giza', cities: [
        { name: 'الجيزة', nameEn: 'Giza', code: 'EG-03-001' },
        { name: '6 أكتوبر', nameEn: '6th of October', code: 'EG-03-002' },
        { name: 'الشيخ زايد', nameEn: 'Sheikh Zayed', code: 'EG-03-003' },
        { name: 'الحوامدية', nameEn: 'Hawamdiya', code: 'EG-03-004' },
        { name: 'أوسيم', nameEn: 'Awsim', code: 'EG-03-005' }
      ]},
      { name: 'القليوبية', nameEn: 'Qalyubia', cities: [
        { name: 'بنها', nameEn: 'Banha', code: 'EG-04-001' },
        { name: 'الخانكة', nameEn: 'Al Khanka', code: 'EG-04-002' },
        { name: 'شبرا الخيمة', nameEn: 'Shubra El Kheima', code: 'EG-04-003' },
        { name: 'القناطر الخيرية', nameEn: 'Qanater El Khayreya', code: 'EG-04-004' }
      ]},
      { name: 'المنوفية', nameEn: 'Monufia', cities: [
        { name: 'شبين الكوم', nameEn: 'Shebin El Kom', code: 'EG-05-001' },
        { name: 'منوف', nameEn: 'Menouf', code: 'EG-05-002' },
        { name: 'الباجور', nameEn: 'Al Bagour', code: 'EG-05-003' },
        { name: 'قويسنا', nameEn: 'Quesna', code: 'EG-05-004' }
      ]},
      { name: 'الغربية', nameEn: 'Gharbia', cities: [
        { name: 'طنطا', nameEn: 'Tanta', code: 'EG-06-001' },
        { name: 'المحلة الكبرى', nameEn: 'El Mahalla', code: 'EG-06-002' },
        { name: 'كفر الزيات', nameEn: 'Kafr El Zayat', code: 'EG-06-003' },
        { name: 'زفتى', nameEn: 'Zifta', code: 'EG-06-004' },
        { name: 'سمنود', nameEn: 'Samannoud', code: 'EG-06-005' }
      ]},
      { name: 'الدقهلية', nameEn: 'Dakahlia', cities: [
        { name: 'المنصورة', nameEn: 'Mansoura', code: 'EG-07-001' },
        { name: 'ميت غمر', nameEn: 'Mit Ghamr', code: 'EG-07-002' },
        { name: 'طلخا', nameEn: 'Talkha', code: 'EG-07-003' },
        { name: 'أجا', nameEn: 'Aga', code: 'EG-07-004' },
        { name: 'منية النصر', nameEn: 'Minyet El Nasr', code: 'EG-07-005' }
      ]},
      { name: 'الشرقية', nameEn: 'Sharqia', cities: [
        { name: 'الزقازيق', nameEn: 'Zagazig', code: 'EG-08-001' },
        { name: 'العاشر من رمضان', nameEn: '10th of Ramadan', code: 'EG-08-002' },
        { name: 'بلبيس', nameEn: 'Belbeis', code: 'EG-08-003' },
        { name: 'منيا القمح', nameEn: 'Minya El Qamh', code: 'EG-08-004' },
        { name: 'فاقوس', nameEn: 'Faqous', code: 'EG-08-005' }
      ]},
      { name: 'كفر الشيخ', nameEn: 'Kafr El Sheikh', cities: [
        { name: 'كفر الشيخ', nameEn: 'Kafr El Sheikh', code: 'EG-09-001' },
        { name: 'دسوق', nameEn: 'Desouk', code: 'EG-09-002' },
        { name: 'فوة', nameEn: 'Fouah', code: 'EG-09-003' },
        { name: 'البرلس', nameEn: 'Baltim', code: 'EG-09-004' }
      ]},
      { name: 'البحيرة', nameEn: 'Beheira', cities: [
        { name: 'دمنهور', nameEn: 'Damanhour', code: 'EG-10-001' },
        { name: 'كفر الدوار', nameEn: 'Kafr El Dawwar', code: 'EG-10-002' },
        { name: 'رشيد', nameEn: 'Rashid', code: 'EG-10-003' },
        { name: 'إدكو', nameEn: 'Edku', code: 'EG-10-004' },
        { name: 'أبو حمص', nameEn: 'Abu Hummus', code: 'EG-10-005' }
      ]},
      { name: 'دمياط', nameEn: 'Damietta', cities: [
        { name: 'دمياط', nameEn: 'Damietta', code: 'EG-11-001' },
        { name: 'رأس البر', nameEn: 'Ras El Bar', code: 'EG-11-002' },
        { name: 'فارسكور', nameEn: 'Faraskour', code: 'EG-11-003' }
      ]},
      { name: 'بورسعيد', nameEn: 'Port Said', cities: [
        { name: 'بورسعيد', nameEn: 'Port Said', code: 'EG-12-001' },
        { name: 'بورفؤاد', nameEn: 'Port Fouad', code: 'EG-12-002' }
      ]},
      { name: 'الإسماعيلية', nameEn: 'Ismailia', cities: [
        { name: 'الإسماعيلية', nameEn: 'Ismailia', code: 'EG-13-001' },
        { name: 'فايد', nameEn: 'Fayed', code: 'EG-13-002' },
        { name: 'القنطرة شرق', nameEn: 'East Qantara', code: 'EG-13-003' }
      ]},
      { name: 'السويس', nameEn: 'Suez', cities: [
        { name: 'السويس', nameEn: 'Suez', code: 'EG-14-001' },
        { name: 'الأربعين', nameEn: 'Arbaeen', code: 'EG-14-002' }
      ]},
      { name: 'شمال سيناء', nameEn: 'North Sinai', cities: [
        { name: 'العريش', nameEn: 'Arish', code: 'EG-15-001' },
        { name: 'الشيخ زويد', nameEn: 'Sheikh Zuweid', code: 'EG-15-002' },
        { name: 'رفح', nameEn: 'Rafah', code: 'EG-15-003' }
      ]},
      { name: 'جنوب سيناء', nameEn: 'South Sinai', cities: [
        { name: 'شرم الشيخ', nameEn: 'Sharm El Sheikh', code: 'EG-16-001' },
        { name: 'الغردقة', nameEn: 'Hurghada', code: 'EG-16-002' },
        { name: 'دهب', nameEn: 'Dahab', code: 'EG-16-003' },
        { name: 'طابا', nameEn: 'Taba', code: 'EG-16-004' }
      ]},
      { name: 'البحر الأحمر', nameEn: 'Red Sea', cities: [
        { name: 'الغردقة', nameEn: 'Hurghada', code: 'EG-17-001' },
        { name: 'سفاجا', nameEn: 'Safaga', code: 'EG-17-002' },
        { name: 'القصير', nameEn: 'Al Qusair', code: 'EG-17-003' },
        { name: 'مرسى علم', nameEn: 'Marsa Alam', code: 'EG-17-004' }
      ]},
      { name: 'الفيوم', nameEn: 'Faiyum', cities: [
        { name: 'الفيوم', nameEn: 'Faiyum', code: 'EG-18-001' },
        { name: 'سنورس', nameEn: 'Senuris', code: 'EG-18-002' },
        { name: 'إطسا', nameEn: 'Ibsheway', code: 'EG-18-003' }
      ]},
      { name: 'بني سويف', nameEn: 'Beni Suef', cities: [
        { name: 'بني سويف', nameEn: 'Beni Suef', code: 'EG-19-001' },
        { name: 'الواسطى', nameEn: 'Al Wasta', code: 'EG-19-002' },
        { name: 'ناصر', nameEn: 'Nasser', code: 'EG-19-003' }
      ]},
      { name: 'المنيا', nameEn: 'Minya', cities: [
        { name: 'المنيا', nameEn: 'Minya', code: 'EG-20-001' },
        { name: 'ملوي', nameEn: 'Mallawi', code: 'EG-20-002' },
        { name: 'سمالوط', nameEn: 'Samalut', code: 'EG-20-003' },
        { name: 'العدوة', nameEn: 'Adwa', code: 'EG-20-004' }
      ]},
      { name: 'أسيوط', nameEn: 'Assiut', cities: [
        { name: 'أسيوط', nameEn: 'Assiut', code: 'EG-21-001' },
        { name: 'ديروط', nameEn: 'Dairut', code: 'EG-21-002' },
        { name: 'منفلوط', nameEn: 'Manfalut', code: 'EG-21-003' },
        { name: 'القوصية', nameEn: 'Al Qusiya', code: 'EG-21-004' }
      ]},
      { name: 'سوهاج', nameEn: 'Sohag', cities: [
        { name: 'سوهاج', nameEn: 'Sohag', code: 'EG-22-001' },
        { name: 'أخميم', nameEn: 'Akhmim', code: 'EG-22-002' },
        { name: 'طهطا', nameEn: 'Tahta', code: 'EG-22-003' },
        { name: 'جرجا', nameEn: 'Girga', code: 'EG-22-004' }
      ]},
      { name: 'قنا', nameEn: 'Qena', cities: [
        { name: 'قنا', nameEn: 'Qena', code: 'EG-23-001' },
        { name: 'نجع حمادي', nameEn: 'Nag Hammadi', code: 'EG-23-002' },
        { name: 'قوص', nameEn: 'Qus', code: 'EG-23-003' }
      ]},
      { name: 'الأقصر', nameEn: 'Luxor', cities: [
        { name: 'الأقصر', nameEn: 'Luxor', code: 'EG-24-001' },
        { name: 'إسنا', nameEn: 'Esna', code: 'EG-24-002' },
        { name: 'أرمنت', nameEn: 'Armant', code: 'EG-24-003' }
      ]},
      { name: 'أسوان', nameEn: 'Aswan', cities: [
        { name: 'أسوان', nameEn: 'Aswan', code: 'EG-25-001' },
        { name: 'إدفو', nameEn: 'Edfu', code: 'EG-25-002' },
        { name: 'كوم أمبو', nameEn: 'Kom Ombo', code: 'EG-25-003' },
        { name: 'أبو سمبل', nameEn: 'Abu Simbel', code: 'EG-25-004' }
      ]},
      { name: 'الوادي الجديد', nameEn: 'New Valley', cities: [
        { name: 'الخارجة', nameEn: 'Kharga', code: 'EG-26-001' },
        { name: 'باريس', nameEn: 'Paris', code: 'EG-26-002' },
        { name: 'الداخلة', nameEn: 'Dakhla', code: 'EG-26-003' }
      ]},
      { name: 'مطروح', nameEn: 'Matrouh', cities: [
        { name: 'مرسى مطروح', nameEn: 'Marsa Matrouh', code: 'EG-27-001' },
        { name: 'السلوم', nameEn: 'Sallum', code: 'EG-27-002' },
        { name: 'سيوة', nameEn: 'Siwa', code: 'EG-27-003' }
      ]}
    ]
  },

  JO: {
    code: 'JO',
    name: 'الأردن',
    nameEn: 'Jordan',
    flag: '🇯🇴',
    governorates: [
      { name: 'محافظة العاصمة', nameEn: 'Amman Governorate', cities: [
        { name: 'عمّان', nameEn: 'Amman', code: 'JO-01-001' },
        { name: 'الزرقاء', nameEn: 'Zarqa', code: 'JO-01-002' },
        { name: 'القويسمة', nameEn: 'Al Quwaysimah', code: 'JO-01-003' },
        { name: 'وادي السير', nameEn: 'Wadi Al Seer', code: 'JO-01-004' },
        { name: 'صويلح', nameEn: 'Sweileh', code: 'JO-01-005' }
      ]},
      { name: 'محافظة الزرقاء', nameEn: 'Zarqa Governorate', cities: [
        { name: 'الزرقاء', nameEn: 'Zarqa', code: 'JO-02-001' },
        { name: 'الرصيفة', nameEn: 'Russeifa', code: 'JO-02-002' },
        { name: 'الهاشمية', nameEn: 'Al Hashemiyah', code: 'JO-02-003' }
      ]},
      { name: 'محافظة إربد', nameEn: 'Irbid Governorate', cities: [
        { name: 'إربد', nameEn: 'Irbid', code: 'JO-03-001' },
        { name: 'الرمثا', nameEn: 'Ramtha', code: 'JO-03-002' },
        { name: 'الحصن', nameEn: 'Al Husn', code: 'JO-03-003' },
        { name: 'بني كنانة', nameEn: 'Bani Kinanah', code: 'JO-03-004' }
      ]},
      { name: 'محافظة المفرق', nameEn: 'Mafraq Governorate', cities: [
        { name: 'المفرق', nameEn: 'Mafraq', code: 'JO-04-001' },
        { name: 'الرويشد', nameEn: 'Ruwaished', code: 'JO-04-002' }
      ]},
      { name: 'محافظة عجلون', nameEn: 'Ajloun Governorate', cities: [
        { name: 'عجلون', nameEn: 'Ajloun', code: 'JO-05-001' },
        { name: 'كفرنجة', nameEn: 'Kefrenka', code: 'JO-05-002' }
      ]},
      { name: 'محافظة جرش', nameEn: 'Jerash Governorate', cities: [
        { name: 'جرش', nameEn: 'Jerash', code: 'JO-06-001' },
        { name: 'سوف', nameEn: 'Sof', code: 'JO-06-002' }
      ]},
      { name: 'محافظة البلقاء', nameEn: 'Balqa Governorate', cities: [
        { name: 'السلط', nameEn: 'Salt', code: 'JO-07-001' },
        { name: 'الفحيص', nameEn: 'Fuheis', code: 'JO-07-002' },
        { name: 'دير علا', nameEn: 'Deir Alla', code: 'JO-07-003' }
      ]},
      { name: 'محافظة مأدبا', nameEn: 'Madaba Governorate', cities: [
        { name: 'مأدبا', nameEn: 'Madaba', code: 'JO-08-001' },
        { name: 'ذيبان', nameEn: 'Dhiban', code: 'JO-08-002' }
      ]},
      { name: 'محافظة الكرك', nameEn: 'Karak Governorate', cities: [
        { name: 'الكرك', nameEn: 'Karak', code: 'JO-09-001' },
        { name: 'الفحيص', nameEn: 'Al Fuhays', code: 'JO-09-002' },
        { name: 'المزار الجنوبي', nameEn: 'Al Mazar', code: 'JO-09-003' }
      ]},
      { name: 'محافظة الطفيلة', nameEn: 'Tafilah Governorate', cities: [
        { name: 'الطفيلة', nameEn: 'Tafilah', code: 'JO-10-001' },
        { name: 'بصيرا', nameEn: 'Busayra', code: 'JO-10-002' }
      ]},
      { name: 'محافظة معان', nameEn: 'Ma\'an Governorate', cities: [
        { name: 'معان', nameEn: 'Ma\'an', code: 'JO-11-001' },
        { name: 'الطيبة', nameEn: 'At Tafilah', code: 'JO-11-002' },
        { name: 'البيضاء', nameEn: 'Al Bayda', code: 'JO-11-003' }
      ]},
      { name: 'محافظة العقبة', nameEn: 'Aqaba Governorate', cities: [
        { name: 'العقبة', nameEn: 'Aqaba', code: 'JO-12-001' },
        { name: 'وادي رم', nameEn: 'Wadi Rum', code: 'JO-12-002' }
      ]}
    ]
  },

  IQ: {
    code: 'IQ',
    name: 'العراق',
    nameEn: 'Iraq',
    flag: '🇮🇶',
    governorates: [
      { name: 'محافظة بغداد', nameEn: 'Baghdad Governorate', cities: [
        { name: 'بغداد', nameEn: 'Baghdad', code: 'IQ-01-001' },
        { name: 'الصدر', nameEn: 'Sadr City', code: 'IQ-01-002' },
        { name: 'المنصور', nameEn: 'Mansour', code: 'IQ-01-003' },
        { name: 'الكرخ', nameEn: 'Karkh', code: 'IQ-01-004' },
        { name: 'الرصافة', nameEn: 'Rusafa', code: 'IQ-01-005' }
      ]},
      { name: 'محافظة البصرة', nameEn: 'Basra Governorate', cities: [
        { name: 'البصرة', nameEn: 'Basra', code: 'IQ-02-001' },
        { name: 'أم قصر', nameEn: 'Umm Qasr', code: 'IQ-02-002' },
        { name: 'الزبير', nameEn: 'Az Zubayr', code: 'IQ-02-003' },
        { name: 'القرنة', nameEn: 'Al Qurnah', code: 'IQ-02-004' }
      ]},
      { name: 'محافظة نينوى', nameEn: 'Nineveh Governorate', cities: [
        { name: 'الموصل', nameEn: 'Mosul', code: 'IQ-03-001' },
        { name: 'تلعفر', nameEn: 'Tal Afar', code: 'IQ-03-002' },
        { name: 'سنجار', nameEn: 'Sinjar', code: 'IQ-03-003' }
      ]},
      { name: 'محافظة أربيل', nameEn: 'Erbil Governorate', cities: [
        { name: 'أربيل', nameEn: 'Erbil', code: 'IQ-04-001' },
        { name: ' Shaqlawa', nameEn: 'Shaqlawa', code: 'IQ-04-002' },
        { name: 'سوران', nameEn: 'Soran', code: 'IQ-04-003' }
      ]},
      { name: 'محافظة السليمانية', nameEn: 'Sulaymaniyah Governorate', cities: [
        { name: 'السليمانية', nameEn: 'Sulaymaniyah', code: 'IQ-05-001' },
        { name: 'حلبجة', nameEn: 'Halabja', code: 'IQ-05-002' },
        { name: 'رانية', nameEn: 'Ranya', code: 'IQ-05-003' }
      ]},
      { name: 'محافظة دهوك', nameEn: 'Duhok Governorate', cities: [
        { name: 'دهوك', nameEn: 'Duhok', code: 'IQ-06-001' },
        { name: 'زاخو', nameEn: 'Zakho', code: 'IQ-06-002' },
        { name: 'أمدي', nameEn: 'Amedi', code: 'IQ-06-003' }
      ]},
      { name: 'محافظة كركوك', nameEn: 'Kirkuk Governorate', cities: [
        { name: 'كركوك', nameEn: 'Kirkuk', code: 'IQ-07-001' },
        { name: 'داقوق', nameEn: 'Daquq', code: 'IQ-07-002' }
      ]},
      { name: 'محافظة الأنبار', nameEn: 'Anbar Governorate', cities: [
        { name: 'الرمادي', nameEn: 'Ramadi', code: 'IQ-08-001' },
        { name: 'الفلوجة', nameEn: 'Fallujah', code: 'IQ-08-002' },
        { name: 'هيت', nameEn: 'Hit', code: 'IQ-08-003' },
        { name: 'حديثة', nameEn: 'Haditha', code: 'IQ-08-004' }
      ]},
      { name: 'محافظة ديالى', nameEn: 'Diyala Governorate', cities: [
        { name: 'بعقوبة', nameEn: 'Baqubah', code: 'IQ-09-001' },
        { name: 'المقدادية', nameEn: 'Al Muqdadiyah', code: 'IQ-09-002' }
      ]},
      { name: 'محافظة صلاح الدين', nameEn: 'Saladin Governorate', cities: [
        { name: 'تكريت', nameEn: 'Tikrit', code: 'IQ-10-001' },
        { name: 'سامراء', nameEn: 'Samarra', code: 'IQ-10-002' },
        { name: 'بلد', nameEn: 'Balad', code: 'IQ-10-003' }
      ]},
      { name: 'محافظة بابل', nameEn: 'Babil Governorate', cities: [
        { name: 'الحلة', nameEn: 'Hillah', code: 'IQ-11-001' },
        { name: 'المسيب', nameEn: 'Al Musayyib', code: 'IQ-11-002' },
        { name: 'الإسكندرية', nameEn: 'Alexandria', code: 'IQ-11-003' }
      ]},
      { name: 'محافظة كربلاء', nameEn: 'Karbala Governorate', cities: [
        { name: 'كربلاء', nameEn: 'Karbala', code: 'IQ-12-001' },
        { name: 'الهندية', nameEn: 'Al Hindiyah', code: 'IQ-12-002' }
      ]},
      { name: 'محافظة النجف', nameEn: 'Najaf Governorate', cities: [
        { name: 'النجف', nameEn: 'Najaf', code: 'IQ-13-001' },
        { name: 'الكوفة', nameEn: 'Kufa', code: 'IQ-13-002' }
      ]},
      { name: 'محافظة واسط', nameEn: 'Wasit Governorate', cities: [
        { name: 'الكوت', nameEn: 'Kut', code: 'IQ-14-001' },
        { name: 'الحي', nameEn: 'Al Hayy', code: 'IQ-14-002' }
      ]},
      { name: 'محافظة ميسان', nameEn: 'Maysan Governorate', cities: [
        { name: 'العمارة', nameEn: 'Amarah', code: 'IQ-15-001' },
        { name: 'الميمونة', nameEn: 'Al Mejar Al Kabi', code: 'IQ-15-002' }
      ]},
      { name: 'محافظة ذي قار', nameEn: 'Dhi Qar Governorate', cities: [
        { name: 'الناصرية', nameEn: 'Nasiriyah', code: 'IQ-16-001' },
        { name: 'سوق الشيوخ', nameEn: 'Suq Al Shoyokh', code: 'IQ-16-002' }
      ]},
      { name: 'محافظة مثنى', nameEn: 'Muthanna Governorate', cities: [
        { name: 'السماوة', nameEn: 'Samawah', code: 'IQ-17-001' },
        { name: 'الرميثة', nameEn: 'Al Rumaythah', code: 'IQ-17-002' }
      ]},
      { name: 'محافظة قادسية', nameEn: 'Qadisiyyah Governorate', cities: [
        { name: 'الديوانية', nameEn: 'Diwaniyah', code: 'IQ-18-001' },
        { name: 'عفك', nameEn: 'Afak', code: 'IQ-18-002' }
      ]},
      { name: 'محافظة النجف الأشرف', nameEn: 'Najaf Governorate', cities: [
        { name: 'النجف الأشرف', nameEn: 'Najaf', code: 'IQ-19-001' },
        { name: 'الكوفة', nameEn: 'Kufa', code: 'IQ-19-002' }
      ]}
    ]
  },

  LB: {
    code: 'LB',
    name: 'لبنان',
    nameEn: 'Lebanon',
    flag: '🇱🇧',
    governorates: [
      { name: 'محافظة بيروت', nameEn: 'Beirut Governorate', cities: [
        { name: 'بيروت', nameEn: 'Beirut', code: 'LB-01-001' },
        { name: 'الأشرفية', nameEn: 'Achrafieh', code: 'LB-01-002' },
        { name: 'الرملة البيضاء', nameEn: 'Ramlat al-Bayda', code: 'LB-01-003' }
      ]},
      { name: 'محافظة جبل لبنان', nameEn: 'Mount Lebanon Governorate', cities: [
        { name: 'جونية', nameEn: 'Jounieh', code: 'LB-02-001' },
        { name: 'زحلة', nameEn: 'Zahle', code: 'LB-02-002' },
        { name: 'بعبدا', nameEn: 'Baabda', code: 'LB-02-003' },
        { name: 'الشوف', nameEn: 'Chouf', code: 'LB-02-004' },
        { name: 'المتن', nameEn: 'Metn', code: 'LB-02-005' },
        { name: 'كسروان', nameEn: 'Keserwan', code: 'LB-02-006' }
      ]},
      { name: 'محافظة الشمال', nameEn: 'North Governorate', cities: [
        { name: 'طرابلس', nameEn: 'Tripoli', code: 'LB-03-001' },
        { name: 'المنية', nameEn: 'Al Minya', code: 'LB-03-002' },
        { name: 'زغرتا', nameEn: 'Zgharta', code: 'LB-03-003' },
        { name: 'الدريب', nameEn: 'Al Dreib', code: 'LB-03-004' }
      ]},
      { name: 'محافظة الجنوب', nameEn: 'South Governorate', cities: [
        { name: 'صيدا', nameEn: 'Sidon', code: 'LB-04-001' },
        { name: 'صور', nameEn: 'Tyre', code: 'LB-04-002' },
        { name: 'الناقورة', nameEn: 'Naqoura', code: 'LB-04-003' }
      ]},
      { name: 'محافظة البقاع', nameEn: 'Bekaa Governorate', cities: [
        { name: 'زحلة', nameEn: 'Zahle', code: 'LB-05-001' },
        { name: 'علي النهري', nameEn: 'Ali En Nahri', code: 'LB-05-002' },
        { name: 'راشيا', nameEn: 'Rashaya', code: 'LB-05-003' }
      ]},
      { name: 'محافظة النبطية', nameEn: 'Nabatieh Governorate', cities: [
        { name: 'النبطية', nameEn: 'Nabatieh', code: 'LB-06-001' },
        { name: 'بنت جبيل', nameEn: 'Bint Jbeil', code: 'LB-06-002' },
        { name: 'ميس الجبل', nameEn: 'Marjayoun', code: 'LB-06-003' }
      ]},
      { name: 'محافظة عكار', nameEn: 'Akkar Governorate', cities: [
        { name: 'حلبا', nameEn: 'Halba', code: 'LB-07-001' },
        { name: 'العبدة', nameEn: 'Abdeh', code: 'LB-07-002' }
      ]},
      { name: 'محافظة بعلبك الهرمل', nameEn: 'Baalbek-Hermel Governorate', cities: [
        { name: 'بعلبك', nameEn: 'Baalbek', code: 'LB-08-001' },
        { name: 'الهرمل', nameEn: 'Hermel', code: 'LB-08-002' }
      ]}
    ]
  },

  SY: {
    code: 'SY',
    name: 'سوريا',
    nameEn: 'Syria',
    flag: '🇸🇾',
    governorates: [
      { name: 'محافظة دمشق', nameEn: 'Damascus Governorate', cities: [
        { name: 'دمشق', nameEn: 'Damascus', code: 'SY-01-001' },
        { name: 'العزازي', nameEn: 'Azzaz', code: 'SY-01-002' }
      ]},
      { name: 'محافظة ريف دمشق', nameEn: 'Rif Dimashq Governorate', cities: [
        { name: 'الغوطة', nameEn: 'Ghouta', code: 'SY-02-001' },
        { name: 'دوما', nameEn: 'Douma', code: 'SY-02-002' },
        { name: 'التل', nameEn: 'Al Tal', code: 'SY-02-003' },
        { name: 'النبك', nameEn: 'An Nabk', code: 'SY-02-004' },
        { name: 'قطنا', nameEn: 'Qatana', code: 'SY-02-005' }
      ]},
      { name: 'محافظة حلب', nameEn: 'Aleppo Governorate', cities: [
        { name: 'حلب', nameEn: 'Aleppo', code: 'SY-03-001' },
        { name: 'منبج', nameEn: 'Manbij', code: 'SY-03-002' },
        { name: 'السفيرة', nameEn: 'As Safira', code: 'SY-03-003' },
        { name: 'عين العرب', nameEn: 'Kobani', code: 'SY-03-004' }
      ]},
      { name: 'محافظة حمص', nameEn: 'Homs Governorate', cities: [
        { name: 'حمص', nameEn: 'Homs', code: 'SY-04-001' },
        { name: 'تدمر', nameEn: 'Palmyra', code: 'SY-04-002' },
        { name: 'الرستن', nameEn: 'Ar Rastan', code: 'SY-04-003' }
      ]},
      { name: 'محافظة حماة', nameEn: 'Hama Governorate', cities: [
        { name: 'حماة', nameEn: 'Hama', code: 'SY-05-001' },
        { name: 'سلمية', nameEn: 'Salamiyah', code: 'SY-05-002' },
        { name: 'مهردة', nameEn: 'Mhardeh', code: 'SY-05-003' }
      ]},
      { name: 'محافظة اللاذقية', nameEn: 'Latakia Governorate', cities: [
        { name: 'اللاذقية', nameEn: 'Latakia', code: 'SY-06-001' },
        { name: 'جبلة', nameEn: 'Jableh', code: 'SY-06-002' },
        { name: 'الحفة', nameEn: 'Al Haffah', code: 'SY-06-003' }
      ]},
      { name: 'محافظة طرطوس', nameEn: 'Tartus Governorate', cities: [
        { name: 'طرطوس', nameEn: 'Tartus', code: 'SY-07-001' },
        { name: 'بانياس', nameEn: 'Baniyas', code: 'SY-07-002' },
        { name: 'الدريكيش', nameEn: 'Dreikich', code: 'SY-07-003' }
      ]},
      { name: 'محافظة إدلب', nameEn: 'Idlib Governorate', cities: [
        { name: 'إدلب', nameEn: 'Idlib', code: 'SY-08-001' },
        { name: 'جسر الشغور', nameEn: 'Jisr al-Shughur', code: 'SY-08-002' },
        { name: 'معرة النعمان', nameEn: 'Maarrat al-Numan', code: 'SY-08-003' }
      ]},
      { name: 'محافظة الحسكة', nameEn: 'Al-Hasakah Governorate', cities: [
        { name: 'الحسكة', nameEn: 'Al-Hasakah', code: 'SY-09-001' },
        { name: 'القامشلي', nameEn: 'Qamishli', code: 'SY-09-002' },
        { name: 'ديريك', nameEn: 'Al-Malikiyah', code: 'SY-09-003' }
      ]},
      { name: 'محافظة دير الزور', nameEn: 'Deir ez-Zor Governorate', cities: [
        { name: 'دير الزور', nameEn: 'Deir ez-Zor', code: 'SY-10-001' },
        { name: 'الميادين', nameEn: 'Al-Mayadin', code: 'SY-10-002' },
        { name: 'البوكمال', nameEn: 'Al-Bukamal', code: 'SY-10-003' }
      ]},
      { name: 'محافظة الرقة', nameEn: 'Raqqa Governorate', cities: [
        { name: 'الرقة', nameEn: 'Raqqa', code: 'SY-11-001' },
        { name: 'تل أبيض', nameEn: 'Tell Abyad', code: 'SY-11-002' }
      ]},
      { name: 'محافظة السويداء', nameEn: 'As-Suwayda Governorate', cities: [
        { name: 'السويداء', nameEn: 'As-Suwayda', code: 'SY-12-001' },
        { name: 'شهبا', nameEn: 'Shahba', code: 'SY-12-002' }
      ]},
      { name: 'محافظة درعا', nameEn: 'Daraa Governorate', cities: [
        { name: 'درعا', nameEn: 'Daraa', code: 'SY-13-001' },
        { name: 'نوى', nameEn: 'Nawa', code: 'SY-13-002' },
        { name: 'الصنمين', nameEn: 'Al-Sanamayn', code: 'SY-13-003' }
      ]},
      { name: 'محافظة القنيطرة', nameEn: 'Quneitra Governorate', cities: [
        { name: 'القنيطرة', nameEn: 'Quneitra', code: 'SY-14-001' },
        { name: 'الرفيد', nameEn: 'Al-Rafid', code: 'SY-14-002' }
      ]}
    ]
  },

  PS: {
    code: 'PS',
    name: 'فلسطين',
    nameEn: 'Palestine',
    flag: '🇵🇸',
    governorates: [
      { name: 'محافظة القدس', nameEn: 'Jerusalem Governorate', cities: [
        { name: 'القدس', nameEn: 'Jerusalem', code: 'PS-01-001' },
        { name: 'أبو ديس', nameEn: 'Abu Dis', code: 'PS-01-002' }
      ]},
      { name: 'محافظة رام الله والبيرة', nameEn: 'Ramallah and Al-Bireh Governorate', cities: [
        { name: 'رام الله', nameEn: 'Ramallah', code: 'PS-02-001' },
        { name: 'البيرة', nameEn: 'Al-Bireh', code: 'PS-02-002' },
        { name: 'بيتونيا', nameEn: 'Beitunia', code: 'PS-02-003' }
      ]},
      { name: 'محافظة نابلس', nameEn: 'Nablus Governorate', cities: [
        { name: 'نابلس', nameEn: 'Nablus', code: 'PS-03-001' },
        { name: 'طولكرم', nameEn: 'Tulkarm', code: 'PS-03-002' },
        { name: 'قلقيلية', nameEn: 'Qalqilya', code: 'PS-03-003' },
        { name: 'جنين', nameEn: 'Jenin', code: 'PS-03-004' }
      ]},
      { name: 'محافظة بيت لحم', nameEn: 'Bethlehem Governorate', cities: [
        { name: 'بيت لحم', nameEn: 'Bethlehem', code: 'PS-04-001' },
        { name: 'بيت جالا', nameEn: 'Beit Jala', code: 'PS-04-002' },
        { name: 'بيت ساحور', nameEn: 'Beit Sahour', code: 'PS-04-003' }
      ]},
      { name: 'محافظة الخليل', nameEn: 'Hebron Governorate', cities: [
        { name: 'الخليل', nameEn: 'Hebron', code: 'PS-05-001' },
        { name: 'يطا', nameEn: 'Yatta', code: 'PS-05-002' },
        { name: 'دورا', nameEn: 'Dura', code: 'PS-05-003' }
      ]},
      { name: 'محافظة أريحا', nameEn: 'Jericho Governorate', cities: [
        { name: 'أريحا', nameEn: 'Jericho', code: 'PS-06-001' },
        { name: 'الأغوار', nameEn: 'Jordan Valley', code: 'PS-06-002' }
      ]},
      { name: 'محافظة طوباس', nameEn: 'Tubas Governorate', cities: [
        { name: 'طوباس', nameEn: 'Tubas', code: 'PS-07-001' },
        { name: 'تعنك', nameEn: 'Tammun', code: 'PS-07-002' }
      ]},
      { name: 'محافظة سلفيت', nameEn: 'Salfit Governorate', cities: [
        { name: 'سلفيت', nameEn: 'Salfit', code: 'PS-08-001' },
        { name: 'بديا', nameEn: 'Biddya', code: 'PS-08-002' }
      ]},
      { name: 'محافظة غزة', nameEn: 'Gaza Governorate', cities: [
        { name: 'غزة', nameEn: 'Gaza', code: 'PS-09-001' },
        { name: 'الشجاعية', nameEn: 'Shujaiya', code: 'PS-09-002' }
      ]},
      { name: 'محافظة شمال غزة', nameEn: 'North Gaza Governorate', cities: [
        { name: 'جباليا', nameEn: 'Jabalia', code: 'PS-10-001' },
        { name: 'بيت لاهيا', nameEn: 'Beit Lahia', code: 'PS-10-002' }
      ]},
      { name: 'محافظة دير البلح', nameEn: 'Deir Al-Balah Governorate', cities: [
        { name: 'دير البلح', nameEn: 'Deir al-Balah', code: 'PS-11-001' },
        { name: 'المغازي', nameEn: 'Al Maghazi', code: 'PS-11-002' }
      ]},
      { name: 'محافظة خان يونس', nameEn: 'Khan Yunis Governorate', cities: [
        { name: 'خان يونس', nameEn: 'Khan Yunis', code: 'PS-12-001' },
        { name: 'بني سهيلة', nameEn: 'Bani Suheila', code: 'PS-12-002' }
      ]},
      { name: 'محافظة رفح', nameEn: 'Rafah Governorate', cities: [
        { name: 'رفح', nameEn: 'Rafah', code: 'PS-13-001' }
      ]}
    ]
  },

  TN: {
    code: 'TN',
    name: 'تونس',
    nameEn: 'Tunisia',
    flag: '🇹🇳',
    governorates: [
      { name: 'ولاية تونس', nameEn: 'Tunis Governorate', cities: [
        { name: 'تونس', nameEn: 'Tunis', code: 'TN-01-001' },
        { name: 'قرطاج', nameEn: 'Carthage', code: 'TN-01-002' },
        { name: 'المرسى', nameEn: 'La Marsa', code: 'TN-01-003' },
        { name: 'سيدي بوسعيد', nameEn: 'Sidi Bou Said', code: 'TN-01-004' }
      ]},
      { name: 'ولاية أريانة', nameEn: 'Ariana Governorate', cities: [
        { name: 'أريانة', nameEn: 'Ariana', code: 'TN-02-001' },
        { name: 'سكرة', nameEn: 'Sokra', code: 'TN-02-002' }
      ]},
      { name: 'ولاية منوبة', nameEn: 'Manouba Governorate', cities: [
        { name: 'منوبة', nameEn: 'Manouba', code: 'TN-03-001' },
        { name: 'دوار هيشر', nameEn: 'Douar Hicher', code: 'TN-03-002' }
      ]},
      { name: 'ولاية بن عروس', nameEn: 'Ben Arous Governorate', cities: [
        { name: 'بن عروس', nameEn: 'Ben Arous', code: 'TN-04-001' },
        { name: 'حمام الأنف', nameEn: 'Hammam Lif', code: 'TN-04-002' },
        { name: 'المحمدية', nameEn: 'Mohamedia', code: 'TN-04-003' }
      ]},
      { name: 'ولاية نابل', nameEn: 'Nabeul Governorate', cities: [
        { name: 'نابل', nameEn: 'Nabeul', code: 'TN-05-001' },
        { name: 'الحمامات', nameEn: 'Hammamet', code: 'TN-05-002' },
        { name: 'قربة', nameEn: 'Korba', code: 'TN-05-003' }
      ]},
      { name: 'ولاية زغوان', nameEn: 'Zaghouan Governorate', cities: [
        { name: 'زغوان', nameEn: 'Zaghouan', code: 'TN-06-001' },
        { name: 'الفحص', nameEn: 'El Fahs', code: 'TN-06-002' }
      ]},
      { name: 'ولاية بنزرت', nameEn: 'Bizerte Governorate', cities: [
        { name: 'بنزرت', nameEn: 'Bizerte', code: 'TN-07-001' },
        { name: 'منزل بورقيبة', nameEn: 'Menzel Bourguiba', code: 'TN-07-002' }
      ]},
      { name: 'ولاية باجة', nameEn: 'Beja Governorate', cities: [
        { name: 'باجة', nameEn: 'Beja', code: 'TN-08-001' },
        { name: 'تبرسق', nameEn: 'Teboursouk', code: 'TN-08-002' }
      ]},
      { name: 'ولاية جندوبة', nameEn: 'Jendouba Governorate', cities: [
        { name: 'جندوبة', nameEn: 'Jendouba', code: 'TN-09-001' },
        { name: 'طبرقة', nameEn: 'Tabarka', code: 'TN-09-002' }
      ]},
      { name: 'ولاية الكاف', nameEn: 'Le Kef Governorate', cities: [
        { name: 'الكاف', nameEn: 'Le Kef', code: 'TN-10-001' },
        { name: 'القصرين', nameEn: 'Kasserine', code: 'TN-10-002' }
      ]},
      { name: 'ولاية سليانة', nameEn: 'Siliana Governorate', cities: [
        { name: 'سليانة', nameEn: 'Siliana', code: 'TN-11-001' }
      ]},
      { name: 'ولاية القيروان', nameEn: 'Kairouan Governorate', cities: [
        { name: 'القيروان', nameEn: 'Kairouan', code: 'TN-12-001' },
        { name: 'السبيخة', nameEn: 'Sbikha', code: 'TN-12-002' }
      ]},
      { name: 'ولاية القصرين', nameEn: 'Kasserine Governorate', cities: [
        { name: 'القصرين', nameEn: 'Kasserine', code: 'TN-13-001' },
        { name: 'سبيبة', nameEn: 'Sbeitla', code: 'TN-13-002' }
      ]},
      { name: 'ولاية سيدي بوزيد', nameEn: 'Sidi Bouzid Governorate', cities: [
        { name: 'سيدي بوزيد', nameEn: 'Sidi Bouzid', code: 'TN-14-001' }
      ]},
      { name: 'ولاية القصرين', nameEn: 'Kasserine Governorate', cities: [
        { name: 'تالة', nameEn: 'Tala', code: 'TN-15-001' }
      ]},
      { name: 'ولاية قفصة', nameEn: 'Gafsa Governorate', cities: [
        { name: 'قفصة', nameEn: 'Gafsa', code: 'TN-16-001' },
        { name: 'المتلوي', nameEn: 'Metlaoui', code: 'TN-16-002' }
      ]},
      { name: 'ولاية توزر', nameEn: 'Tozeur Governorate', cities: [
        { name: 'توزر', nameEn: 'Tozeur', code: 'TN-17-001' },
        { name: 'دقاش', nameEn: 'Degache', code: 'TN-17-002' }
      ]},
      { name: 'ولاية قبلي', nameEn: 'Kebili Governorate', cities: [
        { name: 'قبلي', nameEn: 'Kebili', code: 'TN-18-001' },
        { name: 'دوز', nameEn: 'Douz', code: 'TN-18-002' }
      ]},
      { name: 'ولاية مدنين', nameEn: 'Medenine Governorate', cities: [
        { name: 'مدنين', nameEn: 'Medenine', code: 'TN-19-001' },
        { name: 'جرجيس', nameEn: 'Zarzis', code: 'TN-19-002' },
        { name: 'جربة', nameEn: 'Djerba', code: 'TN-19-003' }
      ]},
      { name: 'ولاية تطاوين', nameEn: 'Tataouine Governorate', cities: [
        { name: 'تطاوين', nameEn: 'Tataouine', code: 'TN-20-001' },
        { name: 'رمادة', nameEn: 'Remada', code: 'TN-20-002' }
      ]},
      { name: 'ولاية صفاقس', nameEn: 'Sfax Governorate', cities: [
        { name: 'صفاقس', nameEn: 'Sfax', code: 'TN-21-001' },
        { name: 'صخيرة', nameEn: 'Skhira', code: 'TN-21-002' }
      ]},
      { name: 'ولاية المهدية', nameEn: 'Mahdia Governorate', cities: [
        { name: 'المهدية', nameEn: 'Mahdia', code: 'TN-22-001' },
        { name: 'الجم', nameEn: 'El Jem', code: 'TN-22-002' }
      ]},
      { name: 'ولاية منستير', nameEn: 'Monastir Governorate', cities: [
        { name: 'منستير', nameEn: 'Monastir', code: 'TN-23-001' },
        { name: 'المكنين', nameEn: 'Moknine', code: 'TN-23-002' }
      ]},
      { name: 'ولاية سوسة', nameEn: 'Sousse Governorate', cities: [
        { name: 'سوسة', nameEn: 'Sousse', code: 'TN-24-001' },
        { name: 'النفيضة', nameEn: 'Hammam Sousse', code: 'TN-24-002' },
        { name: 'القلعة الكبرى', nameEn: 'Kalaa Kebira', code: 'TN-24-003' }
      ]}
    ]
  },

  DZ: {
    code: 'DZ',
    name: 'الجزائر',
    nameEn: 'Algeria',
    flag: '🇩🇿',
    governorates: [
      { name: 'ولاية الجزائر', nameEn: 'Algiers Province', cities: [
        { name: 'الجزائر العاصمة', nameEn: 'Algiers', code: 'DZ-01-001' },
        { name: 'سيدي امحمد', nameEn: 'Sidi M\'Hamed', code: 'DZ-01-002' },
        { name: 'باب الزوار', nameEn: 'Bab El Oued', code: 'DZ-01-003' }
      ]},
      { name: 'ولاية وهران', nameEn: 'Oran Province', cities: [
        { name: 'وهران', nameEn: 'Oran', code: 'DZ-02-001' },
        { name: 'السوانية', nameEn: 'Es Senia', code: 'DZ-02-002' },
        { name: 'بئر الجير', nameEn: 'Bir El Djir', code: 'DZ-02-003' }
      ]},
      { name: 'ولاية قسنطينة', nameEn: 'Constantine Province', cities: [
        { name: 'قسنطينة', nameEn: 'Constantine', code: 'DZ-03-001' },
        { name: 'الخروب', nameEn: 'El Khroub', code: 'DZ-03-002' }
      ]},
      { name: 'ولاية عنابة', nameEn: 'Annaba Province', cities: [
        { name: 'عنابة', nameEn: 'Annaba', code: 'DZ-04-001' },
        { name: 'الحجار', nameEn: 'El Hadjar', code: 'DZ-04-002' }
      ]},
      { name: 'ولاية باتنة', nameEn: 'Batna Province', cities: [
        { name: 'باتنة', nameEn: 'Batna', code: 'DZ-05-001' },
        { name: 'مروانة', nameEn: 'Merouana', code: 'DZ-05-002' }
      ]},
      { name: 'ولاية بجاية', nameEn: 'Bejaia Province', cities: [
        { name: 'بجاية', nameEn: 'Bejaia', code: 'DZ-06-001' },
        { name: 'أقبو', nameEn: 'Akbou', code: 'DZ-06-002' }
      ]},
      { name: 'ولاية سطيف', nameEn: 'Setif Province', cities: [
        { name: 'سطيف', nameEn: 'Setif', code: 'DZ-07-001' },
        { name: 'العلمة', nameEn: 'El Eulma', code: 'DZ-07-002' }
      ]},
      { name: 'ولاية تيزي وزو', nameEn: 'Tizi Ouzou Province', cities: [
        { name: 'تيزي وزو', nameEn: 'Tizi Ouzou', code: 'DZ-08-001' },
        { name: 'أزفون', nameEn: 'Azazga', code: 'DZ-08-002' }
      ]},
      { name: 'ولاية تلمسان', nameEn: 'Tlemcen Province', cities: [
        { name: 'تلمسان', nameEn: 'Tlemcen', code: 'DZ-09-001' },
        { name: 'مغنية', nameEn: 'Maghnia', code: 'DZ-09-002' }
      ]},
      { name: 'ولاية سيدي بلعباس', nameEn: 'Sidi Bel Abbes Province', cities: [
        { name: 'سيدي بلعباس', nameEn: 'Sidi Bel Abbes', code: 'DZ-10-001' }
      ]},
      { name: 'ولاية بسكرة', nameEn: 'Biskra Province', cities: [
        { name: 'بسكرة', nameEn: 'Biskra', code: 'DZ-11-001' },
        { name: 'طولقة', nameEn: 'Tolga', code: 'DZ-11-002' }
      ]},
      { name: 'ولاية ورقلة', nameEn: 'Ouargla Province', cities: [
        { name: 'ورقلة', nameEn: 'Ouargla', code: 'DZ-12-001' },
        { name: 'حاسي مسعود', nameEn: 'Hassi Messaoud', code: 'DZ-12-002' }
      ]},
      { name: 'ولاية بشار', nameEn: 'Bechar Province', cities: [
        { name: 'بشار', nameEn: 'Bechar', code: 'DZ-13-001' }
      ]},
      { name: 'ولاية الأغواط', nameEn: 'Laghouat Province', cities: [
        { name: 'الأغواط', nameEn: 'Laghouat', code: 'DZ-14-001' }
      ]},
      { name: 'ولاية مستغانم', nameEn: 'Mostaganem Province', cities: [
        { name: 'مستغانم', nameEn: 'Mostaganem', code: 'DZ-15-001' }
      ]},
      { name: 'ولاية الشلف', nameEn: 'Chlef Province', cities: [
        { name: 'الشلف', nameEn: 'Chlef', code: 'DZ-16-001' }
      ]},
      { name: 'ولاية تيارت', nameEn: 'Tiaret Province', cities: [
        { name: 'تيارت', nameEn: 'Tiaret', code: 'DZ-17-001' }
      ]},
      { name: 'ولاية مدية', nameEn: 'Medea Province', cities: [
        { name: 'مدية', nameEn: 'Medea', code: 'DZ-18-001' }
      ]},
      { name: 'ولاية بومرداس', nameEn: 'Boumerdes Province', cities: [
        { name: 'بومرداس', nameEn: 'Boumerdes', code: 'DZ-19-001' }
      ]},
      { name: 'ولاية تيبازة', nameEn: 'Tipaza Province', cities: [
        { name: 'تيبازة', nameEn: 'Tipaza', code: 'DZ-20-001' }
      ]},
      { name: 'ولاية سوق أهراس', nameEn: 'Souk Ahras Province', cities: [
        { name: 'سوق أهراس', nameEn: 'Souk Ahras', code: 'DZ-21-001' }
      ]},
      { name: 'ولاية الطارف', nameEn: 'El Tarf Province', cities: [
        { name: 'الطارف', nameEn: 'El Tarf', code: 'DZ-22-001' }
      ]},
      { name: 'ولاية خنشلة', nameEn: 'Khenchela Province', cities: [
        { name: 'خنشلة', nameEn: 'Khenchela', code: 'DZ-23-001' }
      ]},
      { name: 'ولاية أم البواقي', nameEn: 'Oum El Bouaghi Province', cities: [
        { name: 'أم البواقي', nameEn: 'Oum El Bouaghi', code: 'DZ-24-001' }
      ]},
      { name: 'ولاية برج بوعريريج', nameEn: 'Bordj Bou Arreridj Province', cities: [
        { name: 'برج بوعريريج', nameEn: 'Bordj Bou Arreridj', code: 'DZ-25-001' }
      ]},
      { name: 'ولاية المسيلة', nameEn: 'Msila Province', cities: [
        { name: 'المسيلة', nameEn: 'Msila', code: 'DZ-26-001' }
      ]},
      { name: 'ولاية جيجل', nameEn: 'Jijel Province', cities: [
        { name: 'جيجل', nameEn: 'Jijel', code: 'DZ-27-001' }
      ]},
      { name: 'ولاية سكيكدة', nameEn: 'Skikda Province', cities: [
        { name: 'سكيكدة', nameEn: 'Skikda', code: 'DZ-28-001' }
      ]},
      { name: 'ولاية قالمة', nameEn: 'Guelma Province', cities: [
        { name: 'قالمة', nameEn: 'Guelma', code: 'DZ-29-001' }
      ]},
      { name: 'ولاية ميلة', nameEn: 'Mila Province', cities: [
        { name: 'ميلة', nameEn: 'Mila', code: 'DZ-30-001' }
      ]},
      { name: 'ولاية الجلفة', nameEn: 'Djelfa Province', cities: [
        { name: 'الجلفة', nameEn: 'Djelfa', code: 'DZ-31-001' }
      ]},
      { name: 'ولاية الأغواط', nameEn: 'Laghouat Province', cities: [
        { name: 'الأغواط', nameEn: 'Laghouat', code: 'DZ-32-001' }
      ]},
      { name: 'ولاية غرداية', nameEn: 'Ghardaia Province', cities: [
        { name: 'غرداية', nameEn: 'Ghardaia', code: 'DZ-33-001' }
      ]},
      { name: 'ولاية إليزي', nameEn: 'Illizi Province', cities: [
        { name: 'إليزي', nameEn: 'Illizi', code: 'DZ-34-001' }
      ]},
      { name: 'ولاية تمنراست', nameEn: 'Tamanrasset Province', cities: [
        { name: 'تمنراست', nameEn: 'Tamanrasset', code: 'DZ-35-001' }
      ]},
      { name: 'ولاية أدرار', nameEn: 'Adrar Province', cities: [
        { name: 'أدرار', nameEn: 'Adrar', code: 'DZ-36-001' }
      ]},
      { name: 'ولاية تندوف', nameEn: 'Tindouf Province', cities: [
        { name: 'تندوف', nameEn: 'Tindouf', code: 'DZ-37-001' }
      ]},
      { name: 'ولاية بشار', nameEn: 'Bechar Province', cities: [
        { name: 'بشار', nameEn: 'Bechar', code: 'DZ-38-001' }
      ]},
      { name: 'ولاية النعامة', nameEn: 'Naama Province', cities: [
        { name: 'النعامة', nameEn: 'Naama', code: 'DZ-39-001' }
      ]},
      { name: 'ولاية السعيدة', nameEn: 'El Bayadh Province', cities: [
        { name: 'السعيدة', nameEn: 'El Bayadh', code: 'DZ-40-001' }
      ]},
      { name: 'ولاية البيض', nameEn: 'El Bayadh Province', cities: [
        { name: 'البيض', nameEn: 'El Bayadh', code: 'DZ-41-001' }
      ]},
      { name: 'ولاية تسمسيلت', nameEn: 'Tissemsilt Province', cities: [
        { name: 'تسمسيلت', nameEn: 'Tissemsilt', code: 'DZ-42-001' }
      ]},
      { name: 'ولاية عين الدفلى', nameEn: 'Ain Defla Province', cities: [
        { name: 'عين الدفلى', nameEn: 'Ain Defla', code: 'DZ-43-001' }
      ]},
      { name: 'ولاية عين تموشنت', nameEn: 'Ain Temouchent Province', cities: [
        { name: 'عين تموشنت', nameEn: 'Ain Temouchent', code: 'DZ-44-001' }
      ]},
      { name: 'ولاية غليزان', nameEn: 'Relizane Province', cities: [
        { name: 'غليزان', nameEn: 'Relizane', code: 'DZ-45-001' }
      ]},
      { name: 'ولاية معسكر', nameEn: 'Mascara Province', cities: [
        { name: 'معسكر', nameEn: 'Mascara', code: 'DZ-46-001' }
      ]},
      { name: 'ولاية سعيدة', nameEn: 'Saida Province', cities: [
        { name: 'سعيدة', nameEn: 'Saida', code: 'DZ-47-001' }
      ]},
      { name: 'ولاية الوادي', nameEn: 'El Oued Province', cities: [
        { name: 'الوادي', nameEn: 'El Oued', code: 'DZ-48-001' }
      ]}
    ]
  },

  MA: {
    code: 'MA',
    name: 'المغرب',
    nameEn: 'Morocco',
    flag: '🇲🇦',
    governorates: [
      { name: 'جهة الرباط سلا القنيطرة', nameEn: 'Rabat-Sale-Kenitra', cities: [
        { name: 'الرباط', nameEn: 'Rabat', code: 'MA-01-001' },
        { name: 'سلا', nameEn: 'Sale', code: 'MA-01-002' },
        { name: 'القنيطرة', nameEn: 'Kenitra', code: 'MA-01-003' },
        { name: 'تمارة', nameEn: 'Temara', code: 'MA-01-004' }
      ]},
      { name: 'جهة الدار البيضاء سطات', nameEn: 'Casablanca-Settat', cities: [
        { name: 'الدار البيضاء', nameEn: 'Casablanca', code: 'MA-02-001' },
        { name: 'سطات', nameEn: 'Settat', code: 'MA-02-002' },
        { name: 'المحمدية', nameEn: 'Mohammedia', code: 'MA-02-003' },
        { name: 'بنسليمان', nameEn: 'Benslimane', code: 'MA-02-004' }
      ]},
      { name: 'جهة فاس مكناس', nameEn: 'Fes-Meknes', cities: [
        { name: 'فاس', nameEn: 'Fes', code: 'MA-03-001' },
        { name: 'مكناس', nameEn: 'Meknes', code: 'MA-03-002' },
        { name: 'إفران', nameEn: 'Ifrane', code: 'MA-03-003' },
        { name: 'تاونات', nameEn: 'Taounate', code: 'MA-03-004' }
      ]},
      { name: 'جهة طنجة تطوان الحسيمة', nameEn: 'Tanger-Tetouan-Al Hoceima', cities: [
        { name: 'طنجة', nameEn: 'Tangier', code: 'MA-04-001' },
        { name: 'تطوان', nameEn: 'Tetouan', code: 'MA-04-002' },
        { name: 'الحسيمة', nameEn: 'Al Hoceima', code: 'MA-04-003' },
        { name: 'شفشاون', nameEn: 'Chefchaouen', code: 'MA-04-004' }
      ]},
      { name: 'جهة مراكش آسفي', nameEn: 'Marrakech-Safi', cities: [
        { name: 'مراكش', nameEn: 'Marrakech', code: 'MA-05-001' },
        { name: 'آسفي', nameEn: 'Safi', code: 'MA-05-002' },
        { name: 'الصويرة', nameEn: 'Essaouira', code: 'MA-05-003' }
      ]},
      { name: 'جهة سوس ماسة', nameEn: 'Souss-Massa', cities: [
        { name: 'أكادير', nameEn: 'Agadir', code: 'MA-06-001' },
        { name: 'إنزكان', nameEn: 'Inezgane', code: 'MA-06-002' },
        { name: 'تارودانت', nameEn: 'Taroudannt', code: 'MA-06-003' },
        { name: 'تزنيت', nameEn: 'Tiznit', code: 'MA-06-004' }
      ]},
      { name: 'جهة الشرق', nameEn: 'Oriental', cities: [
        { name: 'وجدة', nameEn: 'Oujda', code: 'MA-07-001' },
        { name: 'بركان', nameEn: 'Berkane', code: 'MA-07-002' },
        { name: 'الناظور', nameEn: 'Nador', code: 'MA-07-003' },
        { name: 'جرادة', nameEn: 'Jerada', code: 'MA-07-004' }
      ]},
      { name: 'جهة بني ملال خنيفرة', nameEn: 'Beni Mellal-Khenifra', cities: [
        { name: 'بني ملال', nameEn: 'Beni Mellal', code: 'MA-08-001' },
        { name: 'خنيفرة', nameEn: 'Khenifra', code: 'MA-08-002' },
        { name: 'أزيلال', nameEn: 'Azilal', code: 'MA-08-003' }
      ]},
      { name: 'جهة درعة تافيلالت', nameEn: 'Draa-Tafilalet', cities: [
        { name: 'ورزازات', nameEn: 'Ouarzazate', code: 'MA-09-001' },
        { name: 'الراشيدية', nameEn: 'Errachidia', code: 'MA-09-002' },
        { name: 'زاكورة', nameEn: 'Zagora', code: 'MA-09-003' }
      ]},
      { name: 'جهة كلميم واد نون', nameEn: 'Guelmim-Oued Noun', cities: [
        { name: 'كلميم', nameEn: 'Guelmim', code: 'MA-10-001' },
        { name: 'طانطان', nameEn: 'Tan-Tan', code: 'MA-10-002' }
      ]},
      { name: 'جهة العيون الساقية الحمراء', nameEn: 'Laayoune-Sakia El Hamra', cities: [
        { name: 'العيون', nameEn: 'Laayoune', code: 'MA-11-001' },
        { name: 'بوجدور', nameEn: 'Boujdour', code: 'MA-11-002' }
      ]},
      { name: 'جهة الداخلة وادي الذهب', nameEn: 'Dakhla-Oued Ed-Dahab', cities: [
        { name: 'الداخلة', nameEn: 'Dakhla', code: 'MA-12-001' }
      ]}
    ]
  },

  LY: {
    code: 'LY',
    name: 'ليبيا',
    nameEn: 'Libya',
    flag: '🇱🇾',
    governorates: [
      { name: 'محافظة طرابلس', nameEn: 'Tripoli', cities: [
        { name: 'طرابلس', nameEn: 'Tripoli', code: 'LY-01-001' },
        { name: 'تاجوراء', nameEn: 'Tajura', code: 'LY-01-002' },
        { name: 'عين زارة', nameEn: 'Ain Zara', code: 'LY-01-003' }
      ]},
      { name: 'محافظة بنغازي', nameEn: 'Benghazi', cities: [
        { name: 'بنغازي', nameEn: 'Benghazi', code: 'LY-02-001' },
        { name: 'القوارشة', nameEn: 'Gwarsha', code: 'LY-02-002' }
      ]},
      { name: 'محافظة مصراتة', nameEn: 'Misrata', cities: [
        { name: 'مصراتة', nameEn: 'Misrata', code: 'LY-03-001' },
        { name: 'زليتن', nameEn: 'Zliten', code: 'LY-03-002' }
      ]},
      { name: 'محافظة الزاوية', nameEn: 'Zawiya', cities: [
        { name: 'الزاوية', nameEn: 'Zawiya', code: 'LY-04-001' },
        { name: 'صبراتة', nameEn: 'Sabratha', code: 'LY-04-002' }
      ]},
      { name: 'محافظة سبها', nameEn: 'Sabha', cities: [
        { name: 'سبها', nameEn: 'Sabha', code: 'LY-05-001' },
        { name: 'براك الشاطئ', nameEn: 'Brak', code: 'LY-05-002' }
      ]},
      { name: 'محافظة درنة', nameEn: 'Derna', cities: [
        { name: 'درنة', nameEn: 'Derna', code: 'LY-06-001' },
        { name: 'القبة', nameEn: 'Al Qubah', code: 'LY-06-002' }
      ]},
      { name: 'محافظة البيضاء', nameEn: 'Bayda', cities: [
        { name: 'البيضاء', nameEn: 'Bayda', code: 'LY-07-001' },
        { name: 'شحات', nameEn: 'Shahhat', code: 'LY-07-002' }
      ]},
      { name: 'محافظة الخمس', nameEn: 'Al Khums', cities: [
        { name: 'الخمس', nameEn: 'Al Khums', code: 'LY-08-001' },
        { name: 'زلطن', nameEn: 'Zaltan', code: 'LY-08-002' }
      ]},
      { name: 'محافظة الجفارة', nameEn: 'Al Jafara', cities: [
        { name: 'العزيزية', nameEn: 'Aziziya', code: 'LY-09-001' },
        { name: 'صبراتة', nameEn: 'Sabratha', code: 'LY-09-002' }
      ]},
      { name: 'محافظة الجبل الأخضر', nameEn: 'Al Jabal al Akhdar', cities: [
        { name: 'البيضاء', nameEn: 'Bayda', code: 'LY-10-001' },
        { name: 'القبة', nameEn: 'Al Qubah', code: 'LY-10-002' }
      ]},
      { name: 'محافظة مرزق', nameEn: 'Murzuq', cities: [
        { name: 'مرزق', nameEn: 'Murzuq', code: 'LY-11-001' },
        { name: 'تازربو', nameEn: 'Tazirbu', code: 'LY-11-002' }
      ]},
      { name: 'محافظة غات', nameEn: 'Ghat', cities: [
        { name: 'غات', nameEn: 'Ghat', code: 'LY-12-001' }
      ]},
      { name: 'محافظة الكفرة', nameEn: 'Kufra', cities: [
        { name: 'الكفرة', nameEn: 'Kufra', code: 'LY-13-001' }
      ]},
      { name: 'محافظة أوباري', nameEn: 'Ubari', cities: [
        { name: 'أوباري', nameEn: 'Ubari', code: 'LY-14-001' }
      ]},
      { name: 'محافظة ترهونة', nameEn: 'Tarhuna', cities: [
        { name: 'ترهونة', nameEn: 'Tarhuna', code: 'LY-15-001' }
      ]}
    ]
  },

  SD: {
    code: 'SD',
    name: 'السودان',
    nameEn: 'Sudan',
    flag: '🇸🇩',
    governorates: [
      { name: 'ولاية الخرطوم', nameEn: 'Khartoum State', cities: [
        { name: 'الخرطوم', nameEn: 'Khartoum', code: 'SD-01-001' },
        { name: 'أم درمان', nameEn: 'Omdurman', code: 'SD-01-002' },
        { name: 'بحري', nameEn: 'Bahri', code: 'SD-01-003' }
      ]},
      { name: 'ولاية الجزيرة', nameEn: 'Gezira State', cities: [
        { name: 'ود مدني', nameEn: 'Wad Madani', code: 'SD-02-001' },
        { name: 'الحصاحيصا', nameEn: 'Al Hasaheisa', code: 'SD-02-002' }
      ]},
      { name: 'ولاية شمال كردفان', nameEn: 'North Kordofan', cities: [
        { name: 'الأبيض', nameEn: 'Al Ubayyid', code: 'SD-03-001' },
        { name: 'شيكان', nameEn: 'Sheikan', code: 'SD-03-002' }
      ]},
      { name: 'ولاية جنوب كردفان', nameEn: 'South Kordofan', cities: [
        { name: 'كادوقلي', nameEn: 'Kadugli', code: 'SD-04-001' },
        { name: 'تلودي', nameEn: 'Talodi', code: 'SD-04-002' }
      ]},
      { name: 'ولاية شمال دارفور', nameEn: 'North Darfur', cities: [
        { name: 'الفاشر', nameEn: 'Al Fashir', code: 'SD-05-001' },
        { name: 'كتم', nameEn: 'Kutum', code: 'SD-05-002' }
      ]},
      { name: 'ولاية جنوب دارفور', nameEn: 'South Darfur', cities: [
        { name: 'نيالا', nameEn: 'Nyala', code: 'SD-06-001' },
        { name: 'الضعين', nameEn: 'Ed Daein', code: 'SD-06-002' }
      ]},
      { name: 'ولاية غرب دارفور', nameEn: 'West Darfur', cities: [
        { name: 'الجنينة', nameEn: 'Al Geneina', code: 'SD-07-001' }
      ]},
      { name: 'ولاية شرق دارفور', nameEn: 'East Darfur', cities: [
        { name: 'الضعين', nameEn: 'Ed Daein', code: 'SD-08-001' }
      ]},
      { name: 'ولاية وسط دارفور', nameEn: 'Central Darfur', cities: [
        { name: 'زالنجي', nameEn: 'Zalingei', code: 'SD-09-001' }
      ]},
      { name: 'ولاية البحر الأحمر', nameEn: 'Red Sea State', cities: [
        { name: 'بورتسودان', nameEn: 'Port Sudan', code: 'SD-10-001' },
        { name: 'سواكن', nameEn: 'Suakin', code: 'SD-10-002' }
      ]},
      { name: 'ولاية كسلا', nameEn: 'Kassala State', cities: [
        { name: 'كسلا', nameEn: 'Kassala', code: 'SD-11-001' }
      ]},
      { name: 'ولاية القضارف', nameEn: 'Al Qadarif State', cities: [
        { name: 'القضارف', nameEn: 'Al Qadarif', code: 'SD-12-001' }
      ]},
      { name: 'ولاية سنار', nameEn: 'Sennar State', cities: [
        { name: 'سنار', nameEn: 'Sennar', code: 'SD-13-001' }
      ]},
      { name: 'ولاية النيل الأبيض', nameEn: 'White Nile State', cities: [
        { name: 'ربك', nameEn: 'Rabak', code: 'SD-14-001' },
        { name: 'كوستي', nameEn: 'Kosti', code: 'SD-14-002' }
      ]},
      { name: 'ولاية النيل الأزرق', nameEn: 'Blue Nile State', cities: [
        { name: 'دمازين', nameEn: 'Damazin', code: 'SD-15-001' }
      ]},
      { name: 'ولاية نهر النيل', nameEn: 'River Nile State', cities: [
        { name: 'الدامر', nameEn: 'Ad Damar', code: 'SD-16-001' },
        { name: 'شندي', nameEn: 'Shendi', code: 'SD-16-002' }
      ]},
      { name: 'ولاية الشمالية', nameEn: 'Northern State', cities: [
        { name: 'دنقلا', nameEn: 'Dongola', code: 'SD-17-001' },
        { name: 'وادي حلفا', nameEn: 'Wadi Halfa', code: 'SD-17-002' }
      ]},
      { name: 'ولاية غرب كردفان', nameEn: 'West Kordofan', cities: [
        { name: 'الفولة', nameEn: 'Al Fulah', code: 'SD-18-001' }
      ]}
    ]
  },

  YE: {
    code: 'YE',
    name: 'اليمن',
    nameEn: 'Yemen',
    flag: '🇾🇪',
    governorates: [
      { name: 'محافظة صنعاء', nameEn: 'Sanaa Governorate', cities: [
        { name: 'صنعاء', nameEn: 'Sanaa', code: 'YE-01-001' },
        { name: 'الأمانة', nameEn: 'Amanat Al Asimah', code: 'YE-01-002' }
      ]},
      { name: 'محافظة عدن', nameEn: 'Aden Governorate', cities: [
        { name: 'عدن', nameEn: 'Aden', code: 'YE-02-001' },
        { name: 'خور مكسر', nameEn: 'Khormaksar', code: 'YE-02-002' }
      ]},
      { name: 'محافظة الحديدة', nameEn: 'Hodeidah Governorate', cities: [
        { name: 'الحديدة', nameEn: 'Hodeidah', code: 'YE-03-001' },
        { name: 'المنصورة', nameEn: 'Al Mansourah', code: 'YE-03-002' }
      ]},
      { name: 'محافظة إب', nameEn: 'Ibb Governorate', cities: [
        { name: 'إب', nameEn: 'Ibb', code: 'YE-04-001' },
        { name: 'جبلة', nameEn: 'Jiblah', code: 'YE-04-002' }
      ]},
      { name: 'محافظة تعز', nameEn: 'Taiz Governorate', cities: [
        { name: 'تعز', nameEn: 'Taiz', code: 'YE-05-001' },
        { name: 'المخا', nameEn: 'Mocha', code: 'YE-05-002' }
      ]},
      { name: 'محافظة حضرموت', nameEn: 'Hadramaut Governorate', cities: [
        { name: 'المكلا', nameEn: 'Mukalla', code: 'YE-06-001' },
        { name: 'سيئون', nameEn: 'Seiyun', code: 'YE-06-002' },
        { name: 'الشحر', nameEn: 'Ash Shihr', code: 'YE-06-003' }
      ]},
      { name: 'محافظة مأرب', nameEn: 'Marib Governorate', cities: [
        { name: 'مأرب', nameEn: 'Marib', code: 'YE-07-001' },
        { name: 'سرواح', nameEn: 'Sirwah', code: 'YE-07-002' }
      ]},
      { name: 'محافظة الجوف', nameEn: 'Al Jawf Governorate', cities: [
        { name: 'الحزم', nameEn: 'Al Hazm', code: 'YE-08-001' }
      ]},
      { name: 'محافظة عمران', nameEn: 'Amran Governorate', cities: [
        { name: 'عمران', nameEn: 'Amran', code: 'YE-09-001' },
        { name: 'ريمة', nameEn: 'Raymah', code: 'YE-09-002' }
      ]},
      { name: 'محافظة ذمار', nameEn: 'Dhamar Governorate', cities: [
        { name: 'ذمار', nameEn: 'Dhamar', code: 'YE-10-001' }
      ]},
      { name: 'محافظة المحويت', nameEn: 'Al Mahwit Governorate', cities: [
        { name: 'المحويت', nameEn: 'Al Mahwit', code: 'YE-11-001' }
      ]},
      { name: 'محافظة ريمة', nameEn: 'Raymah Governorate', cities: [
        { name: 'الجفر', nameEn: 'Al Jafrah', code: 'YE-12-001' }
      ]},
      { name: 'محافظة حجة', nameEn: 'Hajjah Governorate', cities: [
        { name: 'حجة', nameEn: 'Hajjah', code: 'YE-13-001' },
        { name: 'عبس', nameEn: 'Abs', code: 'YE-13-002' }
      ]},
      { name: 'محافظة صعدة', nameEn: 'Saada Governorate', cities: [
        { name: 'صعدة', nameEn: 'Saada', code: 'YE-14-001' },
        { name: 'باقم', nameEn: 'Baqim', code: 'YE-14-002' }
      ]},
      { name: 'محافظة أبين', nameEn: 'Abyan Governorate', cities: [
        { name: 'زنجبار', nameEn: 'Zinjibar', code: 'YE-15-001' },
        { name: 'جعار', nameEn: 'Jaar', code: 'YE-15-002' }
      ]},
      { name: 'محافظة لحج', nameEn: 'Lahij Governorate', cities: [
        { name: 'لحج', nameEn: 'Lahij', code: 'YE-16-001' },
        { name: 'الحوطة', nameEn: 'Al Hawtah', code: 'YE-16-002' }
      ]},
      { name: 'محافظة الضالع', nameEn: 'Al Dhale Governorate', cities: [
        { name: 'الضالع', nameEn: 'Al Dhale', code: 'YE-17-001' }
      ]},
      { name: 'محافظة شبوة', nameEn: 'Shabwah Governorate', cities: [
        { name: 'عتق', nameEn: 'Ataq', code: 'YE-18-001' },
        { name: 'بيحان', nameEn: 'Bayhan', code: 'YE-18-002' }
      ]},
      { name: 'محافظة المهرة', nameEn: 'Al Mahrah Governorate', cities: [
        { name: 'الغيضة', nameEn: 'Al Ghaydah', code: 'YE-19-001' },
        { name: 'سيحوت', nameEn: 'Sayhut', code: 'YE-19-002' }
      ]},
      { name: 'محافظة سقطرى', nameEn: 'Socotra Governorate', cities: [
        { name: 'حديبو', nameEn: 'Hadibu', code: 'YE-20-001' }
      ]},
      { name: 'محافظة البيضاء', nameEn: 'Al Bayda Governorate', cities: [
        { name: 'البيضاء', nameEn: 'Al Bayda', code: 'YE-21-001' }
      ]}
    ]
  },

  DJ: {
    code: 'DJ',
    name: 'جيبوتي',
    nameEn: 'Djibouti',
    flag: '🇩🇯',
    governorates: [
      { name: 'إقليم جيبوتي', nameEn: 'Djibouti Region', cities: [
        { name: 'جيبوتي', nameEn: 'Djibouti City', code: 'DJ-01-001' },
        { name: 'بلبلا', nameEn: 'Balbala', code: 'DJ-01-002' }
      ]},
      { name: 'إقليم علي صبيح', nameEn: 'Ali Sabieh Region', cities: [
        { name: 'علي صبيح', nameEn: 'Ali Sabieh', code: 'DJ-02-001' }
      ]},
      { name: 'إقليم دخيل', nameEn: 'Dikhil Region', cities: [
        { name: 'دخيل', nameEn: 'Dikhil', code: 'DJ-03-001' }
      ]},
      { name: 'إقليم تاجورة', nameEn: 'Tadjourah Region', cities: [
        { name: 'تاجورة', nameEn: 'Tadjourah', code: 'DJ-04-001' }
      ]},
      { name: 'إقليم أوبوك', nameEn: 'Obock Region', cities: [
        { name: 'أوبوك', nameEn: 'Obock', code: 'DJ-05-001' }
      ]},
      { name: 'إقليم أرتا', nameEn: 'Arta Region', cities: [
        { name: 'أرتا', nameEn: 'Arta', code: 'DJ-06-001' }
      ]}
    ]
  },

  SO: {
    code: 'SO',
    name: 'الصومال',
    nameEn: 'Somalia',
    flag: '🇸🇴',
    governorates: [
      { name: 'إقليم بنادر', nameEn: 'Banaadir Region', cities: [
        { name: 'مقديشو', nameEn: 'Mogadishu', code: 'SO-01-001' },
        { name: 'الشاطئ', nameEn: 'Shangani', code: 'SO-01-002' }
      ]},
      { name: 'إقليم أرض البنط', nameEn: 'Puntland', cities: [
        { name: 'جرتسي', nameEn: 'Garowe', code: 'SO-02-001' },
        { name: 'بوصاصو', nameEn: 'Bosaso', code: 'SO-02-002' }
      ]},
      { name: 'إقليم أرض الصومال', nameEn: 'Somaliland', cities: [
        { name: 'هرجيسا', nameEn: 'Hargeisa', code: 'SO-03-001' },
        { name: 'برعو', nameEn: 'Burao', code: 'SO-03-002' },
        { name: 'بورمه', nameEn: 'Borama', code: 'SO-03-003' }
      ]},
      { name: 'إقليم جيدو', nameEn: 'Gedo Region', cities: [
        { name: 'غارو', nameEn: 'Garbahaarey', code: 'SO-04-001' },
        { name: 'بردرة', nameEn: 'Bardera', code: 'SO-04-002' }
      ]},
      { name: 'إقليم شبيلي السفلى', nameEn: 'Lower Shabelle', cities: [
        { name: 'مركة', nameEn: 'Merca', code: 'SO-05-001' },
        { name: 'براوة', nameEn: 'Baraawe', code: 'SO-05-002' }
      ]},
      { name: 'إقليم شبيلي الوسطى', nameEn: 'Middle Shabelle', cities: [
        { name: 'جوهر', nameEn: 'Jowhar', code: 'SO-06-001' },
        { name: 'بلعد', nameEn: 'Balad', code: 'SO-06-002' }
      ]},
      { name: 'إقليم هيران', nameEn: 'Hiran Region', cities: [
        { name: 'بيدوا', nameEn: 'Beledweyne', code: 'SO-07-001' }
      ]},
      { name: 'إقليم باي وباكول', nameEn: 'Bay and Bakool', cities: [
        { name: 'بيدوا', nameEn: 'Baidoa', code: 'SO-08-001' },
        { name: 'تيجيغلوف', nameEn: 'Tieglow', code: 'SO-08-002' }
      ]},
      { name: 'إقليم مودج', nameEn: 'Mudug Region', cities: [
        { name: 'غالكعيو', nameEn: 'Galkayo', code: 'SO-09-001' }
      ]},
      { name: 'إقليم نوجال', nameEn: 'Nugal Region', cities: [
        { name: 'جرتسي', nameEn: 'Garowe', code: 'SO-10-001' },
        { name: 'أيل', nameEn: 'Eyl', code: 'SO-10-002' }
      ]},
      { name: 'إقليم توجر', nameEn: 'Togdheer Region', cities: [
        { name: 'برعو', nameEn: 'Burao', code: 'SO-11-001' }
      ]},
      { name: 'إقليم صول', nameEn: 'Sool Region', cities: [
        { name: 'لاسعانود', nameEn: 'Las Anod', code: 'SO-12-001' }
      ]},
      { name: 'إقليم سناج', nameEn: 'Sanaag Region', cities: [
        { name: 'إريغافو', nameEn: 'Erigavo', code: 'SO-13-001' }
      ]}
    ]
  },

  MR: {
    code: 'MR',
    name: 'موريتانيا',
    nameEn: 'Mauritania',
    flag: '🇲🇷',
    governorates: [
      { name: 'ولاية نواكشوط الغربية', nameEn: 'Nouakchott-Ouest', cities: [
        { name: 'نواكشوط', nameEn: 'Nouakchott', code: 'MR-01-001' }
      ]},
      { name: 'ولاية نواكشوط الجنوبية', nameEn: 'Nouakchott-Sud', cities: [
        { name: 'نواكشوط الجنوبية', nameEn: 'Nouakchott South', code: 'MR-02-001' }
      ]},
      { name: 'ولاية نواكشوط الشمالية', nameEn: 'Nouakchott-Nord', cities: [
        { name: 'نواكشوط الشمالية', nameEn: 'Nouakchott North', code: 'MR-03-001' }
      ]},
      { name: 'ولاية الحوض الغربي', nameEn: 'Hodh El Gharbi', cities: [
        { name: 'ألاك', nameEn: 'Aleg', code: 'MR-04-001' },
        { name: 'كيفة', nameEn: 'Kiffa', code: 'MR-04-002' }
      ]},
      { name: 'ولاية الحوض الشرقي', nameEn: 'Hodh Ech Chargui', cities: [
        { name: 'نجامينا', nameEn: 'Nema', code: 'MR-05-001' }
      ]},
      { name: 'ولاية اترارزة', nameEn: 'Trarza', cities: [
        { name: 'روصو', nameEn: 'Rosso', code: 'MR-06-001' },
        { name: 'بوتلميت', nameEn: 'Boutilimit', code: 'MR-06-002' }
      ]},
      { name: 'ولاية أدرار', nameEn: 'Adrar', cities: [
        { name: 'أطار', nameEn: 'Atar', code: 'MR-07-001' }
      ]},
      { name: 'ولاية داخلت نواذيبو', nameEn: 'Dakhlet Nouadhibou', cities: [
        { name: 'نواذيبو', nameEn: 'Nouadhibou', code: 'MR-08-001' }
      ]},
      { name: 'ولاية تاجانت', nameEn: 'Tagant', cities: [
        { name: 'تشكيت', nameEn: 'Tichit', code: 'MR-09-001' }
      ]},
      { name: 'ولاية العصابة', nameEn: 'Assaba', cities: [
        { name: 'كيفة', nameEn: 'Kiffa', code: 'MR-10-001' }
      ]},
      { name: 'ولاية غورغول', nameEn: 'Gorgol', cities: [
        { name: 'كيهيدي', nameEn: 'Kaedi', code: 'MR-11-001' }
      ]},
      { name: 'ولاية براكنة', nameEn: 'Brakna', cities: [
        { name: 'ألاك', nameEn: 'Aleg', code: 'MR-12-001' }
      ]},
      { name: 'ولاية لبراكنة', nameEn: 'Guidimaka', cities: [
        { name: 'سيليبابي', nameEn: 'Selibaby', code: 'MR-13-001' }
      ]},
      { name: 'ولاية إينشيري', nameEn: 'Inchiri', cities: [
        { name: 'أكجوجت', nameEn: 'Akjoujt', code: 'MR-14-001' }
      ]}
    ]
  },

  KM: {
    code: 'KM',
    name: 'جزر القمر',
    nameEn: 'Comoros',
    flag: '🇰🇲',
    governorates: [
      { name: 'جزيرة نجازيجا', nameEn: 'Grande Comore', cities: [
        { name: 'موروني', nameEn: 'Moroni', code: 'KM-01-001' },
        { name: 'ميتساميولي', nameEn: 'Mitsamiouli', code: 'KM-01-002' },
        { name: 'فومبوني', nameEn: 'Fomboni', code: 'KM-01-003' }
      ]},
      { name: 'جزيرة موالي', nameEn: 'Mohéli', cities: [
        { name: 'فومبوني', nameEn: 'Fomboni', code: 'KM-02-001' }
      ]},
      { name: 'جزيرة أنجوان', nameEn: 'Anjouan', cities: [
        { name: 'موتسامودو', nameEn: 'Mutsamudu', code: 'KM-03-001' },
        { name: 'دوموني', nameEn: 'Domoni', code: 'KM-03-002' }
      ]}
    ]
  }
};

// Make available in both CommonJS and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ARAB_COUNTRIES_GEO };
}
if (typeof window !== 'undefined') {
  window.ARAB_COUNTRIES_GEO = ARAB_COUNTRIES_GEO;
}
