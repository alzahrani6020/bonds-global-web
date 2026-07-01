/**
 * BONDS Investment Intelligence — Document Generator
 *
 * D.1 scope: generate a printable/interactive HTML investment memorandum.
 * PDF/Print is handled by the browser (jsPDF/html2canvas) or print stylesheet.
 */

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMetrics(metrics) {
  if (!Array.isArray(metrics) || !metrics.length) return '';
  return `
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
      <tbody>
        ${metrics.map(m => `
          <tr style="border-bottom:1px solid rgba(212,168,83,0.2);">
            <td style="padding:8px 0;color:#94a3b8;">${escapeHtml(m.label)}</td>
            <td style="padding:8px 0;text-align:${m.align || 'right'};font-weight:700;color:#e8ecf4;">${escapeHtml(m.value)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderSection(key, section, isAr) {
  if (!section) return '';
  const dir = isAr ? 'rtl' : 'ltr';
  const title = escapeHtml(section.title || key);
  let body = '';

  if (section.text) body += `<p style="line-height:1.7;color:#e8ecf4;">${escapeHtml(section.text)}</p>`;
  if (section.value !== undefined) body += `<p style="font-size:18px;font-weight:700;color:#d4a853;">${escapeHtml(section.value)}</p>`;
  if (section.bullets) body += `<ul style="padding-${isAr ? 'right' : 'left'}:20px;line-height:1.8;">${section.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
  if (section.metrics) body += renderMetrics(section.metrics);
  if (section.scenarios) body += renderMetrics(section.scenarios.map(s => ({ label: s.name, value: s.value })));
  if (section.strengths || section.weaknesses || section.opportunities || section.threats) {
    const parts = [];
    if (section.strengths?.length) parts.push(`<div><strong style="color:#d4a853;">S</strong> ${section.strengths.map(escapeHtml).join(' • ')}</div>`);
    if (section.weaknesses?.length) parts.push(`<div><strong style="color:#d4a853;">W</strong> ${section.weaknesses.map(escapeHtml).join(' • ')}</div>`);
    if (section.opportunities?.length) parts.push(`<div><strong style="color:#d4a853;">O</strong> ${section.opportunities.map(escapeHtml).join(' • ')}</div>`);
    if (section.threats?.length) parts.push(`<div><strong style="color:#d4a853;">T</strong> ${section.threats.map(escapeHtml).join(' • ')}</div>`);
    body += `<div style="line-height:1.8;margin-top:8px;">${parts.join('')}</div>`;
  }
  if (section.milestones) {
    body += `<div style="margin-top:8px;">${section.milestones.map(m => `<div style="margin:6px 0;"><strong>${escapeHtml(m.phase)}:</strong> ${escapeHtml(m.detail)}</div>`).join('')}</div>`;
  }

  return `
    <section id="sec-${key}" style="margin-bottom:28px;" dir="${dir}">
      <h2 style="font-size:18px;color:#d4a853;border-bottom:1px solid rgba(212,168,83,0.3);padding-bottom:8px;margin-bottom:12px;">${title}</h2>
      ${body}
    </section>
  `;
}

function toHtml(memorandum, options = {}) {
  const content = memorandum.content || memorandum.output || {};
  const isAr = (content.language || memorandum.language || 'ar') === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const title = escapeHtml(content.title || 'Investment Memorandum');
  const sections = content.sections || {};
  const readiness = content.readiness || {};
  const confidence = memorandum.confidence_score || memorandum.confidence || 0;

  const sectionHtml = Object.entries(sections)
    .map(([key, section]) => renderSection(key, section, isAr))
    .join('\n');

  const readinessHtml = `
    <div style="background:rgba(16,24,45,0.6);border:1px solid rgba(212,168,83,0.2);border-radius:12px;padding:16px;margin-bottom:24px;" dir="${dir}">
      <h3 style="color:#d4a853;margin-top:0;">${isAr ? 'جاهزية الاستثمار' : 'Investment Readiness'}</h3>
      <p style="font-size:24px;font-weight:800;color:#e8ecf4;margin:8px 0;">${readiness.readinessScore || 0}/100 <span style="font-size:14px;color:#94a3b8;">(${readiness.grade || 'N/A'})</span></p>
      ${readiness.strengths?.length ? `<div><strong style="color:#22c55e;">${isAr ? 'نقاط القوة' : 'Strengths'}</strong><ul>${readiness.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>` : ''}
      ${readiness.weaknesses?.length ? `<div><strong style="color:#ef4444;">${isAr ? 'نقاط الضعف' : 'Weaknesses'}</strong><ul>${readiness.weaknesses.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>` : ''}
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: ${isAr ? "'Vazirmatn', Arial" : "'Inter', Arial"}, sans-serif; background:#0a0f1a; color:#e8ecf4; margin:0; padding:0; }
    .page { max-width:900px; margin:0 auto; padding:32px 24px; }
    header { text-align:center; border-bottom:2px solid #d4a853; padding-bottom:16px; margin-bottom:24px; }
    header h1 { color:#d4a853; font-size:26px; margin:8px 0; }
    header p { color:#94a3b8; margin:0; }
    .confidence-badge { display:inline-block; background:rgba(212,168,83,0.15); color:#d4a853; border:1px solid rgba(212,168,83,0.3); border-radius:20px; padding:4px 14px; font-size:13px; margin-top:8px; }
    footer { margin-top:40px; padding-top:16px; border-top:1px solid rgba(212,168,83,0.2); font-size:12px; color:#94a3b8; text-align:center; }
    @media print { body { background:#fff; color:#000; } .page { padding:0; } header h1 { color:#000; } }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <img src="/assets/bonds-logo-2026.webp" alt="BONDS" style="width:64px;height:auto;" />
      <h1>${title}</h1>
      <p>${isAr ? 'نشرة استثمارية مولدة تلقائياً من بيانات المنصة' : 'Automatically generated investment memorandum from platform data'}</p>
      <div class="confidence-badge">${isAr ? 'درجة الثقة' : 'Confidence'}: ${confidence}%</div>
    </header>
    ${readinessHtml}
    ${sectionHtml}
    <footer>
      ${isAr ? 'تم إنشاؤه بواسطة BONDS Investment Intelligence Suite. جميع الأرقام مبنية على UCP والبيانات الموثقة.' : 'Generated by BONDS Investment Intelligence Suite. All figures are based on UCP and verified data.'}
    </footer>
  </div>
</body>
</html>`;
}

module.exports = { toHtml, renderSection, renderMetrics };
