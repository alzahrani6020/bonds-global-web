/**
 * Feasibility Benchmark Data — Rent, Salaries, Utilities by Country/City
 * Sources: Open research, government portals, recruitment sites, property platforms (2025–2026)
 * These are ESTIMATES for planning purposes; actual costs vary by exact location and market conditions.
 */

var FEASIBILITY_BENCHMARKS = {
  SA: {
    currency: 'SAR',
    currencySymbol: 'ر.س',
    lastUpdated: '2026-05-30',
    rent: {
      commercial_street: { label: 'شارع تجاري رئيسي', min: 80000, max: 200000, avg: 120000, unit: 'سنوي', note: 'الرياض/جدة — مراكز المدن' },
      mall: { label: 'مجمع تجاري', min: 60000, max: 150000, avg: 90000, unit: 'سنوي', note: 'مولات متوسطة — حسب الموقع' },
      residential: { label: 'حي سكني', min: 30000, max: 70000, avg: 50000, unit: 'سنوي', note: 'أحياء سكنية — تكلفة أقل' },
      deposit: { label: 'تأمين إيجار (6 أشهر)', months: 6 }
    },
    salaries: {
      manager: { label: 'مدير مطعم', min: 6000, max: 12000, avg: 8000, note: 'يعتمد على الخبرة' },
      chef: { label: 'طباخ رئيسي', min: 5000, max: 10000, avg: 7000, note: 'طباخ محلي/آسيوي' },
      cook: { label: 'مساعد طباخ', min: 3000, max: 5000, avg: 4000, note: '' },
      waiter: { label: 'نادل', min: 2500, max: 4000, avg: 3000, note: 'شامل البدلات' },
      cashier: { label: 'كاشير', min: 3000, max: 4500, avg: 3500, note: '' },
      driver: { label: 'سائق توصيل', min: 3000, max: 5000, avg: 3500, note: 'بدل بنزين إضافي' },
      cleaner: { label: 'عامل نظافة', min: 2000, max: 3000, avg: 2500, note: '' },
      accountant: { label: 'محاسب', min: 4000, max: 7000, avg: 5000, note: 'جزئي أو متعاقد' }
    },
    utilities: {
      electricity: { label: 'كهرباء', monthly: 1200, note: 'صيف أعلى (تكييف)' },
      water: { label: 'ماء', monthly: 200, note: '' },
      gas: { label: 'غاز', monthly: 300, note: 'مطاعم تستخدم غاز بكميات أكبر' },
      internet: { label: 'إنترنت + POS', monthly: 400, note: 'شاملة النقاط البيع' },
      phone: { label: 'هاتف / تواصل', monthly: 200, note: '' }
    }
  },
  AE: {
    currency: 'AED',
    currencySymbol: 'د.إ',
    lastUpdated: '2026-05-26',
    rent: {
      commercial_street: { label: 'Main commercial street', min: 70000, max: 180000, avg: 110000, unit: 'yearly', note: 'Dubai Marina / Downtown' },
      mall: { label: 'Shopping mall', min: 80000, max: 200000, avg: 120000, unit: 'yearly', note: 'Dubai Mall area premium' },
      residential: { label: 'Residential area', min: 40000, max: 80000, avg: 60000, unit: 'yearly', note: 'Outer Dubai / Sharjah' },
      deposit: { label: 'Rent deposit (6 months)', months: 6 }
    },
    salaries: {
      manager: { label: 'Restaurant Manager', min: 7000, max: 15000, avg: 10000, note: 'Expat packages higher' },
      chef: { label: 'Head Chef', min: 6000, max: 12000, avg: 8000, note: 'European/Asian premium' },
      cook: { label: 'Line Cook', min: 3000, max: 5000, avg: 4000, note: '' },
      waiter: { label: 'Waiter', min: 2500, max: 4000, avg: 3000, note: 'Service charge tips extra' },
      cashier: { label: 'Cashier', min: 3000, max: 4500, avg: 3500, note: '' },
      driver: { label: 'Delivery Driver', min: 2500, max: 4000, avg: 3000, note: 'Fuel allowance extra' },
      cleaner: { label: 'Cleaner', min: 1800, max: 2800, avg: 2200, note: '' },
      accountant: { label: 'Accountant', min: 5000, max: 9000, avg: 6000, note: 'Part-time or outsourced' }
    },
    utilities: {
      electricity: { label: 'Electricity', monthly: 1500, note: 'Very high in summer (AC)' },
      water: { label: 'Water', monthly: 250, note: 'DEWA / ADDC' },
      gas: { label: 'Gas', monthly: 350, note: '' },
      internet: { label: 'Internet + POS', monthly: 500, note: 'High-speed required' },
      phone: { label: 'Phone / Comms', monthly: 250, note: '' }
    }
  },
  EG: {
    currency: 'EGP',
    currencySymbol: 'ج.م',
    lastUpdated: '2026-05-20',
    rent: {
      commercial_street: { label: 'شارع تجاري رئيسي', min: 50000, max: 150000, avg: 80000, unit: 'سنوي', note: 'القاهرة/الإسكندرية — المناطق الراقية' },
      mall: { label: 'مول تجاري', min: 60000, max: 180000, avg: 100000, unit: 'سنوي', note: 'City Stars / Mall of Arabia' },
      residential: { label: 'حي سكني', min: 20000, max: 50000, avg: 35000, unit: 'سنوي', note: 'أحياء متوسطة' },
      deposit: { label: 'تأمين إيجار (3-6 شهور)', months: 6 }
    },
    salaries: {
      manager: { label: 'مدير مطعم', min: 8000, max: 18000, avg: 12000, note: '' },
      chef: { label: 'شيف رئيسي', min: 7000, max: 15000, avg: 10000, note: '' },
      cook: { label: 'مساعد شيف', min: 4000, max: 7000, avg: 5000, note: '' },
      waiter: { label: 'ويتر', min: 3500, max: 5500, avg: 4000, note: 'شامل البدلات' },
      cashier: { label: 'كاشير', min: 4000, max: 6000, avg: 4500, note: '' },
      driver: { label: 'سائق توصيل', min: 4000, max: 6000, avg: 4500, note: '' },
      cleaner: { label: 'عامل نظافة', min: 3000, max: 4500, avg: 3500, note: '' },
      accountant: { label: 'محاسب', min: 5000, max: 9000, avg: 6000, note: '' }
    },
    utilities: {
      electricity: { label: 'كهرباء', monthly: 800, note: 'ارتفاع في الصيف' },
      water: { label: 'ماء', monthly: 150, note: '' },
      gas: { label: 'غاز', monthly: 200, note: '' },
      internet: { label: 'إنترنت + POS', monthly: 300, note: '' },
      phone: { label: 'هاتف / تواصل', monthly: 150, note: '' }
    }
  },
  KW: {
    currency: 'KWD',
    currencySymbol: 'د.ك',
    lastUpdated: '2026-05-20',
    rent: {
      commercial_street: { label: 'Commercial street', min: 5000, max: 12000, avg: 8000, unit: 'yearly', note: 'Salmiya / Hawally' },
      mall: { label: 'Mall', min: 6000, max: 15000, avg: 10000, unit: 'yearly', note: 'The Avenues / 360' },
      residential: { label: 'Residential area', min: 3000, max: 6000, avg: 4500, unit: 'yearly', note: 'Outer areas' },
      deposit: { label: 'Rent deposit (3-6 months)', months: 6 }
    },
    salaries: {
      manager: { label: 'Manager', min: 600, max: 1200, avg: 800, note: '' },
      chef: { label: 'Head Chef', min: 500, max: 1000, avg: 700, note: '' },
      cook: { label: 'Cook', min: 250, max: 400, avg: 300, note: '' },
      waiter: { label: 'Waiter', min: 200, max: 350, avg: 250, note: '' },
      cashier: { label: 'Cashier', min: 250, max: 400, avg: 300, note: '' },
      driver: { label: 'Driver', min: 200, max: 350, avg: 250, note: '' },
      cleaner: { label: 'Cleaner', min: 150, max: 250, avg: 180, note: '' },
      accountant: { label: 'Accountant', min: 400, max: 700, avg: 500, note: '' }
    },
    utilities: {
      electricity: { label: 'Electricity', monthly: 80, note: 'High summer AC' },
      water: { label: 'Water', monthly: 15, note: '' },
      gas: { label: 'Gas', monthly: 20, note: '' },
      internet: { label: 'Internet + POS', monthly: 25, note: '' },
      phone: { label: 'Phone', monthly: 10, note: '' }
    }
  },
  QA: {
    currency: 'QAR',
    currencySymbol: 'ر.ق',
    lastUpdated: '2026-05-20',
    rent: {
      commercial_street: { label: 'Commercial street', min: 60000, max: 150000, avg: 100000, unit: 'yearly', note: 'West Bay / The Pearl' },
      mall: { label: 'Mall', min: 80000, max: 200000, avg: 120000, unit: 'yearly', note: 'City Center / Mall of Qatar' },
      residential: { label: 'Residential', min: 40000, max: 80000, avg: 60000, unit: 'yearly', note: 'Al Sadd / Old Airport' },
      deposit: { label: 'Deposit (3-6 months)', months: 6 }
    },
    salaries: {
      manager: { label: 'Manager', min: 8000, max: 15000, avg: 10000, note: '' },
      chef: { label: 'Head Chef', min: 7000, max: 12000, avg: 9000, note: '' },
      cook: { label: 'Cook', min: 3000, max: 5000, avg: 4000, note: '' },
      waiter: { label: 'Waiter', min: 2500, max: 4000, avg: 3000, note: '' },
      cashier: { label: 'Cashier', min: 3000, max: 4500, avg: 3500, note: '' },
      driver: { label: 'Driver', min: 2500, max: 4000, avg: 3000, note: '' },
      cleaner: { label: 'Cleaner', min: 1800, max: 2800, avg: 2200, note: '' },
      accountant: { label: 'Accountant', min: 5000, max: 8000, avg: 6000, note: '' }
    },
    utilities: {
      electricity: { label: 'Electricity', monthly: 1000, note: 'High AC usage' },
      water: { label: 'Water', monthly: 200, note: '' },
      gas: { label: 'Gas', monthly: 300, note: '' },
      internet: { label: 'Internet + POS', monthly: 400, note: '' },
      phone: { label: 'Phone', monthly: 200, note: '' }
    }
  },
  BH: {
    currency: 'BHD',
    currencySymbol: 'د.ب',
    lastUpdated: '2026-05-20',
    rent: {
      commercial_street: { label: 'Commercial street', min: 5000, max: 12000, avg: 8000, unit: 'yearly', note: 'Manama / Juffair' },
      mall: { label: 'Mall', min: 6000, max: 15000, avg: 10000, unit: 'yearly', note: 'City Centre / Seef Mall' },
      residential: { label: 'Residential', min: 3000, max: 6000, avg: 4500, unit: 'yearly', note: 'Riffa / Isa Town' },
      deposit: { label: 'Deposit (3-6 months)', months: 6 }
    },
    salaries: {
      manager: { label: 'Manager', min: 500, max: 1000, avg: 700, note: '' },
      chef: { label: 'Head Chef', min: 450, max: 900, avg: 600, note: '' },
      cook: { label: 'Cook', min: 200, max: 350, avg: 250, note: '' },
      waiter: { label: 'Waiter', min: 180, max: 300, avg: 220, note: '' },
      cashier: { label: 'Cashier', min: 200, max: 350, avg: 250, note: '' },
      driver: { label: 'Driver', min: 180, max: 300, avg: 220, note: '' },
      cleaner: { label: 'Cleaner', min: 120, max: 200, avg: 150, note: '' },
      accountant: { label: 'Accountant', min: 350, max: 600, avg: 450, note: '' }
    },
    utilities: {
      electricity: { label: 'Electricity', monthly: 70, note: '' },
      water: { label: 'Water', monthly: 12, note: '' },
      gas: { label: 'Gas', monthly: 18, note: '' },
      internet: { label: 'Internet + POS', monthly: 22, note: '' },
      phone: { label: 'Phone', monthly: 10, note: '' }
    }
  },
  OM: {
    currency: 'OMR',
    currencySymbol: 'ر.ع',
    lastUpdated: '2026-05-20',
    rent: {
      commercial_street: { label: 'Commercial street', min: 4000, max: 10000, avg: 6500, unit: 'yearly', note: 'Muscat / Qurum' },
      mall: { label: 'Mall', min: 5000, max: 12000, avg: 8000, unit: 'yearly', note: 'Muscat City Centre' },
      residential: { label: 'Residential', min: 2500, max: 5000, avg: 3500, unit: 'yearly', note: 'Al Khuwair / Ruwi' },
      deposit: { label: 'Deposit (3-6 months)', months: 6 }
    },
    salaries: {
      manager: { label: 'Manager', min: 600, max: 1200, avg: 800, note: '' },
      chef: { label: 'Head Chef', min: 500, max: 1000, avg: 700, note: '' },
      cook: { label: 'Cook', min: 250, max: 400, avg: 300, note: '' },
      waiter: { label: 'Waiter', min: 200, max: 350, avg: 250, note: '' },
      cashier: { label: 'Cashier', min: 250, max: 400, avg: 300, note: '' },
      driver: { label: 'Driver', min: 200, max: 350, avg: 250, note: '' },
      cleaner: { label: 'Cleaner', min: 150, max: 250, avg: 180, note: '' },
      accountant: { label: 'Accountant', min: 400, max: 700, avg: 500, note: '' }
    },
    utilities: {
      electricity: { label: 'Electricity', monthly: 60, note: '' },
      water: { label: 'Water', monthly: 10, note: '' },
      gas: { label: 'Gas', monthly: 15, note: '' },
      internet: { label: 'Internet + POS', monthly: 20, note: '' },
      phone: { label: 'Phone', monthly: 8, note: '' }
    }
  },
  JO: {
    currency: 'JOD',
    currencySymbol: 'د.أ',
    lastUpdated: '2026-05-20',
    rent: {
      commercial_street: { label: 'شارع تجاري رئيسي', min: 8000, max: 18000, avg: 12000, unit: 'سنوي', note: 'عمان — جبل عمان / الرابية' },
      mall: { label: 'مول تجاري', min: 10000, max: 25000, avg: 15000, unit: 'سنوي', note: 'City Mall / Taj Mall' },
      residential: { label: 'حي سكني', min: 5000, max: 10000, avg: 7000, unit: 'سنوي', note: 'ضاحية الرشيد / ماركا' },
      deposit: { label: 'تأمين إيجار (3-6 شهور)', months: 6 }
    },
    salaries: {
      manager: { label: 'مدير مطعم', min: 500, max: 900, avg: 650, note: '' },
      chef: { label: 'شيف رئيسي', min: 450, max: 800, avg: 550, note: '' },
      cook: { label: 'مساعد شيف', min: 250, max: 400, avg: 300, note: '' },
      waiter: { label: 'ويتر', min: 250, max: 400, avg: 300, note: '' },
      cashier: { label: 'كاشير', min: 280, max: 450, avg: 350, note: '' },
      driver: { label: 'سائق توصيل', min: 250, max: 400, avg: 300, note: '' },
      cleaner: { label: 'عامل نظافة', min: 200, max: 300, avg: 230, note: '' },
      accountant: { label: 'محاسب', min: 350, max: 600, avg: 450, note: '' }
    },
    utilities: {
      electricity: { label: 'كهرباء', monthly: 100, note: '' },
      water: { label: 'ماء', monthly: 20, note: '' },
      gas: { label: 'غاز', monthly: 25, note: '' },
      internet: { label: 'إنترنت + POS', monthly: 30, note: '' },
      phone: { label: 'هاتف', monthly: 15, note: '' }
    }
  },
  IQ: {
    currency: 'IQD',
    currencySymbol: 'د.ع',
    lastUpdated: '2026-05-20',
    rent: {
      commercial_street: { label: 'شارع تجاري رئيسي', min: 15000000, max: 40000000, avg: 25000000, unit: 'سنوي', note: 'بغداد — الكرادة / المنصور' },
      mall: { label: 'مول تجاري', min: 20000000, max: 50000000, avg: 30000000, unit: 'سنوي', note: 'مولات بغداد الرئيسية' },
      residential: { label: 'حي سكني', min: 8000000, max: 18000000, avg: 12000000, unit: 'سنوي', note: 'أحياء متوسطة' },
      deposit: { label: 'تأمين إيجار (3-6 شهور)', months: 6 }
    },
    salaries: {
      manager: { label: 'مدير مطعم', min: 800000, max: 1500000, avg: 1000000, note: '' },
      chef: { label: 'شيف رئيسي', min: 700000, max: 1200000, avg: 900000, note: '' },
      cook: { label: 'مساعد شيف', min: 400000, max: 600000, avg: 500000, note: '' },
      waiter: { label: 'ويتر', min: 350000, max: 550000, avg: 400000, note: '' },
      cashier: { label: 'كاشير', min: 400000, max: 600000, avg: 450000, note: '' },
      driver: { label: 'سائق توصيل', min: 350000, max: 550000, avg: 400000, note: '' },
      cleaner: { label: 'عامل نظافة', min: 300000, max: 450000, avg: 350000, note: '' },
      accountant: { label: 'محاسب', min: 500000, max: 800000, avg: 600000, note: '' }
    },
    utilities: {
      electricity: { label: 'كهرباء', monthly: 150000, note: '' },
      water: { label: 'ماء', monthly: 25000, note: '' },
      gas: { label: 'غاز', monthly: 50000, note: '' },
      internet: { label: 'إنترنت + POS', monthly: 75000, note: '' },
      phone: { label: 'هاتف', monthly: 25000, note: '' }
    }
  },
  LB: {
    currency: 'USD',
    currencySymbol: '$',
    lastUpdated: '2026-05-20',
    rent: {
      commercial_street: { label: 'Commercial street', min: 12000, max: 36000, avg: 20000, unit: 'yearly', note: 'Beirut — Hamra / Achrafieh' },
      mall: { label: 'Mall', min: 18000, max: 48000, avg: 30000, unit: 'yearly', note: 'ABC / CityMall' },
      residential: { label: 'Residential', min: 6000, max: 18000, avg: 10000, unit: 'yearly', note: 'Outer Beirut / Tripoli' },
      deposit: { label: 'Deposit (3-6 months)', months: 6 }
    },
    salaries: {
      manager: { label: 'Manager', min: 800, max: 1500, avg: 1000, note: 'USD — often paid in fresh' },
      chef: { label: 'Head Chef', min: 600, max: 1200, avg: 800, note: '' },
      cook: { label: 'Cook', min: 300, max: 500, avg: 400, note: '' },
      waiter: { label: 'Waiter', min: 250, max: 400, avg: 300, note: 'Tips significant' },
      cashier: { label: 'Cashier', min: 300, max: 450, avg: 350, note: '' },
      driver: { label: 'Driver', min: 250, max: 400, avg: 300, note: '' },
      cleaner: { label: 'Cleaner', min: 200, max: 300, avg: 220, note: '' },
      accountant: { label: 'Accountant', min: 400, max: 700, avg: 500, note: '' }
    },
    utilities: {
      electricity: { label: 'Electricity', monthly: 200, note: 'Generator costs extra' },
      water: { label: 'Water', monthly: 30, note: '' },
      gas: { label: 'Gas', monthly: 50, note: '' },
      internet: { label: 'Internet + POS', monthly: 60, note: '' },
      phone: { label: 'Phone', monthly: 25, note: '' }
    }
  },
  YE: {
    currency: 'YER',
    currencySymbol: 'ر.ي',
    lastUpdated: '2026-05-20',
    rent: {
      commercial_street: { label: 'شارع تجاري رئيسي', min: 2000000, max: 6000000, avg: 3500000, unit: 'سنوي', note: 'صنعاء / عدن — مراكز المدن' },
      mall: { label: 'مول تجاري', min: 3000000, max: 8000000, avg: 5000000, unit: 'سنوي', note: 'مولات رئيسية' },
      residential: { label: 'حي سكني', min: 1000000, max: 2500000, avg: 1500000, unit: 'سنوي', note: 'أحياء متوسطة' },
      deposit: { label: 'تأمين إيجار (3-6 شهور)', months: 6 }
    },
    salaries: {
      manager: { label: 'مدير مطعم', min: 150000, max: 300000, avg: 200000, note: '' },
      chef: { label: 'شيف رئيسي', min: 120000, max: 250000, avg: 180000, note: '' },
      cook: { label: 'مساعد شيف', min: 80000, max: 120000, avg: 90000, note: '' },
      waiter: { label: 'ويتر', min: 60000, max: 100000, avg: 70000, note: '' },
      cashier: { label: 'كاشير', min: 80000, max: 120000, avg: 90000, note: '' },
      driver: { label: 'سائق توصيل', min: 60000, max: 100000, avg: 70000, note: '' },
      cleaner: { label: 'عامل نظافة', min: 50000, max: 80000, avg: 60000, note: '' },
      accountant: { label: 'محاسب', min: 100000, max: 150000, avg: 120000, note: '' }
    },
    utilities: {
      electricity: { label: 'كهرباء', monthly: 30000, note: '' },
      water: { label: 'ماء', monthly: 5000, note: '' },
      gas: { label: 'غاز', monthly: 10000, note: '' },
      internet: { label: 'إنترنت + POS', monthly: 15000, note: '' },
      phone: { label: 'هاتف', monthly: 5000, note: '' }
    }
  }
};

// Helper to get benchmark data safely
function getBenchmark(countryCode) {
  return FEASIBILITY_BENCHMARKS[countryCode] || FEASIBILITY_BENCHMARKS['SA'];
}
