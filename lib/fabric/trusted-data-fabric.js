/**
 * BONDS Trusted Data Fabric
 *
 * Central orchestrator: every value passes through connector → normalization →
 * validation → quality → evidence → source ranking → consensus → conflict resolution
 * → confidence → audit → versioning → rules before being consumed.
 */

const { SourceRankingEngine } = require('./source-ranking-engine');
const { FreshnessEngine } = require('./freshness-engine');
const { DataQualityEngine } = require('./data-quality-engine');
const { ConsensusEngine } = require('./consensus-engine');
const { ConflictResolutionEngine } = require('./conflict-resolution-engine');
const { Provenance } = require('./provenance');
const { Observability } = require('./observability');

class TrustedDataFabric {
  constructor(options = {}) {
    this.supabase = options.supabase || null;
    this.connectorRegistry = options.connectorRegistry || null;
    this.sourceRegistry = options.sourceRegistry || null;
    this.rankingEngine = options.rankingEngine || new SourceRankingEngine();
    this.freshnessEngine = options.freshnessEngine || new FreshnessEngine();
    this.qualityEngine = options.qualityEngine || new DataQualityEngine();
    this.consensusEngine = options.consensusEngine || new ConsensusEngine();
    this.conflictEngine = options.conflictEngine || new ConflictResolutionEngine();
    this.provenance = options.provenance || new Provenance(this.supabase);
    this.observability = options.observability || new Observability(this.supabase);
    this.defaultMaxAgeSeconds = options.defaultMaxAgeSeconds || 86400;
  }

  /**
   * Resolve a single metric through the full trusted pipeline.
   */
  async resolve({ metricCode, context = {}, dataType = 'number', records = null, entityType, entityId, field }) {
    const ctx = {
      country: context.country,
      cityId: context.cityId,
      activityId: context.activityId,
      industry: context.industry,
      sector: context.sector,
      year: context.year || new Date().getFullYear(),
      entityType,
      entityId,
      field
    };

    const start = Date.now();
    try {
      // 1. Gather records from connectors unless provided.
      const sourceRecords = records !== null ? records : await this._fetchRecords(metricCode, ctx);

      // 2. Rank sources.
      const ranked = await this._rankRecords(sourceRecords, ctx);

      // 3. Evaluate quality and freshness.
      const evaluated = this._evaluateRecords(ranked, ctx);

      // 4. Consensus.
      const consensus = this.consensusEngine.merge(evaluated, dataType);

      // 5. Conflict resolution if needed.
      const conflict = this.consensusEngine.detectConflict(evaluated, 0.2);
      let resolution = null;
      if (conflict) {
        resolution = this.conflictEngine.resolve(evaluated, 'highest_confidence');
        consensus.value = resolution.selectedValue;
        consensus.confidence = resolution.confidence;
        consensus.resolution = resolution;
      }

      // 6. Provenance.
      const provenanceRecord = Provenance.build({
        entityType: entityType || 'metric',
        entityId: entityId || `${metricCode}:${context.country || 'global'}`,
        field: field || metricCode,
        value: consensus.value,
        sourceId: consensus.sources[0]?.sourceId,
        connectorCode: consensus.sources[0]?.sourceCode,
        collectedAt: new Date().toISOString(),
        confidence: consensus.confidence,
        evidence: {
          method: consensus.method,
          sources: consensus.sources,
          alternatives: consensus.alternatives,
          conflict: resolution?.explanation
        }
      });

      if (this.supabase) {
        await this.provenance.persist(provenanceRecord);
      }

      await this.observability.log({
        eventType: 'resolve',
        metricCode,
        status: 'success',
        latencyMs: Date.now() - start,
        details: { context: ctx, sourceCount: evaluated.length, consensus }
      });

      return {
        metricCode,
        value: consensus.value,
        confidence: consensus.confidence,
        isEstimated: consensus.isEstimated,
        method: consensus.method,
        sources: consensus.sources,
        alternatives: consensus.alternatives,
        provenance: provenanceRecord,
        conflict: resolution,
        evaluated
      };
    } catch (err) {
      await this.observability.log({
        eventType: 'resolve',
        metricCode,
        status: 'error',
        latencyMs: Date.now() - start,
        details: { context: ctx, error: err.message }
      });
      throw err;
    }
  }

