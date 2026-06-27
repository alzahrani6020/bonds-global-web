/**
 * BONDS Risk Intelligence Engine
 *
 * Evaluates an asset across 8 risk dimensions and produces a normalized
 * Risk Index (0–100), per-category scores, critical risks, mitigations,
 * and valuation adjustments.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./risk-intelligence-standards.js'));
  } else {
    const standards = (typeof BondsRiskIntelligenceStandards !== 'undefined')
      ? BondsRiskIntelligenceStandards
      : null;
    root.BondsRiskIntelligenceEngine = factory(standards);
  }
}(typeof self !== 'undefined' ? self : this, function (Standards) {
  'use strict';

  const clamp = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const round4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;

  function getStandards(assetClass, provided) {
    if (provided && Array.isArray(provided.factors) && provided.categoryWeights) {
      return provided;
    }
    if (!Standards) {
      return null;
    }
    return {
      assetClass,
      factors: Standards.RISK_FACTORS || [],
      categories: Standards.CATEGORIES || [],
      categoryWeights: Standards.resolveCategoryWeights(assetClass)
    };
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
      // For risk factors, "yes" means the risk is present / control is missing.
      if (['yes', 'pass', 'true', '1', 'y'].includes(s)) return 100;
      return 0;
    }
    if (type === 'percent') {
      return clamp(Number(value) * 100, 0, 100);
    }
    if (type === 'numeric') {
      return clamp(Number(value), 0, 100);
    }
    return clamp(Number(value), 0, 100);
  }

  function getGrade(score) {
    const s = clamp(score, 0, 100);
    if (s <= 20) return 'A';
    if (s <= 40) return 'B';
    if (s <= 60) return 'C';
    if (s <= 80) return 'D';
    return 'E';
  }

  function getGradeLabel(grade, lang) {
    const labels = {
      ar: { A: 'منخفضة جداً', B: 'منخفضة', C: 'متوسطة', D: 'مرتفعة', E: 'مرتفعة جداً' },
      en: { A: 'Very Low', B: 'Low', C: 'Moderate', D: 'High', E: 'Very High' }
    };
    const dict = labels[lang === 'en' ? 'en' : 'ar'] || labels.ar;
    return dict[grade] || dict.E;
  }

  function getRiskLevel(score) {
    const s = clamp(score, 0, 100);
    if (s <= 20) return 'very-low';
    if (s <= 40) return 'low';
    if (s <= 60) return 'moderate';
    if (s <= 80) return 'high';
    return 'very-high';
  }

  function getRiskLevelLabel(level, lang) {
    const labels = {
      ar: {
        'very-low': 'مخاطر ضئيلة',
        'low': 'مخاطر منخفضة',
        'moderate': 'مخاطر متوسطة',
        'high': 'مخاطر مرتفعة',
        'very-high': 'مخاطر مرتفعة جداً'
      },
      en: {
        'very-low': 'Very low risk',
        'low': 'Low risk',
        'moderate': 'Moderate risk',
        'high': 'High risk',
        'very-high': 'Very high risk'
      }
    };
    const dict = labels[lang === 'en' ? 'en' : 'ar'] || labels.ar;
    return dict[level] || dict['very-high'];
  }

  function applyExternalData(categoryScores, externalData) {
    externalData = externalData || {};
    const adjusted = { ...categoryScores };

    // Condition Assessment integration
    const ca = externalData.conditionAssessment;
    if (ca) {
      let conditionRisk = 50;
      if (typeof ca.score === 'number') {
        conditionRisk = clamp(100 - ca.score, 0, 100);
      } else if (typeof ca.conditionScore === 'number') {
        // conditionScore is 1–10 where higher is better
        conditionRisk = clamp((10 - ca.conditionScore) / 9 * 100, 0, 100);
      }
      const asset = adjusted.asset || { score: 50 };
      adjusted.asset = {
        ...asset,
        score: round2(clamp(0.6 * (asset.score || 0) + 0.4 * conditionRisk, 0, 100)),
        conditionAdjustment: round2(conditionRisk)
      };
    }

    // Market Intelligence integration
    const md = externalData.marketData;
    if (md) {
      let marketRisk = 50;
      if (typeof md.riskScore === 'number') {
        marketRisk = clamp((md.riskScore - 1) / 9 * 100, 0, 100);
      }
      if (md.outlook) {
        const outlook = String(md.outlook).toLowerCase();
        if (outlook === 'positive') marketRisk = clamp(marketRisk - 10, 0, 100);
        if (outlook === 'negative') marketRisk = clamp(marketRisk + 10, 0, 100);
      }
      const market = adjusted.market || { score: 50 };
      adjusted.market = {
        ...market,
        score: round2(clamp(0.6 * (market.score || 0) + 0.4 * marketRisk, 0, 100)),
        marketAdjustment: round2(marketRisk)
      };
    }

    // Valuation inputs integration (technological obsolescence etc.)
    const vi = externalData.valuationInputs;
    if (vi) {
      const techObsolescence = clamp(vi.techObsolescenceRate || vi.functionalObsolescence || 0, 0, 1) * 100;
      if (techObsolescence > 0) {
        const tech = adjusted.technological || { score: 50 };
        adjusted.technological = {
          ...tech,
          score: round2(clamp(0.7 * (tech.score || 0) + 0.3 * techObsolescence, 0, 100)),
          valuationAdjustment: round2(techObsolescence)
        };
      }
      const envExposure = clamp(vi.environmentalExposure || 0, 0, 1) * 100;
      if (envExposure > 0) {
        const env = adjusted.environmental || { score: 50 };
        adjusted.environmental = {
          ...env,
          score: round2(clamp(0.7 * (env.score || 0) + 0.3 * envExposure, 0, 100)),
          valuationAdjustment: round2(envExposure)
        };
      }
    }

    return adjusted;
  }

  function calculate(assetClass, answers, options) {
    answers = answers || {};
    options = options || {};

    const standards = getStandards(assetClass, options.standards);
    if (!standards) {
      return {
        assetClass,
        riskIndex: 50,
        riskGrade: 'C',
        riskLevel: 'moderate',
        confidenceScore: 0,
        categoryScores: {},
        criticalRisks: [],
        topRisks: [],
        mitigations: [],
        valuationAdjustments: defaultAdjustments(50),
        success: false,
        error: 'No risk intelligence standards found for asset class: ' + assetClass
      };
    }

    const factors = standards.factors;
    const categoryWeights = standards.categoryWeights;
    const defaultRisk = 50;
    const criticalThreshold = 60;
    const criticalFloor = 60;

    const categoryStats = {};
    const answeredFactors = [];
    let answeredCount = 0;

    factors.forEach(point => {
      let raw = answers[point.id];
      if (raw === undefined || raw === null || raw === '') {
        raw = point.defaultValue;
      }
      const normalized = normalizeValue(point, raw);
      if (normalized === null) return;

      answeredCount++;
      const weight = Number(point.weight) || 1;
      const stat = categoryStats[point.category] || { sum: 0, weight: 0, highCritical: false };
      stat.sum += normalized * weight;
      stat.weight += weight;
      if (point.critical && normalized >= criticalThreshold) {
        stat.highCritical = true;
      }
      categoryStats[point.category] = stat;

      answeredFactors.push({
        id: point.id,
        category: point.category,
        labelAr: point.labelAr,
        labelEn: point.labelEn,
        score: round2(normalized),
        weight: round2(weight),
        critical: point.critical
      });
    });

    // Build category scores
    let categoryScores = {};
    Object.keys(categoryWeights).forEach(catId => {
      const stat = categoryStats[catId];
      let score = defaultRisk;
      if (stat && stat.weight > 0) {
        score = stat.sum / stat.weight;
        if (stat.highCritical) {
          score = Math.max(score, criticalFloor);
        }
      }
      const catMeta = Standards && Standards.getCategoryMeta
        ? Standards.getCategoryMeta(catId)
        : { labelAr: catId, labelEn: catId };
      categoryScores[catId] = {
        score: round2(clamp(score, 0, 100)),
        weight: round4(categoryWeights[catId] || 0),
        level: getRiskLevel(score),
        labelAr: catMeta.labelAr,
        labelEn: catMeta.labelEn
      };
    });

    // Apply external data adjustments
    categoryScores = applyExternalData(categoryScores, options.externalData);

    // Compute overall Risk Index
    let riskIndex = 0;
    Object.keys(categoryScores).forEach(catId => {
      riskIndex += (categoryScores[catId].score || 0) * (categoryScores[catId].weight || 0);
    });
    riskIndex = round2(clamp(riskIndex, 0, 100));

    const riskGrade = getGrade(riskIndex);
    const riskLevel = getRiskLevel(riskIndex);
    const totalCount = factors.length;
    const confidenceScore = totalCount > 0 ? round2((answeredCount / totalCount) * 100) : 0;

    // Critical risks and top risks
    const criticalRisks = answeredFactors
      .filter(f => f.critical && f.score >= criticalThreshold)
      .sort((a, b) => b.score - a.score);

    const topRisks = answeredFactors
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Mitigations
    const mitigations = [];
    if (Standards && Standards.CATEGORIES) {
      Standards.CATEGORIES.forEach(cat => {
        const cs = categoryScores[cat.id];
        if (cs && cs.score > 40 && cat.mitigations) {
          mitigations.push({
            category: cat.id,
            labelAr: cat.labelAr,
            labelEn: cat.labelEn,
            score: cs.score,
            actionsAr: cat.mitigations.ar || [],
            actionsEn: cat.mitigations.en || []
          });
        }
      });
    }

    const valuationAdjustments = defaultAdjustments(riskIndex);

    return {
      assetClass,
      riskIndex,
      riskGrade,
      riskLevel,
      confidenceScore,
      answeredCount,
      totalCount,
      categoryScores,
      criticalRisks,
      topRisks,
      mitigations,
      valuationAdjustments,
      externalAdjustments: {
        conditionAssessment: !!(options.externalData && options.externalData.conditionAssessment),
        marketData: !!(options.externalData && options.externalData.marketData),
        valuationInputs: !!(options.externalData && options.externalData.valuationInputs)
      },
      success: true
    };
  }

  function defaultAdjustments(riskIndex) {
    const ri = clamp(riskIndex, 0, 100);
    const riskPremiumRate = round4(Math.min(ri / 200, 0.5));
    const valueHaircutRate = round4(Math.min(ri / 300, 0.3333));
    return {
      riskPremiumRate,
      valueHaircutRate,
      riskPremiumPct: round2(riskPremiumRate * 100),
      valueHaircutPct: round2(valueHaircutRate * 100),
      fairValueMultiplier: round4(1 - valueHaircutRate),
      discountRatePremium: round2(riskPremiumRate * 100)
    };
  }

  function generateReport(result, lang) {
    lang = lang || 'ar';
    const isEn = lang === 'en';
    const t = {
      title: isEn ? 'Risk Intelligence Report' : 'تقرير ذكاء المخاطر',
      overall: isEn ? 'Overall Risk Index' : 'مؤشر المخاطر الكلي',
      grade: isEn ? 'Risk Grade' : 'درجة المخاطر',
      category: isEn ? 'Dimension' : 'البُعد',
      score: isEn ? 'Score' : 'الدرجة',
      criticalRisks: isEn ? 'Critical Risks' : 'المخاطر الحرجة',
      topRisks: isEn ? 'Top Risks' : 'أبرز المخاطر',
      mitigations: isEn ? 'Mitigations' : 'إجراءات التخفيف',
      valuationImpact: isEn ? 'Valuation Impact' : 'التأثير على التقييم',
      riskPremium: isEn ? 'Risk premium' : 'علاوة المخاطر',
      valueHaircut: isEn ? 'Value haircut' : 'خصم القيمة',
      none: isEn ? 'None identified' : 'لا يوجد'
    };

    const lines = [];
    lines.push(`# ${t.title}`);
    lines.push('');
    lines.push(`**${t.overall}:** ${result.riskIndex}`);
    lines.push(`**${t.grade}:** ${result.riskGrade} — ${getGradeLabel(result.riskGrade, lang)}`);
    lines.push('');

    lines.push(`## ${isEn ? 'Category Scores' : 'درجات الأبعاد'}`);
    Object.values(result.categoryScores).forEach(cs => {
      const label = isEn ? cs.labelEn : cs.labelAr;
      lines.push(`- ${label}: ${cs.score}`);
    });
    lines.push('');

    lines.push(`## ${t.criticalRisks}`);
    if (result.criticalRisks.length === 0) {
      lines.push(t.none);
    } else {
      result.criticalRisks.forEach(r => {
        const label = isEn ? r.labelEn : r.labelAr;
        lines.push(`- ${label}: ${r.score}`);
      });
    }
    lines.push('');

    lines.push(`## ${t.topRisks}`);
    if (result.topRisks.length === 0) {
      lines.push(t.none);
    } else {
      result.topRisks.forEach(r => {
        const label = isEn ? r.labelEn : r.labelAr;
        lines.push(`- ${label}: ${r.score}`);
      });
    }
    lines.push('');

    lines.push(`## ${t.mitigations}`);
    if (result.mitigations.length === 0) {
      lines.push(t.none);
    } else {
      result.mitigations.forEach(m => {
        const label = isEn ? m.labelEn : m.labelAr;
        const actions = isEn ? m.actionsEn : m.actionsAr;
        lines.push(`### ${label} (${m.score})`);
        actions.forEach(a => lines.push(`- ${a}`));
      });
    }
    lines.push('');

    lines.push(`## ${t.valuationImpact}`);
    lines.push(`- ${t.riskPremium}: ${result.valuationAdjustments.riskPremiumPct}%`);
    lines.push(`- ${t.valueHaircut}: ${result.valuationAdjustments.valueHaircutPct}%`);

    return lines.join('\n');
  }

  return {
    calculate,
    normalizeValue,
    getGrade,
    getGradeLabel,
    getRiskLevel,
    getRiskLevelLabel,
    generateReport,
    defaultAdjustments,
    applyExternalData,
    version: '1.0.0'
  };
}));
