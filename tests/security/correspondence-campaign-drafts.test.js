'use strict';
const {renderDraftTemplate:{fillTemplate,draftPage}}=require('../../lib/api/correspondence-campaigns');
describe('Official personalized campaign draft generation',()=>{
 test('personalizes each recipient without mixing organizations',()=>{
  const template='يسرنا دعوة {{organization}} للتعاون، ونرحب بمراسلة {{name}}.';
  const one=fillTemplate(template,{organization:'المستثمر الأول',name:'الأستاذ أحمد'});
  const two=fillTemplate(template,{organization:'المستثمر الثاني',name:'السيدة ليلى'});
  expect(one).toContain('المستثمر الأول');
  expect(one).not.toContain('المستثمر الثاني');
  expect(two).toContain('المستثمر الثاني');
  expect(two).not.toContain('المستثمر الأول');
 });
 test('escapes unsafe HTML and script expressions from a tenant contact',()=>{
  const text='دعوة <script>alert(1)</script> و {{organization}}';
  const value=fillTemplate(text,{organization:'<img src=x onerror=alert(1)>'});
  const html=draftPage(value);
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('&lt;img');
 });
 test('draft renderer returns exactly one editable content root',()=>{
  const html=draftPage('السادة\n\nموضوع الخطاب');
  expect((html.match(/class="doc-content"/g)||[])).toHaveLength(1);
  expect(html).toContain('موضوع الخطاب');
 });
});
