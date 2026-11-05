'use strict';

const ALLOWED_EXTENSIONS = Object.freeze([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv',
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'tif', 'tiff'
]);
const EXTENSION_PATTERN = ALLOWED_EXTENSIONS.slice().sort((a, b) => b.length - a.length).join('|');
const QUOTED_PATH = new RegExp(
  `["']((?:[A-Za-z]:\\\\|\\\\\\\\|file:///)[^"'\\n]+?\\.(?:${EXTENSION_PATTERN}))["']`,
  'gi'
);
const WINDOWS_PATH = new RegExp(
  `(?:[A-Za-z]:\\\\|\\\\\\\\)[^\\n<>"|?*]+\\.(?:${EXTENSION_PATTERN})`,
  'gi'
);
const FILE_URL_PATH = new RegExp(
  'file:///' + '[^\\s"\'<>]+\\.(?:' + EXTENSION_PATTERN + ')',
  'gi'
);
const POSIX_PATH = new RegExp(
  `(?:^|[\\s"'])(/(?:Users|home)/[^\\n<>"|*]+\\.(?:${EXTENSION_PATTERN}))`,
  'gi'
);
const LOAD_COMMAND = /حمل(?:ه|ها|يه|لي)?|حمّل(?:ه|ها)?|افتح(?:ه|ها)?\s+من|من\s+(?:مساره|مسارها|المسار|مسار|الجهاز|القرص)|load\s+(?:it\s+)?from|read\s+(?:it\s+)?from|from\s+(?:disk|the\s+path|this\s+path)/i;
const ANALYSIS_COMMAND = /حل[لّ]|ابن|ابني|اعمل|أعمل|أنشئ|انشئ|جهز|قوائم|ميزانية|حلل|analyze|build|prepare|statements?/i;
const SAVE_TO_FILE_COMMAND = /في\s*(?:ملف|اكسل|إكسل)|الى\s*ملف|إلى\s*ملف|احملها\s+في|صدر(?:ها|ه)?|تصدير|(?:^|\s)export(?:\s|$)|save\s+(?:as|to)\s+(?:a\s+)?file|\bexcel\b|\bpdf\b|بي\s*دي\s*اف|ارفع(?:ها|ه|ي)(?:\s+لي)?|ارفع(?:\s+لي)?\s+(?:القوائم|الملف)|نزل(?:ها|ه|ي|لي)?|نزّل(?:ها|ه)?|أعطني\s*(?:الملف|القوائم)|download\s+(?:the\s+)?(?:file|statements)/i;
const PROVIDED_DOCUMENT = /أرسلت\s+لك|ارسلت\s+لك|رفعت(?:ه|ها)?|المرفق|ميزان(?:\s+ال)?مراجعة|trial\s+balance|I\s+sent|attached|uploaded/i;
const BLOCKED_PATH = /(?:^|[\\/])(?:windows|system32|\.ssh|\.gnupg)(?:[\\/]|$)|(?:^|[\\/])\.env(?:[\\/]|$|\.)|\.\./i;

function cleanText(value, max = 4000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function allowedExtension(name) {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return Boolean(match && ALLOWED_EXTENSIONS.includes(match[1]));
}

function basenameFromSegments(segments) {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (segments[index]) return segments[index];
  }
  return '';
}

