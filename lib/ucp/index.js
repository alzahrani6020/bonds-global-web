/**
 * BONDS Universal Calculation Platform (UCP)
 *
 * Single registry-based, template-driven calculation engine.
 * Compliant with Wave 3 governance: metadata-driven, graph-based,
 * explainable, versioned, configuration-first, zero sector logic.
 */

const { FormulaRegistry } = require('./formula-registry');
const { ValidationRegistry } = require('./validation-registry');
const { RuleRegistry } = require('./rule-registry');
const { ScenarioRegistry } = require('./scenario-registry');
const { WeightRegistry } = require('./weight-registry');
const { PolicyRegistry } = require('./policy-registry');
const { TemplateEngine } = require('./template-engine');
const { InputDefinitionRegistry, OutputDefinitionRegistry } = require('./input-output-registry');
const { BusinessFormulaRegistry } = require('./business-formula-registry');
const { DependencyRegistry } = require('./dependency-registry');
const { CalculationGraph } = require('./calculation-graph');
const { VersionRegistry, isActive } = require('./version-registry');
const { ConfigurationLayer } = require('./configuration-layer');
const { EvidenceRegistry } = require('./evidence-registry');
const { PluginLoader } = require('./plugin-loader');
const { UniversalAssetModelRegistry, UcpAsset } = require('./universal-asset-model');

class UniversalCalculationPlatform {
  constructor({
    formulaRegistry,
    validationRegistry,
    ruleRegistry,
    scenarioRegistry,
    weightRegistry,
    policyRegistry,
    templateEngine,
    inputRegistry,
    outputRegistry,
    businessFormulaRegistry,
    dependencyRegistry,
    versionRegistry,
    configurationLayer,
    pluginLoader,
    assetModelRegistry,
    supabase = null,
    options = {}
  } = {}) {
    this.formulas = formulaRegistry || new FormulaRegistry({ preferStatic: true });
    this.validations = validationRegistry || new ValidationRegistry({ preferStatic: true });
    this.rules = ruleRegistry || new RuleRegistry({ preferStatic: true });
    this.scenarios = scenarioRegistry || new ScenarioRegistry({ preferStatic: true });
    this.weights = weightRegistry || new WeightRegistry({ preferStatic: true });
    this.policies = policyRegistry || new PolicyRegistry({ preferStatic: true });
    this.templates = templateEngine || new TemplateEngine({ preferStatic: true });
    this.inputs = inputRegistry || new InputDefinitionRegistry({ preferStatic: true });
    this.outputs = outputRegistry || new OutputDefinitionRegistry({ preferStatic: true });
    this.businessFormulas = businessFormulaRegistry || new BusinessFormulaRegistry({ preferStatic: true });
    this.dependencies = dependencyRegistry || new DependencyRegistry();
    this.versions = versionRegistry || new VersionRegistry();
    this.config = configurationLayer || new ConfigurationLayer({ preferStatic: true });
    this.plugins = pluginLoader || new PluginLoader({ preferStatic: true });
    this.assetModels = assetModelRegistry || new UniversalAssetModelRegistry({ preferStatic: true });
    this.supabase = supabase;
    this.options = options;
  }

