/**
 * Bonds Global — Shared Platform & Country Metadata
 * Extracted from country-platforms-data.js for use with BondsGeo.
 * Provides delivery-platform fees and country-level business metadata
 * (currency, VAT, marketInsights) without duplicating governorate/city data.
 */

(function () {
  'use strict';

  const COUNTRY_META = {
  "SA": {
    "code": "SA",
    "name": "السعودية",
    "nameEn": "Saudi Arabia",
    "flag": "🇸🇦",
    "currency": "SAR",
    "currencySymbol": "ر.س",
    "currencySymbolEn": "SAR",
    "vatRate": 15,
    "marketInsights": {
      "avgOrderValue": 65,
      "peakHours": "12:30–14:00 و 19:30–22:00 (السحور 02:00–04:00 في رمضان)",
      "ramadanMultiplier": 1.5,
      "weekendBehavior": "الخميس–السبت أعلى طلباً بـ 35%. العائلات تفضل وجبات جماعية كبيرة.",
      "popularCategories": [
        "الكبسة",
        "المندي",
        "الشاورما",
        "البرجر",
        "الوجبات السريعة",
        "الحلويات الشرقية"
      ],
      "paymentMethod": "البطاقة 78% | كاش عند الاستلام 20% | محافظ رقمية 2%",
      "specialNotes": "توصيل ليلي مرتفع جداً في رمضان. هنقرستيشن يُستخدم كاسم عام للتوصيل. اليوم الوطني (23 سبتمبر) يرفع الطلبات 40%."
    }
  },
  "AE": {
    "code": "AE",
    "name": "الإمارات",
    "nameEn": "UAE",
    "flag": "🇦🇪",
    "currency": "AED",
    "currencySymbol": "د.إ",
    "currencySymbolEn": "AED",
    "vatRate": 5,
    "marketInsights": {
      "avgOrderValue": 85,
      "peakHours": "12:00–14:30 و 19:00–22:30 (السحور 01:00–03:30 في رمضان)",
      "ramadanMultiplier": 1.4,
      "weekendBehavior": "الجمعة أقل طلباً. السبت–الأربعاء أعلى. الوافدون يطلبون أكثر من المواطنين.",
      "popularCategories": [
        "البرجر",
        "السوشي",
        "البيتزا",
        "المأكولات الهندية",
        "اللبناني",
        "العصائر والمخبوزات"
      ],
      "paymentMethod": "البطاقة 85% | Apple Pay/Google Pay 10% | كاش 5%",
      "specialNotes": "دبي الأعلى قيمة طلب. أبوظبي أكثر ولاءً للمنصات. طلبات 45% سوق. ديليفرو 25% (متميزة بالمطاعم الراقية)."
    }
  },
  "KW": {
    "code": "KW",
    "name": "الكويت",
    "nameEn": "Kuwait",
    "flag": "🇰🇼",
    "currency": "KWD",
    "currencySymbol": "د.ك",
    "currencySymbolEn": "KWD",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 6.5,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الخميس والجمعة أعلى أيام. العائلات الكبيرة تطلب بانتظام.",
      "popularCategories": [
        "المشويات",
        "الكباب",
        "الكبسة",
        "المأكولات البحرية",
        "الحلويات الكويتية",
        "الشاورما"
      ],
      "paymentMethod": "كاش عند الاستلام 45% | البطاقة 50% | محافظ رقمية 5%",
      "specialNotes": "الكويت حدّت العمولات بقرار وزاري (فبراير 2026) لمدة 3 سنوات. طلبات تأسست في الكويت 2004. كاريدج تأسست 2016. متوسط الطلب ~6.5 د.ك."
    }
  },
  "QA": {
    "code": "QA",
    "name": "قطر",
    "nameEn": "Qatar",
    "flag": "🇶🇦",
    "currency": "QAR",
    "currencySymbol": "ر.ق",
    "currencySymbolEn": "QAR",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 70,
      "peakHours": "12:00–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.4,
      "weekendBehavior": "الجمعة أقل. الخميس والسبت أعلى. المطاعم الراقية تحظى بطلب عالٍ.",
      "popularCategories": [
        "المشويات",
        "المأكولات الهندية",
        "اللبناني",
        "البرجر",
        "الحلويات العربية"
      ],
      "paymentMethod": "البطاقة 80% | كاش 15% | محافظ رقمية 5%",
      "specialNotes": "سنونو قطري محلي (استحوذت عليه جاهز 76.56%). طلبات غُرّمت 1.14 مليون ر.ق (2025). ديليفرو أغلقت قطر (مارس 2026)."
    }
  },
  "BH": {
    "code": "BH",
    "name": "البحرين",
    "nameEn": "Bahrain",
    "flag": "🇧🇭",
    "currency": "BHD",
    "currencySymbol": "د.ب",
    "currencySymbolEn": "BHD",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 7,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الخميس والجمعة أعلى. مطاعم الشوارع الشعبية شائعة.",
      "popularCategories": [
        "الكباب",
        "الشاورما",
        "الوجبات البحرينية",
        "المأكولات الهندية",
        "الحلويات"
      ],
      "paymentMethod": "البطاقة 75% | كاش 20% | محافظ رقمية 5%",
      "specialNotes": "طلبات تملك ~60%+ سوق البحرين. جاهز نما 50% سنوياً بعد 2025. نينجا كيتشن تجرب توصيل بالدرونات (2026)."
    }
  },
  "OM": {
    "code": "OM",
    "name": "عمان",
    "nameEn": "Oman",
    "flag": "🇴🇲",
    "currency": "OMR",
    "currencySymbol": "ر.ع",
    "currencySymbolEn": "OMR",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 8,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الخميس والجمعة أعلى. الطلبات العائلية الكبيرة شائعة.",
      "popularCategories": [
        "الكبسة العمانية",
        "المشويات",
        "الشاورما",
        "السمك",
        "الحلويات العمانية"
      ],
      "paymentMethod": "كاش عند الاستلام 55% | البطاقة 40% | محافظ رقمية 5%",
      "specialNotes": "أقل عدد سكان بين دول الخليج. طلبات هي السائد. كيتا أعلنت نيتها التوسع للبحرين وعمان. متوسط الطلب ~8 ر.ع."
    }
  },
  "EG": {
    "code": "EG",
    "name": "مصر",
    "nameEn": "Egypt",
    "flag": "🇪🇬",
    "currency": "EGP",
    "currencySymbol": "ج.م",
    "currencySymbolEn": "EGP",
    "vatRate": 14,
    "marketInsights": {
      "avgOrderValue": 280,
      "peakHours": "13:00–15:00 و 20:00–23:00 (السحور 02:00–04:00 في رمضان)",
      "ramadanMultiplier": 1.6,
      "weekendBehavior": "الجمعة والسبت أعلى. العائلات تطلب وجبات كبيرة. الطلبات الليلية مرتفعة جداً.",
      "popularCategories": [
        "الكشري",
        "الفول والطعمية",
        "المشويات",
        "الكبدة",
        "البيتزا",
        "الحواوشي"
      ],
      "paymentMethod": "كاش عند الاستلام 70% | البطاقة 25% | محافظ رقمية 5% (فوري/فودافون كاش)",
      "specialNotes": "السوق ~3.9 مليار دولار (2025). أوبر إيتس وزوماتو انسحبتا. إلمينيوز منافس محلي قوي. التضخم يؤثر على الأسعار باستمرار. متوسط الطلب ~280 ج.م."
    }
  },
  "JO": {
    "code": "JO",
    "name": "الأردن",
    "nameEn": "Jordan",
    "flag": "🇯🇴",
    "currency": "JOD",
    "currencySymbol": "د.أ",
    "currencySymbolEn": "JOD",
    "vatRate": 16,
    "marketInsights": {
      "avgOrderValue": 12,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الجمعة أقل. الخميس والسبت أعلى.",
      "popularCategories": [
        "المنسف",
        "الكباب",
        "الشاورما",
        "الفلافل",
        "المقبلات اللبنانية"
      ],
      "paymentMethod": "كاش عند الاستلام 60% | البطاقة 35% | محافظ رقمية 5%",
      "specialNotes": "توترز له حضور قوي في الأردن ولبنان. جاهز تتوسع إقليمياً. صباغ وبالفرن محليون أردنيون. متوسط الطلب ~12 د.أ."
    }
  },
  "IQ": {
    "code": "IQ",
    "name": "العراق",
    "nameEn": "Iraq",
    "flag": "🇮🇶",
    "currency": "IQD",
    "currencySymbol": "د.ع",
    "currencySymbolEn": "IQD",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 15000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الجمعة أعلى. العائلات تطلب وجبات كبيرة.",
      "popularCategories": [
        "الكباب العراقي",
        "ال dolma",
        "التمري",
        "البرياني",
        "الشاورما"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | البطاقة 8% | محافظ رقمية 2%",
      "specialNotes": "طلباتي والسريع عراقيان محليان. توترز وطلبات يتنافسان بقوة. الدفع عند الاستلام هو السائد (90%). متوسط الطلب ~15,000 د.ع."
    }
  },
  "LB": {
    "code": "LB",
    "name": "لبنان",
    "nameEn": "Lebanon",
    "flag": "🇱🇧",
    "currency": "LBP",
    "currencySymbol": "ل.ل",
    "currencySymbolEn": "LBP",
    "vatRate": 11,
    "marketInsights": {
      "avgOrderValue": 250000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل. السبت أعلى.",
      "popularCategories": [
        "الكباب",
        "الشاورما",
        "الفلافل",
        "المقبلات اللبنانية",
        "الحلويات اللبنانية"
      ],
      "paymentMethod": "كاش عند الاستلام 70% | البطاقة 25% | محافظ رقمية 5%",
      "specialNotes": "وكيلني يأخذ رسوم توصيل (2–6$) لا عمولة. العمولات عالية بسبب الأزمة (تصل 45–50% مع التسويق). ديليفرو انسحبت 2022. متوسط الطلب ~250,000 ل.ل."
    }
  },
  "SY": {
    "code": "SY",
    "name": "سوريا",
    "nameEn": "Syria",
    "flag": "🇸🇾",
    "currency": "SYP",
    "currencySymbol": "ل.س",
    "currencySymbolEn": "SYP",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 15000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكباب",
        "الشاورما",
        "الفلافل",
        "المشويات",
        "المأكولات السورية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 95% | البطاقة 5%",
      "specialNotes": "السوق السوري محدود التطبيقات. بي أوردر هو الأبرز محلياً (~120,000 طلب/شهر). لا توجد تطبيقات دولية بسبب العقوبات. متوسط الطلب ~15,000 ل.س."
    }
  },
  "PS": {
    "code": "PS",
    "name": "فلسطين",
    "nameEn": "Palestine",
    "flag": "🇵🇸",
    "currency": "USD",
    "currencySymbol": "$",
    "currencySymbolEn": "USD",
    "vatRate": 16,
    "marketInsights": {
      "avgOrderValue": 18,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكباب",
        "الشاورما",
        "الفلافل",
        "المقلوبة",
        "المأكولات الفلسطينية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 75% | البطاقة 20% | محافظ رقمية 5%",
      "specialNotes": "السوق الفلسطيني متأثر بالوضع السياسي. توترز الأبرز في الضفة. غزة: التوصيل التجاري منهار تقريباً. متوسط الطلب ~$18."
    }
  },
  "TN": {
    "code": "TN",
    "name": "تونس",
    "nameEn": "Tunisia",
    "flag": "🇹🇳",
    "currency": "TND",
    "currencySymbol": "د.ت",
    "currencySymbolEn": "TND",
    "vatRate": 19,
    "marketInsights": {
      "avgOrderValue": 25,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل. السبت والأحد أعلى.",
      "popularCategories": [
        "الكسكسي",
        "الشاورما",
        "البرجر",
        "المأكولات التونسية التقليدية",
        "الحلويات"
      ],
      "paymentMethod": "كاش عند الاستلام 80% | البطاقة 15% | محافظ رقمية 5%",
      "specialNotes": "ياسير سوبر-أب جزائري يتوسع في تونس. جوميا فود يقلص عملياته في شمال إفريقيا. غلوفو هي الأبرز. متوسط الطلب ~25 د.ت."
    }
  },
  "DZ": {
    "code": "DZ",
    "name": "الجزائر",
    "nameEn": "Algeria",
    "flag": "🇩🇿",
    "currency": "DZD",
    "currencySymbol": "د.ج",
    "currencySymbolEn": "DZD",
    "vatRate": 19,
    "marketInsights": {
      "avgOrderValue": 800,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل. السبت والأحد أعلى.",
      "popularCategories": [
        "الكسكسي",
        "الشاورما",
        "البرجر",
        "المشويات",
        "المأكولات الجزائرية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 85% | البطاقة 12% | محافظ رقمية 3%",
      "specialNotes": "ياسير السائد (8 مليون مستخدم، 45 مدينة). تمتم وان منافس جزائري (~5.7M تمويل). فلحانوت نموذج SaaS جديد (3% فقط). متوسط الطلب ~800 د.ج."
    }
  },
  "MA": {
    "code": "MA",
    "name": "المغرب",
    "nameEn": "Morocco",
    "flag": "🇲🇦",
    "currency": "MAD",
    "currencySymbol": "د.م",
    "currencySymbolEn": "MAD",
    "vatRate": 20,
    "marketInsights": {
      "avgOrderValue": 90,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الجمعة أقل. السبت أعلى.",
      "popularCategories": [
        "الطاجين",
        "الكسكسي",
        "الشاورما",
        "السفة",
        "المأكولات المغربية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 75% | البطاقة 20% | محافظ رقمية 5%",
      "specialNotes": "المغرب حدّت غلوفو عند 30% بقرار حكومي (2024-2025). غلوفو (58% استخدام) وجوميا (41%). كول قدم الشكوى ضد غلوفو. متوسط الطلب ~90 د.م."
    }
  },
  "LY": {
    "code": "LY",
    "name": "ليبيا",
    "nameEn": "Libya",
    "flag": "🇱🇾",
    "currency": "LYD",
    "currencySymbol": "د.ل",
    "currencySymbolEn": "LYD",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 35,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسكسي",
        "الشاورما",
        "البرجر",
        "المشويات"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | البطاقة 10%",
      "specialNotes": "السوق الليبي متقطع. جوميا تقلصت. غالبية الطلبات مباشرة أو عبر واتساب وفيسبوك. لا يوجد تطبيق سائد. متوسط الطلب ~35 د.ل."
    }
  },
  "SD": {
    "code": "SD",
    "name": "السودان",
    "nameEn": "Sudan",
    "flag": "🇸🇩",
    "currency": "SDG",
    "currencySymbol": "ج.س",
    "currencySymbolEn": "SDG",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 5000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسرة",
        "العصيدة",
        "الشاورما",
        "الفول",
        "المأكولات السودانية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 85% | محافظ رقمية 10% (زين كاش/موكاش) | البطاقة 5%",
      "specialNotes": "ناين محلي سوداني (2,500+ مطعم في الخرطوم). حالاً مصري-سوداني (10M+ رحلة). الدفع بزين كاش وموكاش. لا توجد تطبيقات دولية. متوسط الطلب ~5,000 ج.س."
    }
  },
  "YE": {
    "code": "YE",
    "name": "اليمن",
    "nameEn": "Yemen",
    "flag": "🇾🇪",
    "currency": "YER",
    "currencySymbol": "ر.ي",
    "currencySymbolEn": "YER",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 3500,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسدة",
        "السلتة",
        "الشاورما",
        "الفول",
        "المأكولات اليمنية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 95% | البطاقة 5%",
      "specialNotes": "واجبات أبرز التطبيقات في صنعاء (~120 مطعم، 26 دراجة). العمولات غير معلنة — التقديرات تقريبية. لا توجد تطبيقات دولية. متوسط الطلب ~3,500 ر.ي."
    }
  },
  "DJ": {
    "code": "DJ",
    "name": "جيبوتي",
    "nameEn": "Djibouti",
    "flag": "🇩🇯",
    "currency": "DJF",
    "currencySymbol": "ف.ج",
    "currencySymbolEn": "DJF",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 3000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "المشويات",
        "الشاورما",
        "المأكولات الفرنسية",
        "المأكولات الإثيوبية"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | البطاقة 10%",
      "specialNotes": "كيكي دروب سوبر-أب جيبوتي محلي. السوق صغير جداً. لا توجد تطبيقات دولية. متوسط الطلب ~3,000 ف.ج."
    }
  },
  "SO": {
    "code": "SO",
    "name": "الصومال",
    "nameEn": "Somalia",
    "flag": "🇸🇴",
    "currency": "SOS",
    "currencySymbol": "ش.ص",
    "currencySymbolEn": "SOS",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 80000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الأرز باللحم",
        "الشاورما",
        "المعكرونة",
        "المأكولات الصومالية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | محافظ رقمية 8% | البطاقة 2%",
      "specialNotes": "ريكاب سوبر-أب صومالي (100,000+ عميل، 5,000+ سائق). جوليفري يأخذ رسوم توصيل (1–5$) لا عمولة. السوق متنامي. متوسط الطلب ~80,000 ش.ص."
    }
  },
  "MR": {
    "code": "MR",
    "name": "موريتانيا",
    "nameEn": "Mauritania",
    "flag": "🇲🇷",
    "currency": "MRU",
    "currencySymbol": "أ.م",
    "currencySymbolEn": "MRU",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 250,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسكسي الموريتاني",
        "الشاورما",
        "السمك",
        "المأكولات الموريتانية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | البطاقة 8% | محافظ رقمية 2%",
      "specialNotes": "جملي السائد في نواكشوط (2M+ مستخدم). وجبات منافس جديد. عدانم فائز بتحدي الابتكار الموريتاني. لا توجد تطبيقات دولية. متوسط الطلب ~250 أ.م."
    }
  },
  "KM": {
    "code": "KM",
    "name": "جزر القمر",
    "nameEn": "Comoros",
    "flag": "🇰🇲",
    "currency": "KMF",
    "currencySymbol": "ف.ق",
    "currencySymbolEn": "KMF",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 3500,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسكسي",
        "السمك",
        "المأكولات القمرية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 95% | البطاقة 5%",
      "specialNotes": "سوق التوصيل ناشئ جداً. ساهيلكوم وفودكوم كي أم محليان. لا توجد تطبيقات دولية. متوسط الطلب ~3,500 ف.ق."
    }
  },
  "US": {
    "code": "US",
    "name": "الولايات المتحدة",
    "nameEn": "United States",
    "flag": "🇺🇸",
    "currency": "USD",
    "currencySymbol": "$",
    "currencySymbolEn": "USD",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 35,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 70% | Cash 20% | Digital wallets 10%"
    }
  },
  "CA": {
    "code": "CA",
    "name": "كندا",
    "nameEn": "Canada",
    "flag": "🇨🇦",
    "currency": "CAD",
    "currencySymbol": "C$",
    "currencySymbolEn": "CAD",
    "vatRate": 5,
    "marketInsights": {
      "avgOrderValue": 45,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 80% | Cash 15% | Digital wallets 5%"
    }
  },
  "GB": {
    "code": "GB",
    "name": "المملكة المتحدة",
    "nameEn": "United Kingdom",
    "flag": "🇬🇧",
    "currency": "GBP",
    "currencySymbol": "£",
    "currencySymbolEn": "GBP",
    "vatRate": 20,
    "marketInsights": {
      "avgOrderValue": 28,
      "peakHours": "12:00–14:00 و 18:30–21:30",
      "paymentMethod": "Card 75% | Cash 15% | Digital wallets 10%"
    }
  },
  "DE": {
    "code": "DE",
    "name": "ألمانيا",
    "nameEn": "Germany",
    "flag": "🇩🇪",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 19,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:30–21:00",
      "paymentMethod": "Card 80% | Cash 10% | Digital wallets 10%"
    }
  },
  "FR": {
    "code": "FR",
    "name": "فرنسا",
    "nameEn": "France",
    "flag": "🇫🇷",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 20,
    "marketInsights": {
      "avgOrderValue": 32,
      "peakHours": "12:00–14:00 و 19:30–22:00",
      "paymentMethod": "Card 75% | Cash 15% | Digital wallets 10%"
    }
  },
  "IT": {
    "code": "IT",
    "name": "إيطاليا",
    "nameEn": "Italy",
    "flag": "🇮🇹",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 22,
    "marketInsights": {
      "avgOrderValue": 28,
      "peakHours": "12:30–14:30 و 19:30–22:30",
      "paymentMethod": "Card 70% | Cash 25% | Digital wallets 5%"
    }
  },
  "ES": {
    "code": "ES",
    "name": "إسبانيا",
    "nameEn": "Spain",
    "flag": "🇪🇸",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 21,
    "marketInsights": {
      "avgOrderValue": 26,
      "peakHours": "13:00–15:30 و 20:30–23:00",
      "paymentMethod": "Card 75% | Cash 20% | Digital wallets 5%"
    }
  },
  "NL": {
    "code": "NL",
    "name": "هولندا",
    "nameEn": "Netherlands",
    "flag": "🇳🇱",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 21,
    "marketInsights": {
      "avgOrderValue": 29,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 85% | Cash 10% | Digital wallets 5%"
    }
  },
  "BE": {
    "code": "BE",
    "name": "بلجيكا",
    "nameEn": "Belgium",
    "flag": "🇧🇪",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 21,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:30–21:30",
      "paymentMethod": "Card 80% | Cash 15% | Digital wallets 5%"
    }
  },
  "CH": {
    "code": "CH",
    "name": "سويسرا",
    "nameEn": "Switzerland",
    "flag": "🇨🇭",
    "currency": "CHF",
    "currencySymbol": "CHF",
    "currencySymbolEn": "CHF",
    "vatRate": 8.1,
    "marketInsights": {
      "avgOrderValue": 40,
      "peakHours": "12:00–14:00 و 18:30–21:30",
      "paymentMethod": "Card 75% | Cash 20% | Digital wallets 5%"
    }
  },
  "AT": {
    "code": "AT",
    "name": "النمسا",
    "nameEn": "Austria",
    "flag": "🇦🇹",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 20,
    "marketInsights": {
      "avgOrderValue": 28,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 80% | Cash 15% | Digital wallets 5%"
    }
  },
  "TR": {
    "code": "TR",
    "name": "تركيا",
    "nameEn": "Turkey",
    "flag": "🇹🇷",
    "currency": "TRY",
    "currencySymbol": "₺",
    "currencySymbolEn": "TRY",
    "vatRate": 20,
    "marketInsights": {
      "avgOrderValue": 450,
      "peakHours": "12:00–14:00 و 19:00–22:00",
      "paymentMethod": "Card 60% | Cash 35% | Digital wallets 5%"
    }
  },
  "IN": {
    "code": "IN",
    "name": "الهند",
    "nameEn": "India",
    "flag": "🇮🇳",
    "currency": "INR",
    "currencySymbol": "₹",
    "currencySymbolEn": "INR",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 600,
      "peakHours": "12:30–14:30 و 19:00–22:00",
      "paymentMethod": "Digital wallets 50% | Card 30% | Cash 20%"
    }
  },
  "PK": {
    "code": "PK",
    "name": "باكستان",
    "nameEn": "Pakistan",
    "flag": "🇵🇰",
    "currency": "PKR",
    "currencySymbol": "PKR",
    "currencySymbolEn": "PKR",
    "vatRate": 17,
    "marketInsights": {
      "avgOrderValue": 2500,
      "peakHours": "12:30–14:30 و 19:30–22:30",
      "paymentMethod": "Cash 70% | Card 25% | Digital wallets 5%"
    }
  },
  "BD": {
    "code": "BD",
    "name": "بنغلاديش",
    "nameEn": "Bangladesh",
    "flag": "🇧🇩",
    "currency": "BDT",
    "currencySymbol": "৳",
    "currencySymbolEn": "BDT",
    "vatRate": 15,
    "marketInsights": {
      "avgOrderValue": 1200,
      "peakHours": "12:30–14:30 و 19:00–22:00",
      "paymentMethod": "Cash 75% | Card 20% | Digital wallets 5%"
    }
  },
  "ID": {
    "code": "ID",
    "name": "إندونيسيا",
    "nameEn": "Indonesia",
    "flag": "🇮🇩",
    "currency": "IDR",
    "currencySymbol": "IDR",
    "currencySymbolEn": "IDR",
    "vatRate": 11,
    "marketInsights": {
      "avgOrderValue": 90000,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Digital wallets 60% | Cash 30% | Card 10%"
    }
  },
  "MY": {
    "code": "MY",
    "name": "ماليزيا",
    "nameEn": "Malaysia",
    "flag": "🇲🇾",
    "currency": "MYR",
    "currencySymbol": "MYR",
    "currencySymbolEn": "MYR",
    "vatRate": 10,
    "marketInsights": {
      "avgOrderValue": 35,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Digital wallets 55% | Card 30% | Cash 15%"
    }
  },
  "PH": {
    "code": "PH",
    "name": "الفلبين",
    "nameEn": "Philippines",
    "flag": "🇵🇭",
    "currency": "PHP",
    "currencySymbol": "₱",
    "currencySymbolEn": "PHP",
    "vatRate": 12,
    "marketInsights": {
      "avgOrderValue": 600,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Digital wallets 50% | Cash 35% | Card 15%"
    }
  },
  "SG": {
    "code": "SG",
    "name": "سنغافورة",
    "nameEn": "Singapore",
    "flag": "🇸🇬",
    "currency": "SGD",
    "currencySymbol": "S$",
    "currencySymbolEn": "SGD",
    "vatRate": 9,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Digital wallets 60% | Card 35% | Cash 5%"
    }
  },
  "CN": {
    "code": "CN",
    "name": "الصين",
    "nameEn": "China",
    "flag": "🇨🇳",
    "currency": "CNY",
    "currencySymbol": "¥",
    "currencySymbolEn": "CNY",
    "vatRate": 13,
    "marketInsights": {
      "avgOrderValue": 70,
      "peakHours": "11:30–13:30 و 17:30–20:30",
      "paymentMethod": "Digital wallets 85% | Card 10% | Cash 5%"
    }
  },
  "JP": {
    "code": "JP",
    "name": "اليابان",
    "nameEn": "Japan",
    "flag": "🇯🇵",
    "currency": "JPY",
    "currencySymbol": "¥",
    "currencySymbolEn": "JPY",
    "vatRate": 10,
    "marketInsights": {
      "avgOrderValue": 2500,
      "peakHours": "11:30–13:30 و 17:30–20:30",
      "paymentMethod": "Digital wallets 50% | Card 35% | Cash 15%"
    }
  },
  "KR": {
    "code": "KR",
    "name": "كوريا الجنوبية",
    "nameEn": "South Korea",
    "flag": "🇰🇷",
    "currency": "KRW",
    "currencySymbol": "₩",
    "currencySymbolEn": "KRW",
    "vatRate": 10,
    "marketInsights": {
      "avgOrderValue": 25000,
      "peakHours": "11:30–13:30 و 17:30–20:30",
      "paymentMethod": "Digital wallets 70% | Card 25% | Cash 5%"
    }
  },
  "AU": {
    "code": "AU",
    "name": "أستراليا",
    "nameEn": "Australia",
    "flag": "🇦🇺",
    "currency": "AUD",
    "currencySymbol": "A$",
    "currencySymbolEn": "AUD",
    "vatRate": 10,
    "marketInsights": {
      "avgOrderValue": 45,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 70% | Digital wallets 20% | Cash 10%"
    }
  },
  "NZ": {
    "code": "NZ",
    "name": "نيوزيلندا",
    "nameEn": "New Zealand",
    "flag": "🇳🇿",
    "currency": "NZD",
    "currencySymbol": "NZ$",
    "currencySymbolEn": "NZD",
    "vatRate": 15,
    "marketInsights": {
      "avgOrderValue": 45,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 75% | Digital wallets 15% | Cash 10%"
    }
  },
  "ZA": {
    "code": "ZA",
    "name": "جنوب أفريقيا",
    "nameEn": "South Africa",
    "flag": "🇿🇦",
    "currency": "ZAR",
    "currencySymbol": "ZAR",
    "currencySymbolEn": "ZAR",
    "vatRate": 15,
    "marketInsights": {
      "avgOrderValue": 250,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Digital wallets 40% | Card 35% | Cash 25%"
    }
  },
  "NG": {
    "code": "NG",
    "name": "نيجيريا",
    "nameEn": "Nigeria",
    "flag": "🇳🇬",
    "currency": "NGN",
    "currencySymbol": "₦",
    "currencySymbolEn": "NGN",
    "vatRate": 7.5,
    "marketInsights": {
      "avgOrderValue": 8000,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Digital wallets 45% | Cash 40% | Card 15%"
    }
  },
  "KE": {
    "code": "KE",
    "name": "كينيا",
    "nameEn": "Kenya",
    "flag": "🇰🇪",
    "currency": "KES",
    "currencySymbol": "KSh",
    "currencySymbolEn": "KES",
    "vatRate": 16,
    "marketInsights": {
      "avgOrderValue": 1500,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Digital wallets 50% | Cash 40% | Card 10%"
    }
  },
  "BR": {
    "code": "BR",
    "name": "البرازيل",
    "nameEn": "Brazil",
    "flag": "🇧🇷",
    "currency": "BRL",
    "currencySymbol": "R$",
    "currencySymbolEn": "BRL",
    "vatRate": 17,
    "marketInsights": {
      "avgOrderValue": 80,
      "peakHours": "11:30–13:30 و 18:30–21:30",
      "paymentMethod": "Digital wallets 50% | Card 30% | Cash 20%"
    }
  },
  "MX": {
    "code": "MX",
    "name": "المكسيك",
    "nameEn": "Mexico",
    "flag": "🇲🇽",
    "currency": "MXN",
    "currencySymbol": "MX$",
    "currencySymbolEn": "MXN",
    "vatRate": 16,
    "marketInsights": {
      "avgOrderValue": 350,
      "peakHours": "13:00–15:30 و 19:30–22:30",
      "paymentMethod": "Digital wallets 40% | Card 35% | Cash 25%"
    }
  },
  "AR": {
    "code": "AR",
    "name": "الأرجنتين",
    "nameEn": "Argentina",
    "flag": "🇦🇷",
    "currency": "ARS",
    "currencySymbol": "$",
    "currencySymbolEn": "ARS",
    "vatRate": 21,
    "marketInsights": {
      "avgOrderValue": 8000,
      "peakHours": "12:00–14:30 و 20:00–23:00",
      "paymentMethod": "Digital wallets 40% | Cash 40% | Card 20%"
    }
  },
  "RU": {
    "code": "RU",
    "name": "روسيا",
    "nameEn": "Russia",
    "flag": "🇷🇺",
    "currency": "RUB",
    "currencySymbol": "₽",
    "currencySymbolEn": "RUB",
    "vatRate": 20,
    "marketInsights": {
      "avgOrderValue": 1500,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 50% | Cash 35% | Digital wallets 15%"
    }
  },
  "TD": {
    "code": "TD",
    "name": "تشاد",
    "nameEn": "Chad",
    "flag": "🇹🇩",
    "currency": "XAF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XAF",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "ER": {
    "code": "ER",
    "name": "إريتريا",
    "nameEn": "Eritrea",
    "flag": "🇪🇷",
    "currency": "ERN",
    "currencySymbol": "Nfk",
    "currencySymbolEn": "ERN",
    "vatRate": 5,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "SS": {
    "code": "SS",
    "name": "جنوب السودان",
    "nameEn": "South Sudan",
    "flag": "🇸🇸",
    "currency": "SSP",
    "currencySymbol": "£",
    "currencySymbolEn": "SSP",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "NE": {
    "code": "NE",
    "name": "النيجر",
    "nameEn": "Niger",
    "flag": "🇳🇪",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 19,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "ML": {
    "code": "ML",
    "name": "مالي",
    "nameEn": "Mali",
    "flag": "🇲🇱",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "SN": {
    "code": "SN",
    "name": "السنغال",
    "nameEn": "Senegal",
    "flag": "🇸🇳",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "GM": {
    "code": "GM",
    "name": "غامبيا",
    "nameEn": "Gambia",
    "flag": "🇬🇲",
    "currency": "GMD",
    "currencySymbol": "D",
    "currencySymbolEn": "GMD",
    "vatRate": 15,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "BF": {
    "code": "BF",
    "name": "بوركينا فاسو",
    "nameEn": "Burkina Faso",
    "flag": "🇧🇫",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "SL": {
    "code": "SL",
    "name": "سيراليون",
    "nameEn": "Sierra Leone",
    "flag": "🇸🇱",
    "currency": "SLL",
    "currencySymbol": "Le",
    "currencySymbolEn": "SLL",
    "vatRate": 15,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "BJ": {
    "code": "BJ",
    "name": "بنين",
    "nameEn": "Benin",
    "flag": "🇧🇯",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "SE": {
    "code": "SE",
    "name": "السويد",
    "nameEn": "Sweden",
    "flag": "🇸🇪",
    "currency": "SEK",
    "currencySymbol": "kr",
    "currencySymbolEn": "SEK",
    "vatRate": 25,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "NO": {
    "code": "NO",
    "name": "النرويج",
    "nameEn": "Norway",
    "flag": "🇳🇴",
    "currency": "NOK",
    "currencySymbol": "kr",
    "currencySymbolEn": "NOK",
    "vatRate": 25,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "DK": {
    "code": "DK",
    "name": "الدنمارك",
    "nameEn": "Denmark",
    "flag": "🇩🇰",
    "currency": "DKK",
    "currencySymbol": "kr",
    "currencySymbolEn": "DKK",
    "vatRate": 25,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "FI": {
    "code": "FI",
    "name": "فنلندا",
    "nameEn": "Finland",
    "flag": "🇫🇮",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 25.5,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "PL": {
    "code": "PL",
    "name": "بولندا",
    "nameEn": "Poland",
    "flag": "🇵🇱",
    "currency": "PLN",
    "currencySymbol": "zł",
    "currencySymbolEn": "PLN",
    "vatRate": 23,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "CZ": {
    "code": "CZ",
    "name": "التشيك",
    "nameEn": "Czechia",
    "flag": "🇨🇿",
    "currency": "CZK",
    "currencySymbol": "Kč",
    "currencySymbolEn": "CZK",
    "vatRate": 21,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "HU": {
    "code": "HU",
    "name": "المجر",
    "nameEn": "Hungary",
    "flag": "🇭🇺",
    "currency": "HUF",
    "currencySymbol": "Ft",
    "currencySymbolEn": "HUF",
    "vatRate": 27,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "RO": {
    "code": "RO",
    "name": "رومانيا",
    "nameEn": "Romania",
    "flag": "🇷🇴",
    "currency": "RON",
    "currencySymbol": "lei",
    "currencySymbolEn": "RON",
    "vatRate": 19,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "GR": {
    "code": "GR",
    "name": "اليونان",
    "nameEn": "Greece",
    "flag": "🇬🇷",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 24,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "PT": {
    "code": "PT",
    "name": "البرتغال",
    "nameEn": "Portugal",
    "flag": "🇵🇹",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 23,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "IE": {
    "code": "IE",
    "name": "أيرلندا",
    "nameEn": "Ireland",
    "flag": "🇮🇪",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 23,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "UA": {
    "code": "UA",
    "name": "أوكرانيا",
    "nameEn": "Ukraine",
    "flag": "🇺🇦",
    "currency": "UAH",
    "currencySymbol": "₴",
    "currencySymbolEn": "UAH",
    "vatRate": 20,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "KZ": {
    "code": "KZ",
    "name": "كازاخستان",
    "nameEn": "Kazakhstan",
    "flag": "🇰🇿",
    "currency": "KZT",
    "currencySymbol": "₸",
    "currencySymbolEn": "KZT",
    "vatRate": 12,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "UZ": {
    "code": "UZ",
    "name": "أوزباكستان",
    "nameEn": "Uzbekistan",
    "flag": "🇺🇿",
    "currency": "UZS",
    "currencySymbol": "so'm",
    "currencySymbolEn": "UZS",
    "vatRate": 12,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "TH": {
    "code": "TH",
    "name": "تايلند",
    "nameEn": "Thailand",
    "flag": "🇹🇭",
    "currency": "THB",
    "currencySymbol": "฿",
    "currencySymbolEn": "THB",
    "vatRate": 7,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "VN": {
    "code": "VN",
    "name": "فيتنام",
    "nameEn": "Vietnam",
    "flag": "🇻🇳",
    "currency": "VND",
    "currencySymbol": "₫",
    "currencySymbolEn": "VND",
    "vatRate": 10,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "IL": {
    "code": "IL",
    "name": "إسرائيل",
    "nameEn": "Israel",
    "flag": "🇮🇱",
    "currency": "ILS",
    "currencySymbol": "₪",
    "currencySymbolEn": "ILS",
    "vatRate": 17,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "HK": {
    "code": "HK",
    "name": "هونغ كونغ",
    "nameEn": "Hong Kong",
    "flag": "🇭🇰",
    "currency": "HKD",
    "currencySymbol": "$",
    "currencySymbolEn": "HKD",
    "vatRate": 0,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "TW": {
    "code": "TW",
    "name": "تايوان",
    "nameEn": "Taiwan",
    "flag": "🇹🇼",
    "currency": "TWD",
    "currencySymbol": "$",
    "currencySymbolEn": "TWD",
    "vatRate": 5,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "LK": {
    "code": "LK",
    "name": "سريلانكا",
    "nameEn": "Sri Lanka",
    "flag": "🇱🇰",
    "currency": "LKR",
    "currencySymbol": "Rs  රු",
    "currencySymbolEn": "LKR",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "CL": {
    "code": "CL",
    "name": "تشيلي",
    "nameEn": "Chile",
    "flag": "🇨🇱",
    "currency": "CLP",
    "currencySymbol": "$",
    "currencySymbolEn": "CLP",
    "vatRate": 19,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "CO": {
    "code": "CO",
    "name": "كولومبيا",
    "nameEn": "Colombia",
    "flag": "🇨🇴",
    "currency": "COP",
    "currencySymbol": "$",
    "currencySymbolEn": "COP",
    "vatRate": 19,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "PE": {
    "code": "PE",
    "name": "بيرو",
    "nameEn": "Peru",
    "flag": "🇵🇪",
    "currency": "PEN",
    "currencySymbol": "S/.",
    "currencySymbolEn": "PEN",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "VE": {
    "code": "VE",
    "name": "فنزويلا",
    "nameEn": "Venezuela",
    "flag": "🇻🇪",
    "currency": "VES",
    "currencySymbol": "Bs.S.",
    "currencySymbolEn": "VES",
    "vatRate": 16,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "EC": {
    "code": "EC",
    "name": "الإكوادور",
    "nameEn": "Ecuador",
    "flag": "🇪🇨",
    "currency": "USD",
    "currencySymbol": "$",
    "currencySymbolEn": "USD",
    "vatRate": 12,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "CR": {
    "code": "CR",
    "name": "كوستاريكا",
    "nameEn": "Costa Rica",
    "flag": "🇨🇷",
    "currency": "CRC",
    "currencySymbol": "₡",
    "currencySymbolEn": "CRC",
    "vatRate": 13,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "PA": {
    "code": "PA",
    "name": "بنما",
    "nameEn": "Panama",
    "flag": "🇵🇦",
    "currency": "PAB",
    "currencySymbol": "B/.",
    "currencySymbolEn": "PAB",
    "vatRate": 7,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "DO": {
    "code": "DO",
    "name": "جمهورية الدومينيكان",
    "nameEn": "Dominican Republic",
    "flag": "🇩🇴",
    "currency": "DOP",
    "currencySymbol": "$",
    "currencySymbolEn": "DOP",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "ET": {
    "code": "ET",
    "name": "إثيوبيا",
    "nameEn": "Ethiopia",
    "flag": "🇪🇹",
    "currency": "ETB",
    "currencySymbol": "Br",
    "currencySymbolEn": "ETB",
    "vatRate": 15,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "GH": {
    "code": "GH",
    "name": "غانا",
    "nameEn": "Ghana",
    "flag": "🇬🇭",
    "currency": "GHS",
    "currencySymbol": "₵",
    "currencySymbolEn": "GHS",
    "vatRate": 15,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "TZ": {
    "code": "TZ",
    "name": "تنزانيا",
    "nameEn": "Tanzania",
    "flag": "🇹🇿",
    "currency": "TZS",
    "currencySymbol": "Sh",
    "currencySymbolEn": "TZS",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "UG": {
    "code": "UG",
    "name": "أوغندا",
    "nameEn": "Uganda",
    "flag": "🇺🇬",
    "currency": "UGX",
    "currencySymbol": "Sh",
    "currencySymbolEn": "UGX",
    "vatRate": 18,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "ZM": {
    "code": "ZM",
    "name": "زامبيا",
    "nameEn": "Zambia",
    "flag": "🇿🇲",
    "currency": "ZMW",
    "currencySymbol": "ZK",
    "currencySymbolEn": "ZMW",
    "vatRate": 16,
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  }
};

  const PLATFORMS_DATA = {
  "SA": {
    "code": "SA",
    "name": "السعودية",
    "nameEn": "Saudi Arabia",
    "flag": "🇸🇦",
    "currency": "SAR",
    "currencySymbol": "ر.س",
    "currencySymbolEn": "SAR",
    "vatRate": 15,
    "platforms": [
      {
        "id": "plat_hunger",
        "operatingModel": "closed",
        "name": "هنقرستيشن (توصيل)",
        "nameEn": "HungerStation (Delivery)",
        "fee": 25,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 50,
          "restaurantShare": 4.5
        },
        "serviceFee": 2,
        "paymentGatewayFee": 1.75,
        "setupFee": 2000
      },
      {
        "id": "plat_hunger_market",
        "operatingModel": "open",
        "name": "هنقرستيشن (ماركت)",
        "nameEn": "HungerStation (Marketplace)",
        "fee": 11,
        "confidence": "verified",
        "serviceFee": 0,
        "paymentGatewayFee": 1.75,
        "setupFee": 2000
      },
      {
        "id": "plat_jahez",
        "operatingModel": "closed",
        "name": "جاهز",
        "nameEn": "Jahez",
        "fee": 25,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 60,
          "restaurantShare": 5
        },
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "setupFee": 2000,
        "feeTiers": [
          {
            "min": 0,
            "max": 74,
            "fee": 25
          },
          {
            "min": 75,
            "max": 999999,
            "fee": 23
          }
        ]
      },
      {
        "id": "plat_mrsoul",
        "operatingModel": "open",
        "name": "مرسول",
        "nameEn": "Mrsool",
        "fee": 12,
        "confidence": "verified",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 25,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 50,
          "restaurantShare": 5
        },
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_to_you",
        "operatingModel": "closed",
        "name": "تويو",
        "nameEn": "ToYou",
        "fee": 22,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "deliverySupport": 4
      },
      {
        "id": "plat_the_chefz",
        "operatingModel": "closed",
        "name": "ذا شفز",
        "nameEn": "The Chefz",
        "fee": 25,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_shgardi",
        "operatingModel": "closed",
        "name": "شقردي",
        "nameEn": "Shgardi",
        "fee": 22,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_daily_mealz",
        "operatingModel": "subscription",
        "name": "ديلي ميلز",
        "nameEn": "DailyMealz",
        "fee": 0,
        "confidence": "verified",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_lugmety",
        "operatingModel": "closed",
        "name": "لقمتي",
        "nameEn": "Lugmety",
        "fee": 18,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_burgerizzr",
        "operatingModel": "closed",
        "name": "برجريززر",
        "nameEn": "Burgerizzr",
        "fee": 18,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_keeta",
        "operatingModel": "closed",
        "name": "كيتا",
        "nameEn": "Keeta",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 40,
          "restaurantShare": 3
        },
        "serviceFee": 2,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_careem",
        "operatingModel": "closed",
        "name": "كريم ناو",
        "nameEn": "Careem NOW",
        "fee": 22,
        "confidence": "verified",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_noon",
        "operatingModel": "closed",
        "name": "نون فود",
        "nameEn": "Noon Food",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 35,
          "restaurantShare": 3
        },
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_ninja",
        "operatingModel": "closed",
        "name": "نينجا",
        "nameEn": "Ninja",
        "fee": 15,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_get_cari",
        "operatingModel": "closed",
        "name": "كاري",
        "nameEn": "Get Cari",
        "fee": 18,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_ngwah",
        "operatingModel": "closed",
        "name": "نجوة",
        "nameEn": "Ngwah",
        "fee": 18,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_calo",
        "operatingModel": "subscription",
        "name": "كالو",
        "nameEn": "Calo",
        "fee": 0,
        "confidence": "verified",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_freshhouse",
        "operatingModel": "subscription",
        "name": "فرش هاوس",
        "nameEn": "Freshhouse",
        "fee": 0,
        "confidence": "verified",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_right_bite",
        "operatingModel": "subscription",
        "name": "رايت بايت",
        "nameEn": "Right Bite",
        "fee": 0,
        "confidence": "verified",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_amazon",
        "operatingModel": "closed",
        "name": "أمازون برايم",
        "nameEn": "Amazon Prime Now",
        "fee": 18,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_wssel",
        "operatingModel": "open",
        "name": "وصّل",
        "nameEn": "Wssel",
        "fee": 18,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_nana",
        "name": "نعناع",
        "nameEn": "Nana",
        "operatingModel": "closed",
        "fee": 22,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_mr_mandob",
        "name": "مستر مندوب",
        "nameEn": "Mr Mandob",
        "operatingModel": "open",
        "fee": 12,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified",
        "serviceFee": 0,
        "paymentGatewayFee": 0
      }
    ],
    "marketInsights": {
      "avgOrderValue": 65,
      "peakHours": "12:30–14:00 و 19:30–22:00 (السحور 02:00–04:00 في رمضان)",
      "ramadanMultiplier": 1.5,
      "weekendBehavior": "الخميس–السبت أعلى طلباً بـ 35%. العائلات تفضل وجبات جماعية كبيرة.",
      "popularCategories": [
        "الكبسة",
        "المندي",
        "الشاورما",
        "البرجر",
        "الوجبات السريعة",
        "الحلويات الشرقية"
      ],
      "paymentMethod": "البطاقة 78% | كاش عند الاستلام 20% | محافظ رقمية 2%",
      "specialNotes": "توصيل ليلي مرتفع جداً في رمضان. هنقرستيشن يُستخدم كاسم عام للتوصيل. اليوم الوطني (23 سبتمبر) يرفع الطلبات 40%."
    }
  },
  "AE": {
    "code": "AE",
    "name": "الإمارات",
    "nameEn": "UAE",
    "flag": "🇦🇪",
    "currency": "AED",
    "currencySymbol": "د.إ",
    "currencySymbolEn": "AED",
    "vatRate": 5,
    "platforms": [
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 30,
          "restaurantShare": 5
        },
        "feeTiers": [
          {
            "min": 0,
            "max": 10000,
            "fee": 22
          },
          {
            "min": 10001,
            "max": 50000,
            "fee": 20
          },
          {
            "min": 50001,
            "max": 999999,
            "fee": 18
          }
        ]
      },
      {
        "id": "plat_deliveroo",
        "operatingModel": "closed",
        "name": "ديليفرو",
        "nameEn": "Deliveroo",
        "fee": 28,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 60,
          "restaurantShare": 6
        }
      },
      {
        "id": "plat_careem",
        "operatingModel": "closed",
        "name": "كريم ناو",
        "nameEn": "Careem NOW",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 30,
          "restaurantShare": 5
        }
      },
      {
        "id": "plat_noon",
        "operatingModel": "closed",
        "name": "نون فود",
        "nameEn": "Noon Food",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 25,
          "restaurantShare": 4
        }
      },
      {
        "id": "plat_keeta",
        "operatingModel": "closed",
        "name": "كيتا",
        "nameEn": "Keeta",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 25,
          "restaurantShare": 3
        }
      },
      {
        "id": "plat_zomato",
        "operatingModel": "closed",
        "name": "زوماتو",
        "nameEn": "Zomato",
        "fee": 22,
        "confidence": "verified"
      },
      {
        "id": "plat_eat_easy",
        "operatingModel": "closed",
        "name": "إيت إيزي",
        "nameEn": "EatEasy",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_munch_on",
        "operatingModel": "closed",
        "name": "مانش أون",
        "nameEn": "Munch:on",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_insta_shop",
        "operatingModel": "closed",
        "name": "إنستا شوب",
        "nameEn": "InstaShop",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_smiles",
        "operatingModel": "closed",
        "name": "سمايلز",
        "nameEn": "Smiles",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_carriage",
        "operatingModel": "closed",
        "name": "كاريدج",
        "nameEn": "Carriage",
        "fee": 22,
        "confidence": "estimated"
      },
      {
        "id": "plat_glovo",
        "operatingModel": "closed",
        "name": "غلوفو",
        "nameEn": "Glovo",
        "fee": 25,
        "confidence": "verified"
      },
      {
        "id": "plat_supermeal",
        "operatingModel": "closed",
        "name": "سوبرميل",
        "nameEn": "Supermeal",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_cari",
        "operatingModel": "closed",
        "name": "كاري",
        "nameEn": "Cari",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 85,
      "peakHours": "12:00–14:30 و 19:00–22:30 (السحور 01:00–03:30 في رمضان)",
      "ramadanMultiplier": 1.4,
      "weekendBehavior": "الجمعة أقل طلباً. السبت–الأربعاء أعلى. الوافدون يطلبون أكثر من المواطنين.",
      "popularCategories": [
        "البرجر",
        "السوشي",
        "البيتزا",
        "المأكولات الهندية",
        "اللبناني",
        "العصائر والمخبوزات"
      ],
      "paymentMethod": "البطاقة 85% | Apple Pay/Google Pay 10% | كاش 5%",
      "specialNotes": "دبي الأعلى قيمة طلب. أبوظبي أكثر ولاءً للمنصات. طلبات 45% سوق. ديليفرو 25% (متميزة بالمطاعم الراقية)."
    }
  },
  "KW": {
    "code": "KW",
    "name": "الكويت",
    "nameEn": "Kuwait",
    "flag": "🇰🇼",
    "currency": "KWD",
    "currencySymbol": "د.ك",
    "currencySymbolEn": "KWD",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 20,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 3,
          "restaurantShare": 0.5
        }
      },
      {
        "id": "plat_carriage",
        "operatingModel": "closed",
        "name": "كاريدج",
        "nameEn": "Carriage",
        "fee": 22,
        "confidence": "estimated",
        "freeDelivery": {
          "threshold": 4,
          "restaurantShare": 0.6
        }
      },
      {
        "id": "plat_deliveroo",
        "operatingModel": "closed",
        "name": "ديليفرو",
        "nameEn": "Deliveroo",
        "fee": 28,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 5,
          "restaurantShare": 0.7
        }
      },
      {
        "id": "plat_keeta",
        "operatingModel": "closed",
        "name": "كيتا",
        "nameEn": "Keeta",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 2.5,
          "restaurantShare": 0.4
        }
      },
      {
        "id": "plat_careem",
        "operatingModel": "closed",
        "name": "كريم ناو",
        "nameEn": "Careem NOW",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 3,
          "restaurantShare": 0.5
        }
      },
      {
        "id": "plat_noon",
        "operatingModel": "closed",
        "name": "نون فود",
        "nameEn": "Noon Food",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 2.5,
          "restaurantShare": 0.4
        }
      },
      {
        "id": "plat_daily_mealz",
        "operatingModel": "subscription",
        "name": "ديلي ميلز",
        "nameEn": "DailyMealz",
        "fee": 0,
        "confidence": "estimated"
      },
      {
        "id": "plat_mashkor",
        "operatingModel": "closed",
        "name": "مشكور",
        "nameEn": "Mashkor",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_raha",
        "operatingModel": "closed",
        "name": "رهة / شوب رهة",
        "nameEn": "Raha / ShopRaha",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_cari",
        "operatingModel": "closed",
        "name": "كاري",
        "nameEn": "Cari",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_armada",
        "operatingModel": "closed",
        "name": "أرمادا",
        "nameEn": "Armada",
        "fee": 15,
        "confidence": "estimated"
      },
      {
        "id": "plat_to_you",
        "operatingModel": "closed",
        "name": "تويو",
        "nameEn": "ToYou",
        "fee": 22,
        "confidence": "estimated",
        "deliverySupport": 4
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 6.5,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الخميس والجمعة أعلى أيام. العائلات الكبيرة تطلب بانتظام.",
      "popularCategories": [
        "المشويات",
        "الكباب",
        "الكبسة",
        "المأكولات البحرية",
        "الحلويات الكويتية",
        "الشاورما"
      ],
      "paymentMethod": "كاش عند الاستلام 45% | البطاقة 50% | محافظ رقمية 5%",
      "specialNotes": "الكويت حدّت العمولات بقرار وزاري (فبراير 2026) لمدة 3 سنوات. طلبات تأسست في الكويت 2004. كاريدج تأسست 2016. متوسط الطلب ~6.5 د.ك."
    }
  },
  "QA": {
    "code": "QA",
    "name": "قطر",
    "nameEn": "Qatar",
    "flag": "🇶🇦",
    "currency": "QAR",
    "currencySymbol": "ر.ق",
    "currencySymbolEn": "QAR",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 35,
          "restaurantShare": 5
        }
      },
      {
        "id": "plat_carriage",
        "operatingModel": "closed",
        "name": "كاريدج",
        "nameEn": "Carriage",
        "fee": 22,
        "confidence": "estimated",
        "freeDelivery": {
          "threshold": 40,
          "restaurantShare": 5
        }
      },
      {
        "id": "plat_snoonu",
        "operatingModel": "closed",
        "name": "سنونو",
        "nameEn": "Snoonu",
        "fee": 18,
        "confidence": "estimated",
        "freeDelivery": {
          "threshold": 30,
          "restaurantShare": 4
        }
      },
      {
        "id": "plat_rafeeq",
        "operatingModel": "closed",
        "name": "رفيق",
        "nameEn": "Rafeeq",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_fingertips",
        "operatingModel": "closed",
        "name": "فينجرتيبس",
        "nameEn": "Fingertips",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_akly",
        "operatingModel": "closed",
        "name": "أكلي",
        "nameEn": "Akly",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_foodak",
        "operatingModel": "closed",
        "name": "فوداك",
        "nameEn": "Foodak",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_keeta",
        "operatingModel": "closed",
        "name": "كيتا",
        "nameEn": "Keeta",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 25,
          "restaurantShare": 3
        }
      },
      {
        "id": "plat_careem",
        "operatingModel": "closed",
        "name": "كريم ناو",
        "nameEn": "Careem NOW",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 35,
          "restaurantShare": 5
        }
      },
      {
        "id": "plat_mrsoul",
        "operatingModel": "open",
        "name": "مرسول",
        "nameEn": "Mrsool",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 30,
          "restaurantShare": 4
        }
      },
      {
        "id": "plat_jeeb",
        "operatingModel": "closed",
        "name": "جيب",
        "nameEn": "Jeeb",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_rafiki",
        "operatingModel": "closed",
        "name": "رفيقي",
        "nameEn": "Rafiki",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_eat_easy",
        "operatingModel": "closed",
        "name": "إيت إيزي",
        "nameEn": "EatEasy",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_uber",
        "operatingModel": "closed",
        "name": "أوبر إيتس",
        "nameEn": "Uber Eats",
        "fee": 20,
        "confidence": "verified"
      },
      {
        "id": "plat_clicks",
        "operatingModel": "closed",
        "name": "كليكس",
        "nameEn": "Clicks",
        "fee": 5,
        "confidence": "estimated"
      },
      {
        "id": "plat_baqaala",
        "operatingModel": "closed",
        "name": "بقالة",
        "nameEn": "Baqaala",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 70,
      "peakHours": "12:00–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.4,
      "weekendBehavior": "الجمعة أقل. الخميس والسبت أعلى. المطاعم الراقية تحظى بطلب عالٍ.",
      "popularCategories": [
        "المشويات",
        "المأكولات الهندية",
        "اللبناني",
        "البرجر",
        "الحلويات العربية"
      ],
      "paymentMethod": "البطاقة 80% | كاش 15% | محافظ رقمية 5%",
      "specialNotes": "سنونو قطري محلي (استحوذت عليه جاهز 76.56%). طلبات غُرّمت 1.14 مليون ر.ق (2025). ديليفرو أغلقت قطر (مارس 2026)."
    }
  },
  "BH": {
    "code": "BH",
    "name": "البحرين",
    "nameEn": "Bahrain",
    "flag": "🇧🇭",
    "currency": "BHD",
    "currencySymbol": "د.ب",
    "currencySymbolEn": "BHD",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 3,
          "restaurantShare": 0.5
        }
      },
      {
        "id": "plat_hunger",
        "operatingModel": "closed",
        "name": "هنقرستيشن",
        "nameEn": "HungerStation",
        "fee": 22,
        "confidence": "estimated",
        "freeDelivery": {
          "threshold": 5,
          "restaurantShare": 0.8
        }
      },
      {
        "id": "plat_jahez",
        "operatingModel": "closed",
        "name": "جاهز",
        "nameEn": "Jahez",
        "fee": 20,
        "confidence": "estimated",
        "freeDelivery": {
          "threshold": 5,
          "restaurantShare": 0.7
        }
      },
      {
        "id": "plat_deliveroo",
        "operatingModel": "closed",
        "name": "ديليفرو",
        "nameEn": "Deliveroo",
        "fee": 28,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 6,
          "restaurantShare": 0.9
        }
      },
      {
        "id": "plat_careem",
        "operatingModel": "closed",
        "name": "كريم ناو",
        "nameEn": "Careem NOW",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 3,
          "restaurantShare": 0.5
        }
      },
      {
        "id": "plat_glovo",
        "operatingModel": "closed",
        "name": "غلوفو",
        "nameEn": "Glovo",
        "fee": 25,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 4,
          "restaurantShare": 0.7
        }
      },
      {
        "id": "plat_eat_easy",
        "operatingModel": "closed",
        "name": "إيت إيزي",
        "nameEn": "EatEasy",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_wssel",
        "operatingModel": "open",
        "name": "وصّل",
        "nameEn": "Wssel",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_noon",
        "operatingModel": "closed",
        "name": "نون فود",
        "nameEn": "Noon Food",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 3,
          "restaurantShare": 0.4
        }
      },
      {
        "id": "plat_burgerizzr",
        "operatingModel": "closed",
        "name": "برجريززر",
        "nameEn": "Burgerizzr",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_ninja_kitchen",
        "operatingModel": "closed",
        "name": "نينجا كيتشن",
        "nameEn": "Ninja Kitchen",
        "fee": 15,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 7,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الخميس والجمعة أعلى. مطاعم الشوارع الشعبية شائعة.",
      "popularCategories": [
        "الكباب",
        "الشاورما",
        "الوجبات البحرينية",
        "المأكولات الهندية",
        "الحلويات"
      ],
      "paymentMethod": "البطاقة 75% | كاش 20% | محافظ رقمية 5%",
      "specialNotes": "طلبات تملك ~60%+ سوق البحرين. جاهز نما 50% سنوياً بعد 2025. نينجا كيتشن تجرب توصيل بالدرونات (2026)."
    }
  },
  "OM": {
    "code": "OM",
    "name": "عمان",
    "nameEn": "Oman",
    "flag": "🇴🇲",
    "currency": "OMR",
    "currencySymbol": "ر.ع",
    "currencySymbolEn": "OMR",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 3,
          "restaurantShare": 0.5
        }
      },
      {
        "id": "plat_carriage",
        "operatingModel": "closed",
        "name": "كاريدج",
        "nameEn": "Carriage",
        "fee": 22,
        "confidence": "estimated"
      },
      {
        "id": "plat_careem",
        "operatingModel": "closed",
        "name": "كريم ناو",
        "nameEn": "Careem NOW",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 3,
          "restaurantShare": 0.5
        }
      },
      {
        "id": "plat_wssel",
        "operatingModel": "open",
        "name": "وصّل",
        "nameEn": "Wssel",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_lugmety",
        "operatingModel": "closed",
        "name": "لقمتي",
        "nameEn": "Lugmety",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_toters",
        "operatingModel": "closed",
        "name": "توترز",
        "nameEn": "Toters",
        "fee": 25,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 3,
          "restaurantShare": 0.5
        }
      },
      {
        "id": "plat_zomato",
        "operatingModel": "closed",
        "name": "زوماتو",
        "nameEn": "Zomato",
        "fee": 22,
        "confidence": "verified"
      },
      {
        "id": "plat_keeta",
        "operatingModel": "closed",
        "name": "كيتا",
        "nameEn": "Keeta",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 2.5,
          "restaurantShare": 0.4
        }
      },
      {
        "id": "plat_noon",
        "operatingModel": "closed",
        "name": "نون فود",
        "nameEn": "Noon Food",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 2.5,
          "restaurantShare": 0.4
        }
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 8,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الخميس والجمعة أعلى. الطلبات العائلية الكبيرة شائعة.",
      "popularCategories": [
        "الكبسة العمانية",
        "المشويات",
        "الشاورما",
        "السمك",
        "الحلويات العمانية"
      ],
      "paymentMethod": "كاش عند الاستلام 55% | البطاقة 40% | محافظ رقمية 5%",
      "specialNotes": "أقل عدد سكان بين دول الخليج. طلبات هي السائد. كيتا أعلنت نيتها التوسع للبحرين وعمان. متوسط الطلب ~8 ر.ع."
    }
  },
  "EG": {
    "code": "EG",
    "name": "مصر",
    "nameEn": "Egypt",
    "flag": "🇪🇬",
    "currency": "EGP",
    "currencySymbol": "ج.م",
    "currencySymbolEn": "EGP",
    "vatRate": 14,
    "platforms": [
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 25,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 150,
          "restaurantShare": 15
        },
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "selfDeliveryFee": 13.5,
        "campaignDiscount": 50
      },
      {
        "id": "plat_elmenus",
        "operatingModel": "closed",
        "name": "إلمينيوز",
        "nameEn": "Elmenus",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 100,
          "restaurantShare": 10
        },
        "serviceFee": 0,
        "paymentGatewayFee": 2.5,
        "selfDeliveryFee": 11,
        "campaignDiscount": 0
      },
      {
        "id": "plat_careem",
        "operatingModel": "closed",
        "name": "كريم ناو",
        "nameEn": "Careem NOW",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 150,
          "restaurantShare": 15
        },
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      },
      {
        "id": "plat_noon",
        "operatingModel": "closed",
        "name": "نون فود",
        "nameEn": "Noon Food",
        "fee": 15,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 100,
          "restaurantShare": 10
        },
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      },
      {
        "id": "plat_mrsoul",
        "operatingModel": "open",
        "name": "مرسول",
        "nameEn": "Mrsool",
        "fee": 10,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 100,
          "restaurantShare": 10
        },
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      },
      {
        "id": "plat_bolt",
        "operatingModel": "closed",
        "name": "بولت فود",
        "nameEn": "Bolt Food",
        "fee": 18,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 120,
          "restaurantShare": 12
        },
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      },
      {
        "id": "plat_otlob",
        "operatingModel": "closed",
        "name": "أطلب",
        "nameEn": "Otlob",
        "fee": 22,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      },
      {
        "id": "plat_insta_shop",
        "operatingModel": "closed",
        "name": "إنستا شوب",
        "nameEn": "InstaShop",
        "fee": 18,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      },
      {
        "id": "plat_rabbit",
        "name": "رابت",
        "nameEn": "Rabbit",
        "operatingModel": "closed",
        "fee": 18,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      },
      {
        "id": "plat_breadfast",
        "name": "بريدفاست",
        "nameEn": "Breadfast",
        "operatingModel": "closed",
        "fee": 15,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      },
      {
        "id": "plat_indrive",
        "name": "إندرايف توصيل",
        "nameEn": "inDrive Delivery",
        "operatingModel": "open",
        "fee": 10,
        "confidence": "estimated",
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified",
        "serviceFee": 0,
        "paymentGatewayFee": 0,
        "campaignDiscount": 0
      }
    ],
    "marketInsights": {
      "avgOrderValue": 280,
      "peakHours": "13:00–15:00 و 20:00–23:00 (السحور 02:00–04:00 في رمضان)",
      "ramadanMultiplier": 1.6,
      "weekendBehavior": "الجمعة والسبت أعلى. العائلات تطلب وجبات كبيرة. الطلبات الليلية مرتفعة جداً.",
      "popularCategories": [
        "الكشري",
        "الفول والطعمية",
        "المشويات",
        "الكبدة",
        "البيتزا",
        "الحواوشي"
      ],
      "paymentMethod": "كاش عند الاستلام 70% | البطاقة 25% | محافظ رقمية 5% (فوري/فودافون كاش)",
      "specialNotes": "السوق ~3.9 مليار دولار (2025). أوبر إيتس وزوماتو انسحبتا. إلمينيوز منافس محلي قوي. التضخم يؤثر على الأسعار باستمرار. متوسط الطلب ~280 ج.م."
    }
  },
  "JO": {
    "code": "JO",
    "name": "الأردن",
    "nameEn": "Jordan",
    "flag": "🇯🇴",
    "currency": "JOD",
    "currencySymbol": "د.أ",
    "currencySymbolEn": "JOD",
    "vatRate": 16,
    "platforms": [
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 5,
          "restaurantShare": 0.8
        }
      },
      {
        "id": "plat_careem",
        "operatingModel": "closed",
        "name": "كريم ناو",
        "nameEn": "Careem NOW",
        "fee": 22,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 5,
          "restaurantShare": 0.8
        }
      },
      {
        "id": "plat_toters",
        "operatingModel": "closed",
        "name": "توترز",
        "nameEn": "Toters",
        "fee": 25,
        "confidence": "verified",
        "freeDelivery": {
          "threshold": 7,
          "restaurantShare": 1
        }
      },
      {
        "id": "plat_jahez",
        "operatingModel": "closed",
        "name": "جاهز",
        "nameEn": "Jahez",
        "fee": 20,
        "confidence": "estimated",
        "freeDelivery": {
          "threshold": 5,
          "restaurantShare": 0.7
        }
      },
      {
        "id": "plat_aroundtown",
        "operatingModel": "closed",
        "name": "أراوند تاون",
        "nameEn": "Aroundtown",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_sabag",
        "operatingModel": "closed",
        "name": "صباغ",
        "nameEn": "Sabag",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_kaasak",
        "operatingModel": "closed",
        "name": "قعسك",
        "nameEn": "Kaasak",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_bilforon",
        "operatingModel": "closed",
        "name": "بالفرن",
        "nameEn": "Bilforon",
        "fee": 15,
        "confidence": "estimated"
      },
      {
        "id": "plat_noor_healthy",
        "operatingModel": "closed",
        "name": "نور هيلثي",
        "nameEn": "Noor Healthy",
        "fee": 15,
        "confidence": "estimated"
      },
      {
        "id": "plat_basket_jo",
        "operatingModel": "closed",
        "name": "باسكت دوت جو",
        "nameEn": "Basket.Jo",
        "fee": 15,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 12,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الجمعة أقل. الخميس والسبت أعلى.",
      "popularCategories": [
        "المنسف",
        "الكباب",
        "الشاورما",
        "الفلافل",
        "المقبلات اللبنانية"
      ],
      "paymentMethod": "كاش عند الاستلام 60% | البطاقة 35% | محافظ رقمية 5%",
      "specialNotes": "توترز له حضور قوي في الأردن ولبنان. جاهز تتوسع إقليمياً. صباغ وبالفرن محليون أردنيون. متوسط الطلب ~12 د.أ."
    }
  },
  "IQ": {
    "code": "IQ",
    "name": "العراق",
    "nameEn": "Iraq",
    "flag": "🇮🇶",
    "currency": "IQD",
    "currencySymbol": "د.ع",
    "currencySymbolEn": "IQD",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 22,
        "confidence": "verified"
      },
      {
        "id": "plat_toters",
        "operatingModel": "closed",
        "name": "توترز",
        "nameEn": "Toters",
        "fee": 25,
        "confidence": "verified"
      },
      {
        "id": "plat_careem",
        "operatingModel": "closed",
        "name": "كريم",
        "nameEn": "Careem",
        "fee": 22,
        "confidence": "verified"
      },
      {
        "id": "plat_talabati",
        "operatingModel": "closed",
        "name": "طلباتي",
        "nameEn": "Talabati",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_alsaree3",
        "operatingModel": "closed",
        "name": "السريع",
        "nameEn": "Alsaree3",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_mrsoul",
        "operatingModel": "open",
        "name": "مرسول",
        "nameEn": "Mrsool",
        "fee": 18,
        "confidence": "verified"
      },
      {
        "id": "plat_wasalt",
        "operatingModel": "closed",
        "name": "وصّلت",
        "nameEn": "Wasalt",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 15000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الجمعة أعلى. العائلات تطلب وجبات كبيرة.",
      "popularCategories": [
        "الكباب العراقي",
        "ال dolma",
        "التمري",
        "البرياني",
        "الشاورما"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | البطاقة 8% | محافظ رقمية 2%",
      "specialNotes": "طلباتي والسريع عراقيان محليان. توترز وطلبات يتنافسان بقوة. الدفع عند الاستلام هو السائد (90%). متوسط الطلب ~15,000 د.ع."
    }
  },
  "LB": {
    "code": "LB",
    "name": "لبنان",
    "nameEn": "Lebanon",
    "flag": "🇱🇧",
    "currency": "LBP",
    "currencySymbol": "ل.ل",
    "currencySymbolEn": "LBP",
    "vatRate": 11,
    "platforms": [
      {
        "id": "plat_toters",
        "operatingModel": "closed",
        "name": "توترز",
        "nameEn": "Toters",
        "fee": 25,
        "confidence": "verified"
      },
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 28,
        "confidence": "verified"
      },
      {
        "id": "plat_foodics",
        "operatingModel": "closed",
        "name": "فودكس أونلاين",
        "nameEn": "Foodics Online",
        "fee": 0,
        "confidence": "estimated"
      },
      {
        "id": "plat_wakilni",
        "operatingModel": "closed",
        "name": "وكيلني",
        "nameEn": "Wakilni",
        "fee": 5,
        "confidence": "estimated"
      },
      {
        "id": "plat_nasnous",
        "operatingModel": "closed",
        "name": "نسنوس",
        "nameEn": "Nasnous",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 250000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل. السبت أعلى.",
      "popularCategories": [
        "الكباب",
        "الشاورما",
        "الفلافل",
        "المقبلات اللبنانية",
        "الحلويات اللبنانية"
      ],
      "paymentMethod": "كاش عند الاستلام 70% | البطاقة 25% | محافظ رقمية 5%",
      "specialNotes": "وكيلني يأخذ رسوم توصيل (2–6$) لا عمولة. العمولات عالية بسبب الأزمة (تصل 45–50% مع التسويق). ديليفرو انسحبت 2022. متوسط الطلب ~250,000 ل.ل."
    }
  },
  "SY": {
    "code": "SY",
    "name": "سوريا",
    "nameEn": "Syria",
    "flag": "🇸🇾",
    "currency": "SYP",
    "currencySymbol": "ل.س",
    "currencySymbolEn": "SYP",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_beeorder",
        "operatingModel": "closed",
        "name": "بي أوردر",
        "nameEn": "Beeorder",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 15000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكباب",
        "الشاورما",
        "الفلافل",
        "المشويات",
        "المأكولات السورية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 95% | البطاقة 5%",
      "specialNotes": "السوق السوري محدود التطبيقات. بي أوردر هو الأبرز محلياً (~120,000 طلب/شهر). لا توجد تطبيقات دولية بسبب العقوبات. متوسط الطلب ~15,000 ل.س."
    }
  },
  "PS": {
    "code": "PS",
    "name": "فلسطين",
    "nameEn": "Palestine",
    "flag": "🇵🇸",
    "currency": "USD",
    "currencySymbol": "$",
    "currencySymbolEn": "USD",
    "vatRate": 16,
    "platforms": [
      {
        "id": "plat_toters",
        "operatingModel": "closed",
        "name": "توترز",
        "nameEn": "Toters",
        "fee": 25,
        "confidence": "verified"
      },
      {
        "id": "plat_talabat",
        "operatingModel": "closed",
        "name": "طلبات",
        "nameEn": "Talabat",
        "fee": 22,
        "confidence": "verified"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 18,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكباب",
        "الشاورما",
        "الفلافل",
        "المقلوبة",
        "المأكولات الفلسطينية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 75% | البطاقة 20% | محافظ رقمية 5%",
      "specialNotes": "السوق الفلسطيني متأثر بالوضع السياسي. توترز الأبرز في الضفة. غزة: التوصيل التجاري منهار تقريباً. متوسط الطلب ~$18."
    }
  },
  "TN": {
    "code": "TN",
    "name": "تونس",
    "nameEn": "Tunisia",
    "flag": "🇹🇳",
    "currency": "TND",
    "currencySymbol": "د.ت",
    "currencySymbolEn": "TND",
    "vatRate": 19,
    "platforms": [
      {
        "id": "plat_glovo",
        "operatingModel": "closed",
        "name": "غلوفو",
        "nameEn": "Glovo",
        "fee": 28,
        "confidence": "verified"
      },
      {
        "id": "plat_yassir",
        "operatingModel": "closed",
        "name": "ياسير",
        "nameEn": "Yassir",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_jumia",
        "operatingModel": "closed",
        "name": "جوميا فود",
        "nameEn": "Jumia Food",
        "fee": 14,
        "confidence": "verified"
      },
      {
        "id": "plat_bolt",
        "operatingModel": "closed",
        "name": "بولت فود",
        "nameEn": "Bolt Food",
        "fee": 18,
        "confidence": "verified"
      },
      {
        "id": "plat_local",
        "operatingModel": "closed",
        "name": "تطبيقات محلية",
        "nameEn": "Local Apps",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 25,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل. السبت والأحد أعلى.",
      "popularCategories": [
        "الكسكسي",
        "الشاورما",
        "البرجر",
        "المأكولات التونسية التقليدية",
        "الحلويات"
      ],
      "paymentMethod": "كاش عند الاستلام 80% | البطاقة 15% | محافظ رقمية 5%",
      "specialNotes": "ياسير سوبر-أب جزائري يتوسع في تونس. جوميا فود يقلص عملياته في شمال إفريقيا. غلوفو هي الأبرز. متوسط الطلب ~25 د.ت."
    }
  },
  "DZ": {
    "code": "DZ",
    "name": "الجزائر",
    "nameEn": "Algeria",
    "flag": "🇩🇿",
    "currency": "DZD",
    "currencySymbol": "د.ج",
    "currencySymbolEn": "DZD",
    "vatRate": 19,
    "platforms": [
      {
        "id": "plat_yassir",
        "operatingModel": "closed",
        "name": "ياسير",
        "nameEn": "Yassir",
        "fee": 15,
        "confidence": "estimated"
      },
      {
        "id": "plat_temtem",
        "operatingModel": "closed",
        "name": "تمتم وان",
        "nameEn": "Temtem One",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_felhanout",
        "operatingModel": "closed",
        "name": "فلحانوت",
        "nameEn": "Felhanout",
        "fee": 3,
        "confidence": "estimated"
      },
      {
        "id": "plat_nresto",
        "operatingModel": "closed",
        "name": "ان رستو",
        "nameEn": "NResto",
        "fee": 0,
        "confidence": "estimated"
      },
      {
        "id": "plat_ndeliv",
        "operatingModel": "closed",
        "name": "ان ديليف",
        "nameEn": "Ndeliv",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_jumia",
        "operatingModel": "closed",
        "name": "جوميا فود",
        "nameEn": "Jumia Food",
        "fee": 14,
        "confidence": "verified"
      },
      {
        "id": "plat_heetch",
        "operatingModel": "closed",
        "name": "هيتش",
        "nameEn": "Heetch",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 800,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل. السبت والأحد أعلى.",
      "popularCategories": [
        "الكسكسي",
        "الشاورما",
        "البرجر",
        "المشويات",
        "المأكولات الجزائرية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 85% | البطاقة 12% | محافظ رقمية 3%",
      "specialNotes": "ياسير السائد (8 مليون مستخدم، 45 مدينة). تمتم وان منافس جزائري (~5.7M تمويل). فلحانوت نموذج SaaS جديد (3% فقط). متوسط الطلب ~800 د.ج."
    }
  },
  "MA": {
    "code": "MA",
    "name": "المغرب",
    "nameEn": "Morocco",
    "flag": "🇲🇦",
    "currency": "MAD",
    "currencySymbol": "د.م",
    "currencySymbolEn": "MAD",
    "vatRate": 20,
    "platforms": [
      {
        "id": "plat_glovo",
        "operatingModel": "closed",
        "name": "غلوفو",
        "nameEn": "Glovo",
        "fee": 30,
        "confidence": "verified"
      },
      {
        "id": "plat_jumia",
        "operatingModel": "closed",
        "name": "جوميا فود",
        "nameEn": "Jumia Food",
        "fee": 14,
        "confidence": "verified"
      },
      {
        "id": "plat_kooul",
        "operatingModel": "closed",
        "name": "كول",
        "nameEn": "Kooul",
        "fee": 20,
        "confidence": "estimated"
      },
      {
        "id": "plat_heetch",
        "operatingModel": "closed",
        "name": "هيتش",
        "nameEn": "Heetch",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_kaalix",
        "operatingModel": "closed",
        "name": "كاليكس",
        "nameEn": "Kaalix",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_allo_smile",
        "operatingModel": "closed",
        "name": "الو سمايل",
        "nameEn": "Allo Smail",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_natsakharlik",
        "operatingModel": "closed",
        "name": "ناتساخارليك",
        "nameEn": "Natsakharlik",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_jibli_m3ak",
        "operatingModel": "closed",
        "name": "جيبلي معاك",
        "nameEn": "Jibli-m3ak",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 90,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.3,
      "weekendBehavior": "الجمعة أقل. السبت أعلى.",
      "popularCategories": [
        "الطاجين",
        "الكسكسي",
        "الشاورما",
        "السفة",
        "المأكولات المغربية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 75% | البطاقة 20% | محافظ رقمية 5%",
      "specialNotes": "المغرب حدّت غلوفو عند 30% بقرار حكومي (2024-2025). غلوفو (58% استخدام) وجوميا (41%). كول قدم الشكوى ضد غلوفو. متوسط الطلب ~90 د.م."
    }
  },
  "LY": {
    "code": "LY",
    "name": "ليبيا",
    "nameEn": "Libya",
    "flag": "🇱🇾",
    "currency": "LYD",
    "currencySymbol": "د.ل",
    "currencySymbolEn": "LYD",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_jumia",
        "operatingModel": "closed",
        "name": "جوميا فود",
        "nameEn": "Jumia Food",
        "fee": 14,
        "confidence": "verified"
      },
      {
        "id": "plat_foodchow",
        "operatingModel": "closed",
        "name": "فودتشاو",
        "nameEn": "FoodChow",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_glovo",
        "operatingModel": "closed",
        "name": "غلوفو",
        "nameEn": "Glovo",
        "fee": 25,
        "confidence": "verified"
      },
      {
        "id": "plat_bolt",
        "operatingModel": "closed",
        "name": "بولت فود",
        "nameEn": "Bolt Food",
        "fee": 18,
        "confidence": "verified"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 35,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسكسي",
        "الشاورما",
        "البرجر",
        "المشويات"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | البطاقة 10%",
      "specialNotes": "السوق الليبي متقطع. جوميا تقلصت. غالبية الطلبات مباشرة أو عبر واتساب وفيسبوك. لا يوجد تطبيق سائد. متوسط الطلب ~35 د.ل."
    }
  },
  "SD": {
    "code": "SD",
    "name": "السودان",
    "nameEn": "Sudan",
    "flag": "🇸🇩",
    "currency": "SDG",
    "currencySymbol": "ج.س",
    "currencySymbolEn": "SDG",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_nine",
        "operatingModel": "closed",
        "name": "ناين",
        "nameEn": "Nine",
        "fee": 15,
        "confidence": "estimated"
      },
      {
        "id": "plat_halan",
        "operatingModel": "closed",
        "name": "حالاً",
        "nameEn": "Halan",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_foodchow",
        "operatingModel": "closed",
        "name": "فودتشاو",
        "nameEn": "FoodChow",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 5000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسرة",
        "العصيدة",
        "الشاورما",
        "الفول",
        "المأكولات السودانية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 85% | محافظ رقمية 10% (زين كاش/موكاش) | البطاقة 5%",
      "specialNotes": "ناين محلي سوداني (2,500+ مطعم في الخرطوم). حالاً مصري-سوداني (10M+ رحلة). الدفع بزين كاش وموكاش. لا توجد تطبيقات دولية. متوسط الطلب ~5,000 ج.س."
    }
  },
  "YE": {
    "code": "YE",
    "name": "اليمن",
    "nameEn": "Yemen",
    "flag": "🇾🇪",
    "currency": "YER",
    "currencySymbol": "ر.ي",
    "currencySymbolEn": "YER",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_wagbat",
        "operatingModel": "closed",
        "name": "واجبات",
        "nameEn": "Wagbat",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_tamween",
        "operatingModel": "closed",
        "name": "تموين",
        "nameEn": "Tamween",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_ana_mehani",
        "operatingModel": "closed",
        "name": "أنا مهني",
        "nameEn": "Ana Mehani",
        "fee": 20,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 3500,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسدة",
        "السلتة",
        "الشاورما",
        "الفول",
        "المأكولات اليمنية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 95% | البطاقة 5%",
      "specialNotes": "واجبات أبرز التطبيقات في صنعاء (~120 مطعم، 26 دراجة). العمولات غير معلنة — التقديرات تقريبية. لا توجد تطبيقات دولية. متوسط الطلب ~3,500 ر.ي."
    }
  },
  "DJ": {
    "code": "DJ",
    "name": "جيبوتي",
    "nameEn": "Djibouti",
    "flag": "🇩🇯",
    "currency": "DJF",
    "currencySymbol": "ف.ج",
    "currencySymbolEn": "DJF",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_kiki",
        "operatingModel": "closed",
        "name": "كيكي دروب",
        "nameEn": "KiKi Drop",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_foodchow",
        "operatingModel": "closed",
        "name": "فودتشاو",
        "nameEn": "FoodChow",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 3000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "المشويات",
        "الشاورما",
        "المأكولات الفرنسية",
        "المأكولات الإثيوبية"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | البطاقة 10%",
      "specialNotes": "كيكي دروب سوبر-أب جيبوتي محلي. السوق صغير جداً. لا توجد تطبيقات دولية. متوسط الطلب ~3,000 ف.ج."
    }
  },
  "SO": {
    "code": "SO",
    "name": "الصومال",
    "nameEn": "Somalia",
    "flag": "🇸🇴",
    "currency": "SOS",
    "currencySymbol": "ش.ص",
    "currencySymbolEn": "SOS",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_rikaab",
        "operatingModel": "closed",
        "name": "ريكاب",
        "nameEn": "Rikaab",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_gulivery",
        "operatingModel": "closed",
        "name": "جوليفري",
        "nameEn": "Gulivery",
        "fee": 5,
        "confidence": "estimated"
      },
      {
        "id": "plat_foodchow",
        "operatingModel": "closed",
        "name": "فودتشاو",
        "nameEn": "FoodChow",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 80000,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الأرز باللحم",
        "الشاورما",
        "المعكرونة",
        "المأكولات الصومالية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | محافظ رقمية 8% | البطاقة 2%",
      "specialNotes": "ريكاب سوبر-أب صومالي (100,000+ عميل، 5,000+ سائق). جوليفري يأخذ رسوم توصيل (1–5$) لا عمولة. السوق متنامي. متوسط الطلب ~80,000 ش.ص."
    }
  },
  "MR": {
    "code": "MR",
    "name": "موريتانيا",
    "nameEn": "Mauritania",
    "flag": "🇲🇷",
    "currency": "MRU",
    "currencySymbol": "أ.م",
    "currencySymbolEn": "MRU",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_jemli",
        "operatingModel": "closed",
        "name": "جملي",
        "nameEn": "Jemli",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_wejabat",
        "operatingModel": "closed",
        "name": "وجبات",
        "nameEn": "Wejabat",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_general_livraison",
        "operatingModel": "closed",
        "name": "جنرال ليفريزون",
        "nameEn": "General Livraison",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_addanam",
        "operatingModel": "closed",
        "name": "عدانم",
        "nameEn": "Addanam",
        "fee": 18,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 250,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسكسي الموريتاني",
        "الشاورما",
        "السمك",
        "المأكولات الموريتانية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 90% | البطاقة 8% | محافظ رقمية 2%",
      "specialNotes": "جملي السائد في نواكشوط (2M+ مستخدم). وجبات منافس جديد. عدانم فائز بتحدي الابتكار الموريتاني. لا توجد تطبيقات دولية. متوسط الطلب ~250 أ.م."
    }
  },
  "KM": {
    "code": "KM",
    "name": "جزر القمر",
    "nameEn": "Comoros",
    "flag": "🇰🇲",
    "currency": "KMF",
    "currencySymbol": "ف.ق",
    "currencySymbolEn": "KMF",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_sahilkom",
        "operatingModel": "closed",
        "name": "ساهيلكوم",
        "nameEn": "Sahilkom",
        "fee": 15,
        "confidence": "estimated"
      },
      {
        "id": "plat_foodcom",
        "operatingModel": "closed",
        "name": "فودكوم كي أم",
        "nameEn": "Foodcom KM",
        "fee": 15,
        "confidence": "estimated"
      },
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 3500,
      "peakHours": "12:30–14:00 و 19:30–22:00",
      "ramadanMultiplier": 1.2,
      "weekendBehavior": "الجمعة أقل.",
      "popularCategories": [
        "الكسكسي",
        "السمك",
        "المأكولات القمرية التقليدية"
      ],
      "paymentMethod": "كاش عند الاستلام 95% | البطاقة 5%",
      "specialNotes": "سوق التوصيل ناشئ جداً. ساهيلكوم وفودكوم كي أم محليان. لا توجد تطبيقات دولية. متوسط الطلب ~3,500 ف.ق."
    }
  },
  "US": {
    "code": "US",
    "name": "الولايات المتحدة",
    "nameEn": "United States",
    "flag": "🇺🇸",
    "currency": "USD",
    "currencySymbol": "$",
    "currencySymbolEn": "USD",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 35,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 70% | Cash 20% | Digital wallets 10%"
    }
  },
  "CA": {
    "code": "CA",
    "name": "كندا",
    "nameEn": "Canada",
    "flag": "🇨🇦",
    "currency": "CAD",
    "currencySymbol": "C$",
    "currencySymbolEn": "CAD",
    "vatRate": 5,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 45,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 80% | Cash 15% | Digital wallets 5%"
    }
  },
  "GB": {
    "code": "GB",
    "name": "المملكة المتحدة",
    "nameEn": "United Kingdom",
    "flag": "🇬🇧",
    "currency": "GBP",
    "currencySymbol": "£",
    "currencySymbolEn": "GBP",
    "vatRate": 20,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 28,
      "peakHours": "12:00–14:00 و 18:30–21:30",
      "paymentMethod": "Card 75% | Cash 15% | Digital wallets 10%"
    }
  },
  "DE": {
    "code": "DE",
    "name": "ألمانيا",
    "nameEn": "Germany",
    "flag": "🇩🇪",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 19,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:30–21:00",
      "paymentMethod": "Card 80% | Cash 10% | Digital wallets 10%"
    }
  },
  "FR": {
    "code": "FR",
    "name": "فرنسا",
    "nameEn": "France",
    "flag": "🇫🇷",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 20,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 32,
      "peakHours": "12:00–14:00 و 19:30–22:00",
      "paymentMethod": "Card 75% | Cash 15% | Digital wallets 10%"
    }
  },
  "IT": {
    "code": "IT",
    "name": "إيطاليا",
    "nameEn": "Italy",
    "flag": "🇮🇹",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 22,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 28,
      "peakHours": "12:30–14:30 و 19:30–22:30",
      "paymentMethod": "Card 70% | Cash 25% | Digital wallets 5%"
    }
  },
  "ES": {
    "code": "ES",
    "name": "إسبانيا",
    "nameEn": "Spain",
    "flag": "🇪🇸",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 21,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 26,
      "peakHours": "13:00–15:30 و 20:30–23:00",
      "paymentMethod": "Card 75% | Cash 20% | Digital wallets 5%"
    }
  },
  "NL": {
    "code": "NL",
    "name": "هولندا",
    "nameEn": "Netherlands",
    "flag": "🇳🇱",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 21,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 29,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 85% | Cash 10% | Digital wallets 5%"
    }
  },
  "BE": {
    "code": "BE",
    "name": "بلجيكا",
    "nameEn": "Belgium",
    "flag": "🇧🇪",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 21,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:30–21:30",
      "paymentMethod": "Card 80% | Cash 15% | Digital wallets 5%"
    }
  },
  "CH": {
    "code": "CH",
    "name": "سويسرا",
    "nameEn": "Switzerland",
    "flag": "🇨🇭",
    "currency": "CHF",
    "currencySymbol": "CHF",
    "currencySymbolEn": "CHF",
    "vatRate": 8.1,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 40,
      "peakHours": "12:00–14:00 و 18:30–21:30",
      "paymentMethod": "Card 75% | Cash 20% | Digital wallets 5%"
    }
  },
  "AT": {
    "code": "AT",
    "name": "النمسا",
    "nameEn": "Austria",
    "flag": "🇦🇹",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 20,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 28,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 80% | Cash 15% | Digital wallets 5%"
    }
  },
  "TR": {
    "code": "TR",
    "name": "تركيا",
    "nameEn": "Turkey",
    "flag": "🇹🇷",
    "currency": "TRY",
    "currencySymbol": "₺",
    "currencySymbolEn": "TRY",
    "vatRate": 20,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 450,
      "peakHours": "12:00–14:00 و 19:00–22:00",
      "paymentMethod": "Card 60% | Cash 35% | Digital wallets 5%"
    }
  },
  "IN": {
    "code": "IN",
    "name": "الهند",
    "nameEn": "India",
    "flag": "🇮🇳",
    "currency": "INR",
    "currencySymbol": "₹",
    "currencySymbolEn": "INR",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 600,
      "peakHours": "12:30–14:30 و 19:00–22:00",
      "paymentMethod": "Digital wallets 50% | Card 30% | Cash 20%"
    }
  },
  "PK": {
    "code": "PK",
    "name": "باكستان",
    "nameEn": "Pakistan",
    "flag": "🇵🇰",
    "currency": "PKR",
    "currencySymbol": "PKR",
    "currencySymbolEn": "PKR",
    "vatRate": 17,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 2500,
      "peakHours": "12:30–14:30 و 19:30–22:30",
      "paymentMethod": "Cash 70% | Card 25% | Digital wallets 5%"
    }
  },
  "BD": {
    "code": "BD",
    "name": "بنغلاديش",
    "nameEn": "Bangladesh",
    "flag": "🇧🇩",
    "currency": "BDT",
    "currencySymbol": "৳",
    "currencySymbolEn": "BDT",
    "vatRate": 15,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 1200,
      "peakHours": "12:30–14:30 و 19:00–22:00",
      "paymentMethod": "Cash 75% | Card 20% | Digital wallets 5%"
    }
  },
  "ID": {
    "code": "ID",
    "name": "إندونيسيا",
    "nameEn": "Indonesia",
    "flag": "🇮🇩",
    "currency": "IDR",
    "currencySymbol": "IDR",
    "currencySymbolEn": "IDR",
    "vatRate": 11,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 90000,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Digital wallets 60% | Cash 30% | Card 10%"
    }
  },
  "MY": {
    "code": "MY",
    "name": "ماليزيا",
    "nameEn": "Malaysia",
    "flag": "🇲🇾",
    "currency": "MYR",
    "currencySymbol": "MYR",
    "currencySymbolEn": "MYR",
    "vatRate": 10,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 35,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Digital wallets 55% | Card 30% | Cash 15%"
    }
  },
  "PH": {
    "code": "PH",
    "name": "الفلبين",
    "nameEn": "Philippines",
    "flag": "🇵🇭",
    "currency": "PHP",
    "currencySymbol": "₱",
    "currencySymbolEn": "PHP",
    "vatRate": 12,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 600,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Digital wallets 50% | Cash 35% | Card 15%"
    }
  },
  "SG": {
    "code": "SG",
    "name": "سنغافورة",
    "nameEn": "Singapore",
    "flag": "🇸🇬",
    "currency": "SGD",
    "currencySymbol": "S$",
    "currencySymbolEn": "SGD",
    "vatRate": 9,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Digital wallets 60% | Card 35% | Cash 5%"
    }
  },
  "CN": {
    "code": "CN",
    "name": "الصين",
    "nameEn": "China",
    "flag": "🇨🇳",
    "currency": "CNY",
    "currencySymbol": "¥",
    "currencySymbolEn": "CNY",
    "vatRate": 13,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 70,
      "peakHours": "11:30–13:30 و 17:30–20:30",
      "paymentMethod": "Digital wallets 85% | Card 10% | Cash 5%"
    }
  },
  "JP": {
    "code": "JP",
    "name": "اليابان",
    "nameEn": "Japan",
    "flag": "🇯🇵",
    "currency": "JPY",
    "currencySymbol": "¥",
    "currencySymbolEn": "JPY",
    "vatRate": 10,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 2500,
      "peakHours": "11:30–13:30 و 17:30–20:30",
      "paymentMethod": "Digital wallets 50% | Card 35% | Cash 15%"
    }
  },
  "KR": {
    "code": "KR",
    "name": "كوريا الجنوبية",
    "nameEn": "South Korea",
    "flag": "🇰🇷",
    "currency": "KRW",
    "currencySymbol": "₩",
    "currencySymbolEn": "KRW",
    "vatRate": 10,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 25000,
      "peakHours": "11:30–13:30 و 17:30–20:30",
      "paymentMethod": "Digital wallets 70% | Card 25% | Cash 5%"
    }
  },
  "AU": {
    "code": "AU",
    "name": "أستراليا",
    "nameEn": "Australia",
    "flag": "🇦🇺",
    "currency": "AUD",
    "currencySymbol": "A$",
    "currencySymbolEn": "AUD",
    "vatRate": 10,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 45,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 70% | Digital wallets 20% | Cash 10%"
    }
  },
  "NZ": {
    "code": "NZ",
    "name": "نيوزيلندا",
    "nameEn": "New Zealand",
    "flag": "🇳🇿",
    "currency": "NZD",
    "currencySymbol": "NZ$",
    "currencySymbolEn": "NZD",
    "vatRate": 15,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 45,
      "peakHours": "11:30–13:30 و 18:00–21:00",
      "paymentMethod": "Card 75% | Digital wallets 15% | Cash 10%"
    }
  },
  "ZA": {
    "code": "ZA",
    "name": "جنوب أفريقيا",
    "nameEn": "South Africa",
    "flag": "🇿🇦",
    "currency": "ZAR",
    "currencySymbol": "ZAR",
    "currencySymbolEn": "ZAR",
    "vatRate": 15,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 250,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Digital wallets 40% | Card 35% | Cash 25%"
    }
  },
  "NG": {
    "code": "NG",
    "name": "نيجيريا",
    "nameEn": "Nigeria",
    "flag": "🇳🇬",
    "currency": "NGN",
    "currencySymbol": "₦",
    "currencySymbolEn": "NGN",
    "vatRate": 7.5,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 8000,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Digital wallets 45% | Cash 40% | Card 15%"
    }
  },
  "KE": {
    "code": "KE",
    "name": "كينيا",
    "nameEn": "Kenya",
    "flag": "🇰🇪",
    "currency": "KES",
    "currencySymbol": "KSh",
    "currencySymbolEn": "KES",
    "vatRate": 16,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 1500,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Digital wallets 50% | Cash 40% | Card 10%"
    }
  },
  "BR": {
    "code": "BR",
    "name": "البرازيل",
    "nameEn": "Brazil",
    "flag": "🇧🇷",
    "currency": "BRL",
    "currencySymbol": "R$",
    "currencySymbolEn": "BRL",
    "vatRate": 17,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 80,
      "peakHours": "11:30–13:30 و 18:30–21:30",
      "paymentMethod": "Digital wallets 50% | Card 30% | Cash 20%"
    }
  },
  "MX": {
    "code": "MX",
    "name": "المكسيك",
    "nameEn": "Mexico",
    "flag": "🇲🇽",
    "currency": "MXN",
    "currencySymbol": "MX$",
    "currencySymbolEn": "MXN",
    "vatRate": 16,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 350,
      "peakHours": "13:00–15:30 و 19:30–22:30",
      "paymentMethod": "Digital wallets 40% | Card 35% | Cash 25%"
    }
  },
  "AR": {
    "code": "AR",
    "name": "الأرجنتين",
    "nameEn": "Argentina",
    "flag": "🇦🇷",
    "currency": "ARS",
    "currencySymbol": "$",
    "currencySymbolEn": "ARS",
    "vatRate": 21,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 8000,
      "peakHours": "12:00–14:30 و 20:00–23:00",
      "paymentMethod": "Digital wallets 40% | Cash 40% | Card 20%"
    }
  },
  "RU": {
    "code": "RU",
    "name": "روسيا",
    "nameEn": "Russia",
    "flag": "🇷🇺",
    "currency": "RUB",
    "currencySymbol": "₽",
    "currencySymbolEn": "RUB",
    "vatRate": 20,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 1500,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 50% | Cash 35% | Digital wallets 15%"
    }
  },
  "TD": {
    "code": "TD",
    "name": "تشاد",
    "nameEn": "Chad",
    "flag": "🇹🇩",
    "currency": "XAF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XAF",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "ER": {
    "code": "ER",
    "name": "إريتريا",
    "nameEn": "Eritrea",
    "flag": "🇪🇷",
    "currency": "ERN",
    "currencySymbol": "Nfk",
    "currencySymbolEn": "ERN",
    "vatRate": 5,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "SS": {
    "code": "SS",
    "name": "جنوب السودان",
    "nameEn": "South Sudan",
    "flag": "🇸🇸",
    "currency": "SSP",
    "currencySymbol": "£",
    "currencySymbolEn": "SSP",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "NE": {
    "code": "NE",
    "name": "النيجر",
    "nameEn": "Niger",
    "flag": "🇳🇪",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 19,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "ML": {
    "code": "ML",
    "name": "مالي",
    "nameEn": "Mali",
    "flag": "🇲🇱",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "SN": {
    "code": "SN",
    "name": "السنغال",
    "nameEn": "Senegal",
    "flag": "🇸🇳",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "GM": {
    "code": "GM",
    "name": "غامبيا",
    "nameEn": "Gambia",
    "flag": "🇬🇲",
    "currency": "GMD",
    "currencySymbol": "D",
    "currencySymbolEn": "GMD",
    "vatRate": 15,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "BF": {
    "code": "BF",
    "name": "بوركينا فاسو",
    "nameEn": "Burkina Faso",
    "flag": "🇧🇫",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "SL": {
    "code": "SL",
    "name": "سيراليون",
    "nameEn": "Sierra Leone",
    "flag": "🇸🇱",
    "currency": "SLL",
    "currencySymbol": "Le",
    "currencySymbolEn": "SLL",
    "vatRate": 15,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "BJ": {
    "code": "BJ",
    "name": "بنين",
    "nameEn": "Benin",
    "flag": "🇧🇯",
    "currency": "XOF",
    "currencySymbol": "Fr",
    "currencySymbolEn": "XOF",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "SE": {
    "code": "SE",
    "name": "السويد",
    "nameEn": "Sweden",
    "flag": "🇸🇪",
    "currency": "SEK",
    "currencySymbol": "kr",
    "currencySymbolEn": "SEK",
    "vatRate": 25,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "NO": {
    "code": "NO",
    "name": "النرويج",
    "nameEn": "Norway",
    "flag": "🇳🇴",
    "currency": "NOK",
    "currencySymbol": "kr",
    "currencySymbolEn": "NOK",
    "vatRate": 25,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "DK": {
    "code": "DK",
    "name": "الدنمارك",
    "nameEn": "Denmark",
    "flag": "🇩🇰",
    "currency": "DKK",
    "currencySymbol": "kr",
    "currencySymbolEn": "DKK",
    "vatRate": 25,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "FI": {
    "code": "FI",
    "name": "فنلندا",
    "nameEn": "Finland",
    "flag": "🇫🇮",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 25.5,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "PL": {
    "code": "PL",
    "name": "بولندا",
    "nameEn": "Poland",
    "flag": "🇵🇱",
    "currency": "PLN",
    "currencySymbol": "zł",
    "currencySymbolEn": "PLN",
    "vatRate": 23,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "CZ": {
    "code": "CZ",
    "name": "التشيك",
    "nameEn": "Czechia",
    "flag": "🇨🇿",
    "currency": "CZK",
    "currencySymbol": "Kč",
    "currencySymbolEn": "CZK",
    "vatRate": 21,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "HU": {
    "code": "HU",
    "name": "المجر",
    "nameEn": "Hungary",
    "flag": "🇭🇺",
    "currency": "HUF",
    "currencySymbol": "Ft",
    "currencySymbolEn": "HUF",
    "vatRate": 27,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "RO": {
    "code": "RO",
    "name": "رومانيا",
    "nameEn": "Romania",
    "flag": "🇷🇴",
    "currency": "RON",
    "currencySymbol": "lei",
    "currencySymbolEn": "RON",
    "vatRate": 19,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "GR": {
    "code": "GR",
    "name": "اليونان",
    "nameEn": "Greece",
    "flag": "🇬🇷",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 24,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "PT": {
    "code": "PT",
    "name": "البرتغال",
    "nameEn": "Portugal",
    "flag": "🇵🇹",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 23,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "IE": {
    "code": "IE",
    "name": "أيرلندا",
    "nameEn": "Ireland",
    "flag": "🇮🇪",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 23,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "UA": {
    "code": "UA",
    "name": "أوكرانيا",
    "nameEn": "Ukraine",
    "flag": "🇺🇦",
    "currency": "UAH",
    "currencySymbol": "₴",
    "currencySymbolEn": "UAH",
    "vatRate": 20,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "KZ": {
    "code": "KZ",
    "name": "كازاخستان",
    "nameEn": "Kazakhstan",
    "flag": "🇰🇿",
    "currency": "KZT",
    "currencySymbol": "₸",
    "currencySymbolEn": "KZT",
    "vatRate": 12,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "UZ": {
    "code": "UZ",
    "name": "أوزباكستان",
    "nameEn": "Uzbekistan",
    "flag": "🇺🇿",
    "currency": "UZS",
    "currencySymbol": "so'm",
    "currencySymbolEn": "UZS",
    "vatRate": 12,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "TH": {
    "code": "TH",
    "name": "تايلند",
    "nameEn": "Thailand",
    "flag": "🇹🇭",
    "currency": "THB",
    "currencySymbol": "฿",
    "currencySymbolEn": "THB",
    "vatRate": 7,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "VN": {
    "code": "VN",
    "name": "فيتنام",
    "nameEn": "Vietnam",
    "flag": "🇻🇳",
    "currency": "VND",
    "currencySymbol": "₫",
    "currencySymbolEn": "VND",
    "vatRate": 10,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "IL": {
    "code": "IL",
    "name": "إسرائيل",
    "nameEn": "Israel",
    "flag": "🇮🇱",
    "currency": "ILS",
    "currencySymbol": "₪",
    "currencySymbolEn": "ILS",
    "vatRate": 17,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "HK": {
    "code": "HK",
    "name": "هونغ كونغ",
    "nameEn": "Hong Kong",
    "flag": "🇭🇰",
    "currency": "HKD",
    "currencySymbol": "$",
    "currencySymbolEn": "HKD",
    "vatRate": 0,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "TW": {
    "code": "TW",
    "name": "تايوان",
    "nameEn": "Taiwan",
    "flag": "🇹🇼",
    "currency": "TWD",
    "currencySymbol": "$",
    "currencySymbolEn": "TWD",
    "vatRate": 5,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "LK": {
    "code": "LK",
    "name": "سريلانكا",
    "nameEn": "Sri Lanka",
    "flag": "🇱🇰",
    "currency": "LKR",
    "currencySymbol": "Rs  රු",
    "currencySymbolEn": "LKR",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "CL": {
    "code": "CL",
    "name": "تشيلي",
    "nameEn": "Chile",
    "flag": "🇨🇱",
    "currency": "CLP",
    "currencySymbol": "$",
    "currencySymbolEn": "CLP",
    "vatRate": 19,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "CO": {
    "code": "CO",
    "name": "كولومبيا",
    "nameEn": "Colombia",
    "flag": "🇨🇴",
    "currency": "COP",
    "currencySymbol": "$",
    "currencySymbolEn": "COP",
    "vatRate": 19,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "PE": {
    "code": "PE",
    "name": "بيرو",
    "nameEn": "Peru",
    "flag": "🇵🇪",
    "currency": "PEN",
    "currencySymbol": "S/.",
    "currencySymbolEn": "PEN",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "VE": {
    "code": "VE",
    "name": "فنزويلا",
    "nameEn": "Venezuela",
    "flag": "🇻🇪",
    "currency": "VES",
    "currencySymbol": "Bs.S.",
    "currencySymbolEn": "VES",
    "vatRate": 16,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "EC": {
    "code": "EC",
    "name": "الإكوادور",
    "nameEn": "Ecuador",
    "flag": "🇪🇨",
    "currency": "USD",
    "currencySymbol": "$",
    "currencySymbolEn": "USD",
    "vatRate": 12,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "CR": {
    "code": "CR",
    "name": "كوستاريكا",
    "nameEn": "Costa Rica",
    "flag": "🇨🇷",
    "currency": "CRC",
    "currencySymbol": "₡",
    "currencySymbolEn": "CRC",
    "vatRate": 13,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "PA": {
    "code": "PA",
    "name": "بنما",
    "nameEn": "Panama",
    "flag": "🇵🇦",
    "currency": "PAB",
    "currencySymbol": "B/.",
    "currencySymbolEn": "PAB",
    "vatRate": 7,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "DO": {
    "code": "DO",
    "name": "جمهورية الدومينيكان",
    "nameEn": "Dominican Republic",
    "flag": "🇩🇴",
    "currency": "DOP",
    "currencySymbol": "$",
    "currencySymbolEn": "DOP",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "ET": {
    "code": "ET",
    "name": "إثيوبيا",
    "nameEn": "Ethiopia",
    "flag": "🇪🇹",
    "currency": "ETB",
    "currencySymbol": "Br",
    "currencySymbolEn": "ETB",
    "vatRate": 15,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "GH": {
    "code": "GH",
    "name": "غانا",
    "nameEn": "Ghana",
    "flag": "🇬🇭",
    "currency": "GHS",
    "currencySymbol": "₵",
    "currencySymbolEn": "GHS",
    "vatRate": 15,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "TZ": {
    "code": "TZ",
    "name": "تنزانيا",
    "nameEn": "Tanzania",
    "flag": "🇹🇿",
    "currency": "TZS",
    "currencySymbol": "Sh",
    "currencySymbolEn": "TZS",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "UG": {
    "code": "UG",
    "name": "أوغندا",
    "nameEn": "Uganda",
    "flag": "🇺🇬",
    "currency": "UGX",
    "currencySymbol": "Sh",
    "currencySymbolEn": "UGX",
    "vatRate": 18,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  },
  "ZM": {
    "code": "ZM",
    "name": "زامبيا",
    "nameEn": "Zambia",
    "flag": "🇿🇲",
    "currency": "ZMW",
    "currencySymbol": "ZK",
    "currencySymbolEn": "ZMW",
    "vatRate": 16,
    "platforms": [
      {
        "id": "plat_direct",
        "operatingModel": "direct",
        "name": "مباشر (بدون منصة)",
        "nameEn": "Direct",
        "fee": 0,
        "confidence": "verified"
      }
    ],
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    }
  }
};

  function getCountryMeta(code) {
    return COUNTRY_META[code] || null;
  }

  function getAllCountryMeta() {
    return COUNTRY_META;
  }

  function getPlatforms(code) {
    const data = PLATFORMS_DATA[code];
    return data ? (data.platforms || []) : [];
  }

  function getPlatform(code, platformId) {
    const platforms = getPlatforms(code);
    return platforms.find(function (p) { return p.id === platformId; }) || null;
  }

  function getPlatformByIndex(code, index) {
    const platforms = getPlatforms(code);
    return platforms[index] || null;
  }

  function getCurrencySymbol(code, lang) {
    const meta = COUNTRY_META[code];
    if (!meta) return lang === 'en' ? 'SAR' : 'ريال';
    return lang === 'en' ? (meta.currencySymbolEn || meta.currencySymbol || meta.currency) : (meta.currencySymbol || meta.currency);
  }

  function getVatRate(code) {
    const meta = COUNTRY_META[code];
    return meta ? (meta.vatRate || 0) : 0;
  }

  window.BondsPlatforms = {
    COUNTRY_META,
    PLATFORMS_DATA,
    getCountryMeta,
    getAllCountryMeta,
    getPlatforms,
    getPlatform,
    getPlatformByIndex,
    getCurrencySymbol,
    getVatRate
  };
})();
