const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('Unified service execution gateway', () => {
  test('service discovery routes capability-backed services through the execution workspace', () => {
    const source = read('components/service-discovery.js');
    expect(source).toContain('hasExecutionCapabilities');
    expect(source).toContain('selectedService.capabilities.length > 0');
    expect(source).toContain('if (directRoute && !hasExecutionCapabilities)');
    expect(source).toContain('/service-request.html');
  });

  test('service request executes automated services before request fallback', () => {
    const source = read('components/service-request.js');
    expect(source).toContain("fetch('/api/v3/services/execute'");
    expect(source).toContain("execution.executed===true");
    expect(source).toContain("SERVICE_EXECUTION_NOT_AUTOMATED");
    expect(source).toContain("/api/v3/services/requests");
  });

  test('missing deterministic inputs are rendered for a second execution attempt', () => {
    const source = read('components/service-request.js');
    expect(source).toContain('ensureExecutionFields(requiredInputs)');
    expect(source).toContain('total_debt');
    expect(source).toContain('equity');
    expect(source).toContain('required_inputs');
  });
});
