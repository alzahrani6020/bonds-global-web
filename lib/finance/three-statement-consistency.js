'use strict';

// Optional cross-period equity identity. Never invents missing equity movements.
// All amounts must be explicitly sourced or entered by the reviewer.
const numeric=value=>typeof value==='number'&&Number.isFinite(value);
function auditEquityRollForward(values={}){
 const fields=['opening_equity','net_income','owner_contributions','owner_distributions','other_equity_movements','equity'];
 const missing=fields.filter(k=>!numeric(values[k]));
 if(missing.length)return {code:'EQUITY_ROLL_FORWARD',status:'UNVERIFIED',missing,fields,difference:null};
 const expected=values.opening_equity+values.net_income+
   values.owner_contributions-values.owner_distributions+values.other_equity_movements;
 const difference=values.equity-expected;
 const tolerance=Math.max(1,Math.max(Math.abs(expected),Math.abs(values.equity))*0.005);
 return {code:'EQUITY_ROLL_FORWARD',status:Math.abs(difference)<=tolerance?'PASS':'FAIL',
   expected,actual:values.equity,difference,tolerance,fields,missing:[]};
}
module.exports={auditEquityRollForward};
