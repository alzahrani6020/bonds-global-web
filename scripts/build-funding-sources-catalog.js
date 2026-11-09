/**
 * Builds scripts/funding-sources-fallback.js and the SQL expansion migration
 * from the verified Arab-country catalog below.
 *
 * Sources: SAMA, CBUAE register Aug 2026, CBE, CBJ, CBK, QCB, CBO, CBB,
 * Bank Al-Maghrib, CBL, PMA, Algeria Ministry of Finance, official SME agencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const COUNTRY = {
  SA: { ar: 'السعودية', en: 'Saudi Arabia', cur: 'SAR' },
  AE: { ar: 'الإمارات', en: 'the UAE', cur: 'AED' },
  EG: { ar: 'مصر', en: 'Egypt', cur: 'EGP' },
  JO: { ar: 'الأردن', en: 'Jordan', cur: 'JOD' },
  KW: { ar: 'الكويت', en: 'Kuwait', cur: 'KWD' },
  QA: { ar: 'قطر', en: 'Qatar', cur: 'QAR' },
  BH: { ar: 'البحرين', en: 'Bahrain', cur: 'BHD' },
  OM: { ar: 'عُمان', en: 'Oman', cur: 'OMR' },
  MA: { ar: 'المغرب', en: 'Morocco', cur: 'MAD' },
  TN: { ar: 'تونس', en: 'Tunisia', cur: 'TND' },
  DZ: { ar: 'الجزائر', en: 'Algeria', cur: 'DZD' },
  IQ: { ar: 'العراق', en: 'Iraq', cur: 'IQD' },
  LB: { ar: 'لبنان', en: 'Lebanon', cur: 'USD' },
  LY: { ar: 'ليبيا', en: 'Libya', cur: 'LYD' },
  SD: { ar: 'السودان', en: 'Sudan', cur: 'SDG' },
  YE: { ar: 'اليمن', en: 'Yemen', cur: 'YER' },
  PS: { ar: 'فلسطين', en: 'Palestine', cur: 'USD' },
  SY: { ar: 'سوريا', en: 'Syria', cur: 'SYP' },
  MR: { ar: 'موريتانيا', en: 'Mauritania', cur: 'MRU' },
  SO: { ar: 'الصومال', en: 'Somalia', cur: 'USD' },
  DJ: { ar: 'جيبوتي', en: 'Djibouti', cur: 'DJF' },
  KM: { ar: 'جزر القمر', en: 'Comoros', cur: 'KMF' }
};

function bank(id, ar, en, cc, site, extra) {
  extra = extra || {};
  const c = COUNTRY[cc];
  return Object.assign({
    id: id,
    type: 'bank',
    name_ar: ar,
    name_en: en,
    country_code: cc,
    sector: extra.sector || 'all',
    description_ar: extra.description_ar || 'تمويل الشركات والمنشآت الصغيرة والمتوسطة عبر منتجات التمويل التجاري والإسلامي حسب ترخيص البنك.',
    description_en: extra.description_en || 'Corporate and SME financing through conventional or Islamic products, according to the bank licence.',
    eligibility_ar: extra.eligibility_ar || ('شركات ومؤسسات مسجلة في ' + c.ar + '.'),
    eligibility_en: extra.eligibility_en || ('Registered companies and institutions in ' + c.en + '.'),
    min_amount: extra.min_amount == null ? null : extra.min_amount,
    max_amount: extra.max_amount == null ? null : extra.max_amount,
    currency: extra.currency || c.cur,
    financing_type: extra.financing_type || 'loan',
    website: site,
    is_featured: !!extra.featured,
    sort_order: 0
  }, extra.more || {});
}

function gov(id, ar, en, cc, site, extra) {
  extra = extra || {};
  const c = COUNTRY[cc];
  return Object.assign({
    id: id,
    type: extra.type || 'government_program',
    name_ar: ar,
    name_en: en,
    country_code: cc,
    sector: extra.sector || 'all',
    description_ar: extra.description_ar,
    description_en: extra.description_en,
    eligibility_ar: extra.eligibility_ar || ('المشاريع المؤهلة وفق شروط البرنامج في ' + c.ar + '.'),
    eligibility_en: extra.eligibility_en || ('Eligible projects under the programme rules in ' + c.en + '.'),
    min_amount: extra.min_amount == null ? null : extra.min_amount,
    max_amount: extra.max_amount == null ? null : extra.max_amount,
    currency: extra.currency || c.cur,
    financing_type: extra.financing_type || 'loan',
    website: site,
    is_featured: extra.featured !== false,
    sort_order: 0
  }, extra.more || {});
}

function fund(id, ar, en, cc, site, extra) {
  extra = extra || {};
  extra.type = extra.type || 'fund';
  extra.featured = extra.featured === true;
  extra.financing_type = extra.financing_type || 'equity';
  return gov(id, ar, en, cc, site, extra);
}

const rows = [
  // —— Saudi Arabia (SAMA local banks + NDF development institutions)
  bank('fs-sa-snb', 'البنك الأهلي السعودي', 'Saudi National Bank (SNB)', 'SA', 'https://www.alahli.com', { featured: true, min_amount: 50000, max_amount: 50000000 }),
  bank('fs-sa-rajhi', 'مصرف الراجحي', 'Al Rajhi Bank', 'SA', 'https://www.alrajhibank.com.sa', { featured: true }),
  bank('fs-sa-riyad', 'بنك الرياض', 'Riyad Bank', 'SA', 'https://www.riyadbank.com', { min_amount: 50000, max_amount: 30000000 }),
  bank('fs-sa-sab', 'البنك السعودي الأول', 'Saudi Awwal Bank (SAB)', 'SA', 'https://www.sab.com'),
  bank('fs-sa-anb', 'البنك العربي الوطني', 'Arab National Bank', 'SA', 'https://www.anb.com.sa'),
  bank('fs-sa-alinma', 'مصرف الإنماء', 'Alinma Bank', 'SA', 'https://www.alinma.com'),
  bank('fs-sa-bsf', 'البنك السعودي الفرنسي', 'Banque Saudi Fransi', 'SA', 'https://www.alfransi.com.sa'),
  bank('fs-sa-saib', 'البنك السعودي للاستثمار', 'Saudi Investment Bank', 'SA', 'https://www.saib.com.sa'),
  bank('fs-sa-albilad', 'بنك البلاد', 'Bank Albilad', 'SA', 'https://www.bankalbilad.com'),
  bank('fs-sa-baj', 'بنك الجزيرة', 'Bank Aljazira', 'SA', 'https://www.baj.com.sa'),
  bank('fs-sa-gib', 'بنك الخليج الدولي — السعودية', 'Gulf International Bank Saudi Arabia', 'SA', 'https://www.gib.com'),
  bank('fs-sa-stc', 'بنك إس تي سي', 'STC Bank', 'SA', 'https://www.stcbank.com.sa'),
  bank('fs-sa-d360', 'بنك دال 360', 'D360 Bank', 'SA', 'https://www.d360.com'),
  gov('fs-sa-kafalah', 'برنامج كفالة', 'Kafalah Program', 'SA', 'https://www.kafalah.gov.sa', {
    description_ar: 'برنامج ضمان التمويل للمنشآت الصغيرة والمتوسطة عبر البنوك وشركات التمويل.',
    description_en: 'Credit-guarantee programme for SMEs through partner banks and finance companies.',
    eligibility_ar: 'منشآت صغيرة ومتوسطة مسجلة في السعودية.',
    eligibility_en: 'SMEs registered in Saudi Arabia.',
    min_amount: 10000, max_amount: 2000000, financing_type: 'guarantee', featured: true
  }),
  gov('fs-sa-sidf', 'صندوق التنمية الصناعية السعودي', 'SIDF', 'SA', 'https://www.sidf.gov.sa', {
    sector: 'industry,mining,energy',
    description_ar: 'تمويل المشاريع الصناعية والتعدينية واللوجستية والطاقة.',
    description_en: 'Financing for industrial, mining, logistics and energy projects.',
    eligibility_ar: 'مشاريع صناعية مؤهلة في السعودية.',
    eligibility_en: 'Eligible industrial projects in Saudi Arabia.',
    min_amount: 1000000, max_amount: 500000000, featured: true
  }),
  gov('fs-sa-smebank', 'بنك المنشآت الصغيرة والمتوسطة', 'SME Bank', 'SA', 'https://www.smebank.gov.sa', {
    description_ar: 'بنك تنموي تابع لصندوق التنمية الوطني يموّل المنشآت عبر البنوك وشركات التمويل والمنصات.',
    description_en: 'National Development Fund bank that finances SMEs through partner banks, NBFIs and platforms.',
    featured: true
  }),
  gov('fs-sa-sdb', 'بنك التنمية الاجتماعية', 'Social Development Bank', 'SA', 'https://www.sdb.gov.sa', {
    description_ar: 'تمويل تنموي للأفراد ورواد الأعمال والمشاريع الناشئة، بما في ذلك تمويل الأصول والتشغيل.',
    description_en: 'Development finance for individuals, entrepreneurs and startups, including asset and working-capital products.',
    eligibility_ar: 'مواطنون سعوديون ورواد أعمال وفق شروط المنتج.',
    eligibility_en: 'Saudi citizens and entrepreneurs, subject to product rules.',
    min_amount: 50000, max_amount: 500000, featured: true
  }),
  gov('fs-sa-adf', 'صندوق التنمية الزراعية', 'Agricultural Development Fund', 'SA', 'https://www.adf.gov.sa', {
    type: 'fund', sector: 'agriculture,food_manufacturing',
    description_ar: 'تمويل النشاط الزراعي والغذائي في مناطق المملكة.',
    description_en: 'Financing for agricultural and food activity across Saudi Arabia.',
    featured: false
  }),
  gov('fs-sa-tdf', 'صندوق التنمية السياحية', 'Tourism Development Fund', 'SA', 'https://www.tdf.gov.sa', {
    type: 'fund', sector: 'tourism,hospitality',
    description_ar: 'تمويل وتمكين منشآت القطاع السياحي بالشراكة مع البنوك وشركات التمويل وبرنامج كفالة.',
    description_en: 'Tourism-sector financing in partnership with banks, NBFIs and the Kafalah programme.',
    featured: false
  }),
  gov('fs-sa-redf', 'صندوق التنمية العقارية', 'Real Estate Development Fund', 'SA', 'https://www.redf.gov.sa', {
    type: 'fund', sector: 'real_estate,construction',
    description_ar: 'تمويل ودعم النشاط العقاري السكني والتنموي.',
    description_en: 'Financing and support for residential and development real-estate activity.',
    featured: false
  }),
  gov('fs-sa-monshaat', 'الهيئة العامة للمنشآت الصغيرة والمتوسطة — منشآت', 'Monshaat', 'SA', 'https://www.monshaat.gov.sa', {
    sector: 'technology,industry',
    description_ar: 'الجهة المنظمة لقطاع المنشآت الصغيرة والمتوسطة وبرامج التمويل والاستثمار الداعمة له.',
    description_en: 'The SME authority overseeing sector policy and supporting finance and investment programmes.',
    financing_type: 'equity', featured: false
  }),
  fund('fs-sa-svc', 'الشركة السعودية للاستثمار الجريء', 'SVC', 'SA', 'https://svc.com.sa', {
    sector: 'technology',
    description_ar: 'تستثمر في صناديق رأس المال الجريء والملكية الخاصة والدين لدعم الشركات الناشئة والمنشآت.',
    description_en: 'Invests in VC, private-equity and private-debt funds that back startups and SMEs.',
    eligibility_ar: 'صناديق ومديرو استثمار وشركات ضمن شبكة SVC.',
    eligibility_en: 'Funds, managers and companies within the SVC network.'
  }),
  fund('fs-sa-jada', 'جدا — صندوق الصناديق', 'Jada Fund of Funds', 'SA', 'https://www.jada.com.sa', {
    sector: 'technology,industry',
    description_ar: 'صندوق صناديق يستثمر في مديري رأس المال الجريء والملكية الخاصة والدين الخاص في السعودية.',
    description_en: 'Fund of funds investing in VC, private-equity and private-debt managers in Saudi Arabia.',
    eligibility_ar: 'مديرو صناديق ومنشآت ضمن محفظة جدا.',
    eligibility_en: 'Fund managers and SMEs in the Jada network.'
  }),
  gov('fs-sa-riyadah', 'معهد ريادة الأعمال الوطني (ريادة)', 'National Entrepreneurship Institute (Riyadah)', 'SA', 'https://www.riyadah.com.sa', {
    description_ar: 'معهد وطني قائم يقدّم التأهيل والاستشارات لرواد الأعمال، ويتشارك مع بنك التنمية الاجتماعية في التمويل.',
    description_en: 'Active national institute providing entrepreneurship training and advisory, in partnership with the Social Development Bank for finance.',
    eligibility_ar: 'رواد أعمال سعوديون.',
    eligibility_en: 'Saudi entrepreneurs.',
    featured: false
  }),
  { id: 'fs-sa-angels', type: 'investor', name_ar: 'مستثمرون أنجال', name_en: 'Angel Investors Saudi', country_code: 'SA', sector: 'technology,food_manufacturing,health', description_ar: 'شبكة مستثمرين أفراد للشركات الناشئة.', description_en: 'Angel network for early-stage companies.', eligibility_ar: 'MVP واضح وفريق تنفيذي.', eligibility_en: 'Clear MVP and execution team.', min_amount: 100000, max_amount: 2000000, currency: 'SAR', financing_type: 'equity', website: 'https://angelinvestors.sa', is_featured: false, sort_order: 0 },

  // —— UAE (CBUAE national banks + development agencies)
  bank('fs-ae-fab', 'بنك أبوظبي الأول', 'First Abu Dhabi Bank (FAB)', 'AE', 'https://www.bankfab.com', { featured: true, min_amount: 100000, max_amount: 10000000 }),
  bank('fs-ae-enbd', 'بنك الإمارات دبي الوطني', 'Emirates NBD', 'AE', 'https://www.emiratesnbd.com', { featured: true }),
  bank('fs-ae-adcb', 'بنك أبوظبي التجاري', 'Abu Dhabi Commercial Bank', 'AE', 'https://www.adcb.com'),
  bank('fs-ae-mashreq', 'بنك المشرق', 'Mashreq Bank', 'AE', 'https://www.mashreqbank.com'),
  bank('fs-ae-dib', 'بنك دبي الإسلامي', 'Dubai Islamic Bank', 'AE', 'https://www.dib.ae'),
  bank('fs-ae-adib', 'مصرف أبوظبي الإسلامي', 'Abu Dhabi Islamic Bank', 'AE', 'https://www.adib.ae'),
  bank('fs-ae-cbd', 'بنك دبي التجاري', 'Commercial Bank of Dubai', 'AE', 'https://www.cbd.ae'),
  bank('fs-ae-ei', 'مصرف الإمارات الإسلامي', 'Emirates Islamic', 'AE', 'https://www.emiratesislamic.ae'),
  bank('fs-ae-rakbank', 'بنك رأس الخيمة الوطني', 'RAKBANK', 'AE', 'https://www.rakbank.ae'),
  bank('fs-ae-wio', 'ويو بنك', 'Wio Bank', 'AE', 'https://wio.io'),
  gov('fs-ae-khalifa', 'صندوق خليفة لتطوير المشاريع', 'Khalifa Fund', 'AE', 'https://www.khalifafund.ae', {
    description_ar: 'صندوق أبوظبي غير الربحي لتمويل وتمكين المنشآت الصغيرة والمتوسطة المملوكة للمواطنين.',
    description_en: 'Abu Dhabi non-profit fund providing finance and enablement for Emirati-owned SMEs.',
    eligibility_ar: 'منشآت مملوكة لمواطنين إماراتيين وفق شروط الصندوق.',
    eligibility_en: 'Emirati-owned SMEs, subject to fund rules.',
    min_amount: 50000, max_amount: 5000000, featured: true
  }),
  gov('fs-ae-edb', 'بنك الإمارات للتنمية', 'Emirates Development Bank', 'AE', 'https://www.edb.gov.ae', {
    description_ar: 'البنك التنموي الاتحادي لتمويل القطاعات ذات الأولوية والمنشآت الصناعية والابتكار.',
    description_en: 'Federal development bank financing priority sectors, industry and innovation.',
    featured: true
  }),
  gov('fs-ae-sme', 'مؤسسة محمد بن راشد لتنمية المشاريع الصغيرة والمتوسطة', 'Dubai SME', 'AE', 'https://sme.ae', {
    description_ar: 'جهة دبي الحكومية لدعم وترخيص وتمكين رواد الأعمال والمنشآت الصغيرة والمتوسطة.',
    description_en: 'Dubai government establishment supporting, licensing and enabling entrepreneurs and SMEs.',
    featured: false
  }),
  gov('fs-ae-mbr', 'صندوق محمد بن راشد للابتكار', 'Mohammed bin Rashid Innovation Fund', 'AE', 'https://www.mbrinnovationfund.ae', {
    sector: 'technology,industry',
    description_ar: 'تمويل مشاريع الابتكار والتقنية.',
    description_en: 'Innovation and technology project financing.',
    eligibility_ar: 'شركات إماراتية مبتكرة.',
    eligibility_en: 'Innovative UAE companies.',
    min_amount: 100000, max_amount: 5000000, featured: false
  }),
  fund('fs-ae-mubadala', 'مبادلة للاستثمار', 'Mubadala Investment Company', 'AE', 'https://www.mubadala.com', {
    sector: 'technology,health,industry',
    description_ar: 'شركة استثمار سيادية تستثمر في قطاعات النمو محلياً وعالمياً.',
    description_en: 'Sovereign investor in growth sectors in the UAE and internationally.',
    eligibility_ar: 'شركات ذات أثر استراتيجي.',
    eligibility_en: 'Strategic or high-impact companies.',
    min_amount: 5000000, max_amount: 500000000
  }),
  { id: 'fs-ae-dfdf', type: 'investor', name_ar: 'صندوق منطقة دبي للمستقبل', name_en: 'Dubai Future District Fund', country_code: 'AE', sector: 'technology', description_ar: 'صندوق استثماري للتقنية والابتكار في دبي.', description_en: 'Technology and innovation investment fund in Dubai.', eligibility_ar: 'شركات تقنية ناشئة.', eligibility_en: 'Early-stage technology companies.', min_amount: 1000000, max_amount: 20000000, currency: 'AED', financing_type: 'equity', website: 'https://dubaifuture.ae', is_featured: false, sort_order: 0 },

  // —— Egypt
  bank('fs-eg-nbe', 'البنك الأهلي المصري', 'National Bank of Egypt', 'EG', 'https://www.nbe.com.eg', { featured: true, min_amount: 50000, max_amount: 20000000 }),
  bank('fs-eg-misr', 'بنك مصر', 'Banque Misr', 'EG', 'https://www.banquemisr.com', { featured: true }),
  bank('fs-eg-cib', 'البنك التجاري الدولي', 'Commercial International Bank (CIB)', 'EG', 'https://www.cibeg.com'),
  bank('fs-eg-bdc', 'بنك القاهرة', 'Banque du Caire', 'EG', 'https://www.bdc.com.eg'),
  bank('fs-eg-alex', 'بنك الإسكندرية', 'Bank of Alexandria', 'EG', 'https://www.alexbank.com'),
  bank('fs-eg-abe', 'البنك الزراعي المصري', 'Agricultural Bank of Egypt', 'EG', 'https://www.abe.com.eg', { sector: 'agriculture,food_manufacturing' }),
  bank('fs-eg-qnb', 'بنك قطر الوطني الأهلي', 'QNB Alahli', 'EG', 'https://www.qnbalahli.com'),
  bank('fs-eg-faisal', 'بنك فيصل الإسلامي المصري', 'Faisal Islamic Bank of Egypt', 'EG', 'https://www.faisalbank.com.eg'),
  bank('fs-eg-edbe', 'البنك المصري لتنمية الصادرات', 'Export Development Bank of Egypt', 'EG', 'https://www.edbe.com.eg', { sector: 'industry,trade' }),
  gov('fs-eg-msmeda', 'جهاز تنمية المشروعات المتوسطة والصغيرة ومتناهية الصغر', 'MSMEDA', 'EG', 'https://www.msmeda.org.eg', {
    description_ar: 'الجهة الحكومية لتمويل وتنمية المشروعات المتوسطة والصغيرة ومتناهية الصغر عبر البنوك والجمعيات.',
    description_en: 'Government agency financing and developing MSMEs through banks and NGO partners.',
    eligibility_ar: 'أفراد وشركات مصرية وفق شروط الجهاز.',
    eligibility_en: 'Egyptian individuals or companies, subject to MSMEDA rules.',
    min_amount: 5000, max_amount: 5000000, featured: true
  }),
  fund('fs-eg-tsfe', 'صندوق مصر السيادي', 'The Sovereign Fund of Egypt', 'EG', 'https://tsfe.com', {
    sector: 'infrastructure,energy,industry',
    description_ar: 'استثمارات في مشاريع البنية التحتية والطاقة والأصول الاستراتيجية.',
    description_en: 'Investments in infrastructure, energy and strategic assets.',
    eligibility_ar: 'مشاريع كبرى أو شركات استراتيجية.',
    eligibility_en: 'Large or strategic projects.',
    min_amount: 10000000, max_amount: 1000000000
  }),
  { id: 'fs-eg-flat6', type: 'investor', name_ar: 'فلات 6 لابز', name_en: 'Flat6Labs', country_code: 'EG', sector: 'technology', description_ar: 'مسرعة وصندوق بذرة للشركات الناشئة في مصر والمنطقة.', description_en: 'Seed accelerator and fund for startups in Egypt and the region.', eligibility_ar: 'شركات ناشئة تقنية في مرحلة مبكرة.', eligibility_en: 'Early-stage technology startups.', min_amount: null, max_amount: null, currency: 'USD', financing_type: 'equity', website: 'https://www.flat6labs.com', is_featured: false, sort_order: 0 },

  // —— Jordan (CBJ)
  bank('fs-jo-arab', 'البنك العربي', 'Arab Bank', 'JO', 'https://www.arabbank.com', { featured: true }),
  bank('fs-jo-hbtf', 'بنك الإسكان للتجارة والتمويل', 'Housing Bank for Trade & Finance', 'JO', 'https://www.hbtf.com', { featured: true }),
  bank('fs-jo-boj', 'بنك الأردن', 'Bank of Jordan', 'JO', 'https://www.bankofjordan.com', { min_amount: 10000, max_amount: 5000000 }),
  bank('fs-jo-ahli', 'البنك الأهلي الأردني', 'Jordan Ahli Bank', 'JO', 'https://www.ahli.com'),
  bank('fs-jo-cab', 'بنك القاهرة عمان', 'Cairo Amman Bank', 'JO', 'https://www.cab.jo'),
  bank('fs-jo-capital', 'كابيتال بنك', 'Capital Bank of Jordan', 'JO', 'https://www.capitalbank.jo'),
  bank('fs-jo-jib', 'البنك الإسلامي الأردني', 'Jordan Islamic Bank', 'JO', 'https://www.jordanislamicbank.com'),
  bank('fs-jo-safwa', 'بنك صفوة الإسلامي', 'Safwa Islamic Bank', 'JO', 'https://www.safwabank.com'),
  bank('fs-jo-etihad', 'بنك الاتحاد', 'Bank al Etihad', 'JO', 'https://www.bankaletihad.com'),
  gov('fs-jo-jedco', 'المؤسسة الأردنية لتطوير المشاريع الاقتصادية', 'JEDCO', 'JO', 'https://www.jedco.gov.jo', {
    description_ar: 'مؤسسة حكومية لتطوير وتمويل المشاريع الاقتصادية والمنشآت الصغيرة والمتوسطة.',
    description_en: 'Government corporation for developing and financing SMEs and economic projects.',
    featured: true
  }),
  gov('fs-jo-jlgc', 'الشركة الأردنية لضمان القروض', 'Jordan Loan Guarantee Corporation', 'JO', 'https://www.jlgc.com', {
    description_ar: 'ضمان تمويل المنشآت الصغيرة والمتوسطة بالشراكة مع البنوك.',
    description_en: 'Loan guarantees for SMEs in partnership with banks.',
    financing_type: 'guarantee', featured: true
  }),
  gov('fs-jo-ldf', 'صندوق تنمية المحافظات', 'Local Development Fund', 'JO', 'https://www.ldf.gov.jo', {
    description_ar: 'تمويل مشاريع التنمية المحلية في المحافظات الأردنية.',
    description_en: 'Local development project financing in Jordanian governorates.',
    min_amount: 5000, max_amount: 500000, featured: false
  }),
  { id: 'fs-jo-oasis', type: 'investor', name_ar: 'واحة 500', name_en: 'Oasis500', country_code: 'JO', sector: 'technology', description_ar: 'مسرعة أعمال وصندوق استثماري في عمّان.', description_en: 'Amman accelerator and early-stage fund.', eligibility_ar: 'شركات ناشئة في مرحلة مبكرة.', eligibility_en: 'Early-stage startups.', min_amount: 10000, max_amount: 250000, currency: 'JOD', financing_type: 'equity', website: 'https://www.oasis500.com', is_featured: false, sort_order: 0 },

  // —— Kuwait (CBK)
  bank('fs-kw-nbk', 'بنك الكويت الوطني', 'National Bank of Kuwait', 'KW', 'https://www.nbk.com', { featured: true, min_amount: 50000, max_amount: 10000000 }),
  bank('fs-kw-kfh', 'بيت التمويل الكويتي', 'Kuwait Finance House', 'KW', 'https://www.kfh.com', { featured: true }),
  bank('fs-kw-gulf', 'بنك الخليج', 'Gulf Bank', 'KW', 'https://www.e-gulfbank.com'),
  bank('fs-kw-burgan', 'بنك برقان', 'Burgan Bank', 'KW', 'https://www.burgan.com'),
  bank('fs-kw-abk', 'البنك الأهلي الكويتي', 'Al Ahli Bank of Kuwait', 'KW', 'https://www.eahli.com'),
  bank('fs-kw-boubyan', 'بنك بوبيان', 'Boubyan Bank', 'KW', 'https://www.bankboubyan.com'),
  bank('fs-kw-warba', 'بنك وربة', 'Warba Bank', 'KW', 'https://www.warbabank.com'),
  bank('fs-kw-ibk', 'البنك الصناعي الكويتي', 'Industrial Bank of Kuwait', 'KW', 'https://www.ibkuwt.com', { sector: 'industry' }),
  gov('fs-kw-nf', 'الصندوق الوطني لرعاية وتنمية المشروعات الصغيرة والمتوسطة', 'National Fund for SME Development', 'KW', 'https://www.nationalfund.gov.kw', {
    description_ar: 'الصندوق الحكومي لتمويل ورعاية المشروعات الصغيرة والمتوسطة الكويتية.',
    description_en: 'Government fund financing and developing Kuwaiti SMEs.',
    min_amount: 5000, max_amount: 500000, featured: true
  }),

  // —— Qatar (QCB members)
  bank('fs-qa-qnb', 'بنك قطر الوطني', 'Qatar National Bank', 'QA', 'https://www.qnb.com', { featured: true, min_amount: 100000, max_amount: 15000000 }),
  bank('fs-qa-qib', 'مصرف قطر الإسلامي', 'Qatar Islamic Bank', 'QA', 'https://www.qib.com.qa', { featured: true }),
  bank('fs-qa-cbq', 'البنك التجاري', 'The Commercial Bank', 'QA', 'https://www.cbq.qa'),
  bank('fs-qa-doha', 'بنك الدوحة', 'Doha Bank', 'QA', 'https://www.dohabank.com.qa'),
  bank('fs-qa-rayan', 'مصرف الريان', 'Masraf Al Rayan', 'QA', 'https://www.alrayan.com'),
  bank('fs-qa-dukhan', 'بنك دخان', 'Dukhan Bank', 'QA', 'https://www.dukhanbank.com'),
  bank('fs-qa-qiib', 'مصرف قطر الإسلامي الدولي', 'Qatar International Islamic Bank', 'QA', 'https://www.qiib.com.qa'),
  gov('fs-qa-qdb', 'بنك قطر للتنمية', 'Qatar Development Bank', 'QA', 'https://www.qdb.qa', {
    description_ar: 'البنك التنموي لتمويل وتطوير الشركات القطرية والتصدير والضمانات.',
    description_en: 'Development bank financing Qatari companies, exports and guarantees.',
    eligibility_ar: 'شركات قطرية مؤهلة.',
    eligibility_en: 'Eligible Qatari companies.',
    min_amount: 50000, max_amount: 5000000, featured: true
  }),

  // —— Bahrain
  bank('fs-bh-nbb', 'بنك البحرين الوطني', 'National Bank of Bahrain', 'BH', 'https://www.nbbonline.com', { featured: true }),
  bank('fs-bh-bbk', 'بنك البحرين والكويت', 'Bank of Bahrain and Kuwait', 'BH', 'https://www.bbkonline.com'),
  bank('fs-bh-kfh', 'بيت التمويل الكويتي — البحرين', 'KFH Bahrain', 'BH', 'https://www.kfh.com'),
  bank('fs-bh-bisb', 'بنك البحرين الإسلامي', 'Bahrain Islamic Bank', 'BH', 'https://www.bisb.com'),
  bank('fs-bh-bdb', 'بنك البحرين للتنمية', 'Bahrain Development Bank', 'BH', 'https://www.bdb-bh.com', { featured: true }),
  gov('fs-bh-tamkeen', 'تمكين', 'Tamkeen', 'BH', 'https://www.tamkeen.bh', {
    description_ar: 'صندوق العمل لدعم تمويل وتدريب المؤسسات البحرينية.',
    description_en: 'Labour Fund supporting finance and training for Bahraini enterprises.',
    min_amount: 2000, max_amount: 500000, featured: true
  }),

  // —— Oman (CBO + Riyada after Al-Raffd merger 2020)
  bank('fs-om-muscat', 'بنك مسقط', 'Bank Muscat', 'OM', 'https://www.bankmuscat.com', { featured: true, min_amount: 10000, max_amount: 5000000 }),
  bank('fs-om-nbo', 'البنك الوطني العماني', 'National Bank of Oman', 'OM', 'https://www.nbo.om'),
  bank('fs-om-oab', 'بنك عمان العربي', 'Oman Arab Bank', 'OM', 'https://www.oman-arabbank.com'),
  bank('fs-om-dhofar', 'بنك ظفار', 'Bank Dhofar', 'OM', 'https://www.bankdhofar.com'),
  bank('fs-om-sohar', 'صحار الدولي', 'Sohar International', 'OM', 'https://www.soharinternational.com'),
  bank('fs-om-nizwa', 'بنك نزوى', 'Bank Nizwa', 'OM', 'https://www.banknizwa.om'),
  bank('fs-om-ahli', 'الأهلي بنك', 'Ahli Bank Oman', 'OM', 'https://www.ahlibank.om'),
  bank('fs-om-odb', 'بنك التنمية العماني', 'Oman Development Bank', 'OM', 'https://www.odb.om', { featured: true }),
  gov('fs-om-riyada', 'هيئة تنمية المؤسسات الصغيرة والمتوسطة (ريادة)', 'SME Development Authority (Riyada)', 'OM', 'https://sme.gov.om', {
    description_ar: 'الهيئة الحكومية التي آلت إليها اختصاصات صندوق الرفد وهيئة تنمية المؤسسات الصغيرة والمتوسطة، وتقدّم التمويل والدعم لرواد الأعمال.',
    description_en: 'Government authority that succeeded Al-Raffd Fund and PASMED, providing SME finance and entrepreneur support.',
    featured: true
  }),

  // —— Morocco
  bank('fs-ma-attijari', 'التجاري وفا بنك', 'Attijariwafa Bank', 'MA', 'https://www.attijariwafabank.com', { featured: true, min_amount: 50000, max_amount: 50000000 }),
  bank('fs-ma-boa', 'بنك أفريقيا', 'Bank of Africa', 'MA', 'https://www.bankofafrica.ma', { featured: true }),
  bank('fs-ma-bcp', 'مجموعة البنك الشعبي', 'Banque Centrale Populaire', 'MA', 'https://www.groupebcp.com'),
  bank('fs-ma-cih', 'CIH بنك', 'CIH Bank', 'MA', 'https://www.cihbank.ma'),
  bank('fs-ma-cam', 'القرض الفلاحي للمغرب', 'Crédit Agricole du Maroc', 'MA', 'https://www.creditagricole.ma', { sector: 'agriculture,food_manufacturing' }),
  bank('fs-ma-bmci', 'البنك المغربي للتجارة والصناعة', 'BMCI', 'MA', 'https://www.bmci.ma'),
  gov('fs-ma-tamwilcom', 'تمويلكم', 'Tamwilcom', 'MA', 'https://www.tamwilcom.ma', {
    description_ar: 'المؤسسة الوطنية لضمان وتمويل المقاولات والصغيرة جداً والمتوسطة.',
    description_en: 'National guarantee and enterprise-finance institution for VSMEs and SMEs.',
    financing_type: 'guarantee', featured: true
  }),

  // —— Tunisia
  bank('fs-tn-bt', 'البنك التونسي', 'Banque de Tunisie', 'TN', 'https://www.bt.com.tn', { featured: true, min_amount: 10000, max_amount: 10000000 }),
  bank('fs-tn-stb', 'الشركة التونسية للبنك', 'STB', 'TN', 'https://www.stb.com.tn'),
  bank('fs-tn-biat', 'بنك تونس العربي الدولي', 'BIAT', 'TN', 'https://www.biat.com.tn', { featured: true }),
  bank('fs-tn-bts', 'البنك التونسي للتضامن', 'Banque Tunisienne de Solidarité', 'TN', 'https://www.bts.com.tn', {
    description_ar: 'بنك عمومي لتمويل المشاريع الصغيرة ولخريجي التعليم والتكوين.',
    description_en: 'Public bank financing small projects and graduates.',
    min_amount: null, max_amount: 150000, featured: true
  }),
  bank('fs-tn-bfpme', 'بنك تمويل المؤسسات الصغرى والمتوسطة', 'BFPME', 'TN', 'https://www.bfpme.com.tn', {
    description_ar: 'بنك عمومي لتمويل إحداث وتوسعة المؤسسات الصغرى والمتوسطة.',
    description_en: 'Public bank financing SME creation and expansion.',
    min_amount: 100000, max_amount: 10000000, featured: true
  }),
  bank('fs-tn-amen', 'بنك الأمان', 'Amen Bank', 'TN', 'https://www.amenbank.com.tn'),
  gov('fs-tn-apii', 'وكالة النهوض بالاستثمار الخارجي والصناعة — APII', 'APII / FTI window', 'TN', 'https://www.tunisieindustrie.nat.tn', {
    description_ar: 'نافذة معلومات وحوافز الاستثمار والصندوق التونسي للاستثمار للمشاريع الصناعية.',
    description_en: 'Investment-incentive and Tunisian Investment Fund window for industrial projects.',
    featured: false
  }),

  // —— Algeria
  bank('fs-dz-bna', 'البنك الوطني الجزائري', 'Banque Nationale d’Algérie', 'DZ', 'https://www.bna.dz', { featured: true }),
  bank('fs-dz-bea', 'بنك الجزائر الخارجي', 'Banque Extérieure d’Algérie', 'DZ', 'https://www.bea.dz', { featured: true }),
  bank('fs-dz-cpa', 'القرض الشعبي الجزائري', 'Crédit Populaire d’Algérie', 'DZ', 'https://www.cpa-bank.dz'),
  bank('fs-dz-badr', 'بنك الفلاحة والتنمية الريفية', 'BADR', 'DZ', 'https://www.badrbanque.dz', { sector: 'agriculture' }),
  bank('fs-dz-bdl', 'بنك التنمية المحلية', 'Banque de Développement Local', 'DZ', 'https://www.bdl.dz'),
  bank('fs-dz-cnep', 'الصندوق الوطني للتوفير والاحتياط', 'CNEP Banque', 'DZ', 'https://www.cnepbanque.dz'),
  gov('fs-dz-nesda', 'الوكالة الوطنية لدعم وتنمية المقاولاتية', 'NESDA (ex-ANADE/ANSEJ)', 'DZ', 'https://www.nesda.dz', {
    description_ar: 'الوكالة الحكومية لدعم إحداث وتوسعة المؤسسات المصغرة (الخلف النظامي لـ ANSEJ/ANADE).',
    description_en: 'Government agency supporting micro-enterprise creation and expansion (successor of ANSEJ/ANADE).',
    min_amount: null, max_amount: 10000000, featured: true
  }),

  // —— Iraq
  bank('fs-iq-tbi', 'المصرف العراقي للتجارة', 'Trade Bank of Iraq', 'IQ', 'https://www.tbiraq.com', { featured: true }),
  bank('fs-iq-rasheed', 'مصرف الرشيد', 'Rasheed Bank', 'IQ', 'https://www.rasheedbank.iq'),
  bank('fs-iq-rafidain', 'مصرف الرافدين', 'Rafidain Bank', 'IQ', 'https://www.rafidain-bank.iq'),
  bank('fs-iq-bob', 'مصرف بغداد', 'Bank of Baghdad', 'IQ', 'https://www.bankofbaghdad.com.iq'),
  gov('fs-iq-icfsme', 'الشركة العراقية لتمويل المشاريع الصغيرة والمتوسطة', 'Iraqi Company for Financing SMEs', 'IQ', 'https://icfsme.iq', {
    description_ar: 'شركة مرخّصة من البنك المركزي العراقي لتمويل الشباب والخريجين والنساء والمشاريع الزراعية.',
    description_en: 'CBI-licensed company financing youth, graduates, women and agricultural projects.',
    featured: true
  }),

  // —— Lebanon
  bank('fs-lb-audi', 'بنك عودة', 'Bank Audi', 'LB', 'https://www.bankaudi.com.lb', { featured: true }),
  bank('fs-lb-blom', 'بنك لبنان والمهجر', 'BLOM Bank', 'LB', 'https://www.blombank.com'),
  bank('fs-lb-byblos', 'بنك بيبلوس', 'Byblos Bank', 'LB', 'https://www.byblosbank.com'),
  bank('fs-lb-bob', 'بنك بيروت', 'Bank of Beirut', 'LB', 'https://www.bankofbeirut.com'),
  gov('fs-lb-kafalat', 'كفالات', 'Kafalat', 'LB', 'https://www.kafalat.com.lb', {
    description_ar: 'شركة ضمان قروض للمنشآت اللبنانية. إصدار الضمانات الجديدة معلّق حالياً بسبب أزمة القطاع المصرفي؛ راجع الشركة قبل الاعتماد عليها.',
    description_en: 'Lebanese SME loan-guarantee company. New guarantees are currently suspended because of the banking crisis; confirm with the company before relying on it.',
    eligibility_ar: 'منشآت لبنانية صغيرة ومتوسطة. الضمانات الجديدة غير مفتوحة حالياً.',
    eligibility_en: 'Lebanese SMEs. New guarantees are not currently open.',
    financing_type: 'guarantee', featured: false
  }),

  // —— Libya (CBL list)
  bank('fs-ly-jumhouria', 'مصرف الجمهورية', 'Jumhouria Bank', 'LY', 'https://www.jbank.ly', { featured: true }),
  bank('fs-ly-ncb', 'المصرف التجاري الوطني', 'National Commercial Bank', 'LY', 'https://www.ncb.ly'),
  bank('fs-ly-wahda', 'مصرف الوحدة', 'Wahda Bank', 'LY', 'https://www.wahdabank.com'),
  bank('fs-ly-sahara', 'مصرف الصحارى', 'Sahara Bank', 'LY', 'https://www.saharabank.ly'),
  bank('fs-ly-bcd', 'مصرف التجارة والتنمية', 'Bank of Commerce & Development', 'LY', 'https://www.bcd.ly', { featured: true }),
  gov('fs-ly-namaa', 'نماء تمويل', 'Namaa Tamweel', 'LY', 'https://namaatamweel.ly', {
    type: 'fund',
    description_ar: 'مؤسسة تمويل أصغر تابعة لمصرف السراي وفق صيغ إسلامية للمشاريع المتناهية الصغر والصغيرة.',
    description_en: 'ATIB microfinance institution providing Sharia-compliant MSME finance.',
    min_amount: 1000, max_amount: 50000, featured: true
  }),

  // —— Sudan
  bank('fs-sd-bok', 'بنك الخرطوم', 'Bank of Khartoum', 'SD', 'https://bankofkhartoum.com', { featured: true }),
  bank('fs-sd-faisal', 'بنك فيصل الإسلامي السوداني', 'Faisal Islamic Bank Sudan', 'SD', 'https://www.fibsudan.com'),
  bank('fs-sd-onb', 'بنك أم درمان الوطني', 'Omdurman National Bank', 'SD', 'https://www.onb.sd'),

  // —— Yemen
  bank('fs-ye-cac', 'بنك التسليف التعاوني الزراعي', 'CAC Bank', 'YE', 'https://www.cacbank.com.ye', { featured: true, sector: 'agriculture,all' }),
  bank('fs-ye-tadhamon', 'بنك التضامن', 'Tadhamon Bank', 'YE', 'https://www.tadhamonbank.com', { featured: true }),
  bank('fs-ye-ybrd', 'البنك اليمني للإنشاء والتعمير', 'Yemen Bank for Reconstruction & Development', 'YE', 'https://www.ybrdye.com'),

  // —— Palestine (PMA)
  bank('fs-ps-bop', 'بنك فلسطين', 'Bank of Palestine', 'PS', 'https://www.bankofpalestine.com', { featured: true }),
  bank('fs-ps-aib', 'البنك الإسلامي العربي', 'Arab Islamic Bank', 'PS', 'https://www.aib.ps'),
  bank('fs-ps-quds', 'بنك القدس', 'Quds Bank', 'PS', 'https://www.qudsbank.ps', { featured: true }),
  bank('fs-ps-pib', 'بنك الاستثمار الفلسطيني', 'Palestine Investment Bank', 'PS', 'https://www.pib.ps'),

  // —— Syria
  bank('fs-sy-cbs', 'المصرف التجاري السوري', 'Commercial Bank of Syria', 'SY', 'https://www.cbs-bank.sy', { featured: true }),
  bank('fs-sy-cham', 'بنك الشام', 'Cham Bank', 'SY', 'https://www.chambank.com'),

  // —— Mauritania
  bank('fs-mr-bmci', 'البنك الموريتاني للتجارة الدولية', 'BMCI Mauritania', 'MR', 'https://www.bmci.mr', { featured: true }),
  bank('fs-mr-gbm', 'البنك العام لموريتانيا', 'Générale de Banque de Mauritanie', 'MR', 'https://www.gbm.mr'),
  bank('fs-mr-bnm', 'البنك الوطني الموريتاني', 'Banque Nationale de Mauritanie', 'MR', 'https://www.bnm.mr', { featured: true }),

  // —— Somalia
  bank('fs-so-premier', 'بريمير بنك', 'Premier Bank', 'SO', 'https://www.premierbank.so', { featured: true }),
  bank('fs-so-dahabshiil', 'بنك دهب شيل الدولي', 'Dahabshiil Bank International', 'SO', 'https://www.dahabshiilbank.com'),

  // —— Djibouti
  bank('fs-dj-bci', 'بنك البحر الأحمر للتجارة والاستثمار', 'BCI Mer Rouge', 'DJ', 'https://www.bcimerrouge.com', { featured: true }),
  bank('fs-dj-boa', 'بنك أفريقيا — جيبوتي', 'Bank of Africa Djibouti', 'DJ', 'https://www.boa.dj'),

  // —— Comoros
  bank('fs-km-exim', 'بنك إكسيم جزر القمر', 'Exim Bank Comoros', 'KM', 'https://www.eximbankcomoros.com', { featured: true })
];

const extra = require('./funding-sources-catalog-extra');
const retiredIds = new Set(extra.retiredIds || []);
const seenIds = new Set(rows.map(function (row) { return row.id; }));
const seenKeys = new Set(rows.map(function (row) {
  return String(row.country_code).toUpperCase() + '|' + row.name_en;
}));

function take(row) {
  if (!row || !row.id || retiredIds.has(row.id)) return;
  const key = String(row.country_code).toUpperCase() + '|' + row.name_en;
  if (seenIds.has(row.id) || seenKeys.has(key)) return;
  seenIds.add(row.id);
  seenKeys.add(key);
  rows.push(row);
}

(extra.banks || []).forEach(function (tuple) {
  if (!tuple || !tuple[0]) return;
  take(bank(tuple[0], tuple[1], tuple[2], tuple[3], tuple[4], tuple[5] || {}));
});
(extra.programs || []).forEach(function (tuple) {
  take(gov(tuple[0], tuple[1], tuple[2], tuple[3], tuple[4], tuple[5] || {}));
});
(extra.regional || []).forEach(function (tuple) {
  const extraOpts = Object.assign({
    type: 'fund',
    featured: true,
    currency: 'USD',
    eligibility_ar: 'المشاريع والدول الأعضاء وفق سياسات المؤسسة.',
    eligibility_en: 'Projects and member countries under the institution’s policies.'
  }, tuple[4] || {});
  extraOpts.currency = extraOpts.currency || 'USD';
  const row = gov(tuple[0], tuple[1], tuple[2], 'SA', tuple[3], extraOpts);
  row.country_code = 'all';
  ['hq_ar', 'hq_en', 'presence_ar', 'presence_en', 'offices_ar', 'offices_en'].forEach(function (key) {
    if (extraOpts[key]) row[key] = extraOpts[key];
  });
  take(row);
});

rows.forEach(function (row, index) {
  row.sort_order = index + 1;
  if (row.min_amount === undefined) row.min_amount = null;
  if (row.max_amount === undefined) row.max_amount = null;
});

function sqlLiteral(value) {
  if (value == null || value === '') return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function toSqlInsert(row) {
  const description = row.description_ar || row.description_en || '';
  const eligibility = row.eligibility_ar || row.eligibility_en || '';
  return '(' + [
    sqlLiteral(row.type),
    sqlLiteral(row.name_ar),
    sqlLiteral(row.name_en),
    sqlLiteral(row.country_code),
    sqlLiteral(row.sector),
    sqlLiteral(description),
    sqlLiteral(eligibility),
    sqlLiteral(row.min_amount),
    sqlLiteral(row.max_amount),
    sqlLiteral(row.currency),
    sqlLiteral(row.financing_type),
    sqlLiteral(row.website),
    'TRUE',
    row.is_featured ? 'TRUE' : 'FALSE',
    String(row.sort_order)
  ].join(', ') + ')';
}

const header = `/**
 * Offline catalog of verified Arab-country banks, development funds and SME programmes.
 * Built from central-bank registers and official agency sites. Used when live
 * /api/funding-sources is empty or unavailable.
 * Regenerate: node scripts/build-funding-sources-catalog.js
 */
