'use strict';
// Experimental write bridge. Explicitly disabled in production and until
// separately configured for an isolated SCC380 test tenant. Never proxy
// arbitrary paths, relations, document approval or financial postings.
const operations=Object.freeze({
  'projects.tasks.create':Object.freeze({
    program:'projects',path:'/projects/tasks',verify:'title'
  }),
  'hr.contracts.create':Object.freeze({
    program:'hr',path:'/hr/contracts',verify:'contractNumber'
  }),
  'purchasing.orders.create':Object.freeze({
    program:'purchasing',path:'/finance/purchase-orders',verify:'poNumber'
  })
});
const identifier=/^[a-z0-9]{15,40}$/;
const isoDate=/^\d{4}-\d{2}-\d{2}$/;
function validDate(date){
  return typeof date==='string' && isoDate.test(date) &&
    Number.isFinite(new Date(date+'T00:00:00Z').getTime()) &&
    new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
}
function validateMakkinWriteOperation(program,operation,payload){
  const definition=Object.prototype.hasOwnProperty.call(operations,operation)
    ?operations[operation]:null;
  if(!definition || definition.program!==program ||
      !payload || typeof payload!=='object' || Array.isArray(payload))return null;
  const keys=Object.keys(payload);
  if(operation==='projects.tasks.create'){
    if(keys.some(key=>!['title','description'].includes(key)))return null;
    if(typeof payload.title!=='string'||!payload.title.trim()||
        payload.title.length>160)return null;
    if(payload.description!==undefined &&
       (typeof payload.description!=='string'||payload.description.length>2000))return null;
    return {operation:definition,data:{title:payload.title.trim(),
      ...(payload.description!==undefined?{description:payload.description}:{})}};
  }
  if(operation==='purchasing.orders.create'){
    // Stage-only draft PO. No supplier association, approval, inventory
    // receipt or posting. Total must reconcile in integer minor units.
    if(keys.some(key=>!['poNumber','subtotal','taxAmount','total','notes'].includes(key)))return null;
    if(typeof payload.poNumber!=='string' || !payload.poNumber.trim() ||
       payload.poNumber.length>64)return null;
    const money=v=>typeof v==='number' && Number.isFinite(v) &&
      v>=0 && v<=1e10 && Number.isSafeInteger(Math.round(v*100)) &&
      Math.abs(v*100-Math.round(v*100))<1e-7;
    const subtotal=payload.subtotal;
    const tax=payload.taxAmount===undefined?0:payload.taxAmount;
    const total=payload.total;
    if(!money(subtotal)||!money(tax)||!money(total)||
       Math.round(subtotal*100)+Math.round(tax*100)!==Math.round(total*100))return null;
    if(payload.notes!==undefined &&
       (typeof payload.notes!=='string'||payload.notes.length>2000))return null;
    return {operation:definition,data:{
      poNumber:payload.poNumber.trim(),subtotal,taxAmount:tax,total,
      ...(payload.notes!==undefined?{notes:payload.notes}:{})
    }};
  }
  if(operation==='hr.contracts.create'){
    if(keys.some(key=>!['employeeId','contractNumber','startDate','endDate','type'].includes(key)))return null;
    if(typeof payload.employeeId!=='string'||!identifier.test(payload.employeeId) ||
       typeof payload.contractNumber!=='string'||!payload.contractNumber.trim()||
       payload.contractNumber.length>64 || !validDate(payload.startDate))return null;
    if(payload.endDate!==undefined &&
        (!validDate(payload.endDate)||payload.endDate<=payload.startDate))return null;
    if(payload.type!==undefined &&
       !['FIXED_TERM','INDEFINITE','TEMPORARY','TRAINING'].includes(payload.type))return null;
    return {operation:definition,data:{
      employeeId:payload.employeeId,
      contractNumber:payload.contractNumber.trim(),
      startDate:payload.startDate,
      ...(payload.endDate!==undefined?{endDate:payload.endDate}:{}),
      ...(payload.type!==undefined?{type:payload.type}:{})
    }};
  }
  return null;
}
module.exports={validateMakkinWriteOperation};
