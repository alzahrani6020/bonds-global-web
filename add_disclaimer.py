import os

disclaimer_ar = '''  <!-- Disclaimer -->
  <section style="background: var(--bg-secondary); padding: var(--space-8) 0; border-top: 1px solid var(--border);">
    <div class="container">
      <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); backdrop-filter: blur(16px); text-align: center;">
        <h4 style="font-size: var(--text-base); font-weight: 800; margin-bottom: var(--space-3); color: var(--gold);">📌 ملاحظة من بوندز</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8; margin-bottom: var(--space-3);">
          حاسبات بوندز تمنحك <strong>رؤية مالية أولية ذكية</strong> بناءً على البيانات التي تدخلها؛ تساعدك على تقييم فرص مشروعك قبل اتخاذ القرار.
        </p>
        <div style="display: flex; justify-content: center; gap: var(--space-6); align-items: center; flex-wrap: wrap; margin-bottom: var(--space-4);">
          <div style="text-align: right; direction: rtl;">
            <h5 style="font-size: 0.9rem; font-weight: 700; color: var(--gold); margin-bottom: var(--space-2);">ماذا بعد؟</h5>
            <ol style="font-size: 0.85rem; color: var(--text-secondary); line-height: 2; padding-right: var(--space-4); margin: 0;">
              <li>راجع الأرقام التقديرية أعلاه.</li>
              <li>تحدث إلى مستشار Bonds المعتمد.</li>
              <li>احصل على خطة مالية مخصصة.</li>
            </ol>
          </div>
          <div style="text-align: center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://wa.me/966567566616" alt="WhatsApp QR" style="width:100px;height:100px;border-radius:8px;border:1px solid var(--border);">
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: var(--space-2);">امسح للتواصل عبر واتساب</p>
          </div>
        </div>
        <a href="https://wa.me/966567566616" target="_blank" rel="noopener" style="display:inline-block;margin-bottom:var(--space-3);padding:10px 24px;background:#d4a853;color:#1a1a1a;border-radius:24px;text-decoration:none;font-weight:700;">📱 تحدث إلى مستشار</a>
        <div style="margin-top:var(--space-3);padding:var(--space-3);background: var(--bg);border-radius:12px;border-right:3px solid var(--gold);text-align:right;">
          <p style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic; line-height: 1.6; margin: 0;">"ساعدني تقرير بوندز على فهم أرقام مشروعي بوضوح، والاستشارة المخصصة كانت نقطة تحول في قراري الاستثماري."</p>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin: var(--space-2) 0 0 0;">— صاحب مشروع، الرياض</p>
        </div>
        <p style="margin-top:var(--space-3);font-size:0.85rem;color:var(--gold);font-weight:700;">⚡ استشارتك الأولى مجانية — العرض ساري حتى <span class="offer-date-ar"></span>.</p>
        <p style="margin-top:var(--space-2);font-size:0.8rem;color:var(--text-secondary);">انضم لأكثر من 500 صاحب مشروع وشركة ناشئة استخدموا بوندز لبناء نماذجهم المالية.</p>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.6;">
          <strong>Bonds Global</strong> — دراسات جدوى | نماذج مالية | استشارات مالية معتمدة<br>
          bonds-global.com
        </p>
      </div>
    </div>
  </section>

'''

disclaimer_en = '''  <!-- Disclaimer -->
  <section style="background: var(--bg-secondary); padding: var(--space-8) 0; border-top: 1px solid var(--border);">
    <div class="container">
      <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); backdrop-filter: blur(16px); text-align: center;">
        <h4 style="font-size: var(--text-base); font-weight: 800; margin-bottom: var(--space-3); color: var(--gold);">📌 A note from Bonds</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8; margin-bottom: var(--space-3);">
          Bonds calculators give you a <strong>smart initial financial view</strong> based on the data you enter — helping you evaluate your project's opportunity before making a decision.
        </p>
        <div style="display: flex; justify-content: center; gap: var(--space-6); align-items: center; flex-wrap: wrap; margin-bottom: var(--space-4);">
          <div style="text-align: left; direction: ltr;">
            <h5 style="font-size: 0.9rem; font-weight: 700; color: var(--gold); margin-bottom: var(--space-2);">What's next?</h5>
            <ol style="font-size: 0.85rem; color: var(--text-secondary); line-height: 2; padding-left: var(--space-4); margin: 0;">
              <li>Review the estimate figures above.</li>
              <li>Talk to a licensed Bonds advisor.</li>
              <li>Get a customized financial plan.</li>
            </ol>
          </div>
          <div style="text-align: center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://wa.me/966567566616" alt="WhatsApp QR" style="width:100px;height:100px;border-radius:8px;border:1px solid var(--border);">
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: var(--space-2);">Scan to chat on WhatsApp</p>
          </div>
        </div>
        <a href="https://wa.me/966567566616" target="_blank" rel="noopener" style="display:inline-block;margin-bottom:var(--space-3);padding:10px 24px;background:#d4a853;color:#1a1a1a;border-radius:24px;text-decoration:none;font-weight:700;">📱 Talk to an advisor</a>
        <div style="margin-top:var(--space-3);padding:var(--space-3);background: var(--bg);border-radius:12px;border-left:3px solid var(--gold);text-align:left;">
          <p style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic; line-height: 1.6; margin: 0;">"Bonds' report helped me understand my project's numbers clearly, and the personalized consultation was a turning point in my investment decision."</p>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin: var(--space-2) 0 0 0;">— Business owner, Riyadh</p>
        </div>
        <p style="margin-top:var(--space-3);font-size:0.85rem;color:var(--gold);font-weight:700;">⚡ Your first consultation is free — offer valid until <span class="offer-date-en"></span>.</p>
        <p style="margin-top:var(--space-2);font-size:0.8rem;color:var(--text-secondary);">Join 500+ entrepreneurs and SMEs who built their financial models with Bonds.</p>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.6;">
          <strong>Bonds Global</strong> — Feasibility Studies | Financial Models | Licensed Financial Advisory<br>
          bonds-global.com
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
