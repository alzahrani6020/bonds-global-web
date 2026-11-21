'use strict';

const { enrichStudiesExecutionRequest } = require('../../lib/services/studies-workspace-bindings');

const feasibility = { code: 'feasibility_studies' };
const market = { code: 'market_research' };

describe('studies execution preserves explicitly supplied input and research', () => {
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

  test('no explicit input falls back to generated research query', () => {
    const request = enrichStudiesExecutionRequest(
      feasibility, {}, {},
      { input: 'Service name', values: { project_name: 'Warehouse' } }
    );
    expect(request.input).toContain('Warehouse');
  });
});
