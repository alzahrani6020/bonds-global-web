/**
 * Enterprise Lifecycle Registry
 *
 * Loads workflow definitions and stage metadata.
 * Static JSON files are the fallback/default; Supabase rows can override
 * workflow definitions and add custom stages without code changes.
 */

const defaultWorkflowFiles = [
  './definitions/project-investment-lifecycle.json',
  './definitions/asset-lifecycle.json',
  './definitions/report-certificate-lifecycle.json'
];
const defaultStageFile = './definitions/stages.json';

class LifecycleRegistry {
  constructor({ supabase = null, preferStatic = true, workflowFiles = defaultWorkflowFiles, stageFile = defaultStageFile } = {}) {
    this.supabase = supabase;
    this.preferStatic = preferStatic;
    this.workflowFiles = workflowFiles;
    this.stageFile = stageFile;
    this.workflows = new Map();
    this.stages = new Map();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this;
    this._loadStatic();
    if (!this.preferStatic && this.supabase) {
      await this._loadFromSupabase();
    }
    this.loaded = true;
    return this;
  }

  _loadStatic() {
    for (const file of this.workflowFiles) {
      try {
        const def = require(file);
        this.workflows.set(def.id, def);
      } catch (err) {
        console.warn(`[LifecycleRegistry] Failed to load workflow file ${file}:`, err.message);
      }
    }
    try {
      const stages = require(this.stageFile);
      for (const stage of stages) {
        this.stages.set(stage.code, stage);
      }
    } catch (err) {
      console.warn('[LifecycleRegistry] Failed to load stages file:', err.message);
    }
  }

  async _loadFromSupabase() {
    try {
      const { data: workflowRows } = await this.supabase
        .from('enterprise_lifecycle_workflows')
        .select('*')
        .eq('status', 'active');
      for (const row of workflowRows || []) {
        if (row.definition) {
          this.workflows.set(row.workflow_code, { ...this.workflows.get(row.workflow_code), ...row.definition, workflowCode: row.workflow_code });
        }
      }
      const { data: stageRows } = await this.supabase
        .from('enterprise_lifecycle_stages')
        .select('*')
        .eq('status', 'active');
      for (const row of stageRows || []) {
        this.stages.set(row.stage_code, { ...this.stages.get(row.stage_code), ...row, code: row.stage_code });
      }
    } catch (err) {
      console.warn('[LifecycleRegistry] Supabase load failed, using static definitions:', err.message);
    }
  }

  getWorkflow(code) {
    return this.workflows.get(code) || null;
  }

  listWorkflows() {
    return Array.from(this.workflows.values());
  }

  getStage(code) {
    return this.stages.get(code) || null;
  }

  listStages() {
    return Array.from(this.stages.values());
  }

  findWorkflowForEntityType(entityType) {
    for (const workflow of this.workflows.values()) {
      if (workflow.entityType === entityType && workflow.status !== 'deprecated' && workflow.status !== 'archived') {
        return workflow;
      }
    }
    return null;
  }

  getTransition(workflowCode, fromStage, toStage) {
    const workflow = this.getWorkflow(workflowCode);
    if (!workflow || !workflow.transitions) return null;
    return workflow.transitions.find(t => t.from === fromStage && t.to === toStage) || null;
  }

  getAllowedTransitions(workflowCode, stage) {
    const workflow = this.getWorkflow(workflowCode);
    if (!workflow || !workflow.transitions) return [];
    return workflow.transitions.filter(t => t.from === stage);
  }

  getGuardDefinition(workflowCode, guardId) {
    const workflow = this.getWorkflow(workflowCode);
    if (!workflow || !workflow.guardDefinitions) return null;
    return workflow.guardDefinitions[guardId] || null;
  }

  getStageTasks(workflowCode, stageCode) {
    const workflow = this.getWorkflow(workflowCode);
    if (!workflow || !workflow.stageTasks) return [];
    return workflow.stageTasks[stageCode] || [];
  }

  getApprovalRule(workflowCode, transitionKey) {
    const workflow = this.getWorkflow(workflowCode);
    if (!workflow || !workflow.approvalRules) return null;
    return workflow.approvalRules[transitionKey] || null;
  }

  getRollbackRules(workflowCode) {
    const workflow = this.getWorkflow(workflowCode);
    return workflow ? workflow.rollbackRules || { enabled: false } : { enabled: false };
  }
}

module.exports = { LifecycleRegistry };
