/**
 * Water Factory — Market & Reference Data
 * Default values per country/region for auto-fill suggestions.
 *
 * ⚠️ IMPORTANT — READ BEFORE USING:
 * These values are indicative benchmarks derived from publicly available
 * sources (industrial electricity tariffs, minimum-wage reports, water-tariff
 * publications, and packaging-industry estimates). They are intentionally
 * conservative and are NOT a substitute for actual supplier quotations,
 * local feasibility studies, or professional financial advice.
 *
 * Users MUST review and adjust every value to their specific project,
 * location, supplier quotes, and financing terms before making investment
 * decisions.
 *
 * Currency note:
 * All monetary values are stored in Saudi Riyal (SAR) as a common reference
 * unit. The UI only changes the currency symbol when the country selector
 * changes; it does NOT perform foreign-exchange conversion. If you need
 * local-currency values, update the numbers manually or replace this file
 * with country-specific currency data.
 *
 * Source examples used for calibration:
 * - Industrial electricity: Saudi SEC (0.18 SAR/kWh 2024), UAE DEWA/ADDC,
 *   Qatar Kahramaa, Egypt EEHC, IEA MENA reports.
 * - Industrial water: Marafiq industrial tariff (8.04 SAR/m³), SWCC reports.
 * - Wages: country minimum-wage / expat manufacturing-wage benchmarks.
 * - Packaging: PET preform wholesale estimates ($0.0017/g FOB), regional
 *   logistics and conversion add-ons.
 */