  /**
   * Resolve multiple field values for a form / project context.
   * Returns a map: { fieldName: { value, confidence, source, evidence, ... } }
   */
  async resolveValues({ fields, context = {} }) {
    const values = {};
    for (const field of fields) {
      const metricCode = field.metricCode || field.name;
      try {
        const result = await this.resolve({
          metricCode,
          context,
          dataType: field.type === 'string' ? 'text' : 'number',
          entityType: context.entityType || 'form_field',
          entityId: context.entityId || `${context.sector || 'generic'}:${metricCode}`,
          field: metricCode
        });
        values[field.name] = {
          value: result.value,
          confidence: result.confidence,
          source: result.sources[0]?.sourceCode || 'fabric',
          sourceDetail: result.method,
          isEstimated: result.isEstimated,
          alternatives: result.alternatives,
          evidence: result.provenance?.evidence,
          timestamp: result.provenance?.collectedAt,
          verification: { provenanceId: result.provenance?.id }
        };
      } catch (err) {
        values[field.name] = { error: err.message, confidence: 0 };
      }
    }
    return values;
  }

  async _fetchRecords(metricCode, ctx) {
    if (!this.sourceRegistry || !this.connectorRegistry) return [];

    const sources = await this.sourceRegistry.findForContext({
      country: ctx.country,
      industry: ctx.industry,
      operation: 'read',
      metricCode
    });

    const records = [];
    for (const source of sources) {
      const connector = this.connectorRegistry.get(source.connector_code);
      if (!connector) continue;
      try {
        const items = await this.connectorRegistry.fetch(source.source_code, {
          metricCode,
          cityId: ctx.cityId,
          activityId: ctx.activityId,
          year: ctx.year,
          sourceCode: source.source_code
        });
        for (const item of items) {
          if (!item.valid === false) continue;
          records.push({
            metricCode: item.metricCode || metricCode,
            value: item.value,
            valueText: item.valueText,
            sourceId: item.sourceId || source.id,
            sourceCode: item.sourceCode || source.source_code,
            confidence: item.confidence,
            collectedAt: item.collectedAt,
            evidence: item.evidence,
            isOverride: item.isOverride || false
          });
        }
      } catch (err) {
        await this.observability.log({
          eventType: 'fetch',
          connectorCode: source.connector_code,
          sourceId: source.id,
          metricCode,
          status: 'error',
          details: { error: err.message }
        });
      }
    }
    return records;
  }

  async _rankRecords(records, ctx) {
    if (!this.sourceRegistry) return records;
    const ranked = [];
    for (const r of records) {
      let source = null;
      try {
        source = await this.sourceRegistry.getByCode(r.sourceCode);
      } catch {
        // source not in registry; use signals only
      }
      const rank = this.rankingEngine.rank(source || { source_code: r.sourceCode, status: 'active', trust_anchor: 'estimated' }, {
        freshness: this.freshnessEngine.evaluate(r).freshnessScore,
        accuracy: r.confidence
      });
      ranked.push({ ...r, rankScore: rank.overallScore, rankDetails: rank.scores });
    }
    return ranked;
  }

  _evaluateRecords(records, ctx) {
    return records.map(r => {
      const freshness = this.freshnessEngine.evaluate(r, { maxAgeSeconds: this.defaultMaxAgeSeconds });
      const quality = this.qualityEngine.evaluate(r.value, {
        accuracyScore: r.confidence,
        timelinessScore: freshness.freshnessScore,
        requiredFields: ['value', 'metricCode']
      });
      return {
        ...r,
        freshness,
        quality,
        evaluatedConfidence: Math.round(r.confidence * (freshness.freshnessScore / 100) * (quality.overallScore / 100))
      };
    });
  }
}

module.exports = { TrustedDataFabric };
