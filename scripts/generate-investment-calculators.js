/**
 * Generator for Investment Center sector calculator pages.
 * Supports Basic and Expert modes with 7-stage expert navigation.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const sectorsAr = [
  {
    id: 'medical',
    icon: '🏥',
    title: 'حاسبة الاستثمار الطبي',
    desc: 'حلل جدوى إنشاء عيادة، مستشفى، صيدلية، أو مختبر طبي.',
    riskWeight: 1.2,
    fields: [
      { name: 'unitsCount', label: 'عدد الأسرّة / العيادات / الفروع', type: 'number', default: 5 },
      { name: 'avgDailyRevenue', label: 'متوسط الإيراد اليومي (ر.س)', type: 'number', default: 2500 },
      { name: 'equipmentCost', label: 'تكلفة التجهيزات والأDevices (ر.س)', type: 'number', default: 300000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية للكوادر الطبية (ر.س)', type: 'number', default: 45000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري والخدمات (ر.س)', type: 'number', default: 15000 },
      { name: 'materialCostRate', label: 'نسبة تكلفة المواد الطبية من الإيرادات (%)', type: 'number', default: 25 }
    ]
  },
  {
    id: 'industrial',
    icon: '🏭',
    title: 'حاسبة الاستثمار الصناعي',
    desc: 'قيّم جدوى إنشاء مصنع أو منشأة إنتاجية.',
    riskWeight: 1.4,
    fields: [
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', default: 2000000 },
      { name: 'monthlyCapacity', label: 'الطاقة الإنتاجية الشهرية (وحدة)', type: 'number', default: 10000 },
      { name: 'unitPrice', label: 'سعر بيع الوحدة (ر.س)', type: 'number', default: 150 },
      { name: 'rawMaterialCost', label: 'تكلفة المواد الخام للوحدة (ر.س)', type: 'number', default: 60 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', default: 80000 },
      { name: 'monthlyUtilities', label: 'الكهرباء والماء والخدمات الشهرية (ر.س)', type: 'number', default: 25000 }
    ]
  },
  {
    id: 'real-estate',
    icon: '🏢',
    title: 'حاسبة الاستثمار العقاري',
    desc: 'حلل عائد استثمار عقاري سكني أو تجاري.',
    riskWeight: 1.1,
    fields: [
      { name: 'landValue', label: 'قيمة الأرض (ر.س)', type: 'number', default: 1000000 },
      { name: 'constructionCost', label: 'تكلفة البناء والتشطيب (ر.س)', type: 'number', default: 2500000 },
      { name: 'unitsCount', label: 'عدد الوحدات', type: 'number', default: 20 },
      { name: 'unitPrice', label: 'سعر البيع / الإيجار السنوي للوحدة (ر.س)', type: 'number', default: 120000 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 36 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية للمشروع (ر.س)', type: 'number', default: 20000 }
    ]
  },
  {
    id: 'commercial',
    icon: '🤝',
    title: 'حاسبة الاستثمار التجاري',
    desc: 'قيّم جدوى وكالة تجارية أو مشروع استيراد وتصدير.',
    riskWeight: 1.2,
    fields: [
      { name: 'inventoryCost', label: 'تكلفة المخزون الأولي (ر.س)', type: 'number', default: 500000 },
      { name: 'monthlySales', label: 'المبيعات الشهرية المتوقعة (ر.س)', type: 'number', default: 300000 },
      { name: 'profitMargin', label: 'هامش الربح الإجمالي (%)', type: 'number', default: 25 },
      { name: 'monthlyRent', label: 'الإيجار والمرافق الشهرية (ر.س)', type: 'number', default: 12000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 25000 },
      { name: 'marketingCost', label: 'التسويق والتشغيل الشهري (ر.س)', type: 'number', default: 10000 }
    ]
  },
  {
    id: 'tourism',
    icon: '✈️',
    title: 'حاسبة الاستثمار السياحي',
    desc: 'حلل جدوى فندق، شقق مفروشة، أو خدمة سياحية.',
    riskWeight: 1.3,
    fields: [
      { name: 'unitsCount', label: 'عدد الغرف / الشقق / المقاعد', type: 'number', default: 30 },
      { name: 'occupancyRate', label: 'نسبة الإشغال المتوقعة (%)', type: 'number', default: 65 },
      { name: 'avgDailyRate', label: 'متوسط السعر اليومي (ر.س)', type: 'number', default: 400 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأثيث (ر.س)', type: 'number', default: 800000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 35000 },
      { name: 'monthlyUtilities', label: 'الخدمات والصيانة الشهرية (ر.س)', type: 'number', default: 15000 }
    ]
  },
  {
    id: 'education',
    icon: '🎓',
    title: 'حاسبة الاستثمار التعليمي',
    desc: 'قيّم جدوى مدرسة، مركز تدريب، أو منصة تعليمية.',
    riskWeight: 1.0,
    fields: [
      { name: 'capacity', label: 'الطاقة الاستيعابية (طالب/متدرب)', type: 'number', default: 200 },
      { name: 'enrollmentRate', label: 'نسبة التسجيل المتوقعة (%)', type: 'number', default: 70 },
      { name: 'monthlyFee', label: 'الرسوم الشهرية للفرد (ر.س)', type: 'number', default: 800 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 400000 },
      { name: 'monthlySalaries', label: 'رواتب المعلمين والإداريين (ر.س)', type: 'number', default: 60000 },
      { name: 'monthlyRent', label: 'الإيجار والخدمات الشهرية (ر.س)', type: 'number', default: 18000 }
    ]
  },
  {
    id: 'logistics',
    icon: '🚛',
    title: 'حاسبة الاستثمار اللوجستي',
    desc: 'حلل جدوى شركة نقل، تخزين، أو توصيل.',
    riskWeight: 1.2,
    fields: [
      { name: 'fleetSize', label: 'عدد المركبات', type: 'number', default: 10 },
      { name: 'monthlyTrips', label: 'عدد الرحلات الشهرية', type: 'number', default: 600 },
      { name: 'revenuePerTrip', label: 'الإيراد لكل رحلة (ر.س)', type: 'number', default: 300 },
      { name: 'vehicleCost', label: 'تكلفة شراء المركبات (ر.س)', type: 'number', default: 900000 },
      { name: 'fuelMaintenance', label: 'الوقود والصيانة لكل رحلة (ر.س)', type: 'number', default: 80 },
      { name: 'monthlySalaries', label: 'الرواتب والتشغيل الشهرية (ر.س)', type: 'number', default: 30000 }
    ]
  },
  {
    id: 'agriculture',
    icon: '🌾',
    title: 'حاسبة الاستثمار الزراعي',
    desc: 'قيّم جدوى مزرعة أو مشروع إنتاج غذائي.',
    riskWeight: 1.3,
    fields: [
      { name: 'areaSize', label: 'مساحة الأرض (هكتار)', type: 'number', default: 10 },
      { name: 'yieldPerHectare', label: 'الإنتاجية (كجم/هكتار/موسم)', type: 'number', default: 5000 },
      { name: 'pricePerKg', label: 'سعر البيع للكجم (ر.س)', type: 'number', default: 8 },
      { name: 'landSetupCost', label: 'تكلفة إعداد الأرض والبنية (ر.س)', type: 'number', default: 300000 },
      { name: 'operationalCostPerKg', label: 'تكلفة التشغيل للكجم (ر.س)', type: 'number', default: 3 },
      { name: 'harvestsPerYear', label: 'عدد مواسم الحصاد سنويًا', type: 'number', default: 2 }
    ]
  },
  {
    id: 'technology',
    icon: '💻',
    title: 'حاسبة الاستثمار التقني',
    desc: 'حلل جدوى شركة برمجة، تطبيق، أو منصة SaaS.',
    riskWeight: 1.1,
    fields: [
      { name: 'developmentCost', label: 'تكلفة التطوير الأولية (ر.س)', type: 'number', default: 350000 },
      { name: 'subscribers', label: 'عدد المشتركين المتوقعين', type: 'number', default: 500 },
      { name: 'subscriptionPrice', label: 'سعر الاشتراك الشهري (ر.س)', type: 'number', default: 150 },
      { name: 'monthlyServers', label: 'تكلفة السيرفرات والأدوات الشهرية (ر.س)', type: 'number', default: 8000 },
      { name: 'monthlyMarketing', label: 'الميزانية الشهرية للتسويق (ر.س)', type: 'number', default: 20000 },
      { name: 'monthlySalaries', label: 'رواتب الفريق الشهرية (ر.س)', type: 'number', default: 70000 }
    ]
  },
  {
    id: 'restaurants',
    icon: '🍽️',
    title: 'حاسبة استثمار المطاعم والمقاهي',
    desc: 'قيّم جدوى مطعم أو مقهى جديد.',
    riskWeight: 1.2,
    fields: [
      { name: 'seatsCount', label: 'عدد المقاعد / الطاولات', type: 'number', default: 40 },
      { name: 'avgTicket', label: 'متوسط قيمة الفاتورة (ر.س)', type: 'number', default: 90 },
      { name: 'dailyCustomers', label: 'عدد العملاء اليومي المتوقع', type: 'number', default: 120 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 500000 },
      { name: 'foodCostRate', label: 'نسبة تكلفة الطعام (%)', type: 'number', default: 35 },
      { name: 'monthlyRentSalaries', label: 'الإيجار + الرواتب الشهرية (ر.س)', type: 'number', default: 45000 }
    ]
  },
  {
    id: 'retail',
    icon: '🛒',
    title: 'حاسبة الاستثمار بالتجزئة',
    desc: 'حلل جدوى متجر تجزئة أو سوبرماركت أو متجر إلكتروني.',
    riskWeight: 1.1,
    fields: [
      { name: 'storeArea', label: 'مساحة المتجر (م²)', type: 'number', default: 100 },
      { name: 'dailySales', label: 'المبيعات اليومية المتوقعة (ر.س)', type: 'number', default: 4000 },
      { name: 'profitMargin', label: 'هامش الربح الإجمالي (%)', type: 'number', default: 30 },
      { name: 'inventoryCost', label: 'تكلفة المخزون الأولي (ر.س)', type: 'number', default: 300000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 20000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 28000 }
    ]
  },
  {
    id: 'construction',
    icon: '🏗️',
    title: 'حاسبة استثمار التشييد والمقاولات',
    desc: 'قيّم جدوى مشروع مقاولات أو إنشائي.',
    riskWeight: 1.4,
    fields: [
      { name: 'projectValue', label: 'قيمة العقد الإجمالية (ر.س)', type: 'number', default: 3000000 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 18 },
      { name: 'materialCostRate', label: 'نسبة تكلفة المواد (%)', type: 'number', default: 45 },
      { name: 'laborCostRate', label: 'نسبة تكلفة العمالة (%)', type: 'number', default: 25 },
      { name: 'overheadRate', label: 'نسبة المصاريف العمومية (%)', type: 'number', default: 10 },
      { name: 'initialEquipment', label: 'تكلفة المعدات الأولية (ر.س)', type: 'number', default: 600000 }
    ]
  },
  {
    id: 'hospital',
    icon: '🏥',
    title: 'حاسبة جدوى مستشفى',
    desc: 'حلل جدوى إنشاء مستشفى متعدد الأقسام والتخصصات.',
    riskWeight: 1.3,
    fields: [
      { name: 'numberOfBeds', label: 'عدد الأسرّة', type: 'number', default: 50 },
      { name: 'avgDailyRevenuePerBed', label: 'متوسط الإيراد اليومي للسرير (ر.س)', type: 'number', default: 3500 },
      { name: 'constructionAndEquipmentCost', label: 'تكلفة البناء والتجهيزات (ر.س)', type: 'number', default: 25000000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية للكوادر (ر.س)', type: 'number', default: 450000 },
      { name: 'monthlyUtilities', label: 'الخدمات والصيانة الشهرية (ر.س)', type: 'number', default: 120000 },
      { name: 'medicalSuppliesRate', label: 'نسبة المواد الطبية من الإيرادات (%)', type: 'number', default: 28 }
    ]
  },
  {
    id: 'medical-complex',
    icon: '🏨',
    title: 'حاسبة جدوى مجمع طبي',
    desc: 'قيّم جدوى مجمع طبي يضم عيادات متعددة التخصصات.',
    riskWeight: 1.2,
    fields: [
      { name: 'numberOfClinics', label: 'عدد العيادات', type: 'number', default: 10 },
      { name: 'avgMonthlyRevenuePerClinic', label: 'متوسط الإيراد الشهري للعيادة (ر.س)', type: 'number', default: 120000 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 3000000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 45000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 180000 },
      { name: 'operatingCostRate', label: 'نسبة التشغيل من الإيرادات (%)', type: 'number', default: 22 }
    ]
  },
  {
    id: 'dental-clinic',
    icon: '🦷',
    title: 'حاسبة جدوى عيادة أسنان',
    desc: 'حلل جدوى إنشاء عيادة أسنان متخصصة.',
    riskWeight: 1.1,
    fields: [
      { name: 'numberOfChairs', label: 'عدد كراسي العلاج', type: 'number', default: 4 },
      { name: 'avgDailyRevenuePerChair', label: 'متوسط الإيراد اليومي للكرسي (ر.س)', type: 'number', default: 2200 },
      { name: 'equipmentCost', label: 'تكلفة التجهيزات (ر.س)', type: 'number', default: 650000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 18000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 55000 },
      { name: 'materialCostRate', label: 'نسبة مواد الأسنان من الإيرادات (%)', type: 'number', default: 25 }
    ]
  },
  {
    id: 'radiology-center',
    icon: '🩻',
    title: 'حاسبة جدوى مركز أشعة',
    desc: 'قيّم جدوى مركز تشخيصي للأشعة والتصوير الطبي.',
    riskWeight: 1.2,
    fields: [
      { name: 'numberOfMachines', label: 'عدد الأجهزة', type: 'number', default: 3 },
      { name: 'avgDailyRevenuePerMachine', label: 'متوسط الإيراد اليومي للجهاز (ر.س)', type: 'number', default: 5000 },
      { name: 'equipmentCost', label: 'تكلفة الأجهزة والتجهيزات (ر.س)', type: 'number', default: 4000000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 25000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 70000 },
      { name: 'contrastMaterialRate', label: 'نسبة مواد التباين من الإيرادات (%)', type: 'number', default: 18 }
    ]
  },
  {
    id: 'medical-lab',
    icon: '🧪',
    title: 'حاسبة جدوى مختبر طبي',
    desc: 'حلل جدوى إنشاء مختبر تحاليل طبية.',
    riskWeight: 1.1,
    fields: [
      { name: 'avgDailyTests', label: 'متوسط عدد التحاليل اليومية', type: 'number', default: 200 },
      { name: 'avgRevenuePerTest', label: 'متوسط إيراد التحليل (ر.س)', type: 'number', default: 85 },
      { name: 'equipmentCost', label: 'تكلفة الأجهزة والتجهيزات (ر.س)', type: 'number', default: 1800000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 22000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 65000 },
      { name: 'reagentCostRate', label: 'نسبة الكواشف من الإيرادات (%)', type: 'number', default: 30 }
    ]
  },
  {
    id: 'physiotherapy-center',
    icon: '💆',
    title: 'حاسبة جدوى مركز علاج طبيعي',
    desc: 'قيّم جدوى مركز علاج طبيعي وتأهيل.',
    riskWeight: 1.0,
    fields: [
      { name: 'numberOfSessionsPerDay', label: 'عدد الجلسات اليومية', type: 'number', default: 40 },
      { name: 'avgRevenuePerSession', label: 'متوسط إيراد الجلسة (ر.س)', type: 'number', default: 180 },
      { name: 'equipmentCost', label: 'تكلفة أجهزة العلاج (ر.س)', type: 'number', default: 500000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 15000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 40000 },
      { name: 'disposableCostRate', label: 'نسبة المستهلكات من الإيرادات (%)', type: 'number', default: 15 }
    ]
  },
  {
    id: 'pharmacy',
    icon: '💊',
    title: 'حاسبة جدوى صيدلية',
    desc: 'حلل جدوى إنشاء صيدلية جديدة.',
    riskWeight: 1.0,
    fields: [
      { name: 'avgDailySales', label: 'متوسط المبيعات اليومية (ر.س)', type: 'number', default: 12000 },
      { name: 'profitMargin', label: 'هامش الربح الإجمالي (%)', type: 'number', default: 22 },
      { name: 'inventoryCost', label: 'تكلفة المخزون الأولي (ر.س)', type: 'number', default: 400000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 12000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 25000 },
      { name: 'licenseCost', label: 'تكلفة الترخيص والتأمين (ر.س)', type: 'number', default: 150000 }
    ]
  },
  {
    id: 'optical-center',
    icon: '👓',
    title: 'حاسبة جدوى مركز بصريات',
    desc: 'قيّم جدوى محل نظارات وعدسات طبية.',
    riskWeight: 1.1,
    fields: [
      { name: 'avgDailySales', label: 'متوسط عدد المبيعات اليومية', type: 'number', default: 15 },
      { name: 'avgTicketValue', label: 'متوسط قيمة الفاتورة (ر.س)', type: 'number', default: 450 },
      { name: 'inventoryCost', label: 'تكلفة المخزون الأولي (ر.س)', type: 'number', default: 350000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 14000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 22000 },
      { name: 'lensCostRate', label: 'نسبة تكلفة العدسات من الإيرادات (%)', type: 'number', default: 40 }
    ]
  },
  {
    id: 'land-development',
    icon: '🏞️',
    title: 'حاسبة تطوير أرض',
    desc: 'حلل جدوى تطوير أرض سكنية أو تجارية.',
    riskWeight: 1.3,
    fields: [
      { name: 'landArea', label: 'مساحة الأرض (م²)', type: 'number', default: 5000 },
      { name: 'landPricePerM2', label: 'سعر شراء المتر المربع (ر.س)', type: 'number', default: 800 },
      { name: 'developmentCostPerM2', label: 'تكلفة التطوير للمتر المربع (ر.س)', type: 'number', default: 1200 },
      { name: 'sellingPricePerM2', label: 'سعر البيع للمتر المربع (ر.س)', type: 'number', default: 2500 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 24 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 25000 }
    ]
  },
  {
    id: 'villa-construction',
    icon: '🏡',
    title: 'حاسبة بناء فلل للبيع',
    desc: 'قيّم جدوى بناء وبيع فلل سكنية.',
    riskWeight: 1.2,
    fields: [
      { name: 'numberOfVillas', label: 'عدد الفلل', type: 'number', default: 5 },
      { name: 'landCost', label: 'تكلفة الأرض (ر.س)', type: 'number', default: 3000000 },
      { name: 'constructionCostPerVilla', label: 'تكلفة البناء للفيلا (ر.س)', type: 'number', default: 1500000 },
      { name: 'sellingPricePerVilla', label: 'سعر بيع الفيلا (ر.س)', type: 'number', default: 3500000 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 18 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 30000 }
    ]
  },
  {
    id: 'residential-building',
    icon: '🏢',
    title: 'حاسبة بناء عمائر سكنية',
    desc: 'حلل جدوى بناء عماره سكنية للبيع.',
    riskWeight: 1.2,
    fields: [
      { name: 'numberOfApartments', label: 'عدد الشقق', type: 'number', default: 30 },
      { name: 'landCost', label: 'تكلفة الأرض (ر.س)', type: 'number', default: 4000000 },
      { name: 'constructionCostPerApartment', label: 'تكلفة البناء للشقة (ر.س)', type: 'number', default: 450000 },
      { name: 'sellingPricePerApartment', label: 'سعر بيع الشقة (ر.س)', type: 'number', default: 900000 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 24 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 40000 }
    ]
  },
  {
    id: 'commercial-complex',
    icon: '🏬',
    title: 'حاسبة مجمع تجاري',
    desc: 'قيّم جدوى إنشاء مجمع تجاري للإيجار.',
    riskWeight: 1.2,
    fields: [
      { name: 'numberOfUnits', label: 'عدد الوحدات التجارية', type: 'number', default: 15 },
      { name: 'landCost', label: 'تكلفة الأرض (ر.س)', type: 'number', default: 5000000 },
      { name: 'constructionCostPerUnit', label: 'تكلفة البناء للوحدة (ر.س)', type: 'number', default: 600000 },
      { name: 'annualRentPerUnit', label: 'الإيجار السنوي للوحدة (ر.س)', type: 'number', default: 90000 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 18 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 35000 }
    ]
  },
  {
    id: 'commercial-mall',
    icon: '🛍️',
    title: 'حاسبة مول تجاري',
    desc: 'حلل جدوى إنشاء مول تجاري كبير.',
    riskWeight: 1.3,
    fields: [
      { name: 'rentableArea', label: 'المساحة القابلة للإيجار (م²)', type: 'number', default: 10000 },
      { name: 'landCost', label: 'تكلفة الأرض (ر.س)', type: 'number', default: 15000000 },
      { name: 'constructionCostPerM2', label: 'تكلفة البناء للمتر المربع (ر.س)', type: 'number', default: 3500 },
      { name: 'annualRentPerM2', label: 'الإيجار السنوي للمتر المربع (ر.س)', type: 'number', default: 650 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 30 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 150000 }
    ]
  },
  {
    id: 'hotel-apartments',
    icon: '🏨',
    title: 'حاسبة شقق فندقية',
    desc: 'قيّم جدوى إنشاء شقق فندقية مفروشة.',
    riskWeight: 1.3,
    fields: [
      { name: 'numberOfApartments', label: 'عدد الشقق', type: 'number', default: 25 },
      { name: 'landCost', label: 'تكلفة الأرض (ر.س)', type: 'number', default: 6000000 },
      { name: 'setupCostPerApartment', label: 'تكلفة التجهيز للشقة (ر.س)', type: 'number', default: 180000 },
      { name: 'avgDailyRate', label: 'متوسط السعر اليومي (ر.س)', type: 'number', default: 450 },
      { name: 'occupancyRate', label: 'نسبة الإشغال المتوقعة (%)', type: 'number', default: 65 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 45000 }
    ]
  },
  {
    id: 'warehouses',
    icon: '🏭',
    title: 'حاسبة مستودعات',
    desc: 'حلل جدوى إنشاء مستودعات للإيجار.',
    riskWeight: 1.1,
    fields: [
      { name: 'warehouseArea', label: 'مساحة المستودع (م²)', type: 'number', default: 3000 },
      { name: 'landCost', label: 'تكلفة الأرض (ر.س)', type: 'number', default: 2000000 },
      { name: 'constructionCostPerM2', label: 'تكلفة البناء للمتر المربع (ر.س)', type: 'number', default: 1200 },
      { name: 'annualRentPerM2', label: 'الإيجار السنوي للمتر المربع (ر.س)', type: 'number', default: 180 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 12 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 15000 }
    ]
  },
  {
    id: 'property-rehabilitation',
    icon: '🔧',
    title: 'حاسبة إعادة تأهيل عقار متعثر',
    desc: 'قيّم جدوى شراء وإعادة تأهيل عقار للبيع.',
    riskWeight: 1.4,
    fields: [
      { name: 'purchasePrice', label: 'سعر شراء العقار (ر.س)', type: 'number', default: 2500000 },
      { name: 'rehabilitationCost', label: 'تكلفة إعادة التأهيل (ر.س)', type: 'number', default: 800000 },
      { name: 'expectedSellingPrice', label: 'سعر البيع المتوقع (ر.س)', type: 'number', default: 4500000 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 12 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 20000 },
      { name: 'holdingCostRate', label: 'نسبة تكلفة الاحتفاظ من الإيرادات (%)', type: 'number', default: 8 }
    ]
  },
  {
    id: 'buy-to-rent',
    icon: '🏠',
    title: 'حاسبة شراء عقار وتأجيره',
    desc: 'حلل عائد شراء عقار جاهز وتأجيره.',
    riskWeight: 1.1,
    fields: [
      { name: 'propertyPrice', label: 'سعر شراء العقار (ر.س)', type: 'number', default: 1500000 },
      { name: 'annualRent', label: 'الإيجار السنوي (ر.س)', type: 'number', default: 90000 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 8000 },
      { name: 'vacancyRate', label: 'نسبة الشواغر السنوية (%)', type: 'number', default: 10 },
      { name: 'setupCost', label: 'تكلفة التجهيز الأولية (ر.س)', type: 'number', default: 50000 },
      { name: 'annualAppreciation', label: 'نسبة التقييم السنوية للعقار (%)', type: 'number', default: 3 }
    ]
  },
  {
    id: 'quick-real-estate',
    icon: '⚡',
    title: 'حاسبة الاستثمار العقاري السريع',
    desc: 'تقييم سريع لعائد الاستثمار العقاري.',
    riskWeight: 1.0,
    fields: [
      { name: 'propertyPrice', label: 'سعر العقار (ر.س)', type: 'number', default: 1200000 },
      { name: 'annualRent', label: 'الإيجار السنوي (ر.س)', type: 'number', default: 84000 },
      { name: 'operatingExpenseRate', label: 'نسبة المصاريف التشغيلية من الإيجار (%)', type: 'number', default: 20 },
      { name: 'vacancyRate', label: 'نسبة الشواغر (%)', type: 'number', default: 8 },
      { name: 'annualAppreciation', label: 'نسبة التقييم السنوية (%)', type: 'number', default: 3 },
      { name: 'financingRate', label: 'نسبة التمويل من سعر العقار (%)', type: 'number', default: 0 }
    ]
  },
  {
    id: 'food-factory',
    icon: '🍞',
    title: 'حاسبة مصنع أغذية',
    desc: 'حلل جدوى إنشاء مصنع منتجات غذائية.',
    riskWeight: 1.2,
    fields: [
      { name: 'monthlyCapacity', label: 'الطاقة الإنتاجية الشهرية (وحدة)', type: 'number', default: 50000 },
      { name: 'unitPrice', label: 'سعر بيع الوحدة (ر.س)', type: 'number', default: 8 },
      { name: 'rawMaterialCostPerUnit', label: 'تكلفة المواد الخام للوحدة (ر.س)', type: 'number', default: 3.5 },
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', default: 3500000 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', default: 90000 },
      { name: 'monthlyUtilities', label: 'الكهرباء والماء والخدمات الشهرية (ر.س)', type: 'number', default: 35000 }
    ]
  },
  {
    id: 'water-factory',
    icon: '💧',
    title: 'حاسبة مصنع مياه',
    desc: 'قيّم جدوى مصنع تعبئة مياه شرب.',
    riskWeight: 1.1,
    fields: [
      { name: 'dailyProduction', label: 'الإنتاج اليومي (عبوة)', type: 'number', default: 30000 },
      { name: 'bottlePrice', label: 'سعر بيع العبوة (ر.س)', type: 'number', default: 1.5 },
      { name: 'rawMaterialCostPerBottle', label: 'تكلفة المواد للعبوة (ر.س)', type: 'number', default: 0.45 },
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', default: 2500000 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', default: 55000 },
      { name: 'monthlyUtilities', label: 'الكهرباء والماء والخدمات الشهرية (ر.س)', type: 'number', default: 40000 }
    ]
  },
  {
    id: 'plastic-factory',
    icon: '🧴',
    title: 'حاسبة مصنع بلاستيك',
    desc: 'حلل جدوى مصنع منتجات بلاستيكية.',
    riskWeight: 1.3,
    fields: [
      { name: 'monthlyCapacity', label: 'الطاقة الإنتاجية الشهرية (كجم)', type: 'number', default: 20000 },
      { name: 'pricePerKg', label: 'سعر البيع للكجم (ر.س)', type: 'number', default: 12 },
      { name: 'rawMaterialCostPerKg', label: 'تكلفة المواد الخام للكجم (ر.س)', type: 'number', default: 5.5 },
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', default: 4500000 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', default: 110000 },
      { name: 'monthlyUtilities', label: 'الكهرباء والماء والخدمات الشهرية (ر.س)', type: 'number', default: 50000 }
    ]
  },
  {
    id: 'building-materials-factory',
    icon: '🧱',
    title: 'حاسبة مصنع مواد بناء',
    desc: 'قيّم جدوى مصنع مواد بناء وتشييد.',
    riskWeight: 1.3,
    fields: [
      { name: 'monthlyCapacity', label: 'الطاقة الإنتاجية الشهرية (وحدة)', type: 'number', default: 50000 },
      { name: 'unitPrice', label: 'سعر بيع الوحدة (ر.س)', type: 'number', default: 25 },
      { name: 'rawMaterialCostPerUnit', label: 'تكلفة المواد الخام للوحدة (ر.س)', type: 'number', default: 12 },
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', default: 6000000 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', default: 130000 },
      { name: 'monthlyUtilities', label: 'الكهرباء والماء والخدمات الشهرية (ر.س)', type: 'number', default: 70000 }
    ]
  },
  {
    id: 'furniture-factory',
    icon: '🛋️',
    title: 'حاسبة مصنع أثاث',
    desc: 'حلل جدوى مصنع أثاث منزلي ومكتبي.',
    riskWeight: 1.2,
    fields: [
      { name: 'monthlyCapacity', label: 'الطاقة الإنتاجية الشهرية (قطعة)', type: 'number', default: 800 },
      { name: 'unitPrice', label: 'سعر بيع القطعة (ر.س)', type: 'number', default: 2500 },
      { name: 'rawMaterialCostPerUnit', label: 'تكلفة المواد الخام للقطعة (ر.س)', type: 'number', default: 1100 },
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', default: 2800000 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', default: 85000 },
      { name: 'monthlyUtilities', label: 'الكهرباء والماء والخدمات الشهرية (ر.س)', type: 'number', default: 25000 }
    ]
  },
  {
    id: 'textiles-factory',
    icon: '🧵',
    title: 'حاسبة مصنع منسوجات',
    desc: 'قيّم جدوى مصنع منسوجات وأقمشة.',
    riskWeight: 1.3,
    fields: [
      { name: 'monthlyCapacity', label: 'الطاقة الإنتاجية الشهرية (متر)', type: 'number', default: 30000 },
      { name: 'pricePerMeter', label: 'سعر البيع للمتر (ر.س)', type: 'number', default: 35 },
      { name: 'rawMaterialCostPerMeter', label: 'تكلفة المواد الخام للمتر (ر.س)', type: 'number', default: 16 },
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', default: 5000000 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', default: 120000 },
      { name: 'monthlyUtilities', label: 'الكهرباء والماء والخدمات الشهرية (ر.س)', type: 'number', default: 45000 }
    ]
  },
  {
    id: 'chemicals-factory',
    icon: '⚗️',
    title: 'حاسبة مصنع كيماويات',
    desc: 'حلل جدوى مصنع منتجات كيماوية.',
    riskWeight: 1.5,
    fields: [
      { name: 'monthlyCapacity', label: 'الطاقة الإنتاجية الشهرية (لتر)', type: 'number', default: 15000 },
      { name: 'pricePerLiter', label: 'سعر البيع للتر (ر.س)', type: 'number', default: 45 },
      { name: 'rawMaterialCostPerLiter', label: 'تكلفة المواد الخام للتر (ر.س)', type: 'number', default: 20 },
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', default: 8000000 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', default: 180000 },
      { name: 'monthlyUtilities', label: 'الكهرباء والماء والخدمات الشهرية (ر.س)', type: 'number', default: 90000 }
    ]
  },
  {
    id: 'packaging-factory',
    icon: '📦',
    title: 'حاسبة مصنع تعبئة وتغليف',
    desc: 'قيّم جدوى مصنع تعبئة وتغليف.',
    riskWeight: 1.2,
    fields: [
      { name: 'monthlyCapacity', label: 'الطاقة الإنتاجية الشهرية (وحدة)', type: 'number', default: 100000 },
      { name: 'unitPrice', label: 'سعر بيع الوحدة (ر.س)', type: 'number', default: 3 },
      { name: 'rawMaterialCostPerUnit', label: 'تكلفة المواد الخام للوحدة (ر.س)', type: 'number', default: 1.2 },
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', default: 3200000 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', default: 80000 },
      { name: 'monthlyUtilities', label: 'الكهرباء والماء والخدمات الشهرية (ر.س)', type: 'number', default: 30000 }
    ]
  },
  {
    id: 'construction-profitability',
    icon: '🏗️',
    title: 'حاسبة ربحية مشروع مقاولات',
    desc: 'حلل ربحية مشروع مقاولات من خلال تكاليف المواد والعمالة والمصاريف العمومية.',
    riskWeight: 1.3,
    fields: [
      { name: 'projectValue', label: 'قيمة العقد (ر.س)', type: 'number', default: 5000000 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 18 },
      { name: 'materialCostRate', label: 'نسبة تكلفة المواد (%)', type: 'number', default: 40 },
      { name: 'laborCostRate', label: 'نسبة تكلفة العمالة (%)', type: 'number', default: 25 },
      { name: 'subcontractorCostRate', label: 'نسبة تكلفة الباطن (%)', type: 'number', default: 15 },
      { name: 'overheadRate', label: 'نسبة المصاريف العمومية (%)', type: 'number', default: 8 }
    ]
  },
  {
    id: 'tender-pricing',
    icon: '📋',
    title: 'حاسبة تسعير المناقصات',
    desc: 'قم بتسعير المناقصات بدقة مع احتساب التكاليف المباشرة وغير المباشرة وهامش الربح.',
    riskWeight: 1.2,
    fields: [
      { name: 'directMaterialCost', label: 'تكلفة المواد المباشرة (ر.س)', type: 'number', default: 1200000 },
      { name: 'directLaborCost', label: 'تكلفة العمالة المباشرة (ر.س)', type: 'number', default: 800000 },
      { name: 'equipmentCost', label: 'تكلفة المعدات (ر.س)', type: 'number', default: 400000 },
      { name: 'indirectCostRate', label: 'نسبة التكاليف غير المباشرة (%)', type: 'number', default: 12 },
      { name: 'profitMargin', label: 'هامش الربح المستهدف (%)', type: 'number', default: 15 },
      { name: 'contingencyRate', label: 'نسبة الاحتياطي (%)', type: 'number', default: 5 }
    ]
  },
  {
    id: 'contractor-cashflow',
    icon: '💵',
    title: 'حاسبة التدفق النقدي للمقاولين',
    desc: 'توقع التدفق النقدي الشهري لمشروع مقاولات مع الدفعة المقدمة والاستقطاع والمصاريف.',
    riskWeight: 1.2,
    fields: [
      { name: 'projectValue', label: 'قيمة العقد (ر.س)', type: 'number', default: 4000000 },
      { name: 'projectMonths', label: 'مدة المشروع (شهر)', type: 'number', default: 12 },
      { name: 'advancePaymentRate', label: 'نسبة الدفعة المقدمة (%)', type: 'number', default: 10 },
      { name: 'retentionRate', label: 'نسبة الاستقطاع (%)', type: 'number', default: 5 },
      { name: 'monthlyProgressRate', label: 'نسبة الإنجاز الشهري (%)', type: 'number', default: 8 },
      { name: 'monthlyExpenses', label: 'المصاريف الشهرية (ر.س)', type: 'number', default: 250000 }
    ]
  },
  {
    id: 'concrete-structure-cost',
    icon: '🧱',
    title: 'حاسبة تكلفة الهيكل الخرساني',
    desc: 'احسب تكلفة الهيكل الإنشائي للمبنى حسب المساحة والمواد والعمالة.',
    riskWeight: 1.1,
    fields: [
      { name: 'builtUpArea', label: 'المساحة المبنية (م²)', type: 'number', default: 1000 },
      { name: 'concreteCostPerM2', label: 'تكلفة الخرسانة للمتر المربع (ر.س)', type: 'number', default: 350 },
      { name: 'steelCostPerM2', label: 'تكلفة الحديد للمتر المربع (ر.س)', type: 'number', default: 280 },
      { name: 'formworkCostPerM2', label: 'تكلفة الشدة للمتر المربع (ر.س)', type: 'number', default: 150 },
      { name: 'laborCostPerM2', label: 'تكلفة العمالة للمتر المربع (ر.س)', type: 'number', default: 220 },
      { name: 'finishingCostPerM2', label: 'تكلفة أعمال التشطيب الأساسية للمتر المربع (ر.س)', type: 'number', default: 200 }
    ]
  },
  {
    id: 'finishing-cost',
    icon: '🎨',
    title: 'حاسبة تكلفة التشطيب',
    desc: 'قدر تكلفة تشطيب الوحدات السكنية أو التجارية.',
    riskWeight: 1.1,
    fields: [
      { name: 'finishingArea', label: 'مساحة التشطيب (م²)', type: 'number', default: 500 },
      { name: 'flooringCostPerM2', label: 'تكلفة الأرضيات للمتر المربع (ر.س)', type: 'number', default: 180 },
      { name: 'paintingCostPerM2', label: 'تكلفة الدهان للمتر المربع (ر.س)', type: 'number', default: 60 },
      { name: 'electricalCostPerM2', label: 'تكلفة الكهرباء للمتر المربع (ر.س)', type: 'number', default: 120 },
      { name: 'plumbingCostPerM2', label: 'تكلفة السباكة للمتر المربع (ر.س)', type: 'number', default: 100 },
      { name: 'acCostPerM2', label: 'تكلفة التكييف للمتر المربع (ر.س)', type: 'number', default: 150 }
    ]
  },
  {
    id: 'distressed-project-evaluation',
    icon: '⚠️',
    title: 'حاسبة تقييم مشروع متعثر',
    desc: 'قيّم جدوى استكمال مشروع مقاولات متعثر وبيعه.',
    riskWeight: 1.4,
    fields: [
      { name: 'currentCompletionRate', label: 'نسبة الإنجاز الحالية (%)', type: 'number', default: 45 },
      { name: 'estimatedCompletionCost', label: 'تكلفة استكمال المشروع (ر.س)', type: 'number', default: 2000000 },
      { name: 'marketValueIfCompleted', label: 'القيمة السوقية بعد الاستكمال (ر.س)', type: 'number', default: 6000000 },
      { name: 'existingLiabilities', label: 'الالتزامات المالية الحالية (ر.س)', type: 'number', default: 1000000 },
      { name: 'legalCost', label: 'تكلفة الإجراءات القانونية (ر.س)', type: 'number', default: 150000 },
      { name: 'completionMonths', label: 'مدة الاستكمال (شهر)', type: 'number', default: 12 }
    ]
  },
  {
    id: 'restaurant',
    icon: '🍽️',
    title: 'حاسبة مطعم',
    desc: 'حلل جدوى إنشاء مطعم جديد.',
    riskWeight: 1.2,
    fields: [
      { name: 'numberOfTables', label: 'عدد الطاولات', type: 'number', default: 25 },
      { name: 'avgDailyCustomers', label: 'عدد العملاء اليومي', type: 'number', default: 150 },
      { name: 'avgTicketValue', label: 'متوسط قيمة الفاتورة (ر.س)', type: 'number', default: 120 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 650000 },
      { name: 'foodCostRate', label: 'نسبة تكلفة الطعام (%)', type: 'number', default: 32 },
      { name: 'monthlyRentSalaries', label: 'الإيجار + الرواتب الشهرية (ر.س)', type: 'number', default: 50000 }
    ]
  },
  {
    id: 'coffee-shop',
    icon: '☕',
    title: 'حاسبة كوفي شوب',
    desc: 'قيّم جدوى افتتاح كوفي شوب.',
    riskWeight: 1.1,
    fields: [
      { name: 'numberOfSeats', label: 'عدد المقاعد', type: 'number', default: 30 },
      { name: 'avgDailyCustomers', label: 'عدد العملاء اليومي', type: 'number', default: 200 },
      { name: 'avgTicketValue', label: 'متوسط قيمة الفاتورة (ر.س)', type: 'number', default: 35 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 350000 },
      { name: 'foodCostRate', label: 'نسبة تكلفة المواد (%)', type: 'number', default: 28 },
      { name: 'monthlyRentSalaries', label: 'الإيجار + الرواتب الشهرية (ر.س)', type: 'number', default: 28000 }
    ]
  },
  {
    id: 'cloud-kitchen',
    icon: '☁️',
    title: 'حاسبة مطبخ سحابي',
    desc: 'حلل جدوى مطبخ سحابي للتوصيل.',
    riskWeight: 1.2,
    fields: [
      { name: 'dailyOrders', label: 'عدد الطلبات اليومية', type: 'number', default: 120 },
      { name: 'avgTicketValue', label: 'متوسط قيمة الطلب (ر.س)', type: 'number', default: 55 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 250000 },
      { name: 'platformCommissionRate', label: 'نسبة عمولة المنصات (%)', type: 'number', default: 25 },
      { name: 'foodCostRate', label: 'نسبة تكلفة الطعام (%)', type: 'number', default: 35 },
      { name: 'monthlyRentSalaries', label: 'الإيجار + الرواتب الشهرية (ر.س)', type: 'number', default: 32000 }
    ]
  },
  {
    id: 'food-truck',
    icon: '🚚',
    title: 'حاسبة فود ترك',
    desc: 'قيّم جدوى مشروع فود ترك متنقل.',
    riskWeight: 1.1,
    fields: [
      { name: 'dailyCustomers', label: 'عدد العملاء اليومي', type: 'number', default: 100 },
      { name: 'avgTicketValue', label: 'متوسط قيمة الفاتورة (ر.س)', type: 'number', default: 45 },
      { name: 'truckCost', label: 'تكلفة العربة والتجهيز (ر.س)', type: 'number', default: 180000 },
      { name: 'permitsCost', label: 'تكلفة التراخيص والتأمين (ر.س)', type: 'number', default: 50000 },
      { name: 'foodCostRate', label: 'نسبة تكلفة الطعام (%)', type: 'number', default: 30 },
      { name: 'monthlyFuelMaintenance', label: 'الوقود والصيانة الشهرية (ر.س)', type: 'number', default: 8000 }
    ]
  },
  {
    id: 'fast-food-restaurant',
    icon: '🍔',
    title: 'حاسبة مطعم وجبات سريعة',
    desc: 'حلل جدوى مطعم وجبات سريعة.',
    riskWeight: 1.1,
    fields: [
      { name: 'dailyCustomers', label: 'عدد العملاء اليومي', type: 'number', default: 300 },
      { name: 'avgTicketValue', label: 'متوسط قيمة الفاتورة (ر.س)', type: 'number', default: 40 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 900000 },
      { name: 'foodCostRate', label: 'نسبة تكلفة الطعام (%)', type: 'number', default: 30 },
      { name: 'monthlyRentSalaries', label: 'الإيجار + الرواتب الشهرية (ر.س)', type: 'number', default: 65000 },
      { name: 'numberOfEmployees', label: 'عدد الموظفين', type: 'number', default: 12 }
    ]
  },
  {
    id: 'fine-dining-restaurant',
    icon: '🍷',
    title: 'حاسبة مطعم فاخر',
    desc: 'قيّم جدوى مطعم فاخر وخدمة راقية.',
    riskWeight: 1.3,
    fields: [
      { name: 'numberOfTables', label: 'عدد الطاولات', type: 'number', default: 20 },
      { name: 'avgDailyCustomers', label: 'عدد العملاء اليومي', type: 'number', default: 80 },
      { name: 'avgTicketValue', label: 'متوسط قيمة الفاتورة (ر.س)', type: 'number', default: 350 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 1800000 },
      { name: 'foodCostRate', label: 'نسبة تكلفة الطعام (%)', type: 'number', default: 35 },
      { name: 'monthlyRentSalaries', label: 'الإيجار + الرواتب الشهرية (ر.س)', type: 'number', default: 95000 }
    ]
  },
  {
    id: 'private-school',
    icon: '🏫',
    title: 'حاسبة مدرسة أهلية',
    desc: 'حلل جدوى إنشاء مدرسة أهلية أو خاصة.',
    riskWeight: 1.1,
    fields: [
      { name: 'numberOfStudents', label: 'عدد الطلاب', type: 'number', default: 300 },
      { name: 'annualFee', label: 'الرسوم السنوية للطالب (ر.س)', type: 'number', default: 18000 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 4000000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 220000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 50000 },
      { name: 'operatingCostRate', label: 'نسبة التشغيل من الإيرادات (%)', type: 'number', default: 18 }
    ]
  },
  {
    id: 'nursery',
    icon: '🧸',
    title: 'حاسبة حضانة',
    desc: 'قيّم جدوى افتتاح حضانة أطفال.',
    riskWeight: 1.0,
    fields: [
      { name: 'numberOfChildren', label: 'عدد الأطفال', type: 'number', default: 60 },
      { name: 'monthlyFee', label: 'الرسوم الشهرية للطفل (ر.س)', type: 'number', default: 1800 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 450000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 28000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 15000 },
      { name: 'operatingCostRate', label: 'نسبة التشغيل من الإيرادات (%)', type: 'number', default: 20 }
    ]
  },
  {
    id: 'private-university',
    icon: '🎓',
    title: 'حاسبة جامعة خاصة',
    desc: 'حلل جدوى إنشاء جامعة خاصة.',
    riskWeight: 1.4,
    fields: [
      { name: 'numberOfStudents', label: 'عدد الطلاب', type: 'number', default: 2000 },
      { name: 'annualFee', label: 'الرسوم السنوية للطالب (ر.س)', type: 'number', default: 45000 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 50000000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 1200000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 300000 },
      { name: 'operatingCostRate', label: 'نسبة التشغيل من الإيرادات (%)', type: 'number', default: 25 }
    ]
  },
  {
    id: 'training-center',
    icon: '📚',
    title: 'حاسبة مركز تدريب',
    desc: 'قيّم جدوى مركز تدريب مهني أو أكاديمي.',
    riskWeight: 1.1,
    fields: [
      { name: 'monthlyTrainees', label: 'عدد المتدربين الشهري', type: 'number', default: 120 },
      { name: 'courseFee', label: 'رسوم الدورة للمتدرب (ر.س)', type: 'number', default: 2500 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 800000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 45000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 20000 },
      { name: 'operatingCostRate', label: 'نسبة التشغيل من الإيرادات (%)', type: 'number', default: 22 }
    ]
  },
  {
    id: 'e-learning-platform',
    icon: '💻',
    title: 'حاسبة منصة تعليم إلكتروني',
    desc: 'حلل جدوى منصة تعليمية إلكترونية.',
    riskWeight: 1.2,
    fields: [
      { name: 'numberOfSubscribers', label: 'عدد المشتركين', type: 'number', default: 1000 },
      { name: 'monthlySubscription', label: 'الاشتراك الشهري (ر.س)', type: 'number', default: 120 },
      { name: 'developmentCost', label: 'تكلفة تطوير المنصة (ر.س)', type: 'number', default: 600000 },
      { name: 'monthlyMarketing', label: 'الميزانية الشهرية للتسويق (ر.س)', type: 'number', default: 25000 },
      { name: 'monthlyServers', label: 'تكلفة السيرفرات والأدوات (ر.س)', type: 'number', default: 8000 },
      { name: 'contentCostRate', label: 'نسبة تكلفة المحتوى من الإيرادات (%)', type: 'number', default: 15 }
    ]
  },
  {
    id: 'hotel',
    icon: '🏨',
    title: 'حاسبة فندق',
    desc: 'حلل جدوى إنشاء فندق جديد.',
    riskWeight: 1.3,
    fields: [
      { name: 'numberOfRooms', label: 'عدد الغرف', type: 'number', default: 80 },
      { name: 'occupancyRate', label: 'نسبة الإشغال المتوقعة (%)', type: 'number', default: 65 },
      { name: 'avgDailyRate', label: 'متوسط السعر اليومي (ر.س)', type: 'number', default: 500 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأثيث (ر.س)', type: 'number', default: 12000000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 180000 },
      { name: 'monthlyUtilities', label: 'الخدمات والصيانة الشهرية (ر.س)', type: 'number', default: 70000 }
    ]
  },
  {
    id: 'tourist-resort',
    icon: '🏖️',
    title: 'حاسبة منتجع سياحي',
    desc: 'قيّم جدوى إنشاء منتجع سياحي متكامل.',
    riskWeight: 1.4,
    fields: [
      { name: 'numberOfUnits', label: 'عدد الوحدات/الشاليهات', type: 'number', default: 40 },
      { name: 'occupancyRate', label: 'نسبة الإشغال المتوقعة (%)', type: 'number', default: 55 },
      { name: 'avgDailyRate', label: 'متوسط السعر اليومي (ر.س)', type: 'number', default: 1200 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأثيث (ر.س)', type: 'number', default: 25000000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 250000 },
      { name: 'monthlyUtilities', label: 'الخدمات والصيانة الشهرية (ر.س)', type: 'number', default: 120000 }
    ]
  },
  {
    id: 'tourist-camp',
    icon: '⛺',
    title: 'حاسبة مخيم سياحي',
    desc: 'حلل جدوى إنشاء مخيم سياحي متنقل أو ثابت.',
    riskWeight: 1.1,
    fields: [
      { name: 'numberOfTents', label: 'عدد الخيام/الوحدات', type: 'number', default: 25 },
      { name: 'occupancyRate', label: 'نسبة الإشغال المتوقعة (%)', type: 'number', default: 60 },
      { name: 'avgDailyRate', label: 'متوسط السعر اليومي (ر.س)', type: 'number', default: 350 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 800000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 22000 },
      { name: 'monthlyUtilities', label: 'الخدمات والصيانة الشهرية (ر.س)', type: 'number', default: 10000 }
    ]
  },
  {
    id: 'tourism-company',
    icon: '✈️',
    title: 'حاسبة شركة سياحة',
    desc: 'قيّم جدوى شركة سياحة وسفر.',
    riskWeight: 1.1,
    fields: [
      { name: 'monthlyPackages', label: 'عدد الباقات الشهرية', type: 'number', default: 200 },
      { name: 'avgPackagePrice', label: 'متوسط سعر الباقة (ر.س)', type: 'number', default: 4500 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 350000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 35000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 12000 },
      { name: 'commissionCostRate', label: 'نسبة تكلفة الباقة من الإيرادات (%)', type: 'number', default: 70 }
    ]
  },
  {
    id: 'shipping-company',
    icon: '🚢',
    title: 'حاسبة شركة شحن',
    desc: 'حلل جدوى شركة شحن محلي أو دولي.',
    riskWeight: 1.2,
    fields: [
      { name: 'monthlyShipments', label: 'عدد الشحنات الشهرية', type: 'number', default: 1500 },
      { name: 'revenuePerShipment', label: 'إيراد الشحنة (ر.س)', type: 'number', default: 180 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 1200000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 75000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 25000 },
      { name: 'operatingCostRate', label: 'نسبة التشغيل من الإيرادات (%)', type: 'number', default: 55 }
    ]
  },
  {
    id: 'transport-fleet',
    icon: '🚛',
    title: 'حاسبة أسطول نقل',
    desc: 'قيّم جدوى امتلاك وتشغيل أسطول نقل.',
    riskWeight: 1.2,
    fields: [
      { name: 'numberOfVehicles', label: 'عدد المركبات', type: 'number', default: 15 },
      { name: 'monthlyTripsPerVehicle', label: 'عدد الرحلات الشهرية للمركبة', type: 'number', default: 80 },
      { name: 'revenuePerTrip', label: 'إيراد الرحلة (ر.س)', type: 'number', default: 600 },
      { name: 'vehicleCost', label: 'تكلفة شراء المركبات (ر.س)', type: 'number', default: 2500000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 60000 },
      { name: 'fuelMaintenancePerTrip', label: 'وقود وصيانة لكل رحلة (ر.س)', type: 'number', default: 180 }
    ]
  },
  {
    id: 'distribution-center',
    icon: '🏭',
    title: 'حاسبة مركز توزيع',
    desc: 'حلل جدوى مركز توزيع وفرز للطلبات.',
    riskWeight: 1.3,
    fields: [
      { name: 'monthlyOrders', label: 'عدد الطلبات الشهرية', type: 'number', default: 50000 },
      { name: 'revenuePerOrder', label: 'إيراد الطلب (ر.س)', type: 'number', default: 8 },
      { name: 'setupCost', label: 'تكلفة التجهيز والتأسيس (ر.س)', type: 'number', default: 3500000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 110000 },
      { name: 'monthlyRent', label: 'الإيجار الشهري (ر.س)', type: 'number', default: 45000 },
      { name: 'operatingCostRate', label: 'نسبة التشغيل من الإيرادات (%)', type: 'number', default: 50 }
    ]
  },
  {
    id: 'last-mile-delivery',
    icon: '🛵',
    title: 'حاسبة خدمات الميل الأخير',
    desc: 'قيّم جدوى خدمة توصيل الطلبات للميل الأخير.',
    riskWeight: 1.2,
    fields: [
      { name: 'dailyDeliveries', label: 'عدد التوصيلات اليومية', type: 'number', default: 400 },
      { name: 'revenuePerDelivery', label: 'إيراد التوصيلة (ر.س)', type: 'number', default: 22 },
      { name: 'vehicleCost', label: 'تكلفة المركبات (ر.س)', type: 'number', default: 300000 },
      { name: 'monthlySalaries', label: 'الرواتب الشهرية (ر.س)', type: 'number', default: 40000 },
      { name: 'monthlyFuelMaintenance', label: 'الوقود والصيانة الشهرية (ر.س)', type: 'number', default: 15000 },
      { name: 'operatingCostRate', label: 'نسبة التشغيل من الإيرادات (%)', type: 'number', default: 40 }
    ]
  }
];

const sectorsEn = sectorsAr.map(s => ({ ...s }));

const sectorEnTitles = {
  medical: 'Medical Investment Calculator',
  industrial: 'Industrial Investment Calculator',
  'real-estate': 'Real Estate Investment Calculator',
  commercial: 'Commercial Investment Calculator',
  tourism: 'Tourism Investment Calculator',
  education: 'Education Investment Calculator',
  logistics: 'Logistics Investment Calculator',
  agriculture: 'Agriculture Investment Calculator',
  technology: 'Technology Investment Calculator',
  restaurants: 'Restaurant & Café Investment Calculator',
  retail: 'Retail Investment Calculator',
  construction: 'Construction Investment Calculator',
  hospital: 'Hospital Feasibility Calculator',
  'medical-complex': 'Medical Complex Feasibility Calculator',
  'dental-clinic': 'Dental Clinic Feasibility Calculator',
  'radiology-center': 'Radiology Center Feasibility Calculator',
  'medical-lab': 'Medical Laboratory Feasibility Calculator',
  'physiotherapy-center': 'Physiotherapy Center Feasibility Calculator',
  pharmacy: 'Pharmacy Feasibility Calculator',
  'optical-center': 'Optical Center Feasibility Calculator',
  'land-development': 'Land Development Calculator',
  'villa-construction': 'Villa Construction Calculator',
  'residential-building': 'Residential Building Calculator',
  'commercial-complex': 'Commercial Complex Calculator',
  'commercial-mall': 'Commercial Mall Calculator',
  'hotel-apartments': 'Hotel Apartments Calculator',
  warehouses: 'Warehouses Calculator',
  'property-rehabilitation': 'Distressed Property Rehabilitation Calculator',
  'buy-to-rent': 'Buy-to-Rent Property Calculator',
  'quick-real-estate': 'Quick Real Estate Investment Calculator',
  'food-factory': 'Food Factory Calculator',
  'water-factory': 'Water Factory Calculator',
  'plastic-factory': 'Plastic Factory Calculator',
  'building-materials-factory': 'Building Materials Factory Calculator',
  'furniture-factory': 'Furniture Factory Calculator',
  'textiles-factory': 'Textiles Factory Calculator',
  'chemicals-factory': 'Chemicals Factory Calculator',
  'packaging-factory': 'Packaging Factory Calculator',
  'construction-profitability': 'Construction Project Profitability Calculator',
  'tender-pricing': 'Tender Pricing Calculator',
  'contractor-cashflow': 'Contractor Cash Flow Calculator',
  'concrete-structure-cost': 'Concrete Structure Cost Calculator',
  'finishing-cost': 'Finishing Cost Calculator',
  'distressed-project-evaluation': 'Distressed Project Evaluation Calculator',
  restaurant: 'Restaurant Calculator',
  'coffee-shop': 'Coffee Shop Calculator',
  'cloud-kitchen': 'Cloud Kitchen Calculator',
  'food-truck': 'Food Truck Calculator',
  'fast-food-restaurant': 'Fast Food Restaurant Calculator',
  'fine-dining-restaurant': 'Fine Dining Restaurant Calculator',
  'private-school': 'Private School Calculator',
  nursery: 'Nursery Calculator',
  'private-university': 'Private University Calculator',
  'training-center': 'Training Center Calculator',
  'e-learning-platform': 'E-Learning Platform Calculator',
  hotel: 'Hotel Calculator',
  'tourist-resort': 'Tourist Resort Calculator',
  'tourist-camp': 'Tourist Camp Calculator',
  'tourism-company': 'Tourism Company Calculator',
  'shipping-company': 'Shipping Company Calculator',
  'transport-fleet': 'Transport Fleet Calculator',
  'distribution-center': 'Distribution Center Calculator',
  'last-mile-delivery': 'Last-Mile Delivery Calculator'
};

const sectorEnDescs = {
  medical: 'Analyze the feasibility of establishing a clinic, hospital, pharmacy, or medical laboratory.',
  industrial: 'Evaluate the feasibility of establishing a factory or production facility.',
  'real-estate': 'Analyze the return on a residential or commercial real estate investment.',
  commercial: 'Evaluate the feasibility of a trading agency or import/export project.',
  tourism: 'Analyze the feasibility of a hotel, furnished apartments, or tourism service.',
  education: 'Evaluate the feasibility of a school, training center, or educational platform.',
  logistics: 'Analyze the feasibility of a transport, storage, or delivery company.',
  agriculture: 'Evaluate the feasibility of a farm or food production project.',
  technology: 'Analyze the feasibility of a software company, app, or SaaS platform.',
  restaurants: 'Evaluate the feasibility of a new restaurant or café.',
  retail: 'Analyze the feasibility of a retail store, supermarket, or e-commerce shop.',
  construction: 'Evaluate the feasibility of a contracting or construction project.',
  hospital: 'Analyze the feasibility of establishing a multi-department hospital.',
  'medical-complex': 'Evaluate the feasibility of a medical complex with multiple specialties.',
  'dental-clinic': 'Analyze the feasibility of establishing a specialized dental clinic.',
  'radiology-center': 'Evaluate the feasibility of a diagnostic radiology and medical imaging center.',
  'medical-lab': 'Analyze the feasibility of establishing a medical laboratory.',
  'physiotherapy-center': 'Evaluate the feasibility of a physiotherapy and rehabilitation center.',
  pharmacy: 'Analyze the feasibility of establishing a new pharmacy.',
  'optical-center': 'Evaluate the feasibility of an optical shop and prescription lenses store.',
  'land-development': 'Analyze the feasibility of developing residential or commercial land.',
  'villa-construction': 'Evaluate the feasibility of building and selling residential villas.',
  'residential-building': 'Analyze the feasibility of building a residential apartment building for sale.',
  'commercial-complex': 'Evaluate the feasibility of building a commercial complex for rent.',
  'commercial-mall': 'Analyze the feasibility of building a large commercial mall.',
  'hotel-apartments': 'Evaluate the feasibility of building furnished hotel apartments.',
  warehouses: 'Analyze the feasibility of building warehouses for rent.',
  'property-rehabilitation': 'Evaluate the feasibility of buying and rehabilitating a distressed property for sale.',
  'buy-to-rent': 'Analyze the return on buying a ready property and renting it out.',
  'quick-real-estate': 'Quick evaluation of real estate investment return.',
  'food-factory': 'Analyze the feasibility of establishing a food products factory.',
  'water-factory': 'Evaluate the feasibility of a drinking water bottling factory.',
  'plastic-factory': 'Analyze the feasibility of establishing a plastic products factory.',
  'building-materials-factory': 'Evaluate the feasibility of a construction materials factory.',
  'furniture-factory': 'Analyze the feasibility of a home and office furniture factory.',
  'textiles-factory': 'Evaluate the feasibility of a textiles and fabrics factory.',
  'chemicals-factory': 'Analyze the feasibility of a chemical products factory.',
  'packaging-factory': 'Evaluate the feasibility of a packaging factory.',
  'construction-profitability': 'Analyze the profitability of a contracting project.',
  'tender-pricing': 'Price tenders accurately including direct costs, indirect costs, and profit margin.',
  'contractor-cashflow': 'Forecast monthly cash flow for a contracting project.',
  'concrete-structure-cost': 'Calculate the cost of a building concrete structure per area.',
  'finishing-cost': 'Estimate residential or commercial finishing costs.',
  'distressed-project-evaluation': 'Evaluate the feasibility of completing and selling a distressed project.',
  restaurant: 'Analyze the feasibility of opening a new restaurant.',
  'coffee-shop': 'Evaluate the feasibility of opening a coffee shop.',
  'cloud-kitchen': 'Analyze the feasibility of a delivery-only cloud kitchen.',
  'food-truck': 'Evaluate the feasibility of a mobile food truck.',
  'fast-food-restaurant': 'Analyze the feasibility of a fast food restaurant.',
  'fine-dining-restaurant': 'Evaluate the feasibility of a fine dining restaurant.',
  'private-school': 'Analyze the feasibility of establishing a private school.',
  nursery: 'Evaluate the feasibility of opening a nursery.',
  'private-university': 'Analyze the feasibility of establishing a private university.',
  'training-center': 'Evaluate the feasibility of a vocational or academic training center.',
  'e-learning-platform': 'Analyze the feasibility of an e-learning platform.',
  hotel: 'Analyze the feasibility of establishing a hotel.',
  'tourist-resort': 'Evaluate the feasibility of a comprehensive tourist resort.',
  'tourist-camp': 'Analyze the feasibility of a fixed or mobile tourist camp.',
  'tourism-company': 'Evaluate the feasibility of a travel and tourism company.',
  'shipping-company': 'Analyze the feasibility of a local or international shipping company.',
  'transport-fleet': 'Evaluate the feasibility of owning and operating a transport fleet.',
  'distribution-center': 'Analyze the feasibility of an order sorting and distribution center.',
  'last-mile-delivery': 'Evaluate the feasibility of a last-mile delivery service.'
};

const labelTranslations = {
  'عدد الأسرّة / العيادات / الفروع': 'Number of beds / clinics / branches',
  'متوسط الإيراد اليومي (ر.س)': 'Average daily revenue (SAR)',
  'تكلفة التجهيزات والأDevices (ر.س)': 'Equipment & devices cost (SAR)',
  'الرواتب الشهرية للكوادر الطبية (ر.س)': 'Monthly medical staff salaries (SAR)',
  'الإيجار الشهري والخدمات (ر.س)': 'Monthly rent & utilities (SAR)',
  'نسبة تكلفة المواد الطبية من الإيرادات (%)': 'Medical supplies cost ratio (%)',
  'تكلفة المصنع والآلات (ر.س)': 'Factory & machinery cost (SAR)',
  'الطاقة الإنتاجية الشهرية (وحدة)': 'Monthly production capacity (units)',
  'سعر بيع الوحدة (ر.س)': 'Unit selling price (SAR)',
  'تكلفة المواد الخام للوحدة (ر.س)': 'Raw material cost per unit (SAR)',
  'الرواتب والعمالة الشهرية (ر.س)': 'Monthly salaries & labor (SAR)',
  'الكهرباء والماء والخدمات الشهرية (ر.س)': 'Monthly electricity, water & utilities (SAR)',
  'قيمة الأرض (ر.س)': 'Land value (SAR)',
  'تكلفة البناء والتشطيب (ر.س)': 'Construction & finishing cost (SAR)',
  'عدد الوحدات': 'Number of units',
  'سعر البيع / الإيجار السنوي للوحدة (ر.س)': 'Unit sale / annual rent price (SAR)',
  'مدة المشروع (شهر)': 'Project duration (months)',
  'المصاريف الشهرية للمشروع (ر.س)': 'Monthly project expenses (SAR)',
  'تكلفة المخزون الأولي (ر.س)': 'Initial inventory cost (SAR)',
  'المبيعات الشهرية المتوقعة (ر.س)': 'Expected monthly sales (SAR)',
  'هامش الربح الإجمالي (%)': 'Gross profit margin (%)',
  'الإيجار والمرافق الشهرية (ر.س)': 'Monthly rent & facilities (SAR)',
  'الرواتب الشهرية (ر.س)': 'Monthly salaries (SAR)',
  'التسويق والتشغيل الشهري (ر.س)': 'Monthly marketing & operations (SAR)',
  'عدد الغرف / الشقق / المقاعد': 'Number of rooms / apartments / seats',
  'نسبة الإشغال المتوقعة (%)': 'Expected occupancy rate (%)',
  'متوسط السعر اليومي (ر.س)': 'Average daily rate (SAR)',
  'تكلفة التجهيز والتأثيث (ر.س)': 'Setup & furnishing cost (SAR)',
  'الخدمات والصيانة الشهرية (ر.س)': 'Monthly services & maintenance (SAR)',
  'الطاقة الاستيعابية (طالب/متدرب)': 'Capacity (students/trainees)',
  'نسبة التسجيل المتوقعة (%)': 'Expected enrollment rate (%)',
  'الرسوم الشهرية للفرد (ر.س)': 'Monthly fee per person (SAR)',
  'تكلفة التجهيز والتأسيس (ر.س)': 'Setup & establishment cost (SAR)',
  'رواتب المعلمين والإداريين (ر.س)': 'Teachers & admin salaries (SAR)',
  'الإيجار والخدمات الشهرية (ر.س)': 'Monthly rent & services (SAR)',
  'عدد المركبات': 'Number of vehicles',
  'عدد الرحلات الشهرية': 'Monthly trips',
  'الإيراد لكل رحلة (ر.س)': 'Revenue per trip (SAR)',
  'تكلفة شراء المركبات (ر.س)': 'Vehicle purchase cost (SAR)',
  'الوقود والصيانة لكل رحلة (ر.س)': 'Fuel & maintenance per trip (SAR)',
  'الرواتب والتشغيل الشهرية (ر.س)': 'Monthly salaries & operations (SAR)',
  'مساحة الأرض (هكتار)': 'Land area (hectares)',
  'الإنتاجية (كجم/هكتار/موسم)': 'Yield (kg/hectare/season)',
  'سعر البيع للكجم (ر.س)': 'Selling price per kg (SAR)',
  'تكلفة إعداد الأرض والبنية (ر.س)': 'Land preparation & infrastructure cost (SAR)',
  'تكلفة التشغيل للكجم (ر.س)': 'Operating cost per kg (SAR)',
  'عدد مواسم الحصاد سنويًا': 'Harvest seasons per year',
  'تكلفة التطوير الأولية (ر.س)': 'Initial development cost (SAR)',
  'عدد المشتركين المتوقعين': 'Expected number of subscribers',
  'سعر الاشتراك الشهري (ر.س)': 'Monthly subscription price (SAR)',
  'تكلفة السيرفرات والأدوات الشهرية (ر.س)': 'Monthly servers & tools cost (SAR)',
  'الميزانية الشهرية للتسويق (ر.س)': 'Monthly marketing budget (SAR)',
  'رواتب الفريق الشهرية (ر.س)': 'Monthly team salaries (SAR)',
  'عدد المقاعد / الطاولات': 'Number of seats / tables',
  'متوسط قيمة الفاتورة (ر.س)': 'Average ticket value (SAR)',
  'عدد العملاء اليومي المتوقع': 'Expected daily customers',
  'نسبة تكلفة الطعام (%)': 'Food cost ratio (%)',
  'الإيجار + الرواتب الشهرية (ر.س)': 'Rent + monthly salaries (SAR)',
  'مساحة المتجر (م²)': 'Store area (m²)',
  'المبيعات اليومية المتوقعة (ر.س)': 'Expected daily sales (SAR)',
  'الإيجار الشهري (ر.س)': 'Monthly rent (SAR)',
  'قيمة العقد الإجمالية (ر.س)': 'Total contract value (SAR)',
  'نسبة تكلفة المواد (%)': 'Material cost ratio (%)',
  'نسبة تكلفة العمالة (%)': 'Labor cost ratio (%)',
  'نسبة المصاريف العمومية (%)': 'Overhead cost ratio (%)',
  'تكلفة المعدات الأولية (ر.س)': 'Initial equipment cost (SAR)',
  'عدد الأسرّة': 'Number of beds',
  'متوسط الإيراد اليومي للسرير (ر.س)': 'Average daily revenue per bed (SAR)',
  'تكلفة البناء والتجهيزات (ر.س)': 'Construction & equipment cost (SAR)',
  'الرواتب الشهرية للكوادر (ر.س)': 'Monthly staff salaries (SAR)',
  'الخدمات والصيانة الشهرية (ر.س)': 'Monthly utilities & maintenance (SAR)',
  'نسبة المواد الطبية من الإيرادات (%)': 'Medical supplies ratio (%)',
  'عدد العيادات': 'Number of clinics',
  'متوسط الإيراد الشهري للعيادة (ر.س)': 'Average monthly revenue per clinic (SAR)',
  'نسبة التشغيل من الإيرادات (%)': 'Operating cost ratio (%)',
  'عدد كراسي العلاج': 'Number of dental chairs',
  'متوسط الإيراد اليومي للكرسي (ر.س)': 'Average daily revenue per chair (SAR)',
  'تكلفة التجهيزات (ر.س)': 'Equipment cost (SAR)',
  'نسبة مواد الأسنان من الإيرادات (%)': 'Dental materials ratio (%)',
  'عدد الأجهزة': 'Number of machines',
  'متوسط الإيراد اليومي للجهاز (ر.س)': 'Average daily revenue per machine (SAR)',
  'تكلفة الأجهزة والتجهيزات (ر.س)': 'Equipment & devices cost (SAR)',
  'نسبة مواد التباين من الإيرادات (%)': 'Contrast material ratio (%)',
  'متوسط عدد التحاليل اليومية': 'Average daily tests',
  'متوسط إيراد التحليل (ر.س)': 'Average revenue per test (SAR)',
  'نسبة الكواشف من الإيرادات (%)': 'Reagent cost ratio (%)',
  'عدد الجلسات اليومية': 'Daily sessions',
  'متوسط إيراد الجلسة (ر.س)': 'Average revenue per session (SAR)',
  'تكلفة أجهزة العلاج (ر.س)': 'Treatment equipment cost (SAR)',
  'نسبة المستهلكات من الإيرادات (%)': 'Disposable supplies ratio (%)',
  'متوسط المبيعات اليومية (ر.س)': 'Average daily sales (SAR)',
  'تكلفة الترخيص والتأمين (ر.س)': 'License & insurance cost (SAR)',
  'متوسط عدد المبيعات اليومية': 'Average daily sales count',
  'نسبة تكلفة العدسات من الإيرادات (%)': 'Lens cost ratio (%)',
  'مساحة الأرض (م²)': 'Land area (m²)',
  'سعر شراء المتر المربع (ر.س)': 'Land purchase price per m² (SAR)',
  'تكلفة التطوير للمتر المربع (ر.س)': 'Development cost per m² (SAR)',
  'سعر البيع للمتر المربع (ر.س)': 'Selling price per m² (SAR)',
  'عدد الفلل': 'Number of villas',
  'تكلفة الأرض (ر.س)': 'Land cost (SAR)',
  'تكلفة البناء للفيلا (ر.س)': 'Construction cost per villa (SAR)',
  'سعر بيع الفيلا (ر.س)': 'Selling price per villa (SAR)',
  'عدد الشقق': 'Number of apartments',
  'تكلفة البناء للشقة (ر.س)': 'Construction cost per apartment (SAR)',
  'سعر بيع الشقة (ر.س)': 'Selling price per apartment (SAR)',
  'عدد الوحدات التجارية': 'Number of commercial units',
  'تكلفة البناء للوحدة (ر.س)': 'Construction cost per unit (SAR)',
  'الإيجار السنوي للوحدة (ر.س)': 'Annual rent per unit (SAR)',
  'المساحة القابلة للإيجار (م²)': 'Rentable area (m²)',
  'تكلفة البناء للمتر المربع (ر.س)': 'Construction cost per m² (SAR)',
  'الإيجار السنوي للمتر المربع (ر.س)': 'Annual rent per m² (SAR)',
  'تكلفة التجهيز للشقة (ر.س)': 'Setup cost per apartment (SAR)',
  'مساحة المستودع (م²)': 'Warehouse area (m²)',
  'سعر شراء العقار (ر.س)': 'Property purchase price (SAR)',
  'تكلفة إعادة التأهيل (ر.س)': 'Rehabilitation cost (SAR)',
  'سعر البيع المتوقع (ر.س)': 'Expected selling price (SAR)',
  'نسبة تكلفة الاحتفاظ من الإيرادات (%)': 'Holding cost ratio (%)',
  'الإيجار السنوي (ر.س)': 'Annual rent (SAR)',
  'نسبة الشواغر السنوية (%)': 'Annual vacancy rate (%)',
  'تكلفة التجهيز الأولية (ر.س)': 'Initial setup cost (SAR)',
  'نسبة التقييم السنوية للعقار (%)': 'Annual property appreciation (%)',
  'سعر العقار (ر.س)': 'Property price (SAR)',
  'نسبة المصاريف التشغيلية من الإيجار (%)': 'Operating expense ratio (%)',
  'نسبة الشواغر (%)': 'Vacancy rate (%)',
  'نسبة التقييم السنوية (%)': 'Annual appreciation (%)',
  'نسبة التمويل من سعر العقار (%)': 'Financing ratio (%)',
  'الإنتاج اليومي (عبوة)': 'Daily production (bottles)',
  'سعر بيع العبوة (ر.س)': 'Bottle selling price (SAR)',
  'تكلفة المواد للعبوة (ر.س)': 'Raw material cost per bottle (SAR)',
  'تكلفة المواد الخام للكجم (ر.س)': 'Raw material cost per kg (SAR)',
  'الطاقة الإنتاجية الشهرية (كجم)': 'Monthly production capacity (kg)',
  'سعر البيع للكجم (ر.س)': 'Selling price per kg (SAR)',
  'الطاقة الإنتاجية الشهرية (قطعة)': 'Monthly production capacity (pieces)',
  'سعر بيع القطعة (ر.س)': 'Selling price per piece (SAR)',
  'تكلفة المواد الخام للقطعة (ر.س)': 'Raw material cost per piece (SAR)',
  'الطاقة الإنتاجية الشهرية (متر)': 'Monthly production capacity (meters)',
  'سعر البيع للمتر (ر.س)': 'Selling price per meter (SAR)',
  'تكلفة المواد الخام للمتر (ر.س)': 'Raw material cost per meter (SAR)',
  'الطاقة الإنتاجية الشهرية (لتر)': 'Monthly production capacity (liters)',
  'سعر البيع للتر (ر.س)': 'Selling price per liter (SAR)',
  'تكلفة المواد الخام للتر (ر.س)': 'Raw material cost per liter (SAR)',
  'قيمة العقد (ر.س)': 'Contract value (SAR)',
  'نسبة تكلفة الباطن (%)': 'Subcontractor cost ratio (%)',
  'تكلفة المواد المباشرة (ر.س)': 'Direct material cost (SAR)',
  'تكلفة العمالة المباشرة (ر.س)': 'Direct labor cost (SAR)',
  'تكلفة المعدات (ر.س)': 'Equipment cost (SAR)',
  'نسبة التكاليف غير المباشرة (%)': 'Indirect cost ratio (%)',
  'هامش الربح المستهدف (%)': 'Target profit margin (%)',
  'نسبة الاحتياطي (%)': 'Contingency ratio (%)',
  'نسبة الدفعة المقدمة (%)': 'Advance payment ratio (%)',
  'نسبة الاستقطاع (%)': 'Retention ratio (%)',
  'نسبة الإنجاز الشهري (%)': 'Monthly progress ratio (%)',
  'المساحة المبنية (م²)': 'Built-up area (m²)',
  'تكلفة الخرسانة للمتر المربع (ر.س)': 'Concrete cost per m² (SAR)',
  'تكلفة الحديد للمتر المربع (ر.س)': 'Steel cost per m² (SAR)',
  'تكلفة الشدة للمتر المربع (ر.س)': 'Formwork cost per m² (SAR)',
  'تكلفة العمالة للمتر المربع (ر.س)': 'Labor cost per m² (SAR)',
  'تكلفة أعمال التشطيب الأساسية للمتر المربع (ر.س)': 'Basic finishing cost per m² (SAR)',
  'مساحة التشطيب (م²)': 'Finishing area (m²)',
  'تكلفة الأرضيات للمتر المربع (ر.س)': 'Flooring cost per m² (SAR)',
  'تكلفة الدهان للمتر المربع (ر.س)': 'Painting cost per m² (SAR)',
  'تكلفة الكهرباء للمتر المربع (ر.س)': 'Electrical cost per m² (SAR)',
  'تكلفة السباكة للمتر المربع (ر.س)': 'Plumbing cost per m² (SAR)',
  'تكلفة التكييف للمتر المربع (ر.س)': 'AC cost per m² (SAR)',
  'نسبة الإنجاز الحالية (%)': 'Current completion ratio (%)',
  'تكلفة استكمال المشروع (ر.س)': 'Completion cost (SAR)',
  'القيمة السوقية بعد الاستكمال (ر.س)': 'Market value if completed (SAR)',
  'الالتزامات المالية الحالية (ر.س)': 'Existing liabilities (SAR)',
  'تكلفة الإجراءات القانونية (ر.س)': 'Legal cost (SAR)',
  'مدة الاستكمال (شهر)': 'Completion duration (months)',
  'عدد الطاولات': 'Number of tables',
  'عدد العملاء اليومي': 'Daily customers',
  'نسبة تكلفة المواد (%)': 'Material cost ratio (%)',
  'عدد الطلبات اليومية': 'Daily orders',
  'متوسط قيمة الطلب (ر.س)': 'Average order value (SAR)',
  'نسبة عمولة المنصات (%)': 'Platform commission ratio (%)',
  'تكلفة العربة والتجهيز (ر.س)': 'Truck & equipment cost (SAR)',
  'تكلفة التراخيص والتأمين (ر.س)': 'Permits & insurance cost (SAR)',
  'الوقود والصيانة الشهرية (ر.س)': 'Monthly fuel & maintenance (SAR)',
  'عدد الموظفين': 'Number of employees',
  'عدد الطلاب': 'Number of students',
  'الرسوم السنوية للطالب (ر.س)': 'Annual fee per student (SAR)',
  'عدد الأطفال': 'Number of children',
  'الرسوم الشهرية للطفل (ر.س)': 'Monthly fee per child (SAR)',
  'الرسوم الشهرية للطالب (ر.س)': 'Monthly fee per student (SAR)',
  'عدد المتدربين الشهري': 'Monthly trainees',
  'رسوم الدورة للمتدرب (ر.س)': 'Course fee per trainee (SAR)',
  'عدد المشتركين': 'Number of subscribers',
  'الاشتراك الشهري (ر.س)': 'Monthly subscription (SAR)',
  'تكلفة تطوير المنصة (ر.س)': 'Platform development cost (SAR)',
  'نسبة تكلفة المحتوى من الإيرادات (%)': 'Content cost ratio (%)',
  'عدد الغرف': 'Number of rooms',
  'عدد الوحدات/الشاليهات': 'Number of units / chalets',
  'عدد الخيام/الوحدات': 'Number of tents / units',
  'عدد الباقات الشهرية': 'Monthly packages',
  'متوسط سعر الباقة (ر.س)': 'Average package price (SAR)',
  'نسبة تكلفة الباقة من الإيرادات (%)': 'Package cost ratio (%)',
  'عدد الشحنات الشهرية': 'Monthly shipments',
  'إيراد الشحنة (ر.س)': 'Revenue per shipment (SAR)',
  'عدد الرحلات الشهرية للمركبة': 'Monthly trips per vehicle',
  'إيراد الرحلة (ر.س)': 'Revenue per trip (SAR)',
  'وقود وصيانة لكل رحلة (ر.س)': 'Fuel & maintenance per trip (SAR)',
  'عدد الطلبات الشهرية': 'Monthly orders',
  'إيراد الطلب (ر.س)': 'Revenue per order (SAR)',
  'عدد التوصيلات اليومية': 'Daily deliveries',
  'إيراد التوصيلة (ر.س)': 'Revenue per delivery (SAR)'
};

const expertStages = [
  {
    id: 'project',
    titleAr: 'المشروع',
    titleEn: 'Project',
    fields: [
      { name: 'projectName', labelAr: 'اسم المشروع', labelEn: 'Project Name', type: 'text', default: '' },
      { name: 'projectOwner', labelAr: 'اسم المالك / الجهة المنفذة', labelEn: 'Project Owner / Entity', type: 'text', default: '' },
      { name: 'projectLocation', labelAr: 'موقع المشروع', labelEn: 'Project Location', type: 'text', default: '' },
      { name: 'legalStructure', labelAr: 'الشكل القانوني', labelEn: 'Legal Structure', type: 'select', optionsAr: ['شركة ذات مسؤولية محدودة','شركة مساهمة','مؤسسة فردية','شركة تضامن','فرع'], optionsEn: ['LLC','Joint Stock','Sole Proprietorship','Partnership','Branch'], default: '' },
      { name: 'startMonth', labelAr: 'شهر البدء المتوقع', labelEn: 'Expected Start Month', type: 'number', default: 1 },
      { name: 'projectPhase', labelAr: 'مرحلة المشروع', labelEn: 'Project Phase', type: 'select', optionsAr: ['فكرة','دراسة جدوى','تأسيس','تشغيل','توسع'], optionsEn: ['Idea','Feasibility','Establishment','Operation','Expansion'], default: 'تأسيس' },
      { name: 'projectDurationYears', labelAr: 'مدة المشروع (سنوات)', labelEn: 'Project Duration (Years)', type: 'number', default: 5 },
      { name: 'regulatoryApprovalsNeeded', labelAr: 'عدد التراخيص المطلوبة', labelEn: 'Required Regulatory Approvals', type: 'number', default: 3 },
      { name: 'projectManagerExperience', labelAr: 'خبرة مدير المشروع (سنوات)', labelEn: 'Project Manager Experience (Years)', type: 'number', default: 5 },
      { name: 'environmentalImpact', labelAr: 'التأثير البيئي (1 = منخفض، 5 = عالٍ)', labelEn: 'Environmental Impact (1 = low, 5 = high)', type: 'number', default: 2 }
    ]
  },
  {
    id: 'market',
    titleAr: 'السوق',
    titleEn: 'Market',
    fields: [
      { name: 'tam', labelAr: 'إجمالي السوق المتاح (TAM) سنويًا (ر.س)', labelEn: 'Total Addressable Market (TAM) Annual (SAR)', type: 'number', default: 0 },
      { name: 'sam', labelAr: 'السوق الموجه (SAM) سنويًا (ر.س)', labelEn: 'Serviceable Addressable Market (SAM) Annual (SAR)', type: 'number', default: 0 },
      { name: 'som', labelAr: 'السوق الم obtainable (SOM) سنويًا (ر.س)', labelEn: 'Serviceable Obtainable Market (SOM) Annual (SAR)', type: 'number', default: 0 },
      { name: 'competitorCount', labelAr: 'عدد المنافسين المباشرين', labelEn: 'Number of Direct Competitors', type: 'number', default: 5 },
      { name: 'avgCompetitorPrice', labelAr: 'متوسط سعر المنافس (ر.س)', labelEn: 'Average Competitor Price (SAR)', type: 'number', default: 0 },
      { name: 'marketEntryBarrier', labelAr: 'حاجز دخول السوق (1 = منخفض، 5 = مرتفع)', labelEn: 'Market Entry Barrier (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'customerAcquisitionCost', labelAr: 'تكلفة اكتساب العميل (ر.س)', labelEn: 'Customer Acquisition Cost (SAR)', type: 'number', default: 0 },
      { name: 'customerLifetimeValue', labelAr: 'قيمة العميل مدى الحياة (ر.س)', labelEn: 'Customer Lifetime Value (SAR)', type: 'number', default: 0 },
      { name: 'digitalAdBudget', labelAr: 'الميزانية الشهرية للإعلانات الرقمية (ر.س)', labelEn: 'Monthly Digital Ad Budget (SAR)', type: 'number', default: 0 },
      { name: 'brandAwareness', labelAr: 'مستوى الوعي بالعلامة التجارية (%)', labelEn: 'Brand Awareness Level (%)', type: 'number', default: 0 },
      { name: 'marketGrowthRate', labelAr: 'معدل نمو السوق السنوي (%)', labelEn: 'Annual Market Growth Rate (%)', type: 'number', default: 5 },
      { name: 'seasonalFactor', labelAr: 'معامل الموسمية (0.5 = منخفضة، 1.5 = مرتفعة)', labelEn: 'Seasonality Factor (0.5 = low, 1.5 = high)', type: 'number', default: 1 },
      { name: 'churnRate', labelAr: 'معدل تسرب العملاء الشهري (%)', labelEn: 'Monthly Customer Churn Rate (%)', type: 'number', default: 5 },
      { name: 'repeatPurchaseRate', labelAr: 'معدل إعادة الشراء الشهري (%)', labelEn: 'Monthly Repeat Purchase Rate (%)', type: 'number', default: 20 },
      { name: 'onlineVsOfflineRatio', labelAr: 'نسبة المبيعات الرقمية (%)', labelEn: 'Online Sales Ratio (%)', type: 'number', default: 30 }
    ]
  },
  {
    id: 'operations',
    titleAr: 'التشغيل',
    titleEn: 'Operations',
    fields: [
      { name: 'operatingDaysPerMonth', labelAr: 'أيام التشغيل الشهرية', labelEn: 'Operating Days per Month', type: 'number', default: 26 },
      { name: 'operatingHoursPerDay', labelAr: 'ساعات التشغيل اليومية', labelEn: 'Operating Hours per Day', type: 'number', default: 10 },
      { name: 'shiftCount', labelAr: 'عدد الورديات', labelEn: 'Number of Shifts', type: 'number', default: 1 },
      { name: 'capacityUtilizationTarget', labelAr: 'مستهدف استغلال الطاقة (%)', labelEn: 'Capacity Utilization Target (%)', type: 'number', default: 75 },
      { name: 'employeeProductivityIndex', labelAr: 'مؤشر إنتاجية الموظف (1 = منخفض، 5 = مرتفع)', labelEn: 'Employee Productivity Index (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'maintenanceCostRate', labelAr: 'نسبة الصيانة من الإيرادات (%)', labelEn: 'Maintenance Cost Ratio (%)', type: 'number', default: 3 },
      { name: 'insuranceCostAnnual', labelAr: 'تكلفة التأمين السنوية (ر.س)', labelEn: 'Annual Insurance Cost (SAR)', type: 'number', default: 0 },
      { name: 'licenseRenewalCost', labelAr: 'تكلفة تجديد الترخيص السنوية (ر.س)', labelEn: 'Annual License Renewal Cost (SAR)', type: 'number', default: 0 },
      { name: 'softwareSubscriptions', labelAr: 'اشتراكات البرامج الشهرية (ر.س)', labelEn: 'Monthly Software Subscriptions (SAR)', type: 'number', default: 0 },
      { name: 'marketingBudget', labelAr: 'الميزانية الشهرية للتسويق (ر.س)', labelEn: 'Monthly Marketing Budget (SAR)', type: 'number', default: 0 },
      { name: 'salesCommissionRate', labelAr: 'نسبة عمولة المبيعات (%)', labelEn: 'Sales Commission Rate (%)', type: 'number', default: 0 },
      { name: 'energyCostMonthly', labelAr: 'تكلفة الطاقة الشهرية (ر.س)', labelEn: 'Monthly Energy Cost (SAR)', type: 'number', default: 0 },
      { name: 'waterCostMonthly', labelAr: 'تكلفة المياه الشهرية (ر.س)', labelEn: 'Monthly Water Cost (SAR)', type: 'number', default: 0 },
      { name: 'wasteDisposalCost', labelAr: 'تكلفة التخلص من النفايات الشهرية (ر.س)', labelEn: 'Monthly Waste Disposal Cost (SAR)', type: 'number', default: 0 },
      { name: 'securityCost', labelAr: 'تكلفة الأمن الشهرية (ر.س)', labelEn: 'Monthly Security Cost (SAR)', type: 'number', default: 0 },
      { name: 'cleaningCost', labelAr: 'تكلفة النظافة الشهرية (ر.س)', labelEn: 'Monthly Cleaning Cost (SAR)', type: 'number', default: 0 },
      { name: 'outsourcingCost', labelAr: 'تكلفة الاستعانة بمصادر خارجية شهرية (ر.س)', labelEn: 'Monthly Outsourcing Cost (SAR)', type: 'number', default: 0 },
      { name: 'trainingCost', labelAr: 'تكلفة التدريب الشهرية (ر.س)', labelEn: 'Monthly Training Cost (SAR)', type: 'number', default: 0 }
    ]
  },
  {
    id: 'investment',
    titleAr: 'الاستثمار',
    titleEn: 'Investment',
    fields: [
      { name: 'landCost', labelAr: 'تكلفة الأرض (ر.س)', labelEn: 'Land Cost (SAR)', type: 'number', default: 0 },
      { name: 'buildingCost', labelAr: 'تكلفة البناء (ر.س)', labelEn: 'Building Cost (SAR)', type: 'number', default: 0 },
      { name: 'renovationCost', labelAr: 'تكلفة التجديد والتجهيز (ر.س)', labelEn: 'Renovation & Setup Cost (SAR)', type: 'number', default: 0 },
      { name: 'machineryCost', labelAr: 'تكلفة الآلات والمعدات (ر.س)', labelEn: 'Machinery & Equipment Cost (SAR)', type: 'number', default: 0 },
      { name: 'furnitureCost', labelAr: 'تكلفة الأثاث والتجهيزات المكتبية (ر.س)', labelEn: 'Furniture & Office Equipment Cost (SAR)', type: 'number', default: 0 },
      { name: 'vehiclesCost', labelAr: 'تكلفة المركبات (ر.س)', labelEn: 'Vehicles Cost (SAR)', type: 'number', default: 0 },
      { name: 'workingCapital', labelAr: 'رأس المال العامل (ر.س)', labelEn: 'Working Capital (SAR)', type: 'number', default: 0 },
      { name: 'contingencyReserve', labelAr: 'احتياطي الطوارئ (ر.س)', labelEn: 'Contingency Reserve (SAR)', type: 'number', default: 0 },
      { name: 'salvageValue', labelAr: 'القيمة المتبقية للأصول (ر.س)', labelEn: 'Asset Salvage Value (SAR)', type: 'number', default: 0 },
      { name: 'assetLifeYears', labelAr: 'العمر الافتراضي للأصول (سنة)', labelEn: 'Asset Life (Years)', type: 'number', default: 10 },
      { name: 'preOpeningCost', labelAr: 'تكلفة ما قبل الافتتاح (ر.س)', labelEn: 'Pre-Opening Cost (SAR)', type: 'number', default: 0 },
      { name: 'initialInventoryCost', labelAr: 'تكلفة المخزون الافتتاحي (ر.س)', labelEn: 'Initial Inventory Cost (SAR)', type: 'number', default: 0 },
      { name: 'permitsAndLicensesCost', labelAr: 'تكلفة التراخيص والموافقات (ر.س)', labelEn: 'Permits & Licenses Cost (SAR)', type: 'number', default: 0 },
      { name: 'feasibilityStudyCost', labelAr: 'تكلفة دراسة الجدوى (ر.س)', labelEn: 'Feasibility Study Cost (SAR)', type: 'number', default: 0 }
    ]
  },
  {
    id: 'financing',
    titleAr: 'التمويل',
    titleEn: 'Financing',
    fields: [
      { name: 'equityAmount', labelAr: 'مبلغ رأس المال الملكي (ر.س)', labelEn: 'Equity Amount (SAR)', type: 'number', default: 0 },
      { name: 'loanAmount', labelAr: 'مبلغ القرض (ر.س)', labelEn: 'Loan Amount (SAR)', type: 'number', default: 0 },
      { name: 'interestRate', labelAr: 'معدل الفائدة السنوي (%)', labelEn: 'Annual Interest Rate (%)', type: 'number', default: 0 },
      { name: 'loanTermYears', labelAr: 'مدة القرض (سنة)', labelEn: 'Loan Term (Years)', type: 'number', default: 0 },
      { name: 'gracePeriodMonths', labelAr: 'فترة السماح (شهر)', labelEn: 'Grace Period (Months)', type: 'number', default: 0 },
      { name: 'requiredRoi', labelAr: 'العائد المطلوب سنويًا (%)', labelEn: 'Required Annual ROI (%)', type: 'number', default: 15 },
      { name: 'minDscr', labelAr: 'الحد الأدنى لمعدل تغطية خدمة الدين', labelEn: 'Minimum DSCR', type: 'number', default: 1.25 },
      { name: 'balloonPayment', labelAr: 'دفعة بالونية نهائية (ر.س)', labelEn: 'Balloon Payment (SAR)', type: 'number', default: 0 },
      { name: 'earlyRepaymentPenalty', labelAr: 'عقوبة السداد المبكر (%)', labelEn: 'Early Repayment Penalty (%)', type: 'number', default: 0 },
      { name: 'collateralValue', labelAr: 'قيمة الضمانات (ر.س)', labelEn: 'Collateral Value (SAR)', type: 'number', default: 0 },
      { name: 'debtServiceStartMonth', labelAr: 'شهر بدء سداد القرض', labelEn: 'Debt Service Start Month', type: 'number', default: 1 }
    ]
  },
  {
    id: 'risks',
    titleAr: 'المخاطر',
    titleEn: 'Risks',
    fields: [
      { name: 'marketRiskScore', labelAr: 'مخاطر السوق (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Market Risk (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'operationalRiskScore', labelAr: 'المخاطر التشغيلية (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Operational Risk (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'financialRiskScore', labelAr: 'المخاطر المالية (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Financial Risk (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'regulatoryRiskScore', labelAr: 'المخاطر التنظيمية (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Regulatory Risk (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'technologyRiskScore', labelAr: 'مخاطر التقنية (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Technology Risk (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'reputationRiskScore', labelAr: 'مخاطر السمعة (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Reputation Risk (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'mitigationBudget', labelAr: 'ميزانية التخفيف من المخاطر الشهرية (ر.س)', labelEn: 'Monthly Risk Mitigation Budget (SAR)', type: 'number', default: 0 },
      { name: 'supplyChainRiskScore', labelAr: 'مخاطر سلسلة التوريد (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Supply Chain Risk (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'competitionRiskScore', labelAr: 'مخاطر المنافسة (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Competition Risk (1 = low, 5 = high)', type: 'number', default: 3 },
      { name: 'currencyRiskScore', labelAr: 'مخاطر العملة (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Currency Risk (1 = low, 5 = high)', type: 'number', default: 2 },
      { name: 'geopoliticalRiskScore', labelAr: 'المخاطر الجيوسياسية (1 = منخفضة، 5 = مرتفعة)', labelEn: 'Geopolitical Risk (1 = low, 5 = high)', type: 'number', default: 2 }
    ]
  },
  {
    id: 'review',
    titleAr: 'المراجعة',
    titleEn: 'Review',
    fields: [
      { name: 'keyAssumptions', labelAr: 'الافتراضات الرئيسية', labelEn: 'Key Assumptions', type: 'textarea', default: '' },
      { name: 'sensitivityCase', labelAr: 'سيناريو الحساسية', labelEn: 'Sensitivity Case', type: 'select', optionsAr: ['أساسي','تفاؤل','تشاؤم'], optionsEn: ['Base','Optimistic','Pessimistic'], default: 'أساسي' },
      { name: 'successFactors', labelAr: 'عوامل النجاح الرئيسية', labelEn: 'Key Success Factors', type: 'textarea', default: '' },
      { name: 'exitStrategy', labelAr: 'استراتيجية الخروج', labelEn: 'Exit Strategy', type: 'select', optionsAr: ['بيع','الاكتتاب','الاحتفاظ بالملكية','الاندماج','تصفية'], optionsEn: ['Sale','IPO','Retain Ownership','Merger','Liquidation'], default: 'الاحتفاظ بالملكية' }
    ]
  }
];

function translateLabel(label) {
  return labelTranslations[label] || label;
}

function renderInputField(field, lang, prefix = '') {
  const label = lang === 'en' ? translateLabel(field.label) : field.label;
  const id = prefix + field.name;
  return `
          <div class="investment-input-group">
            <label for="${id}">${label}</label>
            <input type="${field.type}" id="${id}" value="${field.default}" />
          </div>`;
}

function renderExpertField(field, lang) {
  const isAr = lang === 'ar';
  const label = isAr ? field.labelAr : field.labelEn;
  const id = 'expert_' + field.name;

  if (field.type === 'select') {
    const options = isAr ? field.optionsAr : field.optionsEn;
    const optsHtml = options.map((opt, idx) => {
      const value = (field.optionsEn && field.optionsEn[idx]) || opt;
      const selected = (isAr ? field.default : (field.optionsEn && field.optionsEn[field.optionsAr.indexOf(field.default)])) === opt ? ' selected' : '';
      return `<option value="${value}"${selected}>${opt}</option>`;
    }).join('');
    return `
            <div class="investment-input-group">
              <label for="${id}">${label}</label>
              <select id="${id}">${optsHtml}</select>
            </div>`;
  }

  if (field.type === 'textarea') {
    return `
            <div class="investment-input-group full-width">
              <label for="${id}">${label}</label>
              <textarea id="${id}" rows="3">${field.default}</textarea>
            </div>`;
  }

  return `
            <div class="investment-input-group">
              <label for="${id}">${label}</label>
              <input type="${field.type}" id="${id}" value="${field.default}" />
            </div>`;
}

function generatePage(sector, lang) {
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const title = isAr ? sector.title : (sectorEnTitles[sector.id] || sector.title);
  const pageTitle = isAr ? `${sector.title} | بوندز` : `${title} | Bonds`;
  const desc = isAr ? sector.desc : (sectorEnDescs[sector.id] || sector.desc);
  const calcBtn = isAr ? 'احسب التحليل الاستثماري' : 'Calculate Investment Analysis';
  const saveBtn = isAr ? 'حفظ النتيجة' : 'Save Result';
  const printBtn = isAr ? 'طباعة / PDF' : 'Print / PDF';
  const execReportBtn = isAr ? 'تقرير تنفيذي' : 'Executive Report';
  const basicLabel = isAr ? 'أساسي' : 'Basic';
  const expertLabel = isAr ? 'احترافي' : 'Expert';
  const projectMonthsLabel = isAr ? 'مدة التحليل (شهر)' : 'Analysis Duration (months)';
  const stageTitles = expertStages.map(s => isAr ? s.titleAr : s.titleEn);
  const stageSubtitles = [
    isAr ? 'معلومات المشروع الأساسية والمخصصة.' : 'Basic and custom project information.',
    isAr ? 'تحليل السوق والمنافسة والعملاء.' : 'Market, competition, and customer analysis.',
    isAr ? 'افتراضات التشغيل والتكاليف التشغيلية.' : 'Operating assumptions and running costs.',
    isAr ? 'تفاصيل الاستثمار والأصول.' : 'Investment details and assets.',
    isAr ? 'هيكل التمويل والعوائد المطلوبة.' : 'Financing structure and required returns.',
    isAr ? 'تقييم المخاطر والتخفيف منها.' : 'Risk assessment and mitigation.',
    isAr ? 'مراجعة الافتراضات وعوامل النجاح.' : 'Review assumptions and success factors.'
  ];

  const basicFieldsHtml = sector.fields.map(f => renderInputField(f, lang)).join('');
  const expertBasicFieldsHtml = sector.fields.map(f => renderInputField(f, lang, 'expert_basic_')).join('');

  const expertStagesHtml = expertStages.map((stage, idx) => {
    const stageFieldsHtml = stage.fields.map(f => renderExpertField(f, lang)).join('');
    const extraBasicHtml = idx === 0 ? `
              <div class="expert-basic-fields">
                <h3>${isAr ? 'البيانات الأساسية للقطاع' : 'Sector Basic Data'}</h3>
                ${expertBasicFieldsHtml}
              </div>` : '';
    const financialAssumptionsHtml = idx === 0 ? `
              <div class="expert-basic-fields">
                <h3>${isAr ? 'المعطيات المالية' : 'Financial Assumptions'}</h3>
                <div class="investment-input-group">
                  <label for="expert_basic_analysisDuration">${projectMonthsLabel}</label>
                  <input type="number" id="expert_basic_analysisDuration" value="60" />
                </div>
                <div class="investment-input-group">
                  <label for="expert_basic_discountRate">${isAr ? 'معدل الخصم السنوي (%)' : 'Annual Discount Rate (%)'}</label>
                  <input type="number" id="expert_basic_discountRate" value="10" />
                </div>
              </div>` : '';

    return `
        <div class="expert-stage" data-stage="${idx + 1}" ${idx === 0 ? 'data-active="true"' : ''}>
          <div class="investment-panel">
            <h2><span class="stage-number">${idx + 1}</span>${stageTitles[idx]}</h2>
            <p class="subtitle">${stageSubtitles[idx]}</p>
            <div class="investment-form">
              ${extraBasicHtml}
              ${idx === 0 ? financialAssumptionsHtml : ''}
              ${idx > 0 ? `<div class="expert-stage-fields">${stageFieldsHtml}</div>` : `<div class="expert-stage-fields">${stageFieldsHtml}</div>`}
            </div>
          </div>
        </div>`;
  }).join('');

  const stageNavItems = stageTitles.map((t, idx) => `
          <button type="button" class="stage-nav__item ${idx === 0 ? 'active' : ''}" data-stage="${idx + 1}" onclick="goToStage(${idx + 1})">
            <span class="stage-nav__number">${idx + 1}</span>
            <span class="stage-nav__label">${t}</span>
          </button>`).join('');

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${isAr ? 'حاسبة استثمارية لتحليل جدوى المشاريع في قطاع ' + sector.title : 'Investment calculator for analyzing project feasibility in the ' + title}" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${isAr ? 'احسب ROI، IRR، NPV، فترة الاسترداد، نقطة التعادل، ودرجة المخاطرة.' : 'Calculate ROI, IRR, NPV, payback, break-even, and risk score.'}" />
  <meta property="og:image" content="https://bonds-global.com/assets/bonds-logo-2026.webp" />
  <meta property="og:url" content="https://bonds-global.com/${isAr ? '' : 'en/'}calculators/investment-center/${sector.id}.html" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${pageTitle}" />
  <meta name="twitter:description" content="${isAr ? 'احسب ROI، IRR، NPV، فترة الاسترداد، نقطة التعادل، ودرجة المخاطرة.' : 'Calculate ROI, IRR, NPV, payback, break-even, and risk score.'}" />
  <meta name="twitter:image" content="https://bonds-global.com/assets/bonds-logo-2026.webp" />
  <link rel="canonical" href="https://bonds-global.com/${isAr ? '' : 'en/'}calculators/investment-center/${sector.id}.html" />
  <link href="https://fonts.googleapis.com/css2?family=${isAr ? 'Vazirmatn' : 'Inter'}:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${isAr ? '../../' : '../../../'}styles.css" />
  <link rel="stylesheet" href="${isAr ? '../../' : '../../../'}header-footer.css?v=2" />
  <link rel="stylesheet" href="${isAr ? './investment-center.css' : '../../../calculators/investment-center/investment-center.css'}" />
  <link rel="icon" type="image/svg+xml" href="${isAr ? '../../' : '../../../'}assets/bonds-mark.svg" />
</head>
<body>
  <div id="site-header"></div>

  <main class="investment-calculator">
    <div class="investment-calculator__header">
      <div style="font-size:3rem;margin-bottom:var(--space-3);">${sector.icon}</div>
      <h1>${title}</h1>
      <p>${desc}</p>
    </div>

    <div class="mode-toggle" role="group" aria-label="${isAr ? 'تبديل الوضع' : 'Mode toggle'}">
      <button type="button" class="mode-toggle__btn active" data-mode="basic" onclick="setMode('basic')">${basicLabel}</button>
      <button type="button" class="mode-toggle__btn" data-mode="expert" onclick="setMode('expert')">${expertLabel}</button>
    </div>

    <div id="basicMode" class="mode-panel" data-active="true">
      <div class="investment-form">
        <div class="investment-panel">
          <h2>${isAr ? 'بيانات المشروع' : 'Project Data'}</h2>
          ${basicFieldsHtml}
        </div>

        <div class="investment-panel">
          <h2>${isAr ? 'المعطيات المالية' : 'Financial Assumptions'}</h2>
          <div class="investment-input-group">
            <label for="analysisDuration">${projectMonthsLabel}</label>
            <input type="number" id="analysisDuration" value="60" />
          </div>
          <div class="investment-input-group">
            <label for="discountRate">${isAr ? 'معدل الخصم السنوي (%)' : 'Annual Discount Rate (%)'}</label>
            <input type="number" id="discountRate" value="10" />
          </div>
        </div>
      </div>
    </div>

    <div id="expertMode" class="mode-panel mode-panel--expert">
      <nav class="stage-nav" aria-label="${isAr ? 'مراحل الإدخال' : 'Input stages'}">
        ${stageNavItems}
      </nav>
      ${expertStagesHtml}
      <div class="stage-actions">
        <button type="button" class="bonds-btn bonds-btn-secondary" id="stagePrev" onclick="prevStage()">${isAr ? 'السابق' : 'Previous'}</button>
        <div class="stage-dots">
          ${stageTitles.map((_, idx) => `<span class="stage-dot ${idx === 0 ? 'active' : ''}" data-stage="${idx + 1}"></span>`).join('')}
        </div>
        <button type="button" class="bonds-btn bonds-btn-primary" id="stageNext" onclick="nextStage()">${isAr ? 'التالي' : 'Next'}</button>
      </div>
    </div>

    <div class="investment-actions">
      <button class="bonds-btn bonds-btn-primary" onclick="calculate()">${calcBtn}</button>
      <button class="bonds-btn bonds-btn-secondary" onclick="saveAnalysis()">${saveBtn}</button>
      <button class="bonds-btn bonds-btn-secondary" onclick="printReport()">${printBtn}</button>
      <button class="bonds-btn bonds-btn-secondary" onclick="printExecutiveReport()">${execReportBtn}</button>
    </div>

    <div id="validationWarnings" class="validation-warnings hidden"></div>

    <div id="resultsSection" class="results-dashboard hidden">
      <h2>${isAr ? 'التحليل الاستثماري الموحد' : 'Unified Investment Analysis'}</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-card__label">ROI</div>
          <div class="metric-card__value" id="metricRoi">--</div>
          <div class="metric-card__unit">%</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">IRR</div>
          <div class="metric-card__value" id="metricIrr">--</div>
          <div class="metric-card__unit">%</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">NPV</div>
          <div class="metric-card__value" id="metricNpv">--</div>
          <div class="metric-card__unit">${isAr ? 'ر.س' : 'SAR'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">${isAr ? 'فترة الاسترداد' : 'Payback Period'}</div>
          <div class="metric-card__value" id="metricPayback">--</div>
          <div class="metric-card__unit">${isAr ? 'شهر' : 'months'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">${isAr ? 'نقطة التعادل' : 'Break Even'}</div>
          <div class="metric-card__value" id="metricBreakEven">--</div>
          <div class="metric-card__unit">${isAr ? 'وحدة' : 'units'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">${isAr ? 'هامش الربح' : 'Profit Margin'}</div>
          <div class="metric-card__value" id="metricMargin">--</div>
          <div class="metric-card__unit">%</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">${isAr ? 'درجة المخاطرة' : 'Risk Score'}</div>
          <div class="metric-card__value" id="metricRisk">--</div>
          <div class="metric-card__unit">/ 100</div>
        </div>
      </div>

      <div class="recommendation-bar" id="recommendationBar">
        <div class="recommendation-bar__label">${isAr ? 'التوصية الاستثمارية' : 'Investment Recommendation'}</div>
        <div class="recommendation-bar__decision" id="recommendationDecision">--</div>
      </div>

      <div class="recommendation-reasons">
        <h3>${isAr ? 'أسباب القرار' : 'Reasons for Decision'}</h3>
        <ul id="recommendationReasons"></ul>
      </div>

      <!-- Decision Intelligence Layer -->
      <div id="decisionIntelligencePanel" class="decision-intelligence hidden">
        <h2>${isAr ? 'ذكاء اتخاذ القرار الاستثماري' : 'Investment Decision Intelligence'}</h2>

        <div class="di-confidence">
          <div class="di-confidence__label">${isAr ? 'درجة الثقة في القرار' : 'Confidence Score'}</div>
          <div class="di-confidence__gauge">
            <div class="di-confidence__fill" id="diConfidenceFill" style="width: 0%"></div>
          </div>
          <div class="di-confidence__value" id="diConfidenceValue">0</div>
        </div>

        <div class="di-verdict" id="diVerdict"></div>

        <div id="diSummary"></div>

        <div class="di-grid">
          <div class="di-card">
            <h3>${isAr ? 'تحليل المخاطر' : 'Risk Analysis'}</h3>
            <div id="diRiskGauge"></div>
            <div id="diRiskList" class="di-list"></div>
          </div>
          <div class="di-card">
            <h3>${isAr ? 'تحليل التمويل' : 'Financing Analysis'}</h3>
            <div id="diFinancingSummary"></div>
          </div>
          <div class="di-card">
            <h3>${isAr ? 'تحليل السوق' : 'Market Analysis'}</h3>
            <div id="diMarketGauge"></div>
            <div id="diMarketSummary"></div>
          </div>
          <div class="di-card">
            <h3>${isAr ? 'تحليل التدفقات النقدية' : 'Cash Flow Analysis'}</h3>
            <div id="diCashFlowGauge"></div>
            <div id="diCashFlowSummary"></div>
          </div>
        </div>

        <div class="di-card di-card--wide">
          <h3>${isAr ? 'قائمة المخاطر الرئيسية' : 'Key Risks'}</h3>
          <div id="diKeyRisks" class="di-list di-list--risks"></div>
        </div>

        <div class="di-card di-card--wide">
          <h3>${isAr ? 'قائمة الفرص الرئيسية' : 'Key Opportunities'}</h3>
          <div id="diKeyOpportunities" class="di-list di-list--opportunities"></div>
        </div>
      </div>
    </div>
  </main>

  <div id="site-footer"></div>

  <script src="${isAr ? '../../' : '../../../'}site-layout.js"></script>
  <script src="${isAr ? '../../' : '../../../'}page-tracker-v2.js"></script>
  <script src="${isAr ? './investment-engine.js' : '../../../calculators/investment-center/investment-engine.js'}"></script>
  <script src="${isAr ? './investment-validator.js' : '../../../calculators/investment-center/investment-validator.js'}"></script>
  <script src="${isAr ? './decision-intelligence.js' : '../../../calculators/investment-center/decision-intelligence.js'}"></script>
  <script src="${isAr ? '../../calculators/' : '../../../calculators/'}shared-export.js"></script>
  <script>
    const sectorId = '${sector.id}';
    const baseRiskWeight = ${sector.riskWeight};
    const isAr = ${isAr};
    const expertStageCount = ${expertStages.length};

    let currentMode = 'basic';
    let currentStage = 1;
    let lastValidationValid = false;

    function getValue(id) {
      const el = document.getElementById(id);
      if (!el) return 0;
      const v = parseFloat(el.value);
      return Number.isFinite(v) ? v : 0;
    }

    function getText(id) {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    }

    function formatNumber(n) {
      if (!Number.isFinite(n)) return '∞';
      return n.toLocaleString(isAr ? 'ar-SA' : 'en-US');
    }

    function syncField(basicId, expertId, direction) {
      const basicEl = document.getElementById(basicId);
      const expertEl = document.getElementById(expertId);
      if (!basicEl || !expertEl) return;
      if (direction === 'toExpert') {
        expertEl.value = basicEl.value;
      } else {
        basicEl.value = expertEl.value;
      }
    }

    function setMode(mode) {
      const previousMode = currentMode;
      currentMode = mode;
      const direction = mode === 'expert' ? 'toExpert' : 'toBasic';

      const fields = ${JSON.stringify(sector.fields)};
      fields.forEach(f => syncField(f.name, 'expert_basic_' + f.name, direction));
      syncField('analysisDuration', 'expert_basic_analysisDuration', direction);
      syncField('discountRate', 'expert_basic_discountRate', direction);

      document.querySelectorAll('.mode-toggle__btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
      document.getElementById('basicMode').setAttribute('data-active', mode === 'basic');
      document.getElementById('expertMode').setAttribute('data-active', mode === 'expert');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function goToStage(stage) {
      if (stage < 1 || stage > expertStageCount) return;
      currentStage = stage;
      updateStageUI();
    }

    function nextStage() {
      if (currentStage < expertStageCount) {
        currentStage++;
        updateStageUI();
      }
    }

    function prevStage() {
      if (currentStage > 1) {
        currentStage--;
        updateStageUI();
      }
    }

    function updateStageUI() {
      document.querySelectorAll('.expert-stage').forEach(el => {
        el.setAttribute('data-active', Number(el.dataset.stage) === currentStage);
      });
      document.querySelectorAll('.stage-nav__item').forEach(btn => {
        const active = Number(btn.dataset.stage) === currentStage;
        btn.classList.toggle('active', active);
      });
      document.querySelectorAll('.stage-dot').forEach(dot => {
        dot.classList.toggle('active', Number(dot.dataset.stage) === currentStage);
      });
      document.getElementById('stagePrev').disabled = currentStage === 1;
      const nextBtn = document.getElementById('stageNext');
      nextBtn.textContent = currentStage === expertStageCount ? (isAr ? 'إنهاء' : 'Finish') : (isAr ? 'التالي' : 'Next');
    }

    function mapInputs() {
      const inputs = {};
      const fields = ${JSON.stringify(sector.fields)};
      const basicPrefix = currentMode === 'expert' ? 'expert_basic_' : '';
      fields.forEach(f => inputs[f.name] = getValue(basicPrefix + f.name));
      inputs.analysisDuration = getValue(basicPrefix + 'analysisDuration');
      inputs.discountRate = getValue(basicPrefix + 'discountRate') / 100;

      const expertFieldNames = ${JSON.stringify(expertStages.flatMap(s => s.fields.map(f => f.name)))};
      expertFieldNames.forEach(name => {
        const fieldMeta = ${JSON.stringify(expertStages.flatMap(s => s.fields))}.find(f => f.name === name);
        if (fieldMeta && (fieldMeta.type === 'text' || fieldMeta.type === 'textarea' || fieldMeta.type === 'select')) {
          inputs[name] = getText('expert_' + name);
        } else {
          inputs[name] = getValue('expert_' + name);
        }
      });

      return inputs;
    }

    function calculateEngineInputs(inputs) {
      let totalInvestment = 0, monthlyFixed = 0, monthlyVariable = 0, monthlyRevenue = 0;
      let unitPrice = 0, unitVariableCost = 0;
      let expertRiskWeight = baseRiskWeight;

      switch (sectorId) {
        case 'medical':
          totalInvestment = inputs.equipmentCost;
          monthlyRevenue = inputs.unitsCount * inputs.avgDailyRevenue * 30;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyRent;
          monthlyVariable = monthlyRevenue * (inputs.materialCostRate / 100);
          unitPrice = inputs.avgDailyRevenue;
          unitVariableCost = unitPrice * (inputs.materialCostRate / 100);
          break;
        case 'industrial':
          totalInvestment = inputs.factoryCost;
          monthlyRevenue = inputs.monthlyCapacity * inputs.unitPrice;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = inputs.monthlyCapacity * inputs.rawMaterialCost;
          unitPrice = inputs.unitPrice;
          unitVariableCost = inputs.rawMaterialCost;
          break;
        case 'real-estate':
          totalInvestment = inputs.landValue + inputs.constructionCost;
          monthlyRevenue = (inputs.unitsCount * inputs.unitPrice) / 12;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * 0.05;
          unitPrice = inputs.unitPrice;
          unitVariableCost = unitPrice * 0.05;
          break;
        case 'commercial':
          totalInvestment = inputs.inventoryCost;
          monthlyRevenue = inputs.monthlySales;
          monthlyFixed = inputs.monthlyRent + inputs.monthlySalaries + inputs.marketingCost;
          monthlyVariable = inputs.monthlySales * (1 - inputs.profitMargin / 100);
          unitPrice = 100;
          unitVariableCost = 100 * (1 - inputs.profitMargin / 100);
          break;
        case 'tourism':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.unitsCount * (inputs.occupancyRate / 100) * inputs.avgDailyRate * 30;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = monthlyRevenue * 0.15;
          unitPrice = inputs.avgDailyRate;
          unitVariableCost = unitPrice * 0.15;
          break;
        case 'education':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.capacity * (inputs.enrollmentRate / 100) * inputs.monthlyFee;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyRent;
          monthlyVariable = monthlyRevenue * 0.10;
          unitPrice = inputs.monthlyFee;
          unitVariableCost = unitPrice * 0.10;
          break;
        case 'logistics':
          totalInvestment = inputs.vehicleCost;
          monthlyRevenue = inputs.monthlyTrips * inputs.revenuePerTrip;
          monthlyFixed = inputs.monthlySalaries;
          monthlyVariable = inputs.monthlyTrips * inputs.fuelMaintenance;
          unitPrice = inputs.revenuePerTrip;
          unitVariableCost = inputs.fuelMaintenance;
          break;
        case 'agriculture':
          totalInvestment = inputs.landSetupCost;
          monthlyRevenue = (inputs.areaSize * inputs.yieldPerHectare * inputs.pricePerKg * inputs.harvestsPerYear) / 12;
          monthlyFixed = totalInvestment * 0.03;
          monthlyVariable = (inputs.areaSize * inputs.yieldPerHectare * inputs.operationalCostPerKg * inputs.harvestsPerYear) / 12;
          unitPrice = inputs.pricePerKg;
          unitVariableCost = inputs.operationalCostPerKg;
          break;
        case 'technology':
          totalInvestment = inputs.developmentCost;
          monthlyRevenue = inputs.subscribers * inputs.subscriptionPrice;
          monthlyFixed = inputs.monthlyServers + inputs.monthlySalaries;
          monthlyVariable = inputs.monthlyMarketing + (monthlyRevenue * 0.05);
          unitPrice = inputs.subscriptionPrice;
          unitVariableCost = unitPrice * 0.05;
          break;
        case 'restaurants':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.dailyCustomers * inputs.avgTicket * 30;
          monthlyFixed = inputs.monthlyRentSalaries;
          monthlyVariable = monthlyRevenue * (inputs.foodCostRate / 100);
          unitPrice = inputs.avgTicket;
          unitVariableCost = unitPrice * (inputs.foodCostRate / 100);
          break;
        case 'retail':
          totalInvestment = inputs.inventoryCost;
          monthlyRevenue = inputs.dailySales * 30;
          monthlyFixed = inputs.monthlyRent + inputs.monthlySalaries;
          monthlyVariable = monthlyRevenue * (1 - inputs.profitMargin / 100);
          unitPrice = 100;
          unitVariableCost = 100 * (1 - inputs.profitMargin / 100);
          break;
        case 'construction':
          totalInvestment = inputs.initialEquipment;
          monthlyRevenue = inputs.projectValue / inputs.projectMonths;
          monthlyFixed = monthlyRevenue * (inputs.overheadRate / 100);
          monthlyVariable = monthlyRevenue * ((inputs.materialCostRate + inputs.laborCostRate) / 100);
          unitPrice = monthlyRevenue;
          unitVariableCost = monthlyVariable;
          break;
        case 'hospital':
          totalInvestment = inputs.constructionAndEquipmentCost;
          monthlyRevenue = inputs.numberOfBeds * inputs.avgDailyRevenuePerBed * 30;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = monthlyRevenue * (inputs.medicalSuppliesRate / 100);
          unitPrice = inputs.avgDailyRevenuePerBed;
          unitVariableCost = unitPrice * (inputs.medicalSuppliesRate / 100);
          break;
        case 'medical-complex':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.numberOfClinics * inputs.avgMonthlyRevenuePerClinic;
          monthlyFixed = inputs.monthlyRent + inputs.monthlySalaries;
          monthlyVariable = monthlyRevenue * (inputs.operatingCostRate / 100);
          unitPrice = inputs.avgMonthlyRevenuePerClinic;
          unitVariableCost = unitPrice * (inputs.operatingCostRate / 100);
          break;
        case 'dental-clinic':
          totalInvestment = inputs.equipmentCost;
          monthlyRevenue = inputs.numberOfChairs * inputs.avgDailyRevenuePerChair * 30;
          monthlyFixed = inputs.monthlyRent + inputs.monthlySalaries;
          monthlyVariable = monthlyRevenue * (inputs.materialCostRate / 100);
          unitPrice = inputs.avgDailyRevenuePerChair;
          unitVariableCost = unitPrice * (inputs.materialCostRate / 100);
          break;
        case 'radiology-center':
          totalInvestment = inputs.equipmentCost;
          monthlyRevenue = inputs.numberOfMachines * inputs.avgDailyRevenuePerMachine * 30;
          monthlyFixed = inputs.monthlyRent + inputs.monthlySalaries;
          monthlyVariable = monthlyRevenue * (inputs.contrastMaterialRate / 100);
          unitPrice = inputs.avgDailyRevenuePerMachine;
          unitVariableCost = unitPrice * (inputs.contrastMaterialRate / 100);
          break;
        case 'medical-lab':
          totalInvestment = inputs.equipmentCost;
          monthlyRevenue = inputs.avgDailyTests * inputs.avgRevenuePerTest * 30;
          monthlyFixed = inputs.monthlyRent + inputs.monthlySalaries;
          monthlyVariable = monthlyRevenue * (inputs.reagentCostRate / 100);
          unitPrice = inputs.avgRevenuePerTest;
          unitVariableCost = unitPrice * (inputs.reagentCostRate / 100);
          break;
        case 'physiotherapy-center':
          totalInvestment = inputs.equipmentCost;
          monthlyRevenue = inputs.numberOfSessionsPerDay * inputs.avgRevenuePerSession * 30;
          monthlyFixed = inputs.monthlyRent + inputs.monthlySalaries;
          monthlyVariable = monthlyRevenue * (inputs.disposableCostRate / 100);
          unitPrice = inputs.avgRevenuePerSession;
          unitVariableCost = unitPrice * (inputs.disposableCostRate / 100);
          break;
        case 'pharmacy':
          totalInvestment = inputs.inventoryCost + inputs.licenseCost;
          monthlyRevenue = inputs.avgDailySales * 30;
          monthlyFixed = inputs.monthlyRent + inputs.monthlySalaries;
          monthlyVariable = monthlyRevenue * (1 - inputs.profitMargin / 100);
          unitPrice = 100;
          unitVariableCost = 100 * (1 - inputs.profitMargin / 100);
          break;
        case 'optical-center':
          totalInvestment = inputs.inventoryCost;
          monthlyRevenue = inputs.avgDailySales * inputs.avgTicketValue * 30;
          monthlyFixed = inputs.monthlyRent + inputs.monthlySalaries;
          monthlyVariable = monthlyRevenue * (inputs.lensCostRate / 100);
          unitPrice = inputs.avgTicketValue;
          unitVariableCost = unitPrice * (inputs.lensCostRate / 100);
          break;
        case 'land-development':
          totalInvestment = (inputs.landArea * inputs.landPricePerM2) + (inputs.landArea * inputs.developmentCostPerM2);
          monthlyRevenue = (inputs.landArea * inputs.sellingPricePerM2) / inputs.projectMonths;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * 0.05;
          unitPrice = inputs.sellingPricePerM2;
          unitVariableCost = unitPrice * 0.05;
          break;
        case 'villa-construction':
          totalInvestment = inputs.landCost + (inputs.numberOfVillas * inputs.constructionCostPerVilla);
          monthlyRevenue = (inputs.numberOfVillas * inputs.sellingPricePerVilla) / inputs.projectMonths;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * 0.05;
          unitPrice = inputs.sellingPricePerVilla;
          unitVariableCost = unitPrice * 0.05;
          break;
        case 'residential-building':
          totalInvestment = inputs.landCost + (inputs.numberOfApartments * inputs.constructionCostPerApartment);
          monthlyRevenue = (inputs.numberOfApartments * inputs.sellingPricePerApartment) / inputs.projectMonths;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * 0.05;
          unitPrice = inputs.sellingPricePerApartment;
          unitVariableCost = unitPrice * 0.05;
          break;
        case 'commercial-complex':
          totalInvestment = inputs.landCost + (inputs.numberOfUnits * inputs.constructionCostPerUnit);
          monthlyRevenue = (inputs.numberOfUnits * inputs.annualRentPerUnit) / 12;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * 0.10;
          unitPrice = inputs.annualRentPerUnit / 12;
          unitVariableCost = unitPrice * 0.10;
          break;
        case 'commercial-mall':
          totalInvestment = inputs.landCost + (inputs.rentableArea * inputs.constructionCostPerM2);
          monthlyRevenue = (inputs.rentableArea * inputs.annualRentPerM2) / 12;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * 0.15;
          unitPrice = inputs.annualRentPerM2 / 12;
          unitVariableCost = unitPrice * 0.15;
          break;
        case 'hotel-apartments':
          totalInvestment = inputs.landCost + (inputs.numberOfApartments * inputs.setupCostPerApartment);
          monthlyRevenue = inputs.numberOfApartments * inputs.avgDailyRate * (inputs.occupancyRate / 100) * 30;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * 0.20;
          unitPrice = inputs.avgDailyRate;
          unitVariableCost = unitPrice * 0.20;
          break;
        case 'warehouses':
          totalInvestment = inputs.landCost + (inputs.warehouseArea * inputs.constructionCostPerM2);
          monthlyRevenue = (inputs.warehouseArea * inputs.annualRentPerM2) / 12;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * 0.08;
          unitPrice = inputs.annualRentPerM2 / 12;
          unitVariableCost = unitPrice * 0.08;
          break;
        case 'property-rehabilitation':
          totalInvestment = inputs.purchasePrice + inputs.rehabilitationCost;
          monthlyRevenue = inputs.expectedSellingPrice / inputs.projectMonths;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * (inputs.holdingCostRate / 100);
          unitPrice = inputs.expectedSellingPrice / inputs.projectMonths;
          unitVariableCost = unitPrice * (inputs.holdingCostRate / 100);
          break;
        case 'buy-to-rent':
          totalInvestment = inputs.propertyPrice + inputs.setupCost;
          monthlyRevenue = (inputs.annualRent * (1 - inputs.vacancyRate / 100)) / 12;
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = 0;
          unitPrice = inputs.annualRent / 12;
          unitVariableCost = 0;
          break;
        case 'quick-real-estate':
          totalInvestment = inputs.propertyPrice * (1 - inputs.financingRate / 100);
          monthlyRevenue = (inputs.annualRent * (1 - inputs.vacancyRate / 100)) / 12;
          monthlyFixed = monthlyRevenue * (inputs.operatingExpenseRate / 100);
          monthlyVariable = 0;
          unitPrice = inputs.annualRent / 12;
          unitVariableCost = 0;
          break;
        case 'food-factory':
          totalInvestment = inputs.factoryCost;
          monthlyRevenue = inputs.monthlyCapacity * inputs.unitPrice;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = inputs.monthlyCapacity * inputs.rawMaterialCostPerUnit;
          unitPrice = inputs.unitPrice;
          unitVariableCost = inputs.rawMaterialCostPerUnit;
          break;
        case 'water-factory':
          totalInvestment = inputs.factoryCost;
          monthlyRevenue = inputs.dailyProduction * inputs.bottlePrice * 30;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = inputs.dailyProduction * inputs.rawMaterialCostPerBottle * 30;
          unitPrice = inputs.bottlePrice;
          unitVariableCost = inputs.rawMaterialCostPerBottle;
          break;
        case 'plastic-factory':
          totalInvestment = inputs.factoryCost;
          monthlyRevenue = inputs.monthlyCapacity * inputs.pricePerKg;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = inputs.monthlyCapacity * inputs.rawMaterialCostPerKg;
          unitPrice = inputs.pricePerKg;
          unitVariableCost = inputs.rawMaterialCostPerKg;
          break;
        case 'building-materials-factory':
          totalInvestment = inputs.factoryCost;
          monthlyRevenue = inputs.monthlyCapacity * inputs.unitPrice;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = inputs.monthlyCapacity * inputs.rawMaterialCostPerUnit;
          unitPrice = inputs.unitPrice;
          unitVariableCost = inputs.rawMaterialCostPerUnit;
          break;
        case 'furniture-factory':
          totalInvestment = inputs.factoryCost;
          monthlyRevenue = inputs.monthlyCapacity * inputs.unitPrice;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = inputs.monthlyCapacity * inputs.rawMaterialCostPerUnit;
          unitPrice = inputs.unitPrice;
          unitVariableCost = inputs.rawMaterialCostPerUnit;
          break;
        case 'textiles-factory':
          totalInvestment = inputs.factoryCost;
          monthlyRevenue = inputs.monthlyCapacity * inputs.pricePerMeter;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = inputs.monthlyCapacity * inputs.rawMaterialCostPerMeter;
          unitPrice = inputs.pricePerMeter;
          unitVariableCost = inputs.rawMaterialCostPerMeter;
          break;
        case 'chemicals-factory':
          totalInvestment = inputs.factoryCost;
          monthlyRevenue = inputs.monthlyCapacity * inputs.pricePerLiter;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = inputs.monthlyCapacity * inputs.rawMaterialCostPerLiter;
          unitPrice = inputs.pricePerLiter;
          unitVariableCost = inputs.rawMaterialCostPerLiter;
          break;
        case 'packaging-factory':
          totalInvestment = inputs.factoryCost;
          monthlyRevenue = inputs.monthlyCapacity * inputs.unitPrice;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = inputs.monthlyCapacity * inputs.rawMaterialCostPerUnit;
          unitPrice = inputs.unitPrice;
          unitVariableCost = inputs.rawMaterialCostPerUnit;
          break;
        case 'construction-profitability':
          totalInvestment = inputs.projectValue * 0.10;
          monthlyRevenue = inputs.projectValue / inputs.projectMonths;
          monthlyFixed = monthlyRevenue * (inputs.overheadRate / 100);
          monthlyVariable = monthlyRevenue * ((inputs.materialCostRate + inputs.laborCostRate + inputs.subcontractorCostRate) / 100);
          unitPrice = monthlyRevenue;
          unitVariableCost = monthlyVariable;
          break;
        case 'tender-pricing':
          {
            const directCosts = inputs.directMaterialCost + inputs.directLaborCost + inputs.equipmentCost;
            const totalPrice = directCosts * (1 + (inputs.indirectCostRate + inputs.profitMargin + inputs.contingencyRate) / 100);
            totalInvestment = directCosts;
            monthlyRevenue = totalPrice / 12;
            monthlyFixed = directCosts * (inputs.indirectCostRate / 100) / 12;
            monthlyVariable = (inputs.directMaterialCost + inputs.equipmentCost) / 12;
            unitPrice = monthlyRevenue;
            unitVariableCost = monthlyVariable;
          }
          break;
        case 'contractor-cashflow':
          totalInvestment = inputs.projectValue * (inputs.advancePaymentRate / 100);
          monthlyRevenue = inputs.projectValue * (inputs.monthlyProgressRate / 100);
          monthlyFixed = inputs.monthlyExpenses;
          monthlyVariable = monthlyRevenue * (inputs.retentionRate / 100);
          unitPrice = monthlyRevenue;
          unitVariableCost = monthlyVariable;
          break;
        case 'concrete-structure-cost':
          {
            const totalCostPerM2 = inputs.concreteCostPerM2 + inputs.steelCostPerM2 + inputs.formworkCostPerM2 + inputs.laborCostPerM2 + inputs.finishingCostPerM2;
            totalInvestment = inputs.builtUpArea * totalCostPerM2;
            monthlyRevenue = (totalInvestment * 1.15) / 6;
            monthlyFixed = 0;
            monthlyVariable = totalInvestment / 6;
            unitPrice = monthlyRevenue;
            unitVariableCost = monthlyVariable;
          }
          break;
        case 'finishing-cost':
          {
            const totalFinishingCost = inputs.finishingArea * (inputs.flooringCostPerM2 + inputs.paintingCostPerM2 + inputs.electricalCostPerM2 + inputs.plumbingCostPerM2 + inputs.acCostPerM2);
            totalInvestment = totalFinishingCost;
            monthlyRevenue = (totalFinishingCost * 1.20) / 3;
            monthlyFixed = 0;
            monthlyVariable = totalFinishingCost / 3;
            unitPrice = monthlyRevenue;
            unitVariableCost = monthlyVariable;
          }
          break;
        case 'distressed-project-evaluation':
          totalInvestment = inputs.estimatedCompletionCost + inputs.legalCost;
          monthlyRevenue = inputs.marketValueIfCompleted / inputs.completionMonths;
          monthlyFixed = inputs.existingLiabilities / inputs.completionMonths;
          monthlyVariable = 0;
          unitPrice = monthlyRevenue;
          unitVariableCost = 0;
          break;
        case 'restaurant':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.avgDailyCustomers * inputs.avgTicketValue * 30;
          monthlyFixed = inputs.monthlyRentSalaries;
          monthlyVariable = monthlyRevenue * (inputs.foodCostRate / 100);
          unitPrice = inputs.avgTicketValue;
          unitVariableCost = unitPrice * (inputs.foodCostRate / 100);
          break;
        case 'coffee-shop':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.avgDailyCustomers * inputs.avgTicketValue * 30;
          monthlyFixed = inputs.monthlyRentSalaries;
          monthlyVariable = monthlyRevenue * (inputs.foodCostRate / 100);
          unitPrice = inputs.avgTicketValue;
          unitVariableCost = unitPrice * (inputs.foodCostRate / 100);
          break;
        case 'cloud-kitchen':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.dailyOrders * inputs.avgTicketValue * 30;
          monthlyFixed = inputs.monthlyRentSalaries;
          monthlyVariable = monthlyRevenue * ((inputs.foodCostRate + inputs.platformCommissionRate) / 100);
          unitPrice = inputs.avgTicketValue;
          unitVariableCost = unitPrice * ((inputs.foodCostRate + inputs.platformCommissionRate) / 100);
          break;
        case 'food-truck':
          totalInvestment = inputs.truckCost + inputs.permitsCost;
          monthlyRevenue = inputs.dailyCustomers * inputs.avgTicketValue * 30;
          monthlyFixed = inputs.monthlyFuelMaintenance;
          monthlyVariable = monthlyRevenue * (inputs.foodCostRate / 100);
          unitPrice = inputs.avgTicketValue;
          unitVariableCost = unitPrice * (inputs.foodCostRate / 100);
          break;
        case 'fast-food-restaurant':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.dailyCustomers * inputs.avgTicketValue * 30;
          monthlyFixed = inputs.monthlyRentSalaries;
          monthlyVariable = monthlyRevenue * (inputs.foodCostRate / 100);
          unitPrice = inputs.avgTicketValue;
          unitVariableCost = unitPrice * (inputs.foodCostRate / 100);
          break;
        case 'fine-dining-restaurant':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.avgDailyCustomers * inputs.avgTicketValue * 30;
          monthlyFixed = inputs.monthlyRentSalaries;
          monthlyVariable = monthlyRevenue * (inputs.foodCostRate / 100);
          unitPrice = inputs.avgTicketValue;
          unitVariableCost = unitPrice * (inputs.foodCostRate / 100);
          break;
        case 'private-school':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = (inputs.numberOfStudents * inputs.annualFee) / 12;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyRent;
          monthlyVariable = monthlyRevenue * (inputs.operatingCostRate / 100);
          unitPrice = inputs.annualFee / 12;
          unitVariableCost = unitPrice * (inputs.operatingCostRate / 100);
          break;
        case 'nursery':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.numberOfChildren * inputs.monthlyFee;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyRent;
          monthlyVariable = monthlyRevenue * (inputs.operatingCostRate / 100);
          unitPrice = inputs.monthlyFee;
          unitVariableCost = unitPrice * (inputs.operatingCostRate / 100);
          break;
        case 'private-university':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = (inputs.numberOfStudents * inputs.annualFee) / 12;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyRent;
          monthlyVariable = monthlyRevenue * (inputs.operatingCostRate / 100);
          unitPrice = inputs.annualFee / 12;
          unitVariableCost = unitPrice * (inputs.operatingCostRate / 100);
          break;
        case 'training-center':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.monthlyTrainees * inputs.courseFee;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyRent;
          monthlyVariable = monthlyRevenue * (inputs.operatingCostRate / 100);
          unitPrice = inputs.courseFee;
          unitVariableCost = unitPrice * (inputs.operatingCostRate / 100);
          break;
        case 'e-learning-platform':
          totalInvestment = inputs.developmentCost;
          monthlyRevenue = inputs.numberOfSubscribers * inputs.monthlySubscription;
          monthlyFixed = inputs.monthlyMarketing + inputs.monthlyServers;
          monthlyVariable = monthlyRevenue * (inputs.contentCostRate / 100);
          unitPrice = inputs.monthlySubscription;
          unitVariableCost = unitPrice * (inputs.contentCostRate / 100);
          break;
        case 'hotel':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.numberOfRooms * (inputs.occupancyRate / 100) * inputs.avgDailyRate * 30;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = monthlyRevenue * 0.15;
          unitPrice = inputs.avgDailyRate;
          unitVariableCost = unitPrice * 0.15;
          break;
        case 'tourist-resort':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.numberOfUnits * (inputs.occupancyRate / 100) * inputs.avgDailyRate * 30;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = monthlyRevenue * 0.18;
          unitPrice = inputs.avgDailyRate;
          unitVariableCost = unitPrice * 0.18;
          break;
        case 'tourist-camp':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.numberOfTents * (inputs.occupancyRate / 100) * inputs.avgDailyRate * 30;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyUtilities;
          monthlyVariable = monthlyRevenue * 0.12;
          unitPrice = inputs.avgDailyRate;
          unitVariableCost = unitPrice * 0.12;
          break;
        case 'tourism-company':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.monthlyPackages * inputs.avgPackagePrice;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyRent;
          monthlyVariable = monthlyRevenue * (inputs.commissionCostRate / 100);
          unitPrice = inputs.avgPackagePrice;
          unitVariableCost = unitPrice * (inputs.commissionCostRate / 100);
          break;
        case 'shipping-company':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.monthlyShipments * inputs.revenuePerShipment;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyRent;
          monthlyVariable = monthlyRevenue * (inputs.operatingCostRate / 100);
          unitPrice = inputs.revenuePerShipment;
          unitVariableCost = unitPrice * (inputs.operatingCostRate / 100);
          break;
        case 'transport-fleet':
          totalInvestment = inputs.vehicleCost;
          monthlyRevenue = inputs.numberOfVehicles * inputs.monthlyTripsPerVehicle * inputs.revenuePerTrip;
          monthlyFixed = inputs.monthlySalaries;
          monthlyVariable = inputs.numberOfVehicles * inputs.monthlyTripsPerVehicle * inputs.fuelMaintenancePerTrip;
          unitPrice = inputs.revenuePerTrip;
          unitVariableCost = inputs.fuelMaintenancePerTrip;
          break;
        case 'distribution-center':
          totalInvestment = inputs.setupCost;
          monthlyRevenue = inputs.monthlyOrders * inputs.revenuePerOrder;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyRent;
          monthlyVariable = monthlyRevenue * (inputs.operatingCostRate / 100);
          unitPrice = inputs.revenuePerOrder;
          unitVariableCost = unitPrice * (inputs.operatingCostRate / 100);
          break;
        case 'last-mile-delivery':
          totalInvestment = inputs.vehicleCost;
          monthlyRevenue = inputs.dailyDeliveries * inputs.revenuePerDelivery * 30;
          monthlyFixed = inputs.monthlySalaries + inputs.monthlyFuelMaintenance;
          monthlyVariable = monthlyRevenue * (inputs.operatingCostRate / 100);
          unitPrice = inputs.revenuePerDelivery;
          unitVariableCost = unitPrice * (inputs.operatingCostRate / 100);
          break;
      }

      // Expert mode refinements
      if (currentMode === 'expert') {
        const expertInvestmentTotal = inputs.landCost + inputs.buildingCost + inputs.renovationCost + inputs.machineryCost + inputs.furnitureCost + inputs.vehiclesCost + inputs.workingCapital + inputs.contingencyReserve + inputs.preOpeningCost + inputs.initialInventoryCost + inputs.permitsAndLicensesCost + inputs.feasibilityStudyCost;
        if (expertInvestmentTotal > 0) {
          totalInvestment = expertInvestmentTotal;
        }

        monthlyFixed += (inputs.insuranceCostAnnual / 12) + (inputs.licenseRenewalCost / 12) + inputs.softwareSubscriptions + inputs.marketingBudget + inputs.mitigationBudget + inputs.energyCostMonthly + inputs.waterCostMonthly + inputs.wasteDisposalCost + inputs.securityCost + inputs.cleaningCost + inputs.outsourcingCost + inputs.trainingCost;
        monthlyVariable += monthlyRevenue * (inputs.maintenanceCostRate / 100) + monthlyRevenue * (inputs.salesCommissionRate / 100);

        if (inputs.loanAmount > 0 && inputs.equityAmount > 0 && (inputs.loanAmount + inputs.equityAmount) > 0) {
          const debtRatio = inputs.loanAmount / (inputs.loanAmount + inputs.equityAmount);
          if (debtRatio > 0.6) expertRiskWeight += 0.15;
          else if (debtRatio > 0.4) expertRiskWeight += 0.05;
        }
        if (inputs.collateralValue > 0 && inputs.loanAmount > 0) {
          const collateralCoverage = inputs.collateralValue / inputs.loanAmount;
          if (collateralCoverage < 1) expertRiskWeight += 0.1;
          else if (collateralCoverage > 1.5) expertRiskWeight -= 0.05;
        }

        const riskScores = [inputs.marketRiskScore, inputs.operationalRiskScore, inputs.financialRiskScore, inputs.regulatoryRiskScore, inputs.technologyRiskScore, inputs.reputationRiskScore, inputs.supplyChainRiskScore, inputs.competitionRiskScore, inputs.currencyRiskScore, inputs.geopoliticalRiskScore].filter(v => typeof v === 'number' && Number.isFinite(v));
        if (riskScores.length > 0) {
          const avgRisk = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
          expertRiskWeight += (avgRisk - 3) * 0.06;
        }

        if (inputs.regulatoryApprovalsNeeded > 5) expertRiskWeight += 0.05;
        if (inputs.environmentalImpact >= 4) expertRiskWeight += 0.08;
      }

      return {
        totalInvestment,
        monthlyFixedCosts: monthlyFixed,
        monthlyVariableCosts: monthlyVariable,
        monthlyRevenue,
        unitPrice,
        unitVariableCost,
        projectMonths: inputs.analysisDuration,
        sectorRiskWeight: Math.max(0.5, expertRiskWeight)
      };
    }

    function showValidationWarnings(validation) {
      const container = document.getElementById('validationWarnings');
      lastValidationValid = validation.valid;
      if (!container) return;
      if (validation.valid) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
      }
      container.classList.remove('hidden');
      const title = isAr ? 'تحذيرات التحقق من البيانات' : 'Data Validation Warnings';
      const fixMsg = isAr ? 'يرجى تصحيح التحذيرات أعلاه قبل إصدار التقرير.' : 'Please fix the warnings above before generating the report.';
      container.innerHTML = '\n        <div class="validation-warnings__title">⚠️ ' + title + '</div>\n        <ul>' + validation.warnings.map(w => '<li>' + w + '</li>').join('') + '</ul>\n        <div class="validation-warnings__footer">' + fixMsg + '</div>\n      ';
    }

    function calculate() {
      const inputs = mapInputs();
      const engineInputs = calculateEngineInputs(inputs);

      if (window.InvestmentValidator && window.InvestmentValidator.validate) {
        const validationInputs = { ...inputs, monthlyRevenue: engineInputs.monthlyRevenue };
        const validation = window.InvestmentValidator.validate(sectorId, validationInputs, isAr ? 'ar' : 'en');
        showValidationWarnings(validation);
        if (!validation.valid) {
          document.getElementById('resultsSection').classList.add('hidden');
          window._lastResult = null;
          return;
        }
      }

      const result = isAr ? window.InvestmentEngine.analyze(engineInputs) : window.InvestmentEngine.analyzeEn(engineInputs);
      if (!result.success) {
        alert(result.error);
        return;
      }

      const m = result.metrics;
      document.getElementById('metricRoi').textContent = formatNumber(m.roi);
      document.getElementById('metricIrr').textContent = formatNumber(m.irr);
      document.getElementById('metricNpv').textContent = formatNumber(m.npv);
      document.getElementById('metricPayback').textContent = formatNumber(m.paybackMonths);
      document.getElementById('metricBreakEven').textContent = formatNumber(m.breakEvenUnits);
      document.getElementById('metricMargin').textContent = formatNumber(m.profitMargin);
      document.getElementById('metricRisk').textContent = formatNumber(m.riskScore);

      const rec = result.recommendation;
      const bar = document.getElementById('recommendationBar');
      bar.style.backgroundColor = rec.color + '20';
      bar.style.borderColor = rec.color;
      document.getElementById('recommendationDecision').textContent = rec.decision;
      document.getElementById('recommendationDecision').style.color = rec.color;

      const reasonsList = document.getElementById('recommendationReasons');
      reasonsList.innerHTML = rec.reasons.map(r => \`<li>\${r}</li>\`).join('');

      // Decision Intelligence Layer
      if (window.DecisionIntelligence && window.DecisionIntelligence.analyze) {
        const diResult = window.DecisionIntelligence.analyze(inputs, result, isAr ? 'ar' : 'en');
        window._lastDecisionResult = diResult;
        renderDecisionIntelligence(diResult);
      }

      document.getElementById('resultsSection').classList.remove('hidden');
      window._lastResult = result;
    }

    function renderDecisionIntelligence(di) {
      const panel = document.getElementById('decisionIntelligencePanel');
      if (!panel) return;
      panel.classList.remove('hidden');

      const conf = di.confidenceScore;
      const fill = document.getElementById('diConfidenceFill');
      const val = document.getElementById('diConfidenceValue');
      if (fill) fill.style.width = conf.score + '%';
      if (val) val.textContent = conf.score + (isAr ? '/100' : '/100');

      window.DecisionIntelligence.renderDecisionPanel('diVerdict', di.recommendation);
      window.DecisionIntelligence.renderSummary('diSummary', di.dataQuality, di.riskAnalysis, di.financingAnalysis, di.marketAnalysis, di.cashFlowAnalysis);
      window.DecisionIntelligence.renderGauge('diRiskGauge', di.riskAnalysis.score, isAr ? 'درجة المخاطر' : 'Risk Score', di.i18n || {});
      window.DecisionIntelligence.renderGauge('diMarketGauge', di.marketAnalysis.score, isAr ? 'درجة السوق' : 'Market Score', di.i18n || {});
      window.DecisionIntelligence.renderGauge('diCashFlowGauge', di.cashFlowAnalysis.score, isAr ? 'درجة التدفق النقدي' : 'Cash Flow Score', di.i18n || {});
      window.DecisionIntelligence.renderList('diRiskList', di.riskAnalysis.categories || [], 'risk');
      window.DecisionIntelligence.renderList('diKeyRisks', di.keyRisks, 'risk');
      window.DecisionIntelligence.renderList('diKeyOpportunities', di.keyOpportunities, 'opportunity');

      const finSummary = document.getElementById('diFinancingSummary');
      if (finSummary) {
        const t = isAr ? window.DecisionIntelligence.i18n.ar : window.DecisionIntelligence.i18n.en;
        finSummary.innerHTML = \`
          <div class="di-metric"><span class="di-metric__label">\${t.debtEquityRatio}</span><span class="di-metric__value">\${di.financingAnalysis.debtEquityRatio.toFixed(2)}</span></div>
          <div class="di-metric"><span class="di-metric__label">\${t.collateralCoverage}</span><span class="di-metric__value">\${di.financingAnalysis.collateralCoverage.toFixed(2)}</span></div>
          <div class="di-metric"><span class="di-metric__label">\${t.dscrEstimate}</span><span class="di-metric__value">\${di.financingAnalysis.dscr.toFixed(2)}</span></div>
          <div class="di-metric"><span class="di-metric__label">\${t.selfFinanceRatio}</span><span class="di-metric__value">\${di.financingAnalysis.selfFinanceRatio.toFixed(1)}%</span></div>
          <p class="di-summary-text">\${di.financingAnalysis.summary}</p>
        \`;
      }

      const marketSummary = document.getElementById('diMarketSummary');
      if (marketSummary) {
        marketSummary.innerHTML = \`
          <p class="di-summary-text">\${di.marketAnalysis.summary}</p>
          <div class="di-metric"><span class="di-metric__label">\${isAr ? 'حصة السوق' : 'Market Share'}</span><span class="di-metric__value">\${di.marketAnalysis.marketShare.toFixed(2)}%</span></div>
        \`;
      }

      const cfSummary = document.getElementById('diCashFlowSummary');
      if (cfSummary) {
        const liquidityLabel = t[di.cashFlowAnalysis.liquidity] || di.cashFlowAnalysis.liquidity;
        cfSummary.innerHTML = \`
          <p class="di-summary-text">\${di.cashFlowAnalysis.summary}</p>
          <div class="di-metric"><span class="di-metric__label">\${isAr ? 'السيولة' : 'Liquidity'}</span><span class="di-metric__value">\${liquidityLabel}</span></div>
        \`;
      }
    }

    async function saveAnalysis() {
      if (!window._lastResult) return alert(isAr ? 'احسب النتيجة أولاً' : 'Calculate first');
      if (!lastValidationValid) return alert(isAr ? 'يرجى تصحيح تحذيرات التحقق قبل الحفظ.' : 'Please fix validation warnings before saving.');
      try {
        const session = await window.BondsAuth?.getSession?.();
        const token = session?.data?.session?.access_token;
        if (!token) return alert(isAr ? 'يجب تسجيل الدخول لحفظ النتيجة' : 'Please sign in to save');
        const res = await fetch('/api/investment-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            sector: sectorId,
            inputs: mapInputs(),
            results: window._lastResult.metrics,
            recommendation: window._lastResult.recommendation,
            decisionIntelligence: window._lastDecisionResult || null
          })
        });
        const json = await res.json();
        alert(json.success ? (isAr ? '✅ تم الحفظ' : '✅ Saved') : (json.error || 'Error'));
      } catch (e) {
        alert(isAr ? 'تعذر الحفظ' : 'Save failed');
      }
    }

    function printReport() {
      if (!window._lastResult) return alert(isAr ? 'احسب النتيجة أولاً' : 'Calculate first');
      if (!lastValidationValid) return alert(isAr ? 'يرجى تصحيح تحذيرات التحقق قبل طباعة التقرير.' : 'Please fix validation warnings before printing the report.');
      const content = document.getElementById('resultsSection').outerHTML;
      if (window.openPrintWindow) {
        window.openPrintWindow({
          content,
          title: title,
          reportType: 'default',
          lang: isAr ? 'ar' : 'en'
        });
      } else {
        window.print();
      }
    }

    function printExecutiveReport() {
      if (!window._lastDecisionResult) return alert(isAr ? 'احسب النتيجة أولاً' : 'Calculate first');
      if (!lastValidationValid) return alert(isAr ? 'يرجى تصحيح تحذيرات التحقق قبل طباعة التقرير.' : 'Please fix validation warnings before printing the report.');
      const html = window._lastDecisionResult.executiveReport;
      const printWindow = window.open('', '_blank');
      if (!printWindow) return alert(isAr ? 'تم حظر النافذة المنبثقة' : 'Popup blocked');
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = function() {
        setTimeout(function() { printWindow.print(); }, 600);
      };
    }
  </script>
</body>
</html>`;
}

function main() {
  const arDir = path.join(ROOT, 'calculators', 'investment-center');
  const enDir = path.join(ROOT, 'en', 'calculators', 'investment-center');

  if (!fs.existsSync(arDir)) fs.mkdirSync(arDir, { recursive: true });
  if (!fs.existsSync(enDir)) fs.mkdirSync(enDir, { recursive: true });

  for (const sector of sectorsAr) {
    fs.writeFileSync(path.join(arDir, `${sector.id}.html`), generatePage(sector, 'ar'), 'utf8');
  }

  for (const sector of sectorsEn) {
    fs.writeFileSync(path.join(enDir, `${sector.id}.html`), generatePage(sector, 'en'), 'utf8');
  }

  console.log(`Generated ${sectorsAr.length} Arabic and ${sectorsEn.length} English sector calculators.`);
}

main();
