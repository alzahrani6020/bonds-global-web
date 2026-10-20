'use strict';

function snapshotFromPlace(place, extra = {}) {
  if (!place) return {};
  return {
    geo_place_id: place.id,
    canonical_geo_code: place.canonical_code || null,
    country_code: place.country_code || null,
    name_ar: place.name_ar || null,
    name_en: place.name_en || null,
    place_type: place.place_type || null,
    lat: place.lat == null ? null : Number(place.lat),
    lng: place.lng == null ? null : Number(place.lng),
    confidence: place.confidence == null ? null : Number(place.confidence),
    source_code: place.source_code || null,
    dataset_version: extra.dataset_version || null,
    resolved_from: extra.resolved_from || null,
    resolved_at: new Date().toISOString()
  };
}

async function resolveGeoContext(supabase, input = {}) {
  const canonicalCode = String(input.canonicalCode || input.localityCode || input.cityCode || '').trim();
  const countryCode = String(input.countryCode || '').trim().toUpperCase() || null;
  const localityName = String(input.localityName || '').trim();

  const fields = 'id,canonical_code,country_code,name_ar,name_en,place_type,lat,lng,population,elevation_m,source_code,source_id,confidence,is_active';

  if (canonicalCode) {
    const { data, error } = await supabase
      .from('geo_places')
      .select(fields)
      .eq('canonical_code', canonicalCode)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (data) return { place: data, snapshot: snapshotFromPlace(data, { resolved_from: 'canonical_code' }) };

    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id,code,geo_place_id')
      .eq('code', canonicalCode)
      .maybeSingle();
    if (cityError) throw cityError;
    if (city?.geo_place_id) {
      const { data: bridged, error: bridgedError } = await supabase
        .from('geo_places')
        .select(fields)
        .eq('id', city.geo_place_id)
        .eq('is_active', true)
        .maybeSingle();
      if (bridgedError) throw bridgedError;
      if (bridged) return { place: bridged, city, snapshot: snapshotFromPlace(bridged, { resolved_from: 'cities.geo_place_id' }) };
    }
  }

  if (localityName && countryCode) {
    const [arResult, enResult] = await Promise.all([
      supabase
        .from('geo_places')
        .select(fields)
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .eq('name_ar', localityName)
        .limit(3),
      supabase
        .from('geo_places')
        .select(fields)
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .eq('name_en', localityName)
        .limit(3)
    ]);
    if (arResult.error) throw arResult.error;
    if (enResult.error) throw enResult.error;

    const unique = new Map();
    for (const place of [...(arResult.data || []), ...(enResult.data || [])]) unique.set(place.id, place);
    const matches = [...unique.values()];

    if (matches.length === 1) {
      const place = matches[0];
      return { place, snapshot: snapshotFromPlace(place, { resolved_from: 'exact_name_country' }) };
    }
    if (matches.length > 1) {
      return { place: null, ambiguous: true, reason: 'multiple_exact_name_matches' };
    }
  }

  return { place: null, snapshot: {}, reason: 'not_resolved' };
}

module.exports = { resolveGeoContext, snapshotFromPlace };
