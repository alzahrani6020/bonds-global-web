'use strict';

// Request-scoped "the caller went away" signal.
//
// The assistant pipeline (planner -> search -> native generation, with retries
// and failover) is several layers deep. Rather than threading an AbortSignal
// through every signature, the HTTP entry point binds the client's disconnect
// signal here and the native transport reads it. Outside a bound scope every
// accessor is a no-op, so batch jobs, cron and tests behave exactly as before.

const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

const CLIENT_ABORT_CODE = 'NATIVE_RUNTIME_CLIENT_ABORT';

function runWithClientAbort(signal, fn) {
  return storage.run({ signal: signal || null }, fn);
}

function getClientAbortSignal() {
  return storage.getStore()?.signal || null;
}

function isClientAborted() {
  return getClientAbortSignal()?.aborted === true;
}

function clientAbortResponse(elapsedMs = 0) {
  return {
    ok: false,
    executed: false,
    error: {
      code: CLIENT_ABORT_CODE,
      message: 'Client disconnected before the native runtime answered',
      client_abort: true,
      elapsed_ms: elapsedMs
    }
  };
}

function isClientAbortResponse(response) {
  return response?.error?.code === CLIENT_ABORT_CODE;
}

module.exports = {
  CLIENT_ABORT_CODE,
  runWithClientAbort,
  getClientAbortSignal,
  isClientAborted,
  clientAbortResponse,
  isClientAbortResponse
};
