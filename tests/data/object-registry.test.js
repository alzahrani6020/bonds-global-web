const {
  isValidPrefix,
  formatNumberedId,
  parseHumanId,
  generateUuidId
} = require('../../lib/data/object-registry');

describe('Object Registry', () => {
  describe('prefix validation', () => {
    it('accepts known numbered prefix', () => {
      expect(isValidPrefix('PRJ')).toBe(true);
      expect(isValidPrefix('BDVC')).toBe(true);
    });

    it('accepts known UUID prefix', () => {
      expect(isValidPrefix('USR')).toBe(true);
      expect(isValidPrefix('AI')).toBe(true);
    });

    it('rejects unknown prefix', () => {
      expect(isValidPrefix('XYZ')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isValidPrefix('prj')).toBe(true);
    });
  });

  describe('formatNumberedId', () => {
    it('formats project ID', () => {
      expect(formatNumberedId('PRJ', 2026, null, 1)).toBe('PRJ-2026-00000001');
    });

    it('formats asset ID with country code', () => {
      expect(formatNumberedId('AST', 2026, 'SA', 42)).toBe('AST-2026-SA-00000042');
    });

    it('formats certificate ID', () => {
      expect(formatNumberedId('BDVC', 2026, 'AE', 7)).toBe('BDVC-2026-AE-00000007');
    });

    it('throws for non-numbered prefix', () => {
      expect(() => formatNumberedId('USR', 2026, null, 1)).toThrow();
    });
  });

  describe('parseHumanId', () => {
    it('parses project ID', () => {
      const parsed = parseHumanId('PRJ-2026-00000001');
      expect(parsed.prefix).toBe('PRJ');
      expect(parsed.year).toBe(2026);
      expect(parsed.sequence).toBe(1);
    });

    it('parses asset ID with country', () => {
      const parsed = parseHumanId('AST-2026-SA-00000042');
      expect(parsed.prefix).toBe('AST');
      expect(parsed.countryCode).toBe('SA');
      expect(parsed.sequence).toBe(42);
    });

    it('parses UUID-based ID', () => {
      const id = generateUuidId('USR');
      const parsed = parseHumanId(id);
      expect(parsed.prefix).toBe('USR');
      expect(parsed.uuid).toBeTruthy();
    });

    it('returns null for invalid ID', () => {
      expect(parseHumanId('UNKNOWN')).toBeNull();
      expect(parseHumanId('PRJ-2026')).toBeNull();
    });
  });

  describe('generateUuidId', () => {
    it('prefixes UUID correctly', () => {
      const id = generateUuidId('AI');
      expect(id.startsWith('AI-')).toBe(true);
      const parts = id.split('-');
      expect(parts.length).toBeGreaterThan(1);
    });
  });
});
