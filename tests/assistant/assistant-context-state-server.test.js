/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const {
  ASSISTANT_STATE_VERSION,
  sanitizeAssistantState,
  conversationalStateView
} = require('../../lib/assistant/context-state');

describe('assistant context state server boundary', () => {
  test('accepts and bounds a matching city context state', () => {
    const boundary = 'city:jeddah|activity:consulting|model:none';
    const state = sanitizeAssistantState({
      version: 999,
      boundary,
      goal: '  Evaluate financing readiness  ',
      current_stage: 'analysis',
      open_tasks: Array.from({ length: 60 }, (_, i) => `task-${i}`),
      required_data: ['cash_flow'],
      confirmed_facts: {
        company_name: 'Example',
        employees: 12,
        nested: { should: 'drop' }
      },
      pending_confirmation: { action: 'save_draft', approved: false },
      last_action: { type: 'form_load' }
    }, { expectedBoundary: boundary });

    expect(state).toMatchObject({
      version: ASSISTANT_STATE_VERSION,
      boundary,
      goal: 'Evaluate financing readiness',
      current_stage: 'analysis'
    });
    expect(ASSISTANT_STATE_VERSION).toBe(2);
    expect(state.open_tasks).toHaveLength(50);
    expect(state.confirmed_facts).toEqual({
      company_name: 'Example',
      employees: 12
    });
  });

  test('preserves only bounded server goal workflow fields in state v2', () => {
    const state = sanitizeAssistantState({
      boundary:'project:p-1',
      goal:'Prepare financing',
      goal_workflow:{
        status:'active',
        nodes:[
          { id:'analysis', label:'Analysis', status:'active', sql:'drop' },
          { id:'review', label:'Review', status:'pending' }
        ],
        edges:[{
          id:'edge:project_status:analysis:review',
          from:'analysis',
          to:'review',
          capability:'project_status',
          effect:'database_read',
          status:'pending',
          input:{ raw_sql:'select *' }
        }]
      }
    }, { expectedBoundary:'project:p-1' });

    expect(state.goal_workflow).toBeTruthy();
    expect(state.goal_workflow.edges[0].capability).toBe('project_status');
    expect(state.goal_workflow.edges[0].input).toBeUndefined();
    expect(conversationalStateView(state).goal_workflow).toEqual(state.goal_workflow);
  });

  test('rejects context state crossing city or project boundaries', () => {
    expect(sanitizeAssistantState(
      { boundary:'project:one', goal:'x' },
      { expectedBoundary:'project:two' }
    )).toBeNull();

    expect(sanitizeAssistantState(
      { boundary:'project:one', goal:'x' },
      { expectedBoundary:'city:jeddah|activity:none|model:none' }
    )).toBeNull();
  });

  test('exposes user facts as conversational context, not verified evidence', () => {
    const state = sanitizeAssistantState({
      boundary:'project:p-1',
      confirmed_facts:{ requested_amount:100000 }
    }, { expectedBoundary:'project:p-1' });

    const view = conversationalStateView(state);
    expect(view.user_confirmed_context).toEqual({ requested_amount:100000 });
    expect(view.verified_data).toBeUndefined();
    expect(view.confirmed_facts).toBeUndefined();
  });

  test('AI chat keeps verified Bonds data separate from unverified user context', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'api', 'ai.js'),
      'utf8'
    );

    expect(source).toContain('VERIFIED_BONDS_DATA=');
    expect(source).toContain('CONVERSATION_STATE=');
    expect(source).toContain('TRUSTED_USER_CONTEXT=');
    expect(source).toContain('Use VERIFIED_BONDS_DATA for BONDS facts');
    expect(source).toContain('sanitizeAssistantState(assistantState');
    expect(source).toContain('assistantState: assistantConversationState');
    expect(source).toContain('goalWorkflow: durableGoal?.stored?.state?.goal_workflow || null');
    expect(source).toContain('persistDurableGoalWorkflow(durableGoal, loopResult.goal_workflow');
  });

  test('ECC advisor binds assistant state to the exact project id', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'api', 'ecc.js'),
      'utf8'
    );

    expect(source).toContain('sanitizeAssistantState(assistantState');
    expect(source).toContain('expectedBoundary: `project:${String(projectId).trim()}`');
    expect(source).toContain('assistantState: conversationalStateView(safeAssistantState)');
  });
});
