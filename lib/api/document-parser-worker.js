'use strict';

const { parentPort, workerData } = require('worker_threads');
const { parseDocumentBuffer, ParserPolicyError } = require('./document-parser-core');

(async () => {
  try {
    const result = await parseDocumentBuffer({
      buffer: Buffer.from(workerData.buffer),
      mime: workerData.mime,
      filename: workerData.filename
    });
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    const code = error instanceof ParserPolicyError
      ? error.code
      : 'PARSER_FAILED';

    parentPort.postMessage({
      ok: false,
      code,
      internalMessage: String(error && error.message ? error.message : error).slice(0, 1000)
    });
  }
})();
