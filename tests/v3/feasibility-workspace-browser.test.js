/** @jest-environment node */
const { chromium } = require('playwright');
const { resolveBaseUrl, stopSpawnedServer } = require('../helpers/local-dev-server');

jest.setTimeout(180000);
let browser;
let baseUrl;

beforeAll(async () => {
  baseUrl = await resolveBaseUrl();
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  if (browser) await browser.close();
  stopSpawnedServer();
});

async function openFeasibility({ mobile = false, projectId = null } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }
  });
  await context.addInitScript(() => {
    const user = { id: 'feasibility-browser-fixture', email: 'fixture@example.com' };
    window.BondsAuth = {
      ensureEnv: async () => {},
      getUser: async () => ({ data: { user } }),
      getSupabase: () => ({
        auth: {
          getSession: async () => ({ data: { session: { access_token: 'isolated-test-token', user } } })
        }
      })
    };
  });
  const page = await context.newPage();
  await page.route('**/bonds-auth-2026.js*', route => route.abort());
  await page.route('**/api/v3/services/feasibility_studies*', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        service: {
          code: 'feasibility_studies', name_ar: 'دراسات الجدوى', name_en: 'Feasibility studies',
          short_description_ar: 'دراسة جدوى', default_route_ar: '/services#feasibility',
          delivery_type: 'hybrid'
        },
        workspace: { type: 'studies-valuation', mode: 'execute', ready: true },
        intake: { supported: false, execution_mode: 'capability_plan' },
        capabilities: [{ capability_code: 'feasibility_run' }, { capability_code: 'orchestrator_run' }],
        procedures: [], requirements: [], deliverables: [], dependencies: [], pricing: [],
        form: null
      })
    })
  );
  await page.route('**/api/v3/catalog/countries*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      countries: [{ code: 'SA', name_ar: 'السعودية', name_en: 'Saudi Arabia' }]
    }) })
  );
  await page.route('**/api/v3/catalog/cities*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"cities":[]}' })
  );
  await page.route('**/api/v3/investment-taxonomy*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"sectors":[],"activities":[]}' })
  );
  const workspaceUrl = new URL('/my-bonds/workspace/?service=feasibility_studies&country=SA', baseUrl);
  if (projectId) workspaceUrl.searchParams.set('project_id', projectId);
  await page.goto(workspaceUrl.toString(), {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.locator('input[name="project_name"]').waitFor({ state: 'visible' });
  return { page, context };
}

describe('feasibility study browser acceptance — isolated service contracts', () => {
  test('run button reports an incomplete required project description instead of silently doing nothing', async () => {
    const { page, context } = await openFeasibility();
    await page.locator('input[name="project_name"]').fill('Small business');
    await page.locator('select[name="project_size"]').selectOption('small');
    await page.locator('#srSubmit').click();
    await page.locator('#srStatus.err').waitFor({ state: 'visible' });
    expect(await page.locator('#srStatus').innerText()).toContain('أكمل الحقل المطلوب');
    expect(await page.locator('textarea[name="project_brief"]').evaluate(e => e.validity.valueMissing)).toBe(true);
    await context.close();
  });

  test('market information action runs governed market_research and reports only returned evidence', async () => {
    const { page, context } = await openFeasibility();
    let payload;
    await page.route('**/api/v3/services/execute', async route => {
      payload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({
          executed: true,
          result: {
            research: {
              status:'completed',
              evidence:[
                {evidence_code:'market_size',source_url:'https://example.org/market-study'}
              ]
            }
          }
        })
      });
    });
    await page.locator('input[name="project_name"]').fill('Office coffee supply');
    await page.locator('textarea[name="project_brief"]').fill('Supply coffee, tea, water and cleaning products to commercial offices');
    await page.locator('#srFeasibilityResearchButton').click();
    await page.locator('#srFeasibilityMarketEvidence a').waitFor({state:'visible'});
    expect(payload.service_code).toBe('market_research');
    expect(payload.research.enabled).toBe(true);
    expect(payload.values.project_name).toBe('Office coffee supply');
    expect(await page.locator('#srFeasibilityMarketEvidence').innerText()).toContain('market_size');
    expect(await page.locator('#srFeasibilityMarketEvidence a').getAttribute('href')).toBe('https://example.org/market-study');
    expect(await page.locator('input[name="annual_revenue"]').inputValue()).toBe('');
    await context.close();
  });

  test('market information action reports absence of evidence and leaves revenue blank', async () => {
    const { page, context } = await openFeasibility();
    await page.route('**/api/v3/services/execute', route => route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({executed:true,result:{research:{status:'insufficient_evidence',evidence:[]}}})
    }));
    await page.locator('input[name="project_name"]').fill('Office supplies');
    await page.locator('textarea[name="project_brief"]').fill('Office consumable supplies');
    await page.locator('#srFeasibilityResearchButton').click();
    await page.waitForFunction(()=>document.querySelector('#srFeasibilityMarketEvidence')?.textContent?.includes('لم يتم إرجاع أدلة'));
    expect(await page.locator('input[name="annual_revenue"]').inputValue()).toBe('');
    await context.close();
  });

  test('offers study inputs rather than unsupported file import, submits typed cash flows and displays unapproved metrics', async () => {
    const { page, context } = await openFeasibility();
    let payload = null;
    await page.route('**/api/v3/services/execute', async route => {
      payload = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          ok: true, executed: true,
          result: {
            confidence: { decisionIntegrity: {
              status: 'blocked', groundedCoverage: 40, blockedDecisionEngines: ['risk']
            } },
            engineResults: { feasibility: { metrics: {
              npv: 124500, irr_pct: 21, payback_periods: 3.2,
              total_cash_inflows: 800000, total_cash_outflows: 100000, net_cash_flows: 700000
            } } }
          }
        })
      });
    });
    expect(await page.locator('#srFinancialIntake').count()).toBe(0);
    expect(await page.locator('#srDetails').isVisible()).toBe(true);
    await page.locator('input[name="project_name"]').fill('Acceptance project');
    await page.locator('select[name="project_size"]').selectOption('large');
    await page.locator('input[name="investment_amount"]').fill('50000000');
    await page.locator('input[name="years"]').fill('3');
    await page.locator('input[name="discount_rate_pct"]').fill('10');
    await page.locator('textarea[name="cash_flows_text"]').fill('1000000;1200000;1400000');
    await page.locator('textarea[name="project_brief"]').fill('Isolated financial study browser test');
    await page.locator('#srFeasibilityReviewButton').click();
    expect(await page.locator('#srFeasibilityReview').isVisible()).toBe(true);
    expect(await page.locator('#srFeasibilityReview').innerText()).toContain('Acceptance project');
    await page.locator('#srFeasibilitySaveDraft').click();
    expect(await page.locator('#srStatus').innerText()).toContain('حُفظت المسودة');
    await page.locator('#srSubmit').click();
    await page.locator('#srExecutionResult').waitFor({ state: 'visible' });
    expect(payload).toBeTruthy();
    expect(payload.values.cash_flows).toEqual([1000000, 1200000, 1400000]);
    expect(payload.values.discount_rate).toBeCloseTo(0.1);
    expect(payload.values.project_size).toBe('large');
    expect(await page.locator('#srExecutionResult').innerText()).toContain('NPV');
    expect(await page.locator('#srExecutionResult').innerText()).toContain('غير معتمدة');
    expect(await page.locator('#srDownloadExecution').isVisible()).toBe(true);
    expect(await page.locator('#srSuccessLink').isVisible()).toBe(true);
    expect(await page.locator('#srStatus').innerText()).toContain('لم يُربط المخرج بمشروع');
    await context.close();
  });

  test('loads only account-owned project choices and retains the draft after linking', async () => {
    const { page, context } = await openFeasibility();
    const projectId = '11111111-1111-4111-8111-111111111111';
    await page.route('**/api/v3/projects', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ projects: [{ id: projectId, name: 'Owned Project' }] }) })
    );
    await page.locator('input[name="project_name"]').fill('Linked feasibility draft');
    await page.locator('select[name="project_size"]').selectOption('small');
    await page.locator('#srFeasibilityListProjects').click();
    await page.locator('#srFeasibilityProjectSelect').waitFor({ state: 'visible' });
    expect(await page.locator('#srFeasibilityProjectSelect option').allTextContents())
      .toContain('Owned Project');
    await page.locator('#srFeasibilityProjectSelect').selectOption(projectId);
    await Promise.all([
      page.waitForURL(url => url.searchParams.get('project_id') === projectId),
      page.locator('#srFeasibilityLinkProject').click()
    ]);
    await page.locator('input[name="project_name"]').waitFor({ state: 'visible' });
    expect(await page.locator('input[name="project_name"]').inputValue()).toBe('Linked feasibility draft');
    expect(await page.locator('select[name="project_size"]').inputValue()).toBe('small');
    await context.close();
  });

  test('loads archived feasibility artifacts for the linked project and downloads exact saved values', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const artifactId = '22222222-2222-4222-8222-222222222222';
    const { page, context } = await openFeasibility({ projectId });
    let requestedUrl = '';
    await page.route('**/api/v3/investment-context/artifacts*', route => {
      requestedUrl = route.request().url();
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ artifacts: [
          { id:artifactId,project_id:projectId,artifact_type:'feasibility',status:'saved',
            title:'Saved Feasibility Study',inputs:{initial_investment:100000},
            results:{ok:true,executed:true},created_at:'2026-11-21T00:00:00Z' },
          { id:'33333333-3333-4333-8333-333333333333',
            project_id:'44444444-4444-4444-8444-444444444444',
            artifact_type:'feasibility',status:'saved',title:'Other project study' }
        ] })
      });
    });
    await page.locator('#srFeasibilityHistoryButton').click();
    await page.locator('#srFeasibilityStudyHistory').waitFor({ state:'visible' });
    const history = await page.locator('#srFeasibilityStudyHistory').innerText();
    expect(requestedUrl).toContain('project_id=' + projectId);
    expect(history).toContain('Saved Feasibility Study');
    expect(history).not.toContain('Other project study');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-study-artifact="' + artifactId + '"]').click()
    ]);
    expect(download.suggestedFilename()).toBe('bonds-feasibility-' + artifactId + '.json');
    await context.close();
  });

  test('rejects invalid annual cash flows before execution and remains usable on mobile', async () => {
    const { page, context } = await openFeasibility({ mobile: true });
    let executed = false;
    await page.route('**/api/v3/services/execute', async route => {
      executed = true;
      await route.fulfill({ status: 500, body: '{}' });
    });
    await page.locator('input[name="project_name"]').fill('Mobile validation');
    await page.locator('select[name="project_size"]').selectOption('mega');
    await page.locator('textarea[name="project_brief"]').fill('Mobile study');
    await page.locator('textarea[name="cash_flows_text"]').fill('100;;200');
    await page.locator('input[name="discount_rate_pct"]').fill('10');
    await page.locator('#srSubmit').click();
    await page.locator('#srStatus.err').waitFor({ state: 'visible' });
    expect(executed).toBe(false);
    expect(await page.locator('#srStatus').innerText()).toContain('التدفقات النقدية غير صالحة');
    expect(await page.locator('#srSubmit').isEnabled()).toBe(true);
    await context.close();
  });
});
