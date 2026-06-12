// Minimal Pro SaaS engine: project feasibility + AI-style report

function calculateProject({ sector, activity, capital, revenue, growthRate = 0.04, cogsRate = 0.45, operatingRate = 0.20 }) {
  const cogs = revenue * cogsRate;
  const operating = revenue * operatingRate;
  const monthlyProfit = revenue - cogs - operating;
  const annualProfit = monthlyProfit * 12;
  const roiMonths = monthlyProfit > 0 ? capital / monthlyProfit : Infinity;
  const roiYears = roiMonths === Infinity ? Infinity : roiMonths / 12;
  const breakEvenRevenue = monthlyProfit > 0 ? (operating * 12) / (1 - cogsRate - operatingRate) : Infinity;
  const score = Math.min(100, Math.max(0, Math.round(
    (monthlyProfit > 0 ? 40 : 0) +
    (roiMonths <= 24 ? 25 : roiMonths <= 48 ? 15 : 0) +
    (revenue / Math.max(capital, 1) > 0.5 ? 15 : 8) +
    (growthRate >= 0.05 ? 10 : 5) +
    10
  )));

  const sectorMultipliers = {
    medical: { label: 'طبي / صحي', growth: 1.05, risk: 'متوسط' },
    restaurant: { label: 'مطعم / مقهى', growth: 1.03, risk: 'مرتفع' },
    retail: { label: 'تجارة retail', growth: 1.04, risk: 'متوسط' },
    tech: { label: 'تقنية / SaaS', growth: 1.08, risk: 'مرتفع' },
    real_estate: { label: 'عقارات', growth: 1.02, risk: 'منخفض' },
    education: { label: 'تعليم / تدريب', growth: 1.04, risk: 'متوسط' },
    logistics: { label: 'خدمات لوجستية', growth: 1.05, risk: 'متوسط' },
    beauty: { label: 'تجميل / عناية', growth: 1.06, risk: 'متوسط' },
    fitness: { label: 'رياضة / لياقة', growth: 1.04, risk: 'مرتفع' },
    manufacturing: { label: 'تصنيع', growth: 1.03, risk: 'مرتفع' }
  };
  const meta = sectorMultipliers[sector] || { label: sector, growth: 1.04, risk: 'متوسط' };

  return {
    sector,
    activity,
    capital,
    revenue,
    growthRate,
    cogsRate,
    operatingRate,
    cogs,
    operating,
    monthlyProfit,
    annualProfit,
    roiMonths: roiMonths === Infinity ? -1 : Math.round(roiMonths * 10) / 10,
    roiYears: roiYears === Infinity ? -1 : Math.round(roiYears * 10) / 10,
    breakEvenRevenue: breakEvenRevenue === Infinity ? -1 : Math.round(breakEvenRevenue),
    score,
    sectorLabel: meta.label,
    sectorRisk: meta.risk,
    sectorGrowth: meta.growth
  };
}

function aiInsight(result) {
  const { monthlyProfit, score, roiMonths, sectorLabel, sectorRisk } = result;
  const verdict = score >= 75 ? 'موصى به بقوة' : score >= 50 ? 'مشروع واعد مع ملاحظات' : 'يحتاج مراجعة قبل الاستثمار';
  const summary = `دراسة الجدوى لنشاط ${sectorLabel} تشير إلى ${monthlyProfit > 0 ? 'ربحية شهرية إيجابية' : 'تحديات ربحية واضحة'} بدرجة جدوى ${score}/100. مخاطر القطاع: ${sectorRisk}.`;
  const recommendations = [];
  if (score < 60) {
    recommendations.push('خفض رأس المال الثابت أو التفاوض على تكاليف التأسيس.');
    recommendations.push('زيادة الإيرادات المتوقعة عبر تنويع مصادر الدخل.');
  }
  if (roiMonths > 36) recommendations.push('مدة الاسترداد أطول من المثالي؛ راجع خطة التدفق النقدي.');
  if (sectorRisk === 'مرتفع') recommendations.push('قطاع عالي المخاطر؛ ابدأ بنموذج تشغيلي صغير واختبر السوق.');
  if (monthlyProfit <= 0) recommendations.push('النموذج الحالي غير ربحي؛ أعد دراسة التكاليف والتسعير.');
  if (recommendations.length === 0) {
    recommendations.push('المشروع جاهز للتنفيذ؛ ابدأ بإجراءات الترخيص والموقع.');
    recommendations.push('راقب مؤشرات الأداء الشهرية خلال الربع الأول.');
  }
  return { verdict, summary, recommendations };
}

function buildHTMLReport(result, insight) {
  const fmt = n => typeof n === 'number' ? n.toLocaleString('ar-SA') : n;
  const profitClass = result.monthlyProfit >= 0 ? 'positive' : 'negative';
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير جدوى Bonds Pro</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 40px; background: #f6f7f9; color: #1a1a1a; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; padding: 48px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    h1 { color: #0a1f44; margin-bottom: 8px; }
    .subtitle { color: #6b7280; margin-bottom: 32px; }
    .score { font-size: 64px; font-weight: 800; color: #d4a853; }
    .score-label { color: #6b7280; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .card h3 { margin: 0 0 8px; font-size: 14px; color: #6b7280; }
    .card .value { font-size: 24px; font-weight: 700; color: #0a1f44; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    .verdict { background: #0a1f44; color: #fff; padding: 20px; border-radius: 12px; margin: 24px 0; }
    .verdict h2 { margin: 0 0 8px; color: #f0c96a; }
    ul { padding-right: 20px; }
    li { margin-bottom: 8px; }
    .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; }
    @media print { body { background: #fff; } .page { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="page">
    <h1>تقرير جدوى احترافي</h1>
    <p class="subtitle">Bonds Pro · ${result.sectorLabel} · ${result.activity}</p>
    <div class="score">${result.score}<span style="font-size:24px;color:#9ca3af">/100</span></div>
    <div class="score-label">درجة جاهزية المشروع</div>
    <div class="grid">
      <div class="card"><h3>رأس المال</h3><div class="value">${fmt(result.capital)} ر.س</div></div>
      <div class="card"><h3>الإيرادات الشهرية المتوقعة</h3><div class="value">${fmt(result.revenue)} ر.س</div></div>
      <div class="card"><h3>الربح الشهري المتوقع</h3><div class="value ${profitClass}">${fmt(Math.round(result.monthlyProfit))} ر.س</div></div>
      <div class="card"><h3>مدة الاسترداد</h3><div class="value">${result.roiMonths > 0 ? result.roiMonths + ' شهر' : 'غير محدود'}</div></div>
      <div class="card"><h3>الربح السنوي المتوقع</h3><div class="value">${fmt(Math.round(result.annualProfit))} ر.س</div></div>
      <div class="card"><h3>مخاطر القطاع</h3><div class="value">${result.sectorRisk}</div></div>
    </div>
    <div class="verdict">
      <h2>${insight.verdict}</h2>
      <p>${insight.summary}</p>
    </div>
    <h2>التوصيات</h2>
    <ul>
      ${insight.recommendations.map(r => `<li>${r}</li>`).join('')}
    </ul>
    <div class="footer">تم إنشاء هذا التقرير بواسطة Bonds Pro · bonds-global.com</div>
  </div>
</body>
</html>`;
}

module.exports = { calculateProject, aiInsight, buildHTMLReport };
