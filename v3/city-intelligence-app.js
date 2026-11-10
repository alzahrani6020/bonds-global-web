const IS_EN = String(document.documentElement.getAttribute('lang') || '').toLowerCase().startsWith('en');
    const LOCALE = IS_EN ? 'en-US' : 'ar-SA';
    function t(ar, en) { return IS_EN ? en : ar; }
    const I18N_PHRASES = [
      ['لا توجد ثلاثة أبعاد مستقلة على الأقل بأدلة مصدرية مثبتة. تم إيقاف احتساب الدرجة من القيم الافتراضية.', 'At least three independently source-verified dimensions are missing. The score is not computed from default values.'],
      ['لا توجد حالياً أدلة مصدرية مخزنة لهذه المدينة. لن تُعرض درجات أو توصيات تقديرية على أنها حقائق.', 'No stored source evidence is available for this city. Estimated scores and recommendations will not be shown as facts.'],
      ['هذه القيم على مستوى الدولة وليست قيماً خاصة بالمدينة، وتُعرض للسياق فقط. سنة كل مؤشر هي سنة المصدر الفعلية وقد تختلف عن بقية المؤشرات.', 'These values are national, not city-specific, and are shown for context only. Each indicator uses its actual source year and years may differ.'],
      ['لن يعرض النظام قيماً مصطنعة. عند توفر بيانات خارجية على مستوى الدولة ستظهر أدناه كسياق وطني واضح.', 'The system will not invent values. When national source data is available it appears below as clearly labelled national context.'],
      ['لا توجد حالياً بيانات كمية موثقة على مستوى هذه المدينة.', 'No verified quantitative data is currently available at this city grain.'],
      ['لا توجد مؤشرات مصدرية مثبتة لهذه المدينة في أحدث سنة', 'No source-backed city indicators exist for the latest year'],
      ['النظام لا يعرض أرقاماً مصطنعة.', 'The system does not display invented figures.'],
      ['الكتالوج والسكان والسياق الوطني متاحان، لكن مؤشرات المدينة وبيانات السوق الموثّقة غير موجودة بعد.', 'The catalog, population and national context are available, but verified city indicators and market data are not yet present.'],
      ['توجد سجلات داخلية غير مثبتة لسنة ', 'Unverified internal records exist for year '],
      ['. يمكن اختيارها من قائمة السنة لمراجعتها كقيم تقديرية، وليست قراءة مصدرية.', '. They can be selected from the year list for review as estimates, not as source readings.'],
      ['مؤشر تحليلي داخلي محسوب فقط من ', 'Internal analytical index computed only from '],
      [' أبعاد لها أدلة مصدرية مثبتة، وليس رقماً رسمياً.', ' dimensions with verified source evidence; it is not an official figure.'],
      ['القيم الخاصة بالمدينة تُعرض فقط من مصدر مدينة. إذا غابت، يظهر السياق الوطني بوسم واضح وليس كرقم للمدينة.', 'City values are shown only from a city source. If missing, national context appears with a clear label and is not treated as a city figure.'],
      ['أفضل القطاعات الاستثمارية بناءً على البيانات المتاحة.', 'Best available investment sectors based on sourced data.'],
      ['لا توجد توصيات قطاعية مثبتة لهذه المدينة/النشاط حالياً.', 'No verified sector recommendations are currently available for this city/activity.'],
      ['لن يتم توليد توصيات افتراضية عند غياب بيانات سوق موثقة.', 'Default recommendations are not generated when verified market data is missing.'],
      ['هذه القيم ناتجة عن نموذج داخلي وليست قراءة سوق حية مباشرة.', 'These values come from an internal model and are not a live market reading.'],
      ['درجة تحليلية وليست حقيقة رسمية؛ تُستخدم للمقارنة فقط وتُقيّم وفق مصدر البيانات أعلاه.', 'An analytical score, not an official fact; used for comparison only and judged against the source above.'],
      ['مرتبة من درجة فرصة مرتبطة ببيانات مصدرية قابلة للتتبع', 'Ranked from an opportunity score tied to traceable source data'],
      ['مؤشرات المدينة المصدرية تُعرض فقط عند توفر مصدر وسنة على مستوى المدينة', 'source-backed city indicators appear only when a city-level source and year exist'],
      ['السياق الوطني يُعرض عند غياب مؤشر مصدري للمدينة', 'national context is shown when a city-level source indicator is missing'],
      ['العقار والتكاليف التشغيلية', 'Real estate and operating costs'],
      ['السكان والقوة الشرائية', 'Population and purchasing power'],
      ['البنية التحتية وسهولة الأعمال', 'Infrastructure and ease of doing business'],
      ['النمو والتوسع', 'Growth and expansion'],
      ['أحدث سياق اقتصادي وطني متاح', 'Latest available national economic context'],
      ['أدلة ومصادر البيانات', 'Evidence and data sources'],
      ['حالة البيانات', 'Data status'],
      ['مؤشر جاذبية الاستثمار', 'Investment attractiveness'],
      ['معلومات المدينة', 'City information'],
      ['المؤشرات الاقتصادية', 'Economic indicators'],
      ['المؤشرات العقارية', 'Real-estate indicators'],
      ['توصيات قطاعية في', 'Sector recommendations in'],
      ['بيانات السوق', 'Market data'],
      ['مؤشر فرصة داخلي', 'Internal opportunity index'],
      ['محرك السيناريوهات السريع', 'Quick scenario engine'],
      ['الناتج المحلي الإجمالي للمدينة', 'City GDP'],
      ['الناتج المحلي للمدينة', 'City GDP'],
      ['نصيب الفرد من الناتج المحلي', 'GDP per capita'],
      ['نصيب الفرد من الناتج', 'GDP per capita'],
      ['معدل النمو الاقتصادي', 'Economic growth rate'],
      ['النمو الاقتصادي', 'Economic growth'],
      ['سهولة ممارسة الأعمال', 'Ease of doing business'],
      ['متوسط الإيجار للمتر المربع', 'Average rent per sqm'],
      ['متوسط سعر الأرض للمتر المربع', 'Average land price per sqm'],
      ['إيجار المستودعات للمتر المربع', 'Warehouse rent per sqm'],
      ['إيجار المصانع للمتر المربع', 'Factory rent per sqm'],
      ['متوسط الإيجار / م²', 'Average rent / sqm'],
      ['متوسط سعر الأرض / م²', 'Average land price / sqm'],
      ['إيجار المستودعات / م²', 'Warehouse rent / sqm'],
      ['إيجار المصانع / م²', 'Factory rent / sqm'],
      ['عدد التراخيص الجديدة', 'New licenses'],
      ['حجم الاستثمار', 'Investment volume'],
      ['مؤشر التشبع', 'Saturation index'],
      ['عدد المنافسين', 'Number of competitors'],
      ['درجة تشبع السوق', 'Market saturation score'],
      ['متوسط الراتب', 'Average salary'],
      ['درجة توفر العمالة', 'Labor availability score'],
      ['عدد المتخصصين', 'Number of specialists'],
      ['معدل السعودة', 'Saudization rate'],
      ['حجم السوق', 'Market size'],
      ['معدل النمو السنوي', 'Annual growth rate'],
      ['المصروف الفردي', 'Per-capita spending'],
      ['الطلب المتوقع', 'Expected demand'],
      ['متوسط هامش الربح', 'Average profit margin'],
      ['درجة المخاطرة', 'Risk score'],
      ['درجة الفرصة', 'Opportunity score'],
      ['معدل البطالة', 'Unemployment rate'],
      ['عدد المنشآت', 'Number of establishments'],
      ['معدل التضخم', 'Inflation rate'],
      ['مؤشر القوة الشرائية', 'Purchasing-power index'],
      ['تصنيف المدينة', 'City classification'],
      ['الاستثمار الأجنبي المباشر', 'Foreign direct investment'],
      ['سكان الدولة', 'National population'],
      ['سعر الفائدة', 'Interest rate'],
      ['موثوقية محدودة', 'Limited reliability'],
      ['موثوقية عالية', 'High reliability'],
      ['موثوقية متوسطة', 'Medium reliability'],
      ['سياق المنطقة', 'Regional context'],
      ['مثبت للمدينة', 'City-verified'],
      ['سياق وطني', 'National context'],
      ['غير متوفر حالياً', 'Currently unavailable'],
      ['العملة غير موثقة', 'Currency unverified'],
      ['جذابة جداً', 'Highly attractive'],
      ['قديم حسب سياسة الحداثة', 'Stale under the freshness policy'],
      ['تقدير صادر عن المصدر', 'Source-issued estimate'],
      ['مصدر خارجي', 'External source'],
      ['مصدر غير مسمى', 'Unnamed source'],
      ['أحدث سنة مصدرية (', 'Latest source year ('],
      ['أحدث سنة مسجلة (', 'Latest recorded year ('],
      ['أحدث سنة متاحة', 'Latest available year'],
      ['اختر النشاط (اختياري)', 'Select activity (optional)'],
      ['اختر المدينة', 'Select city'],
      ['اختر الدولة', 'Select country'],
      ['اختر مدينة لعرض المؤشرات', 'Select a city to view indicators'],
      ['جاري تحميل المؤشرات والمصادر...', 'Loading indicators and sources...'],
      ['جاري الجلب الحي...', 'Fetching live sources...'],
      ['جلب حي من المصادر', 'Fetch live from sources'],
      ['محدّث من المصدر', 'Updated from source'],
      ['تم الجلب الحي', 'Live fetch complete'],
      ['اختر مدينة أولاً', 'Select a city first'],
      ['مؤشرات عامة', 'General indicators'],
      ['تم إرسال التصحيح، شكراً لك!', 'Correction submitted. Thank you.'],
      ['لا توجد إنذارات غير مقروءة', 'No unread alerts'],
      ['جاري الحساب...', 'Calculating...'],
      ['فشل تحميل الكتالوج: ', 'Failed to load catalog: '],
      ['فشل تحميل بيانات المدينة: ', 'Failed to load city data: '],
      ['فشل الجلب الحي: ', 'Live fetch failed: '],
      ['فشل التحليل: ', 'Analysis failed: '],
      ['فشل الإرسال: ', 'Submit failed: '],
      ['فترة الاسترداد (شهر)', 'Payback (months)'],
      ['مؤشر المخاطر', 'Risk index'],
      ['الوضع الأساسي', 'Baseline'],
      ['تم الاكتشاف: ', 'Detected: '],
      ['مصدر السكان: ', 'Population source: '],
      ['مدينة في السجل التشغيلي', 'cities in the operational register'],
      [' دولة عربية · ', ' Arab countries · '],
      [' مدينة في ', ' cities in '],
      [' بعدد سكان', ' with population'],
      [' بإحداثيات', ' with coordinates'],
      [' · كتالوج', ' · catalog'],
      [' · سنة ', ' · year '],
      [' · الفترة ', ' · period '],
      [' · عمر البيانات ', ' · data age '],
      [' · عمر ', ' · age '],
      [' · آخر جلب: ', ' · last fetched: '],
      [' · آخر جلب ', ' · last fetched '],
      [' · ثقة ', ' · confidence '],
      ['% من الناتج', '% of GDP'],
      ['غير متوفر', 'Unavailable'],
      ['غير متاح حالياً.', 'Currently unavailable.'],
      ['غير متاح', 'Unavailable'],
      ['غير مثبت', 'Unverified'],
      ['تقديري', 'Estimated'],
      ['مثبت', 'Verified'],
      ['قديم', 'Stale'],
      ['حديث', 'Fresh'],
      ['ساخنة', 'Hot'],
      ['جيدة', 'Good'],
      ['متوسطة', 'Fair'],
      ['ضعيفة', 'Weak'],
      ['جذابة', 'Attractive'],
      ['مرتفع', 'High'],
      ['منخفض', 'Low'],
      ['اختر نشاطاً', 'Select an activity'],
      ['تنبيه:', 'Note:'],
      ['عدد السكان', 'Population'],
      ['صحّح البيانات', 'Correct data'],
      ['نقص عمالة', 'Labor shortage'],
      ['انخفاض مبيعات', 'Sales drop']
    ];
    function localize(text) {
      if (!IS_EN || text == null) return text;
      let out = String(text);
      for (const [ar, en] of I18N_PHRASES) out = out.split(ar).join(en);
      return out;
    }
    function cityDisplayName(city) {
      if (!city) return '';
      return IS_EN ? (city.name_en || city.name_ar || city.code || '') : (city.name_ar || city.name_en || city.code || '');
    }
    function activityDisplayName(activity) {
      if (!activity) return '';
      return IS_EN ? (activity.name_en || activity.name_ar || activity.code || '') : (activity.name_ar || activity.name_en || activity.code || '');
    }
    function countryDisplayName(country) {
      if (!country) return '';
      return IS_EN ? (country.name_en || country.name_ar || country.code || '') : (country.name_ar || country.name_en || country.code || '');
    }

