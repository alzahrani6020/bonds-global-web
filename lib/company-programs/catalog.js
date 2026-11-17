'use strict';
// Stable cross-language product identifiers; descriptions are NOT proof that
// the corresponding Makkin functionality has been moved or released.
const PROGRAMS = Object.freeze([
  ['crm', 'BONDS CRM', 'BONDS CRM'],
  ['hr', 'مكين للموارد البشرية', 'Makkin Human Resources'],
  ['real_estate', 'مكين للعقارات', 'Makkin Real Estate'],
  ['fleet', 'مكين للأسطول', 'Makkin Fleet'],
  ['sales', 'مكين للمبيعات', 'Makkin Sales'],
  ['purchasing', 'مكين للمشتريات', 'Makkin Purchasing'],
  ['inventory', 'مكين للمخزون', 'Makkin Inventory'],
  ['finance', 'مكين للمالية', 'Makkin Finance'],
  ['accounting', 'مكين للمحاسبة', 'Makkin Accounting'],
  ['projects', 'مكين للمشاريع', 'Makkin Projects'],
  ['governance', 'مكين للحوكمة والامتثال', 'Makkin Governance and Compliance']
].map(([key,nameAr,nameEn])=>Object.freeze({key,nameAr,nameEn})));
const KEY_SET = new Set(PROGRAMS.map(p=>p.key));
function isActiveEntitlement(row, time = new Date()) {
  if(!row || !KEY_SET.has(row.program_key) || !['active','trial'].includes(row.status)) return false;
  const start = new Date(row.valid_from);
  const end = row.valid_until ? new Date(row.valid_until) : null;
  return Number.isFinite(time.getTime()) &&
    Number.isFinite(start.getTime()) && start <= time &&
    (!end || (Number.isFinite(end.getTime()) && time < end));
}
module.exports = { PROGRAMS, isActiveEntitlement };
