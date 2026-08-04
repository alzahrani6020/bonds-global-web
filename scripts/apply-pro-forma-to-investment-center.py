#!/usr/bin/env python3
"""
Apply shared Pro-Forma renderer to investment-center calculators.

Usage:
  python scripts/apply-pro-forma-to-investment-center.py --dry-run
  python scripts/apply-pro-forma-to-investment-center.py

What it does:
  - Scans calculators/investment-center/*.html and en/calculators/investment-center/*.html
  - Skips index.html and water-factory.html
  - For calculators that load investment-engine.js but lack Pro-Forma HTML:
    * Adds pro-forma-renderer.js (and pro-forma-engine.js / investment-risk-engine.js if missing)
    * Injects the Pro-Forma HTML section before </main>
    * Replaces the isProFormaSector rendering block with ProFormaRenderer.render
  - Reports changes per file
"""

import argparse
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

AR_PRO_FORMA_HTML = """      <!-- Pro-Forma Financial Statements -->
      <div class="pro-forma-statements" style="margin: 1.5rem 0;">
        <h3>القوائم المالية التقديرية (Pro-Forma)</h3>
        <div class="pro-forma-summary" style="background: rgba(212,168,83,0.08); border: 1px solid rgba(212,168,83,0.2); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1rem;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
            <div><strong>إجمالي الإيرادات</strong><br><span id="pfTotalRevenue">--</span></div>
            <div><strong>صافي الربح</strong><br><span id="pfTotalNetIncome">--</span></div>
            <div><strong>NPV</strong><br><span id="pfNpv">--</span></div>
            <div><strong>IRR</strong><br><span id="pfIrr">--</span></div>
            <div><strong>التمويل المطلوب</strong><br><span id="pfFundingGap">--</span></div>
            <div><strong>التوسعات الرأسمالية</strong><br><span id="pfStepCapex">--</span></div>
          </div>
        </div>

        <div id="capacityExpansionsPanel" style="margin-bottom: 1rem; display: none;">
          <h4 style="color: var(--gold);">جدول التوسعات الرأسمالية</h4>
          <div style="overflow-x: auto;">
            <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: right; padding: 0.5rem;">الشهر</th>
                  <th style="text-align: center; padding: 0.5rem;">الطاقة الجديدة</th>
                  <th style="text-align: center; padding: 0.5rem;">التكلفة</th>
                </tr>
              </thead>
              <tbody id="capacityExpansionsBody"></tbody>
            </table>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">منحنى التدفق النقدي التراكمي (J-Curve)</h4>
          <div style="height: 280px; position: relative;">
            <canvas id="proFormaCashCurveChart"></canvas>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">تحليل الحساسية على NPV/IRR</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">تأثير تغير السعر والحجم على قيمة المشروع.</p>
          <div style="height: 260px; position: relative;">
            <canvas id="proFormaSensitivityChart"></canvas>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">محاكاة مونت كارلو للمخاطر</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">1000 سيناريو عشوائي للسعر والتكلفة والحجم.</p>
          <div class="monte-carlo-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>نسبة النجاح (NPV&gt;0)</strong><br><span id="mcSuccessRate">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>متوسط NPV</strong><br><span id="mcMeanNpv">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>وسيط NPV</strong><br><span id="mcMedianNpv">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>P5 - P95 NPV</strong><br><span id="mcNpvRange">--</span></div>
          </div>
          <div class="monte-carlo-risk" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>VaR 95% (خسارة قصوى)</strong><br><span id="mcVar95">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>CVaR 95% (متوسط الذيل)</strong><br><span id="mcCvar95">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>VaR 99% (خسارة قصوى)</strong><br><span id="mcVar99">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>CVaR 99% (متوسط الذيل)</strong><br><span id="mcCvar99">--</span></div>
          </div>
          <div style="height: 260px; position: relative;">
            <canvas id="monteCarloHistogramChart"></canvas>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">قائمة الدخل السنوية</h4>
          <div style="overflow-x: auto;">
            <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: right; padding: 0.5rem;">البند</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 1</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 2</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 3</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 4</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 5</th>
                </tr>
              </thead>
              <tbody id="proFormaIncomeBody"></tbody>
            </table>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">قائمة التدفقات النقدية السنوية</h4>
          <div style="overflow-x: auto;">
            <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: right; padding: 0.5rem;">البند</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 1</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 2</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 3</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 4</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 5</th>
                </tr>
              </thead>
              <tbody id="proFormaCashflowBody"></tbody>
            </table>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">الميزانية العمومية السنوية</h4>
          <div style="overflow-x: auto;">
            <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: right; padding: 0.5rem;">البند</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 1</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 2</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 3</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 4</th>
                  <th style="text-align: center; padding: 0.5rem;">السنة 5</th>
                </tr>
              </thead>
              <tbody id="proFormaBalanceBody"></tbody>
            </table>
          </div>
        </div>
      </div>
"""

