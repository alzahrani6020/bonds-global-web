'use strict';
const {assertComparisonSmoke}=require('../../scripts/comparison-smoke');
const context={reply:'100,000 20,000 30,000',inference:{planner:'universal-v2-comparison-context',tool_used:false}};
const result=(a,b,p,d)=>({reply:`الحالة أ: العائد ${a}%.\nالحالة ب: العائد ${b}%.\nصافي الربح: ${p} ريال.\nالعائد: ${d} نقطة مئوية.`,
  inference:{planner:'universal-v2-deterministic-comparison',tool_used:true,actions:Array(5).fill('math_calculate')}});
const clarification={reply:'يلزم توحيد الفترة.',inference:{planner:'universal-v2-comparison-clarification',tool_used:false}};
const response=body=>({res:{ok:true,status:200},body});
function requestFor(bodies){const request=jest.fn();bodies.forEach(body=>request.mockResolvedValueOnce(response(body)));return request;}
test('tests the actual contextual question, profit change and incompatible period through HTTP',async()=>{
  const request=requestFor([context,result(20,30,10000,10),result(25,30,5000,5),clarification]);
  await assertComparisonSmoke({baseUrl:'https://staged.example',token:'synthetic-token',request});
  expect(request).toHaveBeenCalledTimes(4);
  const second=JSON.parse(request.mock.calls[1][1].body);
  expect(second.conversation_mode).toBe('financial');
  expect(second.messages).toHaveLength(3);
  expect(second.messages[2].content).toContain('الحالتين السابقتين');
  expect(second.messages[2].content).not.toMatch(/100000|20000|30000/);
});
test.each([
  ['cut answer',{...result(20,30,10000,10),reply:'الحالة أ: العائد 20%. الحالة ب: (30,00'}],
  ['no tool execution',{...result(20,30,10000,10),inference:{planner:'universal-v2',tool_used:false}}],
  ['incorrect return',result(20,40,10000,10)],
  ['percentage points missing',{...result(20,30,10000,10),reply:'العائد 20% والعائد 30% وصافي الربح: 10000 ريال. الفرق 10%.'}]
])('rejects a technically successful %s',async(_label,body)=>{
  await expect(assertComparisonSmoke({baseUrl:'https://staged.example',token:'synthetic-token',request:requestFor([context,body])}))
    .rejects.toThrow('COMPARISON_SMOKE_INCOMPLETE');
});
