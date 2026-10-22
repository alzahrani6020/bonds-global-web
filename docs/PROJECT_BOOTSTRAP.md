# BONDS Project Bootstrap

هذا الملف هو نقطة الدخول الإلزامية لأي مساعد أو مطور أو عامل ذاتي يستأنف العمل على BONDS.

## ترتيب القراءة الإلزامي

1. `docs/BONDS_DUAL_CORE_MASTER_ARCHITECTURE.md`
2. `docs/BONDS_DUAL_CORE_INVARIANTS.md`
3. `docs/BONDS_DUAL_CORE_DECISIONS.md`
4. `docs/BONDS_DUAL_CORE_EXECUTION_PLAN.md`
5. `docs/bonds-dual-core-roadmap.json`
6. `docs/bonds-current-state.json`
7. `docs/BONDS_ASSISTANT_MASTER_PLAN.md`
8. `docs/bonds-assistant-roadmap.json`

## بروتوكول الاستئناف

قبل تنفيذ أي تغيير:

1. تحقق من `origin/main` الحالي.
2. اقرأ `docs/bonds-current-state.json`.
3. لا تعد أي عمل حالته `completed`.
4. استأنف `current_workstream` و`next_action`.
5. لا تستخدم working tree غير نظيف كأساس Candidate.
6. أي اختلاف بين المحادثة والمستودع يحسم لصالح المستودع.
7. أي اختلاف بين ملف الحالة والـGit الفعلي يجب كشفه قبل التنفيذ، لا تجاهله.
8. حدّث ملف الحالة عند اكتمال كل milestone أو انتقال حالة مهم.

## قاعدة المصدر

- GitHub `main`: مصدر الحقيقة للكود والمعمارية المعتمدة.
- `bonds-current-state.json`: نقطة الاستئناف التشغيلية.
- قاعدة checkpoint المحلية المستقبلية: حالة التنفيذ الدقيقة بين الخطوات.
- النسخة البعيدة للـcheckpoint: استعادة الكوارث، وليست بديلًا عن Git.

## عبارة الاستئناف

في أي محادثة جديدة:

> راجع `docs/PROJECT_BOOTSTRAP.md` ثم تحقق من `main` الحالي و`docs/bonds-current-state.json`، واستأنف من آخر checkpoint دون إعادة أي عمل مكتمل.
