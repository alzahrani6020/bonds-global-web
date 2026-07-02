/**
 * Bonds Global — Accessibility Audit (axe-core)
 *
 * Usage:
 *   npm run test:a11y
 *   BASE_URL=http://localhost:3005 npm run test:a11y
 */
const { chromium } = require('playwright');
const axeCore = require('axe-core');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';

const PAGES = [
  { name: 'index-ar', url: '/' },
  { name: 'about-ar', url: '/about.html' },
  { name: 'contact-ar', url: '/contact.html' },
  { name: 'services-ar', url: '/services.html' },
  { name: 'pricing-root-ar', url: '/pricing.html' },
  { name: 'calculator-ar', url: '/calculator.html' },
  { name: 'manufacturing-ar', url: '/sectors/manufacturing.html' },
  { name: 'distressed-recovery-study-ar', url: '/distressed-recovery-study.html' },
  { name: 'investment-center-ar', url: '/calculators/investment-center/index.html' },
  { name: 'blog-ar', url: '/blog/index.html' },
  { name: 'v3-project-ar', url: '/v3/project' },
  { name: 'cash-flow-ar', url: '/calculators/cash-flow.html' },
  { name: 'restaurant-ar', url: '/calculators/restaurant.html' },
  { name: 'pricing-ar', url: '/calculators/pricing.html' },
  { name: 'loan-ar', url: '/calculators/loan.html' },
  { name: 'feasibility-ar', url: '/calculators/feasibility.html' },
  { name: 'dish-margin-ar', url: '/calculators/dish-margin.html' },
  { name: 'menu-engineering-ar', url: '/calculators/menu-engineering.html' },
  { name: 'medical-viability-ar', url: '/calculators/medical-viability.html' },
  { name: 'invoice-analyzer-ar', url: '/calculators/invoice-analyzer.html' },
  { name: 'v3-portfolio-ar', url: '/v3/portfolio' },
  { name: 'client-login-ar', url: '/client/login.html' },
  { name: 'index-en', url: '/en/index.html' },
  { name: 'valuation-ar', url: '/valuation/index.html' },
  { name: 'valuation-en', url: '/en/valuation/index.html' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let totalViolations = 0;
  const reports = [];

  for (const p of PAGES) {
    const page = await context.newPage();
    const fullUrl = new URL(p.url, BASE_URL).toString();

    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: axeCore.source });

      const result = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        return await axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
          },
          resultTypes: ['violations'],
        });
      });

      const criticalOrSerious = result.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      const count = criticalOrSerious.reduce((sum, v) => sum + v.nodes.length, 0);
      totalViolations += count;

      reports.push({ name: p.name, url: fullUrl, violations: criticalOrSerious });

      if (criticalOrSerious.length) {
        console.log(`\n❌ ${p.name} — ${count} critical/serious violation(s)`);
        criticalOrSerious.forEach((v) => {
          console.log(`   • ${v.id} (${v.impact}): ${v.help}`);
          v.nodes.forEach((node) => {
            const target = Array.isArray(node.target) ? node.target.join(' ') : node.target;
            console.log(`     - ${target}`);
          });
        });
      } else {
        console.log(`✅ ${p.name}: no critical/serious violations`);
      }
    } catch (err) {
      console.error(`❌ ${p.name}: ${err.message}`);
      totalViolations++;
    } finally {
      await page.close();
    }
  }

  await browser.close();

  if (totalViolations) {
    console.error(`\n❌ ${totalViolations} critical/serious accessibility violation(s) found.`);
    process.exit(1);
  }

  console.log('\n✅ No critical/serious accessibility violations found.');
})();
