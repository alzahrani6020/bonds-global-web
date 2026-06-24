/**
 * Bonds Calculator Shared Export Utilities
 * PDF, print, and share helpers
 */

// ===== Global event tracking helper =====
window.trackEvent = window.trackEvent || function (name, params) {
  if (typeof window === 'undefined') return;
  if (typeof gtag === 'function') {
    gtag('event', name, params || {});
  }
  if (typeof dataLayer !== 'undefined' && Array.isArray(dataLayer)) {
    var payload = { event: name };
    params = params || {};
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        payload[key] = params[key];
      }
    }
    dataLayer.push(payload);
  }
};

// ===== 1. Update Share Link =====
function updateShareLink(inputId, params) {
  var url = new URL(window.location.href);
  for (var key in params) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      url.searchParams.set(key, params[key]);
    }
  }
  var input = document.getElementById(inputId);
  if (input) input.value = url.toString();
  return url.toString();
}

// ===== 2. Copy Share Link =====
function copyShareLink(inputId) {
  var input = document.getElementById(inputId);
  if (!input) return;
  input.select();
  if (document.execCommand('copy')) {
    trackEvent('share_link_copied', {
      source: window.location.pathname,
      report_session_id: window.bondsReportSessionId || null
    });
    if (window.BondsUI && BondsUI.toast) BondsUI.toast('✅ تم نسخ الرابط!', 'success');
  }
}

// ===== 3. Export Element to PDF (jsPDF + html2canvas) =====
async function exportElementToPDF(options) {
  options = options || {};
  var elementId = options.elementId;
  var filename = options.filename || 'report.pdf';
  var bgColor = options.bgColor || '#ffffff';
  var scale = options.scale || 2;

  var section = document.getElementById(elementId);
  if (!section || section.style.display === 'none') {
    if (window.BondsUI && BondsUI.toast) BondsUI.toast('⚠️ احسب النتائج أولاً', 'warning');
    return false;
  }

  await Promise.all([
    loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf'),
    loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js', 'jspdf-autotable'),
    loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
  ]);

  if (typeof html2canvas === 'undefined') {
    if (window.BondsUI && BondsUI.toast) BondsUI.toast('❌ فشل تحميل html2canvas', 'error');
    return false;
  }

  var canvas = await html2canvas(section, { scale: scale, backgroundColor: bgColor, useCORS: true });
  var imgData = canvas.toDataURL('image/png');
  var { jsPDF } = window.jspdf;
  var pdf = new jsPDF('p', 'mm', 'a4');
  var imgWidth = 210;
  var pageHeight = 297;
  var imgHeight = canvas.height * imgWidth / canvas.width;
  var heightLeft = imgHeight;
  var position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  pdf.save(filename);
  return true;
}

