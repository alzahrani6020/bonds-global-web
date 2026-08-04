const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const htmlPath = path.resolve(__dirname, '..', 'calculators', 'feasibility-template.html');
  const outputPath = path.resolve(__dirname, '..', 'calculators', 'feasibility-report.pdf');
  
  // Load the original HTML directly (let JS run)
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0', timeout: 120000 });
  
  // Wait for all calculations to complete
  await new Promise(r => setTimeout(r, 5000));
  
  // Execute JS to trigger all calculations
  await page.evaluate(() => {
    // Trigger all oninput events
    document.querySelectorAll('input[type="number"]').forEach(input => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    // Click any auto-calculate buttons
    const autoBtns = document.querySelectorAll('button');
    autoBtns.forEach(btn => {
      if (btn.textContent.includes('حساب') || btn.textContent.includes('توليد')) {
        // Don't click, just ensure values are set
      }
    });
    
    // Scroll to load all content
    window.scrollTo(0, document.body.scrollHeight);
  });
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Now inject CSS and transform to static
  await page.evaluate(() => {
    // Remove interactive elements
    document.querySelectorAll('nav, .template-toolbar, .progress-bar, .no-print').forEach(el => el.remove());
    
    // Remove modals
    document.querySelectorAll('#page-import, #ai-preview-modal, #image-search-modal, #research-modal').forEach(el => el.remove());
    
    // Remove buttons
    document.querySelectorAll('button').forEach(el => el.remove());
    
    // Remove file inputs
    document.querySelectorAll('input[type="file"], input[type="checkbox"]').forEach(el => el.remove());
    
    // Remove table actions
    document.querySelectorAll('.table-actions').forEach(el => el.remove());
    
    // Convert inputs to static text (preserving calculated values)
    document.querySelectorAll('input').forEach(input => {
      const span = document.createElement('span');
      span.className = 'static-value';
      
      let value = input.value;
      if (input.type === 'number' && value) {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          span.className += ' number';
          span.textContent = num.toLocaleString('en-US');
        } else {
          span.textContent = value || '—';
        }
      } else {
        span.textContent = value || '—';
      }
      
      input.parentNode.replaceChild(span, input);
    });
    
    // Convert textareas to static divs
    document.querySelectorAll('textarea').forEach(ta => {
      const div = document.createElement('div');
      div.className = 'static-text';
      const text = ta.value.trim();
      if (!text) {
        div.textContent = '—';
      } else {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length === 1) {
          div.textContent = text;
        } else {
          div.innerHTML = lines.map(l => '<p>' + l + '</p>').join('');
        }
      }
      ta.parentNode.replaceChild(div, ta);
    });
    
    // Convert selects
    document.querySelectorAll('select').forEach(sel => {
      const span = document.createElement('span');
      span.className = 'static-value';
      span.textContent = sel.value || '—';
      sel.parentNode.replaceChild(span, sel);
    });
    
    // Inject print styles
    const style = document.createElement('style');
    style.textContent = `
      @page {
        size: A4;
        margin: 18mm 15mm 20mm 15mm;
      }
      
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      body {
        font-family: 'Vazirmatn', 'Arial', sans-serif !important;
        font-size: 10.5pt !important;
        line-height: 1.65 !important;
        color: #1a1a1a !important;
        background: #fff !important;
        direction: rtl !important;
      }
      
      .template-wrapper {
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      
      .template-page {
        background: #fff !important;
        border: none !important;
        border-radius: 0 !important;
        padding: 0 0 1.5rem 0 !important;
        margin: 0 0 1rem 0 !important;
        page-break-after: always;
        page-break-inside: auto;
        box-shadow: none !important;
      }
      
      .template-page:last-child {
        page-break-after: auto;
      }
      
      .cover-page {
        text-align: center !important;
        padding: 3rem 1rem !important;
        min-height: 80vh !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        page-break-after: always !important;
      }
      
      .cover-page h1 {
        font-size: 1.7rem !important;
        color: #1a1a1a !important;
        margin-bottom: 0.5rem !important;
      }
      
      .cover-page .cover-subtitle {
        font-size: 1rem !important;
        color: #555 !important;
      }
      
      .page-header {
        border-bottom: 2px solid #c9a227 !important;
        margin-bottom: 1.25rem !important;
        padding-bottom: 0.6rem !important;
        page-break-after: avoid !important;
      }
      
      .page-header h2 {
        color: #1a1a1a !important;
        font-size: 1.2rem !important;
        margin: 0 !important;
      }
      
      .section-number {
        background: #c9a227 !important;
        color: #fff !important;
      }
      
      .field-group {
        margin-bottom: 0.9rem !important;
      }
      
      .field-group label {
        color: #444 !important;
        font-weight: 700 !important;
        font-size: 0.82rem !important;
        margin-bottom: 0.25rem !important;
        display: block !important;
      }
      
      .static-value {
        display: inline-block;
        padding: 0.35rem 0.5rem;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 0.92rem;
        min-width: 60px;
        color: #1a1a1a;
      }
      
      .static-value.number {
        font-family: 'Courier New', monospace;
        direction: ltr;
        text-align: left;
        unicode-bidi: embed;
      }
      
      .static-text {
        padding: 0.6rem;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 5px;
        line-height: 1.65;
        color: #1a1a1a;
      }
      
      .static-text p {
        margin: 0 0 0.3rem 0;
      }
      
      .static-text p:last-child {
        margin-bottom: 0;
      }
      
      .template-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.6rem 0;
        font-size: 0.82rem;
        page-break-inside: auto;
      }
      
      .template-table th {
        background: #e8e8e8 !important;
        color: #1a1a1a !important;
        border: 1px solid #aaa !important;
        padding: 0.4rem 0.35rem !important;
        font-weight: 700;
      }
      
      .template-table td {
        border: 1px solid #bbb !important;
        padding: 0.35rem !important;
        color: #1a1a1a !important;
        background: #fff !important;
      }
      
      .template-table tr {
        page-break-inside: avoid;
      }
      
      h1, h2, h3, h4 {
        color: #1a1a1a !important;
        page-break-after: avoid;
      }
      
      h3 {
        font-size: 0.95rem !important;
        margin: 0.8rem 0 0.4rem 0 !important;
      }
      
      .swot-box {
        border: 1px solid #bbb !important;
        background: #fff !important;
        page-break-inside: avoid;
      }
      
      .swot-box h4 {
        color: #1a1a1a !important;
      }
      
      .scenario-card {
        border: 1px solid #bbb !important;
        background: #fff !important;
      }
      
      .dash-kpi-card, .dash-panel, .dash-chart-box {
        border: 1px solid #bbb !important;
        background: #fff !important;
      }
      
      .dash-kpi-value {
        color: #1a1a1a !important;
      }
      
      .signature-grid {
        display: none !important;
      }
      
      .tab-content, [class*="tab"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
      }
      
      .field-group.inline {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      
      .field-group.inline-3 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 1rem;
      }
    `;
    document.head.appendChild(style);
    
    // Show all hidden content
    document.querySelectorAll('.hidden, [hidden], [style*="display: none"]').forEach(el => {
      el.style.display = 'block';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
    });
  });
  
  // Wait for DOM updates
  await new Promise(r => setTimeout(r, 2000));
  
  // Generate PDF
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '15mm', bottom: '20mm', left: '15mm' },
    preferCSSPageSize: false,
    scale: 0.92,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8pt;color:#888;width:100%;text-align:center;padding:5mm 0;font-family:Arial,sans-serif;direction:rtl;">دراسة جدوى - شركة إحياء الأصول العقارية</div>',
    footerTemplate: '<div style="font-size:8pt;color:#888;width:100%;text-align:center;padding:5mm 0;font-family:Arial,sans-serif;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  });
  
  const stats = fs.statSync(outputPath);
  console.log(" Report PDF created: " + outputPath);
  console.log(" Size: " + (stats.size / 1024 / 1024).toFixed(2) + ' MB');
  
  await browser.close();
})();
