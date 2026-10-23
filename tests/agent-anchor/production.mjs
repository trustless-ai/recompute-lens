import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url))),dist=resolve(root,'dist');
const out=resolve(process.env.LENS_REPORT_DIR||resolve(root,'build/agent-anchor/production'));mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=resolve(dist,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(dist+sep)){res.statusCode=404;res.end();return;}try{res.setHeader('Content-Type',extname(file)==='.js'?'text/javascript':extname(file)==='.css'?'text/css':'text/html');res.end(readFileSync(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:900}}),external=[],errors=[];
page.on('request',r=>{if(!r.url().startsWith(origin+'/'))external.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
const profiles=['agent-action.subject-record.v0','receiptos.manifest-proof.v0','invinoveritas.decision_receipt.slot_log.v1'];
const review=JSON.parse(readFileSync(resolve(root,'tests/agent-anchor/fixtures/review-regressions-v0.json')));
const report={schema:'lens.production-browser.v0',profiles:[],existing_and_new_goldens:16,external_requests:external,page_errors:errors};
try{
  await page.goto(origin);await page.waitForFunction(()=>document.querySelector('.conf.ok')?.textContent.includes('all 16 recipes'));
  for(const profile of profiles){await page.locator('.recipe-pick').selectOption(profile);await page.getByRole('button',{name:'Load example'}).click();await page.getByRole('button',{name:'Recompute',exact:true}).click();await page.getByTestId('result-dimensions').waitFor();const text=await page.getByTestId('result-dimensions').textContent();assert(text.includes('Proof validity: VERIFIED'));assert(text.includes('ANCHORED_VERIFIED — NOT_COVERED'));assert.equal(await page.locator('.v-badge').count(),0);report.profiles.push({profile,proof_validity:'VERIFIED',anchor_assurance:profile.startsWith('invino')?'CHAIN_CONSISTENT':'ANCHOR_UNCHECKED'});}
  report.review_regressions=[];
  const proofCases=review.vectors.filter(v=>v.name.startsWith('REVIEW_DUPLICATE_KEY_'));
  for(const v of [...proofCases,...review.host_vectors]){
    await page.locator('.recipe-pick').selectOption('receiptos.manifest-proof.v0');
    await page.getByRole('button',{name:'Load example'}).click();
    await page.locator('#field-envelope').fill(Buffer.from(v.input.envelope_base64,'base64').toString());
    await page.locator('#field-policy').fill(JSON.stringify(v.input.policy));
    await page.locator('#field-configuration').fill(JSON.stringify(v.context));
    if(v.host)await page.locator('#field-host').fill(JSON.stringify(v.host));
    await page.getByRole('button',{name:'Recompute',exact:true}).click();
    await page.waitForFunction(({status,reason,comparison})=>{const t=document.querySelector('[data-testid="result-dimensions"]')?.textContent||'';return t.includes('Proof validity: '+status)&&t.includes(reason)&&(!comparison||t.includes(comparison));},{status:v.expected.proof_validity,reason:v.expected.reason,comparison:v.expected_comparison});
    report.review_regressions.push({name:v.name,proof_validity:v.expected.proof_validity,reason:v.expected.reason,host_comparison:v.expected_comparison??null});
  }
  await page.screenshot({path:resolve(out,'slot-proof.png'),fullPage:true});
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  report.passed=true;
}finally{await browser.close();await new Promise(r=>server.close(r));writeFileSync(resolve(out,'production-results.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
