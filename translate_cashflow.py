import re

with open('calculators/cash-flow.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. lang/dir
content = content.replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">')

# 2. Font: Vazirmatn -> Inter (all occurrences)
content = content.replace(
    "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap",
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
)
content = content.replace("Vazirmatn", "Inter")

# 3. Paths
content = content.replace('href="../styles.css"', 'href="../../styles.css"')
content = content.replace('src="../assets/', 'src="../../assets/')
content = content.replace('href="../assets/', 'href="../../assets/')
content = content.replace('src="shared-utils.js"', 'src="../shared-utils.js"')
content = content.replace('src="../script.js"', 'src="../../script.js"')
content = content.replace('href="../privacy.html"', 'href="../../privacy.html"')
content = content.replace('href="../calculator.html"', 'href="../../calculator.html"')
content = content.replace('href="pricing.html"', 'href="../calculators/pricing.html"')
content = content.replace('href="loan.html"', 'href="../calculators/loan.html"')
content = content.replace('href="cash-flow.html"', 'href="../calculators/cash-flow.html"')
content = content.replace('href="../methodology.html"', 'href="../../methodology.html"')
content = content.replace('href="../blog/index.html"', 'href="../../blog/index.html"')
content = content.replace('href="en/cash-flow.html"', 'href="../calculators/cash-flow.html"')

# Also handle remaining root-level nav links
for page in ['index.html', 'services.html', 'about.html', 'faq.html', 'contact.html', 'pricing.html']:
    content = content.replace(f'href="../{page}"', f'href="../../{page}"')

# 4. Meta tags
content = content.replace(
    '<title>حاسبة تدفق النقد | بوندز — استشارات مالية</title>',
    '<title>Cash Flow Calculator | Bonds — Financial Consulting</title>'
)
content = content.replace(
    'content="احسب توقعات التدفق النقدي لـ 12 شهراً: الواردات، المصروفات، والرصيد الختامي. أداة مجانية من بوندز."',
    'content="Calculate your 12-month cash flow forecast: inflows, outflows, and closing balance. Free tool from Bonds."'
)
content = content.replace(
    'content="حاسبة تدفق النقد | بوندز"',
    'content="Cash Flow Calculator | Bonds"'
)
content = content.replace(
    'content="احسب توقعات التدفق النقدي لـ 12 شهراً: الواردات، المصروفات، والرصيد الختامي."',
    'content="Calculate your 12-month cash flow forecast: inflows, outflows, and closing balance."'
)
content = content.replace(
    'content="https://bonds-global.com/calculators/cash-flow.html"',
    'content="https://bonds-global.com/en/calculators/cash-flow.html"'
)

# 5. toLocaleString
content = content.replace("toLocaleString('ar-SA')", "toLocaleString('en-US')")

# 6. MONTHS_AR -> MONTHS_EN and values
content = content.replace(
    "var MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];",
    "var MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];"
)
content = content.replace("MONTHS_AR", "MONTHS_EN")

# 7. INFLOW_ROWS labels
content = content.replace(
    "{id:'sales', label:'إيرادات المبيعات'},",
    "{id:'sales', label:'Sales Revenue'},"
)
content = content.replace(
    "{id:'other', label:'إيرادات أخرى'},",
    "{id:'other', label:'Other Income'},"
)
content = content.replace(
    "{id:'loans', label:'قروض مستلمة'}",
    "{id:'loans', label:'Loans Received'}"
)

# 8. OUTFLOW_ROWS labels
content = content.replace(
    "{id:'rent', label:'إيجار'},",
    "{id:'rent', label:'Rent'},"
)
content = content.replace(
    "{id:'salaries', label:'رواتب'},",
    "{id:'salaries', label:'Salaries'},"
)
content = content.replace(
    "{id:'raw', label:'مواد خام'},",
    "{id:'raw', label:'Raw Materials'},"
)
content = content.replace(
    "{id:'marketing', label:'تسويق'},",
    "{id:'marketing', label:'Marketing'},"
)
content = content.replace(
    "{id:'taxes', label:'ضرائب'},",
    "{id:'taxes', label:'Taxes'},"
)
content = content.replace(
    "{id:'loan_repay', label:'سداد قروض'},",
    "{id:'loan_repay', label:'Loan Repayments'},"
)
content = content.replace(
    "{id:'other_exp', label:'مصروفات أخرى'}",
    "{id:'other_exp', label:'Other Expenses'}"
)

# 9. Translation map for all remaining Arabic text
translations = {
    'استشارتك الأولى مجانية — احجز الآن': 'Your first consultation is free — Book now',
    'واتساب سريع →': 'Quick WhatsApp →',
    'alt="بوندز"': 'alt="Bonds"',
    'logo-text">بوندز</span>': 'logo-text">Bonds</span>',
    '>الرئيسية<': '>Home<',
    '>الخدمات<': '>Services<',
    '>التحليل المالي<': '>Financial Analysis<',
    '>إدارة التدفقات النقدية<': '>Cash Flow Management<',
    '>دراسات الجدوى<': '>Feasibility Studies<',
    '>تحليل المخاطر<': '>Risk Analysis<',
    '>الاستبيانات والبحوث<': '>Surveys & Research<',
    '>الأسعار<': '>Pricing<',
    '>من نحن<': '>About<',
    '>آلة حاسبة<': '>Calculators<',
    '>مقالات<': '>Articles<',
    '>الأسئلة الشائعة<': '>FAQ<',
    '>تواصل<': '>Contact<',
    '>EN<': '>AR<',
    'aria-label="تبديل الوضع"': 'aria-label="Toggle theme"',
    'احجز استشارتك': 'Book your consultation',
    'aria-label="القائمة"': 'aria-label="Menu"',
    'أداة مجانية': 'Free Tool',
    'حاسبة <span class="text-gradient">تدفق النقد</span>': 'Cash <span class="text-gradient">Flow Calculator</span>',
    'توقع وضعك النقدي على مدار 12 شهراً: الواردات، المصروفات، والرصيد الختامي.': 'Forecast your cash position over 12 months: inflows, outflows, and closing balance.',
    'بيانات التدفق النقدي': 'Cash Flow Data',
    'الرصيد الافتتاحي (بداية الشهر الأول)': 'Opening Balance (start of Month 1)',
    'placeholder="مثلاً: 50000"': 'placeholder="e.g., 50000"',
    'الواردات الشهرية 💰': 'Monthly Inflows 💰',
    'المصروفات الشهرية 💸': 'Monthly Outflows 💸',
    'احسب النتائج': 'Calculate Results',
    'جرب مثال توضيحي': 'Try a sample',
    'مسح البيانات': 'Clear Data',
    'النتائج الشهرية': 'Monthly Results',
    'إجمالي الواردات السنوي': 'Annual Total Inflows',
    'إجمالي المصروفات السنوي': 'Annual Total Outflows',
    'صافي التدفق السنوي': 'Annual Net Cash Flow',
    'الرصيد الختامي (ديسمبر)': 'Closing Balance (December)',
    'أدنى رصيد خلال العام': 'Minimum Balance during the year',
    'أعلى رصيد خلال العام': 'Maximum Balance during the year',
    'طباعة / PDF': 'Print / PDF',
    'ابغى تحليل أعمق؟': 'Want deeper analysis?',
    'هذه الأداة تقديرية. لو تبي تحليل دقيق للتدفقات النقدية — نحن نقدم استشارة مجانية.': 'This tool is indicative. If you want an accurate cash flow analysis — we offer a free consultation.',
    'احجز استشارتك المجانية →': 'Book your free consultation →',
    'تنبيه: رصيد نقدي سالب': 'Alert: Negative Cash Balance',
    'استشارة مجانية (30 دقيقة)': 'Free Consultation (30 minutes)',
    'احفظ نتائجك واحصل على هدية': 'Save your results & get a gift',
    'أرسل هذه النتائج لبريدك + نموذج Cash Flow Forecast مجاني.': 'Send these results to your email + free Cash Flow Forecast template.',
    'placeholder="الاسم"': 'placeholder="Name"',
    'placeholder="البريد الإلكتروني"': 'placeholder="Email"',
    'placeholder="رقم الجوال (اختياري)"': 'placeholder="Phone (optional)"',
    'أرسل لي النتائج': 'Send me the results',
    'تم الإرسال! سنتواصل معك خلال 24 ساعة.': 'Sent! We will contact you within 24 hours.',
    'الرصيد الختامي على مدار 12 شهراً': 'Closing Balance over 12 Months',
    'الشفافية': 'Transparency',
    'كيف تعمل الحاسبة؟': 'How does the calculator work?',
    'المعادلات': 'Equations',
    'إجمالي الواردات = إيرادات المبيعات + إيرادات أخرى + قروض مستلمة': 'Total Inflows = Sales Revenue + Other Income + Loans Received',
    'إجمالي المصروفات = إيجار + رواتب + مواد خام + تسويق + ضرائب + سداد قروض + مصروفات أخرى': 'Total Outflows = Rent + Salaries + Raw Materials + Marketing + Taxes + Loan Repayments + Other Expenses',
    'صافي التدفق = إجمالي الواردات − إجمالي المصروفات': 'Net Cash Flow = Total Inflows − Total Outflows',
    'الرصيد الختامي = الرصيد الافتتاحي + صافي التدفق': 'Closing Balance = Opening Balance + Net Cash Flow',
    'تحذيرات': 'Warnings',
    'هذه أداة <strong>تقديرية</strong> وليست بديلاً عن استشارة مالية.': 'This is an <strong>indicative</strong> tool and not a substitute for financial consultation.',
    'النتائج تعتمد على <strong>دقة البيانات المدخلة</strong>.': 'Results depend on <strong>input data accuracy</strong>.',
    'تأكد من تضمين جميع الالتزامات المتكررة.': 'Make sure to include all recurring obligations.',
    'الرصيد السالب في أي شهر يعني حاجة لتمويل إضافي.': 'A negative balance in any month means a need for additional financing.',
    'إخلاء مسؤولية': 'Disclaimer',
    'هذه الأدوة <strong>حاسبات تقديرية</strong> تهدف إلى المساعدة في الفهم المالي العام. النتائج تعتمد على المدخلات التي تقدمها، وقد لا تعكس الواقع التشغيلي الدقيق لشركتك بسبب عوامل خارجية (تقلبات السوق، تغيرات التكاليف، الالتزامات غير المتوقعة، الاستهلاك، التضخم، إلخ).': 'These tools are <strong>indicative calculators</strong> intended to help with general financial understanding. Results depend on the inputs you provide, and may not reflect the exact operational reality of your company due to external factors (market fluctuations, cost changes, unexpected obligations, depreciation, inflation, etc.).',
    '<strong>لا تغني هذه الأدوة عن استشارة محاسب مرخص أو مستشار مالي مؤهل.</strong> إذا كنت تتخذ قرارات استثمارية أو مالية كبيرة، نوصي بشدة بالتواصل مع فريق بوندز للحصول على تحليل مخصص يأخذ بعين الاعتبار بيئة عملك الفعلية.': '<strong>These tools do not replace consultation with a licensed accountant or qualified financial advisor.</strong> If you are making major investment or financial decisions, we strongly recommend contacting the Bonds team for a customized analysis that takes your actual work environment into account.',
    'استشارات مالية لأصحاب المشاريع والشركات الصغيرة والمتوسطة في مصر والسعودية.': 'Financial consulting for entrepreneurs and SMEs in Egypt and Saudi Arabia.',
    'الصفحات': 'Pages',
    'الخدمات': 'Services',
    'من نحن': 'About',
    'الأسئلة الشائعة': 'FAQ',
    'تواصل معنا': 'Contact Us',
    'السجلات التجارية': 'Commercial Registrations',
    'مصر: س.ت 39733': 'Egypt: CR 39733',
    'السعودية: ر.و.م 7042125869': 'Saudi Arabia: CR 7042125869',
    'تواصل': 'Contact',
    'واتساب: +966 56 756 6616': 'WhatsApp: +966 56 756 6616',
    'الشيخ زايد، الجيزة، مصر <br>جدة، شارع قريش': 'Sheikh Zayed, Giza, Egypt <br>Jeddah, Quraish Street',
    'بوندز للاستشارات المالية — جميع الحقوق محفوظة.': 'Bonds Financial Consulting — All rights reserved.',
    'سياسة الخصوصية': 'Privacy Policy',
    'إخلاء المسؤولية': 'Disclaimer',
    'aria-label="واتساب"': 'aria-label="WhatsApp"',
    'مكتبة Excel غير محملة. حاول تحديث الصفحة.': 'Excel library not loaded. Please refresh the page.',
    'حدث خطأ في الحساب: ': 'Calculation error: ',
    'حدث خطأ، حاول مرة أخرى.': 'An error occurred, please try again.',
    'جاري الإرسال...': 'Sending...',
    'البند': 'Item',
    'المجموع / المتوسط': 'Total / Average',
    'الرصيد الافتتاحي': 'Opening Balance',
    'إجمالي الواردات': 'Total Inflows',
    'إجمالي المصروفات': 'Total Outflows',
    'صافي التدفق النقدي': 'Net Cash Flow',
    'الرصيد الختامي': 'Closing Balance',
    'الرصيد: ': 'Balance: ',
    'الرصيد سالب في ': 'Balance is negative in ',
    ' شهر/أشهر: ': ' month(s): ',
    '. تحتاج خطة تمويل أو تخفيض مصروفات لتجاوز هذه الفترة.': '. You need a financing plan or expense reduction to overcome this period.',
    'بيانات الإدخال': 'Input Data',
    'الواردات': 'Inflows',
    'المصروفات': 'Outflows',
    'الإدخالات': 'Inputs',
    'النتائج': 'Results',
    'النتائج الشهرية': 'Monthly Results',
    'المجموع': 'Total',
    'تقرير التدفق النقدي': 'Cash Flow Report',
    'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.': 'Popup blocked. Please allow popups for this website.',
    'بوندز': 'Bonds',
    'للاستشارات المالية': 'Financial Consulting',
    'تقرير توقعات التدفق النقدي': 'Cash Flow Forecast Report',
    'ملخص سنوي': 'Annual Summary',
    'التفاصيل الشهرية': 'Monthly Details',
    'الرسم البياني': 'Chart',
    'المؤشر': 'Metric',
    'القيمة': 'Value',
    'إجمالي الواردات السنوي': 'Annual Total Inflows',
    'إجمالي المصروفات السنوي': 'Annual Total Outflows',
    'صافي التدفق السنوي': 'Annual Net Cash Flow',
    'الرصيد الختامي (ديسمبر)': 'Closing Balance (December)',
    'أدنى رصيد': 'Minimum Balance',
    'أعلى رصيد': 'Maximum Balance',
    'هذا التقرير للأغراض التقديرية فقط ولا يغني عن استشارة مالية مرخصة.<br>\n            تم إنشاؤه بواسطة bonds-global.com': 'This report is for indicative purposes only and does not replace licensed financial advice.<br>\n            Generated by bonds-global.com',
}

# Sort by length descending to avoid partial replacements
for ar, en in sorted(translations.items(), key=lambda x: -len(x[0])):
    content = content.replace(ar, en)

# Also replace ر.س with SAR
count_sar = 0
content, count_sar = re.subn(r' ر\.س', ' SAR', content)
print(f"Replaced {count_sar} occurrences of ' ر.س' with ' SAR'")

# Print window dir change
content = content.replace('<html dir="rtl">', '<html dir="ltr">')
# Print window text-align changes for generated tables
content = content.replace('text-align:right;', 'text-align:left;')

with open('en/calculators/cash-flow.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done. File written to en/calculators/cash-flow.html")
