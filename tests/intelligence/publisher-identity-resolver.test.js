'use strict';

/**
 * Publisher Identity Resolver — architect-mandated cases:
 * - subdomains (news.bbc.co.uk, graphics.reuters.com)
 * - ccTLD variants (bbc.com vs bbc.co.uk)
 * - Wikipedia language editions = one publisher
 * - Reuters domain family
 * - URL shorteners -> unknown, confidence 0
 * - unknown publishers -> hostname identity, low confidence
 * - same-owner vs same-editorial independence semantics
 */

const {
  PUBLISHER_TABLE,
  resolvePublisher,
  groupSources
} = require('../../lib/intelligence/publisher-identity-resolver');

describe('publisher-identity-resolver curated table', () => {
  test('seed set covers at least 25 major publishers', () => {
    expect(PUBLISHER_TABLE.length).toBeGreaterThanOrEqual(25);
  });

  test('normalizes www prefixes', () => {
    const result = resolvePublisher('https://www.bbc.com/news/world');
    expect(result.hostname).toBe('bbc.com');
    expect(result.canonicalPublisher).toBe('BBC');
    expect(result.publisherId).toBe('bbc');
    expect(result.sourceType).toBe('news');
    expect(result.ownershipConfidence).toBeGreaterThan(0.9);
  });

  test('resolves BBC subdomains and ccTLD variants to one editorial operation', () => {
    const hosts = [
      'https://www.bbc.com/news',
      'https://news.bbc.co.uk/2/hi',
      'https://www.bbc.co.uk/sport'
    ];
    const resolved = hosts.map(resolvePublisher);
    for (const result of resolved) {
      expect(result.publisherId).toBe('bbc');
      expect(result.independenceGroup).toBe('bbc');
    }
    expect(resolvePublisher('https://news.bbc.co.uk/2/hi').ownershipConfidence)
      .toBeLessThan(resolvePublisher('https://www.bbc.com/news').ownershipConfidence);
  });

  test('resolves the Reuters domain family to one publisher', () => {
    for (const url of [
      'https://www.reuters.com/world',
      'https://reuters.com/',
      'https://graphics.reuters.com/FEATURE-STORY/'
    ]) {
      const result = resolvePublisher(url);
      expect(result.publisherId).toBe('reuters');
      expect(result.canonicalPublisher).toBe('Reuters');
      expect(result.independenceGroup).toBe('reuters');
    }
  });

  test('collapses all Wikipedia language editions into one publisher', () => {
    const languages = ['ar', 'en', 'fr', 'de', 'zh'];
    const resolved = languages.map(lang => resolvePublisher(`https://${lang}.wikipedia.org/wiki/X`));
    expect(new Set(resolved.map(result => result.publisherId))).toEqual(new Set(['wikipedia']));
    expect(new Set(resolved.map(result => result.independenceGroup))).toEqual(new Set(['wikipedia']));
    expect(resolved[0].sourceType).toBe('reference');
  });

  test('maps official institutional domains', () => {
    expect(resolvePublisher('https://www.un.org/en/').sourceType).toBe('official');
    expect(resolvePublisher('https://www.imf.org/').publisherId).toBe('imf');
    expect(resolvePublisher('https://www.worldbank.org/').publisherId).toBe('world-bank');
    expect(resolvePublisher('https://www.spa.gov.sa/').publisherId).toBe('spa');
    expect(resolvePublisher('https://www.spa.gov.sa/').sourceType).toBe('official');
  });

  test('Al Jazeera Arabic and English editions are one publisher', () => {
    const ar = resolvePublisher('https://www.aljazeera.net/');
    const en = resolvePublisher('https://www.aljazeera.com/');
    expect(ar.publisherId).toBe('al-jazeera');
    expect(en.publisherId).toBe('al-jazeera');
    expect(ar.independenceGroup).toBe(en.independenceGroup);
  });
});

