# Bonds Global — نموذج بيانات Sales / CRM

> تصميم مقترح لإدارة مسار العميل: `Lead → Prospect → Client → Project → Contract → Invoice`.  
> الهدف: ربط التفاعلات التسويقية بالاشتراكات والمشاريع بشكل مركزي داخل Supabase.

---

## مسار التحويل (Sales Funnel)

```text
Lead → Prospect → Client → Project → Contract → Invoice
```

| الكيان | الغرض | رابطه بالجداول الحالية |
|---|---|---|
| **Lead** | تسجيل أي اهتمام أولي | يمكن استيراده من `contact_messages` أو `usage_logs` |
| **Prospect** | Lead مؤهل وتم التواصل معه | يرتبط بـ `crm_leads` وقد يرتبط بـ `auth.users` لاحقًا |
| **Client** | عميل فعلي (مجاني أو مدفوع) | يرتبط بـ `auth.users` و `profiles` |
| **Project** | دراسة جدوى أو سيناريو | يرتبط بـ `user_projects` / `projects` / `scenarios` |
| **Contract** | اشتراك أو عقد مالي | يرتبط بـ `subscriptions` |
| **Invoice** | فاتورة دفع | يرتبط بـ `moyasar_invoices` و Stripe invoices |

---

## الجداول المقترحة

### `crm_leads`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `source` | `text` | `website`, `calculator`, `contact_form`, `ad`, `referral`, `manual` |
| `status` | `text NOT NULL DEFAULT 'new'` | `new`, `contacted`, `qualified`, `disqualified`, `converted` |
| `name` | `text` | اسم جهة الاتصال |
| `email` | `text` | — |
| `phone` | `text` | — |
| `company_name` | `text` | — |
| `country_code` | `text` | ISO-3166 مثل `SA` |
| `city_code` | `text` | يرتبط بـ `cities.code` |
| `sector` | `text` | — |
| `activity` | `text` | — |
| `estimated_budget` | `numeric(14,2)` | تقدير مبدئي للميزانية |
| `interest_tier` | `text` | `free`, `pro`, `enterprise` |
| `assigned_to` | `uuid REFERENCES auth.users(id) ON DELETE SET NULL` | مسؤول المبيعات |
| `notes` | `text` | — |
| `converted_prospect_id` | `uuid REFERENCES crm_prospects(id) ON DELETE SET NULL` | بعد التحويل |
| `created_at` | `timestamptz DEFAULT now()` | — |
| `updated_at` | `timestamptz DEFAULT now()` | — |

**Indexes:**
- `idx_crm_leads_status` (`status`)
- `idx_crm_leads_email` (`email`)
- `idx_crm_leads_assigned_to` (`assigned_to`)
- `idx_crm_leads_created_at` (`created_at`)

**RLS:**
- Sales/admin يمكنهم إدارة جميع الـ Leads.
- المستخدم العادي لا يرى الـ Leads (هذه جدول داخلي للمبيعات).

---

### `crm_prospects`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `lead_id` | `uuid REFERENCES crm_leads(id) ON DELETE SET NULL` | المصدر |
| `user_id` | `uuid REFERENCES auth.users(id) ON DELETE SET NULL` | إذا سجّل حسابًا |
| `status` | `text NOT NULL DEFAULT 'prospect'` | `prospect`, `qualified`, `proposal_sent`, `converted`, `lost` |
| `estimated_value` | `numeric(14,2)` | القيمة المتوقعة |
| `interest_tier` | `text` | `free`, `pro`, `enterprise` |
| `last_contact_at` | `timestamptz` | آخر تواصل |
| `next_follow_up_at` | `timestamptz` | المتابعة القادمة |
| `assigned_to` | `uuid REFERENCES auth.users(id) ON DELETE SET NULL` | — |
| `notes` | `text` | — |
| `converted_client_id` | `uuid REFERENCES crm_clients(id) ON DELETE SET NULL` | بعد التحويل |
| `created_at` | `timestamptz DEFAULT now()` | — |
| `updated_at` | `timestamptz DEFAULT now()` | — |

**Indexes:**
- `idx_crm_prospects_status`
- `idx_crm_prospects_assigned_to`
- `idx_crm_prospects_next_follow_up`

**RLS:** sales/admin فقط.

---

### `crm_clients`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `user_id` | `uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE` | رابط الحساب |
| `profile_id` | `uuid REFERENCES profiles(id) ON DELETE SET NULL` | رابط البروفايل |
| `status` | `text NOT NULL DEFAULT 'active'` | `active`, `inactive`, `churned`, `trial` |
| `account_manager_id` | `uuid REFERENCES auth.users(id) ON DELETE SET NULL` | — |
| `lifetime_value` | `numeric(14,2) DEFAULT 0` | إجمالي القيمة المدفوعة |
| `tier` | `text` | `free`, `pro`, `enterprise` |
| `first_payment_at` | `timestamptz` | — |
| `churned_at` | `timestamptz` | — |
| `created_at` | `timestamptz DEFAULT now()` | — |
| `updated_at` | `timestamptz DEFAULT now()` | — |

**Indexes:**
- `idx_crm_clients_user_id`
- `idx_crm_clients_status`
- `idx_crm_clients_tier`

**RLS:**
- العميل يمكنه قراءة سجله فقط.
- Sales/admin يمكنهم إدارة جميع السجلات.

---

