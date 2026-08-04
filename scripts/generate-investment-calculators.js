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
      { name: 'bottleSize', label: 'حجم العبوة', type: 'select', section: 'production', basic: true, optionsAr: ['330 مل','500 مل','1.5 لتر','19 لتر (5 جالون)'], optionsEn: ['330 ml','500 ml','1.5 L','19 L (5 gallon)'], default: '500 مل' },
      { name: 'dailyProduction', label: 'الإنتاج اليومي الأقصى (عبوة)', type: 'number', section: 'production', basic: true, default: 20000 },
      { name: 'operatingHoursPerDay', label: 'ساعات التشغيل اليومية', type: 'number', section: 'production', default: 16 },
      { name: 'shiftCount', label: 'عدد الورديات', type: 'number', section: 'production', default: 2 },
      { name: 'initialCapacityUtilization', label: 'نسبة التشغيل الفعلية في الشهر الأول (%)', type: 'number', section: 'production', basic: true, default: 60 },
      { name: 'monthlyGrowthRate', label: 'معدل نمو المبيعات الشهري (%)', type: 'number', section: 'production', default: 5 },
      { name: 'wastageRate', label: 'نسبة الهدر / الفاقد (%)', type: 'number', section: 'production', basic: true, default: 2 },
      { name: 'bottlePrice', label: 'سعر بيع العبوة للمستهلك (ر.س)', type: 'number', section: 'pricing', basic: true, default: 1.2 },
      { name: 'directSalesRate', label: 'نسبة المبيعات المباشرة (%)', type: 'number', section: 'pricing', basic: true, default: 30 },
      { name: 'distributorSalesRate', label: 'نسبة المبيعات عبر الموزعين (%)', type: 'number', section: 'pricing', default: 50 },
      { name: 'distributorDiscountRate', label: 'نسبة خصم الموزع (%)', type: 'number', section: 'pricing', default: 20 },
      { name: 'platformSalesRate', label: 'نسبة المبيعات عبر المنصات (%)', type: 'number', section: 'pricing', default: 20 },
      { name: 'platformCommissionRate', label: 'عمولة المنصة (%)', type: 'number', section: 'pricing', default: 15 },
      { name: 'bottleCostPerUnit', label: 'تكلفة الزجاجة/الغالون (ر.س)', type: 'number', section: 'materials', basic: true, default: 0.25 },
      { name: 'capCostPerUnit', label: 'تكلفة الغطاء (ر.س)', type: 'number', section: 'materials', default: 0.05 },
      { name: 'labelCostPerUnit', label: 'تكلفة الليبل/الستيكر (ر.س)', type: 'number', section: 'materials', default: 0.05 },
      { name: 'cartonCostPerBottle', label: 'تكلفة الكرتون للعبوة (ر.س)', type: 'number', section: 'materials', default: 0.08 },
      { name: 'shrinkCostPerBottle', label: 'تكلفة الشرنك للعبوة (ر.س)', type: 'number', section: 'materials', default: 0.05 },
      { name: 'logisticsCostPerBottle', label: 'تكلفة اللوجستيك للعبوة (ر.س)', type: 'number', section: 'logistics', basic: true, default: 0.12 },
      { name: 'deliveryRegionsCount', label: 'عدد المناطق المخدومة', type: 'number', section: 'logistics', default: 5 },
      { name: 'avgDeliveryDistanceKm', label: 'متوسط المسافة للتوصيل (كم)', type: 'number', section: 'logistics', default: 25 },
      { name: 'deliveryCostPerKm', label: 'تكلفة التوصيل للكم (ر.س)', type: 'number', section: 'logistics', default: 2 },
      { name: 'bottlesPerDeliveryTrip', label: 'عدد العبوات لكل رحلة توصيل', type: 'number', section: 'logistics', default: 500 },
      { name: 'kWhPerThousandBottles', label: 'استهلاك الكهرباء لكل 1000 عبوة (كيلوواط)', type: 'number', section: 'energy', default: 8 },
      { name: 'electricityRatePerKwh', label: 'سعر الكهرباء (ر.س/كيلوواط)', type: 'number', section: 'energy', basic: true, default: 0.18 },
      { name: 'waterM3PerThousandBottles', label: 'استهلاك المياه لكل 1000 عبوة (م³)', type: 'number', section: 'energy', default: 1.5 },
      { name: 'waterRatePerM3', label: 'سعر المياه (ر.س/م³)', type: 'number', section: 'energy', basic: true, default: 2.5 },
      { name: 'warehouseAreaM2', label: 'مساحة المستودع والمصنع (م²)', type: 'number', section: 'facility', basic: true, default: 800 },
      { name: 'buildingCostPerM2', label: 'تكلفة البناء للمتر المربع (ر.س)', type: 'number', section: 'facility', basic: true, default: 1500 },
      { name: 'factoryCost', label: 'تكلفة المصنع والآلات (ر.س)', type: 'number', section: 'facility', basic: true, default: 4000000 },
      { name: 'maintenanceRate', label: 'نسبة الصيانة والإهلاك الشهرية من تكلفة المصنع (%)', type: 'number', section: 'facility', basic: true, default: 1 },
      { name: 'monthlyLicenseInsurance', label: 'تراخيص وتأمين وتنظيم شهري (ر.س)', type: 'number', section: 'facility', basic: true, default: 8000 },
      { name: 'labCostMonthly', label: 'تكلفة المختبر الشهرية (ر.س)', type: 'number', section: 'facility', basic: true, default: 10000 },
      { name: 'workersPerShift', label: 'عدد العمال لكل وردية', type: 'number', section: 'labor', basic: true, default: 6 },
      { name: 'shiftCostPerWorker', label: 'تكلفة العامل للوردية (ر.س)', type: 'number', section: 'labor', basic: true, default: 150 },
      { name: 'monthlyWorkingDays', label: 'أيام العمل شهرياً', type: 'number', section: 'labor', basic: true, default: 26 },
      { name: 'monthlySalaries', label: 'الرواتب والعمالة الشهرية (ر.س)', type: 'number', section: 'labor', basic: true, default: 55000 },
      { name: 'monthlyNewCustomers', label: 'عدد العملاء الجدد شهرياً', type: 'number', section: 'marketing', basic: true, default: 40 },
      { name: 'marketingCostPerCustomer', label: 'تكلفة اكتساب العميل (ر.س)', type: 'number', section: 'marketing', basic: true, default: 400 },
      { name: 'equityRatio', label: 'نسبة التمويل الذاتي (%)', type: 'number', section: 'finance', basic: true, default: 30 },
      { name: 'loanInterestRate', label: 'معدل الفائدة السنوي للقرض (%)', type: 'number', section: 'finance', basic: true, default: 7 },
      { name: 'loanTermYears', label: 'فترة سداد القرض (سنوات)', type: 'number', section: 'finance', basic: true, default: 5 },
      { name: 'rawMaterialInventoryDays', label: 'أيام مخزون المواد الخام', type: 'number', section: 'finance', default: 15 },
      { name: 'annualCostInflation', label: 'معدل تضخم التكاليف سنوياً (%)', type: 'number', section: 'finance', default: 3 },
      { name: 'annualPriceIncrease', label: 'معدل زيادة الأسعار سنوياً (%)', type: 'number', section: 'finance', default: 2 },
      { name: 'maxCapacityUtilization', label: 'أقصى استغلال للطاقة الإنتاجية (%)', type: 'number', section: 'finance', default: 95 },
      { name: 'capacityExpansionThreshold', label: 'عتبة التوسعة عند استغلال الطاقة (%)', type: 'number', section: 'finance', default: 85 },
      { name: 'capacityExpansionAmount', label: 'نسبة زيادة الطاقة عند التوسعة (%)', type: 'number', section: 'finance', default: 50 },
      { name: 'capacityExpansionCostRate', label: 'تكلفة التوسعة كنسبة من تكلفة المصنع (%)', type: 'number', section: 'finance', default: 30 },
      { name: 'dsoDays', label: 'فترة تحصيل الذمم المدينة (DSO) بالأيام', type: 'number', section: 'finance', default: 15 },
      { name: 'dioDays', label: 'فترة دوران المخزون (DIO) بالأيام', type: 'number', section: 'finance', default: 20 },
      { name: 'dpoDays', label: 'فترة سداد الدائنين (DPO) بالأيام', type: 'number', section: 'finance', default: 30 },
      { name: 'risk1Name', label: 'اسم المخاطرة الأولى', type: 'text', section: 'risks', default: 'ارتفاع أسعار المواد' },
      { name: 'risk1Probability', label: 'احتمالية المخاطرة الأولى (%)', type: 'number', section: 'risks', default: 30 },
      { name: 'risk1Impact', label: 'تأثير المخاطرة الأولى (ر.س/شهر)', type: 'number', section: 'risks', default: 10000 },
      { name: 'risk2Name', label: 'اسم المخاطرة الثانية', type: 'text', section: 'risks', default: 'انخفاض الطلب' },
      { name: 'risk2Probability', label: 'احتمالية المخاطرة الثانية (%)', type: 'number', section: 'risks', default: 25 },
      { name: 'risk2Impact', label: 'تأثير المخاطرة الثانية (ر.س/شهر)', type: 'number', section: 'risks', default: 20000 },
      { name: 'risk3Name', label: 'اسم المخاطرة الثالثة', type: 'text', section: 'risks', default: 'عطل المعدات' },
      { name: 'risk3Probability', label: 'احتمالية المخاطرة الثالثة (%)', type: 'number', section: 'risks', default: 15 },
      { name: 'risk3Impact', label: 'تأثير المخاطرة الثالثة (ر.س/شهر)', type: 'number', section: 'risks', default: 15000 }
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
  'حجم العبوة': 'Bottle size',
  'الإنتاج اليومي الأقصى (عبوة)': 'Max daily production (bottles)',
  'ساعات التشغيل اليومية': 'Operating hours per day',
  'عدد الورديات': 'Number of shifts',
  'نسبة التشغيل الفعلية في الشهر الأول (%)': 'Initial capacity utilization (%)',
  'معدل نمو المبيعات الشهري (%)': 'Monthly sales growth rate (%)',
  'سعر بيع العبوة للمستهلك (ر.س)': 'Bottle consumer price (SAR)',
  'تكلفة الزجاجة/الغالون (ر.س)': 'Bottle/gallon cost (SAR)',
  'تكلفة الغطاء (ر.س)': 'Cap cost (SAR)',
  'تكلفة الليبل/الستيكر (ر.س)': 'Label/sticker cost (SAR)',
  'تكلفة الكرتون للعبوة (ر.س)': 'Carton cost per bottle (SAR)',
  'تكلفة الشرنك للعبوة (ر.س)': 'Shrink wrap cost per bottle (SAR)',
  'تكلفة اللوجستيك للعبوة (ر.س)': 'Logistics cost per bottle (SAR)',
  'نسبة الهدر / الفاقد (%)': 'Wastage rate (%)',
  'استهلاك الكهرباء لكل 1000 عبوة (كيلوواط)': 'Electricity kWh per 1000 bottles',
  'سعر الكهرباء (ر.س/كيلوواط)': 'Electricity rate (SAR/kWh)',
  'استهلاك المياه لكل 1000 عبوة (م³)': 'Water m³ per 1000 bottles',
  'سعر المياه (ر.س/م³)': 'Water rate (SAR/m³)',
  'مساحة المستودع والمصنع (م²)': 'Warehouse & factory area (m²)',
  'تكلفة البناء للمتر المربع (ر.س)': 'Construction cost per m² (SAR)',
  'تكلفة المصنع والآلات (ر.س)': 'Factory & machinery cost (SAR)',
  'نسبة الصيانة والإهلاك الشهرية من تكلفة المصنع (%)': 'Monthly maintenance & depreciation rate (%)',
  'الرواتب والعمالة الشهرية (ر.س)': 'Monthly salaries & labor (SAR)',
  'تراخيص وتأمين وتنظيم شهري (ر.س)': 'Monthly licenses, insurance & compliance (SAR)',
  'تكلفة المختبر الشهرية (ر.س)': 'Monthly lab cost (SAR)',
  'عدد العملاء الجدد شهرياً': 'Monthly new customers',
  'تكلفة اكتساب العميل (ر.س)': 'Customer acquisition cost (SAR)',
  'نسبة التمويل الذاتي (%)': 'Equity ratio (%)',
  'معدل الفائدة السنوي للقرض (%)': 'Annual loan interest rate (%)',
  'فترة سداد القرض (سنوات)': 'Loan term (years)',
  'أيام مخزون المواد الخام': 'Raw material inventory days',
  'نسبة المبيعات المباشرة (%)': 'Direct sales ratio (%)',
  'نسبة المبيعات عبر الموزعين (%)': 'Distributor sales ratio (%)',
  'نسبة خصم الموزع (%)': 'Distributor discount (%)',
  'نسبة المبيعات عبر المنصات (%)': 'Platform sales ratio (%)',
  'عمولة المنصة (%)': 'Platform commission (%)',
  'عدد العمال لكل وردية': 'Workers per shift',
  'تكلفة العامل للوردية (ر.س)': 'Cost per worker per shift (SAR)',
  'أيام العمل شهرياً': 'Monthly working days',
  'معدل تضخم التكاليف سنوياً (%)': 'Annual cost inflation (%)',
  'معدل زيادة الأسعار سنوياً (%)': 'Annual price increase (%)',
  'أقصى استغلال للطاقة الإنتاجية (%)': 'Max capacity utilization (%)',
  'عتبة التوسعة عند استغلال الطاقة (%)': 'Capacity expansion threshold (%)',
  'نسبة زيادة الطاقة عند التوسعة (%)': 'Capacity expansion amount (%)',
  'تكلفة التوسعة كنسبة من تكلفة المصنع (%)': 'Capacity expansion cost rate (%)',
  'فترة تحصيل الذمم المدينة (DSO) بالأيام': 'Days Sales Outstanding (DSO)',
  'فترة دوران المخزون (DIO) بالأيام': 'Days Inventory Outstanding (DIO)',
  'فترة سداد الدائنين (DPO) بالأيام': 'Days Payable Outstanding (DPO)',
  'عدد المناطق المخدومة': 'Delivery regions count',
  'متوسط المسافة للتوصيل (كم)': 'Average delivery distance (km)',
  'تكلفة التوصيل للكم (ر.س)': 'Delivery cost per km (SAR)',
  'عدد العبوات لكل رحلة توصيل': 'Bottles per delivery trip',
  'اسم المخاطرة الأولى': 'Risk 1 name',
  'احتمالية المخاطرة الأولى (%)': 'Risk 1 probability (%)',
  'تأثير المخاطرة الأولى (ر.س/شهر)': 'Risk 1 impact (SAR/month)',
  'اسم المخاطرة الثانية': 'Risk 2 name',
  'احتمالية المخاطرة الثانية (%)': 'Risk 2 probability (%)',
  'تأثير المخاطرة الثانية (ر.س/شهر)': 'Risk 2 impact (SAR/month)',
  'اسم المخاطرة الثالثة': 'Risk 3 name',
  'احتمالية المخاطرة الثالثة (%)': 'Risk 3 probability (%)',
  'تأثير المخاطرة الثالثة (ر.س/شهر)': 'Risk 3 impact (SAR/month)',
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

  if (field.type === 'select') {
    const isAr = lang === 'ar';
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

function renderGenericRiskAnalysis(sector, isAr) {
  const numericFields = sector.fields.filter(f => f.type === 'number' && !f.name.match(/(rate|ratio|month|year|percentage|days|hours|count)/i));
  const candidateFields = numericFields.length > 0 ? numericFields : sector.fields.filter(f => f.type === 'number');
  const goalSeekOptions = candidateFields.map(f => {
    const label = isAr ? f.label : (translateLabel(f.label) || f.label);
    return `<option value="${f.name}">${label}</option>`;
  }).join('');
  const tornadoOptions = candidateFields.slice(0, 8).map(f => {
    const label = isAr ? f.label : (translateLabel(f.label) || f.label);
    return `<option value="${f.name}">${label}</option>`;
  }).join('');

  return `
      <div class="generic-risk-analysis" style="background: rgba(16,24,45,0.5); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; margin: 1.5rem 0;">
        <h3 style="margin-top: 0; color: var(--gold);">${isAr ? 'تحليل المخاطر المتقدم' : 'Advanced Risk Analysis'}</h3>
        <p style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? 'محاكاة مونت كارلو والبحث عن الهدف وتحليل الحساسية وخيارات الاستثمار الحقيقية.' : 'Monte Carlo, goal seek, sensitivity analysis, and real options.'}</p>
        <div id="sectorAnomalyList" style="margin-bottom: 1rem;"></div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">${isAr ? 'تحليل الحساسية (Tornado Chart)' : 'Sensitivity Analysis (Tornado Chart)'}</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? 'اختر حتى 5 متغيرات ونسبة التقلب لرسم تأثير كل متغير على NPV.' : 'Select up to 5 variables and shock range to plot impact on NPV.'}</p>
          <div style="display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1rem;">
            <div style="flex: 2; min-width: 200px;">
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'المتغيرات' : 'Variables'}</label>
              <select id="sectorTornadoFields" multiple style="width: 100%; min-height: 100px; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);">${tornadoOptions}</select>
            </div>
            <div style="flex: 1; min-width: 140px;">
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'نسبة التقلب (±%)' : 'Shock Range (±%)'}</label>
              <input type="range" id="sectorTornadoRange" min="10" max="50" value="20" style="width: 100%;" oninput="document.getElementById('sectorTornadoRangeValue').textContent = this.value + '%'" />
              <div id="sectorTornadoRangeValue" style="font-size: 0.8rem; color: var(--text-secondary);">20%</div>
            </div>
            <button type="button" class="btn btn--primary" onclick="runSectorTornado()" style="white-space: nowrap;">${isAr ? 'ارسم' : 'Plot'}</button>
          </div>
          <div style="height: 260px; position: relative;">
            <canvas id="sectorTornadoChart"></canvas>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">${isAr ? 'محاكاة مونت كارلو' : 'Monte Carlo Simulation'}</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? '500 سيناريو عشوائي للمتغيرات الرئيسية.' : '500 random scenarios for key variables.'}</p>
          <div class="monte-carlo-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'نسبة النجاح' : 'Success Rate'}</strong><br><span id="sectorMcSuccessRate">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>NPV ${isAr ? 'متوسط' : 'Mean'}</strong><br><span id="sectorMcMeanNpv">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>VaR 95%</strong><br><span id="sectorMcVar95">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>CVaR 95%</strong><br><span id="sectorMcCvar95">--</span></div>
          </div>
          <div style="height: 220px; position: relative;">
            <canvas id="sectorMonteCarloChart"></canvas>
          </div>
          <button type="button" class="btn btn--secondary" onclick="runSectorMonteCarlo()" style="margin-top: 0.75rem;">${isAr ? 'تشغيل المحاكاة' : 'Run Simulation'}</button>
          <button type="button" class="btn btn--secondary" onclick="exportSectorMonteCarloCsv()" style="margin-top: 0.75rem; margin-${isAr ? 'right' : 'left'}: 0.5rem;">${isAr ? 'تصدير CSV' : 'Export CSV'}</button>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">${isAr ? 'خيارات الاستثمار الحقيقية (Real Options)' : 'Real Options Valuation'}</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? 'قيّم قيمة المرونة الاستراتيجية: التوسعة، التأجيل، أو التخلي.' : 'Value strategic flexibility: expand, defer, or abandon.'}</p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'نوع الخيار' : 'Option Type'}</label>
              <select id="realOptionType" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);">
                <option value="expand">${isAr ? 'توسعة' : 'Expand'}</option>
                <option value="defer">${isAr ? 'تأجيل' : 'Defer'}</option>
                <option value="abandon">${isAr ? 'تخلي' : 'Abandon'}</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'التقلب السنوي σ (%)' : 'Volatility σ (%)'}</label>
              <input type="number" id="realOptionVolatility" value="30" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);" />
            </div>
            <div>
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'المدة (سنوات)' : 'Time (years)'}</label>
              <input type="number" id="realOptionTime" value="2" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);" />
            </div>
            <div>
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'معدل خالٍ من المخاطر r (%)' : 'Risk-free Rate r (%)'}</label>
              <input type="number" id="realOptionRate" value="5" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);" />
            </div>
            <div>
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'سعر التنفيذ / التكلفة (ر.س)' : 'Strike / Cost (SAR)'}</label>
              <input type="number" id="realOptionStrike" value="0" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);" />
            </div>
          </div>
          <button type="button" class="btn btn--primary" onclick="runRealOption()" style="margin-bottom: 1rem;">${isAr ? 'احسب قيمة الخيار' : 'Calculate Option Value'}</button>
          <div class="real-option-result" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'قيمة الخيار' : 'Option Value'}</strong><br><span id="realOptionValue">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'القيمة الجوهرية' : 'Intrinsic Value'}</strong><br><span id="realOptionIntrinsic">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'القيمة الزمنية' : 'Time Value'}</strong><br><span id="realOptionTimeValue">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'التوصية' : 'Recommendation'}</strong><br><span id="realOptionRecommendation">--</span></div>
          </div>
        </div>

        <div>
          <h4 style="color: var(--gold);">${isAr ? 'البحث عن الهدف (Goal Seek)' : 'Goal Seek'}</h4>
          <div style="display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1rem;">
            <div style="flex: 1; min-width: 200px;">
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'المتغير' : 'Variable'}</label>
              <select id="sectorGoalSeekField" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);">${goalSeekOptions}</select>
            </div>
            <div style="flex: 1; min-width: 140px;">
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'المؤشر المستهدف' : 'Target Metric'}</label>
              <select id="sectorGoalSeekMetric" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);">
                <option value="npv">NPV</option>
                <option value="irr">IRR</option>
                <option value="roi">ROI</option>
              </select>
            </div>
            <div style="flex: 1; min-width: 140px;">
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'القيمة المستهدفة' : 'Target Value'}</label>
              <input type="number" id="sectorGoalSeekValue" value="0" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);" />
            </div>
            <button type="button" class="btn btn--primary" onclick="runSectorGoalSeek()" style="white-space: nowrap;">${isAr ? 'احسب' : 'Calculate'}</button>
          </div>
          <div class="goal-seek-result" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'القيمة المطلوبة' : 'Required Value'}</strong><br><span id="sectorGsRequiredValue">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'المؤشر عند القيمة' : 'Metric at Value'}</strong><br><span id="sectorGsMetricAtValue">--</span></div>
          </div>
        </div>
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

  const sectionTitles = {
    ar: {
      production: '🏭 الإنتاج والتشغيل',
      pricing: '💰 التسعير وقنوات البيع',
      materials: '📦 المواد والتغليف',
      logistics: '🚚 اللوجستيك والتوزيع',
      energy: '⚡ الكهرباء والمياه',
      facility: '🏢 المنشأة والمعدات',
      labor: '👷 العمالة',
      marketing: '📣 التسويق',
      finance: '💳 التمويل والتضخم',
      risks: '⚠️ المخاطر'
    },
    en: {
      production: '🏭 Production & Operations',
      pricing: '💰 Pricing & Sales Channels',
      materials: '📦 Materials & Packaging',
      logistics: '🚚 Logistics & Distribution',
      energy: '⚡ Electricity & Water',
      facility: '🏢 Facility & Equipment',
      labor: '👷 Labor',
      marketing: '📣 Marketing',
      finance: '💳 Financing & Inflation',
      risks: '⚠️ Risks'
    }
  };

  function renderGroupedFields(fields, lang, prefix = '', mode = 'basic') {
    const isAr = lang === 'ar';
    const isBasic = mode === 'basic';
    const groups = {};
    fields.forEach(f => {
      if (isBasic && f.basic === false) return;
      if (isBasic && f.basic !== true) return;
      const section = f.section || 'general';
      if (!groups[section]) groups[section] = [];
      groups[section].push(f);
    });

    const order = ['production', 'pricing', 'materials', 'logistics', 'energy', 'facility', 'labor', 'marketing', 'finance', 'risks'];
    return order.map(section => {
      if (!groups[section]) return '';
      const title = (isAr ? sectionTitles.ar[section] : sectionTitles.en[section]) || section;
      const sectionId = 'section_' + prefix + section;
      const fieldsHtml = groups[section].map(f => renderInputField(f, lang, prefix)).join('');
      return `
          <div class="input-section">
            <button type="button" class="input-section__toggle" onclick="toggleSection('${sectionId}')">
              <span>${title}</span>
              <span class="input-section__icon">▼</span>
            </button>
            <div id="${sectionId}" class="input-section__content">
              ${fieldsHtml}
            </div>
          </div>`;
    }).join('');
  }

  const basicFieldsHtml = sector.id === 'water-factory' ? renderGroupedFields(sector.fields, lang, '', 'basic') : sector.fields.map(f => renderInputField(f, lang)).join('');
  const expertBasicFieldsHtml = sector.id === 'water-factory' ? renderGroupedFields(sector.fields, lang, 'expert_basic_', 'expert') : sector.fields.map(f => renderInputField(f, lang, 'expert_basic_')).join('');

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
  <link rel="stylesheet" href="${isAr ? '../../' : '../../../'}header-footer.css?v=2.54.0" />
  <link rel="stylesheet" href="${isAr ? './investment-center.css?v=2' : '../../../calculators/investment-center/investment-center.css?v=2'}" />
  <link rel="icon" type="image/svg+xml" href="${isAr ? '../../' : '../../../'}assets/bonds-mark.svg" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <link rel="stylesheet" href="${isAr ? '../../' : '../../../'}components/universal-dropdown.css" />
  <script src="${isAr ? '../../' : '../../../'}components/universal-dropdown.js"></script>
  <script src="${isAr ? '../../calculators/' : '../../../calculators/'}shared-geo.js?v=6"></script>
  <script src="${isAr ? '../../calculators/' : '../../../calculators/'}shared-platforms.js?v=2"></script>
  <script src="${isAr ? '../../calculators/' : '../../../calculators/'}shared-country-selector.js?v=3"></script>
  ${sector.id === 'water-factory' ? `
  <style>
    .input-section { margin-bottom: 0.75rem; border: 1px solid rgba(197,160,40,0.15); border-radius: 12px; overflow: hidden; }
    .input-section__toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 1.1rem; background: rgba(16,24,45,0.8); color: var(--gold); border: none; font-size: 1rem; font-weight: 700; cursor: pointer; text-align: inherit; }
    .input-section__toggle:hover { background: rgba(212,168,83,0.1); }
    .input-section__icon { font-size: 0.75rem; transition: transform 0.2s; }
    .input-section.collapsed .input-section__icon { transform: rotate(-90deg); }
    .input-section__content { padding: 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
    .input-section.collapsed .input-section__content { display: none; }
    .water-factory-advanced table { width: 100%; border-collapse: collapse; }
    .water-factory-advanced th, .water-factory-advanced td { padding: 0.5rem; border-bottom: 1px solid rgba(197,160,40,0.1); }
  </style>` : ''}
</head>
<body>
  <div id="site-header"></div>

  <main class="investment-calculator">
    <div class="investment-calculator__header">
      <div style="font-size:3rem;margin-bottom:var(--space-3);">${sector.icon}</div>
      <h1>${title}</h1>
      <p>${desc}</p>
    </div>

    <div class="investment-panel country-selector-panel">
      <h2>${isAr ? 'الدولة / العملة' : 'Country / Currency'}</h2>
      <div class="investment-input-group">
        <label for="country">${isAr ? 'اختر الدولة' : 'Select country'}</label>
        <select id="country" data-universal-dropdown="true" data-ud-search="true" data-ud-sort="true" data-ud-remove-empty="true"></select>
        <small style="display:block;margin-top:0.5rem;color:var(--text-secondary);">${isAr ? 'ستتغير رموز العملة فقط؛ الأرقام تبقى كما أدخلتها.' : 'Only currency symbols will change; numbers remain as you entered them.'}</small>
      </div>
    </div>

    <div class="mode-toggle" role="group" aria-label="${isAr ? 'تبديل الوضع' : 'Mode toggle'}">
      <button type="button" class="mode-toggle__btn active" data-mode="basic" onclick="setMode('basic')">${basicLabel}</button>
      <button type="button" class="mode-toggle__btn" data-mode="expert" onclick="setMode('expert')">${expertLabel}</button>
    </div>

    <div id="basicMode" class="mode-panel" data-active="true">
      <div class="investment-form">
        <div class="investment-panel">
          <h2>${isAr ? 'بيانات المشروع' : 'Project Data'}</h2>
          ${sector.id === 'water-factory' ? `
          <div class="autofill-actions" style="margin-bottom: 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" class="btn btn--secondary" onclick="fillFromMarketData()">${isAr ? '🌍 ملء تلقائي من بيانات السوق' : '🌍 Auto-fill from market data'}</button>
            <button type="button" class="btn btn--secondary" onclick="fillFromUserProfile()">${isAr ? '👤 ملء من ملفي الشخصي' : '👤 Fill from my profile'}</button>
            <button type="button" class="btn btn--secondary" onclick="suggestWithAI()">${isAr ? '🤖 اقتراحات ذكية' : '🤖 AI Suggestions'}</button>
          </div>
          <div class="factory-size-presets" style="margin-bottom: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <span style="color:var(--text-secondary);font-size:0.85rem;align-self:center;">${isAr ? 'قالب حجم المصنع:' : 'Factory size preset:'}</span>
            <button type="button" class="btn btn--ghost" onclick="applyFactoryTemplate('small')">${isAr ? 'صغير (5K/يوم)' : 'Small (5K/day)'}</button>
            <button type="button" class="btn btn--ghost" onclick="applyFactoryTemplate('medium')">${isAr ? 'متوسط (20K/يوم)' : 'Medium (20K/day)'}</button>
            <button type="button" class="btn btn--ghost" onclick="applyFactoryTemplate('large')">${isAr ? 'كبير (50K/يوم)' : 'Large (50K/day)'}</button>
          </div>
          <div class="autofill-disclaimer" style="margin-bottom: 1rem; padding: 0.75rem 1rem; background: rgba(212,168,83,0.08); border: 1px solid rgba(212,168,83,0.2); border-radius: 8px; color: var(--text-secondary); font-size: 0.85rem;">
            ${isAr
              ? '⚠️ الأرقام التالية قيم استرشادية مبنية على متوسطات سوقية عامة. لا تعتمد عليها وحدها لاتخاذ قرار استثماري — راجع عروض الموردين والتعرفات المحلية والدراسة الجدوى الفعلية.'
              : '⚠️ The numbers below are indicative benchmarks based on general market averages. Do not rely on them alone for investment decisions — review actual supplier quotes, local tariffs, and a real feasibility study.'}
          </div>
          <div id="waterFactoryCountryInfo" style="margin-bottom: 1rem;"></div>
          ` : ''}
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

      ${sector.id === 'water-factory' ? `
      <div class="executive-summary" style="background: rgba(16,24,45,0.7); border: 1px solid rgba(212,168,83,0.2); border-radius: 16px; padding: 1.25rem; margin: 1.5rem 0;">
        <h3 style="margin-top: 0; color: var(--gold);">${isAr ? 'ملخص تنفيذي للعميل' : 'Executive Summary for Client'}</h3>
        <div id="executiveSummaryText" style="line-height: 1.7; color: var(--text);"></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-top: 1rem;">
          <div style="text-align: center; padding: 0.75rem; background: rgba(212,168,83,0.08); border-radius: 10px;">
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? 'الاستثمار الأولي' : 'Initial Investment'}</div>
            <div id="esTotalInvestment" style="font-weight: 700; color: var(--gold);">--</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: rgba(212,168,83,0.08); border-radius: 10px;">
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? 'الربح الشهري المتوقع' : 'Expected Monthly Profit'}</div>
            <div id="esMonthlyProfit" style="font-weight: 700; color: var(--gold);">--</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: rgba(212,168,83,0.08); border-radius: 10px;">
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? 'عدد العبوات المطلوبة للتعادل' : 'Break-even Bottles'}</div>
            <div id="esBreakEven" style="font-weight: 700; color: var(--gold);">--</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: rgba(212,168,83,0.08); border-radius: 10px;">
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? 'التدفق النقدي السنوي' : 'Annual Cash Flow'}</div>
            <div id="esAnnualCashFlow" style="font-weight: 700; color: var(--gold);">--</div>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="recommendation-bar" id="recommendationBar">
        <div class="recommendation-bar__label">${isAr ? 'التوصية الاستثمارية' : 'Investment Recommendation'}</div>
        <div class="recommendation-bar__decision" id="recommendationDecision">--</div>
      </div>

      <div class="recommendation-reasons">
        <h3>${isAr ? 'أسباب القرار' : 'Reasons for Decision'}</h3>
        <ul id="recommendationReasons"></ul>
      </div>

      ${renderGenericRiskAnalysis(sector, isAr)}

      ${sector.id === 'water-factory' ? `
      <!-- Water Factory Advanced Analysis -->
      <div class="water-factory-advanced">
        <div class="scenario-buttons" style="margin: 1.5rem 0; display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button type="button" class="btn btn--secondary" onclick="loadScenario('pessimistic')">${isAr ? '📉 تحميل سيناريو متشائم' : '📉 Load pessimistic scenario'}</button>
          <button type="button" class="btn btn--primary" onclick="loadScenario('expected')">${isAr ? '📊 تحميل سيناريو متوقع' : '📊 Load expected scenario'}</button>
          <button type="button" class="btn btn--secondary" onclick="loadScenario('optimistic')">${isAr ? '📈 تحميل سيناريو متفائل' : '📈 Load optimistic scenario'}</button>
        </div>

        <div class="financing-summary" style="background: rgba(212,168,83,0.08); border: 1px solid rgba(212,168,83,0.2); border-radius: 12px; padding: 1rem 1.25rem; margin: 1.5rem 0;">
          <h3 style="margin-top: 0;">${isAr ? 'ملخص التمويل' : 'Financing Summary'}</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem;">
            <div><strong>${isAr ? 'إجمالي الاستثمار' : 'Total investment'}</strong><br><span id="wfTotalInvestment">--</span></div>
            <div><strong>${isAr ? 'التمويل الذاتي' : 'Equity'}</strong><br><span id="wfEquity">--</span></div>
            <div><strong>${isAr ? 'مبلغ القرض' : 'Loan amount'}</strong><br><span id="wfLoanAmount">--</span></div>
            <div><strong>${isAr ? 'القسط الشهري' : 'Monthly installment'}</strong><br><span id="wfMonthlyInstallment">--</span></div>
          </div>
        </div>

        <div class="sensitivity-analysis" style="margin: 1.5rem 0;">
          <h3>${isAr ? 'تحليل الحساسية' : 'Sensitivity Analysis'}</h3>
          <div style="overflow-x: auto;">
            <table class="sensitivity-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: ${isAr ? 'right' : 'left'}; padding: 0.5rem;">${isAr ? 'المتغير' : 'Variable'}</th>
                  <th style="text-align: center; padding: 0.5rem;">-20%</th>
                  <th style="text-align: center; padding: 0.5rem;">-10%</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'الأساس' : 'Base'}</th>
                  <th style="text-align: center; padding: 0.5rem;">+10%</th>
                  <th style="text-align: center; padding: 0.5rem;">+20%</th>
                </tr>
              </thead>
              <tbody id="sensitivityTableBody"></tbody>
            </table>
          </div>
        </div>

        <div class="cashflow-analysis" style="margin: 1.5rem 0;">
          <h3>${isAr ? 'التدفقات النقدية الشهرية (12 شهر)' : 'Monthly Cash Flow (12 months)'}</h3>
          <div style="overflow-x: auto;">
            <table class="cashflow-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: ${isAr ? 'right' : 'left'}; padding: 0.5rem;">${isAr ? 'الشهر' : 'Month'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'الإيراد' : 'Revenue'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'التكاليف' : 'Costs'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'صافي التدفق' : 'Net Cash Flow'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'الرصيد التراكمي' : 'Cumulative Balance'}</th>
                </tr>
              </thead>
              <tbody id="cashflowTableBody"></tbody>
            </table>
          </div>
        </div>

        <div class="pro-forma-statements" style="margin: 1.5rem 0;">
          <h3>${isAr ? 'القوائم المالية التقديرية (Pro-Forma)' : 'Pro-Forma Financial Statements'}</h3>
          <div class="pro-forma-summary" style="background: rgba(212,168,83,0.08); border: 1px solid rgba(212,168,83,0.2); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
              <div><strong>${isAr ? 'إجمالي الإيرادات' : 'Total Revenue'}</strong><br><span id="pfTotalRevenue">--</span></div>
              <div><strong>${isAr ? 'صافي الربح' : 'Net Income'}</strong><br><span id="pfTotalNetIncome">--</span></div>
              <div><strong>NPV</strong><br><span id="pfNpv">--</span></div>
              <div><strong>IRR</strong><br><span id="pfIrr">--</span></div>
              <div><strong>${isAr ? 'التمويل المطلوب' : 'Funding Gap'}</strong><br><span id="pfFundingGap">--</span></div>
              <div><strong>${isAr ? 'التوسعات الرأسمالية' : 'Step Capex'}</strong><br><span id="pfStepCapex">--</span></div>
            </div>
          </div>

          <div id="capacityExpansionsPanel" style="margin-bottom: 1rem; display: none;">
            <h4 style="color: var(--gold);">${isAr ? 'جدول التوسعات الرأسمالية' : 'Capacity Expansion Schedule'}</h4>
            <div style="overflow-x: auto;">
              <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border);">
                    <th style="text-align: ${isAr ? 'right' : 'left'}; padding: 0.5rem;">${isAr ? 'الشهر' : 'Month'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'الطاقة الجديدة (عبوة/يوم)' : 'New Capacity (bottles/day)'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'التكلفة' : 'Cost'}</th>
                  </tr>
                </thead>
                <tbody id="capacityExpansionsBody"></tbody>
              </table>
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--gold);">${isAr ? 'منحنى التدفق النقدي التراكمي (J-Curve)' : 'Cumulative Cash Flow J-Curve'}</h4>
            <div style="height: 280px; position: relative;">
              <canvas id="proFormaCashCurveChart"></canvas>
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--gold);">${isAr ? 'تحليل الحساسية على NPV/IRR' : 'NPV/IRR Sensitivity Analysis'}</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? 'تأثير تغير سعر البيع وحجم الإنتاج على قيمة المشروع.' : 'Impact of bottle price and production volume on project value.'}</p>
            <div style="height: 260px; position: relative;">
              <canvas id="proFormaSensitivityChart"></canvas>
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--gold);">${isAr ? 'محاكاة مونت كارلو للمخاطر' : 'Monte Carlo Risk Simulation'}</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? '1000 سيناريو عشوائي لسعر البيع والتكلفة والحجم.' : '1,000 random scenarios for price, cost, and volume.'}</p>
            <div class="monte-carlo-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'نسبة النجاح (NPV>0)' : 'Success Rate'}</strong><br><span id="mcSuccessRate">--</span></div>
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'متوسط NPV' : 'Mean NPV'}</strong><br><span id="mcMeanNpv">--</span></div>
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'وسيط NPV' : 'Median NPV'}</strong><br><span id="mcMedianNpv">--</span></div>
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'P5 - P95 NPV' : 'P5 - P95 NPV'}</strong><br><span id="mcNpvRange">--</span></div>
            </div>
            <div class="monte-carlo-risk" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'VaR 95% (خسارة قصوى)' : 'VaR 95% (max loss)'}</strong><br><span id="mcVar95">--</span></div>
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'CVaR 95% (متوسط الذيل)' : 'CVaR 95% (tail avg)'}</strong><br><span id="mcCvar95">--</span></div>
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'VaR 99% (خسارة قصوى)' : 'VaR 99% (max loss)'}</strong><br><span id="mcVar99">--</span></div>
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'CVaR 99% (متوسط الذيل)' : 'CVaR 99% (tail avg)'}</strong><br><span id="mcCvar99">--</span></div>
            </div>
            <div style="height: 260px; position: relative;">
              <canvas id="monteCarloHistogramChart"></canvas>
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--gold);">${isAr ? 'البحث عن الهدف (Goal Seek)' : 'Goal Seek'}</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">${isAr ? 'احسب القيمة المطلوبة لأحد المدخلات لجعل NPV = 0.' : 'Calculate the input value needed to make NPV = 0.'}</p>
            <div style="display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1rem;">
              <div style="flex: 1; min-width: 200px;">
                <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">${isAr ? 'المتغير' : 'Variable'}</label>
                <select id="goalSeekField" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text);">
                  <option value="bottlePrice">${isAr ? 'سعر بيع العبوة' : 'Bottle selling price'}</option>
                  <option value="bottleCostPerUnit">${isAr ? 'تكلفة الزجاجة' : 'Bottle cost'}</option>
                  <option value="dailyProduction">${isAr ? 'الإنتاج اليومي' : 'Daily production'}</option>
                </select>
              </div>
              <button type="button" class="btn btn--primary" onclick="runGoalSeek()" style="white-space: nowrap;">${isAr ? 'احسب نقطة التعادل' : 'Calculate break-even'}</button>
            </div>
            <div class="goal-seek-result" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'القيمة المطلوبة' : 'Required value'}</strong><br><span id="gsRequiredValue">--</span></div>
              <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>${isAr ? 'NPV عند القيمة' : 'NPV at value'}</strong><br><span id="gsNpvAtValue">--</span></div>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <h4 style="color: var(--gold);">${isAr ? 'قائمة الدخل' : 'Income Statement'}</h4>
            <div style="overflow-x: auto;">
              <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border);">
                    <th style="text-align: ${isAr ? 'right' : 'left'}; padding: 0.5rem;">${isAr ? 'البند' : 'Item'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 1' : 'Year 1'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 2' : 'Year 2'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 3' : 'Year 3'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 4' : 'Year 4'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 5' : 'Year 5'}</th>
                  </tr>
                </thead>
                <tbody id="proFormaIncomeBody"></tbody>
              </table>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <h4 style="color: var(--gold);">${isAr ? 'قائمة التدفقات النقدية' : 'Cash Flow Statement'}</h4>
            <div style="overflow-x: auto;">
              <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border);">
                    <th style="text-align: ${isAr ? 'right' : 'left'}; padding: 0.5rem;">${isAr ? 'البند' : 'Item'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 1' : 'Year 1'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 2' : 'Year 2'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 3' : 'Year 3'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 4' : 'Year 4'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 5' : 'Year 5'}</th>
                  </tr>
                </thead>
                <tbody id="proFormaCashflowBody"></tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 style="color: var(--gold);">${isAr ? 'الميزانية العمومية' : 'Balance Sheet'}</h4>
            <div style="overflow-x: auto;">
              <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border);">
                    <th style="text-align: ${isAr ? 'right' : 'left'}; padding: 0.5rem;">${isAr ? 'البند' : 'Item'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 1' : 'Year 1'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 2' : 'Year 2'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 3' : 'Year 3'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 4' : 'Year 4'}</th>
                    <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السنة 5' : 'Year 5'}</th>
                  </tr>
                </thead>
                <tbody id="proFormaBalanceBody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="kpi-summary" style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; margin: 1.5rem 0;">
          <h3 style="margin-top: 0;">${isAr ? 'مؤشرات الكفاءة التشغيلية' : 'Operational Efficiency KPIs'}</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
            <div><strong>${isAr ? 'تكلفة الإنتاج لكل 1000 عبوة' : 'Production cost per 1000 bottles'}</strong><br><span id="wfKpiCostPer1000">--</span></div>
            <div><strong>${isAr ? 'إنتاجية العامل' : 'Worker productivity'}</strong><br><span id="wfKpiWorkerProductivity">--</span></div>
            <div><strong>${isAr ? 'نسبة الهدر' : 'Wastage rate'}</strong><br><span id="wfKpiWastage">--</span></div>
            <div><strong>${isAr ? 'إجمالي الوحدات المنتجة شهرياً' : 'Total monthly units produced'}</strong><br><span id="wfKpiMonthlyUnits">--</span></div>
          </div>
        </div>

        <div class="bottle-size-comparison" style="margin: 1.5rem 0;">
          <h3>${isAr ? 'مقارنة أحجام العبوات' : 'Bottle Size Comparison'}</h3>
          <div style="overflow-x: auto;">
            <table class="bottle-size-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: ${isAr ? 'right' : 'left'}; padding: 0.5rem;">${isAr ? 'حجم العبوة' : 'Bottle size'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'السعر الافتراضي' : 'Default price'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'التكلفة الافتراضية' : 'Default cost'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'الهامش' : 'Margin'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'الإيراد الشهري' : 'Monthly revenue'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'التكلفة الشهرية' : 'Monthly cost'}</th>
                </tr>
              </thead>
              <tbody id="bottleSizeTableBody"></tbody>
            </table>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">${isAr ? 'الحساب يستخدم نفس حجم الإنتاج اليومي والتكاليف الثابتة لكل الأحجام.' : 'Calculation uses the same daily production volume and fixed costs for all sizes.'}</p>
        </div>

        <div class="risk-analysis" style="margin: 1.5rem 0;">
          <h3>${isAr ? 'تحليل المخاطر المالية' : 'Financial Risk Analysis'}</h3>
          <div style="overflow-x: auto;">
            <table class="risk-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: ${isAr ? 'right' : 'left'}; padding: 0.5rem;">${isAr ? 'المخاطرة' : 'Risk'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'الاحتمالية' : 'Probability'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'التأثير الشهري' : 'Monthly impact'}</th>
                  <th style="text-align: center; padding: 0.5rem;">${isAr ? 'التكلفة المتوقعة' : 'Expected cost'}</th>
                </tr>
              </thead>
              <tbody id="riskTableBody"></tbody>
            </table>
          </div>
        </div>

        <div class="export-buttons" style="margin: 1.5rem 0; display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button type="button" class="btn btn--secondary" onclick="exportWaterFactoryReport('pdf')">${isAr ? '📄 تصدير PDF' : '📄 Export PDF'}</button>
          <button type="button" class="btn btn--secondary" onclick="exportWaterFactoryReport('excel')">${isAr ? '📊 تصدير Excel' : '📊 Export Excel'}</button>
        </div>
      </div>
      ` : ''}

      <!-- Decision Intelligence Layer -->
      <div id="decisionIntelligencePanel" class="decision-intelligence hidden">
        <h2>${isAr ? 'ذكاء اتخاذ القرار الاستثماري' : 'Investment Decision Intelligence'}</h2>

        <div class="di-top-grid">
          <div class="di-verdict" id="diVerdict"></div>
          <div class="di-confidence-card">
            <div id="diConfidenceGauge"></div>
            <div id="diConfidenceBreakdown"></div>
          </div>
        </div>

        <div id="diSummary"></div>

        <div class="di-charts-grid">
          <div class="di-card di-card--chart">
            <h3>${isAr ? 'تحليل التدفقات النقدية' : 'Cash Flow Analysis'}</h3>
            <canvas id="diCashFlowChart"></canvas>
            <div id="diCashFlowSummary"></div>
          </div>
          <div class="di-card di-card--chart">
            <h3>${isAr ? 'تحليل المخاطر' : 'Risk Analysis'}</h3>
            <canvas id="diRiskChart"></canvas>
            <div id="diRiskList" class="di-list"></div>
          </div>
          <div class="di-card di-card--chart">
            <h3>${isAr ? 'تحليل التمويل' : 'Financing Analysis'}</h3>
            <canvas id="diFinancingChart"></canvas>
            <div id="diFinancingSummary"></div>
          </div>
          <div class="di-card di-card--chart">
            <h3>${isAr ? 'تحليل السوق' : 'Market Analysis'}</h3>
            <div id="diMarketScores" class="di-market-scores"></div>
            <div id="diMarketSummary"></div>
          </div>
        </div>

        <div class="di-card di-card--wide">
          <h3>${isAr ? 'جودة البيانات' : 'Data Quality'}</h3>
          <div id="diDataQuality"></div>
        </div>

        <div class="di-card di-card--wide">
          <h3>${isAr ? 'المخاطر والفرص الرئيسية' : 'Key Risks & Opportunities'}</h3>
          <div class="di-risks-opportunities-grid">
            <div>
              <h3 style="font-size:0.9rem;margin-bottom:0.75rem">${isAr ? 'قائمة المخاطر الرئيسية' : 'Key Risks'}</h3>
              <div id="diKeyRisks" class="di-list di-list--risks"></div>
            </div>
            <div>
              <h3 style="font-size:0.9rem;margin-bottom:0.75rem">${isAr ? 'قائمة الفرص الرئيسية' : 'Key Opportunities'}</h3>
              <div id="diKeyOpportunities" class="di-list di-list--opportunities"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <div id="site-footer"></div>

  <script src="${isAr ? '../../' : '../../../'}site-layout.js?v=2.54.0"></script>
  <script src="${isAr ? '../../' : '../../../'}page-tracker-v2.js"></script>
  <script src="${isAr ? './investment-engine.js?v=2' : '../../../calculators/investment-center/investment-engine.js?v=2'}"></script>
  <script src="${isAr ? './investment-validator.js?v=2' : '../../../calculators/investment-center/investment-validator.js?v=2'}"></script>
  <script src="${isAr ? './pro-forma-engine.js?v=1' : '../../../calculators/investment-center/pro-forma-engine.js?v=1'}"></script>
  <script src="${isAr ? './investment-risk-engine.js?v=1' : '../../../calculators/investment-center/investment-risk-engine.js?v=1'}"></script>
  <script src="${isAr ? './real-options-engine.js?v=1' : '../../../calculators/investment-center/real-options-engine.js?v=1'}"></script>
  <script src="${isAr ? './decision-intelligence.js?v=2' : '../../../calculators/investment-center/decision-intelligence.js?v=2'}"></script>
  <script src="${isAr ? '../../calculators/' : '../../../calculators/'}shared-export.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js"></script>
  ${sector.id === 'water-factory' ? `<script src="${isAr ? './water-factory-data.js?v=1' : '../../../calculators/investment-center/water-factory-data.js?v=1'}"></script>` : ''}
  <script>
    const sectorId = '${sector.id}';
    const baseRiskWeight = ${sector.riskWeight};
    const isAr = ${isAr};
    const expertStageCount = ${expertStages.length};

    if (window.BondsCountrySelector) {
      BondsCountrySelector.init({ select: '#country' });
    }

    const WATER_FACTORY_MARKET_FIELDS = sectorId === 'water-factory' ? ['bottleCostPerUnit', 'capCostPerUnit', 'labelCostPerUnit', 'cartonCostPerBottle', 'shrinkCostPerBottle', 'electricityRatePerKwh', 'waterRatePerM3', 'shiftCostPerWorker', 'workersPerShift', 'buildingCostPerM2', 'bottlePrice', 'marketingCostPerCustomer', 'monthlyNewCustomers', 'logisticsCostPerBottle', 'maintenanceRate', 'monthlySalaries'] : [];
    const defaultFieldValues = {};
    WATER_FACTORY_MARKET_FIELDS.forEach(field => {
      const el = document.getElementById(field);
      if (el) defaultFieldValues[field] = el.value;
    });

    if (sectorId === 'water-factory' && window.WaterFactoryData) {
      window.addEventListener('bonds:countrychange', (e) => {
        renderCountryInfo();
        const data = window.WaterFactoryData.getCountryData(e.detail && e.detail.code ? e.detail.code : 'SA');
        if (!data) return;
        let shouldApply = true;
        WATER_FACTORY_MARKET_FIELDS.forEach(field => {
          const el = document.getElementById(field);
          if (!el) return;
          if (el.value !== String(defaultFieldValues[field] || '')) shouldApply = false;
        });
        if (shouldApply) fillFromMarketData();
      });
      setTimeout(() => {
        fillFromMarketData();
        renderCountryInfo();
      }, 0);
    }

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

    function toggleSection(sectionId) {
      const content = document.getElementById(sectionId);
      if (!content) return;
      const section = content.closest('.input-section');
      if (section) section.classList.toggle('collapsed');
    }

    function setFieldValue(name, value) {
      const basicEl = document.getElementById(name);
      const expertEl = document.getElementById('expert_basic_' + name);
      if (basicEl) basicEl.value = value;
      if (expertEl) expertEl.value = value;
    }

    const FACTORY_TEMPLATES = {
      small: {
        dailyProduction: 5000,
        operatingHoursPerDay: 10,
        shiftCount: 1,
        workersPerShift: 4,
        factoryCost: 2000000,
        warehouseAreaM2: 500,
        monthlyLicenseInsurance: 5000,
        labCostMonthly: 6000,
        monthlyNewCustomers: 20,
        kWhPerThousandBottles: 9,
        waterM3PerThousandBottles: 1.5
      },
      medium: {
        dailyProduction: 20000,
        operatingHoursPerDay: 16,
        shiftCount: 2,
        workersPerShift: 6,
        factoryCost: 4000000,
        warehouseAreaM2: 800,
        monthlyLicenseInsurance: 8000,
        labCostMonthly: 10000,
        monthlyNewCustomers: 40,
        kWhPerThousandBottles: 8,
        waterM3PerThousandBottles: 1.5
      },
      large: {
        dailyProduction: 50000,
        operatingHoursPerDay: 20,
        shiftCount: 2,
        workersPerShift: 10,
        factoryCost: 8000000,
        warehouseAreaM2: 1500,
        monthlyLicenseInsurance: 12000,
        labCostMonthly: 15000,
        monthlyNewCustomers: 80,
        kWhPerThousandBottles: 7,
        waterM3PerThousandBottles: 1.2
      }
    };

    function applyFactoryTemplate(size) {
      const template = FACTORY_TEMPLATES[size];
      if (!template) return;
      Object.keys(template).forEach(field => setFieldValue(field, template[field]));
      fillFromMarketData();
      alert(isAr
        ? 'تم تطبيق قالب ' + (size === 'small' ? 'المصنع الصغير' : size === 'medium' ? 'المصنع المتوسط' : 'المصنع الكبير') + ' وملء القيم من بيانات السوق.'
        : 'Applied ' + (size === 'small' ? 'small' : size === 'medium' ? 'medium' : 'large') + ' factory template and filled values from market data.');
    }

    function renderCountryInfo() {
      const container = document.getElementById('waterFactoryCountryInfo');
      if (!container || !window.WaterFactoryData || !window.WaterFactoryData.getCountryMeta) return;
      const countrySelect = document.getElementById('country');
      const code = countrySelect && countrySelect.value ? countrySelect.value.toUpperCase() : 'SA';
      const meta = window.WaterFactoryData.getCountryMeta(code);
      if (!meta) {
        container.innerHTML = '';
        return;
      }
      const confidenceLabels = isAr
        ? { medium: 'متوسطة', 'medium-low': 'متوسطة إلى منخفضة', low: 'منخفضة', 'very low': 'منخفضة جداً' }
        : { medium: 'Medium', 'medium-low': 'Medium-low', low: 'Low', 'very low': 'Very low' };
      const confidence = confidenceLabels[meta.confidence] || meta.confidence;

      const licenses = (meta.regulations.licenses || []).map(l => '<li>' + l + '</li>').join('');
      const standards = (meta.regulations.standards || []).map(s => '<li>' + s + '</li>').join('');
      const urlLinks = meta.urls
        ? Object.entries(meta.urls).map(([key, url]) => '<a href="' + url + '" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:underline;margin-left:0.5rem;">' + key + '</a>').join('')
        : '';
      const competitors = (meta.competitors || []).map(c => {
        const price = Array.isArray(c.priceRange)
          ? c.priceRange[0].toFixed(2) + ' - ' + c.priceRange[1].toFixed(2)
          : c.priceRange;
        return '<tr><td>' + c.brand + '</td><td>' + c.size + '</td><td>' + price + '</td></tr>';
      }).join('');

      container.innerHTML = \`
        <div class="input-section">
          <button type="button" class="input-section__toggle" onclick="toggleSection('section_country_info')">
            <span>\${isAr ? '📋 معلومات الدولة: التراخيص والمنافسين' : '📋 Country info: licenses & competitors'}</span>
            <span class="input-section__icon">▼</span>
          </button>
          <div id="section_country_info" class="input-section__content" style="grid-template-columns: 1fr;">
            <div style="margin-bottom: 1rem;">
              <h4 style="color:var(--gold);margin-bottom:0.5rem;">\${isAr ? 'مصادر البيانات ومستوى الثقة' : 'Data sources & confidence'}</h4>
              <ul style="color:var(--text-secondary);font-size:0.85rem;line-height:1.6;">
                <li><strong>\${isAr ? 'الكهرباء:' : 'Electricity:'}</strong> \${meta.sources.electricity}</li>
                <li><strong>\${isAr ? 'المياه:' : 'Water:'}</strong> \${meta.sources.water}</li>
                <li><strong>\${isAr ? 'الأجور:' : 'Wages:'}</strong> \${meta.sources.wages}</li>
                <li><strong>\${isAr ? 'التغليف:' : 'Packaging:'}</strong> \${meta.sources.packaging}</li>
                <li><strong>\${isAr ? 'مستوى الثقة:' : 'Confidence:'}</strong> \${confidence}</li>
                <li><strong>\${isAr ? 'آخر تحديث:' : 'Last updated:'}</strong> \${meta.lastUpdated}</li>
              </ul>
              <div style="margin-top:0.5rem;font-size:0.85rem;"><strong>\${isAr ? 'روابط رسمية:' : 'Official links:'}</strong> \${urlLinks}</div>
            </div>
            <div style="margin-bottom: 1rem;">
              <h4 style="color:var(--gold);margin-bottom:0.5rem;">\${isAr ? 'التراخيص والمعايير المطلوبة' : 'Required licenses & standards'}</h4>
              <p style="color:var(--text-secondary);font-size:0.85rem;">\${meta.regulations.notes}</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:0.5rem;">
                <div><strong style="font-size:0.85rem;">\${isAr ? 'التراخيص:' : 'Licenses:'}</strong><ul style="font-size:0.85rem;color:var(--text-secondary);padding-right:1rem;">\${licenses}</ul></div>
                <div><strong style="font-size:0.85rem;">\${isAr ? 'المعايير:' : 'Standards:'}</strong><ul style="font-size:0.85rem;color:var(--text-secondary);padding-right:1rem;">\${standards}</ul></div>
              </div>
            </div>
            <div>
              <h4 style="color:var(--gold);margin-bottom:0.5rem;">\${isAr ? 'مقارنة أسعار المنافسين' : 'Competitor price comparison'}</h4>
              <table id="waterFactoryCompetitorsTable" style="width:100%;font-size:0.85rem;border-collapse:collapse;">
                <thead><tr style="border-bottom:1px solid var(--border);"><th style="text-align:inherit;padding:0.4rem;">\${isAr ? 'العلامة' : 'Brand'}</th><th style="text-align:inherit;padding:0.4rem;">\${isAr ? 'الحجم' : 'Size'}</th><th style="text-align:inherit;padding:0.4rem;">\${isAr ? 'السعر (ر.س)' : 'Price (SAR)'}</th><th style="text-align:inherit;padding:0.4rem;"></th></tr></thead>
                <tbody>\${competitors}</tbody>
              </table>
              <div style="margin-top:0.75rem;display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0.5rem;align-items:end;">
                <input type="text" id="wfCompetitorBrand" placeholder="\${isAr ? 'اسم العلامة' : 'Brand name'}" style="padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);" />
                <input type="text" id="wfCompetitorSize" placeholder="\${isAr ? 'حجم العبوة' : 'Bottle size'}" style="padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);" />
                <input type="text" id="wfCompetitorPrice" placeholder="\${isAr ? 'نطاق السعر' : 'Price range'}" style="padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);" />
                <button type="button" class="btn btn--secondary" onclick="addLocalCompetitor()" style="white-space:nowrap;">\${isAr ? '+ إضافة' : '+ Add'}</button>
              </div>
            </div>
          </div>
        </div>
            <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(197,160,40,0.15);">
              <h4 style="color:var(--gold);margin-bottom:0.5rem;">\${isAr ? 'اقترح تحديث بيانات' : 'Suggest a data update'}</h4>
              <p style="color:var(--text-secondary);font-size:0.8rem;margin-bottom:0.5rem;">\${isAr ? 'إذا لديك بيانات أحدث أو أكثر دقة، ساعدنا في تحسين الأداة للجميع:' : 'If you have newer or more accurate data, help us improve the tool for everyone:'}</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
                <input type="text" id="wfReporterName" placeholder="\${isAr ? 'الاسم (اختياري)' : 'Name (optional)'}" style="padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);" />
                <input type="email" id="wfReporterEmail" placeholder="\${isAr ? 'البريد (اختياري)' : 'Email (optional)'}" style="padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);" />
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
                <select id="wfCorrectionField" style="padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);">
                  <option value="">\${isAr ? 'اختر البند' : 'Select item'}</option>
                  <option value="bottleCostPerUnit">\${isAr ? 'تكلفة العبوة' : 'Bottle cost'}</option>
                  <option value="capCostPerUnit">\${isAr ? 'تكلفة الغطاء' : 'Cap cost'}</option>
                  <option value="labelCostPerUnit">\${isAr ? 'تكلفة الاستيكر' : 'Label cost'}</option>
                  <option value="cartonCostPerBottle">\${isAr ? 'تكلفة الكرتون' : 'Carton cost'}</option>
                  <option value="shrinkCostPerBottle">\${isAr ? 'تكلفة الشيرنك' : 'Shrink cost'}</option>
                  <option value="electricityRatePerKwh">\${isAr ? 'سعر الكهرباء' : 'Electricity rate'}</option>
                  <option value="waterRatePerM3">\${isAr ? 'سعر المياه' : 'Water rate'}</option>
                  <option value="shiftCostPerWorker">\${isAr ? 'أجر الوردية' : 'Shift wage'}</option>
                  <option value="workersPerShift">\${isAr ? 'العمال/وردية' : 'Workers per shift'}</option>
                  <option value="buildingCostPerM2">\${isAr ? 'تكلفة البناء/م²' : 'Building cost/m²'}</option>
                  <option value="bottlePrice">\${isAr ? 'سعر العبوة' : 'Bottle price'}</option>
                  <option value="marketingCostPerCustomer">\${isAr ? 'تكلفة التسويق/عميل' : 'Marketing/customer'}</option>
                  <option value="logisticsCostPerBottle">\${isAr ? 'التوزيع/عبوة' : 'Logistics/bottle'}</option>
                  <option value="maintenanceRate">\${isAr ? 'نسبة الصيانة' : 'Maintenance rate'}</option>
                  <option value="competitor">\${isAr ? 'منافس جديد' : 'New competitor'}</option>
                  <option value="other">\${isAr ? 'أخرى' : 'Other'}</option>
                </select>
                <input type="text" id="wfCorrectionCurrent" placeholder="\${isAr ? 'القيمة الحالية (اختياري)' : 'Current value (optional)'}" style="padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);" />
                <input type="text" id="wfCorrectionProposed" placeholder="\${isAr ? 'القيمة المقترحة' : 'Proposed value'}" style="padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);" />
              </div>
              <input type="text" id="wfCorrectionSource" placeholder="\${isAr ? 'مصدر البيانات (رابط/جهة)' : 'Data source (link/entity)' }" style="width:100%;padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);margin-bottom:0.5rem;" />
              <textarea id="wfCorrectionNotes" rows="2" placeholder="\${isAr ? 'ملاحظات إضافية...' : 'Additional notes...'}" style="width:100%;padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);margin-bottom:0.5rem;"></textarea>
              <button type="button" class="btn btn--secondary" onclick="submitDataCorrection()">\${isAr ? 'إرسال الاقتراح' : 'Submit suggestion'}</button>
            </div>
      \`;
    }

    async function submitDataCorrection() {
      const nameEl = document.getElementById('wfReporterName');
      const emailEl = document.getElementById('wfReporterEmail');
      const fieldEl = document.getElementById('wfCorrectionField');
      const currentEl = document.getElementById('wfCorrectionCurrent');
      const proposedEl = document.getElementById('wfCorrectionProposed');
      const sourceEl = document.getElementById('wfCorrectionSource');
      const notesEl = document.getElementById('wfCorrectionNotes');
      const countrySelect = document.getElementById('country');
      const countryCode = countrySelect && countrySelect.value ? countrySelect.value : 'SA';

      const field = fieldEl ? fieldEl.value : '';
      const proposed = proposedEl && proposedEl.value.trim() ? proposedEl.value.trim() : '';
      const notes = notesEl && notesEl.value.trim() ? notesEl.value.trim() : '';

      if (!field && !proposed && !notes) {
        alert(isAr ? 'يرجى تحديد البند أو كتابة القيمة المقترحة أو ملاحظة.' : 'Please select an item, propose a value, or add a note.');
        return;
      }

      const messageObj = {
        type: 'water-factory-data-suggestion',
        country: countryCode,
        field: field,
        currentValue: currentEl && currentEl.value.trim() ? currentEl.value.trim() : '',
        proposedValue: proposed,
        source: sourceEl && sourceEl.value.trim() ? sourceEl.value.trim() : '',
        notes: notes,
        pageUrl: window.location.href
      };

      const body = {
        name: nameEl && nameEl.value.trim() ? nameEl.value.trim() : (isAr ? 'مستخدم حاسبة مصنع مياه' : 'Water factory calculator user'),
        email: emailEl && emailEl.value.trim() ? emailEl.value.trim() : 'no-reply@bonds-global.com',
        message: JSON.stringify(messageObj),
        sector: 'water-factory',
        service: 'data-suggestion',
        source: 'water-factory-calculator',
        url: window.location.href
      };

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (response.ok) {
          alert(isAr ? 'تم إرسال الاقتراح. شكراً لمساعدتنا في تحسين البيانات.' : 'Suggestion submitted. Thank you for helping improve the data.');
          if (fieldEl) fieldEl.value = '';
          if (currentEl) currentEl.value = '';
          if (proposedEl) proposedEl.value = '';
          if (sourceEl) sourceEl.value = '';
          if (notesEl) notesEl.value = '';
        } else {
          alert(isAr ? 'تعذر إرسال الاقتراح. يرجى المحاولة لاحقاً.' : 'Could not submit suggestion. Please try again later.');
        }
      } catch (err) {
        alert(isAr ? 'تعذر الاتصال بالخادم. يرجى المحاولة لاحقاً.' : 'Could not connect to server. Please try again later.');
      }
    }

    function addLocalCompetitor() {
      const brandEl = document.getElementById('wfCompetitorBrand');
      const sizeEl = document.getElementById('wfCompetitorSize');
      const priceEl = document.getElementById('wfCompetitorPrice');
      if (!brandEl || !sizeEl || !priceEl) return;
      const brand = brandEl.value.trim();
      const size = sizeEl.value.trim();
      const price = priceEl.value.trim();
      if (!brand || !size || !price) {
        alert(isAr ? 'يرجى ملء جميع حقول المنافس.' : 'Please fill all competitor fields.');
        return;
      }
      const tbody = document.querySelector('#waterFactoryCompetitorsTable tbody');
      if (tbody) {
        const row = document.createElement('tr');
        row.innerHTML = '<td>' + brand + '</td><td>' + size + '</td><td>' + price + '</td><td><button type="button" class="btn btn--ghost" onclick="this.closest(\'tr\').remove()" style="font-size:0.75rem;">' + (isAr ? 'حذف' : 'Remove') + '</button></td>';
        tbody.appendChild(row);
      }
      brandEl.value = '';
      sizeEl.value = '';
      priceEl.value = '';
    }

    async function fillFromMarketData() {
      if (!window.WaterFactoryData) {
        alert(isAr ? 'بيانات السوق غير متوفرة.' : 'Market data not available.');
        return;
      }
      const countrySelect = document.getElementById('country');
      const countryCode = countrySelect && countrySelect.value ? countrySelect.value : 'SA';

      let data = null;
      let source = 'local';
      try {
        const response = await fetch('/api/v3/water-factory-data?country=' + encodeURIComponent(countryCode), {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.record && result.record.data) {
            data = { ...result.record.data, meta: result.record.meta };
            source = 'api';
          }
        }
      } catch (err) {
        // fallback to local file
      }

      if (!data) {
        data = window.WaterFactoryData.getCountryData(countryCode);
      }

      if (!data) {
        alert(isAr ? 'لا توجد بيانات لهذه الدولة.' : 'No data available for this country.');
        return;
      }

      const fields = ['bottleCostPerUnit', 'capCostPerUnit', 'labelCostPerUnit', 'cartonCostPerBottle', 'shrinkCostPerBottle', 'electricityRatePerKwh', 'waterRatePerM3', 'shiftCostPerWorker', 'workersPerShift', 'buildingCostPerM2', 'bottlePrice', 'marketingCostPerCustomer', 'monthlyNewCustomers', 'logisticsCostPerBottle', 'maintenanceRate'];
      fields.forEach(field => {
        if (typeof data[field] === 'number') setFieldValue(field, data[field]);
      });

      const shiftCount = getValue('shiftCount') || 2;
      const monthlyWorkingDays = getValue('monthlyWorkingDays') || 26;
      if (typeof data.shiftCostPerWorker === 'number' && typeof data.workersPerShift === 'number') {
        const calculatedSalaries = Math.round(data.shiftCostPerWorker * data.workersPerShift * shiftCount * monthlyWorkingDays);
        setFieldValue('monthlySalaries', calculatedSalaries);
      }

      const sourceMsg = source === 'api'
        ? (isAr ? ' (محدّث من قاعدة البيانات)' : ' (updated from database)')
        : (isAr ? ' (من الملف المحلي)' : ' (from local file)');

      alert(isAr ? 'تم ملء الحقول بنجاح من بيانات السوق لـ ' + (data.nameAr || countryCode) + sourceMsg + '. يرجى مراجعة القيم وتعديلها حسب عروضك الفعلية.' : 'Fields filled successfully from market data for ' + (data.nameEn || countryCode) + sourceMsg + '. Please review and adjust to your actual quotes.');
    }

    async function fillFromUserProfile() {
      if (!window.supabaseClient) {
        alert(isAr ? 'عميل Supabase غير متوفر.' : 'Supabase client not available.');
        return;
      }
      try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) {
          alert(isAr ? 'يرجى تسجيل الدخول أولاً.' : 'Please log in first.');
          return;
        }
        const { data: profile, error } = await window.supabaseClient.from('profiles').select('*').eq('id', user.id).single();
        if (error || !profile) {
          alert(isAr ? 'لم يتم العثور على ملف شخصي.' : 'Profile not found.');
          return;
        }
        if (profile.country) {
          const countrySelect = document.getElementById('country');
          if (countrySelect) {
            countrySelect.value = profile.country;
            countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        alert(isAr ? 'تم جلب الملف الشخصي. يمكنك الآن استخدام "ملء تلقائي من بيانات السوق" لتحميل بيانات الدولة.' : 'Profile loaded. You can now use "Auto-fill from market data" to load country data.');
      } catch (err) {
        alert(isAr ? 'حدث خطأ أثناء جلب الملف الشخصي.' : 'Error fetching profile.');
      }
    }

    async function suggestWithAI() {
      const inputs = mapInputs();
      const prompt = isAr
        ? 'أنت خبير مالي في مصانع تعبئة المياه. بناءً على الدولة ' + (inputs.country || 'SA') + ' وحجم الإنتاج اليومي ' + inputs.dailyProduction + ' عبوة، اقترح قيماً واقعية لـ: سعر العبوة، تكلفة الزجاجة، تكلفة الغطاء، تكلفة الليبل، تكلفة الكرتون، تكلفة الشرنك، تكلفة اللوجستيك، عدد العمال لكل وردية، تكلفة العامل، سعر الكهرباء، سعر المياه. أعد الرد بصيغة JSON فقط.'
        : 'You are a financial expert in water bottling factories. Based on country ' + (inputs.country || 'SA') + ' and daily production volume of ' + inputs.dailyProduction + ' bottles, suggest realistic values for: bottle price, bottle cost, cap cost, label cost, carton cost, shrink cost, logistics cost, workers per shift, worker cost, electricity rate, water rate. Return only JSON.';

      try {
        const response = await fetch('/api/v3/ai-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, sector: 'water-factory' })
        });
        if (!response.ok) throw new Error('AI request failed');
        const result = await response.json();
        if (result.suggestions) {
          Object.keys(result.suggestions).forEach(key => setFieldValue(key, result.suggestions[key]));
          alert(isAr ? 'تم تطبيق الاقتراحات الذكية.' : 'AI suggestions applied.');
        } else {
          alert(isAr ? 'لم يتم الحصول على اقتراحات.' : 'No suggestions received.');
        }
      } catch (err) {
        alert(isAr ? 'خدمة AI غير متوفرة حالياً. جاري استخدام بيانات السوق كبديل.' : 'AI service unavailable. Using market data as fallback.');
        fillFromMarketData();
      }
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
      fields.forEach(f => {
        const el = document.getElementById(basicPrefix + f.name);
        if (!el) {
          // Hidden field in basic mode — fall back to default value
          if (f.type === 'select' || f.type === 'text' || f.type === 'textarea') {
            inputs[f.name] = (f.default !== undefined && f.default !== null) ? String(f.default) : '';
          } else {
            const numericDefault = parseFloat(f.default);
            inputs[f.name] = Number.isFinite(numericDefault) ? numericDefault : 0;
          }
        } else if (f.type === 'select' || f.type === 'text' || f.type === 'textarea') {
          inputs[f.name] = getText(basicPrefix + f.name);
        } else {
          inputs[f.name] = getValue(basicPrefix + f.name);
        }
      });
      inputs.analysisDuration = getValue(basicPrefix + 'analysisDuration') || 60;
      inputs.discountRate = (getValue(basicPrefix + 'discountRate') || 10) / 100;

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
        case 'water-factory': {
          var maxDailyProduction = inputs.dailyProduction || 0;
          var initialUtil = inputs.initialCapacityUtilization || 60;
          var growthRate = inputs.monthlyGrowthRate || 0;
          var months = 12;
          var initialDaily = maxDailyProduction * (initialUtil / 100);
          var growthFactor = 1 + (growthRate / 100);
          var costInflationMonthly = Math.pow(1 + ((inputs.annualCostInflation || 0) / 100), 1 / 12);
          var priceInflationMonthly = Math.pow(1 + ((inputs.annualPriceIncrease || 0) / 100), 1 / 12);

          var directRate = (inputs.directSalesRate || 0) / 100;
          var distRate = (inputs.distributorSalesRate || 0) / 100;
          var platformRate = (inputs.platformSalesRate || 0) / 100;
          var distDiscount = (inputs.distributorDiscountRate || 0) / 100;
          var platformCommission = (inputs.platformCommissionRate || 0) / 100;
          var baseNetPrice = inputs.bottlePrice * (directRate + distRate * (1 - distDiscount) + platformRate * (1 - platformCommission));

          var materialCostPerBottle = (inputs.bottleCostPerUnit || 0) + (inputs.capCostPerUnit || 0) + (inputs.labelCostPerUnit || 0);
          var baseVariableCostPerBottle = materialCostPerBottle + (inputs.cartonCostPerBottle || 0) + (inputs.shrinkCostPerBottle || 0);

          var bottlesPerTrip = inputs.bottlesPerDeliveryTrip || 0;
          var tripCost = (inputs.avgDeliveryDistanceKm || 0) * (inputs.deliveryCostPerKm || 0);
          var autoLogisticsCost = bottlesPerTrip > 0 ? tripCost / bottlesPerTrip : 0;
          var logisticsCostPerBottle = autoLogisticsCost > 0 ? autoLogisticsCost : (inputs.logisticsCostPerBottle || 0);

          var variableCostPerBottle = baseVariableCostPerBottle + logisticsCostPerBottle;

          var totalDaily = 0;
          var totalRevenue = 0;
          var totalVariable = 0;
          for (var m = 0; m < months; m++) {
            var daily = initialDaily * Math.pow(growthFactor, m);
            if (daily > maxDailyProduction) daily = maxDailyProduction;
            var effectiveDaily = daily * (1 - (inputs.wastageRate || 0) / 100);
            var priceMultiplier = Math.pow(priceInflationMonthly, m);
            var costMultiplier = Math.pow(costInflationMonthly, m);
            totalDaily += daily;
            totalRevenue += effectiveDaily * baseNetPrice * priceMultiplier * 30;
            totalVariable += effectiveDaily * variableCostPerBottle * costMultiplier * 30;
          }
          var avgDailyProduction = totalDaily / months;
          var effectiveDailyProduction = avgDailyProduction * (1 - (inputs.wastageRate || 0) / 100);
          monthlyRevenue = totalRevenue / months;
          monthlyVariable = totalVariable / months;

          var buildingCost = (inputs.warehouseAreaM2 || 0) * (inputs.buildingCostPerM2 || 0);
          var rawMaterialInventory = avgDailyProduction * variableCostPerBottle * (inputs.rawMaterialInventoryDays || 0);
          totalInvestment = (inputs.factoryCost || 0) + buildingCost + rawMaterialInventory;

          var autoSalaries = (inputs.shiftCount || 0) * (inputs.workersPerShift || 0) * (inputs.shiftCostPerWorker || 0) * (inputs.monthlyWorkingDays || 0);
          var monthlySalaries = autoSalaries > 0 ? autoSalaries : (inputs.monthlySalaries || 0);

          var equityRatio = Math.min(100, Math.max(0, inputs.equityRatio || 0));
          var loanAmount = totalInvestment * (1 - equityRatio / 100);
          var monthlyInterest = (inputs.loanInterestRate || 0) / 100 / 12;
          var loanMonths = (inputs.loanTermYears || 0) * 12;
          var monthlyInstallment = 0;
          if (loanAmount > 0 && loanMonths > 0) {
            if (monthlyInterest > 0) {
              monthlyInstallment = loanAmount * (monthlyInterest * Math.pow(1 + monthlyInterest, loanMonths)) / (Math.pow(1 + monthlyInterest, loanMonths) - 1);
            } else {
              monthlyInstallment = loanAmount / loanMonths;
            }
          }

          var electricityMonthly = (effectiveDailyProduction * 30 / 1000) * (inputs.kWhPerThousandBottles || 0) * (inputs.electricityRatePerKwh || 0);
          var waterMonthly = (effectiveDailyProduction * 30 / 1000) * (inputs.waterM3PerThousandBottles || 0) * (inputs.waterRatePerM3 || 0);
          var maintenanceMonthly = (inputs.factoryCost || 0) * ((inputs.maintenanceRate || 0) / 100) / 12;
          var marketingMonthly = (inputs.monthlyNewCustomers || 0) * (inputs.marketingCostPerCustomer || 0);

          monthlyFixed = monthlySalaries + electricityMonthly + waterMonthly + (inputs.labCostMonthly || 0) + (inputs.monthlyLicenseInsurance || 0) + maintenanceMonthly + marketingMonthly + monthlyInstallment;

          unitPrice = baseNetPrice;
          unitVariableCost = variableCostPerBottle;
          break;
        }
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
      container.innerHTML = '<div class="validation-warnings__title">⚠️ ' + title + '</div>' +
        '<ul>' + validation.warnings.map(w => '<li>' + w + '</li>').join('') + '</ul>' +
        '<div class="validation-warnings__footer">' + fixMsg + '</div>';
    }

    function calculate() {
      const inputs = mapInputs();

      if (sectorId === 'water-factory') {
        const channelSum = (inputs.directSalesRate || 0) + (inputs.distributorSalesRate || 0) + (inputs.platformSalesRate || 0);
        if (Math.abs(channelSum - 100) > 0.01) {
          const msg = isAr
            ? 'مجموع قنوات البيع يجب أن يساوي 100% (المباشرة + الموزعين + المنصات).'
            : 'Sales channel ratios must sum to 100% (direct + distributors + platforms).';
          alert(msg);
          return;
        }
      }

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

      // Pro-Forma advanced analysis for supported sectors
      if (isProFormaSector(sectorId)) {
        if (sectorId === 'water-factory') {
          renderWaterFactoryAdvanced(inputs, engineInputs, result);
        } else {
          renderGenericProFormaAdvanced(inputs, engineInputs, result);
        }
        renderExecutiveSummary(inputs, engineInputs, result);
      }

      // Decision Intelligence Layer
      if (window.DecisionIntelligence && window.DecisionIntelligence.analyze) {
        const diResult = window.DecisionIntelligence.analyze(inputs, result, isAr ? 'ar' : 'en');
        diResult._inputs = inputs;
        diResult._engineResultMetrics = result.metrics;
        window._lastDecisionResult = diResult;
        renderDecisionIntelligence(diResult);
      }

      document.getElementById('resultsSection').classList.remove('hidden');
      window._lastResult = result;

      renderSectorAnomalies(inputs, result);
    }

    function runGoalSeek() {
      if (!window.ProFormaEngine || !window.ProFormaEngine.goalSeek) return;
      const inputs = mapInputs();
      const fieldEl = document.getElementById('goalSeekField');
      const field = fieldEl ? fieldEl.value : 'bottlePrice';

      const bounds = {
        bottlePrice: { min: 0.1, max: 10 },
        bottleCostPerUnit: { min: 0.01, max: 5 },
        dailyProduction: { min: 1000, max: 200000 }
      };
      const bound = bounds[field] || { min: 0, max: 1000 };

      const result = window.ProFormaEngine.goalSeek(inputs, field, 'npv', 0, bound.min, bound.max, { sector: 'water-factory' });

      const currency = isAr ? 'ر.س' : 'SAR';
      const valueEl = document.getElementById('gsRequiredValue');
      const npvEl = document.getElementById('gsNpvAtValue');

      if (valueEl) {
        if (result.found) {
          let displayValue = formatNumber(result.value);
          if (field === 'bottlePrice' || field === 'bottleCostPerUnit') displayValue += ' ' + currency;
          if (field === 'dailyProduction') displayValue += ' ' + (isAr ? 'عبوة/يوم' : 'bottles/day');
          valueEl.textContent = displayValue;
          valueEl.style.color = '#4ade80';
        } else {
          valueEl.textContent = isAr ? 'لا يوجد حل ضمن النطاق' : 'No solution in range';
          valueEl.style.color = '#f87171';
        }
      }

      if (npvEl && result.found) {
        const pf = window.ProFormaEngine.buildProFormaStatements({ ...inputs, [field]: result.value }, 60, { sector: 'water-factory' });
        npvEl.textContent = formatNumber(pf.summary.npv) + ' ' + currency;
        npvEl.style.color = pf.summary.npv >= 0 ? '#4ade80' : '#f87171';
      }
    }

    function analyzeSectorInputs(rawInputs) {
      const engineInputs = calculateEngineInputs(rawInputs);
      let result = isAr ? window.InvestmentEngine.analyze(engineInputs) : window.InvestmentEngine.analyzeEn(engineInputs);
      if (window.InvestmentRiskEngine && window.InvestmentRiskEngine.applyWorkingCapital) {
        result = window.InvestmentRiskEngine.applyWorkingCapital(engineInputs, result, sectorId);
      }
      return result;
    }

    function getMonteCarloVariables(inputs) {
      // Sector-aware mappings for top sectors
      const sectorMappings = {
        'water-factory': [
          { field: 'bottlePrice', type: 'triangular', minFactor: 0.8, maxFactor: 1.2 },
          { field: 'dailyProduction', type: 'triangular', minFactor: 0.7, maxFactor: 1.3 },
          { field: 'bottleCostPerUnit', type: 'triangular', minFactor: 0.8, maxFactor: 1.2 }
        ],
        'industrial': [
          { field: 'unitPrice', type: 'triangular', minFactor: 0.8, maxFactor: 1.2 },
          { field: 'monthlyCapacity', type: 'triangular', minFactor: 0.7, maxFactor: 1.3 },
          { field: 'rawMaterialCost', type: 'triangular', minFactor: 0.8, maxFactor: 1.2 }
        ],
        'real-estate': [
          { field: 'unitPrice', type: 'triangular', minFactor: 0.75, maxFactor: 1.25 },
          { field: 'unitsCount', type: 'triangular', minFactor: 0.8, maxFactor: 1.2 },
          { field: 'constructionCost', type: 'triangular', minFactor: 0.85, maxFactor: 1.15 }
        ],
        'tourism': [
          { field: 'avgDailyRate', type: 'triangular', minFactor: 0.75, maxFactor: 1.25 },
          { field: 'occupancyRate', type: 'triangular', minFactor: 0.7, maxFactor: 1.1, capMax: 100 },
          { field: 'setupCost', type: 'triangular', minFactor: 0.85, maxFactor: 1.15 }
        ],
        'restaurants': [
          { field: 'avgTicket', type: 'triangular', minFactor: 0.8, maxFactor: 1.2 },
          { field: 'dailyCustomers', type: 'triangular', minFactor: 0.7, maxFactor: 1.3 },
          { field: 'foodCostRate', type: 'triangular', minFactor: 0.85, maxFactor: 1.15, capMax: 100 }
        ],
        'technology': [
          { field: 'subscriptionPrice', type: 'triangular', minFactor: 0.75, maxFactor: 1.25 },
          { field: 'subscribers', type: 'triangular', minFactor: 0.6, maxFactor: 1.4 },
          { field: 'developmentCost', type: 'triangular', minFactor: 0.85, maxFactor: 1.15 }
        ],
        'retail': [
          { field: 'dailySales', type: 'triangular', minFactor: 0.7, maxFactor: 1.3 },
          { field: 'profitMargin', type: 'triangular', minFactor: 0.75, maxFactor: 1.25, capMax: 100 },
          { field: 'inventoryCost', type: 'triangular', minFactor: 0.85, maxFactor: 1.15 }
        ],
        'medical': [
          { field: 'avgDailyRevenue', type: 'triangular', minFactor: 0.8, maxFactor: 1.2 },
          { field: 'materialCostRate', type: 'triangular', minFactor: 0.85, maxFactor: 1.15, capMax: 100 },
          { field: 'equipmentCost', type: 'triangular', minFactor: 0.85, maxFactor: 1.15 }
        ],
        'logistics': [
          { field: 'revenuePerTrip', type: 'triangular', minFactor: 0.8, maxFactor: 1.2 },
          { field: 'monthlyTrips', type: 'triangular', minFactor: 0.7, maxFactor: 1.3 },
          { field: 'fuelMaintenance', type: 'triangular', minFactor: 0.85, maxFactor: 1.15 }
        ],
        'agriculture': [
          { field: 'pricePerKg', type: 'triangular', minFactor: 0.75, maxFactor: 1.25 },
          { field: 'yieldPerHectare', type: 'triangular', minFactor: 0.7, maxFactor: 1.3 },
          { field: 'operationalCostPerKg', type: 'triangular', minFactor: 0.8, maxFactor: 1.2 }
        ]
      };

      const mapping = sectorMappings[sectorId];
      if (mapping) {
        const variables = [];
        mapping.forEach(m => {
          const value = toNumber(inputs[m.field]);
          if (value > 0) {
            let min = value * m.minFactor;
            let max = value * m.maxFactor;
            if (m.capMax !== undefined) {
              min = Math.min(min, m.capMax);
              max = Math.min(max, m.capMax);
            }
            variables.push({ field: m.field, type: m.type, min, max, mode: value });
          }
        });
        if (variables.length > 0) return variables;
      }

      // Fallback heuristic: pick numeric fields that look like price, volume, or cost drivers
      const pricePatterns = /price|cost|ticket|fee|rate|revenue|earning|profit|margin/i;
      const volumePatterns = /capacity|units|customers|subscribers|seats|production|sales|trips|yield|area|count|size/i;
      const allNumericFields = Object.keys(inputs).filter(k => typeof inputs[k] === 'number' && Number.isFinite(inputs[k]) && inputs[k] > 0);
      const candidates = allNumericFields.filter(k => pricePatterns.test(k) || volumePatterns.test(k));
      const priceField = candidates.find(k => /price|ticket|fee|rate/i.test(k)) || candidates[0];
      const volumeField = candidates.find(k => /capacity|units|customers|subscribers|seats|production|sales|trips|yield|area|count|size/i.test(k) && k !== priceField) || candidates[1];
      const costField = candidates.find(k => /cost|expense|maintenance|salaries|rent/i.test(k) && k !== priceField && k !== volumeField) || candidates[2];

      const variables = [];
      if (priceField) variables.push({ field: priceField, type: 'triangular', min: inputs[priceField] * 0.8, max: inputs[priceField] * 1.2, mode: inputs[priceField] });
      if (volumeField) variables.push({ field: volumeField, type: 'triangular', min: inputs[volumeField] * 0.7, max: inputs[volumeField] * 1.3, mode: inputs[volumeField] });
      if (costField) variables.push({ field: costField, type: 'triangular', min: inputs[costField] * 0.8, max: inputs[costField] * 1.2, mode: inputs[costField] });
      return variables;
    }

    function runSectorMonteCarlo() {
      if (!window.InvestmentRiskEngine || !window.InvestmentRiskEngine.runMonteCarlo) return;
      const inputs = mapInputs();
      const variables = getMonteCarloVariables(inputs);
      if (variables.length === 0) {
        alert(isAr ? 'لا توجد متغيرات رقمية مناسبة للمحاكاة.' : 'No suitable numeric variables for simulation.');
        return;
      }
      const mc = window.InvestmentRiskEngine.runMonteCarlo(inputs, variables, 500, analyzeSectorInputs);
      window._lastSectorMonteCarlo = mc;
      const currency = isAr ? 'ر.س' : 'SAR';

      const successEl = document.getElementById('sectorMcSuccessRate');
      if (successEl) successEl.textContent = (mc.successRate * 100).toFixed(1) + '%';
      const meanEl = document.getElementById('sectorMcMeanNpv');
      if (meanEl) meanEl.textContent = formatNumber(mc.npv.mean) + ' ' + currency;
      const varEl = document.getElementById('sectorMcVar95');
      if (varEl) {
        varEl.textContent = formatNumber(mc.risk.var95) + ' ' + currency;
        varEl.style.color = mc.risk.var95 < 0 ? '#f87171' : '#4ade80';
      }
      const cvarEl = document.getElementById('sectorMcCvar95');
      if (cvarEl) {
        cvarEl.textContent = formatNumber(mc.risk.cvar95) + ' ' + currency;
        cvarEl.style.color = mc.risk.cvar95 < 0 ? '#f87171' : '#4ade80';
      }

      const canvas = document.getElementById('sectorMonteCarloChart');
      if (canvas && typeof Chart !== 'undefined') {
        const ctx = canvas.getContext('2d');
        if (window._sectorMonteCarloChart) window._sectorMonteCarloChart.destroy();
        window._sectorMonteCarloChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: mc.histogram.labels,
            datasets: [{
              label: isAr ? 'توزيع NPV' : 'NPV Distribution',
              data: mc.histogram.counts,
              backgroundColor: 'rgba(212,168,83,0.7)',
              borderColor: '#d4a853',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 } },
              y: { ticks: { color: '#94a3b8' } }
            }
          }
        });
      }
    }

    function exportSectorMonteCarloCsv() {
      const mc = window._lastSectorMonteCarlo;
      if (!mc || !mc.samples || mc.samples.length === 0) {
        alert(isAr ? 'يرجى تشغيل المحاكاة أولاً.' : 'Please run the simulation first.');
        return;
      }

      const varNames = mc.variables.map(v => v.field);
      const headers = [isAr ? 'تكرار' : 'Iteration', ...varNames, 'NPV', 'IRR', 'ROI'];
      const escape = (val) => {
        const s = String(val).replace(/"/g, '""');
        return /[",\n\r]/.test(s) ? '"' + s + '"' : s;
      };

      const rows = mc.samples.map(s => [
        s.iteration,
        ...varNames.map(name => s.variables[name]),
        s.npv,
        s.irr,
        s.roi
      ]);

      const csv = '\uFEFF' + headers.map(escape).join(',') + '\n' +
        rows.map(r => r.map(escape).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (isAr ? 'محاكاة_مونت_كارلو' : 'monte_carlo_simulation') + '_' + sectorId + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function renderSectorAnomalies(inputs, result) {
      if (!window.InvestmentRiskEngine || !window.InvestmentRiskEngine.detectAnomalies) return;
      const container = document.getElementById('sectorAnomalyList');
      if (!container) return;
      const warnings = window.InvestmentRiskEngine.detectAnomalies(inputs, result, isAr ? 'ar' : 'en');
      if (warnings.length === 0) {
        container.innerHTML = '';
        return;
      }
      container.innerHTML = '<div style="background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:0.75rem;">' +
        '<strong style="color:#f87171;display:block;margin-bottom:0.5rem;">' + (isAr ? '⚠️ تنبيهات الشذوذ' : '⚠️ Anomaly Alerts') + '</strong>' +
        '<ul style="margin:0;padding-' + (isAr ? 'right' : 'left') + ':1.25rem;color:#fca5a5;font-size:0.85rem;">' +
        warnings.map(w => '<li>' + w.message + '</li>').join('') +
        '</ul></div>';
    }

    function runSectorGoalSeek() {
      if (!window.InvestmentRiskEngine || !window.InvestmentRiskEngine.goalSeek) return;
      const inputs = mapInputs();
      const fieldEl = document.getElementById('sectorGoalSeekField');
      const metricEl = document.getElementById('sectorGoalSeekMetric');
      const valueEl = document.getElementById('sectorGoalSeekValue');
      if (!fieldEl || !metricEl || !valueEl) return;

      const field = fieldEl.value;
      const metric = metricEl.value;
      const targetValue = toNumber(valueEl.value, 0);
      const currentValue = toNumber(inputs[field], 1);
      const min = Math.max(0, currentValue * 0.1);
      const max = currentValue * 5;

      const result = window.InvestmentRiskEngine.goalSeek(inputs, field, metric, targetValue, min, max, analyzeSectorInputs);
      const valueDisplay = document.getElementById('sectorGsRequiredValue');
      const metricDisplay = document.getElementById('sectorGsMetricAtValue');
      const currency = isAr ? 'ر.س' : 'SAR';

      if (valueDisplay) {
        if (result.found) {
          valueDisplay.textContent = formatNumber(result.value);
          valueDisplay.style.color = '#4ade80';
        } else {
          valueDisplay.textContent = isAr ? 'لا يوجد حل' : 'No solution';
          valueDisplay.style.color = '#f87171';
        }
      }

      if (metricDisplay && result.found) {
        const check = analyzeSectorInputs({ ...inputs, [field]: result.value });
        const val = check.metrics[metric];
        const suffix = metric === 'irr' || metric === 'roi' ? '%' : ' ' + currency;
        metricDisplay.textContent = formatNumber(val) + suffix;
        metricDisplay.style.color = metric === 'paybackMonths' ? 'inherit' : (val >= targetValue ? '#4ade80' : '#f87171');
      }
    }

    function runSectorTornado() {
      const canvas = document.getElementById('sectorTornadoChart');
      if (!canvas || typeof Chart === 'undefined') return;
      const select = document.getElementById('sectorTornadoFields');
      const range = toNumber(document.getElementById('sectorTornadoRange').value, 20) / 100;
      if (!select || !select.options) return;

      const selected = Array.from(select.options).filter(o => o.selected).map(o => o.value);
      if (selected.length === 0) {
        alert(isAr ? 'يرجى اختيار متغير واحد على الأقل.' : 'Please select at least one variable.');
        return;
      }
      if (selected.length > 5) {
        alert(isAr ? 'يمكن اختيار 5 متغيرات كحد أقصى.' : 'Maximum 5 variables allowed.');
        return;
      }

      const inputs = mapInputs();
      const baseResult = analyzeSectorInputs(inputs);
      const baseNpv = baseResult.metrics.npv;
      const impacts = selected.map(field => {
        const baseVal = toNumber(inputs[field], 1);
        const up = analyzeSectorInputs({ ...inputs, [field]: baseVal * (1 + range) }).metrics.npv;
        const down = analyzeSectorInputs({ ...inputs, [field]: baseVal * (1 - range) }).metrics.npv;
        return { field, label: field, up: up - baseNpv, down: down - baseNpv, span: Math.abs(up - down) };
      }).sort((a, b) => b.span - a.span);

      const ctx = canvas.getContext('2d');
      if (window._sectorTornadoChart) window._sectorTornadoChart.destroy();
      window._sectorTornadoChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: impacts.map(i => i.label),
          datasets: [
            { label: isAr ? 'تأثير +' : 'Upside', data: impacts.map(i => i.up), backgroundColor: '#4ade80' },
            { label: isAr ? 'تأثير −' : 'Downside', data: impacts.map(i => i.down), backgroundColor: '#f87171' }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#e8ecf4' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, title: { display: true, text: isAr ? 'تغير NPV' : 'NPV Change', color: '#e8ecf4' } },
            y: { ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    function runRealOption() {
      if (!window.RealOptionsEngine || !window.RealOptionsEngine.priceRealOption) {
        alert(isAr ? 'محرك خيارات الاستثمار غير متوفر.' : 'Real options engine is not available.');
        return;
      }
      const result = window._lastResult;
      if (!result || !result.metrics) {
        alert(isAr ? 'يرجى تشغيل التحليل المالي أولاً.' : 'Please run the financial analysis first.');
        return;
      }
      const npv = result.metrics.npv;
      const totalInvestment = result.metrics.totalInvestment || 0;
      const type = document.getElementById('realOptionType').value;
      const volatility = toNumber(document.getElementById('realOptionVolatility').value, 30) / 100;
      const time = toNumber(document.getElementById('realOptionTime').value, 2);
      const rate = toNumber(document.getElementById('realOptionRate').value, 5) / 100;
      const strikeInput = toNumber(document.getElementById('realOptionStrike').value, 0);

      let strike = strikeInput;
      if (strike <= 0) {
        if (type === 'expand') strike = totalInvestment * 0.3;
        else if (type === 'abandon') strike = totalInvestment * 0.5;
        else strike = totalInvestment * 0.1;
      }

      const ro = window.RealOptionsEngine.priceRealOption({
        s0: npv,
        strike: strike,
        volatility: volatility,
        riskFreeRate: rate,
        timeToExpiry: time,
        optionType: type,
        optionMultiplier: 1.5,
        salvageValue: strike
      });

      const currency = isAr ? 'ر.س' : 'SAR';
      const valueEl = document.getElementById('realOptionValue');
      if (valueEl) valueEl.textContent = formatNumber(ro.optionValue) + ' ' + currency;
      const intrinsicEl = document.getElementById('realOptionIntrinsic');
      if (intrinsicEl) intrinsicEl.textContent = formatNumber(ro.intrinsicValue) + ' ' + currency;
      const timeEl = document.getElementById('realOptionTimeValue');
      if (timeEl) timeEl.textContent = formatNumber(ro.timeValue) + ' ' + currency;
      const recEl = document.getElementById('realOptionRecommendation');
      if (recEl) recEl.textContent = ro.recommendation.action;
    }

    function pmt(rate, nper, pv) {
      if (rate === 0) return pv / nper;
      return pv * (rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
    }

    function computeWaterFactoryFinancing(inputs, totalInvestment) {
      const equityRatio = Math.min(100, Math.max(0, inputs.equityRatio || 0));
      const equity = totalInvestment * (equityRatio / 100);
      const loanAmount = totalInvestment - equity;
      const monthlyInterest = (inputs.loanInterestRate || 0) / 100 / 12;
      const loanMonths = Math.max(0, (inputs.loanTermYears || 0) * 12);
      const monthlyInstallment = loanAmount > 0 && loanMonths > 0 ? pmt(monthlyInterest, loanMonths, loanAmount) : 0;
      return { equity, loanAmount, monthlyInstallment };
    }

    function renderWaterFactoryFinancing(inputs, engineInputs) {
      const financing = computeWaterFactoryFinancing(inputs, engineInputs.totalInvestment);
      const totalEl = document.getElementById('wfTotalInvestment');
      if (totalEl) totalEl.textContent = formatNumber(engineInputs.totalInvestment) + ' ' + (isAr ? 'ر.س' : 'SAR');
      const equityEl = document.getElementById('wfEquity');
      if (equityEl) equityEl.textContent = formatNumber(financing.equity) + ' ' + (isAr ? 'ر.س' : 'SAR');
      const loanEl = document.getElementById('wfLoanAmount');
      if (loanEl) loanEl.textContent = formatNumber(financing.loanAmount) + ' ' + (isAr ? 'ر.س' : 'SAR');
      const instEl = document.getElementById('wfMonthlyInstallment');
      if (instEl) instEl.textContent = formatNumber(financing.monthlyInstallment) + ' ' + (isAr ? 'ر.س' : 'SAR');
    }

    function runSensitivityAnalysis(inputs) {
      const base = calculateEngineInputs(inputs);
      const vars = [
        { key: 'bottlePrice', label: isAr ? 'سعر بيع العبوة' : 'Bottle price' },
        { key: 'bottleCostPerUnit', label: isAr ? 'تكلفة الزجاجة' : 'Bottle cost' },
        { key: 'dailyProduction', label: isAr ? 'الإنتاج اليومي' : 'Daily production' }
      ];
      const steps = [-0.2, -0.1, 0, 0.1, 0.2];
      const rows = vars.map(v => {
        const baseVal = inputs[v.key] || 0;
        return {
          label: v.label,
          values: steps.map(s => {
            const modified = { ...inputs, [v.key]: baseVal * (1 + s) };
            const res = calculateEngineInputs(modified);
            const engine = isAr ? window.InvestmentEngine : window.InvestmentEngine;
            const analysis = engine ? engine.analyze(res) : null;
            return analysis && analysis.success ? { npv: analysis.metrics.npv, roi: analysis.metrics.roi } : { npv: 0, roi: 0 };
          })
        };
      });
      return rows;
    }

    function renderSensitivityTable(rows) {
      const tbody = document.getElementById('sensitivityTableBody');
      if (!tbody) return;
      tbody.innerHTML = rows.map(r => {
        return '<tr style="border-bottom: 1px solid rgba(197,160,40,0.1);">' +
          '<td style="padding: 0.5rem;">' + r.label + '</td>' +
          r.values.map(v => '<td style="text-align: center; padding: 0.5rem;">NPV: ' + formatNumber(v.npv) + '<br>ROI: ' + formatNumber(v.roi) + '%</td>').join('') +
          '</tr>';
      }).join('');
    }

    function runCashFlowProjection(inputs) {
      const maxDaily = inputs.dailyProduction || 0;
      const initialUtil = inputs.initialCapacityUtilization || 60;
      const growthRate = inputs.monthlyGrowthRate || 0;
      const growthFactor = 1 + (growthRate / 100);
      const initialDaily = maxDaily * (initialUtil / 100);
      const wastage = (inputs.wastageRate || 0) / 100;
      const costInflationMonthly = Math.pow(1 + ((inputs.annualCostInflation || 0) / 100), 1 / 12);
      const priceInflationMonthly = Math.pow(1 + ((inputs.annualPriceIncrease || 0) / 100), 1 / 12);

      const directRate = (inputs.directSalesRate || 0) / 100;
      const distRate = (inputs.distributorSalesRate || 0) / 100;
      const platformRate = (inputs.platformSalesRate || 0) / 100;
      const distDiscount = (inputs.distributorDiscountRate || 0) / 100;
      const platformCommission = (inputs.platformCommissionRate || 0) / 100;
      const avgNetPrice = inputs.bottlePrice * (directRate + distRate * (1 - distDiscount) + platformRate * (1 - platformCommission));

      const materialCostPerBottle = (inputs.bottleCostPerUnit || 0) + (inputs.capCostPerUnit || 0) + (inputs.labelCostPerUnit || 0);
      const baseVariableCostPerBottle = materialCostPerBottle + (inputs.cartonCostPerBottle || 0) + (inputs.shrinkCostPerBottle || 0);
      const bottlesPerTrip = inputs.bottlesPerDeliveryTrip || 0;
      const tripCost = (inputs.avgDeliveryDistanceKm || 0) * (inputs.deliveryCostPerKm || 0);
      const autoLogisticsCost = bottlesPerTrip > 0 ? tripCost / bottlesPerTrip : 0;
      const logisticsCostPerBottle = autoLogisticsCost > 0 ? autoLogisticsCost : (inputs.logisticsCostPerBottle || 0);
      const variableCostPerBottle = baseVariableCostPerBottle + logisticsCostPerBottle;

      const engineBase = calculateEngineInputs(inputs);
      const monthlyFixedBase = engineBase.monthlyFixedCosts;

      const rows = [];
      let cumulative = -engineBase.totalInvestment;
      for (let m = 0; m < 12; m++) {
        const daily = Math.min(maxDaily, initialDaily * Math.pow(growthFactor, m));
        const effectiveDaily = daily * (1 - wastage);
        const priceMultiplier = Math.pow(priceInflationMonthly, m);
        const costMultiplier = Math.pow(costInflationMonthly, m);
        const revenue = effectiveDaily * avgNetPrice * priceMultiplier * 30;
        const variableCost = effectiveDaily * variableCostPerBottle * costMultiplier * 30;
        const monthlyFixed = monthlyFixedBase * costMultiplier;
        const netCashFlow = revenue - monthlyFixed - variableCost;
        cumulative += netCashFlow;
        rows.push({ month: m + 1, revenue, costs: monthlyFixed + variableCost, netCashFlow, cumulative });
      }
      return rows;
    }

    function renderCashFlowTable(rows) {
      const tbody = document.getElementById('cashflowTableBody');
      if (!tbody) return;
      tbody.innerHTML = rows.map(r => {
        const cumulativeClass = r.cumulative >= 0 ? 'style="color: #4ade80;"' : 'style="color: #f87171;"';
        return '<tr style="border-bottom: 1px solid rgba(197,160,40,0.1);">' +
          '<td style="padding: 0.5rem;">' + r.month + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(r.revenue) + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(r.costs) + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(r.netCashFlow) + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;" ' + cumulativeClass + '>' + formatNumber(r.cumulative) + '</td>' +
          '</tr>';
      }).join('');
    }

    function renderExecutiveSummary(inputs, engineInputs, result) {
      const textEl = document.getElementById('executiveSummaryText');
      const invEl = document.getElementById('esTotalInvestment');
      const profitEl = document.getElementById('esMonthlyProfit');
      const beEl = document.getElementById('esBreakEven');
      const cfEl = document.getElementById('esAnnualCashFlow');
      if (!textEl) return;

      const m = result.metrics;
      const monthlyProfit = engineInputs.monthlyRevenue - engineInputs.monthlyFixedCosts - engineInputs.monthlyVariableCosts;
      const annualCashFlow = monthlyProfit * 12;
      const currency = isAr ? 'ر.س' : 'SAR';

      if (invEl) invEl.textContent = formatNumber(engineInputs.totalInvestment) + ' ' + currency;
      if (profitEl) profitEl.textContent = formatNumber(monthlyProfit) + ' ' + currency;
      if (beEl) beEl.textContent = formatNumber(m.breakEvenUnits) + ' ' + (isAr ? 'عبوة' : 'bottles');
      if (cfEl) cfEl.textContent = formatNumber(annualCashFlow) + ' ' + currency;

      const decision = m.roi >= 20 && m.paybackMonths <= 36
        ? (isAr ? 'موصى به' : 'Recommended')
        : (m.roi >= 10 && m.paybackMonths <= 60
          ? (isAr ? 'يحتاج مراجعة' : 'Needs review')
          : (isAr ? 'غير موصى به' : 'Not recommended'));

      const summaryAr = 'بناءً على المدخلات، يتطلب المشروع استثماراً أولياً قدره <strong>' + formatNumber(engineInputs.totalInvestment) + ' ر.س</strong>، ويحقق ربحاً شهرياً متوسطاً قدره <strong>' + formatNumber(monthlyProfit) + ' ر.س</strong>. معدل العائد على الاستثمار <strong>' + formatNumber(m.roi) + '%</strong> وفترة الاسترداد <strong>' + formatNumber(m.paybackMonths) + ' شهر</strong>. التوصية العامة: <strong>' + decision + '</strong>.';
      const summaryEn = 'Based on the inputs, the project requires an initial investment of <strong>' + formatNumber(engineInputs.totalInvestment) + ' SAR</strong>, and generates an average monthly profit of <strong>' + formatNumber(monthlyProfit) + ' SAR</strong>. The return on investment is <strong>' + formatNumber(m.roi) + '%</strong> with a payback period of <strong>' + formatNumber(m.paybackMonths) + ' months</strong>. Overall recommendation: <strong>' + decision + '</strong>.';

      textEl.innerHTML = isAr ? summaryAr : summaryEn;
    }

    function isProFormaSector(id) {
      return ['water-factory', 'industrial', 'food-factory', 'real-estate', 'restaurants', 'technology'].includes(id);
    }

    function renderWaterFactoryAdvanced(inputs, engineInputs, result) {
      renderWaterFactoryFinancing(inputs, engineInputs);
      const sensitivityRows = runSensitivityAnalysis(inputs);
      renderSensitivityTable(sensitivityRows);
      const cashFlowRows = runCashFlowProjection(inputs);
      renderCashFlowTable(cashFlowRows);
      renderProFormaStatements(inputs, 'water-factory');
      renderWaterFactoryKPIs(inputs, engineInputs);
      renderBottleSizeComparison(inputs, engineInputs);
      renderRiskAnalysis(inputs);
    }

    function renderGenericProFormaAdvanced(inputs, engineInputs, result) {
      // Hide water-factory-specific sections
      const kpiSection = document.querySelector('.kpi-summary');
      if (kpiSection) kpiSection.style.display = 'none';
      const bottleSection = document.querySelector('.bottle-size-comparison');
      if (bottleSection) bottleSection.style.display = 'none';

      renderProFormaStatements(inputs, sectorId);
    }

    function getProFormaMonteCarloVariables(inputs, sector) {
      if (sector === 'water-factory') {
        return [
          { name: 'bottlePrice', field: 'bottlePrice', type: 'triangular', min: inputs.bottlePrice * 0.8, max: inputs.bottlePrice * 1.2, mode: inputs.bottlePrice },
          { name: 'dailyProduction', field: 'dailyProduction', type: 'triangular', min: inputs.dailyProduction * 0.8, max: inputs.dailyProduction * 1.2, mode: inputs.dailyProduction },
          { name: 'bottleCost', field: 'bottleCostPerUnit', type: 'triangular', min: inputs.bottleCostPerUnit * 0.8, max: inputs.bottleCostPerUnit * 1.2, mode: inputs.bottleCostPerUnit }
        ];
      }
      const priceField = inputs.unitPrice ? 'unitPrice' : (inputs.avgTicket ? 'avgTicket' : (inputs.subscriptionPrice ? 'subscriptionPrice' : 'unitPrice'));
      const volumeField = inputs.monthlyCapacity ? 'monthlyCapacity' : (inputs.dailyCustomers ? 'dailyCustomers' : (inputs.subscribers ? 'subscribers' : 'monthlyCapacity'));
      const costField = inputs.rawMaterialCostPerUnit ? 'rawMaterialCostPerUnit' : (inputs.rawMaterialCost ? 'rawMaterialCost' : (inputs.foodCostRate ? 'foodCostRate' : 'rawMaterialCostPerUnit'));
      return [
        { name: priceField, field: priceField, type: 'triangular', min: inputs[priceField] * 0.8, max: inputs[priceField] * 1.2, mode: inputs[priceField] },
        { name: volumeField, field: volumeField, type: 'triangular', min: inputs[volumeField] * 0.7, max: inputs[volumeField] * 1.3, mode: inputs[volumeField] },
        { name: costField, field: costField, type: 'triangular', min: inputs[costField] * 0.8, max: inputs[costField] * 1.2, mode: inputs[costField] }
      ].filter(v => inputs[v.field] > 0);
    }

    function getProFormaSensitivityConfig(inputs, sector) {
      if (sector === 'water-factory') {
        return { priceField: 'bottlePrice', volumeField: 'dailyProduction', priceLabel: isAr ? 'سعر البيع' : 'Price', volumeLabel: isAr ? 'حجم الإنتاج' : 'Volume' };
      }
      if (sector === 'real-estate') {
        return { priceField: 'unitPrice', volumeField: 'unitsCount', priceLabel: isAr ? 'سعر الوحدة' : 'Unit Price', volumeLabel: isAr ? 'عدد الوحدات' : 'Units' };
      }
      if (sector === 'restaurants') {
        return { priceField: 'avgTicket', volumeField: 'dailyCustomers', priceLabel: isAr ? 'متوسط الفاتورة' : 'Avg Ticket', volumeLabel: isAr ? 'العملاء اليوميين' : 'Daily Customers' };
      }
      if (sector === 'technology') {
        return { priceField: 'subscriptionPrice', volumeField: 'subscribers', priceLabel: isAr ? 'سعر الاشتراك' : 'Subscription Price', volumeLabel: isAr ? 'المشتركين' : 'Subscribers' };
      }
      // industrial / food-factory / default
      return { priceField: 'unitPrice', volumeField: 'monthlyCapacity', priceLabel: isAr ? 'سعر الوحدة' : 'Unit Price', volumeLabel: isAr ? 'الطاقة الشهرية' : 'Monthly Capacity' };
    }

    function renderProFormaStatements(inputs, sectorOverride) {
      if (!window.ProFormaEngine || !window.ProFormaEngine.buildProFormaStatements) return;
      const pfSector = sectorOverride || 'water-factory';
      const projectionMonths = inputs.analysisDuration || inputs.projectMonths || 60;
      const pf = window.ProFormaEngine.buildProFormaStatements(inputs, projectionMonths, { sector: pfSector });

      const currency = isAr ? 'ر.س' : 'SAR';
      const revenueEl = document.getElementById('pfTotalRevenue');
      if (revenueEl) revenueEl.textContent = formatNumber(pf.summary.totalRevenue) + ' ' + currency;
      const netIncomeEl = document.getElementById('pfTotalNetIncome');
      if (netIncomeEl) netIncomeEl.textContent = formatNumber(pf.summary.totalNetIncome) + ' ' + currency;
      const npvEl = document.getElementById('pfNpv');
      if (npvEl) {
        npvEl.textContent = formatNumber(pf.summary.npv) + ' ' + currency;
        npvEl.style.color = pf.summary.npv >= 0 ? '#4ade80' : '#f87171';
      }
      const irrEl = document.getElementById('pfIrr');
      if (irrEl) irrEl.textContent = formatNumber(pf.summary.irr) + '%';

      const gapEl = document.getElementById('pfFundingGap');
      if (gapEl) {
        if (pf.summary.fundingGap > 0) {
          gapEl.textContent = formatNumber(pf.summary.fundingGap) + ' ' + currency + (isAr ? ' (يحتاج تمويلاً إضافياً)' : ' (additional funding needed)');
          gapEl.style.color = '#f87171';
        } else {
          gapEl.textContent = isAr ? 'لا يوجد عجز نقدي' : 'No cash deficit';
          gapEl.style.color = '#4ade80';
        }
      }

      const stepCapexEl = document.getElementById('pfStepCapex');
      if (stepCapexEl) stepCapexEl.textContent = formatNumber(pf.summary.stepCapexTotal || 0) + ' ' + currency;

      const expansionsPanel = document.getElementById('capacityExpansionsPanel');
      const expansionsBody = document.getElementById('capacityExpansionsBody');
      if (expansionsPanel && expansionsBody) {
        if (pf.capacityHistory && pf.capacityHistory.length > 0) {
          expansionsPanel.style.display = 'block';
          expansionsBody.innerHTML = pf.capacityHistory.map(e =>
            '<tr style="border-bottom: 1px solid rgba(197,160,40,0.1);"><td style="padding: 0.5rem;">' + e.month + '</td><td style="text-align: center; padding: 0.5rem;">' + formatNumber(e.newCapacity) + '</td><td style="text-align: center; padding: 0.5rem;">' + formatNumber(e.cost) + ' ' + currency + '</td></tr>'
          ).join('');
        } else {
          expansionsPanel.style.display = 'none';
        }
      }

      renderProFormaCashCurve(pf.cashFlow);

      function renderProFormaCashCurve(rows) {
        const canvas = document.getElementById('proFormaCashCurveChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const ctx = canvas.getContext('2d');
        if (window._proFormaCashCurveChart) {
          window._proFormaCashCurveChart.destroy();
        }
        const labels = rows.map(r => isAr ? 'ش ' + r.month : 'M' + r.month);
        const data = rows.map(r => r.cashBalance);
        const pointColors = data.map(v => v < 0 ? '#f87171' : '#4ade80');
        window._proFormaCashCurveChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: isAr ? 'الرصيد النقدي التراكمي' : 'Cumulative Cash Balance',
              data: data,
              borderColor: '#d4a853',
              backgroundColor: 'rgba(212,168,83,0.15)',
              fill: true,
              tension: 0.3,
              pointBackgroundColor: pointColors,
              pointRadius: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return formatNumber(context.parsed.y) + ' ' + currency;
                  }
                }
              }
            },
            scales: {
              x: { ticks: { color: '#94a3b8', maxTicksLimit: 12 } },
              y: { ticks: { color: '#94a3b8', callback: function(v) { return formatNumber(v); } } }
            }
          }
        });
      }

      renderProFormaSensitivity(inputs, pfSector);
      renderMonteCarlo(inputs, pfSector);

      function renderMonteCarlo(baseInputs, mcSector) {
        if (!window.ProFormaEngine || !window.ProFormaEngine.runMonteCarlo) return;
        const variables = getProFormaMonteCarloVariables(baseInputs, mcSector);
        const mc = window.ProFormaEngine.runMonteCarlo(baseInputs, variables, 1000, { sector: mcSector });

        const successEl = document.getElementById('mcSuccessRate');
        if (successEl) successEl.textContent = (mc.successRate * 100).toFixed(1) + '%';
        const meanEl = document.getElementById('mcMeanNpv');
        if (meanEl) meanEl.textContent = formatNumber(mc.npv.mean) + ' ' + currency;
        const medianEl = document.getElementById('mcMedianNpv');
        if (medianEl) medianEl.textContent = formatNumber(mc.npv.median) + ' ' + currency;
        const rangeEl = document.getElementById('mcNpvRange');
        if (rangeEl) rangeEl.textContent = formatNumber(mc.npv.p5) + ' - ' + formatNumber(mc.npv.p95) + ' ' + currency;

        const var95El = document.getElementById('mcVar95');
        if (var95El) {
          var95El.textContent = formatNumber(mc.risk.var95) + ' ' + currency;
          var95El.style.color = mc.risk.var95 < 0 ? '#f87171' : '#4ade80';
        }
        const cvar95El = document.getElementById('mcCvar95');
        if (cvar95El) {
          cvar95El.textContent = formatNumber(mc.risk.cvar95) + ' ' + currency;
          cvar95El.style.color = mc.risk.cvar95 < 0 ? '#f87171' : '#4ade80';
        }
        const var99El = document.getElementById('mcVar99');
        if (var99El) {
          var99El.textContent = formatNumber(mc.risk.var99) + ' ' + currency;
          var99El.style.color = mc.risk.var99 < 0 ? '#f87171' : '#4ade80';
        }
        const cvar99El = document.getElementById('mcCvar99');
        if (cvar99El) {
          cvar99El.textContent = formatNumber(mc.risk.cvar99) + ' ' + currency;
          cvar99El.style.color = mc.risk.cvar99 < 0 ? '#f87171' : '#4ade80';
        }

        const canvas = document.getElementById('monteCarloHistogramChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const ctx = canvas.getContext('2d');
        if (window._monteCarloHistogramChart) window._monteCarloHistogramChart.destroy();
        window._monteCarloHistogramChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: mc.histogram.labels,
            datasets: [{
              label: isAr ? 'توزيع NPV' : 'NPV Distribution',
              data: mc.histogram.counts,
              backgroundColor: 'rgba(212,168,83,0.7)',
              borderColor: '#d4a853',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: function(items) { return isAr ? 'فئة NPV' : 'NPV Range'; }
                }
              }
            },
            scales: {
              x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 } },
              y: { ticks: { color: '#94a3b8' }, title: { display: true, text: isAr ? 'عدد السيناريوهات' : 'Scenarios', color: '#e8ecf4' } }
            }
          }
        });
      }

      function renderProFormaSensitivity(baseInputs, sensSector) {
        if (!window.ProFormaEngine || !window.ProFormaEngine.buildProFormaStatements) return;
        const canvas = document.getElementById('proFormaSensitivityChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const ctx = canvas.getContext('2d');
        if (window._proFormaSensitivityChart) {
          window._proFormaSensitivityChart.destroy();
        }

        const sensConfig = getProFormaSensitivityConfig(baseInputs, sensSector);
        const variants = [-20, -10, 0, 10, 20];
        const priceScenarios = variants.map(pct => {
          const copy = { ...baseInputs, [sensConfig.priceField]: baseInputs[sensConfig.priceField] * (1 + pct / 100) };
          const pf = window.ProFormaEngine.buildProFormaStatements(copy, 60, { sector: sensSector });
          return { label: (pct > 0 ? '+' : '') + pct + '%', npv: pf.summary.npv, irr: pf.summary.irr };
        });
        const volumeScenarios = variants.map(pct => {
          const copy = { ...baseInputs, [sensConfig.volumeField]: baseInputs[sensConfig.volumeField] * (1 + pct / 100) };
          const pf = window.ProFormaEngine.buildProFormaStatements(copy, 60, { sector: sensSector });
          return { label: (pct > 0 ? '+' : '') + pct + '%', npv: pf.summary.npv, irr: pf.summary.irr };
        });

        const labels = variants.map(pct => (pct > 0 ? '+' : '') + pct + '%');
        window._proFormaSensitivityChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: (isAr ? 'NPV - ' : 'NPV - ') + sensConfig.priceLabel,
                data: priceScenarios.map(s => s.npv),
                backgroundColor: 'rgba(212,168,83,0.7)',
                yAxisID: 'y'
              },
              {
                label: (isAr ? 'NPV - ' : 'NPV - ') + sensConfig.volumeLabel,
                data: volumeScenarios.map(s => s.npv),
                backgroundColor: 'rgba(59,130,246,0.7)',
                yAxisID: 'y'
              },
              {
                label: (isAr ? 'IRR - ' : 'IRR - ') + sensConfig.priceLabel,
                data: priceScenarios.map(s => s.irr),
                type: 'line',
                borderColor: '#f87171',
                borderWidth: 2,
                pointBackgroundColor: '#f87171',
                yAxisID: 'y1'
              },
              {
                label: (isAr ? 'IRR - ' : 'IRR - ') + sensConfig.volumeLabel,
                data: volumeScenarios.map(s => s.irr),
                type: 'line',
                borderColor: '#4ade80',
                borderWidth: 2,
                pointBackgroundColor: '#4ade80',
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#e8ecf4' } } },
            scales: {
              x: { ticks: { color: '#94a3b8' } },
              y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: { display: true, text: 'NPV', color: '#e8ecf4' },
                ticks: { color: '#94a3b8' }
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: { display: true, text: 'IRR %', color: '#e8ecf4' },
                ticks: { color: '#94a3b8' },
                grid: { drawOnChartArea: false }
              }
            }
          }
        });
      }

      // Aggregate by year
      function aggregateByYear(rows, keys) {
        const years = {};
        rows.forEach(r => {
          const year = Math.ceil(r.month / 12);
          if (!years[year]) years[year] = {};
          keys.forEach(k => {
            years[year][k] = (years[year][k] || 0) + r[k];
          });
        });
        return years;
      }

      const incomeYears = aggregateByYear(pf.incomeStatement, ['revenue', 'cogs', 'grossProfit', 'opex', 'ebitda', 'depreciation', 'ebit', 'interestExpense', 'tax', 'netIncome']);
      const cashYears = aggregateByYear(pf.cashFlow, ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'netCashFlow']);
      const bsLastMonthByYear = {};
      pf.balanceSheet.forEach(r => {
        const year = Math.ceil(r.month / 12);
        bsLastMonthByYear[year] = r;
      });

      const labels = {
        ar: {
          revenue: 'الإيرادات', cogs: 'تكلفة البضاعة المباعة', grossProfit: 'إجمالي الربح',
          opex: 'المصاريف التشغيلية', ebitda: 'EBITDA', depreciation: 'الإهلاك',
          ebit: 'EBIT', interestExpense: 'مصاريف الفائدة', tax: 'الضريبة', netIncome: 'صافي الربح',
          operatingCashFlow: 'التدفق النقدي التشغيلي', investingCashFlow: 'التدفق الاستثماري',
          financingCashFlow: 'التدفق التمويلي', netCashFlow: 'صافي التدفق النقدي',
          cash: 'النقد', accountsReceivable: 'الذمم المدينة', inventory: 'المخزون',
          netFixedAssets: 'الأصول الثابتة الصافية', totalAssets: 'إجمالي الأصول',
          accountsPayable: 'الذمم الدائنة', totalDebt: 'إجمالي الديون', totalEquity: 'حقوق الملكية'
        },
        en: {
          revenue: 'Revenue', cogs: 'COGS', grossProfit: 'Gross Profit',
          opex: 'Operating Expenses', ebitda: 'EBITDA', depreciation: 'Depreciation',
          ebit: 'EBIT', interestExpense: 'Interest Expense', tax: 'Tax', netIncome: 'Net Income',
          operatingCashFlow: 'Operating Cash Flow', investingCashFlow: 'Investing Cash Flow',
          financingCashFlow: 'Financing Cash Flow', netCashFlow: 'Net Cash Flow',
          cash: 'Cash', accountsReceivable: 'Accounts Receivable', inventory: 'Inventory',
          netFixedAssets: 'Net Fixed Assets', totalAssets: 'Total Assets',
          accountsPayable: 'Accounts Payable', totalDebt: 'Total Debt', totalEquity: 'Total Equity'
        }
      };
      const t = isAr ? labels.ar : labels.en;

      function renderYearlyTable(tbodyId, rowsByYear, keys) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = keys.map(k => {
          const cells = [1, 2, 3, 4, 5].map(y => {
            const val = rowsByYear[y] ? rowsByYear[y][k] : 0;
            return '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(val) + '</td>';
          }).join('');
          return '<tr style="border-bottom: 1px solid rgba(197,160,40,0.1);"><td style="padding: 0.5rem;">' + t[k] + '</td>' + cells + '</tr>';
        }).join('');
      }

      renderYearlyTable('proFormaIncomeBody', incomeYears, ['revenue', 'cogs', 'grossProfit', 'opex', 'ebitda', 'depreciation', 'ebit', 'interestExpense', 'tax', 'netIncome']);
      renderYearlyTable('proFormaCashflowBody', cashYears, ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'netCashFlow']);
      renderYearlyTable('proFormaBalanceBody', bsLastMonthByYear, ['cash', 'accountsReceivable', 'inventory', 'netFixedAssets', 'totalAssets', 'accountsPayable', 'totalDebt', 'totalEquity']);
    }

    function renderWaterFactoryKPIs(inputs, engineInputs) {
      const effectiveDaily = engineInputs.monthlyRevenue / (engineInputs.unitPrice * 30);
      const monthlyUnits = effectiveDaily * 30;
      const costPer1000 = monthlyUnits > 0 ? (engineInputs.monthlyFixedCosts + engineInputs.monthlyVariableCosts) / (monthlyUnits / 1000) : 0;
      const totalWorkers = (inputs.shiftCount || 0) * (inputs.workersPerShift || 0);
      const workerProductivity = totalWorkers > 0 && (inputs.operatingHoursPerDay || 0) > 0 ? (monthlyUnits / totalWorkers) / (inputs.operatingHoursPerDay * 30) : 0;

      const costEl = document.getElementById('wfKpiCostPer1000');
      if (costEl) costEl.textContent = formatNumber(costPer1000) + ' ' + (isAr ? 'ر.س' : 'SAR');
      const prodEl = document.getElementById('wfKpiWorkerProductivity');
      if (prodEl) prodEl.textContent = formatNumber(workerProductivity) + ' ' + (isAr ? 'عبوة/عامل/ساعة' : 'bottles/worker/hour');
      const wastageEl = document.getElementById('wfKpiWastage');
      if (wastageEl) wastageEl.textContent = formatNumber(inputs.wastageRate || 0) + '%';
      const unitsEl = document.getElementById('wfKpiMonthlyUnits');
      if (unitsEl) unitsEl.textContent = formatNumber(monthlyUnits);
    }

    function renderBottleSizeComparison(inputs, engineInputs) {
      const tbody = document.getElementById('bottleSizeTableBody');
      if (!tbody) return;
      const sizes = [
        { nameAr: '330 مل', nameEn: '330 ml', priceFactor: 0.67, costFactor: 0.6 },
        { nameAr: '500 مل', nameEn: '500 ml', priceFactor: 1.0, costFactor: 1.0 },
        { nameAr: '1.5 لتر', nameEn: '1.5 L', priceFactor: 2.0, costFactor: 1.7 },
        { nameAr: '19 لتر (5 جالون)', nameEn: '19 L (5 gallon)', priceFactor: 16.67, costFactor: 12.0 }
      ];
      const dailyVolume = engineInputs.monthlyRevenue / (engineInputs.unitPrice * 30);
      tbody.innerHTML = sizes.map(s => {
        const sizePrice = inputs.bottlePrice * s.priceFactor;
        const sizeCost = engineInputs.unitVariableCost * s.costFactor;
        const sizeRevenue = dailyVolume * sizePrice * 30;
        const sizeVariableCost = dailyVolume * sizeCost * 30;
        const margin = sizePrice - sizeCost;
        const name = isAr ? s.nameAr : s.nameEn;
        return '<tr style="border-bottom: 1px solid rgba(197,160,40,0.1);">' +
          '<td style="padding: 0.5rem;">' + name + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(sizePrice) + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(sizeCost) + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(margin) + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(sizeRevenue) + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(sizeVariableCost) + '</td>' +
          '</tr>';
      }).join('');
    }

    function renderRiskAnalysis(inputs) {
      const tbody = document.getElementById('riskTableBody');
      if (!tbody) return;
      const risks = [
        { name: inputs.risk1Name || (isAr ? 'المخاطرة الأولى' : 'Risk 1'), prob: inputs.risk1Probability || 0, impact: inputs.risk1Impact || 0 },
        { name: inputs.risk2Name || (isAr ? 'المخاطرة الثانية' : 'Risk 2'), prob: inputs.risk2Probability || 0, impact: inputs.risk2Impact || 0 },
        { name: inputs.risk3Name || (isAr ? 'المخاطرة الثالثة' : 'Risk 3'), prob: inputs.risk3Probability || 0, impact: inputs.risk3Impact || 0 }
      ];
      tbody.innerHTML = risks.map(r => {
        const expectedCost = r.prob / 100 * r.impact;
        return '<tr style="border-bottom: 1px solid rgba(197,160,40,0.1);">' +
          '<td style="padding: 0.5rem;">' + r.name + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(r.prob) + '%</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(r.impact) + '</td>' +
          '<td style="text-align: center; padding: 0.5rem;">' + formatNumber(expectedCost) + '</td>' +
          '</tr>';
      }).join('');
    }

    function exportWaterFactoryReport(type) {
      const result = window._lastResult;
      if (!result) {
        alert(isAr ? 'يرجى حساب النتائج أولاً.' : 'Please calculate results first.');
        return;
      }
      if (type === 'pdf' && window.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ direction: isAr ? 'rtl' : 'ltr' });
        doc.text(isAr ? 'تقرير مصنع مياه' : 'Water Factory Report', 10, 10);
        doc.text('ROI: ' + result.metrics.roi + '%', 10, 20);
        doc.text('NPV: ' + result.metrics.npv, 10, 30);
        doc.save('water-factory-report.pdf');
      } else if (type === 'excel' && window.XLSX) {
        const wb = window.XLSX.utils.book_new();
        const wsData = [
          [isAr ? 'المؤشر' : 'Metric', isAr ? 'القيمة' : 'Value'],
          ['ROI', result.metrics.roi],
          ['NPV', result.metrics.npv],
          ['IRR', result.metrics.irr],
          ['Payback', result.metrics.paybackMonths]
        ];
        const ws = window.XLSX.utils.aoa_to_sheet(wsData);
        window.XLSX.utils.book_append_sheet(wb, ws, 'Report');
        window.XLSX.writeFile(wb, 'water-factory-report.xlsx');
      } else {
        alert(isAr ? 'مكتبة التصدير غير متوفرة.' : 'Export library not available.');
      }
    }

    const scenarioPresets = {
      pessimistic: {
        initialCapacityUtilization: 40,
        monthlyGrowthRate: 2,
        wastageRate: 5,
        bottlePrice: 1.3,
        bottleCostPerUnit: 0.28,
        directSalesRate: 20,
        distributorSalesRate: 60,
        distributorDiscountRate: 25,
        platformSalesRate: 20,
        platformCommissionRate: 18
      },
      expected: {
        initialCapacityUtilization: 60,
        monthlyGrowthRate: 5,
        wastageRate: 2,
        bottlePrice: 1.5,
        bottleCostPerUnit: 0.25,
        directSalesRate: 30,
        distributorSalesRate: 50,
        distributorDiscountRate: 20,
        platformSalesRate: 20,
        platformCommissionRate: 15
      },
      optimistic: {
        initialCapacityUtilization: 85,
        monthlyGrowthRate: 8,
        wastageRate: 1,
        bottlePrice: 1.7,
        bottleCostPerUnit: 0.22,
        directSalesRate: 40,
        distributorSalesRate: 45,
        distributorDiscountRate: 18,
        platformSalesRate: 15,
        platformCommissionRate: 12
      }
    };

    function loadScenario(name) {
      const preset = scenarioPresets[name];
      if (!preset) return;
      Object.keys(preset).forEach(key => {
        const basicEl = document.getElementById(key);
        const expertEl = document.getElementById('expert_basic_' + key);
        const value = preset[key];
        if (basicEl) basicEl.value = value;
        if (expertEl) expertEl.value = value;
      });
      calculate();
    }

    function renderDecisionIntelligence(di) {
      const panel = document.getElementById('decisionIntelligencePanel');
      if (!panel) return;
      panel.classList.remove('hidden');
      const t = isAr ? window.DecisionIntelligence.i18n.ar : window.DecisionIntelligence.i18n.en;

      const conf = di.confidenceScore;
      window.DecisionIntelligence.renderCircularGauge('diConfidenceGauge', conf.score, isAr ? 'درجة الثقة' : 'Confidence Score');
      window.DecisionIntelligence.renderConfidenceBreakdown('diConfidenceBreakdown', conf);

      window.DecisionIntelligence.renderDecisionPanel('diVerdict', di.recommendation);
      window.DecisionIntelligence.renderSummary('diSummary', di.dataQuality, di.riskAnalysis, di.financingAnalysis, di.marketAnalysis, di.cashFlowAnalysis, di.altmanZScore);
      window.DecisionIntelligence.renderDataQuality('diDataQuality', di.dataQuality);
      window.DecisionIntelligence.renderMarketScores('diMarketScores', di.marketAnalysis);
      window.DecisionIntelligence.renderList('diRiskList', di.riskAnalysis.categories || [], 'risk');
      window.DecisionIntelligence.renderList('diKeyRisks', di.keyRisks, 'risk');
      window.DecisionIntelligence.renderList('diKeyOpportunities', di.keyOpportunities, 'opportunity');

      // Charts (Chart.js)
      const metrics = di._engineResultMetrics || (window._lastResult && window._lastResult.metrics) || {};
      window.DecisionIntelligence.renderCashFlowChart('diCashFlowChart', di.cashFlowAnalysis, metrics);
      window.DecisionIntelligence.renderRiskChart('diRiskChart', di.riskAnalysis);
      window.DecisionIntelligence.renderFinancingChart('diFinancingChart', di._inputs || {}, di.financingAnalysis);

      const finSummary = document.getElementById('diFinancingSummary');
      if (finSummary) {
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

  const skipped = [];

  for (const sector of sectorsAr) {
    if (sector.id === 'cloud-kitchen') { skipped.push(sector.id); continue; }
    fs.writeFileSync(path.join(arDir, `${sector.id}.html`), generatePage(sector, 'ar'), 'utf8');
  }

  for (const sector of sectorsEn) {
    if (sector.id === 'cloud-kitchen') { skipped.push(sector.id); continue; }
    fs.writeFileSync(path.join(enDir, `${sector.id}.html`), generatePage(sector, 'en'), 'utf8');
  }

  console.log(`Generated ${sectorsAr.length - 1} Arabic and ${sectorsEn.length - 1} English sector calculators. Skipped custom page(s): ${[...new Set(skipped)].join(', ')}.`);
}

main();
