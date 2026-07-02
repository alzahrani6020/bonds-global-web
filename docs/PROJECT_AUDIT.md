# تقرير تدقيق شامل — مشروع Bonds Global

**التاريخ:** 2026-06-18  
**المستودع:** `alzahrani6020/bonds-global-web`  
**الفرع:** `main`  
**الهدف:** تحليل شامل للموقع الحالي، الوظائف، قاعدة البيانات، APIs، نقاط القوة والقصور، ثم اقتراح معمارية احترافية قابلة للتوسع.

---

## 1. الملخص التنفيذي

Bonds Global منصة SaaS مبنية كموقع ثابت (Static Site) مع وظائف خادومية (Serverless APIs) على Vercel. تقدم المنصة:

- **حاسبات مالية متخصصة** (نقطة التعادل، التدفق النقدي، تسعير المنتج، قرض، جدوى، تكلفة مصنع، هندسة منيو …).
- **محتوى تسويقي وتعليمي** (خدمات، مقالات، أدلة قطاعات، صفحات قانونية).
- **نظام مصادقة واشتراكات** (free / pro / enterprise) عبر Supabase Auth + Stripe + Moyasar.
- **لوحة إدارية** لإدارة المستخدمين، الاشتراكات، الرسائل، التحويلات البنكية.
- **منصة Bonds V3** للذكاء الاقتصادي: مقارنة مدن، بنك فرص، سيناريوهات مالية، إنذارات استثمارية، مساعد AI.

النسخة الحالية تعتمد على **HTML/CSS/JS vanilla** بدون إطار عمل frontend، مع نسختين يدويتين عربي/إنجليزي. قاعدة البيانات على Supabase (`public` schema) مع تداخل بين تعريفات الجداول في migrations مختلفة.

---

## 2. إحصائيات عامة

| المؤشر | القيمة |
|--------|--------|
| إجمالي صفحات HTML | 209 |
| صفحات عربية | ~116 |
| صفحات إنجليزية | ~81 |
| جداول Supabase (root) | 23+ |
| جداول Bonds V3 | 28+ إضافية |
| APIs رئيسية | ~12 في `api/` + V3 router |
| اختبارات Jest | 229 ناجحة |

---

## 3. جرد الصفحات

### ar-marketing (26)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | about.html | من نحن | بوندز — استشارات مالية | تعرف على بوندز: استشارات مالية تبدأ من الواقع لأصحاب المشاريع في مصر والسعودية. |
| 2 | auth-v2.html | تسجيل الدخول | بوندز | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 3 | auth.html | تسجيل الدخول | بوندز | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 4 | calculator-v2.html | آلة حاسبة نقطة التعادل | بوندز — استشارات مالية | احسب نقطة التعادل لمشروعك: عدد الوحدات والمبلغ اللي لازم تبيعه لتغطية تكاليفك. أداة مجانية من بوندز. |
| 5 | calculator.html | آلة حاسبة نقطة التعادل | بوندز — استشارات مالية | احسب نقطة التعادل لمشروعك: عدد الوحدات والمبلغ اللي لازم تبيعه لتغطية تكاليفك. أداة مجانية من بوندز. |
| 6 | contact.html | تواصل معنا | بوندز — استشارات مالية | احجز استشارتك المجانية مع بوندز. نوصل عبر واتساب أو نموذج التواصل. |
| 7 | faq.html | الأسئلة الشائعة | بوندز — استشارات مالية | إجابات على أكثر الأسئلة شيوعاً حول استشارات بوندز المالية: التسعير، المدة، القطاعات، السرية، الحجز،  |
| 8 | index.html | بوندز | للاستشارات المالية والإدارية | نقدم حلولاً مالية وإستراتيجية تكاملية نساعد الشركات والمستثمرين على تحقيق النمو المستدام وتعظيم القي |
| 9 | methodology.html | منهجية الحساب والشفافية | بوندز — استشارات مالية | كل الصيغ الرياضية المستخدمة في حاسبات بوندز: نقطة التعادل، التسعير، التدفق النقدي، والقرض. مكتوبة بو |
| 10 | modon_eservices.html | حلولنا الرقمية | الهيئة السعودية للمدن الصناعية ومناطق التقنية مدن أنشئت عام 2001م، وتتمثل مسؤوليتها في تطوير أراضٍ ص |
| 11 | modon_home.html | الهيئة السعودية للمدن الصناعية ومناطق التقنية | الهيئة السعودية للمدن الصناعية ومناطق التقنية مدن أنشئت عام 2001م، وتتمثل مسؤوليتها في تطوير أراضٍ ص |
| 12 | partner-portal-guide.html | دليل بوابة شريك | بوندز | دليل مستخدم بوابة شريك - التسجيل وإدارة المنشأة والمفوضين |
| 13 | pitch-print.html | Pitch Deck — PDF | بوندز | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 14 | pitch.html | Pitch Deck | بوندز — Bonds Global | Pitch deck for Bonds Global: the financial brain for restaurants in MENA. |
| 15 | pricing.html | الأسعار والباقات | بوندز — استشارات مالية | باقات استشارات مالية مرنة لأصحاب المشاريع. نرسل عرض سعر مخصص حسب حجم الخدمة والقطاع. |
| 16 | privacy.html | سياسة الخصوصية | بوندز للاستشارات المالية والإدارية | سياسة الخصوصية لمنصة بوندز: كيف نجمع بياناتك ونستخدمها ونحميها. |
| 17 | proof.html | إثبات عمل النظام | بوندز | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 18 | services.html | خدماتنا | بوندز — استشارات مالية | خدمات بوندز: التحليل المالي، الموازنات، التدفقات النقدية، دراسات الجدوى، تحليل المخاطر، الاستبيانات، |
| 19 | suppliers-guide.html | دليل المورد | بوندز | دليل المستخدم لإدارة حساب المورد في الهيئة السعودية للمدن الصناعية (مدن) |
| 20 | templates/supabase-email-templates.html | - | - |
| 21 | terms.html | شروط الاستخدام | بوندز للاستشارات المالية والإدارية | شروط الاستخدام وسياسات استخدام منصة بوندز للاستشارات المالية والإدارية. |
| 22 | test.html | اختبار النظام | بوندز | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 23 | tools/supabase-email-template.html | - | - |
| 24 | v.html | Verify System | Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 25 | verify.html | Verify System | Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 26 | distressed-recovery-study.html | دراسة جدوى شركة إحياء الأصول العقارية — النسخة النهائية الشاملة | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |

### en-marketing (14)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | en/about.html | About Us | Bonds — Financial Consulting | Learn about Bonds: financial consulting grounded in reality for business owners in Egypt and Saudi A |
| 2 | en/calculator.html | Break-Even Calculator | Bonds — Financial Consulting | Calculate the break-even point for your project: number of units and amount needed to cover your cos |
| 3 | en/contact.html | Contact Us | Bonds — Financial Consulting | Book your free consultation with Bonds. Reach us via WhatsApp or the contact form. |
| 4 | en/faq.html | FAQ | Bonds — Financial Consulting | Answers to the most common questions about Bonds financial consulting services: pricing, duration, s |
| 5 | en/index.html | Bonds | Financial & Management Consulting | We provide integrated financial and strategic solutions to help companies and investors achieve sust |
| 6 | en/methodology.html | Calculation Methodology & Transparency | Bonds — Financial Consulting | All mathematical formulas used in Bonds calculators: break-even, pricing, cash flow, and loan. Writt |
| 7 | en/partner-portal-guide.html | Partner Portal Guide | Bonds | Step-by-step guide for registering and managing a company on the Saudi Partner Portal |
| 8 | en/pitch-print.html | Pitch Deck — PDF | Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 9 | en/pitch.html | Pitch Deck | Bonds Global | Pitch deck for Bonds Global: the financial brain for restaurants in MENA. |
| 10 | en/pricing.html | Pricing &amp; Packages | Bonds — Financial Consulting | Flexible financial consulting packages for business owners. We send a custom quote based on service  |
| 11 | en/privacy.html | Privacy Policy | Bonds Consulting | Privacy Policy for Bonds Global: how we collect, use, and protect your data. |
| 12 | en/services.html | Our Services | Bonds — Financial Consulting | Bonds services: Financial analysis, budgeting, cash flow, feasibility studies, risk analysis, survey |
| 13 | en/suppliers-guide.html | Supplier Guide | Bonds | Step-by-step guide for managing supplier accounts on the MODON Supplier Portal |
| 14 | en/terms.html | Terms of Use | Bonds Consulting | Terms of use for the Bonds Global platform and financial consulting services. |

