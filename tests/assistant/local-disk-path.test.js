'use strict';

const {
  parseLocalDiskPath,
  extractLocalDiskPaths,
  hasUsableAttachments,
  matchAttachmentsToPaths,
  isLocalDiskLoadCommand,
  isLoadOnlyCommand,
  isSaveToFileCommand,
  parseExportFormat,
  resolveLocalDiskRequest
} = require('../../lib/assistant/local-disk-path');
const { runDeterministicLocalTools } = require('../../lib/assistant/universal-orchestrator');

const READY_ATTACHMENT = Object.freeze({
  document_id: 'doc-tb-1',
  filename: 'trial-balance.xlsx',
  status: 'analyzed',
  extracted: {
    method: 'local',
    summary: 'تم استخراج 18 صفوف من trial-balance.xlsx',
    text_excerpt: 'Account\tDebit\tCredit\nSales\t0\t10900000',
    rows_count: 18
  }
});

describe('assistant local disk paths', () => {
  test('parses quoted Windows trial-balance paths used in chat', () => {
    const paths = extractLocalDiskPaths(
      'حمله من المسار "C:\\Users\\vip\\Downloads\\trial-balance.xlsx"'
    );
    expect(paths).toHaveLength(1);
    expect(paths[0].basename).toBe('trial-balance.xlsx');
    expect(paths[0].normalized).toContain('c:\\users\\vip\\downloads\\');
  });

  test('parses Arabic filenames, file URLs, and POSIX download paths', () => {
    expect(extractLocalDiskPaths(
      'C:\\Users\\vip\\Downloads\\ميزان مراجعة خاص مكتب د-- طلال.xlsx'
    )[0].basename).toBe('ميزان مراجعة خاص مكتب د-- طلال.xlsx');
    expect(extractLocalDiskPaths(
      'file:///C:/Users/vip/Downloads/trial-balance.xlsx'
    )[0].basename).toBe('trial-balance.xlsx');
    expect(extractLocalDiskPaths(
      'load from /Users/vip/Downloads/trial-balance.xlsx'
    )[0].basename).toBe('trial-balance.xlsx');
  });

  test('rejects traversal, Windows system folders, and secrets', () => {
    expect(parseLocalDiskPath('C:\\Users\\vip\\Downloads\\..\\..\\Windows\\win.ini')).toBeNull();
    expect(parseLocalDiskPath('C:\\Windows\\System32\\drivers\\etc\\hosts.xlsx')).toBeNull();
    expect(parseLocalDiskPath('C:\\Users\\vip\\.ssh\\id_rsa.xlsx')).toBeNull();
    expect(parseLocalDiskPath('C:\\Users\\vip\\Downloads\\notes.txt')).toBeNull();
  });

  test('matches an already uploaded attachment by filename', () => {
    const paths = extractLocalDiskPaths('C:\\Users\\vip\\Downloads\\trial-balance.xlsx');
    const matched = matchAttachmentsToPaths(paths, [READY_ATTACHMENT]);
    expect(matched.found).toHaveLength(1);
    expect(matched.missing).toHaveLength(0);
    expect(hasUsableAttachments([READY_ATTACHMENT])).toBe(true);
  });

  test('load-only Windows path with a ready upload acknowledges the file', () => {
    expect(isLocalDiskLoadCommand('حمله من المسار من الجهاز')).toBe(true);
    expect(isLoadOnlyCommand('حمله من C:\\Users\\vip\\Downloads\\trial-balance.xlsx')).toBe(true);
    const resolved = resolveLocalDiskRequest(
      'حمله من المسار "C:\\Users\\vip\\Downloads\\trial-balance.xlsx"',
      { attachments: [READY_ATTACHMENT] },
      'ar'
    );
    expect(resolved.reply).toContain('trial-balance.xlsx');
    expect(resolved.reply).toContain('عبر الموقع');
    expect(resolved.reply).not.toMatch(/لم يتم تزويدي/);
  });

  test('online assistant does not claim it can open a missing disk path on the server', () => {
    const resolved = resolveLocalDiskRequest(
      'حمله من C:\\Users\\vip\\Downloads\\missing.xlsx',
      { attachments: [] },
      'ar'
    );
    expect(resolved.reply).toContain('لا أستطيع فتح missing.xlsx من خادم الموقع');
    expect(resolved.reply).toContain('متصفحك');
  });

  test('deterministic tools acknowledge a typed Windows path when the upload is already ready', async () => {
    const result = await runDeterministicLocalTools([
      { role: 'user', content: 'حمله من "C:\\Users\\vip\\Downloads\\trial-balance.xlsx"' }
    ], { attachments: [READY_ATTACHMENT] }, {}, []);
    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-local-disk');
    expect(result.reply).toContain('trial-balance.xlsx');
  });

  test('statement-build without numbers uses the attached trial balance', async () => {
    const result = await runDeterministicLocalTools([
      { role: 'user', content: 'اعمل ميزانية قائمة دخل ومركز مالي' }
    ], { attachments: [READY_ATTACHMENT] }, {}, []);
    expect(result.planner).toBe('universal-v2-deterministic-trial-balance');
    expect(result.reply).toContain('trial-balance.xlsx');
    expect(result.reply).toContain('10,900,000');
  });

  test('احملها في ملف is an export, not a load-only disk path', async () => {
    expect(isSaveToFileCommand('احملها في ملف')).toBe(true);
    expect(isLoadOnlyCommand('احملها في ملف')).toBe(false);
    const result = await runDeterministicLocalTools([
      { role: 'user', content: 'احملها في ملف' }
    ], { attachments: [READY_ATTACHMENT] }, {}, []);
    expect(result.planner).toBe('universal-v2-deterministic-trial-balance-export');
    expect(result.reply).not.toMatch(/لا يمكنني رفع الملفات بصيغة PDF/);
    const fileCard = (result.ui || []).find(card => card.type === 'download_file');
    expect(fileCard.autodownload).toBe(false);
    expect(fileCard.files.map(file => file.label)).toEqual(['إكسل', 'PDF', 'HTML']);
    expect(fileCard.files[0]).toMatchObject({
      filename: 'bonds-statements.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    expect(fileCard.files[0].base64).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(fileCard.files[1].print_html).toContain('قائمة الدخل');
    expect(result.ui[0]).toBe(fileCard);
  });

  test('ارفع القوائم لي offers Excel, PDF and HTML instead of a Native PDF refusal', async () => {
    expect(isSaveToFileCommand('ارفع القوائم لي')).toBe(true);
    expect(isSaveToFileCommand('أعطني الملف')).toBe(true);
    expect(isSaveToFileCommand('نزلها')).toBe(true);
    expect(isSaveToFileCommand('رفعت لك ميزان المراجعة')).toBe(false);
    expect(parseExportFormat('ارفع القوائم لي')).toBeNull();
    expect(parseExportFormat('ارفعها إكسل')).toBe('xlsx');
    expect(parseExportFormat('ارفع PDF')).toBe('pdf');
    const result = await runDeterministicLocalTools([
      { role: 'user', content: 'ارفع القوائم لي' }
    ], { attachments: [READY_ATTACHMENT] }, {}, []);
    expect(result.planner).toBe('universal-v2-deterministic-trial-balance-export');
    expect(result.reply).toMatch(/إكسل أو PDF أو HTML/);
    expect(result.reply).not.toMatch(/لا يمكنني رفع الملفات بصيغة PDF/);
    expect(result.ui[0]).toMatchObject({
      type: 'download_file',
      title: 'تنزيل القوائم المالية',
      autodownload: false
    });
    expect(result.ui[0].files).toHaveLength(3);
  });

  test('ارفعها إكسل autodownloads only the Excel format', async () => {
    const result = await runDeterministicLocalTools([
      { role: 'user', content: 'ارفعها إكسل' }
    ], { attachments: [READY_ATTACHMENT] }, {}, []);
    expect(result.planner).toBe('universal-v2-deterministic-trial-balance-export');
    expect(result.ui[0].autodownload).toBe(true);
    expect(result.ui[0].files.find(file => file.format === 'xlsx').autodownload).toBe(true);
    expect(result.ui[0].files.find(file => file.format === 'pdf').autodownload).toBe(false);
  });

  test('statement-build without numbers still asks for figures when no file is present', async () => {
    const result = await runDeterministicLocalTools([
      { role: 'user', content: 'اعمل ميزانية قائمة دخل ومركز مالي' }
    ], { attachments: [] }, {}, []);
    expect(result.ok).toBe(true);
    expect(result.reply).toMatch(/الإيرادات والربح/);
  });
});