(function (root) {
  'use strict';

  root.BONDS_FUNDING_FALLBACK_SOURCES = `;

const footer = `;
})(typeof window !== 'undefined' ? window : globalThis);
`;

const outJs = path.join(__dirname, 'funding-sources-fallback.js');
fs.writeFileSync(outJs, header + JSON.stringify(rows, null, 2) + footer);

const originalNames = new Set([
  'Kafala Program', 'Saudi National Bank (SNB)', 'Riyad Bank', 'Monshaat VC Fund',
  'Angel Investors Saudi', 'SIDF', 'Riyadah', 'First Abu Dhabi Bank (FAB)',
  'Khalifa Fund', 'Mubadala Investment Company', 'Dubai Future District Fund',
  'Mohammed bin Rashid Innovation Fund', 'National Bank of Egypt', 'MSMEDA',
  'Egypt Sovereign Fund', '500 Startups Egypt', 'Bank of Jordan', 'Local Development Fund',
  'Oasis500', 'National Bank of Kuwait', 'National Fund for SMEs', 'Qatar National Bank',
  'Qatar Development Bank', 'Ahli United Bank', 'Tamkeen', 'Bank Muscat', 'Rafd Fund',
  'Attijariwafa Bank', 'Maroc PME', 'Banque de Tunisie', 'National Financing Fund'
]);

const newRows = rows.filter(function (row) { return !originalNames.has(row.name_en); });
const sqlChunks = [];
for (let i = 0; i < newRows.length; i += 25) {
  sqlChunks.push(
    'INSERT INTO public.funding_sources (\n' +
    '  type, name_ar, name_en, country_code, sector, description, eligibility,\n' +
    '  min_amount, max_amount, currency, financing_type, website, is_active, is_featured, sort_order\n' +
    ')\nSELECT v.* FROM (VALUES\n' +
    newRows.slice(i, i + 25).map(toSqlInsert).join(',\n') +
    '\n) AS v(type, name_ar, name_en, country_code, sector, description, eligibility, min_amount, max_amount, currency, financing_type, website, is_active, is_featured, sort_order)\n' +
    'WHERE NOT EXISTS (\n' +
    '  SELECT 1 FROM public.funding_sources existing\n' +
    '  WHERE existing.country_code = v.country_code AND existing.name_en = v.name_en\n' +
    ');\n'
  );
}

const sql = `-- Expand funding_sources with verified Arab-country banks and SME programmes.
-- Idempotent: skips rows that already exist for the same country + English name.

