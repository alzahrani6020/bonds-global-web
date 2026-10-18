const fs = require('fs');
const path = require('path');
const api = require('../calculators/feasibility-export.js');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const ar = read('calculators/feasibility-template.html');
const en = read('en/calculators/feasibility-template.html');
const css = read('calculators/feasibility-template-shared.css');
const shared = read('calculators/shared-enhancements.js');

function control(id, value, type = 'text') {
  return { id, name:'', value, type, tagName:'INPUT', checked:value === true, closest:()=>null, getAttribute:()=>null };
}
function fakeDocument(lang='en') {
  const controls=[control('empty',''), control('filled','value'), control('unchecked',false,'checkbox')];
  const table={
    id:'table-one', dataset:{}, previousElementSibling:{textContent:'Table One'}, getAttribute:()=>null,
    querySelectorAll(sel) {
      if (sel === 'thead th') return [{textContent:'Metric'}];
      if (sel === 'tbody tr') return [{children:[{querySelectorAll:()=>[],textContent:'100'}]}];
      return [];
    }
  };
  const page={
    id:'page-one',
    querySelectorAll:sel => sel === 'input, textarea, select' ? controls : (sel === 'table' ? [table] : []),
    querySelector:sel => sel === '.template-header-print .doc-title' ? {textContent:'Section One'} : null
  };
  const project=control('cover-business-name','Project Alpha');
  return {
    documentElement:{lang,dir:lang === 'ar' ? 'rtl' : 'ltr'},
    querySelectorAll:sel => sel === '.template-page' ? [page] : [],
    querySelector:()=>null,
    getElementById:id => id === 'cover-business-name' ? project : null
  };
}

describe('feasibility unified pipeline', () => {
  afterEach(() => {
    delete global.window; delete global.document; delete global.CSS; delete global.alert;
  });

  test('collects all section fields including empty/false values and tables', () => {
    const model=api.collectStudy(fakeDocument());
    expect(model.sectionCount).toBe(1);
    expect(model.sections[0].fields.map(f=>f.id)).toEqual(['empty','filled','unchecked']);
    expect(model.sections[0].tables).toHaveLength(1);
    expect(model.sections[0].tables[0].rows).toEqual([[100]]);
  });

  test('getCalculatorData is exposed and Google Sheets can consume csvRows', () => {
    expect(read('calculators/feasibility-export.js')).toContain('root.getCalculatorData = api.getCalculatorData');
    expect(shared).toContain('window.getCalculatorData');
    expect(shared).toContain('data.csvRows');
    expect(ar).toContain('<script src="feasibility-export.js?v=2"></script>');
    expect(en).toContain('<script src="../../calculators/feasibility-export.js?v=2"></script>');
  });

  test('Excel builds summary plus one sheet per section', () => {
    const appended=[];
    global.document=fakeDocument();
    global.CSS={escape:v=>v};
    global.alert=jest.fn();
    global.window={XLSX:{utils:{
      book_new:()=>({SheetNames:[]}),
      aoa_to_sheet:rows=>({rows}),
      book_append_sheet:(wb,ws,name)=>{appended.push(name);wb.SheetNames.push(name);}
    },writeFile:jest.fn()}};
    expect(api.exportToExcel()).toBe(true);
    expect(appended).toEqual(['Summary','1 Section One']);
    expect(global.window.XLSX.writeFile).toHaveBeenCalledTimes(1);
  });

  test('size/page/text limits are enforced', () => {
    expect(api.validateImportFile({size:api.MAX_IMPORT_BYTES}).ok).toBe(true);
    expect(api.validateImportFile({size:api.MAX_IMPORT_BYTES+1}).code).toBe('FILE_TOO_LARGE');
    expect(api.validatePdfPageCount(api.MAX_PDF_PAGES).ok).toBe(true);
    expect(api.validatePdfPageCount(api.MAX_PDF_PAGES+1).code).toBe('PDF_TOO_MANY_PAGES');
    const limited=api.limitAnalysisText('x'.repeat(api.MAX_ANALYSIS_CHARS+1));
    expect(limited.truncated).toBe(true);
    expect(limited.text).toHaveLength(api.MAX_ANALYSIS_CHARS);
  });

  test('Authorization header uses current session token', async () => {
    global.window={BondsAuth:{getSupabase:()=>({auth:{getSession:async()=>({data:{session:{access_token:'token-123'}}})}})}};
    await expect(api.getAuthHeaders()).resolves.toEqual({
      'Content-Type':'application/json',
      Authorization:'Bearer token-123'
    });
  });

  test.each([['AR',ar],['EN',en]])('%s uses one unified import/export path', (_name,html) => {
    expect(html).toContain('api.validateImportFile(file)');
    expect(html).toContain('api.validatePdfPageCount(pdf.numPages)');
    expect(html).toContain('api.limitAnalysisText(rawText)');
    expect(html).toContain('await api.getAuthHeaders()');
    expect(html).toContain('text: limited.text');
    expect(html).not.toMatch(/function\s+generateProfessionalPDF\s*\(/);
    expect(html).not.toMatch(/function\s+exportToExcel\s*\(/);
    expect(html).not.toMatch(/getRegistrations\(\)[\s\S]{0,300}unregister\(/);
    expect(html).not.toMatch(/jspdf|html2canvas/i);
    expect(html).toContain('xlsx.full.min.js');
  });

  test('AR/EN parity and hard limits match', () => {
    for (const hook of ['api.validateImportFile(file)','api.validatePdfPageCount(pdf.numPages)','api.limitAnalysisText(rawText)','await api.getAuthHeaders()']) {
      expect(ar.includes(hook)).toBe(true);
      expect(en.includes(hook)).toBe(true);
    }
    expect(api.MAX_IMPORT_BYTES).toBe(10*1024*1024);
    expect(api.MAX_PDF_PAGES).toBe(100);
    expect(api.MAX_ANALYSIS_CHARS).toBe(25000);
  });

  test('print contract preserves A4 headers and disclaimer', () => {
    expect(css).toContain('@page { size:A4; margin:10mm; }');
    expect(css).toContain('.template-header-print { display:flex !important;');
    expect(css).toContain('.disclaimer.no-print { display:block !important;');
    expect(ar).toContain('class="template-header-print"');
    expect(en).toContain('class="template-header-print"');
    expect(ar).toMatch(/class="disclaimer no-print"/);
    expect(en).toMatch(/class="disclaimer no-print"/);
  });
});
