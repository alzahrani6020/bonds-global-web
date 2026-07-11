import re
import os

def read_original():
    with open(r'C:\Users\vip\Downloads\جدوى-extracted.txt', 'r', encoding='windows-1256') as f:
        text = f.read()
    return text

def split_pages(text):
    # Form feed separates pages
    pages = text.split('\f')
    return [p.strip() for p in pages if p.strip()]

def detect_table(lines):
    """Heuristic: if multiple lines have numbers with commas or % or 'ريال' or look tabular."""
    if len(lines) < 3:
        return False
    numeric_count = 0
    for line in lines:
        if re.search(r'\d{1,3}(,\d{3})+|%|ريال|مليون|SAR', line):
            numeric_count += 1
    return numeric_count >= len(lines) * 0.4

def clean_line(line):
    line = line.strip()
    # Remove excessive dots
    line = re.sub(r'^[•·]+\s*', '', line)
    line = re.sub(r'\s*[•·]+$', '', line)
    return line

def lines_to_html(lines):
    if not lines:
        return ''
    # Detect headers: short lines ending without punctuation, often titles
    # Just wrap each logical block as paragraph
    html_parts = []
    for line in lines:
        line = clean_line(line)
        if not line:
            continue
        if line.startswith('http') or line.startswith('www.'):
            html_parts.append(f'<p>{line}</p>')
        elif len(line) < 80 and not re.search(r'[.:،؛]', line) and not re.search(r'\d', line):
            html_parts.append(f'<h4>{line}</h4>')
        else:
            html_parts.append(f'<p>{line}</p>')
    return '\n'.join(html_parts)

def page_to_html(page_text, page_num):
    lines = [l.rstrip() for l in page_text.splitlines() if l.strip()]
    # Remove footer lines with page number / website
    filtered = []
    for line in lines:
        if re.match(r'^\d+\s+www\.bonds-global\.com', line):
            continue
        if re.match(r'^www\.bonds-global\.com\s*\|', line):
            continue
        if re.match(r'^\d+$', line.strip()):
            continue
        filtered.append(line)
    
    content = lines_to_html(filtered)
    return f'<div class="pdf-page" id="page-{page_num}">\n{content}\n</div>'