EN_PRO_FORMA_HTML = """      <!-- Pro-Forma Financial Statements -->
      <div class="pro-forma-statements" style="margin: 1.5rem 0;">
        <h3>Pro-Forma Financial Statements</h3>
        <div class="pro-forma-summary" style="background: rgba(212,168,83,0.08); border: 1px solid rgba(212,168,83,0.2); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1rem;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
            <div><strong>Total Revenue</strong><br><span id="pfTotalRevenue">--</span></div>
            <div><strong>Net Income</strong><br><span id="pfTotalNetIncome">--</span></div>
            <div><strong>NPV</strong><br><span id="pfNpv">--</span></div>
            <div><strong>IRR</strong><br><span id="pfIrr">--</span></div>
            <div><strong>Funding Gap</strong><br><span id="pfFundingGap">--</span></div>
            <div><strong>Step Capex</strong><br><span id="pfStepCapex">--</span></div>
          </div>
        </div>

        <div id="capacityExpansionsPanel" style="margin-bottom: 1rem; display: none;">
          <h4 style="color: var(--gold);">Capacity Expansion Schedule</h4>
          <div style="overflow-x: auto;">
            <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: left; padding: 0.5rem;">Month</th>
                  <th style="text-align: center; padding: 0.5rem;">New Capacity</th>
                  <th style="text-align: center; padding: 0.5rem;">Cost</th>
                </tr>
              </thead>
              <tbody id="capacityExpansionsBody"></tbody>
            </table>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">Cumulative Cash Flow Curve (J-Curve)</h4>
          <div style="height: 280px; position: relative;">
            <canvas id="proFormaCashCurveChart"></canvas>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">NPV/IRR Sensitivity Analysis</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">Impact of price and volume changes on project value.</p>
          <div style="height: 260px; position: relative;">
            <canvas id="proFormaSensitivityChart"></canvas>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">Monte Carlo Risk Simulation</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">1,000 random scenarios for price, cost, and volume.</p>
          <div class="monte-carlo-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>Success Rate (NPV&gt;0)</strong><br><span id="mcSuccessRate">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>Mean NPV</strong><br><span id="mcMeanNpv">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>Median NPV</strong><br><span id="mcMedianNpv">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>P5 - P95 NPV</strong><br><span id="mcNpvRange">--</span></div>
          </div>
          <div class="monte-carlo-risk" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>VaR 95%</strong><br><span id="mcVar95">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>CVaR 95%</strong><br><span id="mcCvar95">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>VaR 99%</strong><br><span id="mcVar99">--</span></div>
            <div style="background: rgba(16,24,45,0.6); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem;"><strong>CVaR 99%</strong><br><span id="mcCvar99">--</span></div>
          </div>
          <div style="height: 260px; position: relative;">
            <canvas id="monteCarloHistogramChart"></canvas>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">Yearly Income Statement</h4>
          <div style="overflow-x: auto;">
            <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: left; padding: 0.5rem;">Item</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 1</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 2</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 3</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 4</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 5</th>
                </tr>
              </thead>
              <tbody id="proFormaIncomeBody"></tbody>
            </table>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">Yearly Cash Flow Statement</h4>
          <div style="overflow-x: auto;">
            <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: left; padding: 0.5rem;">Item</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 1</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 2</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 3</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 4</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 5</th>
                </tr>
              </thead>
              <tbody id="proFormaCashflowBody"></tbody>
            </table>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--gold);">Yearly Balance Sheet</h4>
          <div style="overflow-x: auto;">
            <table class="pro-forma-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: left; padding: 0.5rem;">Item</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 1</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 2</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 3</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 4</th>
                  <th style="text-align: center; padding: 0.5rem;">Year 5</th>
                </tr>
              </thead>
              <tbody id="proFormaBalanceBody"></tbody>
            </table>
          </div>
        </div>
      </div>
"""

RENDER_CALL = """      // Pro-Forma Financial Statements
      if (window.ProFormaRenderer && window.ProFormaRenderer.render) {
        window.ProFormaRenderer.render(inputs, { sector: sectorId, isAr, formatNumber });
      }
"""


def is_arabic_file(path: Path) -> bool:
    return "en/" not in str(path.as_posix()).lower()


def rel_to_investment_center(path: Path) -> str:
    """Return relative path from HTML file to calculators/investment-center/."""
    if is_arabic_file(path):
        return "./"
    return "../../../calculators/investment-center/"


def has_pro_forma_html(text: str) -> bool:
    return 'id="pfTotalRevenue"' in text or 'id="proFormaIncomeBody"' in text or "pro-forma-statements" in text


def has_script(text: str, script_name: str) -> bool:
    return script_name in text


def inject_scripts(text: str, rel: str) -> str:
    scripts_to_add = []
    if not has_script(text, "pro-forma-engine.js"):
        scripts_to_add.append(f'  <script src="{rel}pro-forma-engine.js?v=1"></script>')
    if not has_script(text, "investment-risk-engine.js"):
        scripts_to_add.append(f'  <script src="{rel}investment-risk-engine.js?v=1"></script>')
    if not has_script(text, "pro-forma-renderer.js"):
        scripts_to_add.append(f'  <script src="{rel}pro-forma-renderer.js?v=1"></script>')

    if not scripts_to_add:
        return text

    # Try to insert before decision-intelligence.js or shared-export.js
    for anchor in [f'<script src="{rel}decision-intelligence.js', '<script src="../../calculators/shared-export.js">', '<script src="../../../calculators/shared-export.js">']:
        if anchor in text:
            insertion = "\n".join(scripts_to_add) + "\n" + anchor
            text = text.replace(anchor, insertion, 1)
            return text

    # Fallback: insert before </body>
    if "</body>" in text:
        text = text.replace("</body>", "\n".join(scripts_to_add) + "\n</body>", 1)
    return text


