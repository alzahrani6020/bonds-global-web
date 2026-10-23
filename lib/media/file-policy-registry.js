'use strict';

const CURRENT_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_FILES = 10;
const MAX_BATCH_BYTES = 25 * 1024 * 1024;

const POLICIES = Object.freeze([
  { category:'document', extensions:['pdf'], mimeTypes:['application/pdf'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'document' },
  { category:'document', extensions:['docx'], mimeTypes:['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'document' },
  { category:'document', extensions:['doc'], mimeTypes:['application/msword'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'document' },
  { category:'spreadsheet', extensions:['xlsx'], mimeTypes:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'document' },
  { category:'spreadsheet', extensions:['xls'], mimeTypes:['application/vnd.ms-excel'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'document' },
  { category:'spreadsheet', extensions:['csv'], mimeTypes:['text/csv','application/csv','application/vnd.ms-excel'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'document' },
  { category:'image', extensions:['jpg','jpeg'], mimeTypes:['image/jpeg'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'vision_pending' },
  { category:'image', extensions:['png'], mimeTypes:['image/png'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'vision_pending' },
  { category:'image', extensions:['webp'], mimeTypes:['image/webp'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'vision_pending' },
  { category:'image', extensions:['heic','heif'], mimeTypes:['image/heic','image/heif'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'vision_pending' },
  { category:'image', extensions:['tif','tiff'], mimeTypes:['image/tiff'], maxBytes:CURRENT_STORAGE_LIMIT_BYTES, processor:'vision_pending' }
]);

function normalizedExtension(name) {
  const value = String(name || '').trim().toLowerCase();
  const index = value.lastIndexOf('.');
  return index >= 0 ? value.slice(index + 1) : '';
}

function normalizedMime(type) {
  return String(type || '').trim().toLowerCase().split(';', 1)[0];
}

function policyFor(file = {}) {
  const ext = normalizedExtension(file.name);
  const mime = normalizedMime(file.type || file.mime_type);
  return POLICIES.find(policy =>
    policy.extensions.includes(ext) &&
    (policy.mimeTypes.includes(mime) || (policy.category === 'image' && mime.startsWith('image/')))
  ) || null;
}

function validateFileMetadata(file = {}) {
  const name = String(file.name || '').trim();
  const size = Number(file.size ?? file.size_bytes);
  const mime = normalizedMime(file.type || file.mime_type);
  if (!name) return { valid:false, code:'FILE_NAME_REQUIRED' };
  if (!Number.isFinite(size) || size <= 0) return { valid:false, code:'FILE_SIZE_INVALID' };
  if (size > CURRENT_STORAGE_LIMIT_BYTES) {
    return { valid:false, code:'FILE_TOO_LARGE', max_bytes:CURRENT_STORAGE_LIMIT_BYTES, size_bytes:size };
  }
  const policy = policyFor({ name, type:mime });
  if (!policy) {
    return { valid:false, code:'UNSUPPORTED_FILE_TYPE', extension:normalizedExtension(name), mime_type:mime || null };
  }
  return {
    valid:true,
    code:null,
    category:policy.category,
    processor:policy.processor,
    extension:normalizedExtension(name),
    mime_type:mime,
    size_bytes:size,
    max_bytes:policy.maxBytes
  };
}

function classifyMedia(input = {}) {
  const validation = validateFileMetadata(input);
  if (!validation.valid) return { ...validation, kind:'unsupported' };
  return {
    valid:true,
    kind:validation.category,
    processor:validation.processor,
    mime_type:validation.mime_type,
    extension:validation.extension,
    financial:false,
    route:
      validation.processor === 'document'
        ? 'document'
        : validation.processor === 'vision_pending'
          ? 'vision'
          : 'unknown'
  };
}

function publicFilePolicy() {
  return {
    schema_version:1,
    storage_bucket:'client-documents',
    max_file_bytes:CURRENT_STORAGE_LIMIT_BYTES,
    max_batch_files:MAX_BATCH_FILES,
    max_batch_bytes:MAX_BATCH_BYTES,
    archive_support:'deferred',
    formats:POLICIES.map(policy => ({
      category:policy.category,
      extensions:[...policy.extensions],
      mime_types:[...policy.mimeTypes],
      max_bytes:policy.maxBytes,
      processor:policy.processor
    }))
  };
}

module.exports = {
  CURRENT_STORAGE_LIMIT_BYTES,
  MAX_BATCH_FILES,
  MAX_BATCH_BYTES,
  POLICIES,
  normalizedExtension,
  normalizedMime,
  policyFor,
  validateFileMetadata,
  classifyMedia,
  publicFilePolicy
};
