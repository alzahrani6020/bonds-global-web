const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const htmlPath = path.resolve(__dirname, '..', 'calculators', 'feasibility-template.html');
  const outputPath = path.resolve(__dirname, '..', 'calculators', 'feasibility-study.pdf');
  
  // Read HTML content
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  // Inject CSS fixes for PDF rendering before closing head tag
  const pdfFixes = `
    <style id="pdf-fixes">
      /* Force all content visible */
      body, html { 
        height: auto !important; 
        overflow: visible !important;
        background: #fff !important;
        color: #000 !important;
      }
      
      /* Ensure all sections are visible */
      .section, section, .tab-content, [class*="tab"], [class*="section"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        overflow: visible !important;
      }
      
      /* Fix number display - use standard numerals */
      input, .value-display, [class*="value"], td, th, .result, .total, .summary {
        font-variant-numeric: tabular-nums !important;
        -webkit-font-feature-settings: normal !important;
        font-feature-settings: normal !important;
      }
      
      /* Ensure white background for print */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* Fix table display */
      table { 
        page-break-inside: auto !important;
        border-collapse: collapse !important;
      }
      tr { 
        page-break-inside: avoid !important;
        page-break-after: auto !important;
      }
      td, th { 
        page-break-inside: avoid !important;
      }
      
      /* Page breaks for major sections */
      h1, h2, .cover-page, .section-header {
        page-break-after: avoid !important;
      }
      .section {
        page-break-before: auto !important;
        page-break-inside: auto !important;
      }
    </style>
  `;
  
  // Inject before </head>
  htmlContent = htmlContent.replace('</head>', pdfFixes + '</head>');
  
  // Inject JS to make all tabs visible before printing
  const visibilityScript = `
    <script>
      // Make all content visible for PDF
      document.addEventListener('DOMContentLoaded', function() {
        // Show all tab contents
        document.querySelectorAll('.tab-content, [class*="tab"]').forEach(function(el) {
          el.style.display = 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
          el.style.height = 'auto';
        });
        
        // Remove any hidden classes
        document.querySelectorAll('.hidden, [hidden], [style*="display: none"], [style*="visibility: hidden"]').forEach(function(el) {
          if (!el.closest('nav') && !el.closest('header')) {
            el.style.display = 'block';
            el.style.visibility = 'visible';
          }
        });
        
        // Convert Arabic numerals in inputs to standard for display
        document.querySelectorAll('input[type="text"], input:not([type])').forEach(function(input) {
          if (input.value && /[٠١٢٣٤٥٦٧٨٩]/.test(input.value)) {
            input.setAttribute('data-original', input.value);
            input.value = input.value.replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d) {
              return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);
            });
          }
        });
      });
    </script>
  `;
  
  htmlContent = htmlContent.replace('</body>', visibilityScript + '</body>');
  
  // Write temporary file
  const tempPath = path.resolve(__dirname, '..', 'calculators', 'feasibility-temp.html');
  fs.writeFileSync(tempPath, htmlContent, 'utf8');
  
  // Load via file:// protocol
  await page.goto('file://' + tempPath, { waitUntil: 'networkidle0', timeout: 120000 });
  
  // Wait for fonts and JS to execute
  await new Promise(r => setTimeout(r, 5000));
  
  // Execute JS to ensure all content is visible
  await page.evaluate(() => {
    document.querySelectorAll('.tab-content, [class*="tab"]').forEach(el => {
      el.style.display = 'block';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      el.style.height = 'auto';
    });
    
    document.querySelectorAll('.hidden, [hidden]').forEach(el => {
      if (!el.closest('nav') && !el.closest('header')) {
        el.style.display = 'block';
        el.style.visibility = 'visible';
      }
    });
    
    // Scroll to bottom to load any lazy content
    window.scrollTo(0, document.body.scrollHeight);
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Get full page height
  const dimensions = await page.evaluate(() => {
    return {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight
    };
  });
  
  console.log('Page dimensions:', dimensions.width, 'x', dimensions.height);
  
  await page.pdf({
    path: outputPath,
    width: '210mm',
    height: '297mm',
    printBackground: true,
    margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    preferCSSPageSize: false,
    scale: 1.0
  });
  
  // Clean up temp file
  fs.unlinkSync(tempPath);
  
  const stats = fs.statSync(outputPath);
  console.log('PDF created: ' + outputPath);
  console.log('Size: ' + (stats.size / 1024 / 1024).toFixed(2) + ' MB');
  console.log('Pages: Check with a PDF viewer');
  
  await browser.close();
})();