### `crm_projects`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `client_id` | `uuid NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE` | — |
| `user_project_id` | `uuid REFERENCES user_projects(id) ON DELETE SET NULL` | رابط V3 |
| `legacy_project_id` | `uuid REFERENCES projects(id) ON DELETE SET NULL` | رابط V1/V2 |
| `scenario_id` | `uuid REFERENCES scenarios(id) ON DELETE SET NULL` | رابط السيناريو |
| `name` | `text NOT NULL` | — |
| `status` | `text NOT NULL DEFAULT 'draft'` | `draft`, `in_progress`, `completed`, `cancelled` |
| `project_value` | `numeric(14,2)` | قيمة المشروع/الدراسة |
| `country_code` | `text` | — |
| `city_code` | `text` | — |
| `sector` | `text` | — |
| `activity` | `text` | — |
| `created_at` | `timestamptz DEFAULT now()` | — |
| `updated_at` | `timestamptz DEFAULT now()` | — |

**Indexes:**
- `idx_crm_projects_client_id`
- `idx_crm_projects_status`

**RLS:** العميل يرى مشاريعه، sales/admin يرون الكل.

---

### `crm_contracts`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `client_id` | `uuid NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE` | — |
| `project_id` | `uuid REFERENCES crm_projects(id) ON DELETE SET NULL` | — |
| `subscription_id` | `uuid REFERENCES subscriptions(id) ON DELETE SET NULL` | رابط الاشتراك |
| `contract_type` | `text NOT NULL` | `subscription`, `one_time`, `enterprise_agreement` |
| `status` | `text NOT NULL DEFAULT 'draft'` | `draft`, `active`, `cancelled`, `expired` |
| `value` | `numeric(14,2) NOT NULL` | قيمة العقد |
| `currency` | `text DEFAULT 'SAR'` | — |
| `start_date` | `date` | — |
| `end_date` | `date` | — |
| `cancel_at_period_end` | `boolean DEFAULT false` | — |
| `notes` | `text` | — |
| `created_at` | `timestamptz DEFAULT now()` | — |
| `updated_at` | `timestamptz DEFAULT now()` | — |

**Indexes:**
- `idx_crm_contracts_client_id`
- `idx_crm_contracts_status`
- `idx_crm_contracts_subscription_id`

**RLS:** العميل يرى عقوده، sales/admin يرون الكل.

---

### `crm_invoices`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `contract_id` | `uuid REFERENCES crm_contracts(id) ON DELETE SET NULL` | — |
| `client_id` | `uuid NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE` | — |
| `moyasar_invoice_id` | `uuid REFERENCES moyasar_invoices(id) ON DELETE SET NULL` | — |
| `external_id` | `text` | رقم فاتورة Stripe أو Moyasar |
| `external_provider` | `text` | `stripe`, `moyasar`, `bank_transfer`, `manual` |
| `status` | `text NOT NULL DEFAULT 'draft'` | `draft`, `sent`, `paid`, `failed`, `overdue`, `cancelled` |
| `amount` | `numeric(14,2) NOT NULL` | — |
| `currency` | `text DEFAULT 'SAR'` | — |
| `vat_amount` | `numeric(14,2)` | — |
| `due_date` | `date` | — |
| `paid_at` | `timestamptz` | — |
| `invoice_url` | `text` | — |
| `metadata` | `jsonb DEFAULT '{}'` | — |
| `created_at` | `timestamptz DEFAULT now()` | — |
| `updated_at` | `timestamptz DEFAULT now()` | — |

**Indexes:**
- `idx_crm_invoices_client_id`
- `idx_crm_invoices_status`
- `idx_crm_invoices_external_id`

**RLS:** العميل يرى فواتيره، sales/admin يرون الكل.

---

## العلاقات

```text
crm_leads ||--o| crm_prospects : "lead_id"
crm_prospects ||--o| crm_clients : "converted_client_id"
crm_clients ||--o{ crm_projects : "client_id"
crm_clients ||--o{ crm_contracts : "client_id"
crm_contracts ||--o{ crm_invoices : "contract_id"
crm_clients ||--o{ crm_invoices : "client_id"
```

---

## التكامل مع الجداول الحالية

| جدول CRM | جدول حالي | طبيعة العلاقة |
|---|---|---|
| `crm_leads` | `contact_messages` | يمكن استيراد Leads من الرسائل الواردة |
| `crm_leads` | `usage_logs` | يمكن تأهيل Leads بناءً على استخدام الحاسبات |
| `crm_clients` | `profiles` / `auth.users` | كل عميل له حساب |
| `crm_clients` | `subscriptions` | تحديث `tier` و `lifetime_value` |
| `crm_projects` | `user_projects` / `projects` / `scenarios` | ربط المشاريع المالية بالمشاريع الفنية |
| `crm_contracts` | `subscriptions` | ربط العقد بالاشتراك النشط |
| `crm_invoices` | `moyasar_invoices` | ربط الفواتير بدفعات Moyasar |

---

## مراحل التنفيذ المقترحة

1. **Migration أولى:** إنشاء الجداول الستة مع indexes و RLS.
2. **Import:** ملء `crm_leads` من `contact_messages` و `usage_logs` الحالية.
3. **Automation:** عند تسجيل مستخدم جديد، يُنشأ تلقائيًا `crm_client`.
4. **Admin UI:** صفحة `/admin/crm.html` لعرض وإدارة Leads و Prospects و Clients.
5. **Reports:** إضافة تقارير مبيعات وتحويلات إلى لوحة التحكم.
