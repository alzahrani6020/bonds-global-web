'use strict';

const setup='للمقارنة لاحقًا: الحالة أ رأس مالها 100000 ريال وصافي ربحها السنوي 20000 ريال. الحالة ب رأس مالها 100000 ريال وصافي ربحها السنوي 30000 ريال. فترة القياس سنة للحالتين.';
const question='قارن بين الحالتين السابقتين من حيث صافي الربح السنوي ونسبة العائد على رأس المال، واحسب الفرق بينهما.';
const user=content=>({role:'user',content});
const assistant=content=>({role:'assistant',content});
const plain=text=>String(text || '').replace(/[,٬]/gu,'');

async function assertComparisonSmoke({baseUrl,token,request,now=Date.now}={}) {
  const marker='e2e-comparison-'+now();
  async function chat(messages) {
    const started=now();
    const response=await request(baseUrl.replace(/\/$/u,'')+'/api/v3/ai/chat',{
      method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
        'Cache-Control':'no-cache','X-Request-ID':marker},
      body:JSON.stringify({messages,context:{},conversation_mode:'financial',options:{max_tokens:256}})
    });
    if (!response.res.ok || response.body?.fallback_reason || now()-started>30000) throw Error('COMPARISON_SMOKE_REQUEST_FAILED request_id='+marker);
    return response.body;
  }
  function completed(body,a,b,profitDifference,returnDifference) {
    const reply=plain(body.reply);
    if (body.inference?.planner!=='universal-v2-deterministic-comparison' || body.inference?.tool_used!==true ||
        body.inference?.actions?.length!==5 || !body.inference.actions.every(a=>a==='math_calculate') ||
        !reply.includes('العائد '+a+'%') || !reply.includes('العائد '+b+'%') ||
        !reply.includes('صافي الربح: '+profitDifference+' ريال') ||
        !reply.includes('العائد: '+returnDifference+' نقطة مئوية.')) throw Error('COMPARISON_SMOKE_INCOMPLETE request_id='+marker);
  }
  const first=await chat([user(setup)]);
  if (first.inference?.planner!=='universal-v2-comparison-context' ||
      !['100000','20000','30000'].every(n=>plain(first.reply).includes(n))) throw Error('COMPARISON_CONTEXT_NOT_RETAINED request_id='+marker);
  const history=[user(setup),assistant(first.reply),user(question)];
  const second=await chat(history);
  completed(second,20,30,10000,10);
  history.push(assistant(second.reply),user('الحالة أ صافي ربحها السنوي 25000 ريال، أعد المقارنة بنفس رأس المال.'));
  const changed=await chat(history);
  completed(changed,25,30,5000,5);
  history.push(assistant(changed.reply),user('الحالة ب صافي ربحها الشهري 30000 ريال، أعد المقارنة.'));
  const incompatible=await chat(history);
  if (incompatible.inference?.planner!=='universal-v2-comparison-clarification' ||
      incompatible.inference?.tool_used!==false || /العائد\s+\d+(?:\.\d+)?%/u.test(incompatible.reply)) throw Error('COMPARISON_PERIOD_GUARD_FAILED request_id='+marker);
  console.log('Authenticated contextual comparison PASS (both cases, five governed calculations, profit update, incompatible-period guard, request_id='+marker+')');
}

async function assertComparisonTools({run,execute,requestId}={}) {
  const result=await run([user(setup),user(question)],{requestId},[],execute);
  if (result.failure || result.planner!=='universal-v2-deterministic-comparison' ||
      result.trace.length!==5 || result.trace.some(t=>!t.execution?.ok || !t.execution?.executed) ||
      result.trace.some((t,i)=>typeof t.execution.result?.value!=='number' || Math.abs(t.execution.result.value-[20,30,0,10000,10][i])>1e-9) ||
      !result.reply.endsWith('العائد: 10 نقطة مئوية.')) throw Error('COMPARISON_GOVERNED_TOOLS_FAILED');
  console.log('Live governed comparison tools PASS (five calculations, complete result, request_id='+requestId+')');
}

module.exports={assertComparisonSmoke,assertComparisonTools};
