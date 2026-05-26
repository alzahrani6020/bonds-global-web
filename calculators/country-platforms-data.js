/**
 * Country & Platform Data for Bonds Global Restaurant Calculator
 * Covers all 22 Arab countries with ALL delivery platforms, commissions, currencies
 * Research sources: Public filings, news reports, platform disclosures (2025–2026)
 * Commission rates are estimates based on regional norms where undisclosed.
 */

var COUNTRIES_DATA = {
  SA: {
    name: 'السعودية',
    nameEn: 'Saudi Arabia',
    flag: '🇸🇦',
    currency: 'SAR',
    currencySymbol: 'ر.س',
    currencySymbolEn: 'SAR',
    platforms: [
      { id: 'plat_hunger', name: 'هنقرستيشن', nameEn: 'HungerStation', fee: 22 },
      { id: 'plat_jahez', name: 'جاهز', nameEn: 'Jahez', fee: 20 },
      { id: 'plat_mrsoul', name: 'مرسول', nameEn: 'Mrsool', fee: 15 },
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 25 },
      { id: 'plat_to_you', name: 'تويو', nameEn: 'ToYou', fee: 18 },
      { id: 'plat_the_chefz', name: 'ذا شفز', nameEn: 'The Chefz', fee: 25 },
      { id: 'plat_shgardi', name: 'شقردي', nameEn: 'Shgardi', fee: 18 },
      { id: 'plat_daily_mealz', name: 'ديلي ميلز', nameEn: 'DailyMealz', fee: 0 },
      { id: 'plat_lugmety', name: 'لقمتي', nameEn: 'Lugmety', fee: 18 },
      { id: 'plat_burgerizzr', name: 'برجريززر', nameEn: 'Burgerizzr', fee: 18 },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15 },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22 },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15 },
      { id: 'plat_ninja', name: 'نينجا', nameEn: 'Ninja', fee: 15 },
      { id: 'plat_get_cari', name: 'كاري', nameEn: 'Get Cari', fee: 18 },
      { id: 'plat_ngwah', name: 'نجوة', nameEn: 'Ngwah', fee: 18 },
      { id: 'plat_calo', name: 'كالو', nameEn: 'Calo', fee: 0 },
      { id: 'plat_freshhouse', name: 'فرش هاوس', nameEn: 'Freshhouse', fee: 0 },
      { id: 'plat_right_bite', name: 'رايت بايت', nameEn: 'Right Bite', fee: 0 },
      { id: 'plat_amazon', name: 'أمازون برايم', nameEn: 'Amazon Prime Now', fee: 18 },
      { id: 'plat_wssel', name: 'وصّل', nameEn: 'Wssel', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'هنقرستيشن السائد (~65% سوق). كيتا (ميتوان الصينية) دخلت بقوة 2024. جاهز استحوذ على ذا شفز وسنونو. هيئة المنافسة أصدرت توجيهات ضد الممارسات الاحتكارية (مارس 2025).',
    noteEn: 'HungerStation dominates (~65% market). Keeta (Meituan China) entered aggressively in 2024. Jahez acquired The Chefz and Snoonu. GAC issued anti-competitive guidelines (Mar 2025).'
  },
  AE: {
    name: 'الإمارات',
    nameEn: 'UAE',
    flag: '🇦🇪',
    currency: 'AED',
    currencySymbol: 'د.إ',
    currencySymbolEn: 'AED',
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22 },
      { id: 'plat_deliveroo', name: 'ديليفرو', nameEn: 'Deliveroo', fee: 28 },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22 },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15 },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15 },
      { id: 'plat_zomato', name: 'زوماتو', nameEn: 'Zomato', fee: 22 },
      { id: 'plat_eat_easy', name: 'إيت إيزي', nameEn: 'EatEasy', fee: 18 },
      { id: 'plat_munch_on', name: 'مانش أون', nameEn: 'Munch:on', fee: 18 },
      { id: 'plat_insta_shop', name: 'إنستا شوب', nameEn: 'InstaShop', fee: 18 },
      { id: 'plat_smiles', name: 'سمايلز', nameEn: 'Smiles', fee: 18 },
      { id: 'plat_carriage', name: 'كاريدج', nameEn: 'Carriage', fee: 22 },
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 25 },
      { id: 'plat_supermeal', name: 'سوبرميل', nameEn: 'Supermeal', fee: 18 },
      { id: 'plat_cari', name: 'كاري', nameEn: 'Cari', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'ديليفرو استحوذت عليها DoorDash (أكتوبر 2025) لكنها تعمل كعلامة منفصلة. الإمارات ألزمت المنصات بالشفافية في خوارزميات الترتيب (سبتمبر 2025). أوبر إيتس غير موجود.',
    noteEn: 'Deliveroo acquired by DoorDash (Oct 2025) but operates as separate brand. UAE mandated platform algorithm transparency (Sep 2025). Uber Eats not operating.'
  },
  KW: {
    name: 'الكويت',
    nameEn: 'Kuwait',
    flag: '🇰🇼',
    currency: 'KWD',
    currencySymbol: 'د.ك',
    currencySymbolEn: 'KWD',
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 20 },
      { id: 'plat_carriage', name: 'كاريدج', nameEn: 'Carriage', fee: 22 },
      { id: 'plat_deliveroo', name: 'ديليفرو', nameEn: 'Deliveroo', fee: 28 },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15 },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22 },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15 },
      { id: 'plat_daily_mealz', name: 'ديلي ميلز', nameEn: 'DailyMealz', fee: 0 },
      { id: 'plat_mashkor', name: 'مشكور', nameEn: 'Mashkor', fee: 18 },
      { id: 'plat_raha', name: 'رهة / شوب رهة', nameEn: 'Raha / ShopRaha', fee: 18 },
      { id: 'plat_cari', name: 'كاري', nameEn: 'Cari', fee: 18 },
      { id: 'plat_armada', name: 'أرمادا', nameEn: 'Armada', fee: 15 },
      { id: 'plat_to_you', name: 'تويو', nameEn: 'ToYou', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'الكويت حدّت العمولات بقرار وزاري (فبراير 2026) لمدة 3 سنوات. طلبات تأسست في الكويت 2004. كاريدج تأسست 2016.',
    noteEn: 'Kuwait capped commissions by ministerial decree (Feb 2026) for 3 years. Talabat founded in Kuwait 2004. Carriage founded 2016.'
  },
  QA: {
    name: 'قطر',
    nameEn: 'Qatar',
    flag: '🇶🇦',
    currency: 'QAR',
    currencySymbol: 'ر.ق',
    currencySymbolEn: 'QAR',
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22 },
      { id: 'plat_carriage', name: 'كاريدج', nameEn: 'Carriage', fee: 22 },
      { id: 'plat_snoonu', name: 'سنونو', nameEn: 'Snoonu', fee: 18 },
      { id: 'plat_rafeeq', name: 'رفيق', nameEn: 'Rafeeq', fee: 18 },
      { id: 'plat_fingertips', name: 'فينجرتيبس', nameEn: 'Fingertips', fee: 18 },
      { id: 'plat_akly', name: 'أكلي', nameEn: 'Akly', fee: 18 },
      { id: 'plat_foodak', name: 'فوداك', nameEn: 'Foodak', fee: 18 },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15 },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22 },
      { id: 'plat_mrsoul', name: 'مرسول', nameEn: 'Mrsool', fee: 15 },
      { id: 'plat_jeeb', name: 'جيب', nameEn: 'Jeeb', fee: 18 },
      { id: 'plat_rafiki', name: 'رفيقي', nameEn: 'Rafiki', fee: 18 },
      { id: 'plat_eat_easy', name: 'إيت إيزي', nameEn: 'EatEasy', fee: 18 },
      { id: 'plat_uber', name: 'أوبر إيتس', nameEn: 'Uber Eats', fee: 20 },
      { id: 'plat_clicks', name: 'كليكس', nameEn: 'Clicks', fee: 5 },
      { id: 'plat_baqaala', name: 'بقالة', nameEn: 'Baqaala', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'سنونو قطري محلي (استحوذت عليه جاهز 76.56%). طلبات غُرّمت 1.14 مليون ر.ق (2025). ديليفرو أغلقت قطر (مارس 2026). كليكس تأخذ رسوم توصيل فقط.',
    noteEn: 'Snoonu is Qatari-local (Jahez acquired 76.56%). Talabat fined QAR 1.14M (2025). Deliveroo shut Qatar (Mar 2026). Clicks charges delivery fee only.'
  },
  BH: {
    name: 'البحرين',
    nameEn: 'Bahrain',
    flag: '🇧🇭',
    currency: 'BHD',
    currencySymbol: 'د.ب',
    currencySymbolEn: 'BHD',
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22 },
      { id: 'plat_hunger', name: 'هنقرستيشن', nameEn: 'HungerStation', fee: 22 },
      { id: 'plat_jahez', name: 'جاهز', nameEn: 'Jahez', fee: 20 },
      { id: 'plat_deliveroo', name: 'ديليفرو', nameEn: 'Deliveroo', fee: 28 },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22 },
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 25 },
      { id: 'plat_eat_easy', name: 'إيت إيزي', nameEn: 'EatEasy', fee: 18 },
      { id: 'plat_wssel', name: 'وصّل', nameEn: 'Wssel', fee: 18 },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15 },
      { id: 'plat_burgerizzr', name: 'برجريززر', nameEn: 'Burgerizzr', fee: 18 },
      { id: 'plat_ninja_kitchen', name: 'نينجا كيتشن', nameEn: 'Ninja Kitchen', fee: 15 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'طلبات تملك ~60%+ سوق البحرين. جاهز نما 50% سنوياً بعد 2025. نينجا كيتشن تجرب توصيل بالدرونات (2026).',
    noteEn: 'Talabat owns ~60%+ Bahrain market. Jahez grew 50% YoY post-2025. Ninja Kitchen drone pilot (2026).'
  },
  OM: {
    name: 'عمان',
    nameEn: 'Oman',
    flag: '🇴🇲',
    currency: 'OMR',
    currencySymbol: 'ر.ع',
    currencySymbolEn: 'OMR',
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22 },
      { id: 'plat_carriage', name: 'كاريدج', nameEn: 'Carriage', fee: 22 },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22 },
      { id: 'plat_wssel', name: 'وصّل', nameEn: 'Wssel', fee: 18 },
      { id: 'plat_lugmety', name: 'لقمتي', nameEn: 'Lugmety', fee: 18 },
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 22 },
      { id: 'plat_zomato', name: 'زوماتو', nameEn: 'Zomato', fee: 22 },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15 },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'أقل عدد سكان بين دول الخليج. طلبات هي السائد. كيتا أعلنت نيتها التوسع للبحرين وعمان.',
    noteEn: 'Smallest GCC population. Talabat is dominant. Keeta announced expansion plans for Bahrain and Oman.'
  },
  EG: {
    name: 'مصر',
    nameEn: 'Egypt',
    flag: '🇪🇬',
    currency: 'EGP',
    currencySymbol: 'ج.م',
    currencySymbolEn: 'EGP',
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22 },
      { id: 'plat_elmenus', name: 'إلمينيوز', nameEn: 'Elmenus', fee: 16 },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22 },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15 },
      { id: 'plat_mrsoul', name: 'مرسول', nameEn: 'Mrsool', fee: 18 },
      { id: 'plat_bolt', name: 'بولت فود', nameEn: 'Bolt Food', fee: 18 },
      { id: 'plat_otlob', name: 'أطلب', nameEn: 'Otlob', fee: 22 },
      { id: 'plat_insta_shop', name: 'إنستا شوب', nameEn: 'InstaShop', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'طلبات هي السائد (أدرجت في دبي 2024). إلمينيوز منافس مصري محلي قوي. السوق ~3.9 مليار دولار (2025). أوبر إيتس وزوماتو انسحبتا.',
    noteEn: 'Talabat dominant (IPO\'d Dubai 2024). Elmenus strong Egyptian-local competitor. Market ~$3.9B (2025). Uber Eats and Zomato exited.'
  },
  JO: {
    name: 'الأردن',
    nameEn: 'Jordan',
    flag: '🇯🇴',
    currency: 'JOD',
    currencySymbol: 'د.أ',
    currencySymbolEn: 'JOD',
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22 },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22 },
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 25 },
      { id: 'plat_jahez', name: 'جاهز', nameEn: 'Jahez', fee: 20 },
      { id: 'plat_aroundtown', name: 'أراوند تاون', nameEn: 'Aroundtown', fee: 18 },
      { id: 'plat_sabag', name: 'صباغ', nameEn: 'Sabag', fee: 18 },
      { id: 'plat_kaasak', name: 'قعسك', nameEn: 'Kaasak', fee: 18 },
      { id: 'plat_bilforon', name: 'بالفرن', nameEn: 'Bilforon', fee: 15 },
      { id: 'plat_noor_healthy', name: 'نور هيلثي', nameEn: 'Noor Healthy', fee: 15 },
      { id: 'plat_basket_jo', name: 'باسكت دوت جو', nameEn: 'Basket.Jo', fee: 15 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'توترز له حضور قوي في الأردن ولبنان. جاهز تتوسع إقليمياً. صباغ وبالفرن محليون أردنيون.',
    noteEn: 'Toters has strong presence in Jordan and Lebanon. Jahez expanding regionally. Sabag and Bilforon are Jordanian-local.'
  },
  IQ: {
    name: 'العراق',
    nameEn: 'Iraq',
    flag: '🇮🇶',
    currency: 'IQD',
    currencySymbol: 'د.ع',
    currencySymbolEn: 'IQD',
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22 },
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 25 },
      { id: 'plat_careem', name: 'كريم', nameEn: 'Careem', fee: 22 },
      { id: 'plat_talabati', name: 'طلباتي', nameEn: 'Talabati', fee: 18 },
      { id: 'plat_alsaree3', name: 'السريع', nameEn: 'Alsaree3', fee: 18 },
      { id: 'plat_mrsoul', name: 'مرسول', nameEn: 'Mrsool', fee: 18 },
      { id: 'plat_wasalt', name: 'وصّلت', nameEn: 'Wasalt', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'طلباتي والسريع عراقيان محليان. توترز وطلبات يتنافسان بقوة. الدفع عند الاستلام هو السائد.',
    noteEn: 'Talabati and Alsaree3 are Iraqi-local. Toters and Talabat compete aggressively. Cash on delivery dominates.'
  },
  LB: {
    name: 'لبنان',
    nameEn: 'Lebanon',
    flag: '🇱🇧',
    currency: 'LBP',
    currencySymbol: 'ل.ل',
    currencySymbolEn: 'LBP',
    platforms: [
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 30 },
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 28 },
      { id: 'plat_foodics', name: 'فودكس أونلاين', nameEn: 'Foodics Online', fee: 0 },
      { id: 'plat_wakilni', name: 'وكيلني', nameEn: 'Wakilni', fee: 5 },
      { id: 'plat_nasnous', name: 'نسنوس', nameEn: 'Nasnous', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'وكيلني يأخذ رسوم توصيل (2–6$) لا عمولة. العمولات عالية بسبب الأزمة (تصل 45–50% مع التسويق). ديليفرو انسحبت 2022.',
    noteEn: 'Wakilni charges delivery fees ($2–6) not commission. High commissions due to crisis (up to 45–50% with marketing). Deliveroo exited 2022.'
  },
  SY: {
    name: 'سوريا',
    nameEn: 'Syria',
    flag: '🇸🇾',
    currency: 'SYP',
    currencySymbol: 'ل.س',
    currencySymbolEn: 'SYP',
    platforms: [
      { id: 'plat_beeorder', name: 'بي أوردر', nameEn: 'Beeorder', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'السوق السوري محدود التطبيقات. بي أوردر هو الأبرز محلياً (~120,000 طلب/شهر). لا توجد تطبيقات دولية بسبب العقوبات.',
    noteEn: 'Syrian market has limited apps. Beeorder is most prominent locally (~120,000 orders/month). No international apps due to sanctions.'
  },
  PS: {
    name: 'فلسطين',
    nameEn: 'Palestine',
    flag: '🇵🇸',
    currency: 'USD',
    currencySymbol: '$',
    currencySymbolEn: 'USD',
    platforms: [
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 25 },
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'السوق الفلسطيني متأثر بالوضع السياسي. توترز الأبرز في الضفة. غزة: التوصيل التجاري منهار تقريباً.',
    noteEn: 'Palestinian market affected by political situation. Toters dominant in West Bank. Gaza: commercial delivery largely collapsed.'
  },
  TN: {
    name: 'تونس',
    nameEn: 'Tunisia',
    flag: '🇹🇳',
    currency: 'TND',
    currencySymbol: 'د.ت',
    currencySymbolEn: 'TND',
    platforms: [
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 28 },
      { id: 'plat_yassir', name: 'ياسير', nameEn: 'Yassir', fee: 18 },
      { id: 'plat_jumia', name: 'جوميا فود', nameEn: 'Jumia Food', fee: 14 },
      { id: 'plat_bolt', name: 'بولت فود', nameEn: 'Bolt Food', fee: 18 },
      { id: 'plat_local', name: 'تطبيقات محلية', nameEn: 'Local Apps', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'ياسير سوبر-أب جزائري يتوسع في تونس. جوميا فود يقلص عملياته في شمال إفريقيا. غلوفو هي الأبرز.',
    noteEn: 'Yassir Algerian super-app expanding in Tunisia. Jumia Food scaling back in North Africa. Glovo is dominant.'
  },
  DZ: {
    name: 'الجزائر',
    nameEn: 'Algeria',
    flag: '🇩🇿',
    currency: 'DZD',
    currencySymbol: 'د.ج',
    currencySymbolEn: 'DZD',
    platforms: [
      { id: 'plat_yassir', name: 'ياسير', nameEn: 'Yassir', fee: 15 },
      { id: 'plat_temtem', name: 'تمتم وان', nameEn: 'Temtem One', fee: 18 },
      { id: 'plat_felhanout', name: 'فلحانوت', nameEn: 'Felhanout', fee: 3 },
      { id: 'plat_nresto', name: 'ان رستو', nameEn: 'NResto', fee: 0 },
      { id: 'plat_ndeliv', name: 'ان ديليف', nameEn: 'Ndeliv', fee: 18 },
      { id: 'plat_jumia', name: 'جوميا فود', nameEn: 'Jumia Food', fee: 14 },
      { id: 'plat_heetch', name: 'هيتش', nameEn: 'Heetch', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'ياسير السائد (8 مليون مستخدم، 45 مدينة). تمتم وان منافس جزائري (~5.7M تمويل). فلحانوت نموذج SaaS جديد (3% فقط).',
    noteEn: 'Yassir dominant (8M users, 45 cities). Temtem One Algerian challenger (~$5.7M funding). Felhanout new SaaS model (3% only).'
  },
  MA: {
    name: 'المغرب',
    nameEn: 'Morocco',
    flag: '🇲🇦',
    currency: 'MAD',
    currencySymbol: 'د.م',
    currencySymbolEn: 'MAD',
    platforms: [
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 30 },
      { id: 'plat_jumia', name: 'جوميا فود', nameEn: 'Jumia Food', fee: 14 },
      { id: 'plat_kooul', name: 'كول', nameEn: 'Kooul', fee: 20 },
      { id: 'plat_heetch', name: 'هيتش', nameEn: 'Heetch', fee: 18 },
      { id: 'plat_kaalix', name: 'كاليكس', nameEn: 'Kaalix', fee: 18 },
      { id: 'plat_allo_smile', name: 'الو سمايل', nameEn: 'Allo Smail', fee: 18 },
      { id: 'plat_natsakharlik', name: 'ناتساخارليك', nameEn: 'Natsakharlik', fee: 18 },
      { id: 'plat_jibli_m3ak', name: 'جيبلي معاك', nameEn: 'Jibli-m3ak', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'المغرب حدّت غلوفو عند 30% بقرار حكومي (2024-2025). غلوفو (58% استخدام) وجوميا (41%). كول قدم الشكوى ضد غلوفو.',
    noteEn: 'Morocco capped Glovo at 30% by government decree (2024-2025). Glovo (58% usage) and Jumia (41%). Kooul filed complaint against Glovo.'
  },
  LY: {
    name: 'ليبيا',
    nameEn: 'Libya',
    flag: '🇱🇾',
    currency: 'LYD',
    currencySymbol: 'د.ل',
    currencySymbolEn: 'LYD',
    platforms: [
      { id: 'plat_jumia', name: 'جوميا فود', nameEn: 'Jumia Food', fee: 14 },
      { id: 'plat_foodchow', name: 'فودتشاو', nameEn: 'FoodChow', fee: 18 },
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 25 },
      { id: 'plat_bolt', name: 'بولت فود', nameEn: 'Bolt Food', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'السوق الليبي متقطع. جوميا تقلصت. غالبية الطلبات مباشرة أو عبر واتساب وفيسبوك. لا يوجد تطبيق سائد.',
    noteEn: 'Libyan market is fragmented. Jumia scaled back. Most orders are direct or via WhatsApp/Facebook. No dominant app.'
  },
  SD: {
    name: 'السودان',
    nameEn: 'Sudan',
    flag: '🇸🇩',
    currency: 'SDG',
    currencySymbol: 'ج.س',
    currencySymbolEn: 'SDG',
    platforms: [
      { id: 'plat_nine', name: 'ناين', nameEn: 'Nine', fee: 18 },
      { id: 'plat_halan', name: 'حالاً', nameEn: 'Halan', fee: 18 },
      { id: 'plat_foodchow', name: 'فودتشاو', nameEn: 'FoodChow', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'ناين محلي سوداني (2,500+ مطعم في الخرطوم). حالاً مصري-سوداني (10M+ رحلة). الدفع بزين كاش وموكاش. لا توجد تطبيقات دولية.',
    noteEn: 'Nine is Sudanese-local (2,500+ restaurants in Khartoum). Halan is Egyptian-Sudanese (10M+ rides). Payments via Zain Cash and mBOK. No international apps.'
  },
  YE: {
    name: 'اليمن',
    nameEn: 'Yemen',
    flag: '🇾🇪',
    currency: 'YER',
    currencySymbol: 'ر.ي',
    currencySymbolEn: 'YER',
    platforms: [
      { id: 'plat_wagbat', name: 'واجبات', nameEn: 'Wagbat', fee: 18 },
      { id: 'plat_tamween', name: 'تموين', nameEn: 'Tamween', fee: 18 },
      { id: 'plat_ana_mehani', name: 'أنا مهني', nameEn: 'Ana Mehani', fee: 20 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'واجبات أبرز التطبيقات في صنعاء (~120 مطعم، 26 دراجة). العمولات غير معلنة — التقديرات تقريبية. لا توجد تطبيقات دولية.',
    noteEn: 'Wagbat is most prominent in Sanaa (~120 restaurants, 26 cyclists). Commissions undisclosed — estimates are approximate. No international apps.'
  },
  DJ: {
    name: 'جيبوتي',
    nameEn: 'Djibouti',
    flag: '🇩🇯',
    currency: 'DJF',
    currencySymbol: 'ف.ج',
    currencySymbolEn: 'DJF',
    platforms: [
      { id: 'plat_kiki', name: 'كيكي دروب', nameEn: 'KiKi Drop', fee: 18 },
      { id: 'plat_foodchow', name: 'فودتشاو', nameEn: 'FoodChow', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'كيكي دروب سوبر-أب جيبوتي محلي. السوق صغير جداً. لا توجد تطبيقات دولية.',
    noteEn: 'KiKi Drop is Djiboutian local super-app. Very small market. No international apps.'
  },
  SO: {
    name: 'الصومال',
    nameEn: 'Somalia',
    flag: '🇸🇴',
    currency: 'SOS',
    currencySymbol: 'ش.ص',
    currencySymbolEn: 'SOS',
    platforms: [
      { id: 'plat_rikaab', name: 'ريكاب', nameEn: 'Rikaab', fee: 18 },
      { id: 'plat_gulivery', name: 'جوليفري', nameEn: 'Gulivery', fee: 5 },
      { id: 'plat_foodchow', name: 'فودتشاو', nameEn: 'FoodChow', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'ريكاب سوبر-أب صومالي (100,000+ عميل، 5,000+ سائق). جوليفري يأخذ رسوم توصيل (1–5$) لا عمولة. السوق متنامي.',
    noteEn: 'Rikaab is Somali super-app (100K+ clients, 5,000+ drivers). Gulivery charges delivery fees ($1–5) not commission. Growing market.'
  },
  MR: {
    name: 'موريتانيا',
    nameEn: 'Mauritania',
    flag: '🇲🇷',
    currency: 'MRU',
    currencySymbol: 'أ.م',
    currencySymbolEn: 'MRU',
    platforms: [
      { id: 'plat_jemli', name: 'جملي', nameEn: 'Jemli', fee: 18 },
      { id: 'plat_wejabat', name: 'وجبات', nameEn: 'Wejabat', fee: 18 },
      { id: 'plat_general_livraison', name: 'جنرال ليفريزون', nameEn: 'General Livraison', fee: 18 },
      { id: 'plat_addanam', name: 'عدانم', nameEn: 'Addanam', fee: 18 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'جملي السائد في نواكشوط (2M+ مستخدم). وجبات منافس جديد. عدانم فائز بتحدي الابتكار الموريتاني. لا توجد تطبيقات دولية.',
    noteEn: 'Jemli dominant in Nouakchott (2M+ users). Wejabat is a newer competitor. Addanam won Mauritania Innovation Challenge. No international apps.'
  },
  KM: {
    name: 'جزر القمر',
    nameEn: 'Comoros',
    flag: '🇰🇲',
    currency: 'KMF',
    currencySymbol: 'ف.ق',
    currencySymbolEn: 'KMF',
    platforms: [
      { id: 'plat_sahilkom', name: 'ساهيلكوم', nameEn: 'Sahilkom', fee: 15 },
      { id: 'plat_foodcom', name: 'فودكوم كي أم', nameEn: 'Foodcom KM', fee: 15 },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0 }
    ],
    note: 'سوق التوصيل ناشئ جداً. ساهيلكوم وفودكوم كي أم محليان. لا توجد تطبيقات دولية.',
    noteEn: 'Delivery market is very nascent. Sahilkom and Foodcom KM are local. No international apps.'
  }
};

// Default country
var DEFAULT_COUNTRY = 'SA';
