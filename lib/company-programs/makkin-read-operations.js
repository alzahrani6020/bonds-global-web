'use strict';
// Audited against SCC380 Nest controllers in draft PR #197 (2026-11-16).
// Fixed read-only routes: no user-supplied URL, ID, query or HTTP method.
// Each operation is additionally checked against BONDS entitlement and SCC
// scoped JWT, tenant middleware and the original controller permissions.
const operations=Object.freeze({
  'crm.contacts.list': Object.freeze({program:'crm',path:'/crm/contacts'}),
  'hr.employees.list': Object.freeze({program:'hr',path:'/hr/employees'}),
  'hr.contracts.list': Object.freeze({program:'hr',path:'/hr/contracts'}),
  'real_estate.properties.list': Object.freeze({program:'real_estate',path:'/real-estate/properties'}),
  'real_estate.contracts.list': Object.freeze({program:'real_estate',path:'/real-estate/contracts'}),
  'fleet.vehicles.list': Object.freeze({program:'fleet',path:'/fleet/vehicles'}),
  'sales.invoices.list': Object.freeze({program:'sales',path:'/erp/invoices'}),
  'purchasing.orders.list': Object.freeze({program:'purchasing',path:'/finance/purchase-orders'}),
  'inventory.products.list': Object.freeze({program:'inventory',path:'/inventory/products'}),
  'finance.payments.list': Object.freeze({program:'finance',path:'/finance/payments'}),
  'accounting.journals.list': Object.freeze({program:'accounting',path:'/finance/journal-entries'}),
  'projects.tasks.list': Object.freeze({program:'projects',path:'/projects/tasks'}),
  'governance.approvals.pending': Object.freeze({program:'governance',path:'/approvals/pending'})
});
function resolveMakkinReadOperation(programKey, operationKey) {
  if(typeof operationKey!=='string' || typeof programKey!=='string')return null;
  if(!Object.prototype.hasOwnProperty.call(operations,operationKey))return null;
  const operation=operations[operationKey];
  return operation.program===programKey ? operation : null;
}
module.exports={MAKKIN_READ_OPERATIONS:operations,resolveMakkinReadOperation};
