'use strict';

const fs = require('fs');
const path = require('path');

describe('Bonds intelligence independence contract', () => {
  test('new native intelligence path contains no AFAQ/Ollama/OpenAI provider dependency', () => {
    const files = [
      'lib/ai/inference-router.js',
      'lib/capabilities/bonds-capability-registry.js',
      'lib/capabilities/governed-executor.js',
      'services/bonds_native_inference/native_generator.py',
      'services/bonds_native_inference/server.py'
    ];
    const combined = files.map(file =>
      fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    ).join('\n');

    expect(combined).not.toMatch(/AFAQ/i);
    expect(combined).not.toMatch(/Ollama/i);
    expect(combined).not.toMatch(/api\.openai\.com/i);
    expect(combined).not.toMatch(/OPENAI_API_KEY/i);
    expect(combined).toMatch(/llama_cpp/);
    expect(combined).toMatch(/Bonds Native Inference/);
  });
});
