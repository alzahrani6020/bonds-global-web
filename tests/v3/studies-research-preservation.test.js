'use strict';

const { enrichStudiesExecutionRequest } = require('../../lib/services/studies-workspace-bindings');
const { executionRequest } = require('../../lib/services/service-execution-router');
const { detectIntent } = require('../../lib/intent/intent-engine');

const feasibility = { code: 'feasibility_studies' };
const market = { code: 'market_research' };

describe('studies execution preserves explicitly supplied input and research', () => {
  test('the production service route cannot reclassify selling office products as selling an asset', () => {
    const request = executionRequest(
      { orchestrator_intent: 'feasibility' },
      { code: 'feasibility_studies', name_ar: 'دراسة جدوى' },
      {
        sector: 'trade',
        input: 'بيع القهوة والمنظفات والمياه للمكاتب',
        values: {
          sector_code: 'trade',
          project_name: 'توريد مستلزمات المكاتب',
          project_brief: 'بيع القهوة والمنظفات للمكاتب'
        }
      }
    );
    expect(request.intent).toBe('feasibility');
    expect(detectIntent(request.input, { intent: request.intent, sector: request.sector, action: request.action }).intent).toBe('feasibility');
  });

  test('feasibility retains research configuration and sources while generating query defaults', () => {
    const request = enrichStudiesExecutionRequest(
      feasibility, { orchestrator_intent: 'feasibility' },
      { input: 'User-provided business question', research: { enabled: true } },
      {
        input: 'Default',
        values: { project_brief: 'Office supplies distribution', country_code: 'SA', locality_name: 'Jeddah' },
        research: {
          enabled: true,
          methodology: 'verified_secondary',
          sources: ['https://example.org/official-data'],
          queryVariants: ['user controlled query']
        }
      }
    );
    expect(request.input).toBe('User-provided business question');
    expect(request.research.sources).toEqual(['https://example.org/official-data']);
    expect(request.research.queryVariants).toEqual(['user controlled query']);
    expect(request.research.methodology).toBe('verified_secondary');
    expect(request.research.query).toContain('Office supplies distribution');
    expect(request.country).toBe('SA');
  });

  test('feasibility adds default research context without supplied research', () => {
    const request = enrichStudiesExecutionRequest(
      feasibility, {}, {},
      { input: 'Fallback', values: { project_name: 'Project Alpha' } }
    );
    expect(request.input).toContain('Project Alpha');
    expect(request.research.topic).toBe('Project Alpha');
    expect(request.research.queryVariants).toEqual(['Project Alpha']);
  });

  test('mandatory market research cannot be disabled by an untrusted request', () => {
    const request = enrichStudiesExecutionRequest(
      market, {}, { research: { enabled: false } },
      { input: 'Competitor study', values: { research_question: 'Competitive landscape' }, research: { enabled: false } }
    );
    expect(request.research.enabled).toBe(true);
    expect(request.forceResearch).toBe(true);
  });


  test('explicit analysis model preserves the original non-native sector classification', () => {
    const request = enrichStudiesExecutionRequest(
      feasibility, { orchestrator_intent: 'feasibility' },
      { sector: 'hospitality', context: { sector: 'hospitality' } },
      {
        input: 'Hotel hospitality project',
        values: {
          sector_code: 'hospitality',
          sector_name: 'الضيافة',
          sector_engine_profile: 'hotel',
          project_name: 'Hospitality study'
        }
      }
    );
    expect(request.sector).toBe('hotel');
    expect(request.values.sector_code).toBe('hospitality');
    expect(request.values.sector_name).toBe('الضيافة');
    expect(request.intent).toBe('feasibility');
  });

  test('a custom sector is not silently mapped to a model without explicit choice', () => {
    const request = enrichStudiesExecutionRequest(
      feasibility, {}, { sector: 'user_sector_123' },
      { values: { sector_code: 'user_sector_123', sector_name: 'قطاع جديد' }, input: 'Study' }
    );
    expect(request.sector).toBe('user_sector_123');
    expect(request.values.sector_name).toBe('قطاع جديد');
  });

  test('no explicit input falls back to generated research query', () => {
    const request = enrichStudiesExecutionRequest(
      feasibility, {}, {},
      { input: 'Service name', values: { project_name: 'Warehouse' } }
    );
    expect(request.input).toContain('Warehouse');
  });
});