### ar-calculators (36)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | calculators/cash-flow.html | حاسبة تدفق النقد | بوندز — استشارات مالية | احسب توقعات التدفق النقدي لـ 12 شهراً: الواردات، المصروفات، والرصيد الختامي. أداة مجانية من بوندز. |
| 2 | calculators/dashboard.html | لوحة التحكم | بوندز | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 3 | calculators/dish-margin.html | حاسبة ربحية الوجبة | بوندز — هامش الربح لكل صنف | احسب ربحية كل وجبة قبل إضافتها للمنيو. تكاليف المكونات، عمولات المنصات، هامش الربح، والتسعير العكسي. |
| 4 | calculators/factory-cost-ae.html | حاسبة تكلفة المصنع المتقدمة - الإمارات | بوندز | احسب تكلفة إنشاء مصنع في الإمارات - رواتب، تأمين، مواد خام، سيناريوهات |
| 5 | calculators/factory-cost-bh.html | حاسبة تكلفة المصنع المتقدمة - البحرين | بوندز | احسب تكلفة إنشاء مصنع في البحرين - رواتب، تأمين، مواد خام، سيناريوهات |
| 6 | calculators/factory-cost-dj.html | حاسبة تكلفة المصنع المتقدمة - جيبوتي | بوندز | احسب تكلفة إنشاء مصنع في جيبوتي - رواتب، تأمين، مواد خام، سيناريوهات |
| 7 | calculators/factory-cost-dz.html | حاسبة تكلفة المصنع المتقدمة - الجزائر | بوندز | احسب تكلفة إنشاء مصنع في الجزائر - رواتب، تأمين، مواد خام، سيناريوهات |
| 8 | calculators/factory-cost-eg.html | حاسبة تكلفة المصنع المتقدمة - مصر | بوندز | احسب تكلفة إنشاء مصنع في مصر - رواتب، تأمين، مواد خام، سيناريوهات |
| 9 | calculators/factory-cost-iq.html | حاسبة تكلفة المصنع المتقدمة - العراق | بوندز | احسب تكلفة إنشاء مصنع في العراق - رواتب، تأمين، مواد خام، سيناريوهات |
| 10 | calculators/factory-cost-jo.html | حاسبة تكلفة المصنع المتقدمة - الأردن | بوندز | احسب تكلفة إنشاء مصنع في الأردن - رواتب، تأمين، مواد خام، سيناريوهات |
| 11 | calculators/factory-cost-km.html | حاسبة تكلفة المصنع المتقدمة - جزر القمر | بوندز | احسب تكلفة إنشاء مصنع في جزر القمر - رواتب، تأمين، مواد خام، سيناريوهات |
| 12 | calculators/factory-cost-kw.html | حاسبة تكلفة المصنع المتقدمة - الكويت | بوندز | احسب تكلفة إنشاء مصنع في الكويت - رواتب، تأمين، مواد خام، سيناريوهات |
| 13 | calculators/factory-cost-lb.html | حاسبة تكلفة المصنع المتقدمة - لبنان | بوندز | احسب تكلفة إنشاء مصنع في لبنان - رواتب، تأمين، مواد خام، سيناريوهات |
| 14 | calculators/factory-cost-ly.html | حاسبة تكلفة المصنع المتقدمة - ليبيا | بوندز | احسب تكلفة إنشاء مصنع في ليبيا - رواتب، تأمين، مواد خام، سيناريوهات |
| 15 | calculators/factory-cost-ma.html | حاسبة تكلفة المصنع المتقدمة - المغرب | بوندز | احسب تكلفة إنشاء مصنع في المغرب - رواتب، تأمين، مواد خام، سيناريوهات |
| 16 | calculators/factory-cost-mr.html | حاسبة تكلفة المصنع المتقدمة - موريتانيا | بوندز | احسب تكلفة إنشاء مصنع في موريتانيا - رواتب، تأمين، مواد خام، سيناريوهات |
| 17 | calculators/factory-cost-om.html | حاسبة تكلفة المصنع المتقدمة - عمان | بوندز | احسب تكلفة إنشاء مصنع في عمان - رواتب، تأمين، مواد خام، سيناريوهات |
| 18 | calculators/factory-cost-ps.html | حاسبة تكلفة المصنع المتقدمة - فلسطين | بوندز | احسب تكلفة إنشاء مصنع في فلسطين - رواتب، تأمين، مواد خام، سيناريوهات |
| 19 | calculators/factory-cost-qa.html | حاسبة تكلفة المصنع المتقدمة - قطر | بوندز | احسب تكلفة إنشاء مصنع في قطر - رواتب، تأمين، مواد خام، سيناريوهات |
| 20 | calculators/factory-cost-sd.html | حاسبة تكلفة المصنع المتقدمة - السودان | بوندز | احسب تكلفة إنشاء مصنع في السودان - رواتب، تأمين، مواد خام، سيناريوهات |
| 21 | calculators/factory-cost-so.html | حاسبة تكلفة المصنع المتقدمة - الصومال | بوندز | احسب تكلفة إنشاء مصنع في الصومال - رواتب، تأمين، مواد خام، سيناريوهات |
| 22 | calculators/factory-cost-sy.html | حاسبة تكلفة المصنع المتقدمة - سوريا | بوندز | احسب تكلفة إنشاء مصنع في سوريا - رواتب، تأمين، مواد خام، سيناريوهات |
| 23 | calculators/factory-cost-tn.html | حاسبة تكلفة المصنع المتقدمة - تونس | بوندز | احسب تكلفة إنشاء مصنع في تونس - رواتب، تأمين، مواد خام، سيناريوهات |
| 24 | calculators/factory-cost-ye.html | حاسبة تكلفة المصنع المتقدمة - اليمن | بوندز | احسب تكلفة إنشاء مصنع في اليمن - رواتب، تأمين، مواد خام، سيناريوهات |
| 25 | calculators/factory-cost.html | حاسبة تكلفة المصنع المتقدمة | بوندز | احسب تكلفة إنشاء وتشغيل مصنعك في المدن الصناعية السعودية - رواتب، تأمين، مواد خام، سيناريوهات |
| 26 | calculators/feasibility-template-backup.html | نموذج دراسة الجدوى المتكامل | بوندز | نموذج دراسة جدوى احترافي متكامل: PESTLE، SWOT، تحليل مالي، تدفق نقدي، سيناريوهات. مجاني من بوندز. |
| 27 | calculators/feasibility-template-real-estate.html | نموذج دراسة الجدوى المتكامل | بوندز | نموذج دراسة جدوى احترافي متكامل: PESTLE، SWOT، تحليل مالي، تدفق نقدي، سيناريوهات. مجاني من بوندز. |
| 28 | calculators/feasibility-template.html | نموذج دراسة الجدوى المتكامل | بوندز | نموذج دراسة جدوى احترافي متكامل: PESTLE، SWOT، تحليل مالي، تدفق نقدي، سيناريوهات. مجاني من بوندز. |
| 29 | calculators/feasibility.html | حاسبة الجدوى المالية للمطعم | بوندز — هل فكرتك مربحة؟ | احسب الجدوى المالية لمطعمك قبل الافتتاح: التكاليف، الإيرادات، عمولة المنصة، هدر الطعام، تكلفة التغلي |
| 30 | calculators/invoice-analyzer.html | حاسبة تحليل الفواتير | بوندز | حلل فاتورة كل طلب — ربح الفاتورة، ربح اليوم، الشهر، السنة. قارن بين منصات التوصيل. |
| 31 | calculators/loan.html | حاسبة القرض والتمويل | بوندز — استشارات مالية | احسب أقساط قرضك، إجمالي الفائدة، وجدول الاستهلاك. أداة مجانية من بوندز للاستشارات المالية. |
| 32 | calculators/medical-viability.html | محرك قرار الاستثمار الطبي | بوندز — حاسبة جدوى صيدلية، عيادة، مختبر | حاسبة جدوى طبية متقدمة مع مؤشر استثماري ذكي، توصيات مالية، وتحليل مخاطر. صيدلية، عيادة، أو مختبر — ا |
| 33 | calculators/menu-engineering-simple.html | محرك هندسة المنيو | بوندز | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 34 | calculators/menu-engineering.html | محرك هندسة المنيو | بوندز | مصنف ذكي للمنيو يصنف الوجبات إلى نجوم، حصان رابح، ألغاز، وكلاب بناءً على بيانات المبيعات الفعلية. |
| 35 | calculators/pricing.html | حاسبة تسعير المنتج | بوندز — استشارات مالية | احسب سعر منتجك على المنصات باحترافية: التكلفة المباشرة، التكاليف غير المباشرة، التغليف، التوصيل، تكل |
| 36 | calculators/restaurant.html | حاسبة المطاعم والمطابخ السحابية | بوندز — استشارات مالية | احسب ربحية مطعمك أو مطبخك السحابي بدقة: تكلفة المكونات، عمولات المنصات، نقطة التعادل، ومقارنة المنصا |

