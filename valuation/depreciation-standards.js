/**
 * BONDS Depreciation Standards (BDS)
 *
 * Asset-class-specific factors and depreciation methods used by the
 * Depreciation Engine. Aligned with BONDS Valuation Standards (BVS).
 */
(function () {
  'use strict';

  const BDS_STANDARDS = {
    realEstate: {
      factors: {
        economic: 1.0,
        operational: 0.8,
        environmental: 1.2,
        technical: 0.6,
        functional: 1.0,
        maintenance: 1.1,
        misuse: 0.7
      },
      methods: {
        accounting: 'straight-line',
        economic: 'straight-line',
        operational: 'straight-line',
        environmental: 'straight-line',
        technical: 'straight-line',
        functional: 'straight-line',
        maintenance: 'straight-line',
        misuse: 'straight-line'
      },
      notes: { ar: 'عقارات', en: 'Real estate uses long straight-line lives.' }
    },
    business: {
      factors: { economic: 1.2, operational: 0.9, environmental: 0.5, technical: 0.8, functional: 1.2, maintenance: 0.6, misuse: 0.5 },
      methods: { accounting: 'straight-line', economic: 'declining-balance', technical: 'declining-balance' },
      notes: { ar: 'شركات', en: 'Business value decays with market relevance.' }
    },
    factory: {
      factors: { economic: 1.0, operational: 1.2, environmental: 1.1, technical: 1.0, functional: 0.8, maintenance: 1.3, misuse: 1.0 },
      methods: { accounting: 'straight-line', operational: 'units-of-production', maintenance: 'straight-line' },
      notes: { ar: 'مصانع', en: 'Heavy usage and maintenance drive factory depreciation.' }
    },
    machineryEquipment: {
      factors: { economic: 1.0, operational: 1.3, environmental: 1.0, technical: 1.2, functional: 0.9, maintenance: 1.2, misuse: 1.1 },
      methods: { accounting: 'straight-line', operational: 'units-of-production', technical: 'declining-balance' },
      notes: { ar: 'آلات ومعدات', en: 'Usage and obsolescence dominate.' }
    },
    vehiclesFleet: {
      factors: { economic: 1.1, operational: 1.4, environmental: 1.1, technical: 1.0, functional: 0.8, maintenance: 1.2, misuse: 1.3 },
      methods: { accounting: 'declining-balance', operational: 'units-of-production', technical: 'declining-balance' },
      notes: { ar: 'مركبات وأساطيل', en: 'Mileage and age drive vehicle depreciation.' }
    },
    agricultureFarms: {
      factors: { economic: 0.9, operational: 1.0, environmental: 1.3, technical: 0.6, functional: 0.7, maintenance: 1.1, misuse: 0.8 },
      methods: { accounting: 'straight-line', environmental: 'straight-line' },
      notes: { ar: 'زراعة ومزارع', en: 'Climate exposure is significant.' }
    },
    livestock: {
      factors: { economic: 1.2, operational: 1.0, environmental: 1.0, technical: 0.4, functional: 0.6, maintenance: 1.2, misuse: 0.8 },
      methods: { accounting: 'straight-line', maintenance: 'straight-line' },
      notes: { ar: 'ثروة حيوانية', en: 'Biological depreciation with health/maintenance factors.' }
    },
    naturalResourcesMining: {
      factors: { economic: 1.0, operational: 1.1, environmental: 1.2, technical: 0.8, functional: 0.7, maintenance: 1.0, misuse: 0.9 },
      methods: { accounting: 'units-of-production' },
      notes: { ar: 'موارد طبيعية وتعدين', en: 'Depletion-based depreciation.' }
    },
    oilGas: {
      factors: { economic: 1.0, operational: 1.1, environmental: 1.3, technical: 0.9, functional: 0.7, maintenance: 1.1, misuse: 1.0 },
      methods: { accounting: 'units-of-production' },
      notes: { ar: 'نفط وغاز', en: 'Reserve-based depletion.' }
    },
    infrastructure: {
      factors: { economic: 0.9, operational: 1.0, environmental: 1.2, technical: 0.7, functional: 0.8, maintenance: 1.2, misuse: 0.9 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'بنية تحتية', en: 'Long-life straight-line with environmental factor.' }
    },
    intellectualProperty: {
      factors: { economic: 1.3, operational: 0.5, environmental: 0.2, technical: 1.5, functional: 1.3, maintenance: 0.5, misuse: 0.4 },
      methods: { accounting: 'straight-line', technical: 'declining-balance' },
      notes: { ar: 'ملكية فكرية', en: 'Obsolescence is the dominant factor.' }
    },
    brandsTrademarks: {
      factors: { economic: 1.2, operational: 0.5, environmental: 0.2, technical: 0.8, functional: 1.2, maintenance: 0.6, misuse: 0.3 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'علامات تجارية', en: 'Brand strength reduces functional depreciation.' }
    },
    patents: {
      factors: { economic: 1.2, operational: 0.5, environmental: 0.2, technical: 1.6, functional: 1.1, maintenance: 0.4, misuse: 0.3 },
      methods: { accounting: 'straight-line', technical: 'declining-balance' },
      notes: { ar: 'براءات اختراع', en: 'Legal life limits; technology obsolescence is high.' }
    },
    copyrightsContent: {
      factors: { economic: 1.1, operational: 0.5, environmental: 0.2, technical: 1.2, functional: 1.0, maintenance: 0.4, misuse: 0.3 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'حقوق مؤلف', en: 'Content amortization over useful life.' }
    },
    franchises: {
      factors: { economic: 1.1, operational: 0.8, environmental: 0.3, technical: 0.7, functional: 1.1, maintenance: 0.6, misuse: 0.4 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'امتيازات تجارية', en: 'Contract-life amortization.' }
    },
    licensesPermits: {
      factors: { economic: 1.1, operational: 0.6, environmental: 0.3, technical: 0.6, functional: 1.2, maintenance: 0.4, misuse: 0.3 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'تراخيص وتصاريح', en: 'License duration drives amortization.' }
    },
    financialAssets: {
      factors: { economic: 1.0, operational: 0.2, environmental: 0.1, technical: 0.5, functional: 0.6, maintenance: 0.1, misuse: 0.2 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'أصول مالية', en: 'Market value changes dominate; minimal physical depreciation.' }
    },
    cryptoDigital: {
      factors: { economic: 1.2, operational: 0.2, environmental: 0.1, technical: 1.4, functional: 1.0, maintenance: 0.2, misuse: 0.5 },
      methods: { accounting: 'declining-balance', technical: 'declining-balance' },
      notes: { ar: 'عملات رقمية', en: 'High volatility and technology risk.' }
    },
    commodities: {
      factors: { economic: 1.0, operational: 0.5, environmental: 0.3, technical: 0.2, functional: 0.4, maintenance: 0.2, misuse: 0.2 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'سلع', en: 'Short holding period; market price driven.' }
    },
    artCollectibles: {
      factors: { economic: 0.6, operational: 0.3, environmental: 1.0, technical: 0.3, functional: 0.4, maintenance: 0.8, misuse: 0.6 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'فنون ومقتنيات', en: 'May appreciate; depreciation only for condition loss.' }
    },
    jewelryPreciousMetals: {
      factors: { economic: 0.7, operational: 0.3, environmental: 0.8, technical: 0.3, functional: 0.4, maintenance: 0.6, misuse: 0.5 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'مجوهرات ومعادن ثمينة', en: 'Material value resists depreciation.' }
    },
    softwareTechnology: {
      factors: { economic: 1.3, operational: 0.6, environmental: 0.2, technical: 1.7, functional: 1.2, maintenance: 0.8, misuse: 0.4 },
      methods: { accounting: 'declining-balance', technical: 'declining-balance' },
      notes: { ar: 'برمجيات وتقنية', en: 'Rapid technical obsolescence.' }
    },
    medicalEquipment: {
      factors: { economic: 1.1, operational: 1.1, environmental: 0.9, technical: 1.4, functional: 0.9, maintenance: 1.2, misuse: 0.9 },
      methods: { accounting: 'straight-line', technical: 'declining-balance' },
      notes: { ar: 'معدات طبية', en: 'Regulatory and technology obsolescence.' }
    },
    educationalEquipment: {
      factors: { economic: 1.0, operational: 1.0, environmental: 0.9, technical: 1.2, functional: 0.8, maintenance: 1.0, misuse: 0.9 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'تجهيزات تعليمية', en: 'Moderate usage and technology obsolescence.' }
    },
    distressedAsset: {
      factors: { economic: 1.4, operational: 0.9, environmental: 1.0, technical: 1.1, functional: 1.2, maintenance: 1.3, misuse: 1.0 },
      methods: { accounting: 'declining-balance' },
      notes: { ar: 'أصول متعثرة', en: 'Accelerated depreciation due to distress.' }
    },
    tourismAsset: {
      factors: { economic: 1.0, operational: 1.1, environmental: 1.1, technical: 0.9, functional: 1.0, maintenance: 1.1, misuse: 0.8 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'أصول سياحية', en: 'Usage and location exposure matter.' }
    },
    personalWealth: {
      factors: { economic: 1.0, operational: 0.3, environmental: 0.3, technical: 0.6, functional: 0.7, maintenance: 0.4, misuse: 0.4 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'ثروة شخصية', en: 'Portfolio-level depreciation assumptions.' }
    },
    scrapSalvage: {
      factors: { economic: 1.0, operational: 0.5, environmental: 0.8, technical: 0.4, functional: 0.5, maintenance: 0.5, misuse: 0.5 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'سكراب وخردة', en: 'Value approximates scrap/salvage value.' }
    },
    maritimeAsset: {
      factors: { economic: 1.0, operational: 1.2, environmental: 1.3, technical: 1.0, functional: 0.8, maintenance: 1.2, misuse: 1.0 },
      methods: { accounting: 'straight-line', operational: 'units-of-production' },
      notes: { ar: 'أصول بحرية', en: 'Marine exposure and operating hours dominate.' }
    },
    logisticsAsset: {
      factors: { economic: 1.0, operational: 1.2, environmental: 1.0, technical: 1.0, functional: 0.9, maintenance: 1.1, misuse: 1.0 },
      methods: { accounting: 'straight-line', operational: 'units-of-production' },
      notes: { ar: 'أصول لوجستية', en: 'Throughput-based wear.' }
    },
    fuelStation: {
      factors: { economic: 1.0, operational: 1.1, environmental: 1.2, technical: 0.9, functional: 0.9, maintenance: 1.1, misuse: 0.9 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'محطات وقود', en: 'Environmental and regulatory factors.' }
    },
    beautyWellness: {
      factors: { economic: 1.1, operational: 1.0, environmental: 0.8, technical: 1.0, functional: 1.1, maintenance: 1.0, misuse: 0.8 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'تجميل وصحة', en: 'Trend-driven functional obsolescence.' }
    },
    giftsStationery: {
      factors: { economic: 1.1, operational: 0.9, environmental: 0.7, technical: 0.9, functional: 1.0, maintenance: 0.8, misuse: 0.7 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'هدايا وماليات', en: 'Retail-style depreciation.' }
    },
    furnitureAsset: {
      factors: { economic: 1.0, operational: 1.0, environmental: 0.9, technical: 0.7, functional: 0.9, maintenance: 1.0, misuse: 0.9 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'أثاث', en: 'Physical wear and minor obsolescence.' }
    },
    retailBusiness: {
      factors: { economic: 1.2, operational: 1.0, environmental: 0.7, technical: 1.0, functional: 1.1, maintenance: 0.9, misuse: 0.7 },
      methods: { accounting: 'straight-line' },
      notes: { ar: 'نشاط تجاري عام', en: 'Market-driven economic depreciation.' }
    }
  };

  class DepreciationStandards {
    getStandard(assetClass) {
      return BDS_STANDARDS[assetClass] || null;
    }

    hasStandard(assetClass) {
      return !!BDS_STANDARDS[assetClass];
    }

    list() {
      return Object.keys(BDS_STANDARDS);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DepreciationStandards, BDS_STANDARDS };
  }
  if (typeof window !== 'undefined') {
    window.DepreciationStandards = DepreciationStandards;
    window.BDS_STANDARDS = BDS_STANDARDS;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.DepreciationStandards = DepreciationStandards;
    globalThis.BDS_STANDARDS = BDS_STANDARDS;
  }
})();
