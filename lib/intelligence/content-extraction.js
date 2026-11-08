'use strict';

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function extractProfilePageMetadata(raw) {
  const scripts = [...String(raw || '').matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )];
  for (const match of scripts) {
    let value;
    try {
      value = JSON.parse(match[1]);
    } catch (_) {
      continue;
    }
    const nodes = Array.isArray(value) ? value : [value];
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const pageTypes = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      if (!pageTypes.includes('ProfilePage')) continue;
      const entity = node.mainEntity;
      if (!entity || typeof entity !== 'object') continue;
      const entityTypes = Array.isArray(entity['@type']) ? entity['@type'] : [entity['@type']];
      if (!entityTypes.includes('Person')) continue;
      const worksFor = entity.worksFor && typeof entity.worksFor === 'object' ? entity.worksFor : null;
      return {
        profile_page:true,
        profile_page_url:normalizeText(node.url || ''),
        person_name:normalizeText(entity.name || ''),
        person_alternate_names:(Array.isArray(entity.alternateName) ? entity.alternateName : [entity.alternateName])
          .map(normalizeText)
          .filter(Boolean),
        works_for_name:normalizeText(worksFor?.name || ''),
        works_for_url:normalizeText(worksFor?.url || '')
      };
    }
  }
  return null;
}

function extractHtml(html) {
  const raw = String(html || '');
  const title = (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || null;
  const profilePage = extractProfilePageMetadata(raw);
  const withoutScripts = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  const text = normalizeText(withoutScripts.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' '));
  return {
    format:'html',
    title:title ? normalizeText(title) : null,
    text,
    ...(profilePage ? { profile_page:profilePage } : {})
  };
}

function extractCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  const rows = lines.map(line => line.split(',').map(v => v.trim()));
  return { format: 'csv', rows, text: normalizeText(text) };
}

function extractXml(text) {
  return { format: 'xml', text: normalizeText(String(text || '').replace(/<[^>]+>/g, ' ')) };
}

async function extractContent(input, contentType = '') {
  const body = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ''), 'utf8');
  const type = String(contentType || '').toLowerCase();

  if (type.includes('application/json') || /^[\s]*[\[{]/.test(body.toString('utf8'))) {
    try {
      const data = JSON.parse(body.toString('utf8'));
      return { format: 'json', data, text: normalizeText(JSON.stringify(data)) };
    } catch (_) {}
  }
  if (type.includes('text/csv') || type.includes('application/csv')) return extractCsv(body.toString('utf8'));
  if (type.includes('xml')) return extractXml(body.toString('utf8'));
  if (type.includes('pdf')) {
    try {
      const pdf = require('pdf-parse');
      if (typeof pdf === 'function') {
        const parsed = await pdf(body);
        return { format: 'pdf', text: normalizeText(parsed?.text || '') };
      }
      const PDFParse = pdf.PDFParse || pdf.default?.PDFParse;
      if (typeof PDFParse === 'function') {
        const parser = new PDFParse({ data: body });
        try {
          const parsed = await parser.getText();
          return { format: 'pdf', text: normalizeText(parsed?.text || parsed || '') };
        } finally {
          if (typeof parser.destroy === 'function') await parser.destroy();
        }
      }
      throw new Error('Unsupported pdf-parse API');
    } catch (err) {
      return { format: 'pdf', text: '', extraction_error: err.message };
    }
  }
  if (type.includes('html') || /<html|<body|<title/i.test(body.toString('utf8'))) return extractHtml(body.toString('utf8'));
  return { format: 'text', text: normalizeText(body.toString('utf8')) };
}

module.exports = { normalizeText, extractProfilePageMetadata, extractHtml, extractCsv, extractXml, extractContent };
