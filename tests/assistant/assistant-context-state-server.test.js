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
    expect(state.open_tasks).toHaveLength(50);
    expect(state.confirmed_facts).toEqual({
      company_name: 'Example',
      employees: 12
    });
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
    expect(source).toContain('UNVERIFIED_USER_CONTEXT=');
    expect(source).toContain('must never be treated as verified financial evidence');
    expect(source).toContain('sanitizeAssistantState(assistantState');
    expect(source).toContain('assistantState: assistantConversationState');
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