UPDATE public.funding_sources
SET name_ar = 'بنك قطر للتنمية', website = 'https://www.qdb.qa'
WHERE country_code = 'QA' AND name_en = 'Qatar Development Bank';

UPDATE public.funding_sources
SET name_ar = 'هيئة تنمية المؤسسات الصغيرة والمتوسطة (ريادة)',
    name_en = 'SME Development Authority (Riyada)',
    website = 'https://sme.gov.om',
    description = 'الهيئة الحكومية التي آلت إليها اختصاصات صندوق الرفد وهيئة تنمية المؤسسات الصغيرة والمتوسطة.'
WHERE country_code = 'OM' AND (name_en = 'Rafd Fund' OR website = 'https://www.rafd.gov.om');

UPDATE public.funding_sources
SET name_ar = 'تمويلكم', name_en = 'Tamwilcom', website = 'https://www.tamwilcom.ma',
    financing_type = 'guarantee',
    description = 'المؤسسة الوطنية لضمان وتمويل المقاولات والصغيرة جداً والمتوسطة.'
WHERE country_code = 'MA' AND name_en IN ('Maroc PME', 'Tamwilcom');

UPDATE public.funding_sources
SET name_ar = 'بيت التمويل الكويتي — البحرين', name_en = 'KFH Bahrain', website = 'https://www.kfh.com'
WHERE country_code = 'BH' AND name_en = 'Ahli United Bank';

