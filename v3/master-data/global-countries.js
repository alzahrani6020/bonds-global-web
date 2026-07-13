/**
 * Bonds Global — Global Countries Supplement
 * Major non-Arab economies for use in country selectors across calculators.
 * Each country uses a single "General" governorate with major cities.
 */

const GLOBAL_COUNTRIES_GEO = {
  US: {
    code: 'US',
    name: 'الولايات المتحدة',
    nameEn: 'United States',
    flag: '🇺🇸',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'نيويورك', nameEn: 'New York', code: 'US-01-001' },
        { name: 'لوس أنجلوس', nameEn: 'Los Angeles', code: 'US-01-002' },
        { name: 'شيكاغو', nameEn: 'Chicago', code: 'US-01-003' },
        { name: 'هيوستن', nameEn: 'Houston', code: 'US-01-004' },
        { name: 'ميامي', nameEn: 'Miami', code: 'US-01-005' }
      ] }
    ]
  },
  CA: {
    code: 'CA',
    name: 'كندا',
    nameEn: 'Canada',
    flag: '🇨🇦',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'تورنتو', nameEn: 'Toronto', code: 'CA-01-001' },
        { name: 'فانكوفر', nameEn: 'Vancouver', code: 'CA-01-002' },
        { name: 'مونتريال', nameEn: 'Montreal', code: 'CA-01-003' },
        { name: 'كالغاري', nameEn: 'Calgary', code: 'CA-01-004' }
      ] }
    ]
  },
  GB: {
    code: 'GB',
    name: 'المملكة المتحدة',
    nameEn: 'United Kingdom',
    flag: '🇬🇧',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'لندن', nameEn: 'London', code: 'GB-01-001' },
        { name: 'مانشستر', nameEn: 'Manchester', code: 'GB-01-002' },
        { name: 'برمنغهام', nameEn: 'Birmingham', code: 'GB-01-003' },
        { name: 'إدنبرة', nameEn: 'Edinburgh', code: 'GB-01-004' }
      ] }
    ]
  },
  DE: {
    code: 'DE',
    name: 'ألمانيا',
    nameEn: 'Germany',
    flag: '🇩🇪',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'برلين', nameEn: 'Berlin', code: 'DE-01-001' },
        { name: 'ميونخ', nameEn: 'Munich', code: 'DE-01-002' },
        { name: 'فرانكفورت', nameEn: 'Frankfurt', code: 'DE-01-003' },
        { name: 'هامبورغ', nameEn: 'Hamburg', code: 'DE-01-004' }
      ] }
    ]
  },
  FR: {
    code: 'FR',
    name: 'فرنسا',
    nameEn: 'France',
    flag: '🇫🇷',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'باريس', nameEn: 'Paris', code: 'FR-01-001' },
        { name: 'مارسيليا', nameEn: 'Marseille', code: 'FR-01-002' },
        { name: 'ليون', nameEn: 'Lyon', code: 'FR-01-003' },
        { name: 'نيس', nameEn: 'Nice', code: 'FR-01-004' }
      ] }
    ]
  },
  IT: {
    code: 'IT',
    name: 'إيطاليا',
    nameEn: 'Italy',
    flag: '🇮🇹',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'روما', nameEn: 'Rome', code: 'IT-01-001' },
        { name: 'ميلانو', nameEn: 'Milan', code: 'IT-01-002' },
        { name: 'نابولي', nameEn: 'Naples', code: 'IT-01-003' },
        { name: 'تورينو', nameEn: 'Turin', code: 'IT-01-004' }
      ] }
    ]
  },
  ES: {
    code: 'ES',
    name: 'إسبانيا',
    nameEn: 'Spain',
    flag: '🇪🇸',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'مدريد', nameEn: 'Madrid', code: 'ES-01-001' },
        { name: 'برشلونة', nameEn: 'Barcelona', code: 'ES-01-002' },
        { name: 'فالنسيا', nameEn: 'Valencia', code: 'ES-01-003' },
        { name: 'إشبيلية', nameEn: 'Seville', code: 'ES-01-004' }
      ] }
    ]
  },
  NL: {
    code: 'NL',
    name: 'هولندا',
    nameEn: 'Netherlands',
    flag: '🇳🇱',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'أمستردام', nameEn: 'Amsterdam', code: 'NL-01-001' },
        { name: 'روتردام', nameEn: 'Rotterdam', code: 'NL-01-002' },
        { name: 'لاهاي', nameEn: 'The Hague', code: 'NL-01-003' }
      ] }
    ]
  },
  BE: {
    code: 'BE',
    name: 'بلجيكا',
    nameEn: 'Belgium',
    flag: '🇧🇪',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'بروكسل', nameEn: 'Brussels', code: 'BE-01-001' },
        { name: 'أنتويرب', nameEn: 'Antwerp', code: 'BE-01-002' },
        { name: 'جنت', nameEn: 'Ghent', code: 'BE-01-003' }
      ] }
    ]
  },
  CH: {
    code: 'CH',
    name: 'سويسرا',
    nameEn: 'Switzerland',
    flag: '🇨🇭',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'زيورخ', nameEn: 'Zurich', code: 'CH-01-001' },
        { name: 'جنيف', nameEn: 'Geneva', code: 'CH-01-002' },
        { name: 'بازل', nameEn: 'Basel', code: 'CH-01-003' }
      ] }
    ]
  },
  AT: {
    code: 'AT',
    name: 'النمسا',
    nameEn: 'Austria',
    flag: '🇦🇹',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'فيينا', nameEn: 'Vienna', code: 'AT-01-001' },
        { name: 'زالتسبورغ', nameEn: 'Salzburg', code: 'AT-01-002' },
        { name: 'غراتس', nameEn: 'Graz', code: 'AT-01-003' }
      ] }
    ]
  },
  TR: {
    code: 'TR',
    name: 'تركيا',
    nameEn: 'Turkey',
    flag: '🇹🇷',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'إسطنبول', nameEn: 'Istanbul', code: 'TR-01-001' },
        { name: 'أنقرة', nameEn: 'Ankara', code: 'TR-01-002' },
        { name: 'إزمير', nameEn: 'Izmir', code: 'TR-01-003' },
        { name: 'أنطاليا', nameEn: 'Antalya', code: 'TR-01-004' }
      ] }
    ]
  },
  IN: {
    code: 'IN',
    name: 'الهند',
    nameEn: 'India',
    flag: '🇮🇳',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'مومباي', nameEn: 'Mumbai', code: 'IN-01-001' },
        { name: 'دلهي', nameEn: 'Delhi', code: 'IN-01-002' },
        { name: 'بنغالور', nameEn: 'Bangalore', code: 'IN-01-003' },
        { name: 'حيدر أباد', nameEn: 'Hyderabad', code: 'IN-01-004' }
      ] }
    ]
  },
  PK: {
    code: 'PK',
    name: 'باكستان',
    nameEn: 'Pakistan',
    flag: '🇵🇰',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'كراتشي', nameEn: 'Karachi', code: 'PK-01-001' },
        { name: 'لاهور', nameEn: 'Lahore', code: 'PK-01-002' },
        { name: 'إسلام أباد', nameEn: 'Islamabad', code: 'PK-01-003' },
        { name: 'فيصل أباد', nameEn: 'Faisalabad', code: 'PK-01-004' }
      ] }
    ]
  },
  BD: {
    code: 'BD',
    name: 'بنغلاديش',
    nameEn: 'Bangladesh',
    flag: '🇧🇩',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'داكا', nameEn: 'Dhaka', code: 'BD-01-001' },
        { name: 'تشيتاغونغ', nameEn: 'Chittagong', code: 'BD-01-002' },
        { name: 'خولنا', nameEn: 'Khulna', code: 'BD-01-003' }
      ] }
    ]
  },
  ID: {
    code: 'ID',
    name: 'إندونيسيا',
    nameEn: 'Indonesia',
    flag: '🇮🇩',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'جاكرتا', nameEn: 'Jakarta', code: 'ID-01-001' },
        { name: 'سورابايا', nameEn: 'Surabaya', code: 'ID-01-002' },
        { name: 'باندونغ', nameEn: 'Bandung', code: 'ID-01-003' }
      ] }
    ]
  },
  MY: {
    code: 'MY',
    name: 'ماليزيا',
    nameEn: 'Malaysia',
    flag: '🇲🇾',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'كوالالمبور', nameEn: 'Kuala Lumpur', code: 'MY-01-001' },
        { name: 'جورج تاون', nameEn: 'George Town', code: 'MY-01-002' },
        { name: 'جوهور باهرو', nameEn: 'Johor Bahru', code: 'MY-01-003' }
      ] }
    ]
  },
  PH: {
    code: 'PH',
    name: 'الفلبين',
    nameEn: 'Philippines',
    flag: '🇵🇭',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'مانيلا', nameEn: 'Manila', code: 'PH-01-001' },
        { name: 'سيبو', nameEn: 'Cebu', code: 'PH-01-002' },
        { name: 'دافاو', nameEn: 'Davao', code: 'PH-01-003' }
      ] }
    ]
  },
  SG: {
    code: 'SG',
    name: 'سنغافورة',
    nameEn: 'Singapore',
    flag: '🇸🇬',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'سنغافورة', nameEn: 'Singapore', code: 'SG-01-001' }
      ] }
    ]
  },
  CN: {
    code: 'CN',
    name: 'الصين',
    nameEn: 'China',
    flag: '🇨🇳',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'بكين', nameEn: 'Beijing', code: 'CN-01-001' },
        { name: 'شنغهاي', nameEn: 'Shanghai', code: 'CN-01-002' },
        { name: 'شنزن', nameEn: 'Shenzhen', code: 'CN-01-003' },
        { name: 'قوانغتشو', nameEn: 'Guangzhou', code: 'CN-01-004' }
      ] }
    ]
  },
  JP: {
    code: 'JP',
    name: 'اليابان',
    nameEn: 'Japan',
    flag: '🇯🇵',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'طوكيو', nameEn: 'Tokyo', code: 'JP-01-001' },
        { name: 'أوساكا', nameEn: 'Osaka', code: 'JP-01-002' },
        { name: 'يوكوهاما', nameEn: 'Yokohama', code: 'JP-01-003' }
      ] }
    ]
  },
  KR: {
    code: 'KR',
    name: 'كوريا الجنوبية',
    nameEn: 'South Korea',
    flag: '🇰🇷',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'سيول', nameEn: 'Seoul', code: 'KR-01-001' },
        { name: 'بوسان', nameEn: 'Busan', code: 'KR-01-002' },
        { name: 'إنتشون', nameEn: 'Incheon', code: 'KR-01-003' }
      ] }
    ]
  },
  AU: {
    code: 'AU',
    name: 'أستراليا',
    nameEn: 'Australia',
    flag: '🇦🇺',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'سيدني', nameEn: 'Sydney', code: 'AU-01-001' },
        { name: 'ملبورن', nameEn: 'Melbourne', code: 'AU-01-002' },
        { name: 'بريزبان', nameEn: 'Brisbane', code: 'AU-01-003' }
      ] }
    ]
  },
  NZ: {
    code: 'NZ',
    name: 'نيوزيلندا',
    nameEn: 'New Zealand',
    flag: '🇳🇿',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'أوكلاند', nameEn: 'Auckland', code: 'NZ-01-001' },
        { name: 'ويلينغتون', nameEn: 'Wellington', code: 'NZ-01-002' },
        { name: 'كرايستشيرش', nameEn: 'Christchurch', code: 'NZ-01-003' }
      ] }
    ]
  },
  ZA: {
    code: 'ZA',
    name: 'جنوب أفريقيا',
    nameEn: 'South Africa',
    flag: '🇿🇦',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'جوهانسبرغ', nameEn: 'Johannesburg', code: 'ZA-01-001' },
        { name: 'كيب تاون', nameEn: 'Cape Town', code: 'ZA-01-002' },
        { name: 'ديربان', nameEn: 'Durban', code: 'ZA-01-003' }
      ] }
    ]
  },
  NG: {
    code: 'NG',
    name: 'نيجيريا',
    nameEn: 'Nigeria',
    flag: '🇳🇬',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'لاغوس', nameEn: 'Lagos', code: 'NG-01-001' },
        { name: 'أبوجا', nameEn: 'Abuja', code: 'NG-01-002' },
        { name: 'كانو', nameEn: 'Kano', code: 'NG-01-003' }
      ] }
    ]
  },
  KE: {
    code: 'KE',
    name: 'كينيا',
    nameEn: 'Kenya',
    flag: '🇰🇪',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'نيروبي', nameEn: 'Nairobi', code: 'KE-01-001' },
        { name: 'مومباسا', nameEn: 'Mombasa', code: 'KE-01-002' },
        { name: 'كيسومو', nameEn: 'Kisumu', code: 'KE-01-003' }
      ] }
    ]
  },
  BR: {
    code: 'BR',
    name: 'البرازيل',
    nameEn: 'Brazil',
    flag: '🇧🇷',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'ساو باولو', nameEn: 'São Paulo', code: 'BR-01-001' },
        { name: 'ريو دي جانيرو', nameEn: 'Rio de Janeiro', code: 'BR-01-002' },
        { name: 'برازيليا', nameEn: 'Brasília', code: 'BR-01-003' }
      ] }
    ]
  },
  MX: {
    code: 'MX',
    name: 'المكسيك',
    nameEn: 'Mexico',
    flag: '🇲🇽',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'مدينة مكسيكو', nameEn: 'Mexico City', code: 'MX-01-001' },
        { name: 'غوادالاخارا', nameEn: 'Guadalajara', code: 'MX-01-002' },
        { name: 'مونتيري', nameEn: 'Monterrey', code: 'MX-01-003' }
      ] }
    ]
  },
  AR: {
    code: 'AR',
    name: 'الأرجنتين',
    nameEn: 'Argentina',
    flag: '🇦🇷',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'بوينس آيرس', nameEn: 'Buenos Aires', code: 'AR-01-001' },
        { name: 'قرطبة', nameEn: 'Córdoba', code: 'AR-01-002' },
        { name: 'روساريو', nameEn: 'Rosario', code: 'AR-01-003' }
      ] }
    ]
  },
  RU: {
    code: 'RU',
    name: 'روسيا',
    nameEn: 'Russia',
    flag: '🇷🇺',
    governorates: [
      { name: 'عام', nameEn: 'General', cities: [
        { name: 'موسكو', nameEn: 'Moscow', code: 'RU-01-001' },
        { name: 'سانت بطرسبرغ', nameEn: 'Saint Petersburg', code: 'RU-01-002' },
        { name: 'نوفوسيبيرسك', nameEn: 'Novosibirsk', code: 'RU-01-003' }
      ] }
    ]
  },