describe('publisher-identity-resolver unknown and shortener handling', () => {
  test('unknown domains fall back to hostname identity with low confidence', () => {
    const result = resolvePublisher('https://example.com/some/page');
    expect(result.canonicalPublisher).toBe('example.com');
    expect(result.publisherId).toBe('example.com');
    expect(result.parentOrg).toBeNull();
    expect(result.sourceType).toBe('unknown');
    expect(result.ownershipConfidence).toBeLessThanOrEqual(0.4);
  });

  test('unknown domains each form their own independence group', () => {
    const a = resolvePublisher('https://example.com/1');
    const b = resolvePublisher('https://other.net/2');
    expect(a.independenceGroup).not.toBe(b.independenceGroup);
    expect(a.independenceGroup).toBe('host:example.com');
  });

  test('URL shorteners are unknown with zero confidence', () => {
    for (const url of ['https://bit.ly/abc123', 'https://t.co/xyz']) {
      const result = resolvePublisher(url);
      expect(result.sourceType).toBe('unknown');
      expect(result.ownershipConfidence).toBe(0);
      expect(result.canonicalPublisher).toBe(result.hostname);
    }
  });
});

describe('publisher-identity-resolver independence semantics', () => {
  test('same-owner outlets keep separate editorial independence groups', () => {
    const wsj = resolvePublisher('https://www.wsj.com/articles/x');
    const sun = resolvePublisher('https://www.thesun.co.uk/x');
    expect(wsj.ownershipGroup).toBe('news-corp');
    expect(sun.ownershipGroup).toBe('news-corp');
    expect(wsj.independenceGroup).not.toBe(sun.independenceGroup);
  });

  test('MBC Group-owned Arabic outlets are one owner but editorially distinct', () => {
    const arabiya = resolvePublisher('https://www.alarabiya.net/a');
    const aawsat = resolvePublisher('https://aawsat.com/b');
    expect(arabiya.ownershipGroup).toBe('mbc-group');
    expect(aawsat.ownershipGroup).toBe('mbc-group');
    expect(arabiya.independenceGroup).not.toBe(aawsat.independenceGroup);
  });

  test('same-editorial addresses share one independence group', () => {
    const bbcCom = resolvePublisher('https://www.bbc.com/a');
    const bbcUk = resolvePublisher('https://www.bbc.co.uk/b');
    expect(bbcCom.independenceGroup).toBe(bbcUk.independenceGroup);
    const wikiAr = resolvePublisher('https://ar.wikipedia.org/x');
    const wikiEn = resolvePublisher('https://en.wikipedia.org/y');
    expect(wikiAr.independenceGroup).toBe(wikiEn.independenceGroup);
  });
});

describe('publisher-identity-resolver groupSources', () => {
  test('groups URLs by editorial independence group with counts', () => {
    const groups = groupSources([
      'https://ar.wikipedia.org/wiki/A',
      'https://en.wikipedia.org/wiki/B',
      'https://www.bbc.com/news',
      'https://news.bbc.co.uk/2',
      'https://www.reuters.com/world',
      'https://example.com/page',
      'https://other.net/page'
    ]);
    const byGroup = Object.fromEntries(groups.map(item => [item.group, item]));
    expect(byGroup.wikipedia.count).toBe(2);
    expect(byGroup.bbc.count).toBe(2);
    expect(byGroup.reuters.count).toBe(1);
    expect(byGroup['host:example.com'].count).toBe(1);
    expect(byGroup['host:other.net'].count).toBe(1);
    expect(groups.length).toBe(5);
    for (const item of groups) {
      expect(item.count).toBe(item.urls.length);
    }
  });

  test('editorially distinct same-owner outlets count as separate evidence', () => {
    const groups = groupSources(['https://www.wsj.com/a', 'https://www.thesun.co.uk/b']);
    expect(groups.length).toBe(2);
  });

  test('ignores empty entries and tolerates malformed input', () => {
    const groups = groupSources(['', null, undefined, 'https://www.bbc.com/x']);
    expect(groups.length).toBe(1);
    expect(groups[0].group).toBe('bbc');
  });
});
