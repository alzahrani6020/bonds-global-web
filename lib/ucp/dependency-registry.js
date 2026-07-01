/**
 * BONDS UCP Dependency Registry
 *
 * Tracks dependencies between inputs, formulas, business formulas, rules,
 * outputs, templates and policies.
 */

const { getVariables } = require('./expression-evaluator');

class DependencyRegistry {
  constructor({ dependencies = [] } = {}) {
    this.deps = new Map(); // source -> array of targets
    this.reverse = new Map(); // target -> array of sources
    for (const d of dependencies) this.add(d);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_dependencies').select('*');
    if (error) throw error;
    return new DependencyRegistry({ dependencies: data || [] });
  }

  static key(type, code) { return `${type}:${code}`; }

  add({ source_type, source_code, depends_on_type, depends_on_code, dependency_type = 'hard', metadata = {} }) {
    const sourceKey = DependencyRegistry.key(source_type, source_code);
    const targetKey = DependencyRegistry.key(depends_on_type, depends_on_code);
    if (!this.deps.has(sourceKey)) this.deps.set(sourceKey, []);
    if (!this.reverse.has(targetKey)) this.reverse.set(targetKey, []);
    this.deps.get(sourceKey).push({ type: depends_on_type, code: depends_on_code, dependency_type, metadata });
    this.reverse.get(targetKey).push({ type: source_type, code: source_code, dependency_type, metadata });
  }

  getDependencies(type, code) {
    return this.deps.get(DependencyRegistry.key(type, code)) || [];
  }

  getDependents(type, code) {
    return this.reverse.get(DependencyRegistry.key(type, code)) || [];
  }

  /**
   * Auto-register formula dependencies based on variables used in expression.
   */
  inferFromFormula(type, code, expression, inputCodes = new Set(), formulaCodes = new Set()) {
    const vars = getVariables(expression);
    for (const v of vars) {
      if (inputCodes.has(v)) {
        this.add({ source_type: type, source_code: code, depends_on_type: 'input', depends_on_code: v });
      } else if (formulaCodes.has(v)) {
        this.add({ source_type: type, source_code: code, depends_on_type: 'formula', depends_on_code: v });
      }
    }
  }

  /**
   * Impact analysis: given a changed element, return all downstream elements.
   */
  impacted(type, code, visited = new Set()) {
    const key = DependencyRegistry.key(type, code);
    if (visited.has(key)) return [];
    visited.add(key);
    const impacted = [];
    for (const dep of this.getDependents(type, code)) {
      const depKey = DependencyRegistry.key(dep.type, dep.code);
      impacted.push(dep);
      impacted.push(...this.impacted(dep.type, dep.code, visited));
    }
    return impacted;
  }
}

module.exports = { DependencyRegistry };
