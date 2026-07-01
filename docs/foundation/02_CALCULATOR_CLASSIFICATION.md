# BONDS Calculator Classification — تصنيف الحاسبات

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة تأسيس — لا يحتوي على كود

## 1. ملاحظات عامة

- تم تصنيف الحاسبات العربية في `calculators/`.
- النسخة الإنجليزية في `en/calculators/` تعكس نفس التصنيف.
- الحاسبات التي تحمل نفس الاسم في `en/` تُعتبر mirror وليست تصنيفاً منفصلاً.

## 2. التصنيفات المعتمدة

| التصنيف | الوصف |
|---|---|
| Financial Calculators | حسابات مالية عامة (تدفق نقدي، قرض، استرداد). |
| Valuation Engines | تقييم الأصول والمشاريع. |
| Feasibility Engines | دراسات الجدوى الاقتصادية. |
| Risk Engines | تقييم المخاطر والجدارة الائتمانية. |
| Funding Engines | تمويل وقرض وهيكلة دين. |
| Tax Calculators | حسابات الزكاة والضريبة. |
| Investment Calculators | تحليل الاستثمار العام. |
| Business Intelligence | تحليل الأعمال والمطاعم والتسعير. |
| Market Intelligence | بيانات السوق والمقارنات. |
| Decision Intelligence | دعم القرار. |
| AI Assistants | مساعدات ذكاء اصطناعي. |
| Report Generators | توليد التقارير. |
| Certificate Engines | إصدار الشهادات. |
| Data Collection Tools | جمع البيانات والمصادقة. |
| Scenario Engines | محاكاة السيناريوهات. |

## 3. جدول تصنيف الحاسبات