### en-calculators (35)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | en/calculators/cash-flow.html | Cash Flow Calculator | Bonds — Financial Consulting | Calculate cash flow forecasts for 12 months: inflows, outflows, and closing balance. A free tool fro |
| 2 | en/calculators/dashboard.html | Dashboard | Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 3 | en/calculators/dish-margin.html | Dish Profit Margin Calculator | Bonds Global | Calculate the profit margin for each dish before adding it to your menu. Food costs, platform commis |
| 4 | en/calculators/factory-cost-ae.html | Advanced Factory Cost Calculator - UAE | Bonds | Calculate factory costs in UAE - salaries, insurance, raw materials, scenarios |
| 5 | en/calculators/factory-cost-bh.html | Advanced Factory Cost Calculator - Bahrain | Bonds | Calculate factory costs in Bahrain - salaries, insurance, raw materials, scenarios |
| 6 | en/calculators/factory-cost-dj.html | Advanced Factory Cost Calculator - Djibouti | Bonds | Calculate factory setup and operating costs in Djibouti - salaries, insurance, raw materials, scenar |
| 7 | en/calculators/factory-cost-dz.html | Advanced Factory Cost Calculator - Algeria | Bonds | Calculate factory costs in Algeria - salaries, insurance, raw materials, scenarios |
| 8 | en/calculators/factory-cost-eg.html | Advanced Factory Cost Calculator - Egypt | Bonds | Calculate factory costs in Egypt - salaries, insurance, raw materials, scenarios |
| 9 | en/calculators/factory-cost-iq.html | Advanced Factory Cost Calculator - Iraq | Bonds | Calculate factory costs in Iraq - salaries, insurance, raw materials, scenarios |
| 10 | en/calculators/factory-cost-jo.html | Advanced Factory Cost Calculator - Jordan | Bonds | Calculate factory costs in Jordan - salaries, insurance, raw materials, scenarios |
| 11 | en/calculators/factory-cost-km.html | Advanced Factory Cost Calculator - Comoros | Bonds | Calculate factory setup and operating costs in Comoros - salaries, insurance, raw materials, scenari |
| 12 | en/calculators/factory-cost-kw.html | Advanced Factory Cost Calculator - Kuwait | Bonds | Calculate factory costs in Kuwait - salaries, insurance, raw materials, scenarios |
| 13 | en/calculators/factory-cost-lb.html | Advanced Factory Cost Calculator - Lebanon | Bonds | Calculate factory costs in Lebanon - salaries, insurance, raw materials, scenarios |
| 14 | en/calculators/factory-cost-ly.html | Advanced Factory Cost Calculator - Libya | Bonds | Calculate factory costs in Libya - salaries, insurance, raw materials, scenarios |
| 15 | en/calculators/factory-cost-ma.html | Advanced Factory Cost Calculator - Morocco | Bonds | Calculate factory costs in Morocco - salaries, insurance, raw materials, scenarios |
| 16 | en/calculators/factory-cost-mr.html | Advanced Factory Cost Calculator - Mauritania | Bonds | Calculate factory setup and operating costs in Mauritania - salaries, insurance, raw materials, scen |
| 17 | en/calculators/factory-cost-om.html | Advanced Factory Cost Calculator - Oman | Bonds | Calculate factory costs in Oman - salaries, insurance, raw materials, scenarios |
| 18 | en/calculators/factory-cost-ps.html | Advanced Factory Cost Calculator - Palestine | Bonds | Calculate factory setup and operating costs in Palestine - salaries, insurance, raw materials, scena |
| 19 | en/calculators/factory-cost-qa.html | Advanced Factory Cost Calculator - Qatar | Bonds | Calculate factory costs in Qatar - salaries, insurance, raw materials, scenarios |
| 20 | en/calculators/factory-cost-sd.html | Advanced Factory Cost Calculator - Sudan | Bonds | Calculate factory costs in Sudan - salaries, insurance, raw materials, scenarios |
| 21 | en/calculators/factory-cost-so.html | Advanced Factory Cost Calculator - Somalia | Bonds | Calculate factory setup and operating costs in Somalia - salaries, insurance, raw materials, scenari |
| 22 | en/calculators/factory-cost-sy.html | Advanced Factory Cost Calculator - Syria | Bonds | Calculate factory costs in Syria - salaries, insurance, raw materials, scenarios |
| 23 | en/calculators/factory-cost-tn.html | Advanced Factory Cost Calculator - Tunisia | Bonds | Calculate factory costs in Tunisia - salaries, insurance, raw materials, scenarios |
| 24 | en/calculators/factory-cost-ye.html | Advanced Factory Cost Calculator - Yemen | Bonds | Calculate factory costs in Yemen - salaries, insurance, raw materials, scenarios |
| 25 | en/calculators/factory-cost.html | Advanced Factory Cost Calculator - Saudi Arabia | Bonds | Calculate the cost of setting up and operating a factory in Saudi industrial cities - salaries, insu |
| 26 | en/calculators/feasibility-template-real-estate.html | Integrated Feasibility Study | Bonds | Professional integrated feasibility study: PESTLE, SWOT, financial analysis, cash flow, scenarios. F |
| 27 | en/calculators/feasibility-template.html | Integrated Feasibility Study | Bonds | Professional integrated feasibility study: PESTLE, SWOT, financial analysis, cash flow, scenarios. F |
| 28 | en/calculators/feasibility.html | Restaurant Financial Viability Calculator | Bonds — Is Your Idea Profitable? | Calculate your restaurant |
| 29 | en/calculators/invoice-analyzer.html | Invoice Analyzer | Bonds | Analyze every order invoice — per order, daily, monthly, yearly profit. Compare delivery platforms.  |
| 30 | en/calculators/loan.html | Loan & Financing Calculator | Bonds — Financial Consulting | Calculate your loan installments, total interest, and amortization schedule. A free tool from Bonds  |
| 31 | en/calculators/medical-viability.html | Medical Investment Decision Engine | Bonds — Pharmacy, Clinic & Lab Feasibility | Advanced medical feasibility calculator with an investment readiness score, smart recommendations, a |
| 32 | en/calculators/menu-engineering-simple.html | Menu Engineering Engine | Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 33 | en/calculators/menu-engineering.html | Menu Engineering Engine | Bonds | Intelligent menu classifier that categorizes dishes into Stars, Workhorses, Puzzles, and Dogs based  |
| 34 | en/calculators/pricing.html | Product Pricing Calculator | Bonds — Financial Consulting | Calculate your product price professionally: direct costs, overhead, packaging, delivery, customer a |
| 35 | en/calculators/restaurant.html | Restaurant & Cloud Kitchen Calculator | Bonds — Financial Consulting | Calculate your restaurant or cloud kitchen profitability accurately: ingredient costs, platform comm |

