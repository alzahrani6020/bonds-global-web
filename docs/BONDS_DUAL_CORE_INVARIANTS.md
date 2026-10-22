# BONDS Dual-Core Invariants

هذه القواعد غير قابلة للكسر بواسطة Assistant أو Evolution Worker أو Candidate.

1. المستودع `main` هو مصدر الحقيقة للكود المعتمد.
2. لا تنفيذ لنص حر مولد من AI كـShell/SQL/JS/URL مباشر.
3. التنفيذ يتم عبر أفعال منظمة وأدوات مسجلة.
4. لا تعديل مباشر على `main` بواسطة Evolution Worker.
5. كل Candidate يبدأ من baseline نظيف ومثبت SHA.
6. لا إعلان PASS دون نتيجة اختبار قابلة للتحقق.
7. لا إعلان "تم" للمستخدم دون نتيجة تنفيذ مثبتة.
8. لا رقم مالي دون محرك حساب/مصدر معتمد.
9. AI inference لا يتحول تلقائيًا إلى verified business fact.
10. Service Token audience/scope/revocation/replay protections لا تضعف.
11. RLS والـauthorization لا تضعف ضمن ترقية عادية.
12. الأسرار لا تدخل prompts أو logs أو Candidate artifacts.
13. Production يجب أن يستمر إذا الجهاز المحلي أو Evolution Worker متوقف.
14. فشل Evolution لا يعطل Core A.
15. أي Candidate stale مقابل أحدث main يعاد دمجه واختباره.
16. أي تغيير جوهري بعد الموافقة يبطل صلاحية الموافقة السابقة لذلك التغيير.
17. الموافقة على الهدف لا تتجاوز الاختبارات أو Security/Regression gates.
18. الحسابات المالية الحتمية تبقى خارج سلطة LLM.
19. migration مدمج سابقًا لا يعدل؛ يستخدم migration جديد للتصحيح.
20. كل ترقية يجب أن تكون قابلة للتراجع أو لها compensating action موثق.
21. البيانات الحساسة لا تستخدم في التدريب دون سياسة صريحة وتنظيف مناسب.
22. لا تعتمد صحة النظام على ذاكرة المحادثة.
23. كل milestone مهم يحدّث حالة المشروع الدائمة.
24. العمل المكتمل لا يعاد إلا بقرار reopen/supersede موثق.
25. ضعف العتاد يقلل السرعة/التوازي فقط، لا معايير الجودة.
