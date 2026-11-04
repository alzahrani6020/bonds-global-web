'use strict';

const { resolveMigrationDbUrl } = require('../../lib/db/migration-db-url');

describe('resolveMigrationDbUrl', () => {
  const env = {
    SUPABASE_URL: 'https://hutxsqzplyuqgnghsrcs.supabase.co',
    SUPABASE_POOLER_HOST: 'aws-1-eu-central-1.pooler.supabase.com'
  };

  test('rewrites a direct db host to the IPv4 session pooler with project-ref user', () => {
    const resolved = resolveMigrationDbUrl(
      'postgresql://postgres:secret@db.hutxsqzplyuqgnghsrcs.supabase.co:5432/postgres',
      env
    );
    const url = new URL(resolved);
    expect(url.hostname).toBe('aws-1-eu-central-1.pooler.supabase.com');
    expect(url.port).toBe('5432');
    expect(decodeURIComponent(url.username)).toBe('postgres.hutxsqzplyuqgnghsrcs');
    expect(url.password).toBe('secret');
  });

  test('rewrites a pooler URL that still uses the bare postgres user', () => {
    const resolved = resolveMigrationDbUrl(
      'postgresql://postgres:secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
      env
    );
    const url = new URL(resolved);
    expect(decodeURIComponent(url.username)).toBe('postgres.hutxsqzplyuqgnghsrcs');
    expect(url.hostname).toBe('aws-1-eu-central-1.pooler.supabase.com');
  });

  test('keeps a pooler URL that already uses postgres.ref', () => {
    const input = 'postgresql://postgres.hutxsqzplyuqgnghsrcs:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    expect(resolveMigrationDbUrl(input, env)).toBe(input);
  });
});