### ar-calculators-auth (12)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | calculators/auth/account.html | حسابي — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 2 | calculators/auth/confirmed.html | تم تأكيد الحساب — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 3 | calculators/auth/debug.html | تشخيص — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 4 | calculators/auth/diagnose.html | تشخيص تسجيل الدخول | بوندز | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 5 | calculators/auth/index.html | تسجيل الدخول — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 6 | calculators/auth/login.html | جاري التوجيه — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 7 | calculators/auth/onboarding.html | أكمل معلوماتك | بوندز | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 8 | calculators/auth/profile.html | الملف الشخصي — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 9 | calculators/auth/reset.html | إعادة تعيين كلمة المرور — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 10 | calculators/auth/subscription.html | إدارة الاشتراك — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 11 | calculators/auth/verify-email.html | تم إنشاء الحساب — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 12 | calculators/auth/verify-otp.html | تأكيد البريد الإلكتروني — Bonds | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |

### en-calculators-auth (9)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | en/calculators/auth/account.html | My Account — Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 2 | en/calculators/auth/confirmed.html | Account Confirmed — Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 3 | en/calculators/auth/index.html | Sign In — Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 4 | en/calculators/auth/onboarding.html | Complete Your Profile | Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 5 | en/calculators/auth/profile.html | Profile — Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 6 | en/calculators/auth/reset.html | Reset Password — Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 7 | en/calculators/auth/subscription.html | Subscription Management — Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 8 | en/calculators/auth/verify-email.html | Account Created — Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 9 | en/calculators/auth/verify-otp.html | Verify Email — Bonds | Specialized financial calculators and economic consulting from Bonds. |

### ar-admin (11)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | admin/analytics.html | الإحصائيات | بوندز | - |
| 2 | admin/bank-transfers.html | طلبات التحويل البنكي | بوندز | - |
| 3 | admin/dashboard.html | لوحة التحكم الإدارية | بوندز | - |
| 4 | admin/exceptions.html | استثناءات العملاء | بوندز | - |
| 5 | admin/force-reset.html | تغيير كلمة المرور — بوندز | - |
| 6 | admin/messages.html | الرسائل | لوحة التحكم | بوندز | - |
| 7 | admin/reset.html | إعادة تعيين كلمة المرور | بوندز | - |
| 8 | admin/roles.html | إدارة المشرفين | لوحة التحكم | بوندز | - |
| 9 | admin/settings.html | الإعدادات | بوندز | - |
| 10 | admin/subscriptions.html | الاشتراكات | لوحة التحكم | بوندز | - |
| 11 | admin/users.html | المستخدمين | لوحة التحكم | بوندز | - |

### en-admin (6)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | en/admin/analytics.html | Analytics | Admin | Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 2 | en/admin/dashboard.html | Admin Dashboard | Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 3 | en/admin/messages.html | Messages | Admin | Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 4 | en/admin/roles.html | Role Management | Admin | Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 5 | en/admin/subscriptions.html | Subscriptions | Admin | Bonds | Specialized financial calculators and economic consulting from Bonds. |
| 6 | en/admin/users.html | Users | Admin | Bonds | Specialized financial calculators and economic consulting from Bonds. |

### ar-sectors (17)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | sectors/manufacturing-ae.html | دليل الاستثمار الصناعي في الإمارات | بوندز | دليل شامل للاستثمار الصناعي في الإمارات العربية المتحدة - وزارة الصناعة والتكنولوجيا المتقدمة، المنا |
| 2 | sectors/manufacturing-bh.html | دليل الاستثمار الصناعي في البحرين | بوندز | دليل شامل للاستثمار الصناعي في مملكة البحرين - وزارة الصناعة والتجارة، هيئة البحرين للتنمية الاقتصاد |
| 3 | sectors/manufacturing-dz.html | دليل الاستثمار الصناعي في الجزائر | بوندز | دليل شامل للاستثمار الصناعي في الجمهورية الجزائرية الديمقراطية الشعبية - وزارة الصناعة، ANDI، المناط |
| 4 | sectors/manufacturing-eg.html | دليل الاستثمار الصناعي في مصر | بوندز | دليل شامل للاستثمار الصناعي في مصر - الهيئة العامة للتنمية الصناعية، المناطق الصناعية، التراخيص، الت |
| 5 | sectors/manufacturing-iq.html | دليل الاستثمار الصناعي في العراق | بوندز | دليل شامل للاستثمار الصناعي في جمهورية العراق - وزارة الصناعة، هيئة الاستثمار، المناطق الصناعية، الت |
| 6 | sectors/manufacturing-jo.html | دليل الاستثمار الصناعي في الأردن | بوندز | دليل شامل للاستثمار الصناعي في المملكة الأردنية الهاشمية - هيئة الاستثمار، المناطق التنموية، التراخي |
| 7 | sectors/manufacturing-kw.html | دليل الاستثمار الصناعي في الكويت | بوندز | دليل شامل للاستثمار الصناعي في دولة الكويت - الهيئة العامة للاستثمار، الهيئة العامة للصناعة، المناطق |
| 8 | sectors/manufacturing-lb.html | دليل الاستثمار الصناعي في لبنان | بوندز | دليل شامل للاستثمار الصناعي في الجمهورية اللبنانية - وزارة الصناعة، IDAL، المناطق الصناعية، التراخيص |
| 9 | sectors/manufacturing-ly.html | دليل الاستثمار الصناعي في ليبيا | بوندز | دليل شامل للاستثمار الصناعي في دولة ليبيا - وزارة الصناعة، الهيئة العامة للاستثمار، المناطق الصناعية |
| 10 | sectors/manufacturing-ma.html | دليل الاستثمار الصناعي في المغرب | بوندز | دليل شامل للاستثمار الصناعي في المملكة المغربية - وزارة الصناعة، وكالة التنمية، المناطق الصناعية، ال |
| 11 | sectors/manufacturing-om.html | دليل الاستثمار الصناعي في عمان | بوندز | دليل شامل للاستثمار الصناعي في سلطنة عمان - الهيئة العامة للمناطق الاقتصادية، المناطق الحرة، التراخي |
| 12 | sectors/manufacturing-qa.html | دليل الاستثمار الصناعي في قطر | بوندز | دليل شامل للاستثمار الصناعي في دولة قطر - هيئة المناطق الحرة، مدينة راس لفان الصناعية، التراخيص، الت |
| 13 | sectors/manufacturing-sd.html | دليل الاستثمار الصناعي في السودان | بوندز | دليل شامل للاستثمار الصناعي في جمهورية السودان - وزارة الصناعة، هيئة الاستثمار، المناطق الصناعية، ال |
| 14 | sectors/manufacturing-sy.html | دليل الاستثمار الصناعي في سوريا | بوندز | دليل شامل للاستثمار الصناعي في الجمهورية العربية السورية - وزارة الصناعة، الهيئة العامة للاستثمار، ا |
| 15 | sectors/manufacturing-tn.html | دليل الاستثمار الصناعي في تونس | بوندز | دليل شامل للاستثمار الصناعي في الجمهورية التونسية - وزارة الصناعة، وكالة النهوض بالاستثمار، المناطق  |
| 16 | sectors/manufacturing-ye.html | دليل الاستثمار الصناعي في اليمن | بوندز | دليل شامل للاستثمار الصناعي في الجمهورية اليمنية - وزارة الصناعة، الهيئة العامة للاستثمار، المناطق ا |
| 17 | sectors/manufacturing.html | دليل الاستثمار الصناعي | بوندز | دليل شامل للاستثمار في المدن الصناعية السعودية - اشتراطات البناء، التكاليف، رحلة المستثمر |