/* AUTO-INSERTED: GLOBAL-ADDITIONAL-33 */
  SE: {
    "name": "السويد",
    "nameEn": "Sweden",
    "flag": "🇸🇪",
    "currency": "SEK",
    "currencySymbol": "kr",
    "currencySymbolEn": "SEK",
    "vatRate": 25,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Stockholm",
            "nameEn": "Stockholm",
            "code": "SE-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق السويد.",
    "noteEn": "General Sweden market data."
  },
  NO: {
    "name": "النرويج",
    "nameEn": "Norway",
    "flag": "🇳🇴",
    "currency": "NOK",
    "currencySymbol": "kr",
    "currencySymbolEn": "NOK",
    "vatRate": 25,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Oslo",
            "nameEn": "Oslo",
            "code": "NO-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق النرويج.",
    "noteEn": "General Norway market data."
  },
  DK: {
    "name": "الدنمارك",
    "nameEn": "Denmark",
    "flag": "🇩🇰",
    "currency": "DKK",
    "currencySymbol": "kr",
    "currencySymbolEn": "DKK",
    "vatRate": 25,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Copenhagen",
            "nameEn": "Copenhagen",
            "code": "DK-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق الدنمارك.",
    "noteEn": "General Denmark market data."
  },
  FI: {
    "name": "فنلندا",
    "nameEn": "Finland",
    "flag": "🇫🇮",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 25.5,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Helsinki",
            "nameEn": "Helsinki",
            "code": "FI-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق فنلندا.",
    "noteEn": "General Finland market data."
  },
  PL: {
    "name": "بولندا",
    "nameEn": "Poland",
    "flag": "🇵🇱",
    "currency": "PLN",
    "currencySymbol": "zł",
    "currencySymbolEn": "PLN",
    "vatRate": 23,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Warsaw",
            "nameEn": "Warsaw",
            "code": "PL-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق بولندا.",
    "noteEn": "General Poland market data."
  },
  CZ: {
    "name": "التشيك",
    "nameEn": "Czechia",
    "flag": "🇨🇿",
    "currency": "CZK",
    "currencySymbol": "Kč",
    "currencySymbolEn": "CZK",
    "vatRate": 21,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Prague",
            "nameEn": "Prague",
            "code": "CZ-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق التشيك.",
    "noteEn": "General Czechia market data."
  },
  HU: {
    "name": "المجر",
    "nameEn": "Hungary",
    "flag": "🇭🇺",
    "currency": "HUF",
    "currencySymbol": "Ft",
    "currencySymbolEn": "HUF",
    "vatRate": 27,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Budapest",
            "nameEn": "Budapest",
            "code": "HU-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق المجر.",
    "noteEn": "General Hungary market data."
  },
  RO: {
    "name": "رومانيا",
    "nameEn": "Romania",
    "flag": "🇷🇴",
    "currency": "RON",
    "currencySymbol": "lei",
    "currencySymbolEn": "RON",
    "vatRate": 19,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Bucharest",
            "nameEn": "Bucharest",
            "code": "RO-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق رومانيا.",
    "noteEn": "General Romania market data."
  },
  GR: {
    "name": "اليونان",
    "nameEn": "Greece",
    "flag": "🇬🇷",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 24,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Athens",
            "nameEn": "Athens",
            "code": "GR-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق اليونان.",
    "noteEn": "General Greece market data."
  },
  PT: {
    "name": "البرتغال",
    "nameEn": "Portugal",
    "flag": "🇵🇹",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 23,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Lisbon",
            "nameEn": "Lisbon",
            "code": "PT-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق البرتغال.",
    "noteEn": "General Portugal market data."
  },
  IE: {
    "name": "أيرلندا",
    "nameEn": "Ireland",
    "flag": "🇮🇪",
    "currency": "EUR",
    "currencySymbol": "€",
    "currencySymbolEn": "EUR",
    "vatRate": 23,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Dublin",
            "nameEn": "Dublin",
            "code": "IE-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق أيرلندا.",
    "noteEn": "General Ireland market data."
  },
  UA: {
    "name": "أوكرانيا",
    "nameEn": "Ukraine",
    "flag": "🇺🇦",
    "currency": "UAH",
    "currencySymbol": "₴",
    "currencySymbolEn": "UAH",
    "vatRate": 20,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Kyiv",
            "nameEn": "Kyiv",
            "code": "UA-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق أوكرانيا.",
    "noteEn": "General Ukraine market data."
  },
  KZ: {
    "name": "كازاخستان",
    "nameEn": "Kazakhstan",
    "flag": "🇰🇿",
    "currency": "KZT",
    "currencySymbol": "₸",
    "currencySymbolEn": "KZT",
    "vatRate": 12,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Astana",
            "nameEn": "Astana",
            "code": "KZ-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق كازاخستان.",
    "noteEn": "General Kazakhstan market data."
  },
  UZ: {
    "name": "أوزباكستان",
    "nameEn": "Uzbekistan",
    "flag": "🇺🇿",
    "currency": "UZS",
    "currencySymbol": "so'm",
    "currencySymbolEn": "UZS",
    "vatRate": 12,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Tashkent",
            "nameEn": "Tashkent",
            "code": "UZ-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق أوزباكستان.",
    "noteEn": "General Uzbekistan market data."
  },
  TH: {
    "name": "تايلند",
    "nameEn": "Thailand",
    "flag": "🇹🇭",
    "currency": "THB",
    "currencySymbol": "฿",
    "currencySymbolEn": "THB",
    "vatRate": 7,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Bangkok",
            "nameEn": "Bangkok",
            "code": "TH-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق تايلند.",
    "noteEn": "General Thailand market data."
  },
  VN: {
    "name": "فيتنام",
    "nameEn": "Vietnam",
    "flag": "🇻🇳",
    "currency": "VND",
    "currencySymbol": "₫",
    "currencySymbolEn": "VND",
    "vatRate": 10,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Hanoi",
            "nameEn": "Hanoi",
            "code": "VN-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق فيتنام.",
    "noteEn": "General Vietnam market data."
  },
  IL: {
    "name": "إسرائيل",
    "nameEn": "Israel",
    "flag": "🇮🇱",
    "currency": "ILS",
    "currencySymbol": "₪",
    "currencySymbolEn": "ILS",
    "vatRate": 17,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Jerusalem",
            "nameEn": "Jerusalem",
            "code": "IL-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق إسرائيل.",
    "noteEn": "General Israel market data."
  },
  HK: {
    "name": "هونغ كونغ",
    "nameEn": "Hong Kong",
    "flag": "🇭🇰",
    "currency": "HKD",
    "currencySymbol": "$",
    "currencySymbolEn": "HKD",
    "vatRate": 0,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "City of Victoria",
            "nameEn": "City of Victoria",
            "code": "HK-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق هونغ كونغ.",
    "noteEn": "General Hong Kong market data."
  },
  TW: {
    "name": "تايوان",
    "nameEn": "Taiwan",
    "flag": "🇹🇼",
    "currency": "TWD",
    "currencySymbol": "$",
    "currencySymbolEn": "TWD",
    "vatRate": 5,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Taipei",
            "nameEn": "Taipei",
            "code": "TW-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق تايوان.",
    "noteEn": "General Taiwan market data."
  },
  LK: {
    "name": "سريلانكا",
    "nameEn": "Sri Lanka",
    "flag": "🇱🇰",
    "currency": "LKR",
    "currencySymbol": "Rs  රු",
    "currencySymbolEn": "LKR",
    "vatRate": 18,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Colombo",
            "nameEn": "Colombo",
            "code": "LK-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق سريلانكا.",
    "noteEn": "General Sri Lanka market data."
  },
  CL: {
    "name": "تشيلي",
    "nameEn": "Chile",
    "flag": "🇨🇱",
    "currency": "CLP",
    "currencySymbol": "$",
    "currencySymbolEn": "CLP",
    "vatRate": 19,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Santiago",
            "nameEn": "Santiago",
            "code": "CL-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق تشيلي.",
    "noteEn": "General Chile market data."
  },
  CO: {
    "name": "كولومبيا",
    "nameEn": "Colombia",
    "flag": "🇨🇴",
    "currency": "COP",
    "currencySymbol": "$",
    "currencySymbolEn": "COP",
    "vatRate": 19,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Bogotá",
            "nameEn": "Bogotá",
            "code": "CO-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق كولومبيا.",
    "noteEn": "General Colombia market data."
  },
  PE: {
    "name": "بيرو",
    "nameEn": "Peru",
    "flag": "🇵🇪",
    "currency": "PEN",
    "currencySymbol": "S/.",
    "currencySymbolEn": "PEN",
    "vatRate": 18,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Lima",
            "nameEn": "Lima",
            "code": "PE-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق بيرو.",
    "noteEn": "General Peru market data."
  },
  VE: {
    "name": "فنزويلا",
    "nameEn": "Venezuela",
    "flag": "🇻🇪",
    "currency": "VES",
    "currencySymbol": "Bs.S.",
    "currencySymbolEn": "VES",
    "vatRate": 16,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Caracas",
            "nameEn": "Caracas",
            "code": "VE-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق فنزويلا.",
    "noteEn": "General Venezuela market data."
  },
  EC: {
    "name": "الإكوادور",
    "nameEn": "Ecuador",
    "flag": "🇪🇨",
    "currency": "USD",
    "currencySymbol": "$",
    "currencySymbolEn": "USD",
    "vatRate": 12,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Quito",
            "nameEn": "Quito",
            "code": "EC-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق الإكوادور.",
    "noteEn": "General Ecuador market data."
  },
  CR: {
    "name": "كوستاريكا",
    "nameEn": "Costa Rica",
    "flag": "🇨🇷",
    "currency": "CRC",
    "currencySymbol": "₡",
    "currencySymbolEn": "CRC",
    "vatRate": 13,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "San José",
            "nameEn": "San José",
            "code": "CR-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق كوستاريكا.",
    "noteEn": "General Costa Rica market data."
  },
  PA: {
    "name": "بنما",
    "nameEn": "Panama",
    "flag": "🇵🇦",
    "currency": "PAB",
    "currencySymbol": "B/.",
    "currencySymbolEn": "PAB",
    "vatRate": 7,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Panama City",
            "nameEn": "Panama City",
            "code": "PA-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق بنما.",
    "noteEn": "General Panama market data."
  },
  DO: {
    "name": "جمهورية الدومينيكان",
    "nameEn": "Dominican Republic",
    "flag": "🇩🇴",
    "currency": "DOP",
    "currencySymbol": "$",
    "currencySymbolEn": "DOP",
    "vatRate": 18,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Santo Domingo",
            "nameEn": "Santo Domingo",
            "code": "DO-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق جمهورية الدومينيكان.",
    "noteEn": "General Dominican Republic market data."
  },
  ET: {
    "name": "إثيوبيا",
    "nameEn": "Ethiopia",
    "flag": "🇪🇹",
    "currency": "ETB",
    "currencySymbol": "Br",
    "currencySymbolEn": "ETB",
    "vatRate": 15,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Addis Ababa",
            "nameEn": "Addis Ababa",
            "code": "ET-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق إثيوبيا.",
    "noteEn": "General Ethiopia market data."
  },
  GH: {
    "name": "غانا",
    "nameEn": "Ghana",
    "flag": "🇬🇭",
    "currency": "GHS",
    "currencySymbol": "₵",
    "currencySymbolEn": "GHS",
    "vatRate": 15,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Accra",
            "nameEn": "Accra",
            "code": "GH-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق غانا.",
    "noteEn": "General Ghana market data."
  },
  TZ: {
    "name": "تنزانيا",
    "nameEn": "Tanzania",
    "flag": "🇹🇿",
    "currency": "TZS",
    "currencySymbol": "Sh",
    "currencySymbolEn": "TZS",
    "vatRate": 18,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Dodoma",
            "nameEn": "Dodoma",
            "code": "TZ-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق تنزانيا.",
    "noteEn": "General Tanzania market data."
  },
  UG: {
    "name": "أوغندا",
    "nameEn": "Uganda",
    "flag": "🇺🇬",
    "currency": "UGX",
    "currencySymbol": "Sh",
    "currencySymbolEn": "UGX",
    "vatRate": 18,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Kampala",
            "nameEn": "Kampala",
            "code": "UG-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق أوغندا.",
    "noteEn": "General Uganda market data."
  },
  ZM: {
    "name": "زامبيا",
    "nameEn": "Zambia",
    "flag": "🇿🇲",
    "currency": "ZMW",
    "currencySymbol": "ZK",
    "currencySymbolEn": "ZMW",
    "vatRate": 16,
    "lastUpdated": "2026-07-13",
    "marketInsights": {
      "avgOrderValue": 30,
      "peakHours": "12:00–14:00 و 18:00–21:00",
      "paymentMethod": "Card 60% | Cash 25% | Digital wallets 15%"
    },
    "governorates": [
      {
        "name": "General",
        "nameEn": "General",
        "cities": [
          {
            "name": "Lusaka",
            "nameEn": "Lusaka",
            "code": "ZM-01-001"
          }
        ]
      }
    ],
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
    "note": "بيانات عامة للسوق زامبيا.",
    "noteEn": "General Zambia market data."
  }
};


if (typeof window !== 'undefined') {
  window.GLOBAL_COUNTRIES_GEO = GLOBAL_COUNTRIES_GEO;
}
