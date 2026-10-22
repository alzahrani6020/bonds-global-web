'use strict';

// Standalone acceptance rehearsal. The Python issuer, SQLite store, TLS channel,
// verifier, policy, gateway, executor and research adapter are the real code.
// Only the outer user-session lookup and Supabase rows are synthetic fixtures.
// Nothing here discovers or contacts production, or binds the production 8771.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { execFile, execFileSync, spawn } = require('node:child_process');

const repository = path.resolve(__dirname, '../..');
const runtimeDirectory = path.join(repository, 'services/bonds_token_runtime');
const sourcePaths = [
  'api/health.js',
  'lib/security/service-token-verifier.js',
  'lib/security/service-token-broker.js',
  'lib/security/service-token-authorization.js',
  'lib/security/service-token-policies.js',
  'lib/capabilities/bonds-capability-registry.js',
  'lib/capabilities/generated-service-registry.js',
  'lib/capabilities/user-governance-context.js',
  'lib/capabilities/governance-gateway.js',
  'lib/capabilities/governed-executor.js',
  'lib/capabilities/runtime-adapters.js',
  'lib/intelligence/research-intelligence.js',
  'v3/api/capabilities.js',
  'services/bonds_token_runtime/bonds_security/server.py',
  'services/bonds_token_runtime/bonds_security/token_engine.py',
  'services/bonds_token_runtime/contract.json',
  'tests/helpers/capability-governance-fixture.js',
  'tests/integration/governed-token-runtime-acceptance.js',
  'tests/integration/governed-token-runtime.test.js',
  'tests/integration/fixtures/previous-token-runtime-server.py.txt',
  'tests/integration/fixtures/previous-token-runtime-engine.py.txt',
  'tests/integration/fixtures/previous-token-runtime-manifest.json'
];

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sourceHashes() {
  return Object.fromEntries(sourcePaths.map(file => [
    file, digest(fs.readFileSync(path.join(repository, file)))
  ]));
}

function createPreviousRuntime(directory) {
  const fixtures = path.join(__dirname, 'fixtures');
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtures, 'previous-token-runtime-manifest.json'), 'utf8'));
  assert.match(manifest.source_commit, /^[a-f0-9]{40}$/);
  assert.equal(manifest.fixture_file, 'previous-token-runtime-server.py.txt');
  assert.equal(manifest.engine_fixture_file, 'previous-token-runtime-engine.py.txt');
  const server = fs.readFileSync(path.join(fixtures, manifest.fixture_file));
  const engine = fs.readFileSync(path.join(fixtures, manifest.engine_fixture_file));
  assert.equal(digest(server), manifest.source_sha256, 'Previous server must be the exact recorded committed source');
  assert.equal(digest(engine), manifest.engine_sha256, 'Previous engine fixture must match the recorded committed source');
  const previousDirectory = path.join(directory, 'previous-runtime');
  const packageDirectory = path.join(previousDirectory, 'bonds_security');
  fs.mkdirSync(packageDirectory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(packageDirectory, '__init__.py'), '', { mode: 0o600 });
  fs.writeFileSync(path.join(packageDirectory, 'server.py'), server, { mode: 0o600 });
  fs.writeFileSync(path.join(packageDirectory, 'token_engine.py'), engine, { mode: 0o600 });
  return { directory: previousDirectory, manifest };
}

function cleanEnvironment() {
  const env = {};
  for (const key of ['PATH', 'SystemRoot', 'ComSpec', 'PATHEXT', 'WINDIR',
    'TMP', 'TEMP', 'HOME', 'LANG', 'LC_ALL', 'LD_LIBRARY_PATH']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  // Do not inherit production settings, credentials, preload hooks, proxy
  // settings or NODE_TLS_REJECT_UNAUTHORIZED from the calling environment.
  return env;
}

function command(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: repository, env: cleanEnvironment(), encoding: 'utf8',
    timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'], ...options
  });
}

function asynchronousCommand(file, args, options = {}) {
  return new Promise((resolve, reject) => execFile(file, args, {
    cwd: repository, env: cleanEnvironment(), encoding: 'utf8', timeout: 10_000,
    ...options
  }, (error, stdout) => error ? reject(error) : resolve(stdout)));
}

