(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.BondsCreditConsentTerminology=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  const COUNTRIES=[
    ['SA','السعودية','Saudi Arabia','نموذج الموافقة على الاستعلام الائتماني','Credit Information Inquiry Consent'],
    ['AE','الإمارات العربية المتحدة','United Arab Emirates','نموذج الموافقة على الاستعلام الائتماني','Credit Report / Inquiry Consent'],
    ['BH','البحرين','Bahrain','نموذج الموافقة على الاستعلام الائتماني','Credit Reference Consent'],
    ['KW','الكويت','Kuwait','نموذج الموافقة على الاستعلام الائتماني','Credit Information Consent'],
    ['QA','قطر','Qatar','نموذج الموافقة على الاستعلام الائتماني','Credit Information Consent'],
    ['OM','عُمان','Oman','نموذج الموافقة على المعلومات الائتمانية والمالية','Credit & Financial Information Consent'],
    ['EG','مصر','Egypt','نموذج الموافقة على الاستعلام الائتماني','Credit Bureau Inquiry Consent'],
    ['JO','الأردن','Jordan','نموذج الموافقة على الاستعلام الائتماني','Credit Information Inquiry Consent'],
    ['US','الولايات المتحدة','United States','نموذج تفويض فحص السجل الائتماني','Credit Report Authorization'],
    ['GB','المملكة المتحدة','United Kingdom','نموذج الموافقة على الفحص الائتماني','Credit Check Consent'],
    ['CA','كندا','Canada','نموذج الموافقة على الفحص الائتماني','Credit Check Consent'],
    ['AU','أستراليا','Australia','نموذج الموافقة على فحص المعلومات الائتمانية','Credit Information Check Consent'],
    ['DE','ألمانيا','Germany','نموذج الموافقة على التحقق الائتماني','Creditworthiness Check Consent'],
    ['FR','فرنسا','France','نموذج الموافقة على التحقق الائتماني','Credit Information Consent'],
    ['IN','الهند','India','نموذج الموافقة على الاستعلام الائتماني','Credit Information Consent'],
    ['PK','باكستان','Pakistan','نموذج الموافقة على الاستعلام الائتماني','Credit Information Consent'],
    ['SG','سنغافورة','Singapore','نموذج الموافقة على الفحص الائتماني','Credit Check Consent'],
    ['MY','ماليزيا','Malaysia','نموذج الموافقة على الفحص الائتماني','Credit Check Consent'],
    ['ZA','جنوب أفريقيا','South Africa','نموذج الموافقة على الفحص الائتماني','Credit Check Consent']
  ];

  function byCode(code){return COUNTRIES.find(x=>x[0]===code)||null;}
  function countryName(code,lang){const x=byCode(code);return x?(lang==='en'?x[2]:x[1]):code;}
  function consentTitle(code,lang){
    const x=byCode(code);
    if(x) return lang==='en'?x[4]:x[3];
    return lang==='en'?'Credit Information Consent':'نموذج الموافقة على المعلومات الائتمانية';
  }
  function options(lang,selected){
    return '<option value="">'+(lang==='en'?'Select country':'اختر الدولة')+'</option>'+
      COUNTRIES.map(x=>'<option value="'+x[0]+'"'+(x[0]===selected?' selected':'')+'>'+(lang==='en'?x[2]:x[1])+'</option>').join('');
  }
  return {COUNTRIES,countryName,consentTitle,options};
});