function parseLocalDiskPath(value) {
  let pathValue = String(value || '').trim().replace(/^["']|["']$/g, '');
  if (!pathValue) return null;
  if (/^file:\/\//i.test(pathValue)) {
    try {
      pathValue = decodeURIComponent(pathValue.replace(/^file:\/\//i, ''));
    } catch (_error) {
      pathValue = pathValue.replace(/^file:\/\//i, '');
    }
    pathValue = pathValue.replace(/^\/([A-Za-z]:)/, '$1');
  }
  const posix = pathValue.startsWith('/') || pathValue.startsWith('~');
  pathValue = posix ? pathValue.replace(/\\/g, '/') : pathValue.replace(/\//g, '\\');
  if (BLOCKED_PATH.test(pathValue)) return null;
  const segments = pathValue.split(posix ? /\/+/ : /\\+/).filter(Boolean);
  const basename = basenameFromSegments(segments);
  if (!allowedExtension(basename)) return null;
  return {
    original: String(value || '').trim(),
    normalized: pathValue.toLowerCase(),
    basename,
    segments
  };
}

function pushUniquePath(found, seen, raw) {
  const parsed = parseLocalDiskPath(raw);
  if (!parsed || seen.has(parsed.normalized)) return;
  seen.add(parsed.normalized);
  found.push(parsed);
}

function extractLocalDiskPaths(text) {
  const raw = String(text || '');
  const found = [];
  const seen = new Set();
  const patterns = [QUOTED_PATH, WINDOWS_PATH, FILE_URL_PATH, POSIX_PATH];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(raw);
    while (match) {
      pushUniquePath(found, seen, match[1] || match[0]);
      match = pattern.exec(raw);
    }
  }
  return found;
}

function usableAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : []).filter(item => {
    if (!item || item.error) return false;
    if (!item.document_id) return false;
    const extracted = item.extracted && typeof item.extracted === 'object' ? item.extracted : {};
    const status = String(item.status || '').toLowerCase();
    return status === 'analyzed'
      || Boolean(extracted.text_excerpt || extracted.summary || extracted.rows_count);
  });
}

function hasUsableAttachments(attachments) {
  return usableAttachments(attachments).length > 0;
}

function filenamesEqual(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function matchAttachmentsToPaths(paths, attachments) {
  const ready = usableAttachments(attachments);
  const found = [];
  const missing = [];
  for (const pathInfo of Array.isArray(paths) ? paths : []) {
    const hit = ready.find(item =>
      filenamesEqual(item.filename, pathInfo.basename) || filenamesEqual(item.name, pathInfo.basename)
    );
    if (hit) found.push({ path: pathInfo, attachment: hit });
    else missing.push(pathInfo);
  }
  return { found, missing };
}

function isLocalDiskLoadCommand(text) {
  return LOAD_COMMAND.test(cleanText(text, 800));
}

function referencesProvidedDocument(text) {
  return PROVIDED_DOCUMENT.test(cleanText(text, 800));
}

function isSaveToFileCommand(text) {
  return SAVE_TO_FILE_COMMAND.test(cleanText(text, 800));
}

function parseExportFormat(text) {
  const raw = cleanText(text, 800);
  if (/\bpdf\b|بي\s*دي\s*اف|بيدي\s*اف|بدي\s*اف/i.test(raw)) return 'pdf';
  if (/\bhtml\b|\.html\b/i.test(raw)) return 'html';
  if (/اكسل|إكسل|\bexcel\b|\bxlsx\b/i.test(raw)) return 'xlsx';
  return null;
}

function isLoadOnlyCommand(text) {
  const raw = cleanText(text, 800);
  if (isSaveToFileCommand(raw)) return false;
  if (!isLocalDiskLoadCommand(raw) && !extractLocalDiskPaths(raw).length) return false;
  return !ANALYSIS_COMMAND.test(raw);
}

function formatLoadedAck(language, matches) {
  const names = (Array.isArray(matches) ? matches : [])
    .map(item => item?.attachment?.filename || item?.path?.basename)
    .filter(Boolean);
  const listed = names.length ? names.map(name => `«${name}»`).join('، ') : 'الملف المرفوع';
  if (language === 'en') {
    const englishNames = names.length ? names.map(name => `"${name}"`).join(', ') : 'the uploaded file';
    return [
      `Loaded from this device through the website: ${englishNames}.`,
      'The cloud assistant does not open Windows or macOS disk paths. The scanned upload is the source of truth.'
    ].join(' ');
  }
  return [
    `تم اعتماد الملف من جهازك عبر الموقع: ${listed}.`,
    'الخادم لا يفتح مسار ويندوز أو ماك. الملف المرفوع بعد الفحص هو المصدر.'
  ].join(' ');
}

function formatOnlineDiskUnavailable(language, paths) {
  const name = paths?.[0]?.basename || paths?.[0]?.original || '';
  if (language === 'en') {
    return [
      name ? `I cannot open ${name} from the cloud server.` : 'I cannot open that disk path from the cloud server.',
      'On this website, typed paths are read in your browser after you allow the folder, then uploaded through the same scan.',
      'Allow the containing folder in Chrome/Edge, or use the attach button.'
    ].join(' ');
  }
  return [
    name ? `لا أستطيع فتح ${name} من خادم الموقع.` : 'لا أستطيع فتح مسار القرص من خادم الموقع.',
    'من الموقع نفسه يُقرأ المسار في متصفحك بعد السماح بالمجلد، ثم يُرفع عبر الفحص المعتاد.',
    'اسمح بمجلد الملف في كروم/إيدج، أو أرفقه من الزر.'
  ].join(' ');
}

function resolveLocalDiskRequest(text, context = {}, language = 'ar') {
  const paths = extractLocalDiskPaths(text);
  const attachments = context?.attachments;
  const matched = matchAttachmentsToPaths(paths, attachments);
  const loadCommand = isLocalDiskLoadCommand(text);
  const provided = referencesProvidedDocument(text);

  if (paths.length && matched.missing.length && !matched.found.length) {
    return { reply: formatOnlineDiskUnavailable(language, matched.missing) };
  }

  if ((loadCommand || paths.length) && isLoadOnlyCommand(text) && matched.found.length) {
    return { reply: formatLoadedAck(language, matched.found) };
  }

  if ((loadCommand || provided) && !paths.length && !hasUsableAttachments(attachments)) {
    return null;
  }

  return null;
}

module.exports = {
  ALLOWED_EXTENSIONS,
  parseLocalDiskPath,
  extractLocalDiskPaths,
  usableAttachments,
  hasUsableAttachments,
  matchAttachmentsToPaths,
  isLocalDiskLoadCommand,
  isLoadOnlyCommand,
  isSaveToFileCommand,
  parseExportFormat,
  referencesProvidedDocument,
  formatLoadedAck,
  formatOnlineDiskUnavailable,
  resolveLocalDiskRequest
};
