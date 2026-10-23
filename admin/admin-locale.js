(function(global){
  'use strict';

  const EXACT=Object.freeze({
    'BONDS Unified Control Center':'مركز التحكم الموحد لبوندز',
    'Dual-Core Control Surface':'سطح التحكم ثنائي النواة',
    'Assistant':'المساعد',
    'Learning':'التعلم',
    'Training':'التدريب',
    'Evolution':'التطور',
    'Capabilities':'القدرات',
    'Models':'النماذج',
    'Approvals':'الموافقات',
    'Releases':'الإصدارات',
    'Health':'الصحة التشغيلية',
    'Audit':'سجل المراجعة',
    'Admin Control Center':'مركز التحكم الإداري',
    'Platform Operations':'عمليات المنصة',
    'Security Operations':'عمليات الأمن',
    'Executive & AI Analytics':'التحليلات التنفيذية والذكاء الاصطناعي',
    'Product & Automation':'المنتج والأتمتة',
    'Data Governance & Documents':'حوكمة البيانات والمستندات',
    'City Intelligence':'ذكاء المدن',
    'Operations Queue':'طابور العمليات',
    'SLA Breaches':'تجاوزات مستوى الخدمة',
    'Security Controls':'ضوابط الأمن',
    'Configuration Drift':'انحراف الإعدادات',
    'Admin Sessions / Devices':'جلسات وأجهزة الإدارة',
    'Open Tasks':'المهام المفتوحة',
    'Alerts':'التنبيهات',
    'Payment Exceptions':'استثناءات المدفوعات',
    'Security Exceptions':'الاستثناءات الأمنية',
    'Live Sessions':'الجلسات النشطة',
    'Config Drift':'انحراف الإعدادات',
    'Revoke Session':'إبطال الجلسة',
    'Access Policy':'سياسة الوصول',
    'Trust Device':'اعتماد الجهاز',
    'Collection':'التحصيل',
    'Contract':'العقد',
    'Renewal':'التجديد',
    'User UUID':'معرّف المستخدم',
    'Session ID':'معرّف الجلسة',
    'Reason':'السبب',
    'Policy name':'اسم السياسة',
    'Disabled':'معطل',
    'Enabled':'مفعّل',
    'Allowed countries: SA,AE':'الدول المسموح بها: SA,AE',
    'Denied countries':'الدول المحظورة',
    'Allowed IPs comma separated':'عناوين IP المسموح بها مفصولة بفاصلة',
    'Require trusted device':'اشتراط جهاز موثوق',
    'Max session minutes':'الحد الأقصى للجلسة بالدقائق',
    'Device fingerprint':'بصمة الجهاز',
    'Label':'التسمية',
    'Organization UUID':'معرّف المنشأة',
    'Value':'القيمة',
    'Title':'العنوان',
    'CRM وإدارة الشركات':'إدارة علاقات العملاء (CRM)',
    'Leads الحاسبات':'عملاء الحاسبات المحتملون',
    'طلبات مراجعة AI':'طلبات مراجعة الذكاء الاصطناعي',
    'مدن City Intelligence':'مدن ذكاء المدن'
  });

  const PHRASES=Object.freeze([
    ['Normal / Emergency / Full Stop','عادي / طوارئ / إيقاف كامل'],
    ['Self-Training','التدريب الذاتي'],
    ['Production SHA','معرّف إصدار الإنتاج'],
    ['Production READY','الإنتاج جاهز'],
    ['Production readiness','جاهزية الإنتاج'],
    ['Provider','المزوّد'],
    ['AI/API','الذكاء الاصطناعي / واجهة البرمجة'],
    ['AI','الذكاء الاصطناعي'],
    ['CRM','إدارة علاقات العملاء'],
    ['City Intelligence','ذكاء المدن'],
    ['Dual-Core','ثنائي النواة'],
    ['Control Center','مركز التحكم']
  ]);

  function translateText(text){
    const raw=String(text??'');
    const trimmed=raw.trim();
    if(!trimmed) return raw;
    const direct=EXACT[trimmed];
    if(direct) return raw.replace(trimmed,direct);
    let translated=raw;
    for(const [from,to] of PHRASES){
      if(translated.includes(from)) translated=translated.split(from).join(to);
    }
    return translated;
  }

  function translateAttributes(el){
    for(const attr of ['title','aria-label','placeholder','data-title']){
      const value=el.getAttribute?.(attr);
      if(!value) continue;
      const next=EXACT[value.trim()];
      if(next) el.setAttribute(attr,next);
    }
  }

  function walk(root){
    if(!root) return;
    const doc=root.nodeType===9?root:root.ownerDocument;
    const walker=(doc||document).createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
    let node=walker.currentNode;
    while(node){
      if(node.nodeType===3){
        const parent=node.parentElement;
        if(parent&&!['SCRIPT','STYLE','CODE','PRE','TEXTAREA'].includes(parent.tagName)){
          const next=translateText(node.nodeValue);
          if(next!==node.nodeValue) node.nodeValue=next;
        }
      }else if(node.nodeType===1){
        translateAttributes(node);
      }
      node=walker.nextNode();
    }
    const html=root.nodeType===9?root.documentElement:root.closest?.('html');
    if(html){
      html.setAttribute('lang','ar');
      html.setAttribute('dir','rtl');
    }
  }

  function observe(doc){
    if(!doc?.documentElement||doc.__BONDS_AR_LOCALE_OBSERVER__) return;
    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType===1||node.nodeType===3) walk(node);
        }
        if(mutation.type==='attributes'&&mutation.target) translateAttributes(mutation.target);
      }
    });
    observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['title','aria-label','placeholder','data-title']});
    doc.__BONDS_AR_LOCALE_OBSERVER__=observer;
  }

  function applyToDocument(doc){
    if(!doc) return;
    walk(doc);
    observe(doc);
  }

  global.BondsAdminLocale={EXACT,PHRASES,applyToDocument,translateText};

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>applyToDocument(document),{once:true});
  }else{
    applyToDocument(document);
  }
})(window);