UPDATE public.funding_sources
SET name_en = 'Kafalah Program', website = 'https://www.kafalah.gov.sa'
WHERE country_code = 'SA' AND name_en IN ('Kafala Program', 'Kafalah Program');

UPDATE public.funding_sources
SET name_ar = 'بيت التمويل الكويتي — مصر', name_en = 'KFH Egypt', website = 'https://www.kfh.com.eg'
WHERE country_code = 'EG' AND name_en IN ('Ahli United Bank Egypt', 'Ahli United Bank');

UPDATE public.funding_sources
SET is_active = FALSE
WHERE (country_code = 'EG' AND name_en = 'Bank Audi Egypt')
   OR (country_code = 'JO' AND name_en = 'Egyptian Arab Land Bank Jordan')
   OR (country_code = 'OM' AND name_en = 'HSBC Oman');

` + sqlChunks.join('\n');

const outSql = path.join(__dirname, '..', 'supabase', 'migrations', '20261109000000_expand_arab_funding_sources.sql');
fs.writeFileSync(outSql, sql);

const byCountry = rows.reduce(function (acc, row) {
  acc[row.country_code] = (acc[row.country_code] || 0) + 1;
  return acc;
}, {});
const banks = rows.filter(function (row) { return row.type === 'bank'; }).length;
console.log('Wrote', rows.length, 'sources (' + banks + ' banks) across', Object.keys(byCountry).length, 'countries');
console.log(JSON.stringify(byCountry, null, 2));
console.log('New SQL inserts:', newRows.length);