// ===== 4. Open Styled Print Window =====
function openPrintWindow(options) {
  options = options || {};
  var content = options.content || '';
  var title = options.title || 'تقرير';
  var headerTitle = options.headerTitle || title;
  var autoPrint = options.autoPrint !== false;
  var lang = options.lang || 'ar';
  var dir = lang === 'en' ? 'ltr' : 'rtl';
  var dateLocale = lang === 'en' ? 'en-US' : 'ar-SA';
  var siteName = lang === 'en' ? 'Bonds Financial Consulting' : 'بوندز للاستشارات المالية';
  var now = new Date();
  var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  var offerDate = lang === 'en'
    ? lastDay.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : lastDay.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });
  var reportType = options.reportType || 'default';
  var sessionId = 'rpt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  if (typeof window !== 'undefined') {
    window.bondsReportSessionId = sessionId;
  }
  var waText = lang === 'en'
    ? 'Hello Bonds, I viewed my ' + reportType + ' report and would like a free consultation.'
    : 'مرحباً بوندز، شاهدت تقرير ' + reportType + ' وأرغب في الاستشارة المجانية.';
  var waLink = 'https://wa.me/966567566616?text=' + encodeURIComponent(waText);
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(waLink);
  var testimonials = {
    'break-even': {
      ar: 'حاسبة نقطة التعادل ساعدتني في تحديد السعر الصحيح لمنتجي، والاستشارة أكملت الصورة بخطة تسويق واقعية.',
      en: 'The break-even calculator helped me set the right price for my product, and the consultation completed the picture with a realistic marketing plan.'
    },
    'cash-flow': {
      ar: 'رؤية التدفقات النقدية الشهرية غيرت طريقة تخطيطي للمخزون والرواتب ونبهتني لأشهر النقص قبل حدوثها.',
      en: 'The monthly cash flow view changed how I plan inventory and salaries, and warned me about shortfall months before they happened.'
    },
    'loan': {
      ar: 'قارنت بين عروض البنوك بسرعة واخترت القرض الأنسب لمشروعي دون ما يُرهق ميزانيتي.',
      en: 'I compared bank offers quickly and chose the loan that best fit my project without overloading my budget.'
    },
    'pricing': {
      ar: 'ساعدتني حاسبة التسعير في فهم هامش الربح الحقيقي بعد العمولات والضريبة، لم أعد أخمن في الأسعار.',
      en: 'The pricing calculator helped me understand the true profit margin after commissions and tax; I no longer guess prices.'
    },
    'default': {
      ar: 'ساعدني تقرير بوندز على فهم أرقام مشروعي بوضوح، والاستشارة المخصصة كانت نقطة تحول في قراري الاستثماري.',
      en: 'Bonds\' report helped me understand my project\'s numbers clearly, and the personalized consultation was a turning point in my investment decision.'
    }
  };
  var t = testimonials[reportType] || testimonials.default;
  var whatsNext = lang === 'en'
    ? '<strong style="color:#1a1a1a;font-size:13px;display:block;margin-bottom:8px;">What\'s next?</strong><ol style="color:#555;font-size:12px;line-height:2;text-align:left;padding-left:16px;margin:0;"><li>Review the estimate figures above.</li><li>Talk to a licensed Bonds advisor.</li><li>Get a customized financial plan.</li></ol>'
    : '<strong style="color:#1a1a1a;font-size:13px;display:block;margin-bottom:8px;">ماذا بعد؟</strong><ol style="color:#555;font-size:12px;line-height:2;text-align:right;padding-right:16px;margin:0;"><li>راجع الأرقام التقديرية أعلاه.</li><li>تحدث إلى مستشار Bonds المعتمد.</li><li>احصل على خطة مالية مخصصة.</li></ol>';
  var testimonialOffer = lang === 'en'
    ? '<div style="margin-top:16px;padding:12px;background:#fff;border-radius:12px;border-left:3px solid #d4a853;text-align:left;"><p style="font-size:12px;color:#555;font-style:italic;line-height:1.6;margin:0;">"' + t.en + '"</p><p style="font-size:11px;color:#888;margin:8px 0 0 0;">— Business owner, Riyadh</p></div><p style="margin-top:12px;font-size:12px;color:#b45309;font-weight:700;">⚡ Your first consultation is free — offer valid until ' + offerDate + '</p><p style="margin-top:8px;font-size:11px;color:#666;">Join 500+ entrepreneurs and SMEs who built their financial models with Bonds.</p>'
    : '<div style="margin-top:16px;padding:12px;background:#fff;border-radius:12px;border-right:3px solid #d4a853;text-align:right;"><p style="font-size:12px;color:#555;font-style:italic;line-height:1.6;margin:0;">"' + t.ar + '"</p><p style="font-size:11px;color:#888;margin:8px 0 0 0;">— صاحب مشروع، الرياض</p></div><p style="margin-top:12px;font-size:12px;color:#b45309;font-weight:700;">⚡ استشارتك الأولى مجانية — العرض ساري حتى ' + offerDate + '</p><p style="margin-top:8px;font-size:11px;color:#666;">انضم لأكثر من 500 صاحب مشروع وشركة ناشئة استخدموا بوندز لبناء نماذجهم المالية.</p>';
  var disclaimer = lang === 'en'
    ? '<div style="background:#f8f5ef;border:1px solid #d4a853;border-radius:16px;padding:20px;margin-top:30px;text-align:center;"><strong style="color:#1a1a1a;font-size:14px;display:block;margin-bottom:12px;">📌 A note from Bonds</strong><p style="color:#555;font-size:12px;line-height:1.8;margin-bottom:16px;">The figures above are an intelligent estimate based on your data; they give you a strong initial financial view to help you evaluate your project\'s opportunity before you decide.</p><div style="display:flex;justify-content:center;gap:24px;align-items:center;flex-wrap:wrap;margin-bottom:16px;"><div style="text-align:left;direction:ltr;">' + whatsNext + '</div><div style="text-align:center;"><img src="' + qrUrl + '" alt="WhatsApp QR" loading="lazy" style="width:100px;height:100px;border-radius:8px;border:1px solid #ddd;cursor:pointer;" onclick="if(window.opener && window.opener.trackEvent){window.opener.trackEvent(\'click_whatsapp_qr\',{report_type:\'' + reportType + '\',report_session_id:\'' + sessionId + '\'});}else if(typeof gtag===\'function\'){gtag(\'event\',\'click_whatsapp_qr\',{report_type:\'' + reportType + '\',report_session_id:\'' + sessionId + '\'});}"><p style="font-size:10px;color:#777;margin-top:6px;">Scan to chat on WhatsApp</p></div></div><a href="' + waLink + '" target="_blank" rel="noopener" style="display:inline-block;padding:10px 24px;background:#d4a853;color:#1a1a1a;border-radius:24px;text-decoration:none;font-weight:700;font-size:13px;" onclick="if(window.opener && window.opener.trackEvent){window.opener.trackEvent(\'click_whatsapp_cta\',{report_type:\'' + reportType + '\',report_session_id:\'' + sessionId + '\'});}else if(typeof gtag===\'function\'){gtag(\'event\',\'click_whatsapp_cta\',{report_type:\'' + reportType + '\',report_session_id:\'' + sessionId + '\'});}">📱 Talk to an advisor</a><div style="margin-top:16px;font-size:11px;color:#888;"><strong>Bonds Global</strong><br>Feasibility Studies | Financial Models | Licensed Financial Advisory<br>bonds-global.com</div>' + testimonialOffer + '</div>'
    : '<div style="background:#f8f5ef;border:1px solid #d4a853;border-radius:16px;padding:20px;margin-top:30px;text-align:center;"><strong style="color:#1a1a1a;font-size:14px;display:block;margin-bottom:12px;">📌 ملاحظة من بوندز</strong><p style="color:#555;font-size:12px;line-height:1.8;margin-bottom:16px;">الأرقام أعلاه تحليل تقديري ذكي مبني على بياناتك؛ تمنحك رؤية مالية أولية قوية تساعدك على تقييم فرص مشروعك قبل اتخاذ القرار.</p><div style="display:flex;justify-content:center;gap:24px;align-items:center;flex-wrap:wrap;margin-bottom:16px;"><div style="text-align:right;direction:rtl;">' + whatsNext + '</div><div style="text-align:center;"><img src="' + qrUrl + '" alt="WhatsApp QR" loading="lazy" style="width:100px;height:100px;border-radius:8px;border:1px solid #ddd;cursor:pointer;" onclick="if(window.opener && window.opener.trackEvent){window.opener.trackEvent(\'click_whatsapp_qr\',{report_type:\'' + reportType + '\',report_session_id:\'' + sessionId + '\'});}else if(typeof gtag===\'function\'){gtag(\'event\',\'click_whatsapp_qr\',{report_type:\'' + reportType + '\',report_session_id:\'' + sessionId + '\'});}"><p style="font-size:10px;color:#777;margin-top:6px;">امسح للتواصل عبر واتساب</p></div></div><a href="' + waLink + '" target="_blank" rel="noopener" style="display:inline-block;padding:10px 24px;background:#d4a853;color:#1a1a1a;border-radius:24px;text-decoration:none;font-weight:700;font-size:13px;" onclick="if(window.opener && window.opener.trackEvent){window.opener.trackEvent(\'click_whatsapp_cta\',{report_type:\'' + reportType + '\',report_session_id:\'' + sessionId + '\'});}else if(typeof gtag===\'function\'){gtag(\'event\',\'click_whatsapp_cta\',{report_type:\'' + reportType + '\',report_session_id:\'' + sessionId + '\'});}">📱 تحدث إلى مستشار</a><div style="margin-top:16px;font-size:11px;color:#888;"><strong>Bonds Global</strong><br>دراسات جدوى | نماذج مالية | استشارات مالية معتمدة<br>bonds-global.com</div>' + testimonialOffer + '</div>';
  var logoUrl = (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://bonds-global.com') + '/assets/bonds-logo-2026.webp?v=2026';
  var logoHtml = options.hideLogo ? '' : '<img src="' + logoUrl + '" style="width:56px;height:auto;margin-bottom:6px;" alt="Bonds" onerror="this.style.display=\'none\'"/>';
  var h1Text = lang === 'en' ? 'Bonds' : 'بوندز';

  trackEvent('report_print_opened', {
    report_type: reportType,
    lang: lang,
    source: (typeof window !== 'undefined' && window.location ? window.location.pathname : ''),
    report_session_id: sessionId
  });

  var printWindow = window.open('', '_blank');
  if (!printWindow) {
    if (window.BondsUI && BondsUI.toast) {
      var msg = lang === 'en'
        ? '⚠️ Popup blocked. Please allow popups for this site.'
        : '⚠️ تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.';
      BondsUI.toast(msg, 'warning');
    }
    return null;
  }

  printWindow.document.write(
    '<!DOCTYPE html>' +
    '<html dir="' + dir + '">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<title>' + title + ' - Bonds</title>' +
    '<style>' +
    '@import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800;900&display=swap");' +
    '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap");' +
    'body { font-family: ' + (lang === 'en' ? 'Inter' : 'Vazirmatn') + ', Arial, sans-serif; background: #fff; color: #1a1a1a; padding: 32px; max-width: 1100px; margin: 0 auto; line-height: 1.6; }' +
    'h1 { color: #1a1a1a; margin: 0; font-size: 22px; text-align: center; font-weight: 900; }' +
    '.header { text-align: center; border-bottom: 3px solid #d4a853; padding-bottom: 16px; margin-bottom: 24px; }' +
    '.header p { color: #555; margin: 4px 0; font-size: 14px; }' +
    '.header .site-name { font-size: 14px; font-weight: 700; color: #444; letter-spacing: 0.3px; }' +
    '.header .report-title { font-size: 16px; font-weight: 700; color: #222; margin-top: 6px; }' +
    '.header .date-line { color: #888; font-size: 12px; margin-top: 4px; }' +
    'h2 { color: #b88a3a; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-top: 28px; font-size: 17px; font-weight: 800; }' +
    'h3 { color: #444; font-size: 15px; margin-top: 18px; margin-bottom: 8px; font-weight: 700; }' +
    'table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }' +
    'th, td { padding: 10px 12px; border: 1px solid #ddd; text-align: ' + (lang === 'en' ? 'left' : 'right') + '; }' +
    'th { background: #f8f5ef; font-weight: 700; color: #333; }' +
    'tr:nth-child(even) { background: #fafafa; }' +
    'td.num { text-align: ' + (lang === 'en' ? 'right' : 'left') + '; font-family: monospace; direction: ltr; }' +
    '.footer { font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; margin-top: 30px; text-align: center; line-height: 1.8; }' +
    '.chart-img { max-width: 100%; height: auto; margin: 15px 0; page-break-inside: avoid; }' +
    '.metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin: 16px 0; }' +
    '.metric-item { background: #f8f5ef; border-radius: 8px; padding: 14px; text-align: center; }' +
    '.metric-item .label { font-size: 12px; color: #666; font-weight: 600; margin-bottom: 4px; }' +
    '.metric-item .value { font-size: 18px; font-weight: 800; color: #b88a3a; }' +
    '.scenario-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 16px 0; }' +
    '.scenario-item { border-radius: 8px; padding: 14px; text-align: center; border-top: 3px solid #ccc; }' +
    '.scenario-item.pess { border-top-color: #ef4444; background: #fef2f2; }' +
    '.scenario-item.exp { border-top-color: #d4a853; background: #fffbf0; }' +
    '.scenario-item.opt { border-top-color: #22c55e; background: #f0fdf4; }' +
    '.scenario-item .label { font-size: 12px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; }' +
    '.scenario-item .value { font-size: 18px; font-weight: 800; }' +
    '.scenario-item .desc { font-size: 12px; color: #666; margin-top: 4px; }' +
    '.verdict-box { padding: 18px; border-radius: 10px; margin: 16px 0; text-align: center; }' +
    '.verdict-box.profit { background: #f0fdf4; border: 1px solid #86efac; }' +
    '.verdict-box.loss { background: #fef2f2; border: 1px solid #fca5a5; }' +
    '.verdict-box.warn { background: #fffbeb; border: 1px solid #fcd34d; }' +
    '@media print { body { padding: 20px; } .chart-img { max-height: 280px; } }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="header">' +
    logoHtml +
    '<h1>' + h1Text + '</h1>' +
    '<p class="site-name">' + siteName + '</p>' +
    '<p class="report-title">' + headerTitle + '</p>' +
    '<p class="date-line">' + new Date().toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</p>' +
    '</div>' +
    content +
    '<div class="footer">' +
    disclaimer +
    '</div>' +
    (autoPrint ? '<script>window.onload = function() { setTimeout(function() { window.print(); }, 800); };</scr' + 'ipt>' : '') +
    '</body>' +
    '</html>'
  );
  printWindow.document.close();

  if (printWindow.addEventListener) {
    printWindow.addEventListener('afterprint', function () {
      if (window.opener && window.opener.trackEvent) {
        window.opener.trackEvent('report_print_dialog_closed', {
          report_type: reportType,
          lang: lang,
          report_session_id: sessionId
        });
      }
    });
  }

  return printWindow;
}