function createCertificate(directory) {
  const openssl = process.env.BONDS_TOKEN_TEST_OPENSSL || 'openssl';
  const file = name => path.join(directory, name);
  command(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes',
    '-keyout', file('ca.key'), '-out', file('ca.crt'), '-days', '1',
    '-subj', '/CN=BONDS Isolated Acceptance CA',
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
  command(openssl, ['req', '-new', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', file('server.key'), '-out', file('server.csr'),
    '-subj', '/CN=127.0.0.1']);
  fs.writeFileSync(file('server.ext'), [
    'basicConstraints=critical,CA:FALSE',
    'keyUsage=critical,digitalSignature,keyEncipherment',
    'extendedKeyUsage=serverAuth',
    'subjectAltName=IP:127.0.0.1', ''
  ].join('\n'), { mode: 0o600 });
  command(openssl, ['x509', '-req', '-in', file('server.csr'),
    '-CA', file('ca.crt'), '-CAkey', file('ca.key'), '-CAcreateserial',
    '-out', file('server.crt'), '-days', '1', '-sha256', '-extfile', file('server.ext')]);
}

async function launch() {
  const temporaryRoot = fs.existsSync(os.tmpdir()) ? os.tmpdir() : path.dirname(repository);
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'bonds-token-acceptance-'));
  let worker;
  let cleanupComplete = false;
  try {
    fs.chmodSync(directory, 0o700);
    for (const name of ['admin.secret', 'channel.secret', 'broker.secret']) {
      fs.writeFileSync(path.join(directory, name), crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    }
    createCertificate(directory);
    const buildCommit = command('git', ['rev-parse', 'HEAD']).trim();
    assert.match(buildCommit, /^[a-f0-9]{40}$/);
    const env = {
      ...cleanEnvironment(),
      NODE_EXTRA_CA_CERTS: path.join(directory, 'ca.crt'),
      BONDS_ACCEPTANCE_DIRECTORY: directory,
      BONDS_ACCEPTANCE_BUILD_COMMIT: buildCommit,
      BONDS_TOKEN_TEST_PYTHON: process.env.BONDS_TOKEN_TEST_PYTHON || 'python3'
    };
    const output = await new Promise((resolve, reject) => {
      worker = spawn(process.execPath, [__filename, '--worker'], {
        cwd: repository, env, stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';
      worker.stdout.on('data', data => { stdout += data; });
      worker.stderr.on('data', data => { stderr += data; });
      worker.once('error', reject);
      const timeout = setTimeout(() => worker.kill('SIGTERM'), 45_000);
      const forwardSignal = () => worker.kill('SIGTERM');
      process.once('SIGTERM', forwardSignal);
      process.once('SIGINT', forwardSignal);
      worker.once('close', (code, signal) => {
        clearTimeout(timeout);
        process.removeListener('SIGTERM', forwardSignal);
        process.removeListener('SIGINT', forwardSignal);
        resolve({ code, signal, stdout, stderr });
      });
    });
    fs.rmSync(directory, { recursive: true });
    cleanupComplete = true;
    let report;
    try { report = JSON.parse(output.stdout); }
    catch (_) {
      throw new Error(`Acceptance worker returned no valid report (exit=${output.code}, signal=${output.signal || 'none'}): ${output.stderr.slice(-2000)}`);
    }
    report.cleanup.temporary_files_removed = cleanupComplete;
    report.status = output.code === 0 && report.status === 'PASS' && cleanupComplete ? 'PASS' : 'FAIL';
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === 'PASS' ? 0 : 1;
  } finally {
    if (worker && worker.exitCode == null && worker.signalCode == null) worker.kill('SIGTERM');
    if (!cleanupComplete && fs.existsSync(directory)) fs.rmSync(directory, { recursive: true });
  }
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      assert.equal(address.address, '127.0.0.1');
      assert.notEqual(address.port, 8771);
      resolve(address.port);
    });
  });
}