### en-sectors (17)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | en/sectors/manufacturing-ae.html | Industrial Investment Guide in UAE | Bonds | Comprehensive guide for industrial investment in the United Arab Emirates - Ministry of Industry and |
| 2 | en/sectors/manufacturing-bh.html | Industrial Investment Guide in Bahrain | Bonds | دليل شامل للاستثمار الصناعي في مملكة Bahrain - وزارة الصناعة والتجارة، هيئة Bahrain للتنمية الاقتصاد |
| 3 | en/sectors/manufacturing-dz.html | Industrial Investment Guide in Algeria | Bonds | Complete guide for industrial investment in Algeria - ANDI, industrial zones, licenses, and costs |
| 4 | en/sectors/manufacturing-eg.html | Industrial Investment Guide in Egypt | Bonds | Comprehensive guide for industrial investment in Egypt - Industrial Development Authority, industria |
| 5 | en/sectors/manufacturing-iq.html | Industrial Investment Guide in Iraq | Bonds | Comprehensive guide for industrial investment in the Republic of Iraq - Ministry of Industry, Nation |
| 6 | en/sectors/manufacturing-jo.html | Industrial Investment Guide in Jordan | Bonds | Comprehensive guide for industrial investment in the Hashemite Kingdom of Jordan - Investment Commis |
| 7 | en/sectors/manufacturing-kw.html | Industrial Investment Guide in Kuwait | Bonds | دليل شامل للاستثمار الصناعي في دولة Kuwait - الهيئة العامة للاستثمار، الهيئة العامة للصناعة، المناطق |
| 8 | en/sectors/manufacturing-lb.html | Industrial Investment Guide in Lebanon | Bonds | Complete guide for industrial investment in Lebanon - Ministry of Industry, IDAL, industrial zones,  |
| 9 | en/sectors/manufacturing-ly.html | Industrial Investment Guide in Libya | Bonds | Complete guide for industrial investment in Libya - government bodies, industrial zones, licenses, a |
| 10 | en/sectors/manufacturing-ma.html | Industrial Investment Guide in Morocco | Bonds | دليل شامل للاستثمار الصناعي في المملكة Moroccoية - وزارة الصناعة، وكالة التنمية، المناطق الصناعية، ا |
| 11 | en/sectors/manufacturing-om.html | Industrial Investment Guide in Oman | Bonds | دليل شامل للاستثمار الصناعي في سلطنة Oman - الهيئة العامة للمناطق الاقتصادية، المناطق الحرة، التراخي |
| 12 | en/sectors/manufacturing-qa.html | Industrial Investment Guide in Qatar | Bonds | دليل شامل للاستثمار الصناعي في دولة Qatar - هيئة المناطق الحرة، مدينة راس لفان الصناعية، التراخيص، ا |
| 13 | en/sectors/manufacturing-sd.html | Industrial Investment Guide in Sudan | Bonds | Comprehensive guide for industrial investment in the Republic of Sudan - Ministry of Industry, Inves |
| 14 | en/sectors/manufacturing-sy.html | Industrial Investment Guide in Syria | Bonds | Complete guide for industrial investment in Syria - Ministry of Industry, Investment Authority, indu |
| 15 | en/sectors/manufacturing-tn.html | Industrial Investment Guide in Tunisia | Bonds | دليل شامل للاستثمار الصناعي في الجمهورية الTunisiaية - وزارة الصناعة، وكالة النهوض بالاستثمار، المنا |
| 16 | en/sectors/manufacturing-ye.html | Industrial Investment Guide in Yemen | Bonds | Complete guide for industrial investment in Yemen - Ministry of Industry, GIA, industrial zones, lic |
| 17 | en/sectors/manufacturing.html | Industrial Investment Guide | Bonds | Complete guide for industrial investment in Saudi MODON cities - building standards, costs, fees, an |

### ar-blog (6)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | blog/break-even-explained.html | نقطة التعادل بأبسط طريقة: متى يبدأ مشروعك في الربح؟ | بوندز | شرح مبسط لنقطة التعادل: متى يبدأ مشروعك في الربح؟ أمثلة عملية ونصائح لخفضها من خبراء بوندز للاستشارا |
| 2 | blog/cash-flow-mistakes.html | 5 أخطاء قاتلة في إدارة التدفق النقدي تدمر الشركات الصغيرة | بوندز | تعرف على أخطر 5 أخطاء في إدارة التدفق النقدي للشركات الصغيرة وكيف تتجنبها بخطوات عملية من خبراء بوند |
| 3 | blog/financial-kpis.html | 7 مؤشرات مالية يجب أن تراقبها شهرياً كصاحب شركة | بوندز | 7 مؤشرات مالية أساسية: هامش الربح الإجمالي والصافي، النسبة الجارية، DSO، دوران المخزون، Burn Rate، و |
| 4 | blog/index.html | المدونة | بوندز — رؤى وتحليلات مالية | محتوى عملي في الإدارة المالية والتسعير والتدفقات النقدية والضرائب، يساعدك في اتخاذ قرارات مالية أفضل |
| 5 | blog/pricing-strategy.html | كيف تسعّر منتجك بدون خسارة: دليل عملي لأصحاب المصانع والتجار | بوندز | دليل عملي للتسعير: التكلفة الزائد مقابل القيمة، إدراج التكاليف الخفية، صيغ الهامش، وتحليل المنافسين  |
| 6 | blog/tax-zakat-sme.html | الضريبة والزكاة للمنشآت الصغيرة: ما يجب أن تعرفه قبل نهاية العام | بوندز | التزامات الشركات الصغيرة من ضريبة الدخل والزكاة في السعودية: النسب، الخصومات، الأخطاء الشائعة، ومواع |

