/**
 * @jest-environment node
 */

const {
  PREFILL_SOURCES,
  normalizePrefillCandidate,
  buildPrefillMetadata,
  applyPrefillProvenance
} = require('../../lib/assistant/prefill-provenance');
const { buildForm } = require('../../lib/forms/dynamic-form-engine');

describe('assistant prefill provenance', () => {
  test('accepts only approved provenance sources', () => {
    expect(PREFILL_SOURCES).toEqual(expect.arrayContaining([
      'profile',
      'project',
      'funding_case',
      'document',
      'calculator',
      'conversation',
      'ai_inference'
    ]));

    expect(() => normalizePrefillCandidate({
      value:'x',
      source:'arbitrary_model_source'
    })).toThrow('INVALID_PREFILL_SOURCE');
  });

  test('AI inference cannot silently become confirmed', () => {
    expect(normalizePrefillCandidate({
      value:100000,
      source:'ai_inference',
      status:'confirmed',
      confidence:82
    })).toMatchObject({
      value:100000,
      source:'ai_inference',
      status:'suggested',
      confidence:82,
      confirmed_by_user:false
    });
  });

  test('explicit user confirmation may confirm a previously inferred value', () => {
    expect(normalizePrefillCandidate({
      value:100000,
      source:'ai_inference',
      status:'confirmed',
      confirmed_by_user:true,
      confidence:82
    })).toMatchObject({
      status:'confirmed',
      confirmed_by_user:true
    });
  });

  test('builds a fabric-compatible provenance record without persisting it', () => {
    const result = buildPrefillMetadata({
      field:'country',
      entityType:'funding_case',
      entityId:'case-1',
      candidate:{
        value:'SA',
        source:'profile',
        source_ref:'profile:user-1',
        status:'confirmed',
        confidence:100
      }
    });

    expect(result).toMatchObject({
      value:'SA',
      source:'profile',
      status:'confirmed',
      provenance:{
        entityType:'funding_case',
        entityId:'case-1',
        field:'country',
        connectorCode:'profile',
        confidence:100,
        evidence:{
          prefill:true,
          status:'confirmed'
        }
      }
    });
  });

  test('attaches metadata only to registered form fields and does not overwrite defaults', () => {
    const fields = [
      { name:'country', default:'SAR-default' },
      { name:'city' }
    ];
    const result = applyPrefillProvenance(fields, {
      country:{
        value:'SA',
        source:'profile',
        status:'confirmed',
        confidence:100
      },
      unknown:{
        value:'ignored',
        source:'profile',
        status:'confirmed'
      }
    });

    expect(result[0].default).toBe('SAR-default');
    expect(result[0].prefill).toMatchObject({
      value:'SA',
      source:'profile',
      status:'confirmed'
    });
    expect(result.find(field => field.name === 'unknown')).toBeUndefined();
  });

  test('dynamic form engine exposes prefill provenance without changing legacy behavior', () => {
    const form = buildForm({
      sector:'manufacturing',
      intent:'feasibility',
      language:'en',
      prefill:{
        country:{
          value:'SA',
          source:'profile',
          status:'confirmed',
          confidence:100,
          source_ref:'profile:user-1'
        }
      },
      prefillContext:{
        entityType:'project',
        entityId:'project-1'
      }
    });

    const country = form.fields.find(field => field.name === 'country');
    expect(country.prefill).toMatchObject({
      value:'SA',
      source:'profile',
      status:'confirmed',
      provenance:{
        entityType:'project',
        entityId:'project-1',
        field:'country'
      }
    });

    const legacy = buildForm({
      sector:'manufacturing',
      intent:'feasibility',
      language:'en'
    });
    expect(legacy.fields.find(field => field.name === 'country').prefill).toBeUndefined();
  });
});
