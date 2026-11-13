/* Canonical seal shared by document print/PDF and verification. */
(function(root){
'use strict';
const NS='http://www.w3.org/2000/svg',BLUE='#083c9b';
function element(tag,attributes={},label){
 const node=document.createElementNS(NS,tag);
 Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,String(value)));
 if(label!==undefined)node.textContent=label;
 return node;
}
function create({english=false,reference='-',date=null}={}){
 const svg=element('svg',{xmlns:NS,viewBox:'0 0 300 192',preserveAspectRatio:'xMidYMid meet',
  class:'certificate-seal-svg','aria-hidden':'true',focusable:'false'});
 const add=(tag,attrs,text)=>svg.appendChild(element(tag,attrs,text));
 add('ellipse',{cx:150,cy:96,rx:146,ry:91,fill:'#fff',stroke:BLUE,'stroke-width':3.5});
 add('ellipse',{cx:150,cy:96,rx:139,ry:84,fill:'none',stroke:BLUE,'stroke-width':1.5});
 // Straight text prevents Safari/Chrome Arabic textPath shaping failures.
 add('text',{x:150,y:40,fill:BLUE,'font-size':english?11:15,'font-weight':700,
  'font-family':'Vazirmatn,Tahoma,Arial,sans-serif','text-anchor':'middle',
  direction:english?'ltr':'rtl'},english?'BONDS FINANCIAL CONSULTING':'بوندز للاستشارات المالية والإدارية');
 add('text',{x:150,y:86,fill:BLUE,'font-size':33,'font-weight':800,
  'text-anchor':'middle','font-family':'Georgia,serif'},'BONDS');
 add('text',{x:150,y:108,fill:BLUE,'font-size':english?10:14,
  'font-weight':700,'text-anchor':'middle',direction:english?'ltr':'rtl'},
  english?'ELECTRONIC STAMP CERTIFICATION':'تصديق الختم الإلكتروني');
 add('line',{x1:67,y1:117,x2:233,y2:117,stroke:BLUE,'stroke-width':1.4});
 add('text',{x:150,y:136,fill:BLUE,'font-size':15,'font-weight':700,
  'text-anchor':'middle','font-family':'Arial,sans-serif'},String(reference).slice(0,40));
 const parsed=date?new Date(date):null;
 add('text',{x:150,y:153,fill:BLUE,'font-size':12,'font-weight':700,'text-anchor':'middle'},
  parsed&&Number.isFinite(parsed.getTime())?parsed.toISOString().slice(0,10):'-');
 add('text',{x:150,y:173,fill:BLUE,'font-size':13,'font-weight':700,
  'text-anchor':'middle',direction:english?'ltr':'rtl'},english?'CR 39733':'رقم السجل 39733');
 [30,270].forEach(x=>{
  const points=Array.from({length:10},(_,i)=>{
    const a=-Math.PI/2+i*Math.PI/5,r=i%2===0?10:4.5;
    return(x+r*Math.cos(a)).toFixed(2)+','+(111+r*Math.sin(a)).toFixed(2);
  }).join(' ');
  add('polygon',{points,fill:BLUE});
 });
 return svg;
}
root.BondsOfficialSeal=Object.freeze({create});
})(window);
