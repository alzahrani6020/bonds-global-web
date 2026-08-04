/**
 * Bonds Global — Platform data for AE
 * Generated from calculators/country-platforms-data.js
 */
(function () {
  'use strict';
  window.BondsPlatformCountryData = window.BondsPlatformCountryData || {};
  window.BondsPlatformCountryData['AE'] = {
  "code": "AE",
  "name": "الإمارات",
  "nameEn": "UAE",
  "flag": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#068241\" d=\"M32 5H9v9h27V9c0-2.209-1.791-4-4-4z\"/><path fill=\"#EEE\" d=\"M9 14h27v8H9z\"/><path fill=\"#141414\" d=\"M9 31h23c2.209 0 4-1.791 4-4v-5H9v9z\"/><path fill=\"#EC2028\" d=\"M4 5C1.791 5 0 6.791 0 9v18c0 2.209 1.791 4 4 4h5V5H4z\"/></svg>",
  "currency": "AED",
  "currencySymbol": "د.إ",
  "currencySymbolEn": "AED",
  "vatRate": 5,
  "platforms": [
    {
      "id": "plat_talabat",
      "operatingModel": "closed",
      "name": "طلبات",
      "nameEn": "Talabat",
      "fee": 22,
      "confidence": "verified",
      "freeDelivery": {
        "threshold": 30,
        "restaurantShare": 5
      },
      "feeTiers": [
        {
          "min": 0,
          "max": 10000,
          "fee": 22
        },
        {
          "min": 10001,
          "max": 50000,
          "fee": 20
        },
        {
          "min": 50001,
          "max": 999999,
          "fee": 18
        }
      ]
    },
    {
      "id": "plat_deliveroo",
      "operatingModel": "closed",
      "name": "ديليفرو",
      "nameEn": "Deliveroo",
      "fee": 28,
      "confidence": "verified",
      "freeDelivery": {
        "threshold": 60,
        "restaurantShare": 6
      }
    },
    {
      "id": "plat_careem",
      "operatingModel": "closed",
      "name": "كريم ناو",
      "nameEn": "Careem NOW",
      "fee": 22,
      "confidence": "verified",
      "freeDelivery": {
        "threshold": 30,
        "restaurantShare": 5
      }
    },
    {
      "id": "plat_noon",
      "operatingModel": "closed",
      "name": "نون فود",
      "nameEn": "Noon Food",
      "fee": 15,
      "confidence": "verified",
      "freeDelivery": {
        "threshold": 25,
        "restaurantShare": 4
      }
    },
    {
      "id": "plat_keeta",
      "operatingModel": "closed",
      "name": "كيتا",
      "nameEn": "Keeta",
      "fee": 15,
      "confidence": "verified",
      "freeDelivery": {
        "threshold": 25,
        "restaurantShare": 3
      }
    },
    {
      "id": "plat_zomato",
      "operatingModel": "closed",
      "name": "زوماتو",
      "nameEn": "Zomato",
      "fee": 22,
      "confidence": "verified"
    },
    {
      "id": "plat_eat_easy",
      "operatingModel": "closed",
      "name": "إيت إيزي",
      "nameEn": "EatEasy",
      "fee": 18,
      "confidence": "estimated"
    },
    {
      "id": "plat_munch_on",
      "operatingModel": "closed",
      "name": "مانش أون",
      "nameEn": "Munch:on",
      "fee": 18,
      "confidence": "estimated"
    },
    {
      "id": "plat_insta_shop",
      "operatingModel": "closed",
      "name": "إنستا شوب",
      "nameEn": "InstaShop",
      "fee": 18,
      "confidence": "estimated"
    },
    {
      "id": "plat_smiles",
      "operatingModel": "closed",
      "name": "سمايلز",
      "nameEn": "Smiles",
      "fee": 18,
      "confidence": "estimated"
    },
    {
      "id": "plat_carriage",
      "operatingModel": "closed",
      "name": "كاريدج",
      "nameEn": "Carriage",
      "fee": 22,
      "confidence": "estimated"
    },
    {
      "id": "plat_glovo",
      "operatingModel": "closed",
      "name": "غلوفو",
      "nameEn": "Glovo",
      "fee": 25,
      "confidence": "verified"
    },
    {
      "id": "plat_supermeal",
      "operatingModel": "closed",
      "name": "سوبرميل",
      "nameEn": "Supermeal",
      "fee": 18,
      "confidence": "estimated"
    },
    {
      "id": "plat_cari",
      "operatingModel": "closed",
      "name": "كاري",
      "nameEn": "Cari",
      "fee": 18,
      "confidence": "estimated"
    },
    {
      "id": "plat_direct",
      "operatingModel": "direct",
      "name": "مباشر (بدون منصة)",
      "nameEn": "Direct",
      "fee": 0,
      "confidence": "verified"
    }
  ],
  "marketInsights": {
    "avgOrderValue": 85,
    "peakHours": "12:00–14:30 و 19:00–22:30 (السحور 01:00–03:30 في رمضان)",
    "ramadanMultiplier": 1.4,
    "weekendBehavior": "الجمعة أقل طلباً. السبت–الأربعاء أعلى. الوافدون يطلبون أكثر من المواطنين.",
    "popularCategories": [
      "البرجر",
      "السوشي",
      "البيتزا",
      "المأكولات الهندية",
      "اللبناني",
      "العصائر والمخبوزات"
    ],
    "paymentMethod": "البطاقة 85% | Apple Pay/Google Pay 10% | كاش 5%",
    "specialNotes": "دبي الأعلى قيمة طلب. أبوظبي أكثر ولاءً للمنصات. طلبات 45% سوق. ديليفرو 25% (متميزة بالمطاعم الراقية)."
  }
};
})();
