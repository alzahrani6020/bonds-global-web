/**
 * RegressionEstimator — multivariate linear regression with optional feature scaling.
 * Trains y = bias + sum(w_i * x_i) using the normal equation.
 * Stores evaluation metrics: R², RMSE, MAPE.
 */
class RegressionEstimator {
  constructor(models = []) {
    this.modelMap = {};
    for (const m of models) {
      if (!this.modelMap[m.metricCode]) this.modelMap[m.metricCode] = [];
      this.modelMap[m.metricCode].push(m);
    }
  }

  /**
   * Train a model for a given metric.
   * @param {string} metricCode
   * @param {Array<{features: Object, target: number}>} rows
   * @param {string[]} featureKeys
   * @param {Object} options
   * @returns {Object|null} trained model
   */
  static train(metricCode, rows, featureKeys, options = {}) {
    const minSamples = options.minSamples || 5;
    const testRatio = options.testRatio || 0.2;

    // Clean rows
    const cleanRows = rows.filter(r =>
      Number.isFinite(r.target) &&
      featureKeys.some(k => Number.isFinite(r.features[k]))
    );

    if (cleanRows.length < minSamples) return null;

    // Shuffle
    const shuffled = cleanRows.slice().sort(() => Math.random() - 0.5);
    const splitIdx = Math.max(1, Math.floor(shuffled.length * (1 - testRatio)));
    const trainRows = shuffled.slice(0, splitIdx);
    const testRows = shuffled.slice(splitIdx);

    const model = this._fit(trainRows, featureKeys, metricCode);
    if (!model) return null;

    model.trainCount = trainRows.length;
    model.testCount = testRows.length;

    // Evaluate on test set
    if (testRows.length > 0) {
      const actuals = [];
      const preds = [];
      for (const row of testRows) {
        const p = this._predictRow(row.features, model);
        if (Number.isFinite(p)) {
          actuals.push(row.target);
          preds.push(p);
        }
      }
      const metrics = this._computeMetrics(actuals, preds);
      model.rSquared = metrics.rSquared;
      model.rmse = metrics.rmse;
      model.mape = metrics.mape;
    } else {
      // No test set: evaluate on train
      const metrics = this._computeMetrics(trainRows.map(r => r.target), trainRows.map(r => this._predictRow(r.features, model)));
      model.rSquared = metrics.rSquared;
      model.rmse = metrics.rmse;
      model.mape = metrics.mape;
    }

    return model;
  }

  static _fit(rows, featureKeys, metricCode) {
    const n = rows.length;
    if (n < 2) return null;

    // Compute means and stds from training data
    const means = {};
    const stds = {};
    for (const key of featureKeys) {
      const values = rows.map(r => r.features[key]).filter(Number.isFinite);
      const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length || 1);
      means[key] = mean;
      stds[key] = Math.sqrt(variance) || 1; // avoid divide by zero
    }

    // Build matrices
    // X: n x (k+1) with bias column, features standardized
    const X = [];
    const y = [];
    for (const row of rows) {
      const xi = [1];
      for (const key of featureKeys) {
        const v = Number.isFinite(row.features[key]) ? row.features[key] : means[key];
        xi.push((v - means[key]) / stds[key]);
      }
      X.push(xi);
      y.push(row.target);
    }

    const targetMean = y.reduce((a, b) => a + b, 0) / n;

    // Normal equation: w = (X^T X)^-1 X^T y
    const Xt = this._transpose(X);
    const XtX = this._matMul(Xt, X);
    const Xty = this._matMulVec(Xt, y);
    const weights = this._solveLinearSystem(XtX, Xty);

    if (!weights) return null;

