(function enhanceArabicBreakEvenHelp() {
  'use strict';

  if ((document.documentElement.lang || '').toLowerCase().indexOf('ar') !== 0) return;

  var faqCopy = {
    'لماذا لا تظهر كمية تعادل أحياناً؟': 'كمية التعادل هي عدد الوحدات التي يجب بيعها حتى يغطي هامش المساهمة التكاليف الثابتة دون تحقيق ربح أو خسارة. إذا كان هامش المساهمة للوحدة صفراً أو سالباً، فهذا يعني أن كل وحدة إضافية لا تساهم في تغطية التكاليف الثابتة؛ لذلك لا توجد كمية بيع موجبة تحقق التعادل قبل تعديل سعر البيع أو خفض التكلفة المتغيرة.',
    'هل VAT جزء من الربح؟': 'لا. VAT (ضريبة القيمة المضافة) مبلغ ضريبي يُحصّل من العميل ويُفصل عن الإيراد التشغيلي والربح. إذا كان السعر شاملاً الضريبة، تُستبعد الضريبة أولاً حتى لا تُعامل كإيراد أو ربح للمشروع، ثم تُحسب الإيرادات والتكاليف والربحية على القيمة الاقتصادية الفعلية.',
    'ما الفرق بين الربح والسيولة؟': 'الربح يوضح ما إذا كان النشاط حقق فائضاً محاسبياً خلال فترة معينة، أما السيولة فتعبر عن النقد المتاح فعلياً للدفع الآن. لذلك قد يكون المشروع رابحاً على الورق لكنه يواجه نقصاً نقدياً إذا كانت المبيعات آجلة، أو كان التحصيل بطيئاً، أو استحقت المدفوعات قبل وصول الإيرادات.',
    'متى يصبح التقرير Final؟': 'يصبح التقرير Final (نهائياً) عندما تكون البيانات الأساسية مكتملة، ولا توجد أخطاء تحقق جوهرية، وتكون الافتراضات والمخرجات متسقة بدرجة تسمح بالاعتماد عليها في القرار. إذا كانت البيانات ناقصة أو الافتراضات غير مؤكدة يبقى التقرير Draft (مسودة)، أي نسخة أولية قابلة للمراجعة والتعديل وليست أساساً نهائياً للقرار.'
  };

  var glossary = [
    ['VAT', 'ضريبة القيمة المضافة'],
    ['Final', 'نهائي'],
    ['Draft', 'مسودة'],
    ['ROI', 'العائد على الاستثمار'],
    ['IRR', 'معدل العائد الداخلي'],
    ['NPV', 'صافي القيمة الحالية'],
    ['EBITDA', 'الأرباح قبل الفوائد والضرائب والإهلاك والاستهلاك'],
    ['CAPEX', 'النفقات الرأسمالية'],
    ['OPEX', 'المصروفات التشغيلية'],
    ['DSCR', 'نسبة تغطية خدمة الدين'],
    ['CAGR', 'معدل النمو السنوي المركب'],
    ['KPI', 'مؤشر الأداء الرئيسي'],
    ['WACC', 'المتوسط المرجح لتكلفة رأس المال'],
    ['DCF', 'التدفقات النقدية المخصومة']
  ];

  function normalizeQuestion(text) {
    return String(text || '')
      .replace(/[▼▲▾▴]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function explainEnglishTerms(text) {
    var result = String(text || '');
    glossary.forEach(function(entry) {
      var term = entry[0];
      var meaning = entry[1];
      var pattern = new RegExp('\\b' + term + '\\b(?!\\s*\\()', 'g');
      result = result.replace(pattern, term + ' (' + meaning + ')');
    });
    return result;
  }

  function findAnswerTarget(questionNode) {
    var details = questionNode.closest && questionNode.closest('details');
    if (details) {
      return details.querySelector('p, .faq-answer, .help-answer, [data-answer]');
    }

    var parent = questionNode.parentElement;
    if (!parent) return null;

    var target = parent.querySelector('p, .faq-answer, .help-answer, [data-answer]');
    if (!target && parent.nextElementSibling &&
        parent.nextElementSibling.matches('p, .faq-answer, .help-answer, [data-answer]')) {
      target = parent.nextElementSibling;
    }
    return target;
  }

  function applyGlossary(root) {
    if (!root || !root.querySelectorAll) return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement ||
          /^(SCRIPT|STYLE|CODE|PRE|TEXTAREA|OPTION)$/.test(node.parentElement.tagName)) {
        continue;
      }
      var updated = explainEnglishTerms(node.nodeValue);
      if (updated !== node.nodeValue) node.nodeValue = updated;
    }
  }

  function enhance(root) {
    root = root || document;
    if (!root.querySelectorAll) return;

    var candidates = root.querySelectorAll('summary, button, h2, h3, h4, [role="button"]');
    candidates.forEach(function(node) {
      var original = normalizeQuestion(node.textContent);
      if (!Object.prototype.hasOwnProperty.call(faqCopy, original)) return;

      var answerTarget = findAnswerTarget(node);
      if (answerTarget) answerTarget.textContent = faqCopy[original];

      var helpRoot = node.closest && node.closest(
        'details, dialog, [role="dialog"], .modal, [class*="help"], [id*="help"], [class*="learn"], [id*="learn"]'
      );
      applyGlossary(helpRoot || node.parentElement);

      var displayQuestion = explainEnglishTerms(original);
      if (normalizeQuestion(node.textContent) === original && displayQuestion !== original) {
        node.textContent = displayQuestion;
      }
    });
  }

  function start() {
    enhance(document);

    if (typeof MutationObserver === 'undefined' || !document.body) return;
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) enhance(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}());