def inject_html(text: str, is_ar: bool) -> str:
    if has_pro_forma_html(text):
        return text
    html = AR_PRO_FORMA_HTML if is_ar else EN_PRO_FORMA_HTML
    # Insert inside resultsSection, after decisionIntelligencePanel and before resultsSection closes.
    marker = '      </div>\n    </div>\n  </main>\n\n  <div id="site-footer">'
    if marker in text:
        text = text.replace(marker, '      </div>\n\n' + html + '    </div>\n  </main>\n\n  <div id="site-footer">', 1)
        return text
    # Fallback: insert before </main> that precedes site-footer
    marker2 = '</main>\n\n  <div id="site-footer">'
    if marker2 in text:
        text = text.replace(marker2, html + '  </main>\n\n  <div id="site-footer">', 1)
        return text
    # Last fallback: any </main>
    if "</main>" in text:
        text = text.replace("</main>", html + '  </main>', 1)
    return text


def replace_render_call(text: str) -> str:
    """Replace isProFormaSector block with ProFormaRenderer.render."""
    pattern = re.compile(
        r"if \(isProFormaSector\(sectorId\)\) \{\s*"
        r"if \(sectorId === 'water-factory'\) \{\s*"
        r"renderWaterFactoryAdvanced\(inputs, engineInputs, result\);\s*"
        r"\} else \{\s*"
        r"renderGenericProFormaAdvanced\(inputs, engineInputs, result\);\s*"
        r"\}\s*"
        r"renderExecutiveSummary\(inputs, engineInputs, result\);\s*"
        r"\}",
        re.DOTALL
    )
    replacement = RENDER_CALL.strip() + "\n      if (typeof renderExecutiveSummary === 'function') {\n        renderExecutiveSummary(inputs, engineInputs, result);\n      }"
    new_text, count = pattern.subn(replacement, text)
    return new_text, count > 0


def add_render_call_generic(text: str) -> str:
    """For files without isProFormaSector pattern, insert render call before resultsSection reveal."""
    if "window.ProFormaRenderer.render" in text:
        return text
    marker = "      document.getElementById('resultsSection').classList.remove('hidden');"
    if marker in text:
        text = text.replace(marker, RENDER_CALL + "\n" + marker, 1)
        return text
    return text


def process_file(path: Path, dry_run: bool) -> dict:
    raw = path.read_bytes()
    newline = "\r\n" if b"\r\n" in raw else ("\n" if b"\n" in raw else None)
    text = raw.decode("utf-8")
    if newline:
        text = text.replace(newline, "\n")

    is_ar = is_arabic_file(path)
    rel = rel_to_investment_center(path)

    result = {"path": path, "changed": False, "notes": []}

    # Skip files not using new template
    if "investment-engine.js" not in text:
        result["notes"].append("skip: not using investment-engine.js")
        return result

    if has_pro_forma_html(text) and has_script(text, "pro-forma-renderer.js"):
        result["notes"].append("skip: already has Pro-Forma renderer")
        return result

    original = text

    # Add scripts
    text = inject_scripts(text, rel)

    # Add HTML
    text = inject_html(text, is_ar)

    # Replace or add render call
    text, replaced = replace_render_call(text)
    if not replaced:
        text = add_render_call_generic(text)

    if text == original:
        result["notes"].append("no changes needed")
        return result

    result["changed"] = True
    result["notes"].append("applied Pro-Forma renderer")

    if not dry_run:
        path.write_text(text.replace("\n", newline) if newline else text, encoding="utf-8")

    return result


def main():
    parser = argparse.ArgumentParser(description="Apply shared Pro-Forma renderer to investment-center calculators.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files.")
    args = parser.parse_args()

    files = []
    for base in [ROOT / "calculators" / "investment-center", ROOT / "en" / "calculators" / "investment-center"]:
        if base.exists():
            files.extend(sorted(base.glob("*.html")))

    skipped = []
    changed = []
    for path in files:
        if path.name in {"index.html", "water-factory.html"}:
            skipped.append((path, "index or water-factory"))
            continue
        result = process_file(path, args.dry_run)
        if result["changed"]:
            changed.append(path)
            print(f"  {'[DRY-RUN] ' if args.dry_run else ''}updated: {path.relative_to(ROOT)}")
        else:
            reason = "; ".join(result["notes"])
            skipped.append((path, reason))

    print(f"\nSummary: {len(changed)} changed, {len(skipped)} skipped")
    if not changed:
        print("No files needed updating.")


if __name__ == "__main__":
    main()
