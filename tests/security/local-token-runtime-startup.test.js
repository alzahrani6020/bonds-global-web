/** @jest-environment node */
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveTokenRuntimeChannel } = require('../../lib/security/service-token-verifier');
const { resolveBrokerChannel } = require('../../lib/security/service-token-broker');

const channelSecret = 'local-channel-credential-12345678901234567890';
const brokerSecret = 'local-broker-credential-123456789012345678901';

describe('local Token Runtime startup contract', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  test('allows only explicit development loopback HTTP on 127.0.0.1:8771', () => {
    process.env.BONDS_TOKEN_ALLOW_LOCAL_HTTP = '1';
    delete process.env.VERCEL_ENV;

    expect(resolveTokenRuntimeChannel({
      url:'http://127.0.0.1:8771/introspect',
      channelSecret
    })).toMatchObject({ ok:true, origin:'http://127.0.0.1:8771' });

    expect(resolveBrokerChannel({
      issueUrl:'http://127.0.0.1:8771/broker/issue',
      introspectionUrl:'http://127.0.0.1:8771/introspect',
      brokerSecret
    })).toMatchObject({ ok:true, origin:'http://127.0.0.1:8771' });

    for (const url of [
      'http://localhost:8771/introspect',
      'http://127.0.0.1:9999/introspect',
      'http://192.168.1.5:8771/introspect'
    ]) {
      expect(resolveTokenRuntimeChannel({ url, channelSecret }))
        .toMatchObject({ ok:false, code:'TOKEN_VERIFIER_INVALID_CONFIGURATION' });
    }
  });

  test('production rejects loopback HTTP even when local opt-in is set', () => {
    process.env.BONDS_TOKEN_ALLOW_LOCAL_HTTP = '1';
    process.env.VERCEL_ENV = 'production';

    expect(resolveTokenRuntimeChannel({
      url:'http://127.0.0.1:8771/introspect',
      channelSecret
    })).toMatchObject({ ok:false, code:'TOKEN_VERIFIER_INVALID_CONFIGURATION' });

    expect(resolveBrokerChannel({
      issueUrl:'http://127.0.0.1:8771/broker/issue',
      introspectionUrl:'http://127.0.0.1:8771/introspect',
      brokerSecret
    })).toMatchObject({ ok:false, code:'TOKEN_BROKER_INVALID_CONFIGURATION' });
  });

  test('local dev server mirrors production readiness rewrite', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../scripts/dev-server.js'), 'utf8');
    expect(source).toContain("pathname === '/api/readiness'");
    expect(source).toContain("req.url = '/api/health?strict=1'");
  });

  test('Windows startup launcher keeps secrets in process memory and runs as SYSTEM at boot', () => {
    const runner = fs.readFileSync(path.join(__dirname, '../../scripts/run-local-web-system.ps1'), 'utf8');
    const installer = fs.readFileSync(path.join(__dirname, '../../scripts/install-local-web-startup.ps1'), 'utf8');

    expect(runner).toContain('BONDS_TOKEN_CHANNEL_SECRET_FILE');
    expect(runner).toContain('BONDS_TOKEN_BROKER_SECRET_FILE');
    expect(runner).toContain('[IO.File]::ReadAllText');
    expect(runner).not.toContain('Set-Content .env.local');
    expect(runner).not.toContain('BONDS_TOKEN_CHANNEL_SECRET=');

    expect(installer).toContain('New-ScheduledTaskTrigger -AtStartup');
    expect(installer).toContain('-UserId "SYSTEM"');
    expect(installer).toContain('-LogonType ServiceAccount');
    expect(installer).toContain('-RunLevel Highest');
  });
});
