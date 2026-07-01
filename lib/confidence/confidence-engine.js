/**
 * BONDS Confidence Engine
 *
 * Scores and propagates confidence through data sources, calculations and final outputs.
 */

const GRADES = [
  { max: 100, min: 85, grade: 'A', label: 'High confidence' },
  { max: 84, min: 70, grade: 'B', label: 'Good confidence' },
  { max: 69, min: 50, grade: 'C', label: 'Moderate confidence' },
  { max: 49, min: 30, grade: 'D', label: 'Low confidence' },
  { max: 29, min: 0, grade: 'F', label: 'Unreliable' }
];

function gradeConfidence(score) {
  const s = Number(score);
  if (Number.isNaN(s)) return 'F';
  for (const g of GRADES) {
    if (s >= g.min && s <= g.max) return g.grade;
  }
  return 'F';
}

function scoreToConfidence({ sourceGrade, freshnessDays, validated }) {
  let score = 50;
  const gradeBoost = { A: 40, B: 25, C: 10, D: -10, F: -30 };
  score += gradeBoost[sourceGrade] || 0;

  if (freshnessDays !== undefined) {
    if (freshnessDays <= 7) score += 15;
    else if (freshnessDays <= 30) score += 5;
    else if (freshnessDays <= 90) score -= 10;
    else score -= 25;
  }

  if (validated === true) score += 10;
  if (validated === false) score -= 15;

  return clamp(Math.round(score), 0, 100);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Combine multiple confidence scores.
 * Uses weighted geometric mean to penalize low-confidence inputs.
 */
function combineConfidence(scores, weights = []) {
  if (!Array.isArray(scores) || scores.length === 0) return 0;
  let totalWeight = 0;
  let weightedLogSum = 0;
  scores.forEach((score, i) => {
    const s = clamp(Number(score) || 0, 1, 100);
    const w = weights[i] || 1;
    totalWeight += w;
    weightedLogSum += w * Math.log(s / 100);
  });
  if (totalWeight === 0) return 0;
  return Math.round(100 * Math.exp(weightedLogSum / totalWeight));
}

/**
 * Propagate confidence through a chain of operations.
 * @param {Array<{score:number, weight:number}>} inputs
 * @param {number} operationReliability 0-1 multiplier for the operation itself
 */
function propagate(inputs, operationReliability = 1.0) {
  const scores = inputs.map(i => i.score);
  const weights = inputs.map(i => i.weight || 1);
  const combined = combineConfidence(scores, weights);
  return Math.round(combined * clamp(operationReliability, 0, 1));
}

function thresholdMet(score, threshold) {
  return Number(score) >= Number(threshold);
}

function explainConfidence(score, inputs = []) {
  const grade = gradeConfidence(score);
  const gradeInfo = GRADES.find(g => g.grade === grade);
  return {
    score,
    grade,
    label: gradeInfo ? gradeInfo.label : 'Unknown',
    inputs: inputs.map(i => ({
      name: i.name,
      score: i.score,
      weight: i.weight || 1,
      contribution: i.weight ? Math.round((i.score * i.weight) / 100) : i.score
    })),
    recommendation: grade === 'A' || grade === 'B'
      ? 'Proceed'
      : grade === 'C'
        ? 'Review before proceeding'
        : 'Improve data quality or seek manual confirmation'
  };
}

module.exports = {
  GRADES,
  gradeConfidence,
  scoreToConfidence,
  combineConfidence,
  propagate,
  thresholdMet,
  explainConfidence,
  clamp
};
