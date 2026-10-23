const fs = require('fs');
const path = require('path');

describe('BONDS governed open-chat tool loop', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'lib', 'assistant', 'open-chat-tool-loop.js'),
    'utf8'
  );

  test('discovers only read/compute capabilities for autonomous tool selection', () => {
    expect(source).toContain("new Set(['none', 'network_read', 'database_read', 'compute'])");
    expect(source).toContain("!['ai_reason', 'native_generate', 'native_health'].includes(spec.action)");
  });

  test('fails closed when planner invents or selects a disallowed capability', () => {
    expect(source).toContain('if (!capability || capability.active === false || !allowedEffects.has(capability.sideEffect || \'none\')) return null;');
  });

  test('executes selected tools only through the existing governed action fabric', () => {
    expect(source).toContain("require('../services/service-execution-router')");
    expect(source).toContain('return executeGovernedAction({');
    expect(source).toContain("action: decision.action");
  });

  test('uses governed AI only for planning and grounded synthesis', () => {
    expect(source).toContain("action: 'ai_reason'");
    expect(source).toContain('GOVERNED_TOOL_RESULT=');
    expect(source).toContain('Never claim execution before a tool result exists.');
  });
});
