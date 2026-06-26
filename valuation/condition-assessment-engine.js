/**
 * BONDS Condition Assessment Engine (CAE)
 *
 * Converts a detailed inspection checklist (120+ points across 35 asset classes)
 * into a normalized 0-100 Condition Score, grade, category scores and valuation
 * inputs that feed back into ValuationEngine and DepreciationEngine.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BondsConditionAssessmentEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  function getEmbeddedStandards(assetClass) {
    const S = (typeof BondsConditionStandards !== 'undefined') ? BondsConditionStandards : null;
    if (S && typeof S.resolveStandards === 'function') {
      return S.resolveStandards(assetClass);
    }
    if (S && S.ASSET_STANDARDS) {
      return S.ASSET_STANDARDS[assetClass] || null;
    }
    return null;
  }

  function getStandards(assetClass, provided) {
    if (provided && provided.assetClass === assetClass) return provided;
    if (provided && provided.inspection_points) {
      return {
        assetClass,
        nameAr: provided.nameAr || provided.name_ar || '',
        nameEn: provided.nameEn || provided.name_en || '',
        points: Array.isArray(provided.inspection_points) ? provided.inspection_points : [],
        gradingScale: provided.gradingScale || provided.grading_scale || { A: 90, B: 80, C: 70, D: 60, E: 0 },
        criticalCap: provided.criticalCap || 60
      };
    }
    return getEmbeddedStandards(assetClass);
  }

  function normalizeValue(point, value) {
    if (value === undefined || value === null || value === '') return null;
    const type = point.type || '0-5';

    if (type === '0-5') {
      return clamp(Number(value), 0, 5) / 5 * 100;
    }
    if (type === '0-10') {
      return clamp(Number(value), 0, 10) / 10 * 100;
    }
    if (type === 'yes/no' || type === 'pass/fail') {
      if (typeof value === 'boolean') return value ? 100 : 0;
      const s = String(value).toLowerCase().trim();
      if (['yes', 'pass', 'true', '1', 'y'].includes(s)) return 100;
      return 0;
    }
    if (type === 'numeric') {
      return clamp(Number(value), 0, 100);
    }
    return clamp(Number(value), 0, 100);
  }

  function getGrade(score, gradingScale) {
    const scale = gradingScale || { A: 90, B: 80, C: 70, D: 60, E: 0 };
    if (score >= scale.A) return 'A';
    if (score >= scale.B) return 'B';
    if (score >= scale.C) return 'C';
    if (score >= scale.D) return 'D';
    return 'E';
  }

  function calculate(assetClass, answers, options) {
    answers = answers || {};
    options = options || {};

    const standards = getStandards(assetClass, options.standards);
    if (!standards || !Array.isArray(standards.points) || standards.points.length === 0) {
      return {
        assetClass,
        score: 0,
        grade: 'E',
        confidenceScore: 0,
        answeredCount: 0,
        totalCount: 0,
        categoryScores: {},
        criticalFailures: [],
        capped: false,
        valuationInputs: toValuationInputs({ score: 0, categoryScores: {} }),
        error: 'No condition assessment standards found for asset class: ' + assetClass
      };
    }

    const points = standards.points;
    const gradingScale = standards.gradingScale || { A: 90, B: 80, C: 70, D: 60, E: 0 };
    const criticalCap = standards.criticalCap || 60;

    let weightedSum = 0;
    let totalWeight = 0;
    let answeredCount = 0;
    const categoryTotals = {};
    const criticalFailures = [];

    points.forEach(point => {
      const raw = answers[point.id];
      const normalized = normalizeValue(point, raw);
      if (normalized === null) return;

      answeredCount++;
      const weight = Number(point.weight) || 0;
      weightedSum += normalized * weight;
      totalWeight += weight;

      const cat = categoryTotals[point.category] || { sum: 0, weight: 0 };
      cat.sum += normalized * weight;
      cat.weight += weight;
      categoryTotals[point.category] = cat;

      if (point.critical && normalized < 60) {
        criticalFailures.push({ id: point.id, labelAr: point.labelAr, labelEn: point.labelEn, score: round2(normalized) });
      }
    });

    let score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    let capped = false;
    if (criticalFailures.length > 0) {
      score = Math.min(score, criticalCap);
      capped = true;
    }
    score = round2(clamp(score, 0, 100));

    const categoryScores = {};
    Object.keys(categoryTotals).forEach(cat => {
      const c = categoryTotals[cat];
      categoryScores[cat] = {
        score: c.weight > 0 ? round2(c.sum / c.weight) : 0,
        weight: round2(c.weight)
      };
    });

    const totalCount = points.length;
    const confidenceScore = totalCount > 0 ? round2((answeredCount / totalCount) * 100) : 0;
    const grade = getGrade(score, gradingScale);

    const result = {
      assetClass,
      score,
      grade,
      confidenceScore,
      answeredCount,
      totalCount,
      categoryScores,
      criticalFailures,
      capped,
      standardsMeta: {
        nameAr: standards.nameAr,
        nameEn: standards.nameEn,
        gradingScale,
        criticalCap
      }
    };

    result.valuationInputs = toValuationInputs(result);
    return result;
  }

  function toValuationInputs(result) {
    const score = result && result.score || 0;
    const cat = result && result.categoryScores || {};

    const maintenanceScore = cat.maintenance ? cat.maintenance.score : score;
    const technologyScore = cat.technology ? cat.technology.score : 100;
    const environmentalScore = cat.environmental ? cat.environmental.score : 100;
    const operationalScore = cat.operational ? cat.operational.score : score;

    const conditionScore1to10 = Math.max(1, Math.min(10, Math.round(score / 10)));
    const maintenanceLevel = Math.max(1, Math.min(10, Math.round(maintenanceScore / 10)));
    const inspectionScore = conditionScore1to10;

    return {
      conditionScore: conditionScore1to10,
      maintenanceLevel,
      inspectionScore,
      functionalObsolescence: round2(clamp((100 - technologyScore) / 100, 0, 1)),
      techObsolescenceRate: round2(clamp((100 - technologyScore) / 100, 0, 1)),
      maintenanceNeglect: round2(clamp((100 - maintenanceScore) / 100, 0, 1)),
      environmentalExposure: round2(clamp((100 - environmentalScore) / 100, 0, 1)),
      misuseFactor: round2(clamp((100 - operationalScore) / 100 * 0.5, 0, 1))
    };
  }

  function getGradeLabel(grade, lang) {
    const labels = {
      ar: { A: 'ممتاز', B: 'جيد جداً', C: 'جيد', D: 'مقبول', E: 'ضعيف' },
      en: { A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Fair', E: 'Poor' }
    };
    const dict = labels[lang === 'en' ? 'en' : 'ar'] || labels.ar;
    return dict[grade] || grade;
  }

  const DEFAULT_MAINTENANCE_ACTIONS = {
    structural: { ar: 'فحص هيكلي شامل وإصلاح الشروخ أو الضعف', en: 'Comprehensive structural inspection and repair cracks or weaknesses' },
    mechanical: { ar: 'صيانة المعدات الميكانيكية وتبديل القطع التالفة', en: 'Maintain mechanical equipment and replace damaged parts' },
    electrical: { ar: 'مراجعة أنظمة الكهرباء وتوصيلات الأمان', en: 'Review electrical systems and safety connections' },
    safety: { ar: 'تصحيح مخالفات السلامة وتحديث إجراءات الطوارئ', en: 'Correct safety violations and update emergency procedures' },
    environmental: { ar: 'معالجة التلوث والمخاطر البيئية', en: 'Treat pollution and environmental hazards' },
    maintenance: { ar: 'تحسين خطة الصيانة الدورية وتسجيل الأعطال', en: 'Improve periodic maintenance plan and log failures' },
    operational: { ar: 'مراجعة الإجراءات التشغيلية وتدريب الفرق', en: 'Review operational procedures and train teams' },
    aesthetic: { ar: 'إعادة تأهيل المظهر والطلاء/التشطيبات', en: 'Rehabilitate appearance, paint and finishes' },
    documentation: { ar: 'إكمال المستندات الفنية والشهادات', en: 'Complete technical documents and certificates' },
    technology: { ar: 'تحديث الأنظمة التقنية والبرمجيات', en: 'Update technology systems and software' }
  };

  function generateMaintenancePlan(result, options) {
    options = options || {};
    const lang = options.lang || 'ar';
    const isEn = lang === 'en';
    const scoreThreshold = options.scoreThreshold || 60;
    const tasks = [];

    (result.criticalFailures || []).forEach(f => {
      tasks.push({
        priority: 'high',
        source: 'critical',
        labelAr: f.labelAr || '',
        labelEn: f.labelEn || '',
        category: '',
        actionAr: `معالجة الإخفاق الحرج: ${f.labelAr || ''}`,
        actionEn: `Address critical failure: ${f.labelEn || ''}`
      });
    });

    Object.entries(result.categoryScores || {}).forEach(([cat, data]) => {
      if (data.score < scoreThreshold) {
        const action = DEFAULT_MAINTENANCE_ACTIONS[cat] || { ar: 'مراجعة وتحسين', en: 'Review and improve' };
        tasks.push({
          priority: result.criticalFailures && result.criticalFailures.length > 0 ? 'medium' : 'high',
          source: 'category',
          category: cat,
          score: data.score,
          actionAr: action.ar,
          actionEn: action.en
        });
      }
    });

    if (tasks.length === 0 && result.score < scoreThreshold) {
      tasks.push({
        priority: 'medium',
        source: 'overall',
        category: '',
        actionAr: 'إجراء فحص عام وتحسين الحالة العامة للأصل',
        actionEn: 'Perform general inspection and improve overall asset condition'
      });
    }

    return tasks.sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return (rank[a.priority] || 0) - (rank[b.priority] || 0);
    });
  }

  function generateReport(result, lang) {
    lang = lang || 'ar';
    const isEn = lang === 'en';
    const t = isEn ? {
      title: 'Condition Assessment Report',
      score: 'Condition Score',
      grade: 'Grade',
      confidence: 'Confidence',
      categories: 'Category Scores',
      critical: 'Critical Failures',
      none: 'None',
      capped: 'Score capped due to critical failure(s).',
      valuationInputs: 'Valuation Inputs'
    } : {
      title: 'تقرير تقييم الحالة',
      score: 'درجة الحالة',
      grade: 'التقدير',
      confidence: 'الثقة',
      categories: 'درجات الفئات',
      critical: 'إخفاقات حرجة',
      none: 'لا يوجد',
      capped: 'تم تقصير الدرجة بسبب إخفاقات حرجة.',
      valuationInputs: 'مدخلات التقييم'
    };

    let html = `<div class="ca-report"><h4>${t.title}</h4>`;
    html += `<p><strong>${t.score}:</strong> ${result.score}/100 &nbsp;|&nbsp; <strong>${t.grade}:</strong> ${result.grade} (${getGradeLabel(result.grade, lang)})</p>`;
    html += `<p><strong>${t.confidence}:</strong> ${result.confidenceScore}% (${result.answeredCount}/${result.totalCount})</p>`;
    if (result.capped) html += `<p class="ca-capped">⚠ ${t.capped}</p>`;

    html += `<h5>${t.categories}</h5><ul>`;
    Object.entries(result.categoryScores).forEach(([cat, data]) => {
      html += `<li>${cat}: ${data.score}</li>`;
    });
    html += '</ul>';

    html += `<h5>${t.critical}</h5>`;
    if (result.criticalFailures.length === 0) {
      html += `<p>${t.none}</p>`;
    } else {
      html += '<ul>';
      result.criticalFailures.forEach(f => {
        const label = isEn ? f.labelEn : f.labelAr;
        html += `<li>${label}: ${f.score}</li>`;
      });
      html += '</ul>';
    }

    html += `<h5>${t.valuationInputs}</h5><pre>${JSON.stringify(result.valuationInputs, null, 2)}</pre>`;
    html += '</div>';
    return html;
  }

  return {
    getStandards,
    getEmbeddedStandards,
    calculate,
    toValuationInputs,
    getGrade,
    getGradeLabel,
    generateReport,
    generateMaintenancePlan,
    normalizeValue,
    version: '1.0.0'
  };
}));