  static async create({ supabase = null, preferStatic = true } = {}) {
    const opts = { preferStatic };
    const factories = [
      supabase ? FormulaRegistry.fromSupabase(supabase).catch(() => new FormulaRegistry(opts)) : new FormulaRegistry(opts),
      supabase ? ValidationRegistry.fromSupabase(supabase).catch(() => new ValidationRegistry(opts)) : new ValidationRegistry(opts),
      supabase ? RuleRegistry.fromSupabase(supabase).catch(() => new RuleRegistry(opts)) : new RuleRegistry(opts),
      supabase ? ScenarioRegistry.fromSupabase(supabase).catch(() => new ScenarioRegistry(opts)) : new ScenarioRegistry(opts),
      supabase ? WeightRegistry.fromSupabase(supabase).catch(() => new WeightRegistry(opts)) : new WeightRegistry(opts),
      supabase ? PolicyRegistry.fromSupabase(supabase).catch(() => new PolicyRegistry(opts)) : new PolicyRegistry(opts),
      supabase ? TemplateEngine.fromSupabase(supabase).catch(() => new TemplateEngine(opts)) : new TemplateEngine(opts),
      supabase ? InputDefinitionRegistry.fromSupabase(supabase).catch(() => new InputDefinitionRegistry(opts)) : new InputDefinitionRegistry(opts),
      supabase ? OutputDefinitionRegistry.fromSupabase(supabase).catch(() => new OutputDefinitionRegistry(opts)) : new OutputDefinitionRegistry(opts),
      supabase ? BusinessFormulaRegistry.fromSupabase(supabase).catch(() => new BusinessFormulaRegistry(opts)) : new BusinessFormulaRegistry(opts),
      supabase ? DependencyRegistry.fromSupabase(supabase).catch(() => new DependencyRegistry()) : new DependencyRegistry(),
      supabase ? VersionRegistry.fromSupabase(supabase).catch(() => new VersionRegistry()) : new VersionRegistry(),
      supabase ? ConfigurationLayer.fromSupabase(supabase).catch(() => new ConfigurationLayer(opts)) : new ConfigurationLayer(opts),
      supabase ? PluginLoader.fromSupabase(supabase).catch(() => new PluginLoader(opts)) : new PluginLoader(opts),
      supabase ? UniversalAssetModelRegistry.fromSupabase(supabase).catch(() => new UniversalAssetModelRegistry(opts)) : new UniversalAssetModelRegistry(opts)
    ];
    const [
      formulaRegistry, validationRegistry, ruleRegistry, scenarioRegistry, weightRegistry, policyRegistry,
      templateEngine, inputRegistry, outputRegistry, businessFormulaRegistry, dependencyRegistry,
      versionRegistry, configurationLayer, pluginLoader, assetModelRegistry
    ] = await Promise.all(factories);

    return new UniversalCalculationPlatform({
      formulaRegistry, validationRegistry, ruleRegistry, scenarioRegistry, weightRegistry, policyRegistry,
      templateEngine, inputRegistry, outputRegistry, businessFormulaRegistry, dependencyRegistry,
      versionRegistry, configurationLayer, pluginLoader, assetModelRegistry, supabase
    });
  }

  resolveTemplate({ templateCode, sector, country }) {
    if (templateCode) return this.templates.get(templateCode);
    return this.templates.resolve(sector, country);
  }