### en-blog (6)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | blog/en/break-even-explained.html | Break-Even Point Explained Simply: When Does Your Business Start Profiting? | Bonds Global | A simple explanation of the break-even point with examples from Egypt and Saudi Arabia, why it matte |
| 2 | blog/en/cash-flow-mistakes.html | 5 Deadly Cash Flow Mistakes That Destroy Small Businesses | Bonds Global | Discover the 5 most dangerous cash flow mistakes small businesses make — and how to fix them with ac |
| 3 | blog/en/financial-kpis.html | 7 Financial KPIs Every Business Owner Should Track Monthly | Bonds Global | 7 essential financial KPIs: gross margin, net margin, current ratio, DSO, inventory turnover, burn r |
| 4 | blog/en/index.html | Blog | Bonds — Financial Insights & Analysis | Practical content on financial management, pricing, cash flow, and taxes to help you make better fin |
| 5 | blog/en/pricing-strategy.html | How to Price Your Product Without Losing Money: A Practical Guide | Bonds Global | A practical pricing guide: cost-plus vs value-based pricing, hidden costs, markup formulas, and comp |
| 6 | blog/en/tax-zakat-sme.html | Tax &amp; Zakat for SMEs: What You Must Know Before Year-End | Bonds Global | SME tax obligations in Saudi Arabia: income tax rates, zakat, deductions, common mistakes, and filin |

### v3 (9)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | v3/admin/index.html | Bonds V3 — CMS | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 2 | v3/alerts.html | الإنذارات الاستثمارية | Bonds V3 | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 3 | v3/city-comparison.html | مقارنة المدن | Bonds V3 | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 4 | v3/city-intelligence.html | ذكاء المدن | Bonds V3 | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 5 | v3/index.html | Bonds V3 Enterprise | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 6 | v3/investment-map.html | الخريطة الاستثمارية | Bonds V3 | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 7 | v3/opportunity-bank.html | بنك الفرص الاستثمارية | Bonds V3 | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 8 | v3/project-readiness.html | مؤشر جاهزية المشروع | Bonds V3 | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |
| 9 | v3/scenarios.html | محرك السيناريوهات المتقدمة | Bonds V3 | حاسبات مالية متخصصة واستشارات اقتصادية من بوندز. |

### pro (3)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | pro/index.html | Bonds Pro | دراسة جدوى احترافية | احصل على دراسة جدوى احترافية مدعومة بتحليل ذكي خلال دقائق. |
| 2 | pro/login.html | تسجيل الدخول | Bonds Pro | - |
| 3 | pro/report.html | تقرير Bonds Pro | - |

### reports (2)

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | reports/en/validation.html | Accuracy Validation Report | Bonds | - |
| 2 | reports/validation.html | تقرير التحقق من الدقة | بوندز | - |

---

## Page Count Summary

| Category | Count |
|----------|-------|
| ar-marketing | 26 |
| en-marketing | 14 |
| ar-calculators | 36 |
| en-calculators | 35 |
| ar-calculators-auth | 12 |
| en-calculators-auth | 9 |
| ar-admin | 11 |
| en-admin | 6 |
| ar-sectors | 17 |
| en-sectors | 17 |
| ar-blog | 6 |
| en-blog | 6 |
| v3 | 9 |
| pro | 3 |
| reports | 2 |
| **Total** | **209** |

---

## 4. الوظائف و APIs

### 4.1 إعدادات Vercel (`vercel.json`)

- `cleanUrls: true` + `trailingSlash: false`.
- 16 قاعدة rewrite تربط المسارات بالـ APIs والصفحات (مثل `/api/v3/*` → `/api/v3/index.js`).
- CORS headers على `/api/*` و `/api/v3/*`.
- Crons مجدولة: `/api/v3/cron/*` و `/api/v3/admin/alerts/evaluate`.
- كاش طويل للـ assets (`max-age=31536000, immutable`)، وكاش قصير/ممنوع للـ HTML.

### 4.2 APIs الموقع الأساسي (`api/`)

| الملف | المسار | الغرض |
|-------|--------|-------|
| `admin.js` | `/api/admin?action=...` | لوحة إدارية موحدة: تحويلات بنكية، رسائل، أدوار، اشتراكات، إحصائيات |
| `bank-transfer.js` | `/api/bank-transfer` | تسجيل طلبات التحويل البنكي وإشعار الإدارة |
| `billing.js` | `/api/billing` | إلغاء Stripe أو فتح بوابة الفوترة |
| `contact.js` | `/api/contact` | استقبال رسائل التواصل وتخزينها |
| `create-checkout.js` | `/api/create-checkout` | إنشاء جلسة Stripe Checkout |
| `env.js` | `/api/env` | إرجاع المتغيرات العامة الآمنة للمتصفح |
| `password.js` | `/api/force-reset`, `/api/reset-password` | إعادة تعيين كلمة المرور للمستخدمين |
| `pro.js` | `/api/pro` | تقارير Pro، دفع Stripe، تسجيل/دخول |
| `track.js` | `/api/track` | تتبع مشاهدات الصفحات والجلسات |
| `usage.js` | `/api/usage` | التحقق من حدود الاستخدام والمستويات |
| `webhook.js` | `/api/webhook` | استقبال أحداث Stripe |
| `v3/index.js` | `/api/v3/*` | نقطة دخول Bonds V3 |

### 4.3 APIs Bonds V3 (`v3/api/`)

| الملف | المسارات الرئيسية | الغرض |
|-------|-------------------|-------|
| `index.js` | `/api/v3/*` | Router رئيسي |
| `admin.js` | `/api/v3/admin/*` | إدارة النماذج والمدن وبيانات السوق |
| `auth.js` | `/api/v3/auth/*` | تسجيل/دخول/حسابي |
| `billing.js` | `/api/v3/billing/*` | خطط، checkout، webhook، حالة الاشتراك |
| `projects.js` | `/api/v3/projects/*` | CRUD المشاريع + حسابات مالية |
| `scenarios.js` | `/api/v3/calculate/scenarios` | محرك السيناريوهات وحفظها |
| `ai.js` | `/api/v3/ai/chat` | مساعد AI للاستثمار |
| `alerts.js` | `/api/v3/admin/alerts/*`, `/api/v3/alerts/*` | قواعد الإنذارات وتقييمها |
| `compare.js` | `/api/v3/compare/cities` | مقارنة المدن |
| `data-engine.js` | `/api/v3/data/*` | محرك جمع البيانات والمصادر |

### 4.4 الوظائف والمكتبات المشتركة (Frontend)

| الملف | المسؤولية |
|-------|-----------|
| `script.js` | تبديل الوضع الداكن/الفاتح، قائمة الجوال، تأثيرات Hero، PWA manifest/SW |
| `site-layout.js` | حقن Header/Footer موحد مع قائمة منسدلة وتحديد الرابط النشط |
| `auth-guard.js` | إدارة حالة المصادقة وصلاحيات المميزات |
| `supabase-client.js` | عميل Supabase في المتصفح + `window.BondsAuth` |
| `calculators/calc-functions.js` | المنطق الحسابي النقي: break-even، قرض، تدفق نقدي، جدوى ... |
| `calculators/shared-utils.js` | أدوات عامة: debounce، memo، IndexedDB، تحميل المكتبات |
| `calculators/shared-ui.js` | `BondsUI`: toast، validation، auto-save، progress tracker |
| `calculators/shared-charts.js` | مساعدات Chart.js |
| `calculators/shared-export.js` | PDF/print/share |
| `calculators/shared-geo.js` | `BondsGeo`: محددات الدولة/المحافظة/المدينة |
| `calculators/shared-platforms.js` | `BondsPlatforms`: بيانات المنصات والعملات (مولّد تلقائياً) |
| `calculators/db-client.js` | `BondsDB`: IndexedDB wrapper |
| `calculators/factory-cost-shared.js` | محرك تكلفة المصنع ثنائي اللغة |
| `v3/engine/*` | محركات V3: حسابات مالية، NPV/IRR، DSCR، risk score، سيناريوهات، AI insights |

---

## 5. هيكل قاعدة البيانات

### 5.1 المصادر

