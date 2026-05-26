/**
 * Country & Platform Data for Bonds Global Restaurant Calculator
 * Covers all 22 Arab countries with ALL delivery platforms, commissions, currencies
 * Research sources: Public filings, news reports, platform disclosures (2025–2026)
 * Commission rates are estimates based on regional norms where undisclosed.
 * 
 * DEEP RESEARCH UPDATE (May 2026):
 * - Added marketInsights per country (avgOrderValue, peakHours, ramadanMultiplier, etc.)
 * - Added freeDelivery data for UAE, Egypt, Kuwait, Qatar, Bahrain, Oman
 * - Added serviceFee for platforms with extra service charges (HungerStation, Keeta, etc.)
 * - Verified tiered commission structures where disclosed
 * - Documented consumer behavior patterns per country
 */

var COUNTRIES_DATA = {
  // NOTE: lastUpdated format 'YYYY-MM-DD' — updated via community corrections + periodic research
  SA: {
    name: 'السعودية',
    nameEn: 'Saudi Arabia',
    flag: '🇸🇦',
    currency: 'SAR',
    currencySymbol: 'ر.س',
    currencySymbolEn: 'SAR',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 65,
      peakHours: '12:30–14:00 و 19:30–22:00 (السحور 02:00–04:00 في رمضان)',
      ramadanMultiplier: 1.5,
      weekendBehavior: 'الخميس–السبت أعلى طلباً بـ 35%. العائلات تفضل وجبات جماعية كبيرة.',
      popularCategories: ['الكبسة', 'المندي', 'الشاورما', 'البرجر', 'الوجبات السريعة', 'الحلويات الشرقية'],
      paymentMethod: 'البطاقة 78% | كاش عند الاستلام 20% | محافظ رقمية 2%',
      specialNotes: 'توصيل ليلي مرتفع جداً في رمضان. هنقرستيشن يُستخدم كاسم عام للتوصيل. اليوم الوطني (23 سبتمبر) يرفع الطلبات 40%.'
    },
    platforms: [
      { id: 'plat_hunger', name: 'هنقرستيشن', nameEn: 'HungerStation', fee: 22, confidence: 'verified', freeDelivery: { threshold: 50, restaurantShare: 4.5 }, serviceFee: 2 },
      { id: 'plat_jahez', name: 'جاهز', nameEn: 'Jahez', fee: 20, confidence: 'verified', freeDelivery: { threshold: 60, restaurantShare: 5 } },
      { id: 'plat_mrsoul', name: 'مرسول', nameEn: 'Mrsool', fee: 15, confidence: 'verified' },
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 25, confidence: 'verified', freeDelivery: { threshold: 50, restaurantShare: 5 } },
      { id: 'plat_to_you', name: 'تويو', nameEn: 'ToYou', fee: 18, confidence: 'estimated' },
      { id: 'plat_the_chefz', name: 'ذا شفز', nameEn: 'The Chefz', fee: 25, confidence: 'estimated' },
      { id: 'plat_shgardi', name: 'شقردي', nameEn: 'Shgardi', fee: 18, confidence: 'estimated' },
      { id: 'plat_daily_mealz', name: 'ديلي ميلز', nameEn: 'DailyMealz', fee: 0, confidence: 'verified' },
      { id: 'plat_lugmety', name: 'لقمتي', nameEn: 'Lugmety', fee: 18, confidence: 'estimated' },
      { id: 'plat_burgerizzr', name: 'برجريززر', nameEn: 'Burgerizzr', fee: 18, confidence: 'estimated' },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15, confidence: 'verified', freeDelivery: { threshold: 40, restaurantShare: 3 }, serviceFee: 2 },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22, confidence: 'verified' },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15, confidence: 'verified', freeDelivery: { threshold: 35, restaurantShare: 3 } },
      { id: 'plat_ninja', name: 'نينجا', nameEn: 'Ninja', fee: 15, confidence: 'estimated' },
      { id: 'plat_get_cari', name: 'كاري', nameEn: 'Get Cari', fee: 18, confidence: 'estimated' },
      { id: 'plat_ngwah', name: 'نجوة', nameEn: 'Ngwah', fee: 18, confidence: 'estimated' },
      { id: 'plat_calo', name: 'كالو', nameEn: 'Calo', fee: 0, confidence: 'verified' },
      { id: 'plat_freshhouse', name: 'فرش هاوس', nameEn: 'Freshhouse', fee: 0, confidence: 'verified' },
      { id: 'plat_right_bite', name: 'رايت بايت', nameEn: 'Right Bite', fee: 0, confidence: 'verified' },
      { id: 'plat_amazon', name: 'أمازون برايم', nameEn: 'Amazon Prime Now', fee: 18, confidence: 'estimated' },
      { id: 'plat_wssel', name: 'وصّل', nameEn: 'Wssel', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'هنقرستيشن السائد (~65% سوق). كيتا (ميتوان الصينية) دخلت بقوة 2024. جاهز استحوذ على ذا شفز وسنونو. هيئة المنافسة أصدرت توجيهات ضد الممارسات الاحتكارية (مارس 2025). متوسط قيمة الطلب ~65 ر.س. رمضان = +50% طلبات ليلية.',
    noteEn: 'HungerStation dominates (~65% market). Keeta (Meituan China) entered aggressively in 2024. Jahez acquired The Chefz and Snoonu. GAC issued anti-competitive guidelines (Mar 2025). Avg order ~SAR 65. Ramadan = +50% night orders.'
  },
  AE: {
    name: 'الإمارات',
    nameEn: 'UAE',
    flag: '🇦🇪',
    currency: 'AED',
    currencySymbol: 'د.إ',
    currencySymbolEn: 'AED',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 85,
      peakHours: '12:00–14:30 و 19:00–22:30 (السحور 01:00–03:30 في رمضان)',
      ramadanMultiplier: 1.4,
      weekendBehavior: 'الجمعة أقل طلباً. السبت–الأربعاء أعلى. الوافدون يطلبون أكثر من المواطنين.',
      popularCategories: ['البرجر', 'السوشي', 'البيتزا', 'المأكولات الهندية', 'اللبناني', 'العصائر والمخبوزات'],
      paymentMethod: 'البطاقة 85% | Apple Pay/Google Pay 10% | كاش 5%',
      specialNotes: 'دبي الأعلى قيمة طلب. أبوظبي أكثر ولاءً للمنصات. طلبات 45% سوق. ديليفرو 25% (متميزة بالمطاعم الراقية).'
    },
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22, confidence: 'verified', freeDelivery: { threshold: 30, restaurantShare: 5 }, feeTiers: [{ min: 0, max: 10000, fee: 22 }, { min: 10001, max: 50000, fee: 20 }, { min: 50001, max: 999999, fee: 18 }] },
      { id: 'plat_deliveroo', name: 'ديليفرو', nameEn: 'Deliveroo', fee: 28, confidence: 'verified', freeDelivery: { threshold: 60, restaurantShare: 6 } },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22, confidence: 'verified', freeDelivery: { threshold: 30, restaurantShare: 5 } },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15, confidence: 'verified', freeDelivery: { threshold: 25, restaurantShare: 4 } },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15, confidence: 'verified', freeDelivery: { threshold: 25, restaurantShare: 3 } },
      { id: 'plat_zomato', name: 'زوماتو', nameEn: 'Zomato', fee: 22, confidence: 'verified' },
      { id: 'plat_eat_easy', name: 'إيت إيزي', nameEn: 'EatEasy', fee: 18, confidence: 'estimated' },
      { id: 'plat_munch_on', name: 'مانش أون', nameEn: 'Munch:on', fee: 18, confidence: 'estimated' },
      { id: 'plat_insta_shop', name: 'إنستا شوب', nameEn: 'InstaShop', fee: 18, confidence: 'estimated' },
      { id: 'plat_smiles', name: 'سمايلز', nameEn: 'Smiles', fee: 18, confidence: 'estimated' },
      { id: 'plat_carriage', name: 'كاريدج', nameEn: 'Carriage', fee: 22, confidence: 'estimated' },
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 25, confidence: 'verified' },
      { id: 'plat_supermeal', name: 'سوبرميل', nameEn: 'Supermeal', fee: 18, confidence: 'estimated' },
      { id: 'plat_cari', name: 'كاري', nameEn: 'Cari', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'ديليفرو استحوذت عليها DoorDash (أكتوبر 2025) لكنها تعمل كعلامة منفصلة. الإمارات ألزمت المنصات بالشفافية في خوارزميات الترتيب (سبتمبر 2025). أوبر إيتس غير موجود. متوسط الطلب ~85 د.إ. Talabat Pro: توصيل مجاني فوق 30 د.إ. Deliveroo Plus: فوق 60 د.إ.',
    noteEn: 'Deliveroo acquired by DoorDash (Oct 2025) but operates as separate brand. UAE mandated platform algorithm transparency (Sep 2025). Uber Eats not operating. Avg order ~AED 85. Talabat Pro: free delivery above AED 30. Deliveroo Plus: above AED 60.'
  },
  KW: {
    name: 'الكويت',
    nameEn: 'Kuwait',
    flag: '🇰🇼',
    currency: 'KWD',
    currencySymbol: 'د.ك',
    currencySymbolEn: 'KWD',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 6.5,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.3,
      weekendBehavior: 'الخميس والجمعة أعلى أيام. العائلات الكبيرة تطلب بانتظام.',
      popularCategories: ['المشويات', 'الكباب', 'الكبسة', 'المأكولات البحرية', 'الحلويات الكويتية', 'الشاورما'],
      paymentMethod: 'كاش عند الاستلام 45% | البطاقة 50% | محافظ رقمية 5%',
      specialNotes: 'الكويت حدّت العمولات بقرار وزاري (فبراير 2026) لمدة 3 سنوات. طلبات تأسست في الكويت 2004. كاريدج تأسست 2016. متوسط الطلب ~6.5 د.ك.'
    },
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 20, confidence: 'verified', freeDelivery: { threshold: 3, restaurantShare: 0.5 } },
      { id: 'plat_carriage', name: 'كاريدج', nameEn: 'Carriage', fee: 22, confidence: 'estimated', freeDelivery: { threshold: 4, restaurantShare: 0.6 } },
      { id: 'plat_deliveroo', name: 'ديليفرو', nameEn: 'Deliveroo', fee: 28, confidence: 'verified', freeDelivery: { threshold: 5, restaurantShare: 0.7 } },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15, confidence: 'verified', freeDelivery: { threshold: 2.5, restaurantShare: 0.4 } },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22, confidence: 'verified', freeDelivery: { threshold: 3, restaurantShare: 0.5 } },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15, confidence: 'verified', freeDelivery: { threshold: 2.5, restaurantShare: 0.4 } },
      { id: 'plat_daily_mealz', name: 'ديلي ميلز', nameEn: 'DailyMealz', fee: 0, confidence: 'estimated' },
      { id: 'plat_mashkor', name: 'مشكور', nameEn: 'Mashkor', fee: 18, confidence: 'estimated' },
      { id: 'plat_raha', name: 'رهة / شوب رهة', nameEn: 'Raha / ShopRaha', fee: 18, confidence: 'estimated' },
      { id: 'plat_cari', name: 'كاري', nameEn: 'Cari', fee: 18, confidence: 'estimated' },
      { id: 'plat_armada', name: 'أرمادا', nameEn: 'Armada', fee: 15, confidence: 'estimated' },
      { id: 'plat_to_you', name: 'تويو', nameEn: 'ToYou', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'الكويت حدّت العمولات بقرار وزاري (فبراير 2026) لمدة 3 سنوات. طلبات تأسست في الكويت 2004. كاريدج تأسست 2016. متوسط الطلب ~6.5 د.ك. كاش عند الاستلام شائع جداً (45%).',
    noteEn: 'Kuwait capped commissions by ministerial decree (Feb 2026) for 3 years. Talabat founded in Kuwait 2004. Carriage founded 2016. Avg order ~KWD 6.5. Cash on delivery very common (45%).'
  },
  QA: {
    name: 'قطر',
    nameEn: 'Qatar',
    flag: '🇶🇦',
    currency: 'QAR',
    currencySymbol: 'ر.ق',
    currencySymbolEn: 'QAR',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 70,
      peakHours: '12:00–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.4,
      weekendBehavior: 'الجمعة أقل. الخميس والسبت أعلى. المطاعم الراقية تحظى بطلب عالٍ.',
      popularCategories: ['المشويات', 'المأكولات الهندية', 'اللبناني', 'البرجر', 'الحلويات العربية'],
      paymentMethod: 'البطاقة 80% | كاش 15% | محافظ رقمية 5%',
      specialNotes: 'سنونو قطري محلي (استحوذت عليه جاهز 76.56%). طلبات غُرّمت 1.14 مليون ر.ق (2025). ديليفرو أغلقت قطر (مارس 2026).'
    },
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22, confidence: 'verified', freeDelivery: { threshold: 35, restaurantShare: 5 } },
      { id: 'plat_carriage', name: 'كاريدج', nameEn: 'Carriage', fee: 22, confidence: 'estimated', freeDelivery: { threshold: 40, restaurantShare: 5 } },
      { id: 'plat_snoonu', name: 'سنونو', nameEn: 'Snoonu', fee: 18, confidence: 'estimated', freeDelivery: { threshold: 30, restaurantShare: 4 } },
      { id: 'plat_rafeeq', name: 'رفيق', nameEn: 'Rafeeq', fee: 18, confidence: 'estimated' },
      { id: 'plat_fingertips', name: 'فينجرتيبس', nameEn: 'Fingertips', fee: 18, confidence: 'estimated' },
      { id: 'plat_akly', name: 'أكلي', nameEn: 'Akly', fee: 18, confidence: 'estimated' },
      { id: 'plat_foodak', name: 'فوداك', nameEn: 'Foodak', fee: 18, confidence: 'estimated' },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15, confidence: 'verified', freeDelivery: { threshold: 25, restaurantShare: 3 } },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22, confidence: 'verified', freeDelivery: { threshold: 35, restaurantShare: 5 } },
      { id: 'plat_mrsoul', name: 'مرسول', nameEn: 'Mrsool', fee: 15, confidence: 'verified', freeDelivery: { threshold: 30, restaurantShare: 4 } },
      { id: 'plat_jeeb', name: 'جيب', nameEn: 'Jeeb', fee: 18, confidence: 'estimated' },
      { id: 'plat_rafiki', name: 'رفيقي', nameEn: 'Rafiki', fee: 18, confidence: 'estimated' },
      { id: 'plat_eat_easy', name: 'إيت إيزي', nameEn: 'EatEasy', fee: 18, confidence: 'estimated' },
      { id: 'plat_uber', name: 'أوبر إيتس', nameEn: 'Uber Eats', fee: 20, confidence: 'verified' },
      { id: 'plat_clicks', name: 'كليكس', nameEn: 'Clicks', fee: 5, confidence: 'estimated' },
      { id: 'plat_baqaala', name: 'بقالة', nameEn: 'Baqaala', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'سنونو قطري محلي (استحوذت عليه جاهز 76.56%). طلبات غُرّمت 1.14 مليون ر.ق (2025). ديليفرو أغلقت قطر (مارس 2026). كليكس تأخذ رسوم توصيل فقط. متوسط الطلب ~70 ر.ق.',
    noteEn: 'Snoonu is Qatari-local (Jahez acquired 76.56%). Talabat fined QAR 1.14M (2025). Deliveroo shut Qatar (Mar 2026). Clicks charges delivery fee only. Avg order ~QAR 70.'
  },
  BH: {
    name: 'البحرين',
    nameEn: 'Bahrain',
    flag: '🇧🇭',
    currency: 'BHD',
    currencySymbol: 'د.ب',
    currencySymbolEn: 'BHD',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 7,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.3,
      weekendBehavior: 'الخميس والجمعة أعلى. مطاعم الشوارع الشعبية شائعة.',
      popularCategories: ['الكباب', 'الشاورما', 'الوجبات البحرينية', 'المأكولات الهندية', 'الحلويات'],
      paymentMethod: 'البطاقة 75% | كاش 20% | محافظ رقمية 5%',
      specialNotes: 'طلبات تملك ~60%+ سوق البحرين. جاهز نما 50% سنوياً بعد 2025. نينجا كيتشن تجرب توصيل بالدرونات (2026).'
    },
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22, confidence: 'verified', freeDelivery: { threshold: 3, restaurantShare: 0.5 } },
      { id: 'plat_hunger', name: 'هنقرستيشن', nameEn: 'HungerStation', fee: 22, confidence: 'estimated', freeDelivery: { threshold: 5, restaurantShare: 0.8 } },
      { id: 'plat_jahez', name: 'جاهز', nameEn: 'Jahez', fee: 20, confidence: 'estimated', freeDelivery: { threshold: 5, restaurantShare: 0.7 } },
      { id: 'plat_deliveroo', name: 'ديليفرو', nameEn: 'Deliveroo', fee: 28, confidence: 'verified', freeDelivery: { threshold: 6, restaurantShare: 0.9 } },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22, confidence: 'verified', freeDelivery: { threshold: 3, restaurantShare: 0.5 } },
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 25, confidence: 'verified', freeDelivery: { threshold: 4, restaurantShare: 0.7 } },
      { id: 'plat_eat_easy', name: 'إيت إيزي', nameEn: 'EatEasy', fee: 18, confidence: 'estimated' },
      { id: 'plat_wssel', name: 'وصّل', nameEn: 'Wssel', fee: 18, confidence: 'estimated' },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15, confidence: 'verified', freeDelivery: { threshold: 3, restaurantShare: 0.4 } },
      { id: 'plat_burgerizzr', name: 'برجريززر', nameEn: 'Burgerizzr', fee: 18, confidence: 'estimated' },
      { id: 'plat_ninja_kitchen', name: 'نينجا كيتشن', nameEn: 'Ninja Kitchen', fee: 15, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'طلبات تملك ~60%+ سوق البحرين. جاهز نما 50% سنوياً بعد 2025. نينجا كيتشن تجرب توصيل بالدرونات (2026). متوسط الطلب ~7 د.ب.',
    noteEn: 'Talabat owns ~60%+ Bahrain market. Jahez grew 50% YoY post-2025. Ninja Kitchen drone pilot (2026). Avg order ~BHD 7.'
  },
  OM: {
    name: 'عمان',
    nameEn: 'Oman',
    flag: '🇴🇲',
    currency: 'OMR',
    currencySymbol: 'ر.ع',
    currencySymbolEn: 'OMR',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 8,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.3,
      weekendBehavior: 'الخميس والجمعة أعلى. الطلبات العائلية الكبيرة شائعة.',
      popularCategories: ['الكبسة العمانية', 'المشويات', 'الشاورما', 'السمك', 'الحلويات العمانية'],
      paymentMethod: 'كاش عند الاستلام 55% | البطاقة 40% | محافظ رقمية 5%',
      specialNotes: 'أقل عدد سكان بين دول الخليج. طلبات هي السائد. كيتا أعلنت نيتها التوسع للبحرين وعمان. متوسط الطلب ~8 ر.ع.'
    },
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22, confidence: 'verified', freeDelivery: { threshold: 3, restaurantShare: 0.5 } },
      { id: 'plat_carriage', name: 'كاريدج', nameEn: 'Carriage', fee: 22, confidence: 'estimated' },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22, confidence: 'verified', freeDelivery: { threshold: 3, restaurantShare: 0.5 } },
      { id: 'plat_wssel', name: 'وصّل', nameEn: 'Wssel', fee: 18, confidence: 'estimated' },
      { id: 'plat_lugmety', name: 'لقمتي', nameEn: 'Lugmety', fee: 18, confidence: 'estimated' },
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 22, confidence: 'verified', freeDelivery: { threshold: 3, restaurantShare: 0.5 } },
      { id: 'plat_zomato', name: 'زوماتو', nameEn: 'Zomato', fee: 22, confidence: 'verified' },
      { id: 'plat_keeta', name: 'كيتا', nameEn: 'Keeta', fee: 15, confidence: 'verified', freeDelivery: { threshold: 2.5, restaurantShare: 0.4 } },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15, confidence: 'verified', freeDelivery: { threshold: 2.5, restaurantShare: 0.4 } },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'أقل عدد سكان بين دول الخليج. طلبات هي السائد. كيتا أعلنت نيتها التوسع للبحرين وعمان. متوسط الطلب ~8 ر.ع. كاش عند الاستلام سائد (55%).',
    noteEn: 'Smallest GCC population. Talabat is dominant. Keeta announced expansion plans for Bahrain and Oman. Avg order ~OMR 8. Cash on delivery dominant (55%).'
  },
  EG: {
    name: 'مصر',
    nameEn: 'Egypt',
    flag: '🇪🇬',
    currency: 'EGP',
    currencySymbol: 'ج.م',
    currencySymbolEn: 'EGP',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 280,
      peakHours: '13:00–15:00 و 20:00–23:00 (السحور 02:00–04:00 في رمضان)',
      ramadanMultiplier: 1.6,
      weekendBehavior: 'الجمعة والسبت أعلى. العائلات تطلب وجبات كبيرة. الطلبات الليلية مرتفعة جداً.',
      popularCategories: ['الكشري', 'الفول والطعمية', 'المشويات', 'الكبدة', 'البيتزا', 'الحواوشي'],
      paymentMethod: 'كاش عند الاستلام 70% | البطاقة 25% | محافظ رقمية 5% (فوري/فودافون كاش)',
      specialNotes: 'السوق ~3.9 مليار دولار (2025). أوبر إيتس وزوماتو انسحبتا. إلمينيوز منافس محلي قوي. التضخم يؤثر على الأسعار باستمرار. متوسط الطلب ~280 ج.م.'
    },
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22, confidence: 'verified', freeDelivery: { threshold: 150, restaurantShare: 15 } },
      { id: 'plat_elmenus', name: 'إلمينيوز', nameEn: 'Elmenus', fee: 16, confidence: 'verified', freeDelivery: { threshold: 100, restaurantShare: 10 } },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22, confidence: 'verified', freeDelivery: { threshold: 150, restaurantShare: 15 } },
      { id: 'plat_noon', name: 'نون فود', nameEn: 'Noon Food', fee: 15, confidence: 'verified', freeDelivery: { threshold: 100, restaurantShare: 10 } },
      { id: 'plat_mrsoul', name: 'مرسول', nameEn: 'Mrsool', fee: 18, confidence: 'verified', freeDelivery: { threshold: 100, restaurantShare: 10 } },
      { id: 'plat_bolt', name: 'بولت فود', nameEn: 'Bolt Food', fee: 18, confidence: 'verified', freeDelivery: { threshold: 120, restaurantShare: 12 } },
      { id: 'plat_otlob', name: 'أطلب', nameEn: 'Otlob', fee: 22, confidence: 'estimated' },
      { id: 'plat_insta_shop', name: 'إنستا شوب', nameEn: 'InstaShop', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'طلبات هي السائد (أدرجت في دبي 2024). إلمينيوز منافس مصري محلي قوي (عمولة 16%). السوق ~3.9 مليار دولار (2025). أوبر إيتس وزوماتو انسحبتا. متوسط الطلب ~280 ج.م. كاش عند الاستلام 70%.',
    noteEn: 'Talabat dominant (IPO\'d Dubai 2024). Elmenus strong Egyptian-local competitor (16% fee). Market ~$3.9B (2025). Uber Eats and Zomato exited. Avg order ~EGP 280. Cash on delivery 70%.'
  },
  JO: {
    name: 'الأردن',
    nameEn: 'Jordan',
    flag: '🇯🇴',
    currency: 'JOD',
    currencySymbol: 'د.أ',
    currencySymbolEn: 'JOD',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 12,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.3,
      weekendBehavior: 'الجمعة أقل. الخميس والسبت أعلى.',
      popularCategories: ['المنسف', 'الكباب', 'الشاورما', 'الفلافل', 'المقبلات اللبنانية'],
      paymentMethod: 'كاش عند الاستلام 60% | البطاقة 35% | محافظ رقمية 5%',
      specialNotes: 'توترز له حضور قوي في الأردن ولبنان. جاهز تتوسع إقليمياً. صباغ وبالفرن محليون أردنيون. متوسط الطلب ~12 د.أ.'
    },
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22, confidence: 'verified', freeDelivery: { threshold: 5, restaurantShare: 0.8 } },
      { id: 'plat_careem', name: 'كريم ناو', nameEn: 'Careem NOW', fee: 22, confidence: 'verified', freeDelivery: { threshold: 5, restaurantShare: 0.8 } },
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 25, confidence: 'verified', freeDelivery: { threshold: 7, restaurantShare: 1.0 } },
      { id: 'plat_jahez', name: 'جاهز', nameEn: 'Jahez', fee: 20, confidence: 'estimated', freeDelivery: { threshold: 5, restaurantShare: 0.7 } },
      { id: 'plat_aroundtown', name: 'أراوند تاون', nameEn: 'Aroundtown', fee: 18, confidence: 'estimated' },
      { id: 'plat_sabag', name: 'صباغ', nameEn: 'Sabag', fee: 18, confidence: 'estimated' },
      { id: 'plat_kaasak', name: 'قعسك', nameEn: 'Kaasak', fee: 18, confidence: 'estimated' },
      { id: 'plat_bilforon', name: 'بالفرن', nameEn: 'Bilforon', fee: 15, confidence: 'estimated' },
      { id: 'plat_noor_healthy', name: 'نور هيلثي', nameEn: 'Noor Healthy', fee: 15, confidence: 'estimated' },
      { id: 'plat_basket_jo', name: 'باسكت دوت جو', nameEn: 'Basket.Jo', fee: 15, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'توترز له حضور قوي في الأردن ولبنان. جاهز تتوسع إقليمياً. صباغ وبالفرن محليون أردنيون. متوسط الطلب ~12 د.أ. كاش عند الاستلام 60%.',
    noteEn: 'Toters has strong presence in Jordan and Lebanon. Jahez expanding regionally. Sabag and Bilforon are Jordanian-local. Avg order ~JOD 12. Cash on delivery 60%.'
  },
  IQ: {
    name: 'العراق',
    nameEn: 'Iraq',
    flag: '🇮🇶',
    currency: 'IQD',
    currencySymbol: 'د.ع',
    currencySymbolEn: 'IQD',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 15000,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.3,
      weekendBehavior: 'الجمعة أعلى. العائلات تطلب وجبات كبيرة.',
      popularCategories: ['الكباب العراقي', 'ال dolma', 'التمري', 'البرياني', 'الشاورما'],
      paymentMethod: 'كاش عند الاستلام 90% | البطاقة 8% | محافظ رقمية 2%',
      specialNotes: 'طلباتي والسريع عراقيان محليان. توترز وطلبات يتنافسان بقوة. الدفع عند الاستلام هو السائد (90%). متوسط الطلب ~15,000 د.ع.'
    },
    platforms: [
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22, confidence: 'verified' },
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 25, confidence: 'verified' },
      { id: 'plat_careem', name: 'كريم', nameEn: 'Careem', fee: 22, confidence: 'verified' },
      { id: 'plat_talabati', name: 'طلباتي', nameEn: 'Talabati', fee: 18, confidence: 'estimated' },
      { id: 'plat_alsaree3', name: 'السريع', nameEn: 'Alsaree3', fee: 18, confidence: 'estimated' },
      { id: 'plat_mrsoul', name: 'مرسول', nameEn: 'Mrsool', fee: 18, confidence: 'verified' },
      { id: 'plat_wasalt', name: 'وصّلت', nameEn: 'Wasalt', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'طلباتي والسريع عراقيان محليان. توترز وطلبات يتنافسان بقوة. الدفع عند الاستلام هو السائد (90%). متوسط الطلب ~15,000 د.ع.',
    noteEn: 'Talabati and Alsaree3 are Iraqi-local. Toters and Talabat compete aggressively. Cash on delivery dominates (90%). Avg order ~IQD 15,000.'
  },
  LB: {
    name: 'لبنان',
    nameEn: 'Lebanon',
    flag: '🇱🇧',
    currency: 'LBP',
    currencySymbol: 'ل.ل',
    currencySymbolEn: 'LBP',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 250000,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل. السبت أعلى.',
      popularCategories: ['الكباب', 'الشاورما', 'الفلافل', 'المقبلات اللبنانية', 'الحلويات اللبنانية'],
      paymentMethod: 'كاش عند الاستلام 70% | البطاقة 25% | محافظ رقمية 5%',
      specialNotes: 'وكيلني يأخذ رسوم توصيل (2–6$) لا عمولة. العمولات عالية بسبب الأزمة (تصل 45–50% مع التسويق). ديليفرو انسحبت 2022. متوسط الطلب ~250,000 ل.ل.'
    },
    platforms: [
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 30, confidence: 'verified' },
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 28, confidence: 'verified' },
      { id: 'plat_foodics', name: 'فودكس أونلاين', nameEn: 'Foodics Online', fee: 0, confidence: 'estimated' },
      { id: 'plat_wakilni', name: 'وكيلني', nameEn: 'Wakilni', fee: 5, confidence: 'estimated' },
      { id: 'plat_nasnous', name: 'نسنوس', nameEn: 'Nasnous', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'وكيلني يأخذ رسوم توصيل (2–6$) لا عمولة. العمولات عالية بسبب الأزمة (تصل 45–50% مع التسويق). ديليفرو انسحبت 2022. متوسط الطلب ~250,000 ل.ل.',
    noteEn: 'Wakilni charges delivery fees ($2–6) not commission. High commissions due to crisis (up to 45–50% with marketing). Deliveroo exited 2022. Avg order ~LBP 250,000.'
  },
  SY: {
    name: 'سوريا',
    nameEn: 'Syria',
    flag: '🇸🇾',
    currency: 'SYP',
    currencySymbol: 'ل.س',
    currencySymbolEn: 'SYP',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 15000,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل.',
      popularCategories: ['الكباب', 'الشاورما', 'الفلافل', 'المشويات', 'المأكولات السورية التقليدية'],
      paymentMethod: 'كاش عند الاستلام 95% | البطاقة 5%',
      specialNotes: 'السوق السوري محدود التطبيقات. بي أوردر هو الأبرز محلياً (~120,000 طلب/شهر). لا توجد تطبيقات دولية بسبب العقوبات. متوسط الطلب ~15,000 ل.س.'
    },
    platforms: [
      { id: 'plat_beeorder', name: 'بي أوردر', nameEn: 'Beeorder', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'السوق السوري محدود التطبيقات. بي أوردر هو الأبرز محلياً (~120,000 طلب/شهر). لا توجد تطبيقات دولية بسبب العقوبات. متوسط الطلب ~15,000 ل.س.',
    noteEn: 'Syrian market has limited apps. Beeorder is most prominent locally (~120,000 orders/month). No international apps due to sanctions. Avg order ~SYP 15,000.'
  },
  PS: {
    name: 'فلسطين',
    nameEn: 'Palestine',
    flag: '🇵🇸',
    currency: 'USD',
    currencySymbol: '$',
    currencySymbolEn: 'USD',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 18,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل.',
      popularCategories: ['الكباب', 'الشاورما', 'الفلافل', 'المقلوبة', 'المأكولات الفلسطينية التقليدية'],
      paymentMethod: 'كاش عند الاستلام 75% | البطاقة 20% | محافظ رقمية 5%',
      specialNotes: 'السوق الفلسطيني متأثر بالوضع السياسي. توترز الأبرز في الضفة. غزة: التوصيل التجاري منهار تقريباً. متوسط الطلب ~$18.'
    },
    platforms: [
      { id: 'plat_toters', name: 'توترز', nameEn: 'Toters', fee: 25, confidence: 'verified' },
      { id: 'plat_talabat', name: 'طلبات', nameEn: 'Talabat', fee: 22, confidence: 'verified' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'السوق الفلسطيني متأثر بالوضع السياسي. توترز الأبرز في الضفة. غزة: التوصيل التجاري منهار تقريباً. متوسط الطلب ~$18.',
    noteEn: 'Palestinian market affected by political situation. Toters dominant in West Bank. Gaza: commercial delivery largely collapsed. Avg order ~$18.'
  },
  TN: {
    name: 'تونس',
    nameEn: 'Tunisia',
    flag: '🇹🇳',
    currency: 'TND',
    currencySymbol: 'د.ت',
    currencySymbolEn: 'TND',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 25,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل. السبت والأحد أعلى.',
      popularCategories: ['الكسكسي', 'الشاورما', 'البرجر', 'المأكولات التونسية التقليدية', 'الحلويات'],
      paymentMethod: 'كاش عند الاستلام 80% | البطاقة 15% | محافظ رقمية 5%',
      specialNotes: 'ياسير سوبر-أب جزائري يتوسع في تونس. جوميا فود يقلص عملياته في شمال إفريقيا. غلوفو هي الأبرز. متوسط الطلب ~25 د.ت.'
    },
    platforms: [
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 28, confidence: 'verified' },
      { id: 'plat_yassir', name: 'ياسير', nameEn: 'Yassir', fee: 18, confidence: 'estimated' },
      { id: 'plat_jumia', name: 'جوميا فود', nameEn: 'Jumia Food', fee: 14, confidence: 'verified' },
      { id: 'plat_bolt', name: 'بولت فود', nameEn: 'Bolt Food', fee: 18, confidence: 'verified' },
      { id: 'plat_local', name: 'تطبيقات محلية', nameEn: 'Local Apps', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'ياسير سوبر-أب جزائري يتوسع في تونس. جوميا فود يقلص عملياته في شمال إفريقيا. غلوفو هي الأبرز. متوسط الطلب ~25 د.ت. كاش عند الاستلام 80%.',
    noteEn: 'Yassir Algerian super-app expanding in Tunisia. Jumia Food scaling back in North Africa. Glovo is dominant. Avg order ~TND 25. Cash on delivery 80%.'
  },
  DZ: {
    name: 'الجزائر',
    nameEn: 'Algeria',
    flag: '🇩🇿',
    currency: 'DZD',
    currencySymbol: 'د.ج',
    currencySymbolEn: 'DZD',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 800,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل. السبت والأحد أعلى.',
      popularCategories: ['الكسكسي', 'الشاورما', 'البرجر', 'المشويات', 'المأكولات الجزائرية التقليدية'],
      paymentMethod: 'كاش عند الاستلام 85% | البطاقة 12% | محافظ رقمية 3%',
      specialNotes: 'ياسير السائد (8 مليون مستخدم، 45 مدينة). تمتم وان منافس جزائري (~5.7M تمويل). فلحانوت نموذج SaaS جديد (3% فقط). متوسط الطلب ~800 د.ج.'
    },
    platforms: [
      { id: 'plat_yassir', name: 'ياسير', nameEn: 'Yassir', fee: 15, confidence: 'estimated' },
      { id: 'plat_temtem', name: 'تمتم وان', nameEn: 'Temtem One', fee: 18, confidence: 'estimated' },
      { id: 'plat_felhanout', name: 'فلحانوت', nameEn: 'Felhanout', fee: 3, confidence: 'estimated' },
      { id: 'plat_nresto', name: 'ان رستو', nameEn: 'NResto', fee: 0, confidence: 'estimated' },
      { id: 'plat_ndeliv', name: 'ان ديليف', nameEn: 'Ndeliv', fee: 18, confidence: 'estimated' },
      { id: 'plat_jumia', name: 'جوميا فود', nameEn: 'Jumia Food', fee: 14, confidence: 'verified' },
      { id: 'plat_heetch', name: 'هيتش', nameEn: 'Heetch', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'ياسير السائد (8 مليون مستخدم، 45 مدينة). تمتم وان منافس جزائري (~5.7M تمويل). فلحانوت نموذج SaaS جديد (3% فقط). متوسط الطلب ~800 د.ج. كاش عند الاستلام 85%.',
    noteEn: 'Yassir dominant (8M users, 45 cities). Temtem One Algerian challenger (~$5.7M funding). Felhanout new SaaS model (3% only). Avg order ~DZD 800. Cash on delivery 85%.'
  },
  MA: {
    name: 'المغرب',
    nameEn: 'Morocco',
    flag: '🇲🇦',
    currency: 'MAD',
    currencySymbol: 'د.م',
    currencySymbolEn: 'MAD',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 90,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.3,
      weekendBehavior: 'الجمعة أقل. السبت أعلى.',
      popularCategories: ['الطاجين', 'الكسكسي', 'الشاورما', 'السفة', 'المأكولات المغربية التقليدية'],
      paymentMethod: 'كاش عند الاستلام 75% | البطاقة 20% | محافظ رقمية 5%',
      specialNotes: 'المغرب حدّت غلوفو عند 30% بقرار حكومي (2024-2025). غلوفو (58% استخدام) وجوميا (41%). كول قدم الشكوى ضد غلوفو. متوسط الطلب ~90 د.م.'
    },
    platforms: [
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 30, confidence: 'verified' },
      { id: 'plat_jumia', name: 'جوميا فود', nameEn: 'Jumia Food', fee: 14, confidence: 'verified' },
      { id: 'plat_kooul', name: 'كول', nameEn: 'Kooul', fee: 20, confidence: 'estimated' },
      { id: 'plat_heetch', name: 'هيتش', nameEn: 'Heetch', fee: 18, confidence: 'estimated' },
      { id: 'plat_kaalix', name: 'كاليكس', nameEn: 'Kaalix', fee: 18, confidence: 'estimated' },
      { id: 'plat_allo_smile', name: 'الو سمايل', nameEn: 'Allo Smail', fee: 18, confidence: 'estimated' },
      { id: 'plat_natsakharlik', name: 'ناتساخارليك', nameEn: 'Natsakharlik', fee: 18, confidence: 'estimated' },
      { id: 'plat_jibli_m3ak', name: 'جيبلي معاك', nameEn: 'Jibli-m3ak', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'المغرب حدّت غلوفو عند 30% بقرار حكومي (2024-2025). غلوفو (58% استخدام) وجوميا (41%). كول قدم الشكوى ضد غلوفو. متوسط الطلب ~90 د.م. كاش عند الاستلام 75%.',
    noteEn: 'Morocco capped Glovo at 30% by government decree (2024-2025). Glovo (58% usage) and Jumia (41%). Kooul filed complaint against Glovo. Avg order ~MAD 90. Cash on delivery 75%.'
  },
  LY: {
    name: 'ليبيا',
    nameEn: 'Libya',
    flag: '🇱🇾',
    currency: 'LYD',
    currencySymbol: 'د.ل',
    currencySymbolEn: 'LYD',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 35,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل.',
      popularCategories: ['الكسكسي', 'الشاورما', 'البرجر', 'المشويات'],
      paymentMethod: 'كاش عند الاستلام 90% | البطاقة 10%',
      specialNotes: 'السوق الليبي متقطع. جوميا تقلصت. غالبية الطلبات مباشرة أو عبر واتساب وفيسبوك. لا يوجد تطبيق سائد. متوسط الطلب ~35 د.ل.'
    },
    platforms: [
      { id: 'plat_jumia', name: 'جوميا فود', nameEn: 'Jumia Food', fee: 14, confidence: 'verified' },
      { id: 'plat_foodchow', name: 'فودتشاو', nameEn: 'FoodChow', fee: 18, confidence: 'estimated' },
      { id: 'plat_glovo', name: 'غلوفو', nameEn: 'Glovo', fee: 25, confidence: 'verified' },
      { id: 'plat_bolt', name: 'بولت فود', nameEn: 'Bolt Food', fee: 18, confidence: 'verified' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'السوق الليبي متقطع. جوميا تقلصت. غالبية الطلبات مباشرة أو عبر واتساب وفيسبوك. لا يوجد تطبيق سائد. متوسط الطلب ~35 د.ل. كاش عند الاستلام 90%.',
    noteEn: 'Libyan market is fragmented. Jumia scaled back. Most orders are direct or via WhatsApp/Facebook. No dominant app. Avg order ~LYD 35. Cash on delivery 90%.'
  },
  SD: {
    name: 'السودان',
    nameEn: 'Sudan',
    flag: '🇸🇩',
    currency: 'SDG',
    currencySymbol: 'ج.س',
    currencySymbolEn: 'SDG',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 5000,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل.',
      popularCategories: ['الكسرة', 'العصيدة', 'الشاورما', 'الفول', 'المأكولات السودانية التقليدية'],
      paymentMethod: 'كاش عند الاستلام 85% | محافظ رقمية 10% (زين كاش/موكاش) | البطاقة 5%',
      specialNotes: 'ناين محلي سوداني (2,500+ مطعم في الخرطوم). حالاً مصري-سوداني (10M+ رحلة). الدفع بزين كاش وموكاش. لا توجد تطبيقات دولية. متوسط الطلب ~5,000 ج.س.'
    },
    platforms: [
      { id: 'plat_nine', name: 'ناين', nameEn: 'Nine', fee: 18, confidence: 'estimated' },
      { id: 'plat_halan', name: 'حالاً', nameEn: 'Halan', fee: 18, confidence: 'estimated' },
      { id: 'plat_foodchow', name: 'فودتشاو', nameEn: 'FoodChow', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'ناين محلي سوداني (2,500+ مطعم في الخرطوم). حالاً مصري-سوداني (10M+ رحلة). الدفع بزين كاش وموكاش. لا توجد تطبيقات دولية. متوسط الطلب ~5,000 ج.س.',
    noteEn: 'Nine is Sudanese-local (2,500+ restaurants in Khartoum). Halan is Egyptian-Sudanese (10M+ rides). Payments via Zain Cash and mBOK. No international apps. Avg order ~SDG 5,000.'
  },
  YE: {
    name: 'اليمن',
    nameEn: 'Yemen',
    flag: '🇾🇪',
    currency: 'YER',
    currencySymbol: 'ر.ي',
    currencySymbolEn: 'YER',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 3500,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل.',
      popularCategories: ['الكسدة', 'السلتة', 'الشاورما', 'الفول', 'المأكولات اليمنية التقليدية'],
      paymentMethod: 'كاش عند الاستلام 95% | البطاقة 5%',
      specialNotes: 'واجبات أبرز التطبيقات في صنعاء (~120 مطعم، 26 دراجة). العمولات غير معلنة — التقديرات تقريبية. لا توجد تطبيقات دولية. متوسط الطلب ~3,500 ر.ي.'
    },
    platforms: [
      { id: 'plat_wagbat', name: 'واجبات', nameEn: 'Wagbat', fee: 18, confidence: 'estimated' },
      { id: 'plat_tamween', name: 'تموين', nameEn: 'Tamween', fee: 18, confidence: 'estimated' },
      { id: 'plat_ana_mehani', name: 'أنا مهني', nameEn: 'Ana Mehani', fee: 20, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'واجبات أبرز التطبيقات في صنعاء (~120 مطعم، 26 دراجة). العمولات غير معلنة — التقديرات تقريبية. لا توجد تطبيقات دولية. متوسط الطلب ~3,500 ر.ي. كاش عند الاستلام 95%.',
    noteEn: 'Wagbat is most prominent in Sanaa (~120 restaurants, 26 cyclists). Commissions undisclosed — estimates are approximate. No international apps. Avg order ~YER 3,500. Cash on delivery 95%.'
  },
  DJ: {
    name: 'جيبوتي',
    nameEn: 'Djibouti',
    flag: '🇩🇯',
    currency: 'DJF',
    currencySymbol: 'ف.ج',
    currencySymbolEn: 'DJF',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 3000,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل.',
      popularCategories: ['المشويات', 'الشاورما', 'المأكولات الفرنسية', 'المأكولات الإثيوبية'],
      paymentMethod: 'كاش عند الاستلام 90% | البطاقة 10%',
      specialNotes: 'كيكي دروب سوبر-أب جيبوتي محلي. السوق صغير جداً. لا توجد تطبيقات دولية. متوسط الطلب ~3,000 ف.ج.'
    },
    platforms: [
      { id: 'plat_kiki', name: 'كيكي دروب', nameEn: 'KiKi Drop', fee: 18, confidence: 'estimated' },
      { id: 'plat_foodchow', name: 'فودتشاو', nameEn: 'FoodChow', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'كيكي دروب سوبر-أب جيبوتي محلي. السوق صغير جداً. لا توجد تطبيقات دولية. متوسط الطلب ~3,000 ف.ج.',
    noteEn: 'KiKi Drop is Djiboutian local super-app. Very small market. No international apps. Avg order ~DJF 3,000.'
  },
  SO: {
    name: 'الصومال',
    nameEn: 'Somalia',
    flag: '🇸🇴',
    currency: 'SOS',
    currencySymbol: 'ش.ص',
    currencySymbolEn: 'SOS',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 80000,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل.',
      popularCategories: ['الأرز باللحم', 'الشاورما', 'المعكرونة', 'المأكولات الصومالية التقليدية'],
      paymentMethod: 'كاش عند الاستلام 90% | محافظ رقمية 8% | البطاقة 2%',
      specialNotes: 'ريكاب سوبر-أب صومالي (100,000+ عميل، 5,000+ سائق). جوليفري يأخذ رسوم توصيل (1–5$) لا عمولة. السوق متنامي. متوسط الطلب ~80,000 ش.ص.'
    },
    platforms: [
      { id: 'plat_rikaab', name: 'ريكاب', nameEn: 'Rikaab', fee: 18, confidence: 'estimated' },
      { id: 'plat_gulivery', name: 'جوليفري', nameEn: 'Gulivery', fee: 5, confidence: 'estimated' },
      { id: 'plat_foodchow', name: 'فودتشاو', nameEn: 'FoodChow', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'ريكاب سوبر-أب صومالي (100K+ clients, 5,000+ drivers). Gulivery charges delivery fees ($1–5) not commission. Growing market. Avg order ~SOS 80,000.',
    noteEn: 'Rikaab is Somali super-app (100K+ clients, 5,000+ drivers). Gulivery charges delivery fees ($1–5) not commission. Growing market. Avg order ~SOS 80,000.'
  },
  MR: {
    name: 'موريتانيا',
    nameEn: 'Mauritania',
    flag: '🇲🇷',
    currency: 'MRU',
    currencySymbol: 'أ.م',
    currencySymbolEn: 'MRU',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 250,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل.',
      popularCategories: ['الكسكسي الموريتاني', 'الشاورما', 'السمك', 'المأكولات الموريتانية التقليدية'],
      paymentMethod: 'كاش عند الاستلام 90% | البطاقة 8% | محافظ رقمية 2%',
      specialNotes: 'جملي السائد في نواكشوط (2M+ مستخدم). وجبات منافس جديد. عدانم فائز بتحدي الابتكار الموريتاني. لا توجد تطبيقات دولية. متوسط الطلب ~250 أ.م.'
    },
    platforms: [
      { id: 'plat_jemli', name: 'جملي', nameEn: 'Jemli', fee: 18, confidence: 'estimated' },
      { id: 'plat_wejabat', name: 'وجبات', nameEn: 'Wejabat', fee: 18, confidence: 'estimated' },
      { id: 'plat_general_livraison', name: 'جنرال ليفريزون', nameEn: 'General Livraison', fee: 18, confidence: 'estimated' },
      { id: 'plat_addanam', name: 'عدانم', nameEn: 'Addanam', fee: 18, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'جملي السائد في نواكشوط (2M+ مستخدم). وجبات منافس جديد. عدانم فائز بتحدي الابتكار الموريتاني. لا توجد تطبيقات دولية. متوسط الطلب ~250 أ.م.',
    noteEn: 'Jemli dominant in Nouakchott (2M+ users). Wejabat is a newer competitor. Addanam won Mauritania Innovation Challenge. No international apps. Avg order ~MRU 250.'
  },
  KM: {
    name: 'جزر القمر',
    nameEn: 'Comoros',
    flag: '🇰🇲',
    currency: 'KMF',
    currencySymbol: 'ف.ق',
    currencySymbolEn: 'KMF',
    lastUpdated: "2026-05-26",
    marketInsights: {
      avgOrderValue: 3500,
      peakHours: '12:30–14:00 و 19:30–22:00',
      ramadanMultiplier: 1.2,
      weekendBehavior: 'الجمعة أقل.',
      popularCategories: ['الكسكسي', 'السمك', 'المأكولات القمرية التقليدية'],
      paymentMethod: 'كاش عند الاستلام 95% | البطاقة 5%',
      specialNotes: 'سوق التوصيل ناشئ جداً. ساهيلكوم وفودكوم كي أم محليان. لا توجد تطبيقات دولية. متوسط الطلب ~3,500 ف.ق.'
    },
    platforms: [
      { id: 'plat_sahilkom', name: 'ساهيلكوم', nameEn: 'Sahilkom', fee: 15, confidence: 'estimated' },
      { id: 'plat_foodcom', name: 'فودكوم كي أم', nameEn: 'Foodcom KM', fee: 15, confidence: 'estimated' },
      { id: 'plat_direct', name: 'مباشر (بدون منصة)', nameEn: 'Direct', fee: 0, confidence: 'verified' }
    ],
    note: 'سوق التوصيل ناشئ جداً. ساهيلكوم وفودكوم كي أم محليان. لا توجد تطبيقات دولية. متوسط الطلب ~3,500 ف.ق.',
    noteEn: 'Delivery market is very nascent. Sahilkom and Foodcom KM are local. No international apps. Avg order ~KMF 3,500.'
  }
};

// Default country
var DEFAULT_COUNTRY = 'SA';
