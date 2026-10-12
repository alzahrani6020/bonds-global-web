'use strict';

const BASE_TWINS = Object.freeze({
  restaurant: {
    code: 'restaurant',
    required: ['revenue', 'rent', 'labor_cost'],
    drivers: [
      'seats', 'table_turns', 'average_ticket', 'occupancy', 'delivery_share',
      'food_cost_percentage', 'labor_cost', 'rent', 'opening_hours',
      'capacity', 'waste', 'marketing', 'commission', 'vat', 'seasonality'
    ]
  },
  manufacturing: {
    code: 'manufacturing',
    required: ['revenue', 'operating_expenses', 'initial_investment'],
    drivers: [
      'installed_capacity', 'utilization', 'yield', 'scrap_rate', 'raw_material_cost',
      'energy_cost', 'labor_cost', 'maintenance_cost', 'downtime', 'working_capital',
      'inventory_days', 'fx_exposure', 'logistics_cost'
    ]
  },
  hotel: {
    code: 'hotel',
    required: ['revenue', 'operating_expenses', 'initial_investment'],
    drivers: [
      'keys', 'adr', 'occupancy', 'revpar', 'food_beverage_revenue', 'seasonality',
      'ota_commission', 'payroll', 'utilities', 'ffe_reserve'
    ]
  },
  generic: {
    code: 'generic',
    required: ['revenue', 'operating_expenses'],
    drivers: [
      'revenue', 'operating_expenses', 'initial_investment', 'growth_rate',
      'working_capital', 'debt_service'
    ]
  }
});

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

class SectorDigitalTwinRegistry {
  constructor(extraTwins = {}) {
    this.twins = new Map(Object.entries({ ...BASE_TWINS, ...extraTwins }));
  }

  register(code, twin) {
    if (!code || !twin || !Array.isArray(twin.drivers)) throw new Error('Invalid sector digital twin');
    this.twins.set(code, { code, ...twin });
    return this;
  }

  get(sector) {
    return this.twins.get(sector) || this.twins.get('generic');
  }

  list() {
    return [...this.twins.values()];
  }

  evaluate(sector, values = {}) {
    const twin = this.get(sector);
    const drivers = {};
    const missing = [];

    for (const code of twin.drivers) {
      if (hasValue(values[code])) drivers[code] = values[code];
    }
    for (const code of twin.required || []) {
      if (!hasValue(values[code])) missing.push(code);
    }

    const derived = {};
    if (hasValue(values.revenue) && hasValue(values.operating_expenses)) {
      const revenue = Number(values.revenue);
      const opex = Number(values.operating_expenses);
      if (Number.isFinite(revenue) && revenue !== 0 && Number.isFinite(opex)) {
        derived.operatingMargin = (revenue - opex) / revenue;
      }
    }
    if (sector === 'restaurant' && hasValue(values.seats) && hasValue(values.table_turns) && hasValue(values.average_ticket)) {
      derived.theoreticalDailyRevenue =
        Number(values.seats) * Number(values.table_turns) * Number(values.average_ticket);
    }
    if (sector === 'hotel' && hasValue(values.adr) && hasValue(values.occupancy)) {
      derived.revpar = Number(values.adr) * Number(values.occupancy);
    }
    if (sector === 'manufacturing' && hasValue(values.installed_capacity) && hasValue(values.utilization)) {
      derived.effectiveCapacity = Number(values.installed_capacity) * Number(values.utilization);
    }

    const completeness = twin.drivers.length
      ? Math.round(Object.keys(drivers).length / twin.drivers.length * 100)
      : 0;

    return {
      output: {
        twin: twin.code,
        requestedSector: sector,
        genericFallback: twin.code === 'generic' && sector !== 'generic',
        drivers,
        derived,
        requiredInputs: twin.required || [],
        missingRequiredInputs: missing,
        completeness
      },
      confidence: completeness,
      evidence: Object.entries(drivers).map(([code, value]) => ({
        source: 'sector_digital_twin',
        evidence_type: 'sector_driver',
        evidence_code: code,
        value,
        confidence: 100,
        timestamp: new Date().toISOString()
      })),
      engine: 'sector_digital_twin',
      status: missing.length ? 'partial' : 'computed',
      executed: Object.keys(drivers).length > 0,
      decisionEligible: missing.length === 0
    };
  }
}

module.exports = { SectorDigitalTwinRegistry, BASE_TWINS };
