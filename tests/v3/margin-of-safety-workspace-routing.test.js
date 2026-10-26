'use strict';

const fs=require('fs');
const path=require('path');

describe('margin of safety service routing',()=>{
  const migration=fs.readFileSync(
    path.join(process.cwd(),'supabase/migrations/20261027006600_route_margin_of_safety_to_break_even.sql'),
    'utf8'
  );
  const ar=fs.readFileSync(path.join(process.cwd(),'calculators/break-even.html'),'utf8');
  const en=fs.readFileSync(path.join(process.cwd(),'en/calculators/break-even.html'),'utf8');

  test('fails closed unless the verified request-only service is present',()=>{
    expect(migration).toContain('if candidate_count <> 1 then');
    expect(migration).toContain("s.code='margin_of_safety_analysis'");
    expect(migration).toContain("p.execution_mode='request_only'");
  });

  test('reuses the existing bilingual break-even workspace',()=>{
    expect(migration).toContain("default_route_ar='/calculators/break-even.html'");
    expect(migration).toContain("default_route_en='/en/calculators/break-even.html'");
    expect(ar).toContain('هامش الأمان');
    expect(en.toLowerCase()).toContain('margin');
  });

  test('does not falsely promote the service to API automation',()=>{
    expect(migration).toContain("execution_status='partially_automated'");
    expect(migration).not.toContain("execution_mode='capability_plan'");
    expect(migration).not.toContain('service_capability_map');
    expect(migration).toContain("'direct_tool_workspace_no_api_automation'");
  });
});