| الملف | التصنيف | الهدف | المستخدم | القطاع | المدخلات | المخرجات | المعادلات | AI | مصادر البيانات | الاعتماديات | الأولوية |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `auth/account.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/confirmed.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/debug.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/diagnose.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/index.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/login.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/onboarding.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/profile.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/reset.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/subscription.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/verify-email.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `auth/verify-otp.html` | Data Collection / Auth | Authentication & profile capture | All users | Platform | email, password, profile data | session, profile | None | No | Supabase Auth | supabase-client.js | High |
| `cash-flow.html` | Financial Calculators | Project cash flow over time | Investor, Advisor | All | revenue, costs, periods | monthly/annual cash flow | Net cash flow | No | User input | shared-utils.js, Chart.js | High |
| `creditworthiness.html` | Risk Engines / Funding | Assess credit eligibility | Banks, Investors | All | financials, debts, assets | score, risk grade | DSCR, leverage ratios | No | User input | creditworthiness-engine.js | High |
| `dashboard.html` | Business Intelligence | Overview of calculator usage | User | All | usage logs, scenarios | metrics, charts | Aggregations | No | usage_logs | db-client.js | Medium |
| `dish-margin.html` | Business Intelligence / Restaurant | Dish-level profitability | Restaurant owner | Restaurant | ingredient costs, price | dish margin, cost % | Food cost %, margin | No | ingredients | shared-utils.js | Medium |
| `factory-cost-ae.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-bh.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-dj.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-dz.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-eg.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-iq.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-jo.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-km.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-kw.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-lb.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-ly.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-ma.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-mr.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-om.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-ps.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-qa.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-sd.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-so.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-sy.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-tn.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost-ye.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `factory-cost.html` | Feasibility Engines / Manufacturing | Factory setup cost by country | Manufacturer | Manufacturing | area, country, lines | estimated cost | Cost build-up | No | country-platforms-data.js | factory-cost-shared.css | Medium |
| `feasibility-template-backup.html` | Feasibility Engines | Generic feasibility study | Investor | All | capital, revenue, costs | NPV, IRR, payback | NPV, IRR, DSCR | Planned | User input, Knowledge | feasibility-template-shared.css | High |
| `feasibility-template-real-estate.html` | Feasibility Engines | Generic feasibility study | Investor | All | capital, revenue, costs | NPV, IRR, payback | NPV, IRR, DSCR | Planned | User input, Knowledge | feasibility-template-shared.css | High |
| `feasibility-template.html` | Feasibility Engines | Generic feasibility study | Investor | All | capital, revenue, costs | NPV, IRR, payback | NPV, IRR, DSCR | Planned | User input, Knowledge | feasibility-template-shared.css | High |
| `feasibility.html` | Feasibility Engines | Generic feasibility study | Investor | All | capital, revenue, costs | NPV, IRR, payback | NPV, IRR, DSCR | Planned | User input, Knowledge | feasibility-template-shared.css | High |
| `investment-center/agriculture.html` | Feasibility Engines / Agriculture | Agriculture investment analysis | Investor | Agriculture | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/building-materials-factory.html` | Feasibility Engines / Manufacturing | Manufacturing investment analysis | Investor | Manufacturing | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/buy-to-rent.html` | Valuation Engines / Real Estate | Real Estate investment analysis | Investor | Real Estate | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/chemicals-factory.html` | Feasibility Engines / Manufacturing | Manufacturing investment analysis | Investor | Manufacturing | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/cloud-kitchen.html` | Feasibility Engines / Restaurant | Restaurant investment analysis | Investor | Restaurant | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/coffee-shop.html` | Feasibility Engines / Restaurant | Restaurant investment analysis | Investor | Restaurant | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/commercial-complex.html` | Valuation Engines / Real Estate | Real Estate investment analysis | Investor | Real Estate | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/commercial-mall.html` | Valuation Engines / Real Estate | Real Estate investment analysis | Investor | Real Estate | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/commercial.html` | Valuation Engines / Real Estate | Real Estate investment analysis | Investor | Real Estate | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/concrete-structure-cost.html` | Feasibility Engines / Construction | Construction investment analysis | Investor | Construction | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/construction-profitability.html` | Business Intelligence / Construction | Construction investment analysis | Investor | Construction | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/construction.html` | Feasibility Engines / Construction | Construction investment analysis | Investor | Construction | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/contractor-cashflow.html` | Financial Calculators / Construction | Construction investment analysis | Investor | Construction | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/dental-clinic.html` | Feasibility Engines / Healthcare | Healthcare investment analysis | Investor | Healthcare | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/distressed-project-evaluation.html` | Valuation Engines / Real Estate / Distressed | Real Estate / Distressed investment analysis | Investor | Real Estate / Distressed | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/distribution-center.html` | Feasibility Engines / Logistics | Logistics investment analysis | Investor | Logistics | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/e-learning-platform.html` | Feasibility Engines / Education | Education investment analysis | Investor | Education | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/education.html` | Feasibility Engines / Education | Education investment analysis | Investor | Education | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/fast-food-restaurant.html` | Feasibility Engines / Restaurant | Restaurant investment analysis | Investor | Restaurant | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/fine-dining-restaurant.html` | Feasibility Engines / Restaurant | Restaurant investment analysis | Investor | Restaurant | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/finishing-cost.html` | Feasibility Engines / Construction | Construction investment analysis | Investor | Construction | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/food-factory.html` | Feasibility Engines / Manufacturing | Manufacturing investment analysis | Investor | Manufacturing | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/food-truck.html` | Feasibility Engines / Restaurant | Restaurant investment analysis | Investor | Restaurant | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/furniture-factory.html` | Feasibility Engines / Manufacturing | Manufacturing investment analysis | Investor | Manufacturing | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/hospital.html` | Feasibility Engines / Healthcare | Healthcare investment analysis | Investor | Healthcare | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/hotel-apartments.html` | Feasibility Engines / Tourism | Tourism investment analysis | Investor | Tourism | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/hotel.html` | Feasibility Engines / Tourism | Tourism investment analysis | Investor | Tourism | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/index.html` | Feasibility Engines / Portal | Portal investment analysis | Investor | Portal | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/industrial.html` | Feasibility Engines / Manufacturing | Manufacturing investment analysis | Investor | Manufacturing | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/land-development.html` | Valuation Engines / Real Estate | Real Estate investment analysis | Investor | Real Estate | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/last-mile-delivery.html` | Feasibility Engines / Logistics | Logistics investment analysis | Investor | Logistics | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/logistics.html` | Feasibility Engines / Logistics | Logistics investment analysis | Investor | Logistics | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/medical-complex.html` | Feasibility Engines / Healthcare | Healthcare investment analysis | Investor | Healthcare | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/medical-lab.html` | Feasibility Engines / Healthcare | Healthcare investment analysis | Investor | Healthcare | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/medical.html` | Feasibility Engines / Healthcare | Healthcare investment analysis | Investor | Healthcare | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/nursery.html` | Feasibility Engines / Education | Education investment analysis | Investor | Education | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/optical-center.html` | Feasibility Engines / Healthcare | Healthcare investment analysis | Investor | Healthcare | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/packaging-factory.html` | Feasibility Engines / Manufacturing | Manufacturing investment analysis | Investor | Manufacturing | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/pharmacy.html` | Feasibility Engines / Healthcare | Healthcare investment analysis | Investor | Healthcare | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/physiotherapy-center.html` | Feasibility Engines / Healthcare | Healthcare investment analysis | Investor | Healthcare | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/plastic-factory.html` | Feasibility Engines / Manufacturing | Manufacturing investment analysis | Investor | Manufacturing | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/private-school.html` | Feasibility Engines / Education | Education investment analysis | Investor | Education | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/private-university.html` | Feasibility Engines / Education | Education investment analysis | Investor | Education | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/property-rehabilitation.html` | Valuation Engines / Real Estate | Real Estate investment analysis | Investor | Real Estate | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/quick-real-estate.html` | Valuation Engines / Real Estate | Real Estate investment analysis | Investor | Real Estate | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/radiology-center.html` | Feasibility Engines / Healthcare | Healthcare investment analysis | Investor | Healthcare | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/real-estate.html` | Valuation Engines / Real Estate | Real Estate investment analysis | Investor | Real Estate | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/residential-building.html` | Valuation Engines / Real Estate | Real Estate investment analysis | Investor | Real Estate | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/restaurant.html` | Feasibility Engines / Restaurant | Restaurant feasibility | Restaurant owner | Restaurant | seats, avg ticket, costs | break-even, profit | Break-even, ROI | No | User input, Knowledge | shared-utils.js | High |
| `investment-center/restaurants.html` | Feasibility Engines / Restaurant | Restaurant investment analysis | Investor | Restaurant | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/retail.html` | Feasibility Engines / Retail | Retail investment analysis | Investor | Retail | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/shipping-company.html` | Feasibility Engines / Logistics | Logistics investment analysis | Investor | Logistics | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/technology.html` | Feasibility Engines / Technology | Technology investment analysis | Investor | Technology | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/tender-pricing.html` | Business Intelligence / Construction | Construction investment analysis | Investor | Construction | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/textiles-factory.html` | Feasibility Engines / Manufacturing | Manufacturing investment analysis | Investor | Manufacturing | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/tourism-company.html` | Feasibility Engines / Tourism | Tourism investment analysis | Investor | Tourism | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/tourism.html` | Feasibility Engines / Tourism | Tourism investment analysis | Investor | Tourism | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/tourist-camp.html` | Feasibility Engines / Tourism | Tourism investment analysis | Investor | Tourism | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/tourist-resort.html` | Feasibility Engines / Tourism | Tourism investment analysis | Investor | Tourism | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/training-center.html` | Feasibility Engines / Education | Education investment analysis | Investor | Education | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/transport-fleet.html` | Feasibility Engines / Logistics | Logistics investment analysis | Investor | Logistics | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/villa-construction.html` | Feasibility Engines / Construction | Construction investment analysis | Investor | Construction | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/warehouses.html` | Valuation Engines / Real Estate / Logistics | Real Estate / Logistics investment analysis | Investor | Real Estate / Logistics | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `investment-center/water-factory.html` | Feasibility Engines / Manufacturing | Manufacturing investment analysis | Investor | Manufacturing | capital, revenue, assumptions | IRR, NPV, score | NPV, IRR, break-even | Planned | User input, Knowledge | shared-utils.js | Medium |
| `invoice-analyzer.html` | Data Collection Tools | Analyze invoice fees | Business owner | All | invoice amount, fees | effective fee, correction | Fee difference | No | User input | shared-utils.js | Low |
| `loan.html` | Funding Engines | Loan repayment & cost | Business owner | All | principal, rate, tenor | installment, total cost | PMT, total interest | No | User input | shared-utils.js | High |
| `medical-viability.html` | Feasibility Engines / Healthcare | Healthcare project feasibility | Doctor, Investor | Healthcare | investment, visits, costs | viability score, ROI | ROI, break-even | Planned | User input, Knowledge | scenario-cards-shared.css | High |
| `menu-engineering-simple.html` | Business Intelligence / Restaurant | Menu performance matrix | Restaurant owner | Restaurant | menu items, sales, costs | stars, dogs, puzzles | ABC analysis | No | menu_items, sales | shared-utils.js | Medium |
| `menu-engineering.html` | Business Intelligence / Restaurant | Menu performance matrix | Restaurant owner | Restaurant | menu items, sales, costs | stars, dogs, puzzles | ABC analysis | No | menu_items, sales | shared-utils.js | Medium |
| `pricing.html` | Business Intelligence | Price optimization | Business owner | All | cost, target margin | recommended price | Cost-plus | No | User input | shared-utils.js | High |
| `restaurant.html` | Feasibility Engines / Restaurant | Restaurant feasibility | Restaurant owner | Restaurant | seats, avg ticket, costs | break-even, profit | Break-even, ROI | No | User input, Knowledge | shared-utils.js | High |

## 4. ملخص التصنيفات

| التصنيف | العدد |
|---|---|
| Feasibility Engines | 78 |
| Data Collection | 12 |
| Valuation Engines | 11 |
| Business Intelligence | 7 |
| Financial Calculators | 2 |
| Risk Engines | 1 |
| Data Collection Tools | 1 |
| Funding Engines | 1 |