const fs = require('fs');
const path = require('path');
const Module = require('module');

describe('Mammoth production runtime surface', () => {
  test('document analyzer uses the library API instead of the Mammoth CLI', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../lib/api/analyze-document.js'),
      'utf8'
    );

    expect(source).toContain("const mammoth = require('mammoth');");
    expect(source).toContain('mammoth.extractRawText');
    expect(source).not.toMatch(/bin[\\/]mammoth/);
    expect(source).not.toMatch(/child_process/);
  });

  test('loading the Mammoth library API does not load argparse', () => {
    const originalLoad = Module._load;
    let argparseLoaded = false;

    Module._load = function(request, parent, isMain) {
      if (request === 'argparse' || String(request).includes('argparse')) {
        argparseLoaded = true;
      }
      return originalLoad.call(this, request, parent, isMain);
    };

    try {
      jest.resetModules();
      const mammoth = require('mammoth');
      expect(typeof mammoth.extractRawText).toBe('function');
      expect(argparseLoaded).toBe(false);
    } finally {
      Module._load = originalLoad;
    }
  });
});
