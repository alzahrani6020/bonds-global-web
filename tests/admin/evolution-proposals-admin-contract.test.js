'use strict';

const fs=require('fs');
const path=require('path');

const source=fs.readFileSync(path.join(process.cwd(),'v3','api','admin.js'),'utf8');

describe('evolution proposals admin review contract',()=>{
  test('resource is routed only after the shared admin access check',()=>{
    const authIndex=source.indexOf('const authError = await requireAdmin(req);');
    const routeIndex=source.indexOf("resource === 'evolution-proposals'");
    expect(authIndex).toBeGreaterThan(-1);
    expect(routeIndex).toBeGreaterThan(authIndex);
  });

  test('GET and POST are the only supported methods',()=>{
    expect(source).toContain("if (!['GET','POST'].includes(req.method))");
  });

  test('POST invokes learning analysis rather than approval or execution',()=>{
    expect(source).toContain('analyzeProposedEvolution({');
    expect(source).toContain('analysis_only:true');
    expect(source).toContain('execution_authorized:false');
    expect(source).toContain('auto_execute:false');
    expect(source).toContain('code_mutation:false');
    expect(source).toContain('status_change:false');
  });

  test('review endpoint uses a sanitized proposal projection',()=>{
    expect(source).toContain('listEvolutionProposals({');
    expect(source).not.toContain("evolution-proposals/execute");
    expect(source).not.toContain("evolution-proposals/approve");
  });
});
