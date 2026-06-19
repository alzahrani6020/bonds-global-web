# UX Audit — Bonds Global Enterprise Upgrade

## 1. Navigation & Information Architecture

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| UX-01 | **Critical** | Manual Arabic/English duplication makes navigation updates error-prone | 226 HTML files, mirrored nav in root and `en/` |
| UX-02 | **High** | Admin dashboard loads modules in iframe; deep-linking and mobile usability are poor | `admin/dashboard.html` |
| UX-03 | **High** | Too many calculators (53+) with overlapping purposes | `calculators/` directory |
| UX-04 | **Medium** | Inconsistent module sidebars and navigation patterns | `fa-sidebar`, `ai-sidebar`, city-intelligence sidebar |
| UX-05 | **Medium** | No global search to find clients, projects, or documents | No search UI |

## 2. Forms & Data Entry

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| UX-06 | **High** | Forms contain many fields without progressive disclosure | Calculator forms, project forms |
| UX-07 | **High** | No inline validation or field-level error messages | Most forms validate on submit only |
| UX-08 | **Medium** | No auto-save for long forms (studies, models) | `admin/financial-advisory` |
| UX-09 | **Medium** | No confirmation before destructive actions | Delete buttons in admin modules |
| UX-10 | **Low** | Inconsistent button labels and icon usage | Some use emojis, some use SVG |

## 3. Mobile & Responsive

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| UX-11 | **High** | Fixed sidebars break on small screens | `admin/dashboard.html`, `admin/ai-business-advisor` |
| UX-12 | **High** | Tables overflow horizontally without clear scroll affordance | Admin list views |
| UX-13 | **Medium** | Calculator inputs are not optimized for thumb interaction | `calculators/*.html` |
| UX-14 | **Low** | Font sizes in tables are too small on mobile | Admin tables |

## 4. Feedback & Empty States

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| UX-15 | **High** | Generic spinners without progress indication | Loader in dashboard iframe |
| UX-16 | **Medium** | Empty states not consistently designed | Some modules show blank areas |
| UX-17 | **Medium** | Error messages are technical and not actionable | `❌ خطأ أثناء التهيئة: ...` |
| UX-18 | **Low** | No toast/notification system for async actions | Modules rely on `alert()` |

## 5. Recommendations

1. **Unify navigation** into a single data-driven component; generate EN/AR from one source.
2. **Reduce calculators** by merging similar ones or using a wizard.
3. **Add inline validation** and field-level errors on all forms.
4. **Implement a global search bar** in the admin header.
5. **Add mobile-first responsive tables** (cards on small screens).
6. **Create a design system** with reusable components: buttons, inputs, tables, modals, toasts.
7. **Add skeleton loaders** and clear empty-state illustrations.
8. **Add confirmation dialogs** for delete/archive actions.
9. **Use human-friendly error messages** with retry/call-to-action.
10. **Provide keyboard shortcuts and focus management** for power users.
