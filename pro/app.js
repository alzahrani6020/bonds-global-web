document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyze-btn');
  const resultSection = document.getElementById('result-section');
  const form = document.getElementById('pro-form');

  analyzeBtn && analyzeBtn.addEventListener('click', async () => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const payload = {
      sector: document.getElementById('sector').value,
      activity: document.getElementById('activity').value,
      capital: parseFloat(document.getElementById('capital').value),
      revenue: parseFloat(document.getElementById('revenue').value)
    };

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'جاري التحليل...';

    try {
      const res = await fetch('/api/pro-calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      localStorage.setItem('bonds_pro_last_input', JSON.stringify(payload));
      renderResult(data.result, data.ai);
      resultSection.classList.add('active');
      resultSection.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert('حدث خطأ: ' + err.message);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'حلّل المشروع مجاناً';
    }
  });

  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plan = btn.dataset.plan;
      const email = prompt('أدخل بريدك الإلكتروني لإرسال رابط الدفع:');
      if (!email || !email.includes('@')) return;
      try {
        btn.disabled = true;
        btn.textContent = 'جاري التحويل...';
        const res = await fetch('/api/pro-stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, email })
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else throw new Error(data.error || 'Checkout failed');
      } catch (err) {
        alert('خطأ في الدفع: ' + err.message);
        btn.disabled = false;
        btn.textContent = plan === 'monthly' ? 'ابدأ الاشتراك' : 'اشترِ التقرير';
      }
    });
  });
});

function renderResult(result, insight) {
  const score = result.score;
  const ring = document.getElementById('score-ring');
  ring.style.setProperty('--score-deg', `${score * 3.6}deg`);
  document.getElementById('score-value').textContent = score;
  document.getElementById('verdict-text').textContent = insight.verdict;
  document.getElementById('verdict-desc').textContent = insight.summary;

  const profitEl = document.getElementById('kpi-profit');
  profitEl.textContent = Math.round(result.monthlyProfit).toLocaleString('ar-SA') + ' ر.س';
  profitEl.className = 'value ' + (result.monthlyProfit >= 0 ? 'positive' : 'negative');

  const roiEl = document.getElementById('kpi-roi');
  roiEl.textContent = result.roiMonths > 0 ? result.roiMonths + ' شهر' : 'غير محدود';

  document.getElementById('kpi-risk').textContent = result.sectorRisk;

  const recList = document.getElementById('recommendations');
  recList.innerHTML = '';
  insight.recommendations.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    recList.appendChild(li);
  });
}
