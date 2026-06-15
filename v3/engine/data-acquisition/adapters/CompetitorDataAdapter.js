/**
 * CompetitorDataAdapter — جلب عدد المنافسين من مصادر خارجية.
 *
 * المصادر بالترتيب:
 * 1. Google Places API (إذا وُجد GOOGLE_PLACES_API_KEY).
 * 2. OpenStreetMap Overpass API — منطقة المدينة (relation/way boundary).
 * 3. OpenStreetMap Overpass API — bbox المدينة.
 * 4. OpenStreetMap Overpass API — دائرة حول مركز المدينة.
 * 5. OpenStreetMap Overpass API — tags أوسع إذا كانت النتائج شحيحة.
 * 6. Fallback تقديري محلي.
 */
const BaseAdapter = require('../BaseAdapter');
const { HttpClient } = require('../HttpClient');

const GEOAPIFY_CATEGORIES = {
  dental_clinics: ['healthcare.dentist'],
  pharmacy: ['healthcare.pharmacy'],
  restaurant: ['catering.restaurant', 'catering.fast_food'],
  cafe: ['catering.cafe'],
  retail: ['commercial.supermarket', 'commercial.convenience'],
  gym: ['sport.fitness'],
  beauty: ['commercial.beauty']
};

const GEOAPIFY_BROAD_CATEGORIES = {
  dental_clinics: ['healthcare.clinic_or_praxis'],
  pharmacy: ['healthcare'],
  restaurant: ['catering'],
  cafe: ['catering.cafe', 'catering'],
  retail: ['commercial.supermarket', 'commercial.convenience', 'commercial'],
  gym: ['sport', 'leisure'],
  beauty: ['commercial.beauty', 'commercial']
};

// Thresholds for broad-category market saturation (0-100 scale), competitors per 10k.
const BROAD_SATURATION_THRESHOLDS = {
  dental_clinics: { low: 2, high: 8 },
  pharmacy: { low: 3, high: 10 },
  restaurant: { low: 10, high: 30 },
  cafe: { low: 5, high: 15 },
  retail: { low: 5, high: 15 },
  gym: { low: 2, high: 6 },
  beauty: { low: 2, high: 6 }
};

const COUNTRY_NAMES = {
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  EG: 'Egypt',
  QA: 'Qatar',
  JO: 'Jordan',
  KW: 'Kuwait',
  BH: 'Bahrain',
  OM: 'Oman',
  LB: 'Lebanon',
  IQ: 'Iraq',
  MA: 'Morocco',
  DZ: 'Algeria',
  TN: 'Tunisia',
  LY: 'Libya',
  PS: 'Palestine',
  YE: 'Yemen',
  TR: 'Turkey'
};

const ACTIVITY_TAGS = {
  dental_clinics: {
    osm: [
      { 'amenity': 'dentist' },
      { 'healthcare': 'dentist' },
      { 'amenity': 'clinic', 'healthcare:speciality': '~dentistry|dentist|orthodontics' },
      { 'healthcare:speciality': '~dentistry|dentist|orthodontics' }
    ],
    osmBroad: [
      { 'healthcare': '~dentist|dental|orthodontics|dental_clinic' },
      { 'amenity': '~dentist|clinic|doctors', 'healthcare:speciality': '~dentistry|dentist|orthodontics|dental' }
    ],
    google: ['dentist'],
    competitorsPer10k: { low: 1, high: 3 }
  },
  pharmacy: {
    osm: [{ 'amenity': 'pharmacy' }],
    osmBroad: [
      { 'amenity': '~pharmacy|drugstore' },
      { 'shop': 'chemist' },
      { 'healthcare': 'pharmacy' }
    ],
    google: ['pharmacy'],
    competitorsPer10k: { low: 1, high: 3 }
  },
  restaurant: {
    osm: [{ 'amenity': 'restaurant' }, { 'amenity': 'fast_food' }],
    osmBroad: [
      { 'amenity': '~restaurant|fast_food|cafe|food_court' },
      { 'amenity': 'cafe', 'cuisine': '*' }
    ],
    google: ['restaurant'],
    competitorsPer10k: { low: 3, high: 8 }
  },
  cafe: {
    osm: [{ 'amenity': 'cafe' }],
    osmBroad: [
      { 'amenity': '~cafe|coffee_shop' },
      { 'shop': 'coffee' }
    ],
    google: ['cafe'],
    competitorsPer10k: { low: 2, high: 6 }
  },
  retail: {
    osm: [{ 'shop': 'supermarket' }, { 'shop': 'convenience' }],
    osmBroad: [
      { 'shop': '~supermarket|convenience|grocery|food' },
      { 'amenity': 'marketplace' }
    ],
    google: ['supermarket'],
    competitorsPer10k: { low: 1, high: 4 }
  },
  gym: {
    osm: [{ 'leisure': 'fitness_centre' }, { 'leisure': 'sports_centre' }],
    osmBroad: [
      { 'leisure': '~fitness_centre|sports_centre|fitness_station' },
      { 'sport': 'fitness' },
      { 'amenity': 'gym' }
    ],
    google: ['gym'],
    competitorsPer10k: { low: 0.5, high: 2 }
  },
  beauty: {
    osm: [{ 'shop': 'beauty' }],
    osmBroad: [
      { 'shop': '~beauty|cosmetics|hairdresser' },
      { 'amenity': '~beauty|hairdresser' }
    ],
    google: ['beauty_salon'],
    competitorsPer10k: { low: 0.5, high: 2 }
  }
};

class CompetitorDataAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      sourceId: 'competitor_data',
      sourceName: 'بيانات المنافسة (خارجي)',
      ...config
    });
    const cache = config.httpClient?.cache || null;
    this.httpClient = config.httpClient || new HttpClient({ timeout: 25000, retries: 2, maxConcurrency: 2, cache });
    // Overpass public servers are rate-limited and slow; use a dedicated client with longer timeout.
    this.overpassHttpClient = new HttpClient({
      timeout: 60000,
      retries: 2,
      maxConcurrency: 1,
      userAgent: 'BondsV3-DataBot/1.0 (overpass)',
      cache
    });
    this.googlePlacesApiKey = config.googlePlacesApiKey ?? process.env.GOOGLE_PLACES_API_KEY ?? null;
    this.geoapifyApiKey = config.geoapifyApiKey ?? process.env.GEOAPIFY_API_KEY ?? null;
    this.overpassEndpoints = config.overpassEndpoints || [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.openstreetmap.fr/api/interpreter',
      'https://overpass.osm.ch/api/interpreter'
    ];
    this._overpassMinIntervalMs = 1000;
    this._lastOverpassRequest = 0;
    this._googleDisabled = false;
  }

  supportedMetrics() {
    return ['competitors_count', 'specialists_count', 'competition_level', 'market_saturation_score'];
  }

  async fetch(options = {}) {
    const {
      cityCode,
      cityName,
      countryCode,
      activityCode,
      year = new Date().getFullYear(),
      population = 1000000,
      countryPopulation = population
    } = options;

    if (!cityCode || !cityName) {
      return [];
    }

    const mapping = ACTIVITY_TAGS[activityCode] || ACTIVITY_TAGS.dental_clinics;

    try {
      const geo = await this._geocodeCity(cityName, countryCode);
      if (!geo) return [];

      let count = 0;
      let sourceUrl = '';
      let sourceMethod = '';
      let sourceQuality = 'open_data';

      // Prefer Geoapify when available because it works without a billing-enabled Google Cloud account.
      let broadCount = 0;
      if (this.geoapifyApiKey) {
        try {
          const geoResult = await this._countGeoapify(geo, activityCode, population);
          count = geoResult.specificCount;
          broadCount = geoResult.broadCount;
          sourceMethod = geoResult.usedBroad ? 'geoapify_places_broad' : 'geoapify_places';
          sourceUrl = 'https://api.geoapify.com/v2/places';
          sourceQuality = geoResult.usedBroad ? 'scraped' : 'open_data';
        } catch (geoErr) {
          console.warn(`[CompetitorDataAdapter] Geoapify failed for ${cityCode}/${activityCode}: ${geoErr.message}`);
        }
      }

      if (count <= 0 && this.googlePlacesApiKey) {
        try {
          count = await this._countGooglePlaces(geo, mapping.google);
          sourceUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
          sourceMethod = 'google_places_nearby';
          sourceQuality = 'google_places';
        } catch (googleErr) {
          console.warn(`[CompetitorDataAdapter] Google Places failed for ${cityCode}/${activityCode}: ${googleErr.message}`);
        }
      }

      if (count <= 0 && !this.geoapifyApiKey) {
        // Overpass fallback is only used when Geoapify is unavailable; it is slow and rate-limited.
        const tagSets = [...mapping.osm, ...(mapping.osmBroad || [])];
        count = await this._countOverpassBbox(geo.bbox, tagSets);
        sourceMethod = 'overpass_city_bbox';
        sourceUrl = 'https://overpass-api.de/api/interpreter';
        sourceQuality = 'open_data';
      }

      if (!Number.isFinite(count) || count <= 0) {
        return [];
      }

      const maxReasonable = Math.max(50, Math.round(population / 100));
      if (count > maxReasonable) {
        console.warn(`[CompetitorDataAdapter] ${cityCode}/${activityCode} count ${count} seems too high vs population ${population}; skipping`);
        return [];
      }

      const competitorsPer10k = (count / Math.max(population, 1)) * 10000;
      const competitionLevel = this._deriveCompetitionLevel(activityCode, competitorsPer10k);

      const results = [{
        cityCode,
        activityCode,
        year,
        metricCode: 'competitors_count',
        value: Math.round(count),
        population,
        sourceQuality,
        sourceUrl,
        sourceMethod,
        confidenceReason: `Source: ${sourceQuality} (${sourceMethod}) for ${cityName} (≈${competitorsPer10k.toFixed(1)} per 10k residents)`
      }];

      if (competitionLevel) {
        results.push({
          cityCode,
          activityCode,
          year,
          metricCode: 'competition_level',
          valueText: competitionLevel,
          population,
          sourceQuality,
          sourceUrl,
          sourceMethod,
          confidenceReason: `Derived from ${sourceQuality} (${sourceMethod}) competitor density in ${cityName}`
        });
      }

      // Broad-category saturation metric (kept separate from competitors_count).
      if (broadCount > 0) {
        const saturationScore = this._deriveSaturationScore(activityCode, broadCount, population);
        if (Number.isFinite(saturationScore)) {
          results.push({
            cityCode,
            activityCode,
            year,
            metricCode: 'market_saturation_score',
            value: Math.round(saturationScore),
            population,
            sourceQuality: 'scraped',
            sourceUrl,
            sourceMethod: 'geoapify_broad_saturation',
            confidenceReason: `Derived from broad category density (${broadCount} broad POIs) in ${cityName}`
          });
        }
      }

      return results;
    } catch (err) {
      console.warn(`[CompetitorDataAdapter] Failed for ${cityCode}/${activityCode}:`, err.message);
      return [];
    }
  }

  async validate(rawItem) {
    const errors = [];
    if (!rawItem.metricCode) errors.push('metricCode is required');
    if (rawItem.value === undefined && rawItem.valueText === undefined) {
      errors.push('value or valueText is required');
    }
    if (!rawItem.cityCode) errors.push('cityCode is required');
    if (!rawItem.year) errors.push('year is required');
    return { valid: errors.length === 0, errors };
  }

  async transform(rawItem) {
    return [{
      metricCode: rawItem.metricCode,
      value: rawItem.value !== undefined ? rawItem.value : null,
      valueText: rawItem.valueText !== undefined ? rawItem.valueText : null,
      year: rawItem.year,
      sourceUrl: rawItem.sourceUrl,
      confidence: this.getConfidence(rawItem.metricCode, rawItem.sourceQuality),
      confidenceReason: rawItem.confidenceReason || `Source: ${rawItem.sourceQuality}`,
      metadata: {
        cityCode: rawItem.cityCode,
        activityCode: rawItem.activityCode,
        population: rawItem.population,
        sourceQuality: rawItem.sourceQuality,
        sourceMethod: rawItem.sourceMethod
      }
    }];
  }

  // ===== Helpers =====

  async _geocodeCity(cityName, countryCode) {
    const countryName = COUNTRY_NAMES[countryCode] || countryCode || '';
    const query = countryName ? `${cityName}, ${countryName}` : cityName;
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    if (countryCode) {
      url += `&countrycodes=${countryCode}`;
    }

    await this._sleep(300);
    const data = await this.httpClient.get(url, {
      headers: { 'User-Agent': 'BondsV3-DataBot/1.0' },
      cacheTtlMs: 30 * 24 * 60 * 60 * 1000
    });

    if (!Array.isArray(data) || data.length === 0) return null;
    const place = data[0];
    const bbox = place.boundingbox;
    if (!bbox || bbox.length < 4) return null;

    const osmType = place.osm_type;
    const osmId = place.osm_id;

    return {
      lat: parseFloat(place.lat),
      lon: parseFloat(place.lon),
      bbox: [
        parseFloat(bbox[0]),
        parseFloat(bbox[2]),
        parseFloat(bbox[1]),
        parseFloat(bbox[3])
      ],
      osmType,
      osmId,
      areaId: this._deriveAreaId(osmType, osmId)
    };
  }

  _deriveAreaId(osmType, osmId) {
    if (!osmType || !osmId) return null;
    const id = parseInt(osmId, 10);
    if (Number.isNaN(id)) return null;
    if (osmType === 'relation') return 3600000000 + id;
    if (osmType === 'way') return 2400000000 + id;
    return null;
  }

  async _countGeoapify(geo, activityCode, population = 0) {
    const categories = GEOAPIFY_CATEGORIES[activityCode] || GEOAPIFY_CATEGORIES.dental_clinics;
    if (!categories || categories.length === 0) return { specificCount: 0, broadCount: 0, usedBroad: false };

    const radiusKm = this._radiusFromPopulation(population, 100);
    const radiusM = Math.min(Math.round(radiusKm * 1000), 100000);
    const center = { lon: geo.lon, lat: geo.lat };

    const specificFeatures = await this._geoapifyFetchCategorySet(categories, center, radiusM);

    const broadCategories = GEOAPIFY_BROAD_CATEGORIES[activityCode];
    let broadFeatures = new Map();
    let usedBroad = false;

    // If specific tagging is sparse, also pull the broader category set
    // for saturation/level metrics. It is kept separate from competitors_count.
    if (specificFeatures.size < 25 && broadCategories && broadCategories.length > 0) {
      broadFeatures = await this._geoapifyFetchCategorySet(broadCategories, center, radiusM);
      usedBroad = broadFeatures.size > 0;
    }

    return { specificCount: specificFeatures.size, broadCount: broadFeatures.size, usedBroad };
  }

  async _geoapifyFetchCategorySet(categories, center, radiusM) {
    const categoriesParam = categories.join(',');
    const features = new Map();
    let offset = 0;
    const limit = 500;
    const maxPages = 5;

    for (let page = 0; page < maxPages; page++) {
      const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(categoriesParam)}&filter=circle:${center.lon},${center.lat},${radiusM}&limit=${limit}&offset=${offset}&apiKey=${this.geoapifyApiKey}`;
      const data = await this.httpClient.get(url, { cacheTtlMs: 7 * 24 * 60 * 60 * 1000 });
      const pageFeatures = data?.features || [];

      for (const feature of pageFeatures) {
        const placeId = feature?.properties?.place_id;
        if (placeId && !features.has(placeId)) {
          features.set(placeId, feature);
        }
      }

      if (pageFeatures.length < limit) break;
      offset += limit;
      await this._sleep(200);
    }

    return features;
  }

  async _countOverpassBbox(bbox, tagSets) {
    const [south, west, north, east] = bbox;
    const bboxStr = `${south},${west},${north},${east}`;

    const statements = tagSets.map(ts => `  nwr${this._tagFilter(ts)}(${bboxStr});`).join('\n');
    const query = `
[out:json][timeout:90][maxsize:536870912];
(
${statements}
);
out count;
    `.trim();

    return this._executeOverpass(query);
  }

  _tagFilter(tagSet) {
    return Object.entries(tagSet).map(([key, val]) => {
      if (String(val).startsWith('~')) {
        return `["${key}"~"${val.slice(1)}"]`;
      }
      return `["${key}"="${val}"]`;
    }).join('');
  }

  async _executeOverpass(query) {
    const now = Date.now();
    const wait = Math.max(0, this._lastOverpassRequest + this._overpassMinIntervalMs - now);
    if (wait > 0) await this._sleep(wait);
    this._lastOverpassRequest = Date.now();

    let lastErr;
    for (const endpoint of this.overpassEndpoints) {
      try {
        const data = await this.overpassHttpClient.post(
          endpoint,
          query,
          { headers: { 'Content-Type': 'text/plain' }, cacheTtlMs: 7 * 24 * 60 * 60 * 1000 }
        );
        return this._parseOverpassCount(data);
      } catch (err) {
        lastErr = err;
        console.warn(`[CompetitorDataAdapter] Overpass endpoint ${endpoint} failed: ${err.message}`);
        await this._sleep(1000);
      }
    }
    throw lastErr || new Error('All Overpass endpoints failed');
  }

  _parseOverpassCount(data) {
    const countEl = data?.elements?.find(el => el.type === 'count');
    if (countEl?.tags?.total) {
      return parseInt(countEl.tags.total, 10);
    }
    return (data?.elements || []).length;
  }

  async _countGooglePlaces(geo, types) {
    if (!types || types.length === 0 || this._googleDisabled) return 0;

    const radius = this._googleRadius(geo.bbox);
    let total = 0;

    for (const type of types) {
      const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${geo.lat},${geo.lon}&radius=${radius}&type=${type}&key=${this.googlePlacesApiKey}`;
      total += await this._paginateGooglePlaces(nearbyUrl);

      await this._sleep(200);
      const textUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(type)}+near+${geo.lat},${geo.lon}&radius=${radius}&key=${this.googlePlacesApiKey}`;
      total += await this._paginateGooglePlaces(textUrl, 1);
    }

    return total;
  }

  async _paginateGooglePlaces(url, maxPages = 3) {
    let total = 0;
    let nextPageToken = null;
    let currentUrl = url;
    let pages = 0;

    do {
      if (nextPageToken) {
        await this._sleep(2000);
        currentUrl = `${url.split('?')[0]}?pagetoken=${nextPageToken}&key=${this.googlePlacesApiKey}`;
      }

      const data = await this.httpClient.get(currentUrl, { cacheTtlMs: 7 * 24 * 60 * 60 * 1000 });
      const status = data?.status;
      if (status === 'REQUEST_DENIED' || status === 'OVER_QUERY_LIMIT' || status === 'INVALID_REQUEST') {
        this._googleDisabled = true;
        throw new Error(`Google Places ${status}: ${data?.error_message || ''}`);
      }
      if (Array.isArray(data?.results)) {
        total += data.results.length;
      }
      nextPageToken = data?.next_page_token || null;
      pages++;
    } while (nextPageToken && pages < maxPages);

    return total;
  }

  _googleRadius(bbox) {
    const [south, west, north, east] = bbox;
    const dy = (north - south) * 111000;
    const dx = (east - west) * 111000 * Math.cos(((south + north) / 2) * Math.PI / 180);
    const diagonal = Math.sqrt(dx * dx + dy * dy);
    return Math.min(Math.max(Math.round(diagonal / 2), 5000), 50000);
  }

  _radiusFromPopulation(population, maxKm = 80) {
    if (!population) return 10;
    const density = 1500;
    const radiusKm = Math.sqrt(population / (Math.PI * density));
    return Math.min(Math.max(radiusKm, 3), maxKm);
  }

  _computeBbox(lat, lon, population) {
    if (!population) return null;
    const radiusKm = this._radiusFromPopulation(population, 60);
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    return [lat - latDelta, lon - lonDelta, lat + latDelta, lon + lonDelta];
  }

  _heuristicCompetitors(population, mapping) {
    const thresholds = (mapping || ACTIVITY_TAGS.dental_clinics).competitorsPer10k;
    const density = (thresholds.low + thresholds.high) / 2;
    return Math.round((population / 10000) * density);
  }

  _deriveCompetitionLevel(activityCode, competitorsPer10k) {
    const thresholds = (ACTIVITY_TAGS[activityCode] || ACTIVITY_TAGS.dental_clinics).competitorsPer10k;
    if (competitorsPer10k >= thresholds.high) return 'high';
    if (competitorsPer10k <= thresholds.low) return 'low';
    return 'medium';
  }

  _deriveSaturationScore(activityCode, broadCount, population) {
    const thresholds = BROAD_SATURATION_THRESHOLDS[activityCode] || BROAD_SATURATION_THRESHOLDS.dental_clinics;
    const density = (broadCount / Math.max(population, 1)) * 10000;
    const ratio = (density - thresholds.low) / (thresholds.high - thresholds.low);
    return Math.min(100, Math.max(0, Math.round(ratio * 100)));
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CompetitorDataAdapter;
