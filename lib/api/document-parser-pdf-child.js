'use strict';

const {
  parseDocumentBuffer,
  ParserPolicyError
} = require('./document-parser-core');

function sendResult(message) {
  if (!process.connected) {
    process.exitCode = 1;
    return;
  }

  process.send(message, error => {
    if (error) {
      process.exitCode = 1;
    }
    if (process.connected) {
      process.disconnect();
    }
  });
}

process.once('message', async input => {
  try {
    const result = await parseDocumentBuffer({
      buffer: Buffer.from(input.buffer),
      mime: input.mime,
      filename: input.filename
    });

    sendResult({ ok: true, result });
  } catch (error) {
    const code = error instanceof ParserPolicyError
      ? error.code
      : 'PARSER_FAILED';

    sendResult({
      ok: false,
      code,
      internalMessage: String(
        error && error.message ? error.message : error
      ).slice(0, 1000)
    });
  }
});