    return {
      metricCode,
      featureKeys,
      weights,
      featureMeans: means,
      featureStds: stds,
      targetMean,
      sampleCount: n,
      modelType: 'multivariate_linear'
    };
  }

  static _predictRow(features, model) {
    let pred = model.weights[0]; // bias
    for (let i = 0; i < model.featureKeys.length; i++) {
      const key = model.featureKeys[i];
      const v = Number.isFinite(features[key]) ? features[key] : model.featureMeans[key];
      pred += model.weights[i + 1] * ((v - model.featureMeans[key]) / model.featureStds[key]);
    }
    return pred;
  }

  predict(metricCode, features, options = {}) {
    const models = this.modelMap[metricCode] || [];
    const minSamples = options.minSamples ?? 5;
    const maxMape = options.maxMape ?? 50;

    for (const model of models) {
      if (model.sampleCount < minSamples) continue;
      if (model.mape > maxMape) continue;
      if (!Number.isFinite(model.rSquared) || model.rSquared < 0.1) continue;
      const missingFeatures = model.featureKeys.some(k => !Number.isFinite(features[k]));
      if (missingFeatures && !options.allowMissing) continue;
      const value = RegressionEstimator._predictRow(features, model);
      if (!Number.isFinite(value)) continue;
      return {
        value,
        confidence: Math.max(30, Math.min(95, Math.round(100 - model.mape))),
        model: {
          featureKeys: model.featureKeys,
          rSquared: model.rSquared,
          rmse: model.rmse,
          mape: model.mape,
          sampleCount: model.sampleCount
        }
      };
    }

    return null;
  }

  static _computeMetrics(actuals, preds) {
    if (!actuals.length || actuals.length !== preds.length) {
      return { rSquared: 0, rmse: 0, mape: 0 };
    }

    const n = actuals.length;
    const mean = actuals.reduce((a, b) => a + b, 0) / n;
    const ssTotal = actuals.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    const ssResidual = actuals.reduce((a, b, i) => a + Math.pow(b - preds[i], 2), 0);
    const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
    const rmse = Math.sqrt(ssResidual / n);
    const mape = actuals.reduce((a, b, i) => a + Math.abs((b - preds[i]) / (b || 1)), 0) / n * 100;

    return {
      rSquared: Number.isFinite(rSquared) ? rSquared : 0,
      rmse: Number.isFinite(rmse) ? rmse : 0,
      mape: Number.isFinite(mape) ? mape : 100
    };
  }

  // ===== Matrix helpers =====

  static _transpose(m) {
    return m[0].map((_, i) => m.map(row => row[i]));
  }

  static _matMul(a, b) {
    const result = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < b.length; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  static _matMulVec(m, v) {
    return m.map(row => row.reduce((sum, val, i) => sum + val * v[i], 0));
  }

  static _solveLinearSystem(A, b) {
    // Gaussian elimination with partial pivoting
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let i = 0; i < n; i++) {
      // Partial pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
      }
      [M[i], M[maxRow]] = [M[maxRow], M[i]];

      const pivot = M[i][i];
      if (Math.abs(pivot) < 1e-12) return null; // Singular

      for (let j = i; j <= n; j++) M[i][j] /= pivot;

      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const factor = M[k][i];
        for (let j = i; j <= n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }

    return M.map(row => row[n]);
  }

  // ===== Persistence =====

  static async loadModels(supabase, metricCode, countryCode = null) {
    let query = supabase.from('ml_models').select('*');
    if (metricCode) query = query.eq('metric_code', metricCode);
    if (countryCode) query = query.eq('country_code', countryCode);

    const { data, error } = await query.order('trained_at', { ascending: false });
    if (error) throw error;

    return (data || []).map(row => ({
      metricCode: row.metric_code,
      featureKeys: row.feature_stats?.featureKeys || [],
      countryCode: row.country_code,
      weights: row.weights || [],
      featureMeans: row.feature_means || {},
      featureStds: row.feature_stds || {},
      targetMean: Number(row.target_mean),
      rSquared: Number(row.r_squared),
      rmse: Number(row.rmse),
      mape: Number(row.mape),
      sampleCount: Number(row.sample_count),
      trainedAt: row.trained_at,
      modelType: row.model_type
    }));
  }

  static async saveModel(supabase, model, countryCode = null) {
    const record = {
      metric_code: model.metricCode,
      feature_key: model.featureKeys.join(','),
      country_code: countryCode,
      model_type: model.modelType,
      weights: model.weights,
      feature_means: model.featureMeans,
      feature_stds: model.featureStds,
      target_mean: model.targetMean,
      r_squared: model.rSquared,
      rmse: model.rmse,
      mape: model.mape,
      sample_count: model.sampleCount,
      feature_stats: { featureKeys: model.featureKeys }
    };
    const { error } = await supabase.from('ml_models').upsert(record, {
      onConflict: 'metric_code,feature_key,country_code'
    });
    if (error) throw error;
  }
}

module.exports = RegressionEstimator;