- `supabase/migrations/` (23 ملف migration).
- `supabase/all-migrations-combined.sql`.
- `supabase/all-migrations-safe.sql`.
- `templates/supabase-schema.sql`.
- `bonds-v2/supabase/migrations/` (نسخة V2).
- `v3/supabase/migrations/` (28 migration لـ V3).

### 5.2 الوحدات الرئيسية (public schema)

| الوحدة | الجداول |
|--------|---------|
| **الهوية والمصادقة** | `profiles`, `admin_roles` |
| **الفوترة** | `subscriptions`, `moyasar_invoices`, `bank_transfer_requests` |
| **الحاسبات** | `scenarios`, `health_scores`, `invoice_corrections`, `usage_logs`, `usage_exceptions` |
| **هندسة المنيو / AI المطاعم** | `ingredients`, `platforms`, `menu_items`, `menu_item_ingredients`, `menu_platform_prices`, `sales_transactions`, `menu_engineering_scores`, `promo_campaigns` |
| **تكلفة الوصفات** | `ingredients`، `ingredient_prices`، `recipes`، `recipe_ingredients`، `vat_transactions` |
| **التتبع والإدارة** | `contact_messages`, `webhook_events`, `page_views`, `page_sessions`, `site_settings` |

### 5.3 وحدات Bonds V3

| الوحدة | الجداول |
|--------|---------|
| **البيانات الأساسية** | `economic_sectors`, `economic_sub_sectors`, `economic_activities`, `project_models`, `financial_assumptions`, `risk_factors`, `regulatory_requirements` |
| **الجغرافيا** | `cities`, `city_market_data`, `city_indicators`, `country_benchmarks`, `city_competitor_calibration` |
| **المستخدمون والمشاريع** | `companies`, `company_members`, `user_projects`, `project_scenarios`, `reports` |
| **خط البيانات** | `data_source_runs`, `raw_data`, `metric_definitions`, `normalized_metrics`, `data_source_quality`, `http_cache` |
| **ML & feedback** | `ml_models`, `metric_feedback`, `data_feedback`, `confidence_log` |
| **الإنذارات** | `alert_rules`, `alerts` |

### 5.4 العلاقات الرئيسية

```
auth.users
  ├── profiles (1:1)
  ├── subscriptions (1:1)
  ├── admin_roles (1:1)
  ├── scenarios (1:N) → health_scores
  ├── ingredients (1:N) → ingredient_prices / menu_item_ingredients / recipe_ingredients
  ├── recipes (1:N) → recipe_ingredients
  ├── platforms (1:N) → menu_platform_prices, sales_transactions
  ├── menu_items (1:N) → menu_item_ingredients, sales_transactions
  ├── moyasar_invoices (1:N)
  ├── page_views / page_sessions (1:N)
  └── projects (V2/V3) → reports / scenarios
```

### 5.5 التعارضات الحرجة ⚠️

1. **جدول `ingredients` معرّف مرتين**:
   - نسخة `menu_engineering_schema.sql`: تركيز على المخزون (`stock_quantity`, `reorder_level`).
   - نسخة `templates/supabase-schema.sql`: تركيز على تكلفة الوصفات (`current_price`, `vat_included`).
   - كلاهما يستخدم `CREATE TABLE IF NOT EXISTS`؛ أيهما يعمل أولاً يحدد الهيكل الفعلي.

2. **جدول `subscriptions` معرّف مرتين**:
   - `templates/supabase-schema.sql` يستخدم `tier` مع CHECK وعدة أعمدة.
   - `v2_core_tables.sql` يستخدم `plan` بدون CHECK وأعمدة أقل.
   - يُسبب عدم تطابق في توقعات التطبيق.

3. **جدول `projects`**: موجود في root migrations وفي `bonds-v2/supabase/migrations/` مع جدول `reports` إضافي في bonds-v2.

4. **RLS**: بعض الجداول (`admin_roles`, `webhook_events`) تستخدم service role فقط دون policies واضحة.

---

## 6. نقاط القوة

| # | النقطة | التأثير |
|---|--------|---------|
| 1 | **Static site + Vercel** | سرعة عالية، تكلفة استضافة منخفضة، SEO جيد، CDN عالمي. |
| 2 | **محركات حسابية منفصلة** | `calc-functions.js` و `v3/engine/*` يفصلان المنطق عن الواجهة، يسهلان الاختبار. |
| 3 | **مكتبات مشتركة قوية** | `BondsAuth`, `BondsUI`, `BondsGeo`, `BondsDB`, `BondsCalc`, `BondsPlatforms` تقلل التكرار. |
| 4 | **اختبارات آلية** | Jest + Playwright (visual/a11y/mobile) + CI workflow. |
| 5 | **PWA** | Service Worker + manifest + أيقونات، تطبيق قابل للتثبيت. |
| 6 | **Open Graph شاملة** | جميع الصفحات العامة تحتوي على canonical و og/twitter tags. |
| 7 | **Supabase Auth + RLS** | مصادقة جاهزة وسياسات صلاحيات على مستوى الصف. |
| 8 | **تنوع المنتجات** | حاسبات، V3، menu engineering، recipe costing، admin dashboard — منصة متكاملة. |
| 9 | **استخدام متغيرات CSS وطبقات** | نظام تصميم مركزي في `styles/` يسهل التغييرات الشاملة. |
| 10 | **GitHub Actions CI** | اختبارات آلية عند كل push/PR. |

---

## 7. نقاط القصور والمخاطر

| # | القصور | المخاطر |
|---|--------|---------|
| 1 | **تكرار يدوي بين العربية والإنجليزية** | 209 صفحات HTML، كثير منها نسخة مرآة يدوية. أي تعديل يتطلب تعديل مزدوج. |
| 2 | **تعارضات في تعريفات الجداول** | `ingredients` و `subscriptions` معرّفان بطريقتين؛ قد يسببان أخطاء runtime. |
| 3 | **نسخ مكررة من helpers** | `lib/api/supabase.js` vs `v3/lib/supabase.js`، `lib/api/email.js` vs `v3/lib/email.js`، معالجة Stripe مكررة. |
| 4 | **APIs بدون rate limiting مركزي** | `track.js`, `contact.js`, `usage.js` قد تتعرض للإساءة. |
| 5 | **عدم وجود validation موحد** | كل API يتحقق من المدخلات بشكل منفصل؛ بعضها قد يفتقر لـ sanitization. |
| 6 | **بيانات V3 كبيرة ومتنامية** | `city_market_data`, `raw_data`, `normalized_metrics` قد تكبر بسرعة وتحتاج indexes وread replicas. |
| 7 | **English coverage غير مكتمل** | بعض صفحات المصادقة والإدارة الإنجليزية مفقودة (9 مقابل 12 عربية، 6 admin مقابل 11). |
| 8 | **Service Worker قد يخزن API responses** | تم استثناء `/api/` في النسخة الأخيرة، لكن بعض الاستجابات قد تُخزن إذا لم تُستثنَ بدقة. |
| 9 | **الاعتماد على inline CSS/JS** | صفحات كثيرة تحتوي على أنماط وبرمجيات داخلية؛ يصعب الصيانة والاختبار. |
| 10 | **عدم وجود نظام i18n حقيقي** | النصوص موجودة في HTML أو `site-layout.js`؛ لا يوجد قاموس مركزي. |
| 11 | **عدم وجود logging/observability مركزي** | باستثناء Sentry في بعض الأماكن، لا يوجد logging موحد للـ APIs. |
| 12 | **مخلفات وتكرارات** | `api-old` حُذف مؤخراً، لكن لا يزال هناك `bonds-v2/` و `calculator-v2.html` كنسخ بديلة. |

---

