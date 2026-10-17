'use strict';

const { fork } = require('child_process');
const { Worker } = require('worker_threads');
const { MAX_RAW_BYTES, detectParserKind } = require('./document-parser-core');

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_CONCURRENCY = 2;
const MAX_QUEUE = 8;
const PUBLIC_MESSAGES = Object.freeze({
  RESOURCE_LIMIT: 'Document exceeds processing limits',
  SIGNATURE_MISMATCH: 'Document type does not match its contents',
  MALFORMED_ARCHIVE: 'Document container is malformed',
  MALFORMED_DOCUMENT: 'Document could not be processed',
  UNSUPPORTED_DOCUMENT: 'Document type is not supported',
  PARSER_TIMEOUT: 'Document processing timed out',
  DOCUMENT_BUSY: 'Document processing capacity is temporarily full',
  PARSER_FAILED: 'Document could not be processed'
});

let activeWorkers = 0;
const waiting = [];

class DocumentParserError extends Error {
  constructor(code) {
    super(PUBLIC_MESSAGES[code] || PUBLIC_MESSAGES.PARSER_FAILED);
    this.name = 'DocumentParserError';
    this.code = PUBLIC_MESSAGES[code] ? code : 'PARSER_FAILED';
  }
}

function acquireSlot() {
  if (activeWorkers < MAX_CONCURRENCY) {
    activeWorkers += 1;
    return Promise.resolve();
  }

  if (waiting.length >= MAX_QUEUE) {
    return Promise.reject(new DocumentParserError('DOCUMENT_BUSY'));
  }

  return new Promise(resolve => {
    waiting.push(resolve);
  });
}

function releaseSlot() {
  activeWorkers = Math.max(0, activeWorkers - 1);
  const next = waiting.shift();
  if (next) {
    activeWorkers += 1;
    next();
  }
}

function normalizeTimeout(value) {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 30_000) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(numeric);
}

function validateRawBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new DocumentParserError('MALFORMED_DOCUMENT');
  }
  if (buffer.length === 0) {
    throw new DocumentParserError('MALFORMED_DOCUMENT');
  }
  if (buffer.length > MAX_RAW_BYTES) {
    throw new DocumentParserError('RESOURCE_LIMIT');
  }
}

function runParserWorker({ buffer, mime, filename }, options = {}) {
  try {
    validateRawBuffer(buffer);
  } catch (error) {
    return Promise.reject(error);
  }

  const timeoutMs = normalizeTimeout(options.timeoutMs);

  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(require.resolve('./document-parser-worker.js'), {
      workerData: {
        buffer,
        mime: String(mime || ''),
        filename: String(filename || '')
      },
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 32,
        stackSizeMb: 4
      }
    });

    const finish = callback => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      Promise.resolve(worker.terminate())
        .catch(error => {
          console.error('[document-parser] worker termination failed', error);
        })
        .finally(() => {
          reject(new DocumentParserError('PARSER_TIMEOUT'));
        });
    }, timeoutMs);

    worker.once('message', message => {
      finish(() => {
        if (message && message.ok) {
          resolve(message.result);
          return;
        }

        const code = message && message.code ? message.code : 'PARSER_FAILED';
        const internal = message && message.internalMessage
          ? message.internalMessage
          : 'worker returned an unspecified parser error';
        console.warn(`[document-parser] ${code}: ${internal}`);
        reject(new DocumentParserError(code));
      });
    });

    worker.once('error', error => {
      finish(() => {
        console.error('[document-parser] worker error', error);
        reject(new DocumentParserError('PARSER_FAILED'));
      });
    });

    worker.once('exit', code => {
      if (settled) return;
      finish(() => {
        if (code === 0) {
          reject(new DocumentParserError('PARSER_FAILED'));
          return;
        }
        console.warn(`[document-parser] worker exited with code ${code}`);
        reject(new DocumentParserError('PARSER_FAILED'));
      });
    });
  });
}

function runPdfProcess({ buffer, mime, filename }, options = {}) {
  try {
    validateRawBuffer(buffer);
  } catch (error) {
    return Promise.reject(error);
  }

  const timeoutMs = normalizeTimeout(options.timeoutMs);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let response = null;
    let stderr = '';

    const child = fork(require.resolve('./document-parser-pdf-child.js'), [], {
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      serialization: 'advanced',
      windowsHide: true,
      execArgv: [
        '--max-old-space-size=160',
        '--max-semi-space-size=32'
      ]
    });

    const finish = callback => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    if (child.stderr) {
      child.stderr.on('data', chunk => {
        if (stderr.length >= 4000) return;
        stderr += String(chunk).slice(0, 4000 - stderr.length);
      });
    }

    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.once('message', message => {
      response = message;
    });

    child.once('error', error => {
      finish(() => {
        console.error('[document-parser] pdf child error', error);
        reject(new DocumentParserError('PARSER_FAILED'));
      });
    });

    child.once('exit', (code, signal) => {
      finish(() => {
        if (timedOut) {
          reject(new DocumentParserError('PARSER_TIMEOUT'));
          return;
        }

        if (code === 0 && response && response.ok) {
          resolve(response.result);
          return;
        }

        if (code === 0 && response && response.code) {
          const internal = response.internalMessage
            ? response.internalMessage
            : 'pdf child returned an unspecified parser error';
          console.warn(`[document-parser] ${response.code}: ${internal}`);
          reject(new DocumentParserError(response.code));
          return;
        }

        const detail = stderr.trim()
          ? `: ${stderr.trim()}`
          : '';
        console.warn(
          `[document-parser] pdf child exited abnormally ` +
          `(code=${code}, signal=${signal || 'none'})${detail}`
        );
        reject(new DocumentParserError('PARSER_FAILED'));
      });
    });

    child.send({
      buffer,
      mime: String(mime || ''),
      filename: String(filename || '')
    }, error => {
      if (!error || settled) return;
      child.kill();
      finish(() => {
        console.error('[document-parser] pdf child IPC failed', error);
        reject(new DocumentParserError('PARSER_FAILED'));
      });
    });
  });
}

async function parseDocument(input, options = {}) {
  await acquireSlot();
  try {
    const kind = detectParserKind(input && input.mime);
    if (kind === 'pdf') {
      return await runPdfProcess(input, options);
    }
    return await runParserWorker(input, options);
  } finally {
    releaseSlot();
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MAX_CONCURRENCY,
  MAX_QUEUE,
  DocumentParserError,
  parseDocument,
  runParserWorker,
  runPdfProcess
};
