const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe('admin operations reliability', () => {
  test('users UI clears recovered errors and ignores stale requests', () => {
    const users = read('admin/users.html');

    expect(users).toContain('let usersRequestSeq = 0');
    expect(users).toContain('let lastAppliedUsersRequest = 0');
    expect(users).toContain('requestSeq < usersRequestSeq');
    expect(users).toContain("errEl.style.display = 'none'");
    expect(users).toContain("window.addEventListener('pagehide', stopOnlineRefresh)");
    expect(users).toContain('if (!document.hidden) fetchOnlineUserIds()');
  });

  test('users API avoids unbounded auth-admin fan-out', () => {
    const api = read('api/admin.js');
    const start = api.indexOf('async function getUsers');
    const end = api.indexOf('async function updateUser', start);
    const usersApi = api.slice(start, end);

    expect(usersApi).toContain('const AUTH_LOOKUP_CONCURRENCY = 5');
    expect(usersApi).toContain('const authFallbackQueue = (profileList || []).filter');
    expect(usersApi).toContain('authFallbackWorker');
    expect(usersApi).not.toContain("Promise.all((profileList || []).map(async (p) =>");
  });

  test('system health exposes bounded operational telemetry without secret values', () => {
    const api = read('api/admin.js');

    expect(api).toContain('async function getSystemHealth(sb)');
    expect(api).toContain('process.memoryUsage()');
    expect(api).toContain('heapUtilizationPct');
    expect(api).toContain("if (action === 'system-health')");
    expect(api).toContain('requestId');
    expect(api).not.toContain('supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY');
  });

  test('admin overview renders system health and memory indicators', () => {
    const dashboard = read('admin/dashboard.html');

    expect(dashboard).toContain("apiGet('system-health')");
    expect(dashboard).toContain('Heap utilization');
    expect(dashboard).toContain('DB latency');
    expect(dashboard).toContain('Health request ID');
  });

  test('operations inbox aggregates existing action queues without new schema', () => {
    const api = read('api/admin.js');
    const dashboard = read('admin/dashboard.html');

    expect(api).toContain('async function getOperationsOverview(sb)');
    expect(api).toContain("if (action === 'operations-overview')");
    expect(api).toContain("eq('read', false)");
    expect(api).toContain("eq('status', 'pending')");
    expect(api).toContain("lt('profile_completeness', 100)");
    expect(api).toContain("lt('sla_deadline_at', now)");

    expect(dashboard).toContain("apiGet('operations-overview')");
    expect(dashboard).toContain('صندوق العمليات');
    expect(dashboard).toContain('SLA متأخر');
  });
});