## 8. معمارية مقترحة قابلة للتوسع

### 8.1 الرؤية

الانتقال من "موقع ثابت يدوي + APIs متفرقة" إلى **منصة متعددة الطبقات**:

```
┌─────────────────────────────────────────────────────────────┐
│                    CDN / Edge (Vercel)                       │
│  Static HTML / ISR / Edge Functions / PWA / Manifest        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│              API Gateway / Serverless Layer                  │
│  - Auth middleware (JWT/Supabase)                            │
│  - Rate limiting (Upstash Redis)                             │
│  - Input validation (Zod)                                    │
│  - Logging & metrics (Pino + Axiom/Logflare)                 │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────┬───────┴───────┬─────────────┐
        ▼             ▼               ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────┐
   │ Site    │  │ Billing  │  │ V3 Engine   │  │ Admin    │
   │ APIs    │  │ APIs     │  │ APIs        │  │ APIs     │
   └─────────┘  └──────────┘  └─────────────┘  └──────────┘
        │             │               │             │
        └─────────────┴───────┬───────┴─────────────┘
                              ▼
              ┌───────────────────────────────┐
              │      Supabase (PostgreSQL)     │
              │  - public schema (site)        │
              │  - v3 schema (intelligence)    │
              │  - auth + storage + realtime   │
              └───────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌──────────┐        ┌──────────┐          ┌──────────┐
   │ Upstash  │        │ S3/      │          │ Stripe/  │
   │ Redis    │        │ Supabase │          │ Moyasar  │
   │ (cache)  │        │ Storage  │          │ (billing)│
   └──────────┘        └──────────┘          └──────────┘
```

### 8.2 الطبقة الأولى — Frontend

**الحل المقترح:** استخدام **Static Site Generator** خفيف (مثل **Astro** أو **11ty**) أو نظام **build-time templating** بـ Nunjucks/EJS.

| المكون | المقترح |
|--------|---------|
| القوالب | قوالب مشتركة للحاسبة/الصفحة، مع تمرير `lang=ar\|en` و `country=...` |
| i18n | قاموس JSON مركزي (`locales/ar.json`, `locales/en.json`) يُحمّل أثناء البناء |
| CSS | الاحتفاظ بـ `styles/` المقسمة؛ توليد نسخة مدمجة أثناء البناء |
| JS | الحفاظ على `BondsCalc`/`BondsGeo` كمكتبات vanilla قابلة للاستيراد |
| Factory-cost | صفحة واحدة `factory-cost.html` مع `?country=SA` بدلاً من 42 ملفًا |
| Sectors | قالب واحد `sector-guide.html` مع `?country=AE` |

**الفائدة:** تقليل 209 ملفات إلى ~50 قالب، وإزالة التكرار العربي/الإنجليزي.

### 8.3 الطبقة الثانية — API Gateway

إنشاء `api/_middleware.js` (أو Vercel Edge Middleware) يوفر:

- **CORS** موحد.
- **Rate limiting** باستخدام Upstash Redis (مثلاً 100 req/min للزائر، 1000 req/min للمستخدم).
- **Auth** middleware يتحقق من Supabase JWT ويضيف `req.user`.
- **Validation** باستخدام Zod لكل الطلبات.
- **Logging** موحد (Pino) مع correlation ID.

### 8.4 الطبقة الثالثة — APIs المنطقية

دمج المكتبات المكررة:

- `lib/supabase.js` واحد يستخدم `SUPABASE_SERVICE_ROLE_KEY`.
- `lib/email.js` واحد.
- `lib/stripe.js` واحد.
- `lib/usage.js` للتحقق من الحدود.

تقسيم APIs إلى دوائر منطقية:

| الدائرة | الملفات |
|---------|---------|
| `api/site/*` | contact, track, bank-transfer, env |
| `api/auth/*` | signin/signup/profile/password |
| `api/billing/*` | checkout, billing, webhook |
| `api/admin/*` | admin dashboard actions |
| `api/v3/*` | Bonds V3 router (يُبقي كما هو مع refactor) |

### 8.5 الطبقة الرابعة — قاعدة البيانات

#### أ. حل التعارضات

1. **فصل المخططات (schemas)**:
   - `public` للموقع الأساسي.
   - `v3` للذكاء الاقتصادي.
   - `menu_engineering` لأدوات المطاعم (اختياري).

2. **توحيد `subscriptions`**:
   - جدول واحد يحتوي على `plan` أو `tier`، `status`، `provider` (`stripe`/`moyasar`/manual)، `current_period_start/end`، `cancel_at_period_end`.

3. **توحيد `ingredients`**:
   - إذا كان الهدف دمج الوحدتين: إضافة أعمدة `stock_quantity`, `reorder_level`, `current_price`, `vat_included` في جدول واحد.
   - أو فصلهما إلى `menu_ingredients` و `recipe_ingredients`.

#### ب. تحسينات الأداء

- إضافة indexes على `user_id`, `created_at`, `country`, `city_code` في الجداول الكبيرة.
- استخدام `pg_stat_statements` لمراقبة الاستعلامات البطيئة.
- للبيانات الكبيرة (V3): consider read replica أو materialized views للتقارير.

#### ج. الأمان

- تفعيل RLS على جميع جداول المستخدمين.
- استخدام `service_role` فقط في APIs، وعدم إرساله إلى المتصفح.
- تخزين `STRIPE_SECRET_KEY` و `SUPABASE_SERVICE_ROLE_KEY` في environment variables فقط.

### 8.6 Caching & Performance

| المكون | الاستخدام |
|--------|-----------|
| Vercel Edge Cache | كاش HTML/CSS/JS/Image عالمي |
| Upstash Redis | rate limit + session cache + API response cache |
| Service Worker | تخزين مؤقت للأصول الثابتة فقط |
| Materialized Views | تقارير V3 المعقدة |

### 8.7 Observability

- **Sentry** للأخطاء في frontend و APIs.
- **Pino** للـ structured logs.
- **Vercel Analytics** لأداء الواجهة.
- **Supabase Reports** لأداء قاعدة البيانات.

---

## 9. خارطة طريق مقترحة

### المرحلة 1 — استقرار (0–4 أسابيع)
1. حل تعارضات `subscriptions` و `ingredients`.
2. توحيد `lib/supabase.js` و `lib/email.js` وإزالة `v3/lib/*` المكرر.
3. إضافة rate limiting و validation موحد للـ APIs.
4. ضبط indexes على الجداول الأكثر استخداماً.

### المرحلة 2 — تحسين البنية (1–3 أشهر)
1. بناء نظام i18n وقاموس JSON.
2. تحويل صفحات المصنع والقطاعات إلى قوالب مع بارامترات.
3. إعادة هيكلة `api/` إلى مجلدات منطقية مع middleware موحد.
4. إنشاء test coverage أعلى للـ APIs (Jest + supertest).

### المرحلة 3 — التوسع (3–6 أشهر)
1. نقل Bonds V3 إلى schema منفصل مع read replica.
2. إضافة materialized views للتقارير.
3. بناء admin CMS أكثر قوة لإدارة بيانات V3.
4. دعم المزيد من اللغات (تركي، أوردو…) عبر نفس نظام i18n.

---

## 10. الخلاصة

Bonds Global منصة ناضجة من حيث المنتج والمحتوى، لكنها تعاني من **التكرار اليدوي** و**تعارضات قاعدة البيانات** و**تشتت المكتبات**. بالانتقال إلى SSG مع i18n، وتوحيد APIs مع middleware، وحل تعارضات Supabase، يمكن تحويلها إلى منصة قابلة للتوسع بسهولة وصيانتها أقل تكلفة.
