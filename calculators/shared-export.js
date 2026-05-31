/**
 * Bonds Calculator Shared Export Utilities
 * PDF, print, and share helpers
 */

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
    if (window.BondsUI && BondsUI.toast) BondsUI.toast('✅ تم نسخ الرابط!', 'success');
  }
}

// ===== 3. Export Element to PDF (jsPDF + html2canvas) =====
async function exportElementToPDF(options) {
  options = options || {};
  var elementId = options.elementId;
  var filename = options.filename || 'report.pdf';
  var bgColor = options.bgColor || '#0a0f1a';
  var scale = options.scale || 2;

  var section = document.getElementById(elementId);
  if (!section || section.style.display === 'none') {
    if (window.BondsUI && BondsUI.toast) BondsUI.toast('⚠️ احسب النتائج أولاً', 'warning');
    return false;
  }

  await Promise.all([
    loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf'),
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

  var printWindow = window.open('', '_blank');
  if (!printWindow) {
    if (window.BondsUI && BondsUI.toast) BondsUI.toast('⚠️ تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.', 'warning');
    return null;
  }

  printWindow.document.write(
    '<!DOCTYPE html>' +
    '<html dir="rtl">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<title>' + title + ' - بوندز</title>' +
    '<style>' +
    '@import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap");' +
    'body { font-family: Vazirmatn, Arial, sans-serif; background: #fff; color: #1a1a1a; padding: 40px; max-width: 1100px; margin: 0 auto; }' +
    'h1 { color: #0a0f1a; margin: 0; font-size: 28px; text-align: center; }' +
    '.header { text-align: center; border-bottom: 3px solid #d4a853; padding-bottom: 15px; margin-bottom: 25px; }' +
    '.header p { color: #666; margin: 5px 0; font-size: 14px; }' +
    'h3 { color: #d4a853; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 25px; }' +
    'table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }' +
    'th, td { padding: 8px; border: 1px solid #ddd; }' +
    'th { background: #f5f5f5; }' +
    '.footer { font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; }' +
    '.chart-img { max-width: 100%; height: auto; margin: 15px 0; page-break-inside: avoid; }' +
    '@media print { body { padding: 20px; } .chart-img { max-height: 280px; } }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="header">' +
    '<h1>بوندز</h1>' +
    '<p style="font-size:16px; font-weight:700; color:#444; margin:4px 0;">للاستشارات المالية</p>' +
    '<p>' + headerTitle + '</p>' +
    '<p style="color:#999; font-size:12px;">' + new Date().toLocaleDateString('ar-SA') + '</p>' +
    '</div>' +
    content +
    '<div class="footer">' +
    'هذا التقرير للأغراض التقديرية فقط ولا يغني عن استشارة مالية مرخصة.<br>' +
    'تم إنشاؤه بواسطة bonds-global.com' +
    '</div>' +
    (autoPrint ? '<script>window.onload = function() { setTimeout(function() { window.print(); }, 600); };</scr' + 'ipt>' : '') +
    '</body>' +
    '</html>'
  );
  printWindow.document.close();
  return printWindow;
}