(function () {
  const marketData = {
    SA: {
      "nameAr": "السعودية",
      "nameEn": "Saudi Arabia",
      "bottleCostPerUnit": 0.18,
      "capCostPerUnit": 0.04,
      "labelCostPerUnit": 0.04,
      "cartonCostPerBottle": 0.07,
      "shrinkCostPerBottle": 0.04,
      "electricityRatePerKwh": 0.18,
      "waterRatePerM3": 6,
      "shiftCostPerWorker": 180,
      "workersPerShift": 6,
      "buildingCostPerM2": 1600,
      "bottlePrice": 1.2,
      "marketingCostPerCustomer": 400,
      "monthlyNewCustomers": 40,
      "logisticsCostPerBottle": 0.12,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Saudi Electricity Company (SEC) industrial tariff 2024 (~0.18 SAR/kWh)",
          "water": "Marafiq industrial water tariff (8.04 SAR/m³) and SWCC reports",
          "wages": "Saudi MHRSD minimum wage / expat manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + regional logistics add-ons"
        },
        "urls": {
          "sfda": "https://www.sfda.gov.sa/",
          "sec": "https://www.se.com.sa/",
          "marafiq": "https://www.marafiq.com.sa/",
          "saso": "https://www.saso.gov.sa/"
        },
        "confidence": "medium",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Saudi Food and Drug Authority (SFDA) license",
            "Municipality license",
            "Industrial license (MODON)",
            "SASO quality mark"
          ],
          "standards": [
            "Gulf Standard GSO 1858 for packaged drinking water",
            "SASO / SFDA food safety requirements"
          ],
          "notes": "Water bottling plants must comply with SFDA food facility requirements and obtain SASO quality mark for local distribution."
        },
        "competitors": [
          {
            "brand": "Oasis / Nova",
            "size": "500 ml",
            "priceRange": [
              1,
              1.5
            ]
          },
          {
            "brand": "Local brands",
            "size": "330 ml",
            "priceRange": [
              0.75,
              1.25
            ]
          },
          {
            "brand": "5-gallon dispensers",
            "size": "19 L",
            "priceRange": [
              5,
              10
            ]
          }
        ]
      }
    },
    AE: {
      "nameAr": "الإمارات",
      "nameEn": "United Arab Emirates",
      "bottleCostPerUnit": 0.2,
      "capCostPerUnit": 0.05,
      "labelCostPerUnit": 0.05,
      "cartonCostPerBottle": 0.08,
      "shrinkCostPerBottle": 0.05,
      "electricityRatePerKwh": 0.22,
      "waterRatePerM3": 4.5,
      "shiftCostPerWorker": 220,
      "workersPerShift": 6,
      "buildingCostPerM2": 2200,
      "bottlePrice": 1.4,
      "marketingCostPerCustomer": 500,
      "monthlyNewCustomers": 50,
      "logisticsCostPerBottle": 0.15,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "DEWA / ADDC industrial tariffs 2024",
          "water": "DEWA industrial water tariff and desalination cost benchmarks",
          "wages": "UAE expat manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + regional logistics add-ons"
        },
        "urls": {
          "adafsa": "https://www.adafsa.ae/",
          "dewa": "https://www.dewa.gov.ae/",
          "addc": "https://www.addc.ae/"
        },
        "confidence": "medium",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Dubai Municipality / Abu Dhabi Agriculture and Food Safety Authority",
            "Industrial license",
            "Tawtheeq for workers"
          ],
          "standards": [
            "UAE Standard ES 827 for packaged natural mineral and drinking water",
            "GCC Standard GSO 1858"
          ],
          "notes": "Each emirate has its own food control authority; products must meet UAE-specific labeling requirements."
        },
        "competitors": [
          {
            "brand": "Masafi",
            "size": "500 ml",
            "priceRange": [
              1.2,
              1.8
            ]
          },
          {
            "brand": "Al Ain",
            "size": "500 ml",
            "priceRange": [
              1,
              1.5
            ]
          },
          {
            "brand": "Local 5-gallon",
            "size": "19 L",
            "priceRange": [
              6,
              12
            ]
          }
        ]
      }
    },
    EG: {
      "nameAr": "مصر",
      "nameEn": "Egypt",
      "bottleCostPerUnit": 0.14,
      "capCostPerUnit": 0.03,
      "labelCostPerUnit": 0.03,
      "cartonCostPerBottle": 0.05,
      "shrinkCostPerBottle": 0.03,
      "electricityRatePerKwh": 0.2,
      "waterRatePerM3": 1.8,
      "shiftCostPerWorker": 90,
      "workersPerShift": 8,
      "buildingCostPerM2": 900,
      "bottlePrice": 0.9,
      "marketingCostPerCustomer": 220,
      "monthlyNewCustomers": 35,
      "logisticsCostPerBottle": 0.08,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Egyptian Electric Holding Company (EEHC) industrial tariff",
          "water": "Egyptian Holding Company for Water and Wastewater industrial rates",
          "wages": "Egypt minimum wage and manufacturing sector benchmarks",
          "packaging": "PET preform wholesale estimates + import/local logistics add-ons"
        },
        "urls": {
          "eos": "https://www.eos.org.eg/",
          "moee": "http://www.moee.gov.eg/",
          "hcww": "http://www.hcww.com.eg/"
        },
        "confidence": "medium-low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health and Population food facility license",
            "Industrial development authority license",
            "Standardization and Quality Organization (EOS)"
          ],
          "standards": [
            "Egyptian Standard ES 1589 for packaged drinking water",
            "EOS quality certification"
          ],
          "notes": "Import of packaging materials may require customs clearance and EOS conformity certificates."
        },
        "competitors": [
          {
            "brand": "Baraka / Dasani",
            "size": "500 ml",
            "priceRange": [
              0.5,
              0.9
            ]
          },
          {
            "brand": "Local brands",
            "size": "1.5 L",
            "priceRange": [
              0.8,
              1.5
            ]
          },
          {
            "brand": "5-gallon dispensers",
            "size": "19 L",
            "priceRange": [
              2,
              5
            ]
          }
        ]
      }
    },
    JO: {
      "nameAr": "الأردن",
      "nameEn": "Jordan",
      "bottleCostPerUnit": 0.16,
      "capCostPerUnit": 0.04,
      "labelCostPerUnit": 0.04,
      "cartonCostPerBottle": 0.06,
      "shrinkCostPerBottle": 0.04,
      "electricityRatePerKwh": 0.22,
      "waterRatePerM3": 2.2,
      "shiftCostPerWorker": 110,
      "workersPerShift": 8,
      "buildingCostPerM2": 1100,
      "bottlePrice": 1.1,
      "marketingCostPerCustomer": 320,
      "monthlyNewCustomers": 35,
      "logisticsCostPerBottle": 0.1,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Jordan National Electric Power Company (NEPCO) industrial tariff",
          "water": "Miyahuna / Aqaba Water industrial tariffs",
          "wages": "Jordan minimum wage and manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + regional logistics add-ons"
        },
        "urls": {
          "jfda": "https://www.jfda.jo/",
          "nepco": "https://www.nepco.com.jo/",
          "miyahuna": "https://www.miyahuna.com.jo/"
        },
        "confidence": "medium-low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Jordan Food and Drug Administration (JFDA)",
            "Ministry of Industry and Trade license",
            "Municipality license"
          ],
          "standards": [
            "Jordanian Standard JS 1134 for packaged drinking water",
            "JFDA GMP requirements"
          ],
          "notes": "Water-scarce country; industrial water tariffs vary by region and source."
        },
        "competitors": [
          {
            "brand": "Nestlé Pure Life",
            "size": "500 ml",
            "priceRange": [
              0.7,
              1.1
            ]
          },
          {
            "brand": "Local brands",
            "size": "1.5 L",
            "priceRange": [
              0.9,
              1.4
            ]
          }
        ]
      }
    },
    KW: {
      "nameAr": "الكويت",
      "nameEn": "Kuwait",
      "bottleCostPerUnit": 0.19,
      "capCostPerUnit": 0.05,
      "labelCostPerUnit": 0.05,
      "cartonCostPerBottle": 0.08,
      "shrinkCostPerBottle": 0.05,
      "electricityRatePerKwh": 0.1,
      "waterRatePerM3": 4,
      "shiftCostPerWorker": 250,
      "workersPerShift": 6,
      "buildingCostPerM2": 2000,
      "bottlePrice": 1.3,
      "marketingCostPerCustomer": 550,
      "monthlyNewCustomers": 45,
      "logisticsCostPerBottle": 0.14,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Ministry of Electricity & Water (MEW) industrial tariff",
          "water": "MEW desalinated water industrial tariff",
          "wages": "Kuwait minimum wage and expat manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + regional logistics add-ons"
        },
        "urls": {
          "mew": "https://www.mew.gov.kw/",
          "kfda": "https://www.kfda.gov.kw/"
        },
        "confidence": "medium",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Kuwait Food and Nutrition Administration",
            "Ministry of Commerce and Industry",
            "Municipality license"
          ],
          "standards": [
            "Kuwait Standard KWS 1858 / GSO 1858",
            "GCC labeling requirements"
          ],
          "notes": "High labor and real-estate costs; small plants face strong competition from established brands."
        },
        "competitors": [
          {
            "brand": "Al-Danah",
            "size": "500 ml",
            "priceRange": [
              1.1,
              1.6
            ]
          },
          {
            "brand": "Local 5-gallon",
            "size": "19 L",
            "priceRange": [
              6,
              10
            ]
          }
        ]
      }
    },
    BH: {
      "nameAr": "البحرين",
      "nameEn": "Bahrain",
      "bottleCostPerUnit": 0.18,
      "capCostPerUnit": 0.05,
      "labelCostPerUnit": 0.05,
      "cartonCostPerBottle": 0.07,
      "shrinkCostPerBottle": 0.05,
      "electricityRatePerKwh": 0.16,
      "waterRatePerM3": 3.2,
      "shiftCostPerWorker": 200,
      "workersPerShift": 6,
      "buildingCostPerM2": 1900,
      "bottlePrice": 1.2,
      "marketingCostPerCustomer": 450,
      "monthlyNewCustomers": 40,
      "logisticsCostPerBottle": 0.13,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Electricity & Water Authority (EWA) industrial tariff",
          "water": "EWA industrial water tariff",
          "wages": "Bahrain minimum wage and expat manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + regional logistics add-ons"
        },
        "urls": {
          "ewa": "https://www.ewa.bh/",
          "health": "https://www.health.gov.bh/"
        },
        "confidence": "medium",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Bahrain Food Control Directorate",
            "Ministry of Industry and Commerce",
            "Municipality license"
          ],
          "standards": [
            "Bahrain Standard BDG 1858 / GSO 1858",
            "GCC labeling requirements"
          ],
          "notes": "Small domestic market; distribution efficiency is critical."
        },
        "competitors": [
          {
            "brand": "Al-Manhal",
            "size": "500 ml",
            "priceRange": [
              0.9,
              1.4
            ]
          },
          {
            "brand": "Local 5-gallon",
            "size": "19 L",
            "priceRange": [
              5,
              9
            ]
          }
        ]
      }
    },
    OM: {
      "nameAr": "عمان",
      "nameEn": "Oman",
      "bottleCostPerUnit": 0.17,
      "capCostPerUnit": 0.04,
      "labelCostPerUnit": 0.04,
      "cartonCostPerBottle": 0.07,
      "shrinkCostPerBottle": 0.04,
      "electricityRatePerKwh": 0.14,
      "waterRatePerM3": 2.4,
      "shiftCostPerWorker": 160,
      "workersPerShift": 8,
      "buildingCostPerM2": 1400,
      "bottlePrice": 1.1,
      "marketingCostPerCustomer": 380,
      "monthlyNewCustomers": 38,
      "logisticsCostPerBottle": 0.11,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Oman Power and Water Procurement (OPWP) / Nama industrial tariff",
          "water": "Oman water authority industrial tariffs",
          "wages": "Oman minimum wage and expat manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + regional logistics add-ons"
        },
        "urls": {
          "nama": "https://www.nama.om/",
          "opwp": "https://www.opwp.om/"
        },
        "confidence": "medium",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Regional Municipalities and Water Resources",
            "Ministry of Commerce and Industry",
            "Oman Food Safety"
          ],
          "standards": [
            "Oman Standard OS 1858 / GSO 1858",
            "SFDA-equivalent local requirements"
          ],
          "notes": "Water subsidies being phased out; tariff increases expected."
        },
        "competitors": [
          {
            "brand": "Oasis / Local brands",
            "size": "500 ml",
            "priceRange": [
              0.9,
              1.3
            ]
          },
          {
            "brand": "5-gallon dispensers",
            "size": "19 L",
            "priceRange": [
              5,
              9
            ]
          }
        ]
      }
    },
    QA: {
      "nameAr": "قطر",
      "nameEn": "Qatar",
      "bottleCostPerUnit": 0.21,
      "capCostPerUnit": 0.05,
      "labelCostPerUnit": 0.05,
      "cartonCostPerBottle": 0.08,
      "shrinkCostPerBottle": 0.05,
      "electricityRatePerKwh": 0.16,
      "waterRatePerM3": 4.2,
      "shiftCostPerWorker": 280,
      "workersPerShift": 6,
      "buildingCostPerM2": 2400,
      "bottlePrice": 1.5,
      "marketingCostPerCustomer": 600,
      "monthlyNewCustomers": 55,
      "logisticsCostPerBottle": 0.16,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Kahramaa industrial tariff",
          "water": "Kahramaa desalinated water industrial tariff",
          "wages": "Qatar minimum wage and expat manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + regional logistics add-ons"
        },
        "urls": {
          "kahramaa": "https://www.km.qa/",
          "qs": "https://www.qs.org.qa/"
        },
        "confidence": "medium",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Qatar General Organization for Standardization (QS)",
            "Ministry of Public Health food facility license",
            "Municipality license"
          ],
          "standards": [
            "Qatar Standard QS 1858 / GSO 1858",
            "QS quality mark"
          ],
          "notes": "High-income market; premium branding can command higher prices."
        },
        "competitors": [
          {
            "brand": "Masar / Local brands",
            "size": "500 ml",
            "priceRange": [
              1.3,
              2
            ]
          },
          {
            "brand": "5-gallon dispensers",
            "size": "19 L",
            "priceRange": [
              7,
              12
            ]
          }
        ]
      }
    },
    IQ: {
      "nameAr": "العراق",
      "nameEn": "Iraq",
      "bottleCostPerUnit": 0.13,
      "capCostPerUnit": 0.03,
      "labelCostPerUnit": 0.03,
      "cartonCostPerBottle": 0.05,
      "shrinkCostPerBottle": 0.03,
      "electricityRatePerKwh": 0.15,
      "waterRatePerM3": 1.4,
      "shiftCostPerWorker": 70,
      "workersPerShift": 10,
      "buildingCostPerM2": 700,
      "bottlePrice": 0.8,
      "marketingCostPerCustomer": 180,
      "monthlyNewCustomers": 30,
      "logisticsCostPerBottle": 0.07,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Iraq Ministry of Electricity / private generator tariffs",
          "water": "Local water authority / well water costs",
          "wages": "Iraq manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + import logistics add-ons"
        },
        "urls": {
          "cosqc": "https://cosqc.gov.iq/",
          "moelc": "https://moelc.gov.iq/"
        },
        "confidence": "low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health food facility license",
            "Ministry of Industry license",
            "Local municipality approvals"
          ],
          "standards": [
            "Iraqi Standard IQ 1858 / GSO 1858 where applicable",
            "Central Organization for Standardization and Quality Control (COSQC)"
          ],
          "notes": "Unreliable grid power; factories often rely on expensive private generators."
        },
        "competitors": [
          {
            "brand": "Local brands",
            "size": "500 ml",
            "priceRange": [
              0.4,
              0.8
            ]
          },
          {
            "brand": "5-gallon dispensers",
            "size": "19 L",
            "priceRange": [
              2,
              4
            ]
          }
        ]
      }
    },
    MA: {
      "nameAr": "المغرب",
      "nameEn": "Morocco",
      "bottleCostPerUnit": 0.15,
      "capCostPerUnit": 0.04,
      "labelCostPerUnit": 0.04,
      "cartonCostPerBottle": 0.06,
      "shrinkCostPerBottle": 0.04,
      "electricityRatePerKwh": 0.15,
      "waterRatePerM3": 2,
      "shiftCostPerWorker": 80,
      "workersPerShift": 9,
      "buildingCostPerM2": 850,
      "bottlePrice": 0.9,
      "marketingCostPerCustomer": 250,
      "monthlyNewCustomers": 35,
      "logisticsCostPerBottle": 0.09,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "ONEE industrial electricity tariff",
          "water": "ONEE / local water utility industrial tariffs",
          "wages": "Morocco minimum wage and manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + regional logistics add-ons"
        },
        "urls": {
          "onssa": "http://www.onssa.gov.ma/",
          "onee": "https://www.onee.ma/"
        },
        "confidence": "medium-low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Agriculture / ONSSA food facility approval",
            "Ministry of Industry license",
            "Municipality license"
          ],
          "standards": [
            "Moroccan Standard NM 10.7.002 for packaged drinking water",
            "ONSSA hygiene requirements"
          ],
          "notes": "Strong competition from local spring-water brands."
        },
        "competitors": [
          {
            "brand": "Sidi Ali / Aïn Saiss",
            "size": "500 ml",
            "priceRange": [
              0.5,
              0.9
            ]
          },
          {
            "brand": "1.5 L local brands",
            "size": "1.5 L",
            "priceRange": [
              0.8,
              1.4
            ]
          }
        ]
      }
    },
    SY: {
      "nameAr": "سوريا",
      "nameEn": "Syria",
      "bottleCostPerUnit": 0.09,
      "capCostPerUnit": 0.02,
      "labelCostPerUnit": 0.02,
      "cartonCostPerBottle": 0.03,
      "shrinkCostPerBottle": 0.02,
      "electricityRatePerKwh": 0.06,
      "waterRatePerM3": 0.7,
      "shiftCostPerWorker": 40,
      "workersPerShift": 10,
      "buildingCostPerM2": 400,
      "bottlePrice": 0.45,
      "marketingCostPerCustomer": 100,
      "monthlyNewCustomers": 25,
      "logisticsCostPerBottle": 0.04,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Local estimates / private generator tariffs due to conflict",
          "water": "Local well water / municipal estimates",
          "wages": "Syria crisis-period wage estimates",
          "packaging": "PET preform import estimates + high logistics risk"
        },
        "urls": {
          "moh": "http://www.moh.gov.sy/"
        },
        "confidence": "low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health / Local municipality approvals",
            "Chamber of Commerce registration"
          ],
          "standards": [
            "Syrian Standard 1858 where enforced",
            "Local food safety requirements"
          ],
          "notes": "Highly volatile operating environment; data reliability is very low."
        },
        "competitors": [
          {
            "brand": "Local brands",
            "size": "500 ml",
            "priceRange": [
              0.2,
              0.5
            ]
          }
        ]
      }
    },
    LB: {
      "nameAr": "لبنان",
      "nameEn": "Lebanon",
      "bottleCostPerUnit": 0.17,
      "capCostPerUnit": 0.04,
      "labelCostPerUnit": 0.04,
      "cartonCostPerBottle": 0.06,
      "shrinkCostPerBottle": 0.04,
      "electricityRatePerKwh": 0.3,
      "waterRatePerM3": 2.8,
      "shiftCostPerWorker": 100,
      "workersPerShift": 8,
      "buildingCostPerM2": 1200,
      "bottlePrice": 1,
      "marketingCostPerCustomer": 280,
      "monthlyNewCustomers": 35,
      "logisticsCostPerBottle": 0.1,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "EDL / private generator tariffs (very high due to crisis)",
          "water": "Local water utility / tanker water costs",
          "wages": "Lebanon crisis-period wage estimates in USD/LBP",
          "packaging": "PET preform import estimates + currency risk"
        },
        "urls": {
          "libnor": "https://www.libnor.gov.lb/",
          "moph": "https://www.moph.gov.lb/"
        },
        "confidence": "low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Economy and Trade registration",
            "Ministry of Public Health approval",
            "Municipality license"
          ],
          "standards": [
            "Lebanese Standard LIBNOR 1858 / GSO 1858",
            "Ministry of Health GMP"
          ],
          "notes": "Energy crisis means most factories rely on diesel generators; electricity cost is a major risk."
        },
        "competitors": [
          {
            "brand": "Tannourine / Sohat",
            "size": "500 ml",
            "priceRange": [
              0.6,
              1
            ]
          },
          {
            "brand": "Local 1.5 L",
            "size": "1.5 L",
            "priceRange": [
              0.9,
              1.5
            ]
          }
        ]
      }
    },
    TN: {
      "nameAr": "تونس",
      "nameEn": "Tunisia",
      "bottleCostPerUnit": 0.14,
      "capCostPerUnit": 0.03,
      "labelCostPerUnit": 0.03,
      "cartonCostPerBottle": 0.05,
      "shrinkCostPerBottle": 0.03,
      "electricityRatePerKwh": 0.14,
      "waterRatePerM3": 1.7,
      "shiftCostPerWorker": 75,
      "workersPerShift": 9,
      "buildingCostPerM2": 800,
      "bottlePrice": 0.85,
      "marketingCostPerCustomer": 230,
      "monthlyNewCustomers": 32,
      "logisticsCostPerBottle": 0.08,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "STEG industrial tariff",
          "water": "SONEDE industrial water tariff",
          "wages": "Tunisia minimum wage and manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + regional logistics add-ons"
        },
        "urls": {
          "innorpi": "https://www.innorpi.tn/",
          "sonded": "http://www.sonede.com.tn/",
          "steg": "https://www.steg.com.tn/"
        },
        "confidence": "medium-low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health food facility license",
            "Ministry of Industry license",
            "Municipality license"
          ],
          "standards": [
            "Tunisian Standard NT 09.14 for packaged drinking water",
            "INNORPI quality certification"
          ],
          "notes": "Tourism season drives demand spikes; distribution network is key."
        },
        "competitors": [
          {
            "brand": "Safia / Sabrine",
            "size": "500 ml",
            "priceRange": [
              0.4,
              0.7
            ]
          },
          {
            "brand": "1.5 L brands",
            "size": "1.5 L",
            "priceRange": [
              0.7,
              1.1
            ]
          }
        ]
      }
    },
    DZ: {
      "nameAr": "الجزائر",
      "nameEn": "Algeria",
      "bottleCostPerUnit": 0.15,
      "capCostPerUnit": 0.04,
      "labelCostPerUnit": 0.04,
      "cartonCostPerBottle": 0.06,
      "shrinkCostPerBottle": 0.04,
      "electricityRatePerKwh": 0.13,
      "waterRatePerM3": 1.5,
      "shiftCostPerWorker": 70,
      "workersPerShift": 9,
      "buildingCostPerM2": 750,
      "bottlePrice": 0.85,
      "marketingCostPerCustomer": 210,
      "monthlyNewCustomers": 30,
      "logisticsCostPerBottle": 0.08,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Sonelgaz industrial tariff",
          "water": "SEALGAZ / ADE industrial water tariff",
          "wages": "Algeria minimum wage and manufacturing wage benchmarks",
          "packaging": "PET preform wholesale estimates + import restrictions impact"
        },
        "urls": {
          "ianor": "https://www.ianor.dz/",
          "sonelgaz": "https://www.sonelgaz.dz/"
        },
        "confidence": "medium-low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health facility approval",
            "Ministry of Industry license",
            "Municipality license"
          ],
          "standards": [
            "Algerian Standard NA 6360 for packaged drinking water",
            "IANOR quality certification"
          ],
          "notes": "Import restrictions on packaging materials can affect costs and supply."
        },
        "competitors": [
          {
            "brand": "Ifri / Guedila",
            "size": "500 ml",
            "priceRange": [
              0.4,
              0.7
            ]
          },
          {
            "brand": "1.5 L brands",
            "size": "1.5 L",
            "priceRange": [
              0.6,
              1
            ]
          }
        ]
      }
    },
    LY: {
      "nameAr": "ليبيا",
      "nameEn": "Libya",
      "bottleCostPerUnit": 0.13,
      "capCostPerUnit": 0.03,
      "labelCostPerUnit": 0.03,
      "cartonCostPerBottle": 0.05,
      "shrinkCostPerBottle": 0.03,
      "electricityRatePerKwh": 0.09,
      "waterRatePerM3": 1.1,
      "shiftCostPerWorker": 65,
      "workersPerShift": 9,
      "buildingCostPerM2": 650,
      "bottlePrice": 0.75,
      "marketingCostPerCustomer": 190,
      "monthlyNewCustomers": 28,
      "logisticsCostPerBottle": 0.07,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "GECOL / private generator estimates",
          "water": "Local water utility estimates",
          "wages": "Libya manufacturing wage estimates",
          "packaging": "PET preform import estimates + logistics disruptions"
        },
        "urls": {
          "gecol": "https://www.gecol.ly/"
        },
        "confidence": "low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health / Local municipality approvals",
            "Chamber of Commerce registration"
          ],
          "standards": [
            "Libyan Standard LLS 1858 where enforced",
            "Local food safety requirements"
          ],
          "notes": "Political instability affects supply chains and tariff enforcement."
        },
        "competitors": [
          {
            "brand": "Local brands",
            "size": "500 ml",
            "priceRange": [
              0.3,
              0.6
            ]
          }
        ]
      }
    },
    SD: {
      "nameAr": "السودان",
      "nameEn": "Sudan",
      "bottleCostPerUnit": 0.1,
      "capCostPerUnit": 0.02,
      "labelCostPerUnit": 0.02,
      "cartonCostPerBottle": 0.03,
      "shrinkCostPerBottle": 0.02,
      "electricityRatePerKwh": 0.07,
      "waterRatePerM3": 0.8,
      "shiftCostPerWorker": 45,
      "workersPerShift": 10,
      "buildingCostPerM2": 450,
      "bottlePrice": 0.5,
      "marketingCostPerCustomer": 130,
      "monthlyNewCustomers": 25,
      "logisticsCostPerBottle": 0.05,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Sudanese Electricity Distribution Company / generator estimates",
          "water": "Local water utility / well water estimates",
          "wages": "Sudan wage estimates",
          "packaging": "PET preform import estimates + currency instability"
        },
        "urls": {
          "sdg": "https://www.sdg.gov.sd/",
          "ssmo": "https://www.ssmo.gov.sd/"
        },
        "confidence": "low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health approval",
            "Chamber of Commerce registration"
          ],
          "standards": [
            "Sudanese Standard SSMO 1858 where enforced",
            "Local food safety requirements"
          ],
          "notes": "Economic instability and currency devaluation create high uncertainty."
        },
        "competitors": [
          {
            "brand": "Local brands",
            "size": "500 ml",
            "priceRange": [
              0.2,
              0.4
            ]
          }
        ]
      }
    },
    YE: {
      "nameAr": "اليمن",
      "nameEn": "Yemen",
      "bottleCostPerUnit": 0.08,
      "capCostPerUnit": 0.02,
      "labelCostPerUnit": 0.02,
      "cartonCostPerBottle": 0.03,
      "shrinkCostPerBottle": 0.02,
      "electricityRatePerKwh": 0.06,
      "waterRatePerM3": 0.6,
      "shiftCostPerWorker": 35,
      "workersPerShift": 10,
      "buildingCostPerM2": 350,
      "bottlePrice": 0.4,
      "marketingCostPerCustomer": 90,
      "monthlyNewCustomers": 22,
      "logisticsCostPerBottle": 0.04,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Local estimates / private generators due to conflict",
          "water": "Local well water estimates",
          "wages": "Yemen crisis-period wage estimates",
          "packaging": "PET preform import estimates + severe logistics challenges"
        },
        "urls": {
          "mopic": "https://www.mopic-ye.org/"
        },
        "confidence": "very low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health / Local authority approvals"
          ],
          "standards": [
            "Yemeni Standard YSMO where enforced",
            "Local food safety requirements"
          ],
          "notes": "Extremely challenging operating environment; data is highly unreliable."
        },
        "competitors": [
          {
            "brand": "Local brands",
            "size": "500 ml",
            "priceRange": [
              0.15,
              0.35
            ]
          }
        ]
      }
    },
    DJ: {
      "nameAr": "جيبوتي",
      "nameEn": "Djibouti",
      "bottleCostPerUnit": 0.18,
      "capCostPerUnit": 0.04,
      "labelCostPerUnit": 0.04,
      "cartonCostPerBottle": 0.06,
      "shrinkCostPerBottle": 0.04,
      "electricityRatePerKwh": 0.22,
      "waterRatePerM3": 2.8,
      "shiftCostPerWorker": 95,
      "workersPerShift": 8,
      "buildingCostPerM2": 1100,
      "bottlePrice": 1.1,
      "marketingCostPerCustomer": 300,
      "monthlyNewCustomers": 36,
      "logisticsCostPerBottle": 0.11,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "EDD industrial tariff / generator backup estimates",
          "water": "ONEAD water utility estimates",
          "wages": "Djibouti manufacturing wage estimates",
          "packaging": "PET preform import estimates + port logistics"
        },
        "urls": {
          "onead": "https://www.onead.dj/"
        },
        "confidence": "low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health approval",
            "Ministry of Commerce registration",
            "Municipality license"
          ],
          "standards": [
            "Djibouti Standard / GSO 1858 where applicable",
            "Local food safety requirements"
          ],
          "notes": "Small market; most goods imported through Port of Djibouti."
        },
        "competitors": [
          {
            "brand": "Local/imported brands",
            "size": "500 ml",
            "priceRange": [
              0.8,
              1.2
            ]
          }
        ]
      }
    },
    SO: {
      "nameAr": "الصومال",
      "nameEn": "Somalia",
      "bottleCostPerUnit": 0.09,
      "capCostPerUnit": 0.02,
      "labelCostPerUnit": 0.02,
      "cartonCostPerBottle": 0.03,
      "shrinkCostPerBottle": 0.02,
      "electricityRatePerKwh": 0.08,
      "waterRatePerM3": 0.9,
      "shiftCostPerWorker": 40,
      "workersPerShift": 10,
      "buildingCostPerM2": 400,
      "bottlePrice": 0.45,
      "marketingCostPerCustomer": 110,
      "monthlyNewCustomers": 24,
      "logisticsCostPerBottle": 0.05,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "Local estimates / private generators",
          "water": "Local well/borehole water estimates",
          "wages": "Somalia manufacturing wage estimates",
          "packaging": "PET preform import estimates + logistics challenges"
        },
        "urls": {
          "somchamber": "https://www.somchamber.so/"
        },
        "confidence": "very low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Local authority approvals",
            "Chamber of Commerce registration"
          ],
          "standards": [
            "Local standards where enforced"
          ],
          "notes": "Fragmented regulatory environment; security and logistics are major risks."
        },
        "competitors": [
          {
            "brand": "Local brands",
            "size": "500 ml",
            "priceRange": [
              0.2,
              0.4
            ]
          }
        ]
      }
    },
    MR: {
      "nameAr": "موريتانيا",
      "nameEn": "Mauritania",
      "bottleCostPerUnit": 0.13,
      "capCostPerUnit": 0.03,
      "labelCostPerUnit": 0.03,
      "cartonCostPerBottle": 0.05,
      "shrinkCostPerBottle": 0.03,
      "electricityRatePerKwh": 0.12,
      "waterRatePerM3": 1.4,
      "shiftCostPerWorker": 60,
      "workersPerShift": 9,
      "buildingCostPerM2": 700,
      "bottlePrice": 0.75,
      "marketingCostPerCustomer": 180,
      "monthlyNewCustomers": 28,
      "logisticsCostPerBottle": 0.07,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "SOMELEC industrial tariff",
          "water": "SNDE industrial water tariff",
          "wages": "Mauritania manufacturing wage estimates",
          "packaging": "PET preform import estimates + logistics"
        },
        "urls": {
          "snde": "https://www.snde.mr/",
          "somelec": "https://www.somelec.mr/"
        },
        "confidence": "low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health approval",
            "Ministry of Commerce registration",
            "Municipality license"
          ],
          "standards": [
            "Mauritanian Standard / GSO 1858 where applicable",
            "Local food safety requirements"
          ],
          "notes": "Limited local packaging suppliers; most inputs imported."
        },
        "competitors": [
          {
            "brand": "Local/imported brands",
            "size": "500 ml",
            "priceRange": [
              0.4,
              0.7
            ]
          }
        ]
      }
    },
    KM: {
      "nameAr": "جزر القمر",
      "nameEn": "Comoros",
      "bottleCostPerUnit": 0.14,
      "capCostPerUnit": 0.03,
      "labelCostPerUnit": 0.03,
      "cartonCostPerBottle": 0.05,
      "shrinkCostPerBottle": 0.03,
      "electricityRatePerKwh": 0.16,
      "waterRatePerM3": 1.9,
      "shiftCostPerWorker": 55,
      "workersPerShift": 9,
      "buildingCostPerM2": 750,
      "bottlePrice": 0.8,
      "marketingCostPerCustomer": 200,
      "monthlyNewCustomers": 29,
      "logisticsCostPerBottle": 0.08,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "MA-MWE industrial tariff / generator backup",
          "water": "Local water utility estimates",
          "wages": "Comoros manufacturing wage estimates",
          "packaging": "PET preform import estimates + island logistics"
        },
        "urls": {
          "comorosgov": "https://www.beit-salam.km/"
        },
        "confidence": "very low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health approval",
            "Chamber of Commerce registration"
          ],
          "standards": [
            "Local / GSO 1858 where applicable"
          ],
          "notes": "Small island economy; all packaging materials imported by sea."
        },
        "competitors": [
          {
            "brand": "Local/imported brands",
            "size": "500 ml",
            "priceRange": [
              0.5,
              0.8
            ]
          }
        ]
      }
    },
    PS: {
      "nameAr": "فلسطين",
      "nameEn": "Palestine",
      "bottleCostPerUnit": 0.16,
      "capCostPerUnit": 0.04,
      "labelCostPerUnit": 0.04,
      "cartonCostPerBottle": 0.06,
      "shrinkCostPerBottle": 0.04,
      "electricityRatePerKwh": 0.18,
      "waterRatePerM3": 2.4,
      "shiftCostPerWorker": 105,
      "workersPerShift": 8,
      "buildingCostPerM2": 1150,
      "bottlePrice": 1.05,
      "marketingCostPerCustomer": 290,
      "monthlyNewCustomers": 34,
      "logisticsCostPerBottle": 0.1,
      "maintenanceRate": 1,
      "meta": {
        "sources": {
          "electricity": "JDECO / private generator tariffs",
          "water": "Mekorot / Palestinian Water Authority estimates",
          "wages": "Palestine minimum wage and manufacturing wage benchmarks",
          "packaging": "PET preform import estimates + crossing logistics"
        },
        "urls": {
          "mne": "http://www.mne.gov.ps/",
          "paltrade": "https://www.paltrade.org/"
        },
        "confidence": "low",
        "lastUpdated": "2026-08-01",
        "regulations": {
          "licenses": [
            "Ministry of Health approval",
            "Ministry of National Economy registration",
            "Municipality license"
          ],
          "standards": [
            "Palestinian Standard PS 1858 / GSO 1858",
            "Local food safety requirements"
          ],
          "notes": "Import of raw materials through Israeli crossings can cause delays and cost volatility."
        },
        "competitors": [
          {
            "brand": "Local brands",
            "size": "500 ml",
            "priceRange": [
              0.7,
              1.1
            ]
          },
          {
            "brand": "Imported Israeli brands",
            "size": "500 ml",
            "priceRange": [
              0.8,
              1.3
            ]
          }
        ]
      }
    }
  };

  const defaultData = marketData.SA;

  function getCountryData(code) {
    return marketData[code] || defaultData;
  }

  function getAllCountries() {
    return Object.keys(marketData).map(code => ({
      code,
      nameAr: marketData[code].nameAr,
      nameEn: marketData[code].nameEn
    }));
  }

  function getCountryMeta(code) {
    const data = marketData[code];
    return data ? (data.meta || null) : null;
  }

  window.WaterFactoryData = {
    getCountryData,
    getAllCountries,
    getCountryMeta,
    marketData
  };
})();
