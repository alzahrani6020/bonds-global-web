/**
 * @jest-environment node
 */

const {
  PROTOCOL,
  createEnvelope,
  normalizeAction,
  resolveNavigation,
  resolveForm,
  planRegisteredAction
} = require('../../lib/assistant/protocol');

describe('BONDS_ASSISTANT_PROTOCOL_V1', () => {
  test('builds a stable structured envelope', () => {
    const result = createEnvelope({
      reply:'جاهز',
      actions:[{ type:'site_navigate', capability:'site_navigate', target:'funding', risk:'low' }]
    });
    expect(result.protocol).toBe(PROTOCOL);
    expect(result.actions[0]).toMatchObject({
      id:'action-001',
      type:'site_navigate',
      target:'funding',
      requires_confirmation:false,
      status:'ready'
    });
  });

  test('rejects arbitrary executable fields', () => {
    expect(() => normalizeAction({
      type:'site_navigate',
      capability:'site_navigate',
      target:'funding',
      input:{ url:'https://example.com' }
    })).toThrow('FORBIDDEN_EXECUTION_FIELD');

    expect(() => normalizeAction({
      type:'form_load',
      capability:'form_load',
      target:'cash_flow',
      input:{ selector:'#root' }
    })).toThrow('FORBIDDEN_EXECUTION_FIELD');
  });

  test('resolves only registered navigation keys', () => {
    expect(resolveNavigation('cash_flow','ar').route).toBe('/client/cash-flow');
    expect(resolveNavigation('cash_flow','en').route).toBe('/en/client/cash-flow');
    expect(resolveNavigation('not-real','ar')).toBeNull();
  });

  test('resolves registered funding forms', () => {
    expect(resolveForm('cash_flow')).toMatchObject({
      data_scope:'case',
      funding_requirement:'cash_flow'
    });
  });

  test('plans navigation without exposing arbitrary url fields in actions', () => {
    const result = planRegisteredAction({type:'site_navigate',target:'funding',language:'ar'});
    expect(result.status).toBe('ready');
    expect(result.actions[0].target).toBe('funding');
    expect(result.actions[0].input.url).toBeUndefined();
    expect(result.context.navigation.route).toBe('/funding');
  });

  test('unknown navigation and forms are denied', () => {
    expect(planRegisteredAction({type:'site_navigate',target:'unknown'}).status).toBe('denied');
    expect(planRegisteredAction({type:'form_load',form:'unknown'}).status).toBe('denied');
  });

  test('high risk actions require confirmation automatically', () => {
    const action = normalizeAction({
      type:'form_submit',
      capability:'form_submit',
      target:'cash_flow',
      risk:'high'
    });
    expect(action.requires_confirmation).toBe(true);
  });
});
