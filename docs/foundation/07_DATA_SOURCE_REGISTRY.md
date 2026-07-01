# BONDS Data Source Registry — سجل مصادر البيانات

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **المراجع:** `docs/intelligence/01_LIVE_INTELLIGENCE_PLATFORM.md`  
> **النوع:** وثيقة تأسيس — لا يحتوي على كود

---

## 1. الرؤية

توثيق جميع مصادر البيانات التي تُغذي BONDS، مع تصنيفها حسب النوع والاعتمادية والتكلفة والبدائل.

---

## 2. تنسيق المصدر

| البند | الوصف |
|---|---|
| **الاسم** | اسم المصدر. |
| **الدولة** | الدولة المغطاة. |
| **الرابط** | URL أو API endpoint. |
| **طريقة التكامل** | API / Crawler / Manual / File. |
| **درجة الثقة** | A / B / C / D. |
| **التكلفة** | Free / Paid / Subscription. |
| **التكرار** | دورة التحديث. |
| **البديل** | مصدر احتياطي. |

---

## 3. مصادر حكومية (Government)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| KAPSARC | السعودية | kapsarc.org | API | A | Free | ربعي/سنوي | مواقع عقارية |
| GASTAT | السعودية | stats.gov.sa | API | A | Free | شهري/ربعي | World Bank |
| SAMA | السعودية | sama.gov.sa | API | A | Free | شهري | البنوك المركزية |
| Saudi Open Data | السعودية | data.gov.sa | API | A | Free | أسبوعي/شهري | — |
| UAE Open Data | الإمارات | bayanat.ae | API | B | Free | متغير | — |
| Egypt CAPMAS | مصر | capmas.gov.eg | API/File | B | Free | ربعي | World Bank |
| World Bank Open Data | Global | data.worldbank.org | API | A | Free | سنوي | IMF |
| UN Comtrade | Global | comtrade.un.org | API | A | Free | شهري | الجمارك المحلية |

---

## 4. مصادر مالية (Financial)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| Tadawul | السعودية | tadawul.com.sa | API | A | Paid | فوري | Yahoo Finance |
| Bloomberg API | Global | bloomberg.com | API | A | Paid | فوري | Alpha Vantage |
| Alpha Vantage | Global | alphavantage.co | API | B | Free/Paid | دقيقة | Yahoo Finance |
| Yahoo Finance | Global | finance.yahoo.com | API | B | Free | فوري | Bloomberg |
| Open Exchange Rates | Global | openexchangerates.org | API | A | Paid | ساعة | بنوك مركزية |

---

## 5. مصادر تجارية (Commercial)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| SimilarWeb | Global | similarweb.com | API | B | Paid | شهري | Crunchbase |
| Crunchbase | Global | crunchbase.com | API | B | Paid | أسبوعي | LinkedIn |
| LinkedIn | Global | linkedin.com | API | B | Paid | متغير | Crunchbase |

---

## 6. مصادر السوق (Market)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| LBMA | Global | lbma.org.uk | API/File | A | Free | يومي | Yahoo Finance |
| Freightos | Global | freightos.com | API | B | Paid | يومي | Bloomberg |
| EIA | Global | eia.gov | API | A | Free | يومي | ministries |

---

## 7. خرائط (Maps)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| Google Maps API | Global | google.com/maps | API | A | Paid | فوري | Mapbox |
| Mapbox | Global | mapbox.com | API | A | Paid | فوري | Google Maps |
| OpenStreetMap | Global | openstreetmap.org | API/File | B | Free | يومي | Google Maps |

---

## 8. أقمار صناعية (Satellite)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| Sentinel Hub | Global | sentinel-hub.com | API | A | Free/Paid | يومي | Planet |
| Landsat | Global | usgs.gov | API | A | Free | متغير | Sentinel |
| Planet | Global | planet.com | API | A | Paid | يومي | Sentinel |

---

## 9. طقس (Weather)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| OpenWeatherMap | Global | openweathermap.org | API | B | Free/Paid | ساعة | الهيئة الوطنية |
| National Met Services | حسب الدولة | — | API | A | Free | ساعة | OpenWeatherMap |

---

## 10. الذكاء الاصطناعي (AI)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| OpenAI | Global | openai.com | API | A | Pay-per-use | فوري | Anthropic |
| Anthropic | Global | anthropic.com | API | A | Pay-per-use | فوري | OpenAI |

---

## 11. مصارف (Banking)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| SIMAH | السعودية | simah.com | API | A | Agreement | فوري | — |
| AECB | الإمارات | aecb.gov.ae | API | A | Agreement | فوري | — |
| I-Score | مصر | i-score.com.eg | API | A | Agreement | فوري | — |

---

## 12. عقارات (Real Estate)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| KAPSARC | السعودية | kapsarc.org | API | A | Free | ربعي | مواقع عقارية |
| Property Finder | السعودية/الإمارات | propertyfinder.sa | Crawler | C | Free | يومي | KAPSARC |

---

## 13. صناعة (Industrial)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| وزارة الصناعة | حسب الدولة | — | API/File | A | Free | ربعي | جمعيات القطاع |
| Commodity Exchanges | Global | — | API | A | Paid | يومي | مصانع محلية |

---

## 14. صحة (Healthcare)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| وزارة الصحة | حسب الدولة | — | API/File | A | Free | شهري | WHO |
| WHO | Global | who.int | API/File | A | Free | سنوي | وزارة الصحة |

---

## 15. تعليم (Education)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| وزارة التعليم | حسب الدولة | — | API/File | A | Free | سنوي | UNESCO |
| UNESCO | Global | unesco.org | API/File | A | Free | سنوي | وزارة التعليم |

---

## 16. سياحة (Tourism)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| وزارة السياحة | حسب الدولة | — | API/File | A | Free | شهري/ربعي | UNWTO |
| UNWTO | Global | unwto.org | API/File | A | Free | ربعي | وزارة السياحة |

---

## 17. نقل (Transportation)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| GACA | السعودية | gaca.gov.sa | API | A | Free | يومي/أسبوعي | IATA |
| IATA | Global | iata.org | API/File | A | Paid | يومي | GACA |
| Port Authorities | حسب الدولة | — | API | A | Free | يومي | UNCTAD |

---

## 18. دولية (International)

| الاسم | الدولة | الرابط | التكامل | الثقة | التكلفة | التكرار | البديل |
|---|---|---|---|---|---|---|---|
| IMF | Global | imf.org | API/File | A | Free | ربعي | World Bank |
| OECD | Global | oecd.org | API/File | A | Free | ربعي | World Bank |
| UNCTAD | Global | unctad.org | API/File | A | Free | ربعي | — |

---

## 19. ملاحظات

- جميع المصادر تُسجل في Global Data Catalog.
- المصادر من فئة D لا تُستخدم دون تأكيد.
- كل مصدر يحمل `valid_until`.