def build_arabic_html():
    text = read_original()
    pages = split_pages(text)
    print(f'Total original pages: {len(pages)}')
    
    # Split into sections based on major headers
    # We'll keep pages as-is but insert new sections at logical points.
    
    html_pages = []
    for i, page in enumerate(pages, 1):
        html_pages.append(page_to_html(page, i))
    
    # Build full HTML
    html = '''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>دراسة جدوى ملقحة — شركة إحياء الأصول العقارية | بوندز</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { --gold: #d4a853; --bg: #0a0f1a; --text: #e8ecf4; --text-secondary: #94a3b8; --border: rgba(197,160,40,0.15); }
    body { font-family: Vazirmatn, Cairo, sans-serif; background: #fff; color: #1a1a1a; line-height: 1.9; margin: 0; padding: 0; }
    .page { max-width: 210mm; margin: 0 auto; padding: 14mm 18mm; }
    .pdf-page { page-break-after: always; min-height: 240mm; }
    h1, h2, h3, h4 { color: #8b6914; font-weight: 800; margin-top: 1.2rem; margin-bottom: .6rem; }
    h1 { font-size: 1.8rem; text-align: center; }
    h2 { font-size: 1.45rem; border-bottom: 2px solid var(--gold); padding-bottom: .3rem; }
    h3 { font-size: 1.2rem; color: #b8860b; }
    h4 { font-size: 1rem; color: #333; }
    p { margin: .6rem 0; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: .85rem; }
    th, td { border: 1px solid #ccc; padding: .45rem .55rem; text-align: right; vertical-align: top; }
    th { background: #f5f0e1; color: #8b6914; font-weight: 700; }
    tr:nth-child(even) td { background: #fafafa; }
    .cover { text-align: center; padding: 5rem 1rem; page-break-after: always; }
    .cover h1 { font-size: 2.2rem; margin-bottom: .5rem; }
    .highlight { background: #fff9e6; border-right: 4px solid #d4a853; padding: 1rem; margin: 1rem 0; }
    .case-study { background: #f9f9f9; border: 1px solid #ddd; border-radius: 10px; padding: 1.2rem; margin: 1rem 0; }
    .callout { background: #e8f5e9; border: 1px solid #4caf50; color: #1b5e20; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    .warning { background: #fff8e1; border: 1px solid #ffc107; color: #6d4c00; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    .section { page-break-before: always; }
    @media print { body { background: #fff; } .page { padding: 10mm 14mm; } }
  </style>
</head>
<body>
<div class="page">
'''
    
    # Insert cover note
    html += '''
<div class="cover">
  <div style="font-size: 1rem; color: #666;">دراسة جدوى معتمدة من</div>
  <div style="font-size: 1.4rem; font-weight: 800; color: #8b6914; margin: .5rem 0;">شركة بوندز للاستشارات المالية</div>
  <h1 style="margin-top: 2rem;">شركة إحياء الأصول العقارية</h1>
  <div style="font-size: 1.3rem; color: #b8860b; margin: 1rem 0;">نموذج الشراكة الذكية لإحياء المباني المتعثرة</div>
  <div style="font-size: 1.1rem; color: #555; margin-bottom: 2rem;">النسخة الملقحة الشاملة — دمج الدراسة الأصلية + نماذج الشراكة الجديدة + دراسة حالة مشروع أبحر</div>
  <div style="margin-top: 3rem; color: #666;">
    إعداد: بوندز (Bonds Global)<br>
    النسخة النهائية الملقحة | 9 يوليو 2026<br>
    www.bonds-global.com
  </div>
</div>
'''
    
    # Insert original pages
    for hp in html_pages:
        html += hp + '\n'
    
    # Add new vaccinated sections before closing
    html += '''
<!-- NEW VACCINATED SECTIONS -->
<div class="section">
  <h2>إضافات ملقحة — نماذج شراكة متقدمة</h2>
  
  <h3>نموذج 1: التوزيع النسبي بناءً على التقييم المعتمد + كمية الأعمال (BOQ)</h3>
  <p>بدلاً من نسبة ثابتة 50/50، يتم تحديد نصيب كل طرف بناءً على قيمة مساهمته في الأصل النهائي. تُحدد القيمة عبر تقييم عقاري معتمد من مُقيم مرخص من الهيئة العامة للعقار (REGA) وكمية أعمال (BOQ) موقعة من مكتب هندسي استشاري معتمد.</p>
  <p><strong>مثال:</strong> مبنى قيمته السوقية بعد التقييم 3,000,000 ريال، وتكلفة الإحياء 1,000,000 ريال. إجمالي القيمة 4,000,000 ريال. نصيب المالك = 75%، نصيب الشركة = 25%، مع إمكانية إضافة علاوة إدارة 5–10%.</p>
  
  <h3>نموذج 2: استرداد التكاليف أولاً + 20–25% من صافي الربح</h3>
  <p>عندما يرفض المالك التقييم أو النسبة النسبية، تسترد الشركة تكاليفها بالكامل من أول مبيعات الوحدات، ثم تأخذ 20–25% من صافي الربح المتبقي. هذا النموذج يمنح الشركة حماية مالية أقوى.</p>
  
  <h3>نموذج 3: استرداد الشركة من أول مبيعات (Company-First Recovery)</h3>
  <p>تستخلص الشركة حقوقها من أول مراحل بيع الوحدات قبل المالك. هذه الآلية تمنح الشركة سرعة دوران رأس المال، تقليل مدة تجميد رأس المال، وحماية مالية أقوى.</p>
  
  <h3>نموذج 4: شركة الأغراض الخاصة (SPV) لكل مشروع</h3>
  <p>لعزل المخاطر القانونية والمالية لكل مشروع، يمكن إنشاء SPV لكل أصل متعثر. تملك الشركة الأم 51–75%، ويحتفظ المالك بحصة أقلية. فوائد SPV: عزل المخاطر، جذب مستثمرين خارجيين، إمكانية بيع أو تمويل SPV بشكل مستقل، شفافية أكبر في الحوكمة.</p>
</div>

<div class="section">
  <h2>دراسة حالة: مشروع أبحر — تطبيق واقعي لنموذج الإحياء</h2>
  <table>
    <tr><th>البند</th><th>القيمة</th></tr>
    <tr><td>رخصة البناء</td><td>4400063835</td></tr>
    <tr><td>الموقع</td><td>أبحر الشمالية، جدة</td></tr>
    <tr><td>مساحة الأرض</td><td>1,190.90 م²</td></tr>
    <tr><td>المساحة المبنية</td><td>4,250.69 م²</td></tr>
    <tr><td>الوحدات السكنية</td><td>18 وحدة</td></tr>
    <tr><td>الفلل</td><td>2 فيلا</td></tr>
    <tr><td>غرف الخدمة</td><td>18 غرفة</td></tr>
    <tr><td>المواقف</td><td>20 موقف</td></tr>
    <tr><td>نسبة الإنجاز الحالية</td><td>~20%</td></tr>
    <tr><td>إجمالي التكلفة التقديرية</td><td>7,252,000 ريال</td></tr>
    <tr><td>إجمالي الإيرادات المتوقعة</td><td>11,000,000 ريال</td></tr>
    <tr><td>صافي الربح قبل التقاسم</td><td>3,748,000 ريال</td></tr>
    <tr><td>نصيب الشركة (50% محاصة)</td><td>1,874,000 ريال</td></tr>
    <tr><td>فترة الاسترداد</td><td>6–8 أشهر</td></tr>
  </table>
  <p>مشروع أبحر يُثبت جدوى النموذج على أرض الواقع. بتكلفة ~7.25 مليون ريال وإيرادات ~11 مليون ريال، يحقق المشروع هامش ربح ~34% وعائد رأس مال ~26% للشركة.</p>
</div>

<div style="text-align: center; margin-top: 2rem; color: #666; font-size: .9rem;">
  www.bonds-global.com | © Bonds Global 2026
</div>

</div>
</body>
</html>
'''
    
    output_path = r'C:\Users\vip\bonds-global-web\reports\distressed-recovery-feasibility-study-vaccinated-ar.html'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Wrote: {output_path}')

if __name__ == '__main__':
    build_arabic_html()