const API_URL = '/api/v3';
    const COUNTRY_NAMES_AR = {
      SA: 'السعودية', AE: 'الإمارات', EG: 'مصر', QA: 'قطر', JO: 'الأردن',
      KW: 'الكويت', BH: 'البحرين', OM: 'عمان', IQ: 'العراق', LB: 'لبنان',
      SY: 'سوريا', PS: 'فلسطين', TN: 'تونس', DZ: 'الجزائر', MA: 'المغرب',
      LY: 'ليبيا', SD: 'السودان', YE: 'اليمن', SO: 'الصومال', DJ: 'جيبوتي',
      MR: 'موريتانيا', KM: 'جزر القمر'
    };
    const COUNTRY_NAMES_EN = {
      SA: 'Saudi Arabia', AE: 'United Arab Emirates', EG: 'Egypt', QA: 'Qatar', JO: 'Jordan',
      KW: 'Kuwait', BH: 'Bahrain', OM: 'Oman', IQ: 'Iraq', LB: 'Lebanon',
      SY: 'Syria', PS: 'Palestine', TN: 'Tunisia', DZ: 'Algeria', MA: 'Morocco',
      LY: 'Libya', SD: 'Sudan', YE: 'Yemen', SO: 'Somalia', DJ: 'Djibouti',
      MR: 'Mauritania', KM: 'Comoros'
    };
    const countryNames = IS_EN ? COUNTRY_NAMES_EN : COUNTRY_NAMES_AR;
    const countryFlags = {
      SA: 'https://flagcdn.com/w40/sa.png', AE: 'https://flagcdn.com/w40/ae.png', EG: 'https://flagcdn.com/w40/eg.png',
      QA: 'https://flagcdn.com/w40/qa.png', JO: 'https://flagcdn.com/w40/jo.png', KW: 'https://flagcdn.com/w40/kw.png',
      BH: 'https://flagcdn.com/w40/bh.png', OM: 'https://flagcdn.com/w40/om.png', IQ: 'https://flagcdn.com/w40/iq.png',
      LB: 'https://flagcdn.com/w40/lb.png', SY: 'https://flagcdn.com/w40/sy.png', PS: 'https://flagcdn.com/w40/ps.png',
      TN: 'https://flagcdn.com/w40/tn.png', DZ: 'https://flagcdn.com/w40/dz.png', MA: 'https://flagcdn.com/w40/ma.png',
      LY: 'https://flagcdn.com/w40/ly.png', SD: 'https://flagcdn.com/w40/sd.png', YE: 'https://flagcdn.com/w40/ye.png',
      SO: 'https://flagcdn.com/w40/so.png', DJ: 'https://flagcdn.com/w40/dj.png', MR: 'https://flagcdn.com/w40/mr.png',
      KM: 'https://flagcdn.com/w40/km.png'
    };
    let cities = [];
    let activities = [];
    let countryProfiles = new Map();
    const liveFetchedCities = new Set();
    let selectedCountryProfile = null;

    // Friendly Arabic labels for technical metric codes used inside insights / scenarios
    const METRIC_LABELS_AR = {
      gdp_city: 'الناتج المحلي الإجمالي للمدينة',
      growth_rate: 'معدل النمو الاقتصادي',
      unemployment_rate: 'معدل البطالة',
      establishments_count: 'عدد المنشآت',
      inflation_rate: 'معدل التضخم',
      business_ease_index: 'مؤشر سهولة ممارسة الأعمال',
      avg_rent_per_sqm: 'متوسط الإيجار للمتر المربع',
      avg_land_price_per_sqm: 'متوسط سعر الأرض للمتر المربع',
      warehouse_rent_per_sqm: 'إيجار المستودعات للمتر المربع',
      factory_rent_per_sqm: 'إيجار المصانع للمتر المربع',
      new_licenses_count: 'عدد التراخيص الجديدة',
      investment_volume: 'حجم الاستثمار',
      saturation_index: 'مؤشر التشبع',
      competitors_count: 'عدد المنافسين',
      market_saturation_score: 'درجة تشبع السوق',
      avg_salary: 'متوسط الراتب',
      labor_availability_score: 'درجة توفر العمالة',
      specialists_count: 'عدد المتخصصين',
      saudization_rate: 'معدل السعودة',
      market_size: 'حجم السوق',
      annual_growth_rate: 'معدل النمو السنوي',
      per_capita_spending: 'المصروف الفردي',
      expected_demand: 'الطلب المتوقع',
      profit_margin_avg: 'متوسط هامش الربح',
      risk_score: 'درجة المخاطرة',
      opportunity_score: 'درجة الفرصة'
    };
    const METRIC_LABELS_EN = {
      gdp_city: 'City GDP',
      growth_rate: 'Economic growth rate',
      unemployment_rate: 'Unemployment rate',
      establishments_count: 'Number of establishments',
      inflation_rate: 'Inflation rate',
      business_ease_index: 'Ease of doing business',
      avg_rent_per_sqm: 'Average rent per sqm',
      avg_land_price_per_sqm: 'Average land price per sqm',
      warehouse_rent_per_sqm: 'Warehouse rent per sqm',
      factory_rent_per_sqm: 'Factory rent per sqm',
      new_licenses_count: 'New licenses',
      investment_volume: 'Investment volume',
      saturation_index: 'Saturation index',
      competitors_count: 'Number of competitors',
      market_saturation_score: 'Market saturation score',
      avg_salary: 'Average salary',
      labor_availability_score: 'Labor availability score',
      specialists_count: 'Number of specialists',
      saudization_rate: 'Saudization rate',
      market_size: 'Market size',
      annual_growth_rate: 'Annual growth rate',
      per_capita_spending: 'Per-capita spending',
      expected_demand: 'Expected demand',
      profit_margin_avg: 'Average profit margin',
      risk_score: 'Risk score',
      opportunity_score: 'Opportunity score'
    };

    function metricLabel(code) {
      return IS_EN ? (METRIC_LABELS_EN[code] || METRIC_LABELS_AR[code] || code) : (METRIC_LABELS_AR[code] || code);
    }

    async function fetchJson(url, options = {}) {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed: ' + res.status);
      return data;
    }

    function formatNumber(num) {
      if (num === null || num === undefined) return '-';
      if (num >= 1e9) return (num / 1e9).toFixed(1) + ' ' + t('مليار', 'billion');
      if (num >= 1e6) return (num / 1e6).toFixed(1) + ' ' + t('مليون', 'million');
      return num.toLocaleString(LOCALE);
    }

    function confidenceBadge(value) {
      if (!value && value !== 0) return '';
      let level = 'low';
      let label = 'موثوقية محدودة';
      if (value >= 80) { level = 'high'; label = 'موثوقية عالية'; }
      else if (value >= 60) { level = 'medium'; label = 'موثوقية متوسطة'; }
      return `<span class="confidence ${level}">${label}</span>`;
    }

    function opportunityClass(score) {
      if (score >= 80) return 'hot';
      if (score >= 60) return 'good';
      if (score >= 40) return 'fair';
      return 'weak';
    }

    function opportunityLabel(score) {
      const cls = opportunityClass(score);
      return { hot: 'ساخنة', good: 'جيدة', fair: 'متوسطة', weak: 'ضعيفة' }[cls];
    }

    function opportunityColor(score) {
      const cls = opportunityClass(score);
      return { hot: '#f0c96a', good: '#22c55e', fair: '#f59e0b', weak: '#ef4444' }[cls];
    }

    function opportunityBadge(score) {
      const cls = opportunityClass(score);
      return `<span class="score-badge score-${cls}">${opportunityLabel(score)}</span>`;
    }

    function countryContextMetric(countryContext, codes) {
      const wanted = Array.isArray(codes) ? codes : [codes];
      return (countryContext?.metrics || []).find(row => wanted.includes(row.metric)) || null;
    }

    function cityOrNational(metricCode, cityValue, suffix, countryContext, evidenceRows = []) {
      if (cityValue !== null && cityValue !== undefined && cityValue !== '' && !Number.isNaN(Number(cityValue))) {
        return null;
      }
      const liveRow = (evidenceRows || []).find(row =>
        row.metric_code === metricCode && Number.isFinite(Number(row.value)) && row.evidence_status !== 'unverified'
      );
      if (liveRow) {
        const scope = String(liveRow.metadata?.scope || '').toLowerCase();
        const scopeLabel = scope === 'region' ? 'سياق المنطقة' : scope === 'city' ? 'مثبت للمدينة' : 'سياق وطني';
        const year = liveRow.year ? ' ' + liveRow.year : '';
        const formatted = formatNumber(Number(liveRow.value)) + (suffix ? ' ' + suffix : '');
        const level = scope === 'city' ? 'high' : 'medium';
        return formatted + ' <span class="confidence ' + level + '">' + scopeLabel + year + '</span>';
      }
      const aliases = {
        growth_rate: ['economic_growth_rate', 'growth_rate'],
        unemployment_rate: ['unemployment_rate'],
        inflation_rate: ['inflation_rate']
      };
      const row = countryContextMetric(countryContext, aliases[metricCode] || [metricCode]);
      if (!row || !Number.isFinite(Number(row.value))) return null;
      const formatted = formatNumber(Number(row.value)) + (suffix ? ' ' + suffix : '');
      const year = row.year ? ' ' + row.year : '';
      return formatted + ' <span class="confidence medium">سياق وطني' + year + '</span>';
    }

    function valueOrMissing(value, suffix = '') {
      if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
        return '<span class="missing-badge">غير متوفر حالياً</span>';
      }
      return formatNumber(Number(value)) + (suffix ? ' ' + suffix : '');
    }

    function moneyOrMissing(value, currencyCode = null, profile = selectedCountryProfile) {
      if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
        return '<span class="missing-badge">غير متوفر حالياً</span>';
      }
      if (!currencyCode) {
        return formatNumber(Number(value)) + ' <span class="confidence low">العملة غير موثقة</span>';
      }
      return window.BondsCountryContext?.formatProvenanceMoney(Number(value), currencyCode, profile) ||
        (formatNumber(Number(value)) + ' ' + currencyCode);
    }

    // Compute a unified investment attractiveness index from available indicators + market data
    function computeAttractiveness(city, indicators, marketItem, evidenceRows = []) {
      const i = indicators || {};
      const m = marketItem || {};
      const verifiedCodes = new Set(
        (evidenceRows || [])
          .filter(row => {
            const scope = String(row.metadata?.scope || 'city').toLowerCase();
            return row.evidence_status === 'verified' && scope === 'city';
          })
          .map(row => row.metric_code)
      );

      const dimensions = [];
      if (Number.isFinite(Number(i.growth_rate)) && verifiedCodes.has('growth_rate')) {
        dimensions.push(['economy', clamp(Number(i.growth_rate) * 8 + 50)]);
      }
      if (Number.isFinite(Number(i.avg_rent_per_sqm)) && verifiedCodes.has('avg_rent_per_sqm')) {
        dimensions.push(['realEstate', clamp(100 - (Number(i.avg_rent_per_sqm) / 300) * 10)]);
      }
      if (Number.isFinite(Number(city.population)) && Number(city.population) > 0 && verifiedCodes.has('population')) {
        dimensions.push(['population', clamp(Number(city.population) / 50000)]);
      }
      if (Number.isFinite(Number(i.business_ease_index)) && verifiedCodes.has('business_ease_index')) {
        dimensions.push(['infrastructure', clamp(Number(i.business_ease_index))]);
      }
      if (Number.isFinite(Number(i.establishments_count)) && verifiedCodes.has('establishments_count')) {
        dimensions.push(['growth', clamp(Number(i.establishments_count) / 1000 + 40)]);
      }

      // Never manufacture a score from defaults. Require at least three independently
      // evidenced dimensions before displaying the internal composite index.
      if (dimensions.length < 3) return null;

      const scores = Object.fromEntries(dimensions);
      let total = dimensions.reduce((sum, [, value]) => sum + value, 0) / dimensions.length;
      if (Number.isFinite(Number(m.opportunity_score)) && verifiedCodes.has('opportunity_score')) {
        total += Number(m.opportunity_score) * 0.15;
      }
      const overall = clamp(total);
      return {
        overall: Math.round(overall),
        economy: scores.economy ?? null,
        realEstate: scores.realEstate ?? null,
        population: scores.population ?? null,
        infrastructure: scores.infrastructure ?? null,
        growth: scores.growth ?? null,
        dimensionCount: dimensions.length,
        label: overall >= 80 ? 'جذابة جداً' : overall >= 60 ? 'جذابة' : overall >= 40 ? 'متوسطة' : 'ضعيفة'
      };
    }

    function clamp(n) { return Math.max(0, Math.min(100, n || 0)); }

    function barColor(score) {
      if (score >= 80) return 'var(--success)';
      if (score >= 60) return 'var(--gold-bright)';
      if (score >= 40) return 'var(--warning)';
      return 'var(--danger)';
    }

    function generateSectorRecommendations(city, indicators, market, evidenceRows = []) {
      const verifiedActivityEvidence = new Set(
        (evidenceRows || [])
          .filter(row => row.evidence_status === 'verified' && row.activity_id)
          .map(row => row.metric_code)
      );
      const marketData = (market.marketData || [])
        .filter(m => m.opportunity_score != null)
        .filter(() => verifiedActivityEvidence.has('opportunity_score'));

      return marketData
        .sort((a, b) => Number(b.opportunity_score || 0) - Number(a.opportunity_score || 0))
        .slice(0, 5)
        .map((m, idx) => ({
          rank: idx + 1,
          name: activityDisplayName(m.economic_activities) || m.activity_id || t('نشاط', 'Activity'),
          reason: 'مرتبة من درجة فرصة مرتبطة ببيانات مصدرية قابلة للتتبع'
        }));
    }

    function renderCountryContext(contextData) {
      const rows = contextData?.metrics || [];
      if (!rows.length) return '';

      const labels = {
        inflation_rate: 'التضخم',
        interest_rate: 'سعر الفائدة',
        economic_growth_rate: 'النمو الاقتصادي',
        unemployment_rate: 'البطالة',
        population_total: 'سكان الدولة',
        gdp_per_capita_usd: 'نصيب الفرد من الناتج المحلي',
        fdi_net_inflows_pct_gdp: 'الاستثمار الأجنبي المباشر'
      };

      const formatContextValue = row => {
        const value = Number(row.value);
        if (!Number.isFinite(value)) return 'غير متاح';
        const unit = String(row.unit || '');
        if (unit === 'person') return formatNumber(value) + ' نسمة';
        if (unit === 'USD') return '$' + Number(value).toLocaleString(LOCALE, { maximumFractionDigits: 0 });
        if (unit === '% GDP') return Number(value).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) + '% من الناتج';
        if (unit === '%') return Number(value).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) + '%';
        return formatNumber(value) + (unit ? ' ' + unit : '');
      };

      const body = rows.map(row => {
        const sourceLink = row.source_url
          ? ' · <a class="map-link" style="padding:.1rem .35rem;font-size:.72rem" href="' + row.source_url + '" target="_blank" rel="noopener">المصدر</a>'
          : '';
        const modeledNote = row.metadata?.modeled_source === true ? ' · تقدير صادر عن المصدر' : '';
        const freshnessNote = row.freshness_status === 'stale'
          ? ' · <strong style="color:#b45309">قديم حسب سياسة الحداثة</strong>'
          : row.freshness_status === 'fresh' ? ' · حديث' : '';
        return '<div class="metric"><span class="metric-label">' + (labels[row.metric] || row.metric) +
          ' <small style="color:var(--text-secondary)">(سياق وطني)</small></span><span class="metric-value">' +
          formatContextValue(row) + '</span></div>' +
          '<div class="evidence-meta">' + (row.source || 'مصدر خارجي') +
          (row.year ? ' · سنة ' + row.year : '') +
          (row.observed_at && !row.year ? ' · الفترة ' + row.observed_at : '') +
          (row.age_days != null ? ' · عمر ' + row.age_days + ' يوم' : '') +
          freshnessNote +
          modeledNote +
          (row.fetched_at ? ' · آخر جلب ' + new Date(row.fetched_at).toLocaleDateString(LOCALE) : '') +
          sourceLink + '</div>';
      }).join('');

      return '<div class="card data-truth-note"><h3>◉ أحدث سياق اقتصادي وطني متاح</h3>' +
        '<p>هذه القيم على مستوى الدولة وليست قيماً خاصة بالمدينة، وتُعرض للسياق فقط. سنة كل مؤشر هي سنة المصدر الفعلية وقد تختلف عن بقية المؤشرات.</p>' +
        body + '</div>';
    }

    function renderEvidence(evidenceData) {
      const rows = evidenceData?.evidence || [];
      if (!rows.length) {
        return '<div class="card data-truth-note"><h3>◉ حالة البيانات</h3><p>لا توجد حالياً أدلة مصدرية مخزنة لهذه المدينة. لن تُعرض درجات أو توصيات تقديرية على أنها حقائق.</p></div>';
      }
      const verified = rows.filter(r => r.evidence_status === 'verified');
      const estimated = rows.filter(r => r.evidence_status === 'estimated');
      const stale = rows.filter(r => r.evidence_status === 'stale');
      const unverified = rows.filter(r => r.evidence_status === 'unverified');
      const latest = rows
        .map(r => r.fetched_at)
        .filter(Boolean)
        .sort()
        .reverse()[0];
      const items = rows.slice(0, 12).map(r => {
        const statusLabel = r.evidence_status === 'verified' ? 'مثبت' : r.evidence_status === 'stale' ? 'قديم' : r.evidence_status === 'estimated' ? 'تقديري' : 'غير مثبت';
        const source = r.source_name || r.source_id || 'مصدر غير مسمى';
        const sourceLink = r.source_url ? '<a class="map-link" style="padding:.15rem .4rem;font-size:.75rem" href="' + r.source_url + '" target="_blank" rel="noopener">المصدر</a>' : '';
        return '<div class="evidence-row"><strong>' + metricLabel(r.metric_code) + '</strong> — ' + statusLabel +
          '<div class="evidence-meta">' + source + ' · سنة ' + (r.year || '—') + ' · ثقة ' + (r.confidence ?? '—') + (r.age_days != null ? ' · عمر البيانات ' + r.age_days + ' يوم' : '') + ' ' + sourceLink + '</div></div>';
      }).join('');
      return '<div class="card data-truth-note"><h3>◉ أدلة ومصادر البيانات</h3>' +
        '<p><strong>' + verified.length + '</strong> مثبت · ' + stale.length + ' قديم · ' + estimated.length + ' تقديري · ' + unverified.length + ' غير مثبت' +
        (latest ? ' · آخر جلب: ' + new Date(latest).toLocaleString(LOCALE) : '') + '</p>' +
        '<div class="evidence-list">' + items + '</div></div>';
    }

    const MODERN_CITY_CODE = /^[A-Z]{2}-\d{2}-\d{3}$/;
    const CITY_ICON = '/assets/icons/city.svg';
    const ACTIVITY_ICON = '/assets/icons/activity.svg';

    async function refreshYearOptions({ countryCode, cityCode = '', activityCode = '', preserve = true } = {}) {
      const select = document.getElementById('yearSelect');
      const current = preserve ? select.value : 'latest';
      const params = new URLSearchParams();
      if (countryCode) params.set('country', countryCode);
      if (cityCode) params.set('city', cityCode);
      if (activityCode) params.set('activity', activityCode);

      try {
        const data = await fetchJson(API_URL + '/catalog/years?' + params.toString());
        const years = data.years || [];
        const latestLabel = localize(data.latest ? ((data.sourceBacked ? 'أحدث سنة مصدرية (' : 'أحدث سنة مسجلة (') + data.latest + ')') : 'أحدث سنة متاحة');
        select.innerHTML = '<option value="latest">' + latestLabel + '</option>' +
          years.map(year => '<option value="' + year + '">' + year + '</option>').join('');

        const nextValue = current !== 'latest' && years.includes(Number(current)) ? current : 'latest';
        select.value = nextValue;

        const dd = window.getUniversalDropdown && window.getUniversalDropdown(select);
        if (dd?.setOptions) {
          dd.setOptions([
            { value: 'latest', label: latestLabel },
            ...years.map(year => ({ value: String(year), label: String(year) }))
          ]);
          if (dd.selectByValue) dd.selectByValue(nextValue);
        }
        return data;
      } catch (err) {
        select.innerHTML = localize('<option value="latest">أحدث سنة متاحة</option>');
        select.value = 'latest';
        return { years: [], latest: null, error: err.message };
      }
    }

    async function init(initialCountry = 'SA') {
      try {
        const [countriesData, activitiesData] = await Promise.all([
          fetchJson(API_URL + '/catalog/countries'),
          fetchJson(API_URL + '/catalog/activities')
        ]);
        activities = activitiesData.activities || [];

        const countrySelect = document.getElementById('countrySelect');
        const cityTypeSelect = document.getElementById('cityTypeSelect');
        const citySelect = document.getElementById('citySelect');
        const activitySelect = document.getElementById('activitySelect');

        const countries = countriesData.countries || [];
        countryProfiles = new Map(countries.map(country => [country.code, country]));
        const totalCatalogCities = countries.reduce((sum, country) => sum + Number(country.cityCount || 0), 0);
        const totalDataCities = countries.reduce((sum, country) => sum + Number(country.dataCityCount || 0), 0);
        const catalogSummary = document.getElementById('catalogSummary');
        if (catalogSummary) {
          catalogSummary.textContent = localize(totalCatalogCities.toLocaleString(LOCALE) +
            ' مدينة في ' + countries.length + ' دولة عربية · ' +
            totalDataCities.toLocaleString(LOCALE) + ' مدينة في السجل التشغيلي · مؤشرات المدينة المصدرية تُعرض فقط عند توفر مصدر وسنة على مستوى المدينة');
        }
        const countryOptions = countries.map(country => ({
          value: country.code,
          label: countryDisplayName(country) + ' (' + country.cityCount + t(' مدينة', ' cities') + ')',
          icon: countryFlags[country.code]
        }));
        countrySelect.innerHTML = localize('<option value="">اختر الدولة</option>') + countries.map(country =>
          `<option value="${country.code}" data-icon="${countryFlags[country.code] || ''}">${countryDisplayName(country)}</option>`
        ).join('');
        countrySelect.value = countries.some(c => c.code === initialCountry) ? initialCountry : 'SA';
        selectedCountryProfile = countryProfiles.get(countrySelect.value) || null;
        const countryDd = window.getUniversalDropdown && window.getUniversalDropdown(countrySelect);
        if (countryDd?.setOptions) {
          countryDd.setOptions(countryOptions);
          if (countryDd.selectByValue) countryDd.selectByValue(countrySelect.value);
        }

        async function loadActivities() {
          const selectedCountry = countrySelect.value;
          const url = selectedCountry
            ? API_URL + '/catalog/activities?country=' + encodeURIComponent(selectedCountry)
            : API_URL + '/catalog/activities';
          const data = await fetchJson(url);
          activities = (data.activities || [])
            .filter(activity => activity.country?.availability_status !== 'unavailable');

          activitySelect.innerHTML = localize('<option value="">اختر النشاط (اختياري)</option>') + activities.map(a =>
            `<option value="${a.code}" data-icon="${ACTIVITY_ICON}">${activityDisplayName(a)}</option>`
          ).join('');
          const activityDd = window.getUniversalDropdown && window.getUniversalDropdown(activitySelect);
          if (activityDd?.setOptions) {
            activityDd.setOptions(activities.map(a => ({
              value: a.code,
              label: window.BondsCountryContext?.formatActivityLabel(a, IS_EN ? 'en' : 'ar') || activityDisplayName(a),
              icon: ACTIVITY_ICON
            })));
          }
        }

        function populateCities() {
          citySelect.innerHTML = localize('<option value="">اختر المدينة</option>') + cities.map(c =>
            `<option value="${c.code}" data-icon="${CITY_ICON}">${cityDisplayName(c)}</option>`
          ).join('');
          const cityDd = window.getUniversalDropdown && window.getUniversalDropdown(citySelect);
          if (cityDd?.setOptions) {
            cityDd.setOptions(cities.map(c => ({
              value: c.code,
              label: cityDisplayName(c) + (c.data_available ? '' : t(' · كتالوج', ' · catalog')),
              icon: CITY_ICON
            })));
          }
        }

        async function loadCities() {
          const selectedCountry = countrySelect.value || 'SA';
          const selectedType = cityTypeSelect.value;
          let data;
          if (selectedType) {
            const url = API_URL + '/cities?limit=2000&country=' + encodeURIComponent(selectedCountry) +
              '&city_type=' + encodeURIComponent(selectedType);
            data = await fetchJson(url);
            cities = (data.cities || []).map(city => ({ ...city, data_available: true }));
          } else {
            data = await fetchJson(API_URL + '/catalog/cities?country=' + encodeURIComponent(selectedCountry));
            cities = data.cities || [];
          }
          populateCities();
          const coverageEl = document.getElementById('catalogSummary');
          if (coverageEl && cities.length) {
            const withPop = cities.filter(city => Number(city.population) > 0).length;
            const withCoords = cities.filter(city => city.lat != null && city.lng != null).length;
            const countryLabel = countryNames[selectedCountry] || selectedCountry;
            coverageEl.textContent = localize(cities.length.toLocaleString(LOCALE) +
              ' مدينة في ' + countryLabel +
              ' · ' + withPop.toLocaleString(LOCALE) + ' بعدد سكان' +
              ' · ' + withCoords.toLocaleString(LOCALE) + ' بإحداثيات' +
              ' · السياق الوطني يُعرض عند غياب مؤشر مصدري للمدينة');
          }
        }

        await loadCities();
        await refreshYearOptions({ countryCode: countrySelect.value, preserve: false });

        await loadActivities();

        countrySelect.addEventListener('change', async () => {
          selectedCountryProfile = countryProfiles.get(countrySelect.value) || null;
          window.BondsCountryContext?.setSelected(countrySelect.value, {
            currency_code: selectedCountryProfile?.currency_code || null,
            currency_symbol: selectedCountryProfile?.currency_symbol || null
          });
          citySelect.value = '';
          activitySelect.value = '';
          await Promise.all([loadCities(), loadActivities()]);
          await refreshYearOptions({ countryCode: countrySelect.value, preserve: false });
          document.getElementById('content').innerHTML = localize('<div class="loading">اختر مدينة لعرض المؤشرات</div>');
        });
        cityTypeSelect.addEventListener('change', async () => {
          await loadCities();
          await refreshYearOptions({ countryCode: countrySelect.value, preserve: false });
        });
        citySelect.addEventListener('change', async () => {
          await refreshYearOptions({
            countryCode: countrySelect.value,
            cityCode: citySelect.value,
            activityCode: activitySelect.value,
            preserve: false
          });
          await loadCityData();
        });
        activitySelect.addEventListener('change', async () => {
          await refreshYearOptions({
            countryCode: countrySelect.value,
            cityCode: citySelect.value,
            activityCode: activitySelect.value,
            preserve: true
          });
          await loadCityData();
        });
        document.getElementById('yearSelect').addEventListener('change', loadCityData);
      } catch (err) {
        document.getElementById('content').innerHTML = localize(`<div class="error">فشل تحميل الكتالوج: ${err.message}</div>`);
      }
    }

    async function loadCityData() {
      const cityCode = document.getElementById('citySelect').value;
      const activityCode = document.getElementById('activitySelect').value;
      const year = document.getElementById('yearSelect').value;
      const content = document.getElementById('content');

      if (typeof BondsAIChat !== 'undefined' && BondsAIChat.updateContext) {
        BondsAIChat.updateContext({ cityCode, activityCode });
      }
      if (!cityCode) {
        content.innerHTML = localize('<div class="loading">اختر مدينة لعرض المؤشرات</div>');
        return;
      }

      const catalogCity = cities.find(city => city.code === cityCode);
      if (catalogCity && catalogCity.data_available === false) {
        let contextData = { metrics: [] };
        try {
          const selectedYear = document.getElementById('yearSelect').value || 'latest';
          contextData = await fetchJson(`${API_URL}/countries/${encodeURIComponent(catalogCity.country_code)}/context?year=${encodeURIComponent(selectedYear)}`);
        } catch (_) {}
        content.innerHTML = localize(
          '<div class="grid">' +
          '<div class="card data-truth-note"><h3>⌖ ' + cityDisplayName(catalogCity) + '</h3>' +
          '<div class="metric"><span class="metric-label">' + t('الدولة', 'Country') + '</span><span class="metric-value">' + (countryNames[catalogCity.country_code] || catalogCity.country_code) + '</span></div>' +
          '<div class="metric"><span class="metric-label">' + t('المنطقة', 'Region') + '</span><span class="metric-value">' + (catalogCity.region || '—') + '</span></div>' +
          '<p><strong>لا توجد حالياً بيانات كمية موثقة على مستوى هذه المدينة.</strong></p>' +
          '<p>لن يعرض النظام قيماً مصطنعة. عند توفر بيانات خارجية على مستوى الدولة ستظهر أدناه كسياق وطني واضح.</p></div>' +
          renderCountryContext(contextData) +
          '</div>');
        return;
      }

      content.innerHTML = localize('<div class="loading">جاري تحميل المؤشرات والمصادر...</div>');
      try {
        const [detail, indicators, market, evidence, countryContext] = await Promise.all([
          fetchJson(`${API_URL}/cities/${cityCode}?year=${encodeURIComponent(year)}`),
          fetchJson(`${API_URL}/cities/${cityCode}/indicators?year=${encodeURIComponent(year)}`),
          activityCode
            ? fetchJson(`${API_URL}/cities/${cityCode}/market?activity=${encodeURIComponent(activityCode)}&year=${encodeURIComponent(year)}`)
            : Promise.resolve({ marketData: [], year }),
          fetchJson(`${API_URL}/cities/${cityCode}/evidence?year=${encodeURIComponent(year)}${activityCode ? '&activity=' + encodeURIComponent(activityCode) : ''}`),
          fetchJson(`${API_URL}/countries/${encodeURIComponent(catalogCity?.country_code || document.getElementById('countrySelect').value || 'SA')}/context?year=${encodeURIComponent(year)}`).catch(() => ({ metrics: [] }))
        ]);
        renderCity(cityCode, detail, indicators, market, evidence, countryContext);
        await updateScenarioCard(activityCode);
        if (!liveFetchedCities.has(cityCode) &&
            [detail, indicators, market].some(payload => payload?.dataStatus === 'no_source_backed_city_data')) {
          await refreshLiveCitySources({ cityCode, silent: true });
        }
      } catch (err) {
        content.innerHTML = localize(`<div class="error">فشل تحميل بيانات المدينة: ${err.message}</div>`);
      }
    }

    function renderCity(cityCode, detail, indicatorsData, marketData, evidenceData = {}, countryContext = {}) {
      const city = detail.city;
      const indicators = indicatorsData.indicators || {};
      const market = marketData.marketData || [];
      const marketItem = market[0] || {};
      const dataYear = detail.year || indicatorsData.year || marketData.year || document.getElementById('yearSelect').value;
      const evidenceRows = evidenceData.evidence || [];
      const evidenceByMetric = new Map();
      for (const row of evidenceRows) {
        if (!evidenceByMetric.has(row.metric_code)) evidenceByMetric.set(row.metric_code, row);
      }
      const activeCountryProfile = countryContext?.country?.currency_code
        ? countryContext.country
        : (countryProfiles.get(city.country_code) || selectedCountryProfile);
      selectedCountryProfile = activeCountryProfile || selectedCountryProfile;

      const evidenceDecorated = (metricCode, formatted) => {
        const evidence = evidenceByMetric.get(metricCode);
        if (evidence?.evidence_status === 'verified') {
          return formatted + ' <span class="confidence high">مثبت</span>';
        }
        if (evidence?.evidence_status === 'estimated') {
          return formatted + ' <span class="confidence medium">تقديري</span>';
        }
        return formatted + ' <span class="confidence low">غير مثبت</span>';
      };

      const truthValue = (metricCode, value, suffix = '') => {
        if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
          return valueOrMissing(null);
        }
        return evidenceDecorated(metricCode, formatNumber(Number(value)) + (suffix ? ' ' + suffix : ''));
      };

      const moneyTruthValue = (metricCode, value, currencyCode = null) => {
        if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
          return valueOrMissing(null);
        }
        return evidenceDecorated(metricCode, moneyOrMissing(value, currencyCode, activeCountryProfile));
      };
      const modeledMarket = /model|weighted|estimate|inference/i.test(String(marketItem.source || ''));
      const attractiveness = computeAttractiveness(city, indicators, marketItem, evidenceRows);
      const recommendations = generateSectorRecommendations(city, indicators, marketData, evidenceRows);
      const noSourceBacked = [detail, indicatorsData, marketData].some(payload => payload?.dataStatus === 'no_source_backed_city_data');
      const legacyYear = detail.legacyAvailableYear || indicatorsData.legacyAvailableYear || marketData.legacyAvailableYear;
      const cityTypes = Array.isArray(city.city_types) ? city.city_types.filter(Boolean) : [];
      const coordLabel = (city.lat != null && city.lng != null)
        ? Number(city.lat).toFixed(4) + ' ، ' + Number(city.lng).toFixed(4)
        : '';
      const nationalGdp = countryContextMetric(countryContext, ['gdp_per_capita_usd']);

      const html = `
        <div class="grid">
          ${noSourceBacked ? `
          <div class="card data-truth-note">
            <h3>لا توجد مؤشرات مصدرية مثبتة لهذه المدينة في أحدث سنة</h3>
            <p><strong>النظام لا يعرض أرقاماً مصطنعة.</strong> الكتالوج والسكان والسياق الوطني متاحان، لكن مؤشرات المدينة وبيانات السوق الموثّقة غير موجودة بعد.</p>
            ${legacyYear ? '<p>توجد سجلات داخلية غير مثبتة لسنة ' + legacyYear + '. يمكن اختيارها من قائمة السنة لمراجعتها كقيم تقديرية، وليست قراءة مصدرية.</p>' : ''}
          </div>` : ''}
          ${attractiveness ? `
          <div class="card attractiveness-card">
            <div class="attractiveness-header">
              <div>
                <h3 style="margin-bottom:0.25rem;">◎ مؤشر جاذبية الاستثمار — ${cityDisplayName(city)}</h3>
                <p style="margin:0;color:var(--text-secondary);font-size:.9rem;">
                  مؤشر تحليلي داخلي محسوب فقط من ${attractiveness.dimensionCount} أبعاد لها أدلة مصدرية مثبتة، وليس رقماً رسمياً.
                </p>
              </div>
              <div class="attractiveness-score">
                <div class="score-number">${attractiveness.overall}<span style="font-size:1.2rem;color:var(--text-secondary);">/100</span></div>
                <div class="score-label">${attractiveness.label}</div>
              </div>
            </div>
            <div class="attractiveness-bars" style="margin-top:1.25rem;">
              ${attractiveness.economy != null ? renderAttrBar(t('الاقتصاد', 'Economy'), attractiveness.economy) : ''}
              ${attractiveness.realEstate != null ? renderAttrBar('العقار والتكاليف التشغيلية', attractiveness.realEstate) : ''}
              ${attractiveness.population != null ? renderAttrBar('السكان والقوة الشرائية', attractiveness.population) : ''}
              ${attractiveness.infrastructure != null ? renderAttrBar('البنية التحتية وسهولة الأعمال', attractiveness.infrastructure) : ''}
              ${attractiveness.growth != null ? renderAttrBar('النمو والتوسع', attractiveness.growth) : ''}
            </div>
          </div>` : `
          <div class="card data-truth-note">
            <h3>◎ مؤشر جاذبية الاستثمار</h3>
            <p><strong>غير متاح حالياً.</strong> لا توجد ثلاثة أبعاد مستقلة على الأقل بأدلة مصدرية مثبتة. تم إيقاف احتساب الدرجة من القيم الافتراضية.</p>
          </div>`}
          <div class="card">
            <h3>⌖ معلومات المدينة</h3>
            <div class="metric"><span class="metric-label">${t('المدينة', 'City')}</span><span class="metric-value">${cityDisplayName(city)}${city.name_en && city.name_en !== city.name_ar ? ' · ' + city.name_en : ''}</span></div>
            <div class="metric"><span class="metric-label">${t('السكان', 'Population')}</span><span class="metric-value">${cityOrNational('population', null, t('نسمة', 'people'), countryContext, evidenceRows) || (Number(city.population) > 0 ? truthValue('population', city.population, t('نسمة', 'people')) : valueOrMissing(null))}</span></div>
            ${city.population_source ? '<div class="evidence-meta">مصدر السكان: ' + city.population_source + '</div>' : ''}
            <div class="metric"><span class="metric-label">${t('الدولة', 'Country')}</span><span class="metric-value">${countryNames[city.country_code] || city.country_code || '-'}</span></div>
            <div class="metric"><span class="metric-label">${t('المنطقة', 'Region')}</span><span class="metric-value">${city.region || city.admin_level_2 || '-'}</span></div>
            ${coordLabel ? '<div class="metric"><span class="metric-label">' + t('الإحداثيات', 'Coordinates') + '</span><span class="metric-value">' + coordLabel + '</span></div>' : ''}
            ${cityTypes.length ? '<div class="metric"><span class="metric-label">تصنيف المدينة</span><span class="metric-value">' + cityTypes.join(t('، ', ', ')) + '</span></div>' : ''}
            <div class="metric"><span class="metric-label">مؤشر القوة الشرائية</span><span class="metric-value">${cityOrNational('purchasing_power_index', null, '', countryContext, evidenceRows) || valueOrMissing(null)}</span></div>
          </div>

          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0;">▤ المؤشرات الاقتصادية ${dataYear && dataYear !== 'latest' ? '(' + dataYear + ')' : ''} ${confidenceBadge(indicators.overall_confidence)}</h3>
              <button class="feedback-btn" onclick="openFeedbackForm('', '', 'population', ${city.population || 'null'})">✏️ صحّح البيانات</button>
            </div>
            <p class="evidence-meta">القيم الخاصة بالمدينة تُعرض فقط من مصدر مدينة. إذا غابت، يظهر السياق الوطني بوسم واضح وليس كرقم للمدينة.</p>
            <div class="metric"><span class="metric-label">الناتج المحلي للمدينة</span><span class="metric-value">${moneyTruthValue('gdp_city', indicators.gdp_city, indicators.currency_code)}</span></div>
            ${nationalGdp && Number.isFinite(Number(nationalGdp.value)) ? '<div class="metric"><span class="metric-label">نصيب الفرد من الناتج</span><span class="metric-value">$' + Number(nationalGdp.value).toLocaleString(LOCALE, { maximumFractionDigits: 0 }) + ' <span class="confidence medium">سياق وطني ' + (nationalGdp.year || '') + '</span></span></div>' : ''}
            <div class="metric"><span class="metric-label">معدل النمو الاقتصادي</span><span class="metric-value">${cityOrNational('growth_rate', indicators.growth_rate, '%', countryContext, evidenceRows) || truthValue('growth_rate', indicators.growth_rate, '%')}</span></div>
            <div class="metric"><span class="metric-label">معدل البطالة</span><span class="metric-value">${cityOrNational('unemployment_rate', indicators.unemployment_rate, '%', countryContext, evidenceRows) || truthValue('unemployment_rate', indicators.unemployment_rate, '%')}</span></div>
            <div class="metric"><span class="metric-label">عدد المنشآت</span><span class="metric-value">${truthValue('establishments_count', indicators.establishments_count)}</span></div>
            <div class="metric"><span class="metric-label">معدل التضخم</span><span class="metric-value">${cityOrNational('inflation_rate', indicators.inflation_rate, '%', countryContext, evidenceRows) || truthValue('inflation_rate', indicators.inflation_rate, '%')}</span></div>
          </div>

          <div class="card">
            <h3>▥ المؤشرات العقارية</h3>
            <div class="metric"><span class="metric-label">متوسط الإيجار / م²</span><span class="metric-value">${moneyTruthValue('avg_rent_per_sqm', indicators.avg_rent_per_sqm, indicators.currency_code)}</span></div>
            <div class="metric"><span class="metric-label">متوسط سعر الأرض / م²</span><span class="metric-value">${moneyTruthValue('avg_land_price_per_sqm', indicators.avg_land_price_per_sqm, indicators.currency_code)}</span></div>
            <div class="metric"><span class="metric-label">إيجار المستودعات / م²</span><span class="metric-value">${moneyTruthValue('warehouse_rent_per_sqm', indicators.warehouse_rent_per_sqm, indicators.currency_code)}</span></div>
            <div class="metric"><span class="metric-label">إيجار المصانع / م²</span><span class="metric-value">${moneyTruthValue('factory_rent_per_sqm', indicators.factory_rent_per_sqm, indicators.currency_code)}</span></div>
          </div>

          <!-- Sector Recommendations -->
          <div class="card">
            <h3>✦ توصيات قطاعية في ${cityDisplayName(city)}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: -0.5rem;">
              أفضل القطاعات الاستثمارية بناءً على البيانات المتاحة.
            </p>
            <ul class="recommendations-list">
${recommendations.length ? recommendations.map(r => `
                <li>
                  <span class="rec-rank">${r.rank}</span>
                  <div>
                    <div style="font-weight:700;">${r.name}</div>
                    <div style="font-size:.8rem;color:var(--text-secondary);">${r.reason}</div>
                  </div>
                </li>
              `).join('') : '<li><div><strong>لا توجد توصيات قطاعية مثبتة لهذه المدينة/النشاط حالياً.</strong><div style="font-size:.8rem;color:var(--text-secondary);">لن يتم توليد توصيات افتراضية عند غياب بيانات سوق موثقة.</div></div></li>'}
            </ul>
          </div>

          ${marketItem.activity_id ? `
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0;">◎ بيانات السوق — ${activityDisplayName(marketItem.economic_activities) || ''} ${confidenceBadge(marketItem.confidence)}</h3>
              <button class="feedback-btn" onclick="openFeedbackForm('${marketItem.economic_activities?.code || ''}', '${marketItem.economic_activities?.name_ar || ''}', 'market_size', ${marketItem.market_size || 'null'})">✏️ صحّح البيانات</button>
            </div>
            <div class="metric"><span class="metric-label">حجم السوق</span><span class="metric-value">${moneyOrMissing(marketItem.market_size, marketItem.currency_code, activeCountryProfile)}</span></div>
            <div class="metric"><span class="metric-label">عدد المنافسين</span><span class="metric-value">${valueOrMissing(marketItem.competitors_count)}</span></div>
            <div class="metric"><span class="metric-label">مؤشر التشبع</span><span class="metric-value">${valueOrMissing(marketItem.market_saturation_score, '%')}</span></div>
            <div class="metric"><span class="metric-label">متوسط الراتب</span><span class="metric-value">${moneyOrMissing(marketItem.avg_salary, marketItem.currency_code, activeCountryProfile)}</span></div>
            <div class="metric"><span class="metric-label">الطلب المتوقع</span><span class="metric-value">${marketItem.expected_demand === 'high' ? t('مرتفع', 'High') : marketItem.expected_demand === 'low' ? t('منخفض', 'Low') : marketItem.expected_demand ? t('متوسط', 'Medium') : valueOrMissing(null)}</span></div>
            <div class="metric"><span class="metric-label">${t('المصدر', 'Source')}</span><span class="metric-value">${marketItem.source || t('تقدير', 'Estimate')}</span></div>
            ${modeledMarket ? '<p class="evidence-meta"><strong>تنبيه:</strong> هذه القيم ناتجة عن نموذج داخلي وليست قراءة سوق حية مباشرة.</p>' : ''}
          </div>

          <div class="card">
            <h3>🌟 مؤشر فرصة داخلي</h3><p class="evidence-meta">درجة تحليلية وليست حقيقة رسمية؛ تُستخدم للمقارنة فقط وتُقيّم وفق مصدر البيانات أعلاه.</p>
            <div class="metric">
              <span class="metric-label">${t('الدرجة', 'Score')}</span>
              <span class="metric-value">
                ${marketItem.opportunity_score !== null && marketItem.opportunity_score !== undefined ? marketItem.opportunity_score.toFixed(1) : '-'}
                ${marketItem.opportunity_score !== null && marketItem.opportunity_score !== undefined ? opportunityBadge(marketItem.opportunity_score) : ''}
              </span>
            </div>
            ${marketItem.opportunity_score !== null && marketItem.opportunity_score !== undefined ? `
            <div class="score-bar"><div class="score-fill" style="width: ${Math.min(marketItem.opportunity_score, 100)}%; background: ${opportunityColor(marketItem.opportunity_score)};"></div></div>
            <div class="metric"><span class="metric-label">${t('الترتيب', 'Rank')}</span><span class="metric-value">${marketItem.opportunity_rank || '-'}</span></div>
            ` : '<div class="metric"><span class="metric-label">غير متوفر</span><span class="metric-value">اختر نشاطاً</span></div>'}
          </div>
          ` : ''}
          ${renderCountryContext(countryContext)}
          ${renderEvidence(evidenceData)}
        </div>
      `;

      document.getElementById('content').innerHTML = localize(html);
    }

    function renderAttrBar(label, score) {
      return `
        <div class="attr-bar">
          <div class="attr-bar-header">
            <span>${label}</span>
            <span style="font-weight: 700;">${score}/100</span>
          </div>
          <div class="attr-bar-track">
            <div class="attr-bar-fill" style="width: ${score}%; background: ${barColor(score)};"></div>
          </div>
        </div>
      `;
    }

    let currentScenarioModel = null;

    async function updateScenarioCard(activityCode) {
      const card = document.getElementById('scenarioCard');
      const presetsEl = document.getElementById('scenarioPresets');
      const resultsEl = document.getElementById('scenarioResults');
      const modelNameEl = document.getElementById('scenarioModelName');

      if (!activityCode) {
        card.classList.add('hidden');
        return;
      }

      try {
        const res = await fetchJson(`${API_URL}/models?activity=${activityCode}`);
        const model = (res.models || [])[0];
        if (!model) {
          card.classList.add('hidden');
          return;
        }
        currentScenarioModel = model;
        modelNameEl.textContent = IS_EN ? (model.name_en || model.name_ar) : (model.name_ar || model.name_en);
        presetsEl.innerHTML = '';
        const presets = [
          { key: 'recession', label: t('▽ ركود', '▽ Recession') },
          { key: 'high_inflation', label: t('🔥 تضخم', '🔥 Inflation') },
          { key: 'labor_shortage', label: t('👷 نقص عمالة', '👷 Labor shortage') },
          { key: 'sales_drop', label: t('📦 انخفاض مبيعات', '📦 Sales drop') }
        ];
        presets.forEach(p => {
          const btn = document.createElement('button');
          btn.className = 'scenario-btn';
          btn.textContent = localize(p.label);
          btn.addEventListener('click', () => runQuickScenario(p.key));
          presetsEl.appendChild(btn);
        });
        resultsEl.innerHTML = '';
        card.classList.remove('hidden');
      } catch (err) {
        console.warn('Scenario card failed:', err.message);
        card.classList.add('hidden');
      }
    }

    async function runQuickScenario(preset) {
      const cityCode = document.getElementById('citySelect').value;
      if (!currentScenarioModel) return;
      const resultsEl = document.getElementById('scenarioResults');
      resultsEl.innerHTML = localize('<p style="color: var(--text-secondary);">جاري الحساب...</p>');

      try {
        const payload = {
          projectModelCode: currentScenarioModel.code,
          scenarios: [{ name: t('سيناريو', 'Scenario'), preset }]
        };
        if (cityCode) payload.cityCode = cityCode;
        const res = await fetchJson(API_URL + '/calculate/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const baseline = res.baseline;
        const scenario = res.scenarios[0];
        resultsEl.innerHTML = localize(`
          <table class="scenario-table">
            <thead>
              <tr><th>${t('المؤشر', 'Indicator')}</th><th>${t('الوضع الأساسي', 'Baseline')}</th><th>${t('السيناريو', 'Scenario')}</th><th>${t('التأثير', 'Impact')}</th></tr>
            </thead>
            <tbody>
              <tr><td>NPV</td><td>${formatNumber(baseline.summary.npv)}</td><td>${formatNumber(scenario.result.summary.npv)}</td><td>${formatNumber(scenario.comparison.deltaNpv)}</td></tr>
              <tr><td>IRR</td><td>${baseline.summary.irr !== null ? baseline.summary.irr.toFixed(2) + '%' : '-'}</td><td>${scenario.result.summary.irr !== null ? scenario.result.summary.irr.toFixed(2) + '%' : '-'}</td><td>${scenario.comparison.deltaIrr.toFixed(2)}%</td></tr>
              <tr><td>${t('فترة الاسترداد (شهر)', 'Payback (months)')}</td><td>${baseline.summary.paybackMonths !== null ? baseline.summary.paybackMonths.toFixed(1) : '-'}</td><td>${scenario.result.summary.paybackMonths !== null ? scenario.result.summary.paybackMonths.toFixed(1) : '-'}</td><td>${scenario.comparison.deltaPaybackMonths.toFixed(1)}</td></tr>
              <tr><td>${t('مؤشر المخاطر', 'Risk index')}</td><td>${baseline.risk.score}</td><td>${scenario.result.risk.score}</td><td>${scenario.comparison.deltaRiskScore}</td></tr>
            </tbody>
          </table>
        `);
      } catch (err) {
        resultsEl.innerHTML = localize(`<p class="error">فشل التحليل: ${err.message}</p>`);
      }
    }

    async function loadAlerts() {
      try {
        const data = await fetchJson(API_URL + '/alerts?unread_only=true&limit=10');
        const alerts = data.alerts || [];
        const countEl = document.getElementById('alertCount');
        const listEl = document.getElementById('alertList');

        if (alerts.length) {
          countEl.textContent = alerts.length;
          countEl.classList.remove('hidden');
          listEl.innerHTML = localize(alerts.map(a => `
            <div class="alert-item">
              <strong>${severityIcon(a.severity)} ${metricLabel(a.metric_code)}</strong>
              <p style="margin: 0.25rem 0;">${a.message}</p>
              <small style="color: var(--text-secondary);">${t('تم الاكتشاف: ', 'Detected: ')}${formatDate(a.created_at)}</small>
            </div>
          `).join(''));
        } else {
          countEl.classList.add('hidden');
          listEl.innerHTML = localize('<p style="color: var(--text-secondary);">لا توجد إنذارات غير مقروءة</p>');
        }
      } catch (err) {
        console.warn('Alerts load failed:', err.message);
      }
    }

    function severityIcon(severity) {
      if (severity === 'critical') return '!!';
      if (severity === 'warning') return '!';
      return 'i';
    }

    function formatDate(iso) {
      if (!iso) return '-';
      const d = new Date(iso);
      return d.toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
    }

    document.getElementById('alertBell').addEventListener('click', () => {
      const dropdown = document.getElementById('alertDropdown');
      dropdown.classList.toggle('hidden');
      if (!dropdown.classList.contains('hidden')) loadAlerts();
    });

    async function refreshLiveCitySources({ cityCode, force = false, silent = false } = {}) {
      const code = cityCode || document.getElementById('citySelect').value;
      const btn = document.getElementById('autoUpdateBtn');
      if (!code) {
        if (!silent) alert(t('اختر مدينة أولاً', 'Select a city first'));
        return null;
      }

      liveFetchedCities.add(code);
      if (btn) {
        btn.disabled = true;
        btn.textContent = t('جاري الجلب الحي...', 'Fetching live sources...');
      }

      try {
        const res = await fetchJson(API_URL + '/data/live-refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityCode: code, force })
        });

        if (btn) {
          btn.textContent = t(res.cached ? 'محدّث من المصدر' : 'تم الجلب الحي', res.cached ? 'Updated from source' : 'Live fetch complete');
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = t('جلب حي من المصادر', 'Fetch live from sources');
          }, 2000);
        }

        await refreshYearOptions({
          countryCode: document.getElementById('countrySelect').value,
          cityCode: code,
          activityCode: document.getElementById('activitySelect').value,
          preserve: false
        });
        await loadCityData();
        return res;
      } catch (err) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = t('جلب حي من المصادر', 'Fetch live from sources');
        }
        if (!silent) alert(t('فشل الجلب الحي: ', 'Live fetch failed: ') + err.message);
        return null;
      }
    }

    document.getElementById('autoUpdateBtn').addEventListener('click', () => {
      refreshLiveCitySources({ force: true });
    });

    // Feedback form logic
    const metricLabels = {
      population: 'عدد السكان',
      gdp_city: 'الناتج المحلي للمدينة',
      growth_rate: 'معدل النمو الاقتصادي',
      unemployment_rate: 'معدل البطالة',
      inflation_rate: 'معدل التضخم',
      avg_rent_per_sqm: 'متوسط الإيجار / م²',
      market_size: 'حجم السوق',
      competitors_count: 'عدد المنافسين',
      market_saturation_score: 'مؤشر التشبع',
      avg_salary: 'متوسط الراتب'
    };

    function openFeedbackForm(activityCode, activityName, metricCode, currentValue) {
      const citySelect = document.getElementById('citySelect');
      const cityCode = citySelect.value;
      const cityName = citySelect.options[citySelect.selectedIndex]?.text || '';
      if (!cityCode) return alert(t('اختر مدينة أولاً', 'Select a city first'));

      document.getElementById('fbCityCode').value = cityCode;
      document.getElementById('fbCityName').value = cityName;
      document.getElementById('fbActivityCode').value = activityCode || '';
      document.getElementById('fbActivityName').value = activityName || t('مؤشرات عامة', 'General indicators');
      document.getElementById('fbMetricCode').value = metricCode;
      document.getElementById('fbMetricName').value = localize(metricLabels[metricCode] || metricCode);
      document.getElementById('fbCurrentValue').value = currentValue != null ? currentValue : t('غير متوفر', 'Unavailable');
      document.getElementById('fbSuggestedValue').value = '';
      document.getElementById('fbReason').value = '';
      document.getElementById('feedbackModal').classList.add('open');
    }

    function closeFeedbackForm() {
      document.getElementById('feedbackModal').classList.remove('open');
    }

    document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        city_code: document.getElementById('fbCityCode').value,
        activity_code: document.getElementById('fbActivityCode').value || undefined,
        metric_code: document.getElementById('fbMetricCode').value,
        current_value: [t('غير متوفر', 'Unavailable'), 'غير متوفر'].includes(document.getElementById('fbCurrentValue').value) ? null : Number(document.getElementById('fbCurrentValue').value),
        suggested_value: Number(document.getElementById('fbSuggestedValue').value),
        reason: document.getElementById('fbReason').value
      };
      try {
        const res = await fetchJson(API_URL + '/data/feedback/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        alert(res.message || t('تم إرسال التصحيح، شكراً لك!', 'Correction submitted. Thank you.'));
        closeFeedbackForm();
      } catch (err) {
        alert(t('فشل الإرسال: ', 'Submit failed: ') + err.message);
      }
    });

    function startLiveYearRefresh() {
      const intervalMs = 5 * 60 * 1000;
      window.setInterval(async () => {
        if (document.hidden) return;
        const countryCode = document.getElementById('countrySelect').value;
        const cityCode = document.getElementById('citySelect').value;
        const activityCode = document.getElementById('activitySelect').value;
        const yearSelect = document.getElementById('yearSelect');
        const wasLatest = yearSelect.value === 'latest';

        await refreshYearOptions({
          countryCode,
          cityCode,
          activityCode,
          preserve: true
        });

        if (wasLatest && cityCode) {
          await loadCityData();
        }
      }, intervalMs);
    }

    async function boot() {
      const params = new URLSearchParams(window.location.search);
      const preselectCity = params.get('city') || params.get('locality');
      const preselectActivity = params.get('activity');

      const requestedCountry = (params.get('country') || '').toUpperCase();
      const inferredCountry = requestedCountry ||
        (preselectCity && /^[A-Z]{2}-/.test(preselectCity) ? preselectCity.slice(0, 2) : '') ||
        window.BondsCountryContext?.getSelected('SA') ||
        'SA';
      await init(inferredCountry);
      window.BondsCountryContext?.setSelected(document.getElementById('countrySelect').value);

      if (preselectCity) {
        const citySelect = document.getElementById('citySelect');
        if ([...citySelect.options].some(o => o.value === preselectCity)) {
          citySelect.value = preselectCity;
          const cityDd = window.getUniversalDropdown && window.getUniversalDropdown(citySelect);
          if (cityDd) cityDd.value = preselectCity;
        }
      }
      if (preselectActivity) {
        const activitySelect = document.getElementById('activitySelect');
        if ([...activitySelect.options].some(o => o.value === preselectActivity)) {
          activitySelect.value = preselectActivity;
          const activityDd = window.getUniversalDropdown && window.getUniversalDropdown(activitySelect);
          if (activityDd) activityDd.value = preselectActivity;
        }
      }
      if (preselectCity || preselectActivity) {
        await refreshYearOptions({
          countryCode: document.getElementById('countrySelect').value,
          cityCode: document.getElementById('citySelect').value,
          activityCode: document.getElementById('activitySelect').value,
          preserve: false
        });
        await loadCityData();
      }

      if (typeof BondsAIChat !== 'undefined') {
        BondsAIChat.mount({
          cityCode: document.getElementById('citySelect').value || preselectCity || null,
          activityCode: document.getElementById('activitySelect').value || preselectActivity || null
        });
      }

      loadAlerts();
      startLiveYearRefresh();
    }

    boot();

    window.openFeedbackForm = openFeedbackForm;
    window.closeFeedbackForm = closeFeedbackForm;
