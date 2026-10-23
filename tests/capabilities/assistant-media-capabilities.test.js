/** @jest-environment node */

const {
  CURRENT_STORAGE_LIMIT_BYTES,
  MAX_BATCH_FILES,
  MAX_BATCH_BYTES,
  validateFileMetadata,
  classifyMedia,
  publicFilePolicy
} = require('../../lib/media/file-policy-registry');
const { detectLanguage } = require('../../lib/media/language-engine');
const { getCapability } = require('../../lib/capabilities/bonds-capability-registry');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');

describe('assistant media intake foundation', () => {
  test('central policy matches the current private storage boundary', () => {
    expect(CURRENT_STORAGE_LIMIT_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_BATCH_FILES).toBe(10);
    expect(MAX_BATCH_BYTES).toBe(25 * 1024 * 1024);
    const policy = publicFilePolicy();
    expect(policy.storage_bucket).toBe('client-documents');
    expect(policy.archive_support).toBe('deferred');
  });

  test('accepts current document and image formats but rejects unsupported archives and oversized files', () => {
    expect(validateFileMetadata({
      name:'statement.pdf',
      type:'application/pdf',
      size:1024
    })).toMatchObject({ valid:true, category:'document', processor:'document' });

    expect(classifyMedia({
      name:'store.jpg',
      type:'image/jpeg',
      size:2048
    })).toMatchObject({ valid:true, kind:'image', route:'vision', processor:'vision_pending' });

    expect(validateFileMetadata({
      name:'archive.zip',
      type:'application/zip',
      size:2048
    })).toMatchObject({ valid:false, code:'UNSUPPORTED_FILE_TYPE' });

    expect(validateFileMetadata({
      name:'large.pdf',
      type:'application/pdf',
      size:CURRENT_STORAGE_LIMIT_BYTES + 1
    })).toMatchObject({ valid:false, code:'FILE_TOO_LARGE' });
  });

  test('language engine distinguishes Arabic English and mixed input without translation', () => {
    expect(detectLanguage('مرحبا بكم')).toMatchObject({ language:'ar', direction:'rtl' });
    expect(detectLanguage('Hello world')).toMatchObject({ language:'en', direction:'ltr' });
    expect(detectLanguage('مرحبا Hello')).toMatchObject({ language:'mixed', script:'mixed' });
  });

  test.each([
    ['media_classify','assistant_media_classify'],
    ['language_detect','assistant_language_detect'],
    ['document_analyze','assistant_document_analyze']
  ])('%s is registered through the existing governed capability fabric', (action, adapterName) => {
    const spec = getCapability(action);
    expect(spec).toBeTruthy();
    expect(spec.active).toBe(true);
    expect(spec.serviceCode).toBe('assistant');
    expect(spec.runtime.adapter).toBe(adapterName);
    expect(getRuntimeAdapter(adapterName)).toEqual(expect.any(Function));
  });

  test('media classification runs through its registered adapter', async () => {
    const result = await getRuntimeAdapter('assistant_media_classify')({
      name:'invoice.pdf',
      type:'application/pdf',
      size:4096
    });
    expect(result).toMatchObject({
      ok:true,
      executed:true,
      result:{ valid:true, kind:'document', route:'document' }
    });
  });
});
