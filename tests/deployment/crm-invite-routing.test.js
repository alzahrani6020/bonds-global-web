const fs=require('fs');
const path=require('path');

describe('Customer CRM invitation routing stays within the Vercel Hobby budget',()=>{
 const root=path.resolve(__dirname,'../..');
 test('secure invitation endpoint is rewritten to the rate-limited platform entry',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const routes=config.rewrites.filter(r=>r.source==='/api/crm-invite'||r.source==='/api/crm-invite/');
  expect(routes).toHaveLength(2);
  expect(routes.every(r=>r.destination==='/api/platform')).toBe(true);
  const platform=fs.readFileSync(path.join(root,'api/platform.js'),'utf8');
  expect(platform).toContain("const crmInviteHandler = require('../lib/api/crm-invite');");
  expect(platform).toContain("if (pathname === '/api/crm-invite' || pathname === '/api/crm-invite/')");
  expect(platform).toContain("if (await checkRateLimit('auth', req, res)) return;");
  expect(fs.existsSync(path.join(root,'api/crm-invite.js'))).toBe(false);
  expect(fs.existsSync(path.join(root,'lib/api/crm-invite.js'))).toBe(true);
 });
});
