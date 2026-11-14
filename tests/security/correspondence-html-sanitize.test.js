/** @jest-environment node */

const { sanitizePages } = require('../../lib/api/correspondence');

const clean = (html) => sanitizePages([html])[0];

describe('correspondence html sanitize', () => {
  test('removes style blocks with external @import', () => {
    const out = clean('<style>@import url("https://evil.example/x.css");</style><p>hi</p>');
    expect(out).not.toMatch(/<style/i);
    expect(out).not.toContain('@import');
    expect(out).toContain('<p>hi</p>');
  });

  test('removes style blocks nested inside inline SVG', () => {
    const out = clean('<svg viewBox="0 0 10 10"><style>@import url("https://evil.example/x.css");</style><rect width="10" height="10"/></svg>');
    expect(out).not.toMatch(/<style/i);
    expect(out).not.toContain('@import');
    expect(out).toContain('<rect');
  });

  test('removes unclosed style tags', () => {
    const out = clean('<style>body{background:url(https://evil.example/beacon)}<p>hi</p>');
    expect(out).not.toMatch(/<style/i);
  });

  test('removes link tags', () => {
    const out = clean('<link rel="stylesheet" href="https://evil.example/x.css"><p>hi</p>');
    expect(out).not.toMatch(/<link/i);
    expect(out).toContain('<p>hi</p>');
  });

  test('strips javascript: href in quoted, unquoted, mixed-case and entity-obfuscated forms', () => {
    const out = clean([
      '<a href="javascript:alert(1)">a</a>',
      '<a href=javascript:alert(1)>b</a>',
      '<a href="JaVaScRiPt:alert(1)">c</a>',
      '<a href="java&#9;script:alert(1)">d</a>',
      '<a href="&#106;avascript:alert(1)">e</a>',
      '<a href="  javascript:alert(1)">f</a>'
    ].join(''));
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toContain('&#106;');
    expect(out.match(/<a[ >]/g) || []).toHaveLength(6);
  });

  test('strips data: href and src', () => {
    const out = clean('<a href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;">x</a><img src="data:image/svg+xml;base64,AAA">');
    expect(out).not.toContain('data:text/html');
    expect(out).not.toContain('data:image/svg+xml');
    expect(out).toContain('<a>x</a>');
  });

  test('keeps safe markup, https links and inline style attributes', () => {
    const out = clean('<p style="color:red">hi</p><a href="https://example.com/path">x</a><img src="https://example.com/a.png">');
    expect(out).toContain('style="color:red"');
    expect(out).toContain('href="https://example.com/path"');
    expect(out).toContain('src="https://example.com/a.png"');
  });

  test('keeps stripping event handlers', () => {
    const out = clean('<p onclick="alert(1)">hi</p>');
    expect(out).not.toContain('onclick');
  });

  test('enforces the 750 KB page limit', () => {
    const big = '<p>' + 'x'.repeat(760_000) + '</p>';
    expect(() => sanitizePages([big])).toThrow(/750 KB/);
  });

  test('page count validation still applies', () => {
    expect(() => sanitizePages([])).toThrow();
    expect(() => sanitizePages(new Array(51).fill('<p>x</p>'))).toThrow();
  });
});
