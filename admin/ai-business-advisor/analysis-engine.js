/**
 * AI Business Advisor — Analysis Engine
 * Rule-based business intelligence and recommendations (Arabic).
 */
(function (root) {
  'use strict';

  const FINANCING_SOLUTIONS = {
    real_estate: [
      { name: 'إعادة تمويل عقاري', desc: 'استثمار رأس المال المرتفع وإعادة التمويل بسعر فائدة منافس.', when: 'original_value > 500000 && status in identified/valuation/planning' },
      { name: 'بيع سريع للأصل', desc: 'تصفية الأصل لتحسين السيولة وتقليل التعثر.', when: 'distress_score > 70' }
    ],
    equipment: [
      { name: 'تأجير تمويلي', desc: 'تحويل المعدات إلى مصدر تدفق نقدي بدلاً من تكلفة ثابتة.', when: 'status in planning/active_rescue' },
      { name: 'Sale-and-leaseback', desc: 'بيع المعدات واستئجارها مرة أخرى لتحرير السيولة.', when: 'original_value > 100000' }
    ],
    vehicle: [
      { name: 'تأجير المركبات', desc: 'توليد إيرادات تشغيلية من المركبات المتعثرة.', when: 'status in identified/valuation' },
      { name: 'بيع المركبات', desc: 'تصفية سريعة لتحسين الوضع المالي.', when: 'distress_score > 60' }
    ],
    inventory: [
      { name: 'تصفية مخزون', desc: 'بيع المخزون بخصومات تكتيكية لاستعادة السيولة.', when: 'status in identified/valuation/planning' },
      { name: 'قرض ضد المخزون', desc: 'استخدام المخزون كضمان للحصول على تمويل قصير الأجل.', when: 'original_value > 50000' }
    ],
    receivable: [
      { name: 'الفوترة (Factoring)', desc: 'بيع الذمم المدينة لتحصل فوري على النقد.', when: 'original_value > 20000' }
    ],
    investment: [
      { name: 'إعادة هيكلة المحفظة', desc: 'إعادة تقييم الأصول وإعادة التوزيع حسب المخاطر.', when: 'always' }
    ],
    other: [
      { name: 'تقييم أولي وتصفية', desc: 'إجراء تقييم سريع ثم اتخاذ قرار التصفية أو الإنقاذ.', when: 'always' }
    ]
  };

  function pctChange(current, previous) {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  }

  function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function trendDirection(values) {
    if (values.length < 2) return 'stable';
    const firstHalf = avg(values.slice(0, Math.floor(values.length / 2)));
    const secondHalf = avg(values.slice(Math.floor(values.length / 2)));
    const change = pctChange(secondHalf, firstHalf);
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  }

  function calculateDistressScore(asset) {
    let score = 0;
    const original = Number(asset.original_value) || 0;
    const distressed = Number(asset.distressed_value) || 0;
    if (original > 0) {
      score += Math.min(50, ((original - distressed) / original) * 100);
    }
    if (asset.status === 'active_rescue') score += 15;
    if (asset.status === 'restructuring') score += 20;
    if (asset.status === 'write_off') score += 40;
    if (asset.priority === 'high') score += 10;
    if (asset.priority === 'critical') score += 20;
    return Math.min(100, Math.round(score));
  }

  function opportunityScore(asset) {
    const original = Number(asset.original_value) || 0;
    const distressed = Number(asset.distressed_value) || 0;
    let upside = 0;
    if (original > 0) upside = ((original - distressed) / original) * 100;
    let score = Math.min(60, upside);
    if (['identified','valuation','planning'].includes(asset.status)) score += 20;
    if (asset.priority === 'high') score += 10;
    if (asset.priority === 'critical') score += 15;
    return Math.min(100, Math.round(score));
  }

  function analyzeFinancials(stats, settings) {
    const revenueTrend = trendDirection(stats.revenueByMonth);
    const clientTrend = trendDirection(stats.clientsByMonth);
    const margin = settings?.margin || 0.65;
    const fixedCosts = settings?.fixedCosts || 0;
    const monthlyFixed = fixedCosts / 12;
    const profitEstimate = stats.totalRevenue * margin - fixedCosts;
    const netCashFlow = stats.mrr - monthlyFixed;
    const runwayMonths = monthlyFixed > 0 && netCashFlow < 0 ? Math.floor(stats.totalRevenue / Math.abs(netCashFlow)) : 999;

    let healthScore = 50;
    if (revenueTrend === 'up') healthScore += 20;
    if (revenueTrend === 'down') healthScore -= 20;
    if (clientTrend === 'up') healthScore += 15;
    if (clientTrend === 'down') healthScore -= 15;
    if (netCashFlow > 0) healthScore += 15;
    else healthScore -= 15;
    if (stats.activeProjectsCount > 0) healthScore += 5;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const flags = [];
    if (revenueTrend === 'down') flags.push({ type: 'warning', text: 'تراجع الإيرادات خلال الأشهر الأخيرة.' });
    if (netCashFlow < 0) flags.push({ type: 'danger', text: `التدفق النقدي الشهري سلبي بقيمة ${Math.round(Math.abs(netCashFlow)).toLocaleString('ar-SA')} ر.س.` });
    if (runwayMonths < 6 && netCashFlow < 0) flags.push({ type: 'danger', text: `مدى السيولة المتبقي أقل من 6 أشهر (${runwayMonths === 999 ? '—' : runwayMonths + ' شهر'}).` });
    if (stats.distressedProjectsCount > 0) flags.push({ type: 'warning', text: `يوجد ${stats.distressedProjectsCount} مشروع متعثر.` });

    return {
      healthScore,
      healthLabel: healthScore >= 70 ? 'جيدة' : healthScore >= 45 ? 'متوسطة' : 'تحتاج انتباه',
      revenueTrend,
      clientTrend,
      profitEstimate,
      netCashFlow,
      runwayMonths,
      flags
    };
  }

  function analyzeOpportunities(assets) {
    return assets.map(a => {
      const score = opportunityScore(a);
      const upside = (Number(a.original_value) || 0) - (Number(a.distressed_value) || 0);
      let recommendation = 'مراجعة الأصل وإجراء تقييم مبدئي.';
      if (score >= 70) recommendation = 'فرصة قوية: الأصل يحمل هامش ربح مرتفع، يُنصح بالتحرك السريع.';
      else if (score >= 45) recommendation = 'فرصة متوسطة: يتطلب تحليلاً أعمق قبل اتخاذ القرار.';
      else recommendation = 'فرصة ضعيفة أو تحتاج إلى إعادة هيكلة.';

      return { ...a, score, upside, recommendation };
    }).sort((a, b) => b.score - a.score);
  }

  function assessRisks(stats, projects, assets) {
    const risks = [];

    const criticalAssets = assets.filter(a => a.priority === 'critical' && !['recovered','liquidated'].includes(a.status));
    if (criticalAssets.length) {
      risks.push({ level: 'high', title: 'أصول حرجة متعثرة', text: `${criticalAssets.length} أصل بأولوية حرجة تحتاج تدخلاً فورياً.`, items: criticalAssets });
    }

    const distressedProjects = projects.filter(p => ['on_hold','cancelled'].includes(p.status));
    if (distressedProjects.length) {
      const value = distressedProjects.reduce((s, p) => s + (Number(p.budget) || 0), 0);
      risks.push({ level: 'medium', title: 'مشاريع متعثرة', text: `${distressedProjects.length} مشروع متعثر بقيمة إجمالية ${Math.round(value).toLocaleString('ar-SA')} ر.س.`, items: distressedProjects });
    }

    const negativeCashMonths = stats.revenueByMonth.filter((r, i) => {
      const net = r * (stats.settings?.margin || 0.65) - (stats.settings?.fixedCosts || 0) / 12;
      return net < 0;
    }).length;
    if (negativeCashMonths >= 3) {
      risks.push({ level: 'high', title: 'ضغط نقدي متكرر', text: `شهدت ${negativeCashMonths} أشهر من آخر 12 شهراً تدفقاً نقدياً سلبياً.` });
    }

    const decliningRevenue = trendDirection(stats.revenueByMonth) === 'down';
    if (decliningRevenue) {
      risks.push({ level: 'high', title: 'تراجع الإيرادات', text: 'متوسط الإيرادات في النصف الأخير أقل من النصف الأول.' });
    }

    let riskLevel = 'low';
    if (risks.some(r => r.level === 'high')) riskLevel = 'high';
    else if (risks.some(r => r.level === 'medium')) riskLevel = 'medium';

    return { riskLevel, risks };
  }

  function suggestFinancing(opportunities, risks, stats) {
    const suggestions = [];

    // General liquidity risk
    const netCashFlow = stats.mrr - ((stats.settings?.fixedCosts || 0) / 12);
    if (netCashFlow < 0) {
      suggestions.push({
        title: 'تمويل العمليات/السيولة',
        type: 'عمليات',
        desc: 'النقدية الشهرية لا تغطي التكاليف. يُنصح بخط ائتمان قصير الأجل أو قرض سيولة.',
        impact: 'يغطي العجز الشهري ويمنع توقف العمليات.',
        urgency: 'عالية'
      });
    }

    // Per top opportunity
    opportunities.slice(0, 5).forEach(opp => {
      const solutions = FINANCING_SOLUTIONS[opp.category] || FINANCING_SOLUTIONS.other;
      const distress = calculateDistressScore(opp);
      solutions.forEach(sol => {
        if (sol.when.includes('always') || (sol.when.includes('distress_score') && distress > 60) || (sol.when.includes('original_value') && opp.original_value > 100000) || (sol.when.includes('status') && ['identified','valuation','planning','active_rescue'].some(st => sol.when.includes(st) && opp.status === st))) {
          suggestions.push({
            title: sol.name,
            type: 'أصل: ' + (opp.name || '—'),
            desc: sol.desc,
            impact: `الأصل ${opp.name} يحتمل تحرير ${Math.round(opp.upside || 0).toLocaleString('ar-SA')} ر.س من القيمة.`,
            urgency: opp.priority === 'critical' ? 'عالية' : opp.priority === 'high' ? 'متوسطة' : 'منخفضة'
          });
        }
      });
    });

    // Distressed projects
    if (risks.some(r => r.title === 'مشاريع متعثرة')) {
      suggestions.push({
        title: 'إعادة هيكلة المشاريع',
        type: 'مشروع',
        desc: 'إعادة تقييم نطاق المشاريع المتعثرة وتمويل المراحل الحرجة فقط.',
        impact: 'تقليل الخسائر وتحويل المشاريع إلى نشطة.',
        urgency: 'متوسطة'
      });
    }

    // Revenue growth
    if (trendDirection(stats.revenueByMonth) === 'up' && stats.mrr > 0) {
      suggestions.push({
        title: 'تمويل النمو',
        type: 'نمو',
        desc: 'الإيرادات في اتجاه صاعد؛ يمكن استخدام التمويل لتسريق التسويق والتوسع.',
        impact: 'زيادة معدل اكتساب العملاء والإيرادات.',
        urgency: 'منخفضة'
      });
    }

    return suggestions.slice(0, 8);
  }

  function analyzeDistressed(projects, assets) {
    const projectItems = projects.filter(p => ['on_hold','cancelled'].includes(p.status)).map(p => ({
      type: 'project',
      name: p.name,
      status: p.status,
      value: Number(p.budget) || 0,
      client: p.advisory_clients?.name || '—',
      action: p.status === 'cancelled' ? 'مراجعة أسباب الإلغاء واستخلاص الدروس.' : 'تحديد نقاط التوقف وتوفير تمويل/موارد لاستئناف العمل.'
    }));

    const assetItems = assets.filter(a => ['active_rescue','restructuring','write_off','identified','valuation','planning'].includes(a.status)).map(a => {
      const score = calculateDistressScore(a);
      return {
        type: 'asset',
        name: a.name,
        status: a.status,
        value: Number(a.distressed_value) || 0,
        category: a.category,
        priority: a.priority,
        distressScore: score,
        action: score > 70 ? 'التصفية أو البيع السريع.' : score > 40 ? 'إعادة هيكلة أو إنقاذ نشط.' : 'مراقبة وتقييم دوري.'
      };
    }).sort((a, b) => b.distressScore - a.distressScore);

    return { projects: projectItems, assets: assetItems };
  }

  function generateManagementReport(data) {
    const { stats, settings, financial, opportunities, risks, financing, distressed } = data;
    const now = new Date().toLocaleString('ar-SA');

    let report = `
      <div class="ai-report">
        <h1>تقرير الإدارة العليا — مستشار الأعمال الذكي</h1>
        <p class="ai-report-meta">تاريخ التقرير: ${now}</p>

        <section>
          <h2>1. ملخص الوضع المالي</h2>
          <ul>
            <li><strong>إجمالي الإيرادات المتكررة:</strong> ${Math.round(stats.totalRevenue).toLocaleString('ar-SA')} ر.س</li>
            <li><strong>صافي الربح المقدر:</strong> ${Math.round(financial.profitEstimate).toLocaleString('ar-SA')} ر.س</li>
            <li><strong>التدفق النقدي الشهري:</strong> ${Math.round(financial.netCashFlow).toLocaleString('ar-SA')} ر.س</li>
            <li><strong>مستوى الصحة المالية:</strong> ${financial.healthLabel} (${financial.healthScore}/100)</li>
          </ul>
          ${financial.flags.length ? '<h3>⚠️ تنبيهات:</h3><ul>' + financial.flags.map(f => `<li>${f.text}</li>`).join('') + '</ul>' : ''}
        </section>

        <section>
          <h2>2. الفرص الاستثمارية الموصى بها</h2>
          ${opportunities.slice(0, 5).map(o => `
            <div class="ai-report-item">
              <strong>${o.name}</strong> — درجة الفرصة: ${o.score}/100<br/>
              <small>القيمة الأصلية: ${Math.round(o.original_value).toLocaleString('ar-SA')} ر.س | القيمة المتعثرة: ${Math.round(o.distressed_value).toLocaleString('ar-SA')} ر.س | هامش الربح المحتمل: ${Math.round(o.upside).toLocaleString('ar-SA')} ر.س</small><br/>
              <em>${o.recommendation}</em>
            </div>
          `).join('')}
        </section>

        <section>
          <h2>3. تقييم المخاطر</h2>
          <p><strong>مستوى المخاطر العام:</strong> ${risks.riskLevel === 'high' ? 'مرتفع' : risks.riskLevel === 'medium' ? 'متوسط' : 'منخفض'}</p>
          ${risks.risks.map(r => `
            <div class="ai-report-item ${r.level}">
              <strong>${r.title}</strong><br/>
              <small>${r.text}</small>
            </div>
          `).join('')}
        </section>

        <section>
          <h2>4. الحلول التمويلية المقترحة</h2>
          ${financing.slice(0, 5).map(f => `
            <div class="ai-report-item">
              <strong>${f.title}</strong> <span class="ai-tag">${f.urgency}</span><br/>
              <small>${f.type}</small><br/>
              ${f.desc}<br/>
              <em>التأثير المتوقع: ${f.impact}</em>
            </div>
          `).join('')}
        </section>

        <section>
          <h2>5. الأصول والمشاريع المتعثرة</h2>
          ${distressed.assets.slice(0, 5).map(a => `
            <div class="ai-report-item">
              <strong>${a.name}</strong> — درجة التعثر: ${a.distressScore}/100<br/>
              <small>الفئة: ${a.category} | الأولوية: ${a.priority}</small><br/>
              <em>الإجراء المقترح: ${a.action}</em>
            </div>
          `).join('')}
          ${distressed.projects.slice(0, 3).map(p => `
            <div class="ai-report-item">
              <strong>${p.name}</strong> — ${p.status === 'cancelled' ? 'ملغى' : 'معلق'}<br/>
              <small>العميل: ${p.client} | الميزانية: ${Math.round(p.value).toLocaleString('ar-SA')} ر.س</small><br/>
              <em>الإجراء المقترح: ${p.action}</em>
            </div>
          `).join('')}
        </section>

        <section>
          <h2>6. توصيات الإدارة العليا</h2>
          <ul>
            <li>مراجعة الأصول ذات الأولوية الحرجة أولاً لتقليل الخسائر.</li>
            <li>تحويل المشاريع المتعثرة إلى خطط إنقاذ واضحة مع تخصيص تمويل.</li>
            <li>متابعة التدفق النقدي الشهري والتحرك مبكراً عند أي عجز.</li>
            <li>استغلال الفرص الاستثمارية ذات الدرجات العالية لتحقيق مكاسب سريعة.</li>
          </ul>
        </section>
      </div>
    `;
    return report;
  }

  root.AiAnalysisEngine = {
    analyzeFinancials,
    analyzeOpportunities,
    assessRisks,
    suggestFinancing,
    analyzeDistressed,
    generateManagementReport,
    calculateDistressScore,
    opportunityScore,
    trendDirection
  };
})(window);
