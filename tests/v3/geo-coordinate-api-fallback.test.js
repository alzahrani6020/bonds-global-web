const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('V3 canonical geo coordinate fallback', () => {
  test('cities API selects geo_place_id and enriches from geo_places', () => {
    const api = read('v3/api/index.js');

    expect(api).toContain('async function enrichCitiesWithGeoCoordinates');
    expect(api).toContain(".from('geo_places')");
    expect(api).toContain(".select('id,lat,lng,confidence,source_code,source_updated_at')");
    expect(api).toContain("let selectFields = 'id, code, geo_place_id");
    expect(api).toContain('let enriched = await enrichCitiesWithGeoCoordinates(supabase, cities || [])');
  });

  test('legacy city coordinates win over canonical fallback', () => {
    const api = read('v3/api/index.js');

    expect(api).toContain('if (rowHasCoords || !placeHasCoords) return row');
    expect(api).toContain('coordinate_source: place.source_code || \'geo_places\'');
  });

  test('catalog and opportunity responses use canonical coordinates when linked', () => {
    const api = read('v3/api/index.js');

    expect(api).toContain('const enrichedLegacyRows = (legacyRows || []).map');
    expect(api).toContain('const opportunityCities = await enrichCitiesWithGeoCoordinates');
    expect(api).toContain('city: opportunityCityById.get(row.cities?.id) || row.cities');
  });
});