async function unusedPort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function workerMain() {
  const directory = fs.realpathSync(process.env.BONDS_ACCEPTANCE_DIRECTORY);
  assert.ok(path.basename(directory).startsWith('bonds-token-acceptance-'));
  assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, undefined);
  assert.equal(process.env.NODE_EXTRA_CA_CERTS, path.join(directory, 'ca.crt'));
  const buildCommit = process.env.BONDS_ACCEPTANCE_BUILD_COMMIT;
  const python = process.env.BONDS_TOKEN_TEST_PYTHON;
  const database = path.join(directory, 'tokens.sqlite');
  const adminSecret = fs.readFileSync(path.join(directory, 'admin.secret'), 'utf8');
  const channelSecret = fs.readFileSync(path.join(directory, 'channel.secret'), 'utf8');
  const brokerSecret = fs.readFileSync(path.join(directory, 'broker.secret'), 'utf8');
  const hashes = sourceHashes();
  const report = {
    status: 'RUNNING', kind: 'isolated_runtime_acceptance',
    started_at_utc: new Date().toISOString(), source_base_commit: buildCommit,
    source_hashes: hashes, source_digest_sha256: digest(JSON.stringify(hashes)),
    source_worktree_status: command('git', ['status', '--porcelain']).trim().split('\n').filter(Boolean),
    runtime_build_identity: buildCommit,
    production_executed: false,
    real_components: ['Python Token Runtime process', 'SQLite token store', 'loopback TLS channel',
      'Node fetch with CA verification', 'service-token verifier and policy',
      'Capability API router', 'user governance resolver', 'Governance Gateway',
      'Governed Executor', 'research_intelligence_verify adapter'],
    fixtures: ['synthetic session-to-user lookup at the outer authentication boundary',
      'Supabase profile, permission, subscription and entitlement rows',
      'synthetic research evidence; no external research or writes'],
    limitations: ['Not a production user-session or Supabase acceptance test.',
      'Expiry is advanced by changing one token row in the temporary SQLite fixture.',
      'Configuration recovery and an actual prior server-code transition are rehearsed only with the temporary database and loopback TLS channel.',
      'The prior server is deliberately rejected by the candidate client. This proves fail-closed code rollback and candidate recovery, not an available or safe production rollback or Windows SCM rollback.'],
    cases: [], cleanup: { runtime_stopped: false, https_server_closed: false, temporary_files_removed: false }
  };
  let runtime = null;
  let runtimeExit = null;
  let upstreamPort;
  let proxy = null;
  let healthFault = false;
  let interrupted = false;
  let failure = null;
  const pids = [];
  const runtimeEnv = {
    ...cleanEnvironment(), PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1',
    BONDS_TOKEN_DB: database,
    BONDS_TOKEN_ADMIN_SECRET_FILE: path.join(directory, 'admin.secret'),
    BONDS_TOKEN_CHANNEL_SECRET_FILE: path.join(directory, 'channel.secret'),
    BONDS_TOKEN_BROKER_SECRET_FILE: path.join(directory, 'broker.secret'),
    BONDS_TOKEN_BUILD_COMMIT: buildCommit
  };
  async function stopRuntime() {
    if (!runtime) return;
    if (runtime.exitCode == null && runtime.signalCode == null) runtime.kill('SIGTERM');
    await runtimeExit;
    runtime = null;
  }
  const interrupt = () => {
    interrupted = true;
    if (runtime && runtime.exitCode == null) runtime.kill('SIGTERM');
  };
  process.on('SIGTERM', interrupt);
  process.on('SIGINT', interrupt);

  async function startRuntime({ cwd = runtimeDirectory, runtimeBuildCommit = buildCommit } = {}) {
    upstreamPort = await unusedPort();
    let logs = '';
    let startupError = null;
    runtime = spawn(python, ['-m', 'bonds_security.server'], {
      cwd,
      env: { ...runtimeEnv, BONDS_TOKEN_BUILD_COMMIT: runtimeBuildCommit, BONDS_TOKEN_PORT: String(upstreamPort) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    runtimeExit = new Promise(resolve => {
      runtime.once('exit', resolve);
      runtime.once('error', error => { startupError = error; resolve(); });
    });
    // Store only process diagnostics. Tokens and credentials are never logged.
    runtime.stdout.on('data', data => { logs = `${logs}${data}`.slice(-4000); });
    runtime.stderr.on('data', data => { logs = `${logs}${data}`.slice(-4000); });
    pids.push(runtime.pid);
    const deadline = Date.now() + 7000;
    while (Date.now() < deadline) {
      if (interrupted) throw new Error('Acceptance interrupted');
      if (startupError) throw new Error(`Runtime process could not start: ${startupError.code || 'unknown'}`);
      if (runtime.exitCode != null || runtime.signalCode != null) throw new Error(`Runtime startup failed: ${logs}`);
      try {
        const response = await fetch(`http://127.0.0.1:${upstreamPort}/health`, {
          headers: { 'X-Bonds-Channel': channelSecret }, signal: AbortSignal.timeout(500)
        });
        if (response.status === 200 && (await response.json()).build_commit === runtimeBuildCommit) return;
      } catch (_) { /* A bounded startup wait, not a skipped acceptance check. */ }
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw new Error(`Runtime did not become ready: ${logs}`);
  }

  async function check(name, fn) {
    if (interrupted) throw new Error('Acceptance interrupted');
    try { report.cases.push({ name, status: 'PASS', ...(await fn() || {}) }); }
    catch (error) {
      report.cases.push({ name, status: 'FAIL', error: error.message });
      throw error;
    }
  }

  try {
    await startRuntime();
    const { capabilitiesRouter } = require('../../v3/api/capabilities');
    const { probeTokenRuntime } = require('../../api/health');
    const { createGovernanceFixture } = require('../helpers/capability-governance-fixture');
    assert.equal(typeof probeTokenRuntime, 'function', 'Readiness probe export is required');
    const authorized = createGovernanceFixture({ serviceCode: 'research-intelligence' });
    const forbidden = createGovernanceFixture({ serviceCode: 'research-intelligence', permissions: [] });
    const unpaid = createGovernanceFixture({ serviceCode: 'research-intelligence' });
    unpaid.tables.admin_plan_entitlements[0].value = false;
    const expiredSubscription = createGovernanceFixture({ serviceCode: 'research-intelligence' });
    expiredSubscription.tables.subscriptions[0].current_period_start = new Date(Date.now() - 3_600_000).toISOString();
    expiredSubscription.tables.subscriptions[0].current_period_end = new Date(Date.now() - 60_000).toISOString();
    const disabled = createGovernanceFixture({ serviceCode: 'research-intelligence' });
    disabled.tables.profiles[0].status = 'inactive';
    const missingCatalog = createGovernanceFixture({ serviceCode: 'research-intelligence', tables: { admin_entitlements: [] } });
    const sessions = new Map([
      ['fixture-authorized-session', authorized], ['fixture-forbidden-session', forbidden],
      ['fixture-unpaid-session', unpaid], ['fixture-expired-subscription-session', expiredSubscription],
      ['fixture-disabled-session', disabled], ['fixture-missing-catalog-session', missingCatalog]
    ]);
    const forgedOptions = {
      actor: { id: 'forged-owner' }, userId: 'forged-owner', userTier: 'enterprise',
      governance: { permissions: ['research.intelligence.execute'], entitlements: ['research.intelligence'],
        enforcePermissions: false, enforceEntitlements: false }
    };
    proxy = https.createServer({
      key: fs.readFileSync(path.join(directory, 'server.key')),
      cert: fs.readFileSync(path.join(directory, 'server.crt'))
    }, (req, res) => {
      if (req.url === '/api/v3/capabilities/execute') {
        const session = String(req.headers.authorization || '').replace(/^Bearer /, '');
        const fixture = sessions.get(session);
        const options = { ...(req.headers['x-fixture-forged-options'] ? forgedOptions : {}), supabase: fixture?.db };
        capabilitiesRouter(req, res, '/capabilities/execute', fixture?.user || null, options)
          .catch(() => { res.statusCode = 500; res.end('{"error":"acceptance_handler_failed"}'); });
        return;
      }
      const upstream = http.request({
        host: '127.0.0.1', port: upstreamPort, path: req.url,
        method: req.method, headers: req.headers
      }, response => {
        if (healthFault && req.url === '/health' && response.statusCode === 200) {
          response.resume();
          response.on('end', () => {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"status":"ok"}');
          });
        } else {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        }
      });
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      req.pipe(upstream);
    });
    const port = await listen(proxy);
    const origin = `https://127.0.0.1:${port}`;
    process.env.BONDS_TOKEN_INTROSPECTION_URL = `${origin}/introspect`;
    process.env.BONDS_TOKEN_RUNTIME_HEALTH_URL = `${origin}/health`;
    process.env.BONDS_TOKEN_BROKER_URL = `${origin}/broker/issue`;
    process.env.BONDS_TOKEN_EXPECTED_BUILD_COMMIT = buildCommit;
    process.env.BONDS_TOKEN_CHANNEL_SECRET = channelSecret;
    process.env.BONDS_TOKEN_BROKER_SECRET = brokerSecret;
    report.transport = { bind_address: '127.0.0.1', tls_port: port, production_port_used: false,
      tls_trust: 'Ephemeral CA supplied to a fresh Node process through NODE_EXTRA_CA_CERTS' };

    async function jsonRequest(route, { headers = {}, body, method = body === undefined ? 'GET' : 'POST' } = {}) {
      const response = await fetch(`${origin}${route}`, {
        method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(5000), redirect: 'error'
      });
      const payload = await response.json();
      return { status: response.status, body: payload };
    }
    async function issue(overrides = {}) {
      const response = await jsonRequest('/issue', {
        headers: { 'X-Bonds-Admin': adminSecret },
        body: { token_type: 'service', subject: 'service:orchestrator', audience: 'research-intelligence',
          scopes: ['research:read'], ttl: 3600, ...overrides }
      });
      assert.equal(response.status, 200, 'Isolated runtime must issue the fixture token');
      assert.ok(typeof response.body.token === 'string' && response.body.token.startsWith('bonds_'));
      return response.body.token;
    }
    const researchInput = { topic: 'Isolated acceptance fixture', sources: [
      { id: 'fixture-a', publisher: 'Fixture Publisher A', claims: [{ key: 'fixture-metric', value: 7 }] },
      { id: 'fixture-b', publisher: 'Fixture Publisher B', claims: [{ key: 'fixture-metric', value: 7 }] }
    ] };
    async function execute(token, { session = 'fixture-authorized-session', body = {}, headers = {} } = {}) {
      return jsonRequest('/api/v3/capabilities/execute', {
        headers: { ...(session ? { authorization: `Bearer ${session}` } : {}),
          ...(token ? { 'x-bonds-service-token': token } : {}), ...headers },
        body: { action: 'research_intelligence_verify', input: researchInput, ...body }
      });
    }
    function denied(response, status, code) {
      assert.equal(response.status, status);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.executed, false);
      if (code) assert.equal(response.body.error?.code, code);
      return { http_status: response.status, code: response.body.error?.code, executed: false };
    }
    function accepted(response) {
      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.executed, true);
      assert.equal(response.body.governance.enforced, true);
      assert.equal(response.body.result.verification_state, 'SUPPORTED');
      assert.match(response.body.verification_digest, /^[a-f0-9]{64}$/);
      return { http_status: 200, executed: true, adapter: 'research_intelligence_verify',
        verification_digest: response.body.verification_digest };
    }

    await check('TLS verification rejects the ephemeral certificate without its CA', async () => {
      const script = "fetch(process.env.BONDS_ACCEPTANCE_URL).then(()=>process.exit(1)).catch(e=>{const c=e.cause?.code||'';process.exit(/CERT|UNABLE_TO_VERIFY/.test(c)?0:2);});";
      // This child deliberately has no NODE_EXTRA_CA_CERTS. The request carries no credentials.
      await asynchronousCommand(process.execPath, ['-e', script], { env: { ...cleanEnvironment(), BONDS_ACCEPTANCE_URL: `${origin}/health` } });
      return { tls_verification_disabled: false };
    });
    await check('Readiness verifies the live runtime contract and protected introspection', async () => {
      const probe = await probeTokenRuntime();
      assert.equal(probe.status, 'ok');
      assert.equal(probe.required, true);
      return { runtime_build_commit: buildCommit, result: probe };
    });
    await check('A status-only health response cannot pass readiness', async () => {
      healthFault = true;
      try {
        const probe = await probeTokenRuntime();
        assert.notEqual(probe.status, 'ok');
        assert.equal(probe.required, true);
        return { fault_injection: 'TLS proxy strips the real runtime identity/contract fields', result: probe };
      } finally { healthFault = false; }
    });
    const validToken = await issue();
    await check('Authorized user and issued service token execute the actual Capability', async () => accepted(await execute(validToken)));
    await check('Unauthenticated user is rejected at the actual Capability router', async () => {
      const response = await execute(validToken, { session: null });
      assert.equal(response.status, 401);
      return { http_status: response.status };
    });
    await check('Unprivileged user cannot execute with a valid service token', async () =>
      denied(await execute(validToken, { session: 'fixture-forbidden-session' }), 403, 'PERMISSION_DENIED'));
    await check('Missing entitlement is rejected inside governed execution', async () =>
      denied(await execute(validToken, { session: 'fixture-unpaid-session' }), 403, 'ENTITLEMENT_DENIED'));
    await check('Expired user subscription cannot retain paid entitlement', async () =>
      denied(await execute(validToken, { session: 'fixture-expired-subscription-session' }), 403, 'ENTITLEMENT_DENIED'));
    await check('Disabled user is rejected by server-resolved account status', async () =>
      denied(await execute(validToken, { session: 'fixture-disabled-session' }), 403, 'USER_DISABLED'));
    await check('Missing entitlement catalog fails closed as unavailable', async () =>
      denied(await execute(validToken, { session: 'fixture-missing-catalog-session' }), 503, 'ENTITLEMENT_CATALOG_UNAVAILABLE'));
    await check('Authorized user automatically receives a one-time broker token and executes without a token header', async () => {
      const response = await execute(null);
      const acceptedResult = accepted(response);
      const brokerRows = command(python, ['-c', [
        'import json, sqlite3, sys',
        'with sqlite3.connect(sys.argv[1]) as db:',
        '    rows=db.execute("SELECT issued_by, revoked, consumed_at FROM tokens WHERE issued_by=?", ("broker",)).fetchall()',
        'print(json.dumps(rows))'
      ].join('\\n'), database]).trim();
      const rows = JSON.parse(brokerRows);
      assert.ok(rows.length >= 1);
      const latest = rows[rows.length - 1];
      assert.deepEqual(latest.slice(0, 2), ['broker', 1]);
      assert.equal(Number.isInteger(latest[2]), true);
      return { ...acceptedResult, automatic_service_token: true, one_time_consumed: true };
    });
    await check('Channel credential cannot be used as a service token', async () =>
      denied(await execute(channelSecret), 503, 'TOKEN_CREDENTIALS_NOT_SEPARATE'));
    await check('Forged caller permission, entitlement, actor and tier context cannot grant access', async () =>
      denied(await execute(validToken, { session: 'fixture-forbidden-session', body: forgedOptions,
        headers: { 'x-fixture-forged-options': '1' } }), 403, 'PERMISSION_DENIED'));
    await check('The introspection channel rejects missing and admin credentials', async () => {
      for (const headers of [{}, { 'X-Bonds-Admin': adminSecret }, { 'X-Bonds-Channel': validToken }]) {
        assert.equal((await jsonRequest('/introspect', { headers, body: { token: validToken } })).status, 401);
      }
      assert.equal((await jsonRequest('/health')).status, 401);
      assert.equal((await jsonRequest('/issue', { headers: { 'X-Bonds-Channel': channelSecret }, body: {} })).status, 401);
      assert.equal((await jsonRequest('/broker/issue', {
        headers: { 'X-Bonds-Admin': adminSecret },
        body: { audience: 'research-intelligence' }
      })).status, 401);
      assert.equal((await jsonRequest('/broker/issue', {
        headers: { 'X-Bonds-Channel': channelSecret },
        body: { audience: 'research-intelligence' }
      })).status, 401);
      return { http_status: 401, credentials_separate: true, broker_separate: true };
    });
    const wrongScopeToken = await issue({ scopes: ['orchestrator:dispatch'] });
    await check('Wrong-scope service token is rejected by actual policy', async () =>
      denied(await execute(wrongScopeToken), 403, 'TOKEN_SCOPE_DENIED'));
    const expiredToken = await issue();
    const expiryScript = [
      'import json, pathlib, sqlite3, sys',
      'v=json.load(sys.stdin)',
      'database=pathlib.Path(v["database"]).resolve()',
      'assert database.parent == pathlib.Path(v["temporary_root"]).resolve()',
      'with sqlite3.connect(database) as db:',
      '    cursor=db.execute("UPDATE tokens SET issued_at=1, expires_at=3601 WHERE token_hash=?", (v["token_hash"],))',
      '    assert cursor.rowcount == 1',
      '    db.commit()'
    ].join('\n');
    command(python, ['-c', expiryScript], { input: JSON.stringify({
      database, temporary_root: directory, token_hash: digest(expiredToken)
    }) });
    await check('Expired token is rejected through real runtime introspection', async () => ({
      ...denied(await execute(expiredToken), 403, 'TOKEN_INACTIVE'),
      fixture: 'One issued token timestamp is advanced in the isolated SQLite store; TTL production policy is unchanged'
    }));
    const revokedToken = await issue();
    const revokeResponse = await jsonRequest('/revoke', { headers: { 'X-Bonds-Admin': adminSecret }, body: { token: revokedToken } });
    assert.equal(revokeResponse.status, 200);
    assert.equal(revokeResponse.body.revoked, true);
    await check('Revoked token is rejected through real runtime introspection', async () =>
      denied(await execute(revokedToken), 403, 'TOKEN_INACTIVE'));
    await check('Blocked channel cannot appear as successful Capability execution', async () => {
      process.env.BONDS_TOKEN_CHANNEL_SECRET = crypto.randomBytes(32).toString('hex');
      try { return denied(await execute(validToken), 503, 'TOKEN_CHANNEL_REJECTED'); }
      finally { process.env.BONDS_TOKEN_CHANNEL_SECRET = channelSecret; }
    });
    await check('Missing verifier configuration cannot appear as success', async () => {
      delete process.env.BONDS_TOKEN_INTROSPECTION_URL;
      try { return denied(await execute(validToken), 503); }
      finally { process.env.BONDS_TOKEN_INTROSPECTION_URL = `${origin}/introspect`; }
    });
    await check('Missing expected runtime build cannot appear as successful execution', async () => {
      delete process.env.BONDS_TOKEN_EXPECTED_BUILD_COMMIT;
      try { return denied(await execute(validToken), 503, 'TOKEN_RUNTIME_BUILD_UNCONFIGURED'); }
      finally { process.env.BONDS_TOKEN_EXPECTED_BUILD_COMMIT = buildCommit; }
    });
    await check('Revocation persists across an actual runtime process restart', async () => {
      const previousPid = runtime.pid;
      await stopRuntime();
      await startRuntime();
      assert.notEqual(runtime.pid, previousPid);
      const introspection = await jsonRequest('/introspect', { headers: { 'X-Bonds-Channel': channelSecret }, body: { token: revokedToken } });
      assert.equal(introspection.body.claims.active, false);
      assert.equal(introspection.body.claims.revoked, true);
      denied(await execute(revokedToken), 403, 'TOKEN_INACTIVE');
      accepted(await execute(validToken));
      return { actual_process_restart: true, same_temporary_database: true, revoked_token_still_denied: true,
        previously_valid_token_still_executes: true };
    });
    await check('Failed configuration preflight preserves DB and allows isolated recovery', async () => {
      await stopRuntime();
      const before = digest(fs.readFileSync(database));
      let preflightFailed = false;
      try {
        command(python, ['-m', 'bonds_security.server', '--check-config'], {
          cwd: runtimeDirectory,
          env: { ...runtimeEnv, BONDS_TOKEN_PORT: String(await unusedPort()),
            BONDS_TOKEN_CHANNEL_SECRET_FILE: path.join(directory, 'admin.secret') }
        });
      } catch (error) {
        preflightFailed = Number.isInteger(error.status) && error.status !== 0;
      }
      assert.equal(preflightFailed, true);
      assert.equal(digest(fs.readFileSync(database)), before, 'Invalid preflight must not modify the token store');
      await startRuntime();
      assert.equal((await probeTokenRuntime()).status, 'ok');
      denied(await execute(revokedToken), 403, 'TOKEN_INACTIVE');
      accepted(await execute(validToken));
      return { failed_preflight: true, database_unchanged: true, recovered_same_candidate_and_database: true,
        production_or_windows_scm_rollback_tested: false };
    });
    const previous = createPreviousRuntime(directory);
    report.previous_runtime_source = { ...previous.manifest, exact_fixture_hash_verified: true,
      unchanged_engine_hash_verified: true, copied_to_temporary_package_only: true };
    let databaseBeforeRollback;
    await check('Actual prior server code fails closed while preserving token revocation', async () => {
      const candidatePid = runtime.pid;
      await stopRuntime();
      databaseBeforeRollback = digest(fs.readFileSync(database));
      await startRuntime({ cwd: previous.directory, runtimeBuildCommit: previous.manifest.source_commit });
      assert.notEqual(runtime.pid, candidatePid);
      const readiness = await probeTokenRuntime();
      assert.equal(readiness.status, 'contract_mismatch');
      const liveClaims = await jsonRequest('/introspect', {
        headers: { 'X-Bonds-Channel': channelSecret }, body: { token: validToken }
      });
      assert.equal(liveClaims.status, 200);
      assert.equal(liveClaims.body.runtime, undefined);
      assert.equal(liveClaims.body.claims.active, true);
      assert.equal(liveClaims.body.claims.revoked, false);
      const revokedClaims = await jsonRequest('/introspect', {
        headers: { 'X-Bonds-Channel': channelSecret }, body: { token: revokedToken }
      });
      assert.equal(revokedClaims.body.claims.active, false);
      assert.equal(revokedClaims.body.claims.revoked, true);
      const adminVerification = await jsonRequest('/verify', {
        headers: { 'X-Bonds-Admin': adminSecret },
        body: { token: revokedToken, audience: 'research-intelligence', required_scope: 'research:read' }
      });
      assert.equal(adminVerification.status, 200);
      assert.equal(adminVerification.body.valid, false);
      const validDenied = denied(await execute(validToken), 503, 'TOKEN_RUNTIME_CONTRACT_MISMATCH');
      const revokedDenied = denied(await execute(revokedToken), 503, 'TOKEN_RUNTIME_CONTRACT_MISMATCH');
      assert.equal(digest(fs.readFileSync(database)), databaseBeforeRollback, 'Prior server reads must not alter the token store');
      return { previous_server_commit: previous.manifest.source_commit,
        previous_server_sha256: previous.manifest.source_sha256, actual_code_transition: true,
        unchanged_engine: true, same_temporary_database: true, database_unchanged: true,
        legacy_valid_claims_remain_active: true, legacy_revoked_claims_remain_inactive: true,
        legacy_admin_verification_rejects_revoked: true,
        candidate_readiness: readiness, valid_token_execution: validDenied, revoked_token_execution: revokedDenied,
        production_or_windows_scm_rollback_tested: false };
    });
    await check('Restoring candidate code after rollback preserves revocation and authorized execution', async () => {
      const previousPid = runtime.pid;
      await stopRuntime();
      await startRuntime();
      assert.notEqual(runtime.pid, previousPid);
      assert.equal((await probeTokenRuntime()).status, 'ok');
      const revokedDenial = denied(await execute(revokedToken), 403, 'TOKEN_INACTIVE');
      const validExecution = accepted(await execute(validToken));
      assert.equal(digest(fs.readFileSync(database)), databaseBeforeRollback, 'Restored candidate must preserve the same token store');
      return { restored_candidate_code: true, same_temporary_database: true, database_unchanged: true,
        revoked_token_execution: revokedDenial, valid_token_execution: validExecution,
        production_or_windows_scm_rollback_tested: false };
    });
    assert.deepEqual(sourceHashes(), hashes, 'Source changed during acceptance; rerun against a stable candidate');
    report.status = 'PASS';
  } catch (error) {
    failure = error;
    report.status = 'FAIL';
    report.error = error.message;
  } finally {
    try { await stopRuntime(); report.cleanup.runtime_stopped = true; }
    catch (error) { failure = error; report.cleanup.runtime_error = error.message; }
    if (proxy) {
      try {
        proxy.closeAllConnections();
        await new Promise((resolve, reject) => proxy.close(error => error ? reject(error) : resolve()));
        report.cleanup.https_server_closed = true;
      } catch (error) { failure = error; report.cleanup.https_error = error.message; }
    }
    process.removeListener('SIGTERM', interrupt);
    process.removeListener('SIGINT', interrupt);
    report.runtime_process_count = pids.length;
    report.completed_at_utc = new Date().toISOString();
    if (failure || interrupted) report.status = 'FAIL';
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.exitCode = report.status === 'PASS' ? 0 : 1;
  }
}

if (require.main === module) {
  (process.argv.includes('--worker') ? workerMain() : launch()).catch(error => {
    process.stderr.write(`Isolated token acceptance failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
