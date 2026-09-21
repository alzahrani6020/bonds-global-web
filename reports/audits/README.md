# Bonds Global Official Report Archive

هذا المجلد هو الأرشيف الرسمي لتقارير Bonds Global.

## قواعد الأرشفة

1. أي تقرير جديد يحفظ داخل reports/audits/
2. اسم التقرير يستخدم التاريخ YYYY-MM-DD
3. كل تقرير له Report ID ثابت
4. يجب تحديث reports/REPORT_INDEX.md مع كل تقرير جديد
5. لا يحذف أي تقرير تاريخي
6. التقرير المستبدل يوسم SUPERSEDED
7. التقرير الجديد يرتبط بالسابق عند الحاجة
8. لا يعاد استخدام Report ID
9. لا تعتبر نتائج DRAFT حقائق مؤكدة
10. استخدم مستويات الأدلة:
   VERIFIED
   PARTIALLY VERIFIED
   UNVERIFIED
   INFERENCE
11. يمنع حفظ secrets أو API keys أو tokens أو passwords داخل التقارير

## AGENT REPORT LOOKUP RULE

قبل البحث عن تقرير أو إنشاء تقرير جديد:

1. افتح reports/REPORT_INDEX.md أولاً
2. حدد Report ID المناسب
3. افتح الملف الموجود في عمود FILE
4. لا تبحث عشوائياً في المشروع إلا إذا لم تجد التقرير في الفهرس

أي ادعاء متعلق بـ Production أو Security أو Database لا يصنف VERIFIED بدون دليل مباشر.

## NEW REPORT RULE

عند إنشاء تقرير جديد:

1. اقرأ REPORT_INDEX.md
2. حدد نوع التقرير
3. خصص Report ID التالي
4. احفظ التقرير في reports/audits/
5. حدث REPORT_INDEX.md
6. حدث QUICK FIND
7. اربط التقرير بالتقارير السابقة عند الحاجة
8. لا تحذف التقارير السابقة
