import os

disclaimer_ar = '''  <!-- Disclaimer -->
  <section style="background: var(--bg-secondary); padding: var(--space-8) 0; border-top: 1px solid var(--border);">
    <div class="container">
      <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); backdrop-filter: blur(16px);">
        <h4 style="font-size: var(--text-base); font-weight: 800; margin-bottom: var(--space-3); color: var(--gold);">⚠️ إخلاء مسؤولية</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8; margin-bottom: var(--space-3);">
          هذه الأدوة <strong>حاسبات تقديرية</strong> تهدف إلى المساعدة في الفهم المالي العام. النتائج تعتمد على المدخلات التي تقدمها، وقد لا تعكس الواقع التشغيلي الدقيق لشركتك بسبب عوامل خارجية (تقلبات السوق، تغيرات التكاليف، الالتزامات غير المتوقعة، الاستهلاك، التضخم، إلخ).
        </p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8;">
          <strong>لا تغني هذه الأدوة عن استشارة محاسب مرخص أو مستشار مالي مؤهل.</strong> إذا كنت تتخذ قرارات استثمارية أو مالية كبيرة، نوصي بشدة بالتواصل مع فريق بوندز للحصول على تحليل مخصص يأخذ بعين الاعتبار بيئة عملك الفعلية.
        </p>
      </div>
    </div>
  </section>

'''

disclaimer_en = '''  <!-- Disclaimer -->
  <section style="background: var(--bg-secondary); padding: var(--space-8) 0; border-top: 1px solid var(--border);">
    <div class="container">
      <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); backdrop-filter: blur(16px);">
        <h4 style="font-size: var(--text-base); font-weight: 800; margin-bottom: var(--space-3); color: var(--gold);">⚠️ Disclaimer</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8; margin-bottom: var(--space-3);">
          These tools are <strong>estimation calculators</strong> intended to assist with general financial understanding. Results depend on the inputs you provide and may not reflect the precise operational reality of your business due to external factors (market fluctuations, cost changes, unexpected obligations, depreciation, inflation, etc.).
        </p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8;">
          <strong>These tools do not replace advice from a licensed accountant or qualified financial advisor.</strong> If you are making major investment or financial decisions, we strongly recommend contacting the Bonds Global team for a customized analysis that takes your actual business environment into account.
        </p>
      </div>
    </div>
  </section>

'''

files = [
    ('calculators/pricing.html', disclaimer_ar),
    ('calculators/cash-flow.html', disclaimer_ar),
    ('calculators/loan.html', disclaimer_ar),
    ('calculators/en/pricing.html', disclaimer_en),
    ('calculators/en/cash-flow.html', disclaimer_en),
    ('calculators/en/loan.html', disclaimer_en),
]

for filepath, disclaimer in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'Disclaimer' in content or 'إخلاء مسؤولية' in content:
        print(f'Skipping {filepath} (already has disclaimer)')
        continue
    content = content.replace('  <footer class="footer">', disclaimer + '  <footer class="footer">')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Added disclaimer to {filepath}')

print('Done!')