  /**
   * Main calculation execution.
   */
  async calculate({
    templateCode,
    sector,
    country,
    inputs = {},
    scenarioCodes = ['scn_expected'],
    weightCode,
    policyCodes = [],
    businessFormulaCodes = [],
    context = {},
    asset,
    requestId,
    userId,
    projectId
  } = {}) {
    const start = Date.now();
    const template = this.resolveTemplate({ templateCode, sector, country });
    if (!template) {
      throw new Error(`No UCP template found for sector=${sector} country=${country}`);
    }

    // Merge asset attributes as inputs if provided
    let mergedInputs = { ...inputs };
    if (asset && asset instanceof UcpAsset) {
      mergedInputs = { ...asset.attributes, ...mergedInputs };
    }

    // Apply configuration overrides
    const cfgContext = { sector: template.sector, country: template.country || country };
    const configOverrides = this.config.resolve('policy', 'vat_rate', cfgContext);
    if (configOverrides && configOverrides.value !== undefined) {
      mergedInputs.vat_rate = configOverrides.value;
    }

    // Validate inputs
    const validationCodes = template.validation_codes || [];
    const validation = this.validations.validate(mergedInputs, validationCodes);

    // Resolve active formulas/business formulas/outputs (include transitive formula dependencies)
    const requestedFormulaCodes = template.formula_codes || [];
    const formulaCodes = this.formulas.resolveOrder(requestedFormulaCodes);
    const bizFormulaCodes = businessFormulaCodes.length ? businessFormulaCodes : (template.business_formula_codes || []);
    const outputCodes = template.schema?.outputs || [];
    const formulas = formulaCodes.map(c => this.formulas.get(c)).filter(Boolean).filter(f => isActive(f));
    const bizFormulas = bizFormulaCodes.map(c => this.businessFormulas.get(c)).filter(Boolean).filter(f => isActive(f));
    const outputs = outputCodes.map(c => this.outputs.get(c)).filter(Boolean).filter(o => isActive(o));

    // Build dependency graph
    const graph = CalculationGraph.build({
      inputs: mergedInputs,
      formulas,
      businessFormulas: bizFormulas,
      outputs
    });

    // Scenario runs
    const scenarioResults = [];
    for (const scenarioCode of scenarioCodes) {
      const { scenario, inputs: scenarioInputs } = this.scenarios.apply(scenarioCode, mergedInputs);
      const evidence = new EvidenceRegistry({ supabase: this.supabase });
      for (const [k, v] of Object.entries(scenarioInputs)) evidence.addInput(k, v, scenarioCode === 'scn_expected' ? 'user' : `scenario:${scenarioCode}`);
      if (configOverrides) evidence.addAssumption('vat_rate', configOverrides.value, `country config ${template.country || country}`);

      // Execute graph
      const { context: execContext, order } = await graph.execute((node, ctx) => {
        if (node.type === 'input') return scenarioInputs[node.code];
        if (node.type === 'formula') {
          const r = this.formulas.evaluate(node.code, ctx);
          evidence.addFormula(node.code, node.expression, r.value);
          return r.value;
        }
        if (node.type === 'business_formula') {
          const r = this.businessFormulas.evaluate(node.code, ctx);
          evidence.addBusinessFormula(node.code, node.expression, r.value);
          return r.value;
        }
        if (node.type === 'output') {
          // Output value is the first formula result
          const fc = node.inputs[0];
          return ctx[fc];
        }
        return undefined;
      }, { ...scenarioInputs });

      // Build output results map
      const outputResults = {};
      for (const o of outputs) {
        outputResults[o.code] = { code: o.code, value: execContext[o.code], unit: o.unit_code };
      }

      // Rules, policies, weights
      const ruleEval = this.rules.evaluate(template.rule_codes || [], execContext);
      for (const r of ruleEval.results || []) evidence.addRule(r.code, r);

      const policyCodesToRun = policyCodes.length ? policyCodes : (template.policy_codes || []);
      const policyEval = this.policies.evaluate(policyCodesToRun, execContext);
      for (const p of policyEval.results || []) evidence.addPolicy(p.code, p);

      let weightScore = null;
      if (weightCode || (template.weight_codes || []).length) {
        const wcode = weightCode || template.weight_codes[0];
        weightScore = this.weights.score(wcode, outputResults);
      }

      scenarioResults.push({
        scenarioCode,
        scenarioType: scenario.scenario_type,
        inputs: scenarioInputs,
        outputs: outputResults,
        rules: ruleEval,
        policies: policyEval,
        weightScore,
        evidence: evidence.list(),
        graph: { order }
      });
    }

    const baseScenario = scenarioResults.find(s => s.scenarioType === 'expected') || scenarioResults[0];
    const confidence = this.computeConfidence(mergedInputs, template);
    const durationMs = Date.now() - start;

    const run = {
      templateId: template.id || null,
      templateCode: template.code,
      sector: template.sector,
      country: template.country,
      inputs: mergedInputs,
      outputs: baseScenario.outputs,
      scenarios: scenarioResults,
      validation,
      confidence,
      evidence: {
        formulas: formulaCodes,
        validations: validationCodes,
        rules: template.rule_codes || [],
        scenarios: scenarioCodes,
        weights: weightCode ? [weightCode] : (template.weight_codes || []),
        policies: policyCodes.length ? policyCodes : (template.policy_codes || [])
      },
      trace: {
        template: template.code,
        resolvedAt: new Date().toISOString(),
        durationMs,
        scenarioCount: scenarioResults.length
      },
      requestId,
      userId,
      projectId
    };

    if (this.supabase && this.options.persistRuns !== false) {
      await this.storeRun(run);
    }

    return run;
  }

  computeConfidence(inputs, template) {
    const schema = template.schema || {};
    const inputCodes = schema.inputs || [];
    if (inputCodes.length === 0) return 1;
    let present = 0;
    let totalWeight = 0;
    for (const code of inputCodes) {
      const def = this.inputs.get(code);
      const weight = def && def.required ? 1 : 0.5;
      totalWeight += weight;
      if (inputs[code] !== undefined && inputs[code] !== null) present += weight;
    }
    return totalWeight ? Math.round((present / totalWeight) * 100) / 100 : 1;
  }

  async storeRun(run) {
    try {
      const { data, error } = await this.supabase.from('ucp_calculation_runs').insert({
        request_id: run.requestId,
        template_id: run.templateId,
        user_id: run.userId || null,
        project_id: run.projectId || null,
        inputs: run.inputs,
        outputs: run.outputs,
        confidence: run.confidence,
        evidence: run.evidence,
        trace: run.trace,
        duration_ms: run.trace.durationMs,
        status: 'success'
      }).select('id').single();
      if (!error && data && run.scenarios) {
        for (const s of run.scenarios) {
          const evidence = new EvidenceRegistry({ supabase: this.supabase });
          for (const e of s.evidence || []) evidence.add(e);
          await evidence.persist(data.id);
        }
      }
    } catch (err) {
      if (this.options.logErrors) console.error('UCP storeRun failed:', err.message);
    }
  }
}

module.exports = { UniversalCalculationPlatform };
