import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { admissionCases } from './admission-cases.mjs';
const fixture=name=>JSON.parse(readFileSync(new URL('./fixtures/'+name,import.meta.url)));
const kit=fixture('kit-vectors.json'), extra=fixture('browser-vectors.json'),slots=fixture('slot-vectors.json');
const review=fixture('review-regressions-v0.json');
const all=[...kit.vectors,...extra.vectors,...review.vectors];
const report={schema:'lens.chromium-conformance.v0',goldens:{},results:{},slot_results:{},admission:{},ui:[],capabilities:{}};
const out=resolve(process.env.LENS_REPORT_DIR||'build/agent-anchor/browser');
test.beforeEach(async ({page})=>{
  const external=[],errors=[];
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tests/agent-anchor/harness.html');
  await page.waitForFunction(()=>!!window.lensTest);
  page.lensExternal=external;page.lensErrors=errors;
});
test.afterEach(async ({page})=>{expect(page.lensExternal).toEqual([]);expect(page.lensErrors).toEqual([]);});
test.afterAll(async ({browser})=>{
  mkdirSync(out,{recursive:true});
  writeFileSync(resolve(out,'browser-results.json'),JSON.stringify(report,null,2)+'\n');
  writeFileSync(resolve(out,'browser-runtime.json'),JSON.stringify({browser:browser.version(),platform:process.platform,node:process.version},null,2)+'\n');
});
test('all existing and new golden recipes execute in Chromium',async ({page})=>{
  const got=await page.evaluate(async()=>{
    const result={};
    for(const r of window.lensTest.RECIPES)result[r.id]={selfTest:await r.selfTest(),example:await r.run(r.loadExample())};
    return result;
  });
  expect(Object.keys(got)).toHaveLength(16);
  for(const [id,result] of Object.entries(got)){expect(result.selfTest.ok,id).toBe(true);expect(result.example).not.toHaveProperty('error');}
  report.goldens=got;
});
test('complete upstream and browser-specific result projections match independent expectations',async ({page})=>{
  // Only input + separate context cross the browser boundary; no expected outcome.
  const got=await page.evaluate(async vectors=>{
    const result={};for(const v of vectors)result[v.name]=await window.lensTest.evaluateProof(v.input,v.context);return result;
  },all.map(({name,input,context})=>({name,input,context})));
  for(const v of all)expect(got[v.name],v.name).toEqual(v.expected);
  report.results=got;
});
test('original native slot-log vectors and exact header roots',async ({page})=>{
  const got=await page.evaluate(async vectors=>{
    const result={};
    for(const v of vectors){try{const r=await window.lensTest.checkFile(v.file);if(v.prev!=null)await window.lensTest.checkChain(r.header,r.lines,v.prev);result[v.id]={status:'ok',root:r.root};}catch{result[v.id]={status:'reject'};}}
    return result;
  },slots.vectors.map(({id,file,prev})=>({id,file,prev})));
  for(const v of slots.vectors)expect(got[v.id],v.id).toEqual(v.expect==='ok'?{status:'ok',root:v.log_root}:{status:'reject'});
  report.slot_results=got;
});

test('review host regressions cannot promote or mutate local results',async ({page})=>{
  const got=await page.evaluate(async vectors=>{
    const results={};
    for(const v of vectors){
      const local=await window.lensTest.evaluateProof(v.input,v.context),before=JSON.stringify(local);
      const comparison=window.lensTest.compareHost(local,v.host);
      results[v.name]={local,comparison,local_unchanged:before===JSON.stringify(local)};
    }
    return results;
  },review.host_vectors.map(({name,input,context,host})=>({name,input,context,host})));
  for(const v of review.host_vectors)expect(got[v.name],v.name).toEqual({local:v.expected,comparison:v.expected_comparison,local_unchanged:true});
  report.host_regressions=got;
});
test('raw bytes, 4 MiB and depth admission controls',async ({page})=>{
  for(const v of admissionCases(new Uint8Array(Buffer.from(kit.vectors[0].input.subject_base64,'base64')))){
    const got=await page.evaluate(async b64=>{try{return {status:'ADMITTED',id:await window.lensTest.admitSubject(window.lensTest.fromBase64(b64))};}catch(e){return {status:e.code||e.message};}},Buffer.from(v.raw).toString('base64'));
    expect(got.status,v.name).toBe(v.expected);
    if(got.status==='ADMITTED')expect(got.id).toBe('0x'+createHash('sha256').update(v.raw).digest('hex'));
    report.admission[v.name]=got;
  }
});
test('unavailable Ed25519 and malformed host reports remain explicit',async ({page})=>{
  const v=kit.vectors[0];
  const got=await page.evaluate(async ({input,context})=>{
    const old=crypto.subtle.importKey;
    try{crypto.subtle.importKey=async()=>{throw new DOMException('test capability refusal','NotSupportedError');};
      const result=await window.lensTest.evaluateProof(input,context);return {result,malformed:window.lensTest.compareHost(result,{status:'VERIFIED'})};
    }finally{crypto.subtle.importKey=old;}
  },{input:v.input,context:v.context});
  expect(got.result).toEqual({projection:'chain-neutral.result.v0',proof_validity:'UNVERIFIABLE',anchor_assurance:'ANCHOR_UNCHECKED',reason:'WEBCRYPTO_ED25519_UNAVAILABLE',native:null});
  expect(got.malformed).toBe('MALFORMED');report.capabilities=got;
});
test('UI exposes dimensions, preserves raw file bytes and never adopts host or proof trust',async ({page})=>{
  await page.goto('/');
  for(const profile of ['agent-action.subject-record.v0','receiptos.manifest-proof.v0','invinoveritas.decision_receipt.slot_log.v1']){
    await page.locator('.recipe-pick').selectOption(profile);await page.getByRole('button',{name:'Load example'}).click();await page.getByRole('button',{name:'Recompute',exact:true}).click();
    const dims=page.getByTestId('result-dimensions');await expect(dims).toContainText('Proof validity: VERIFIED');
    await expect(dims).toContainText('ANCHORED_VERIFIED — NOT_COVERED');await expect(page.locator('.v-badge')).toHaveCount(0);
    report.ui.push({case:profile,dimensions:true});
  }
  await page.locator('.recipe-pick').selectOption('receiptos.manifest-proof.v0');await page.getByRole('button',{name:'Load example'}).click();
  await page.locator('#field-host').fill(JSON.stringify({...kit.vectors[0].expected,proof_validity:'REFUTED'}));
  await page.getByRole('button',{name:'Recompute',exact:true}).click();await expect(page.getByTestId('result-dimensions')).toContainText('DISAGREEMENT');await expect(page.getByTestId('result-dimensions')).toContainText('Proof validity: VERIFIED');
  report.ui.push({case:'host-disagreement',browser_result_retained:true});
  const broken=kit.vectors.find(v=>v.name==='CORRUPT_SIBLING');
  await page.locator('#field-envelope').fill(Buffer.from(broken.input.envelope_base64,'base64').toString());
  await page.locator('#field-host').fill(JSON.stringify(kit.vectors[0].expected));await page.getByRole('button',{name:'Recompute',exact:true}).click();
  await expect(page.getByTestId('result-dimensions')).toContainText('Proof validity: REFUTED');report.ui.push({case:'host-cannot-override-broken-proof',refuted:true});
  await page.locator('#field-configuration').fill('{}');await page.getByRole('button',{name:'Recompute',exact:true}).click();await expect(page.getByTestId('result-dimensions')).toContainText('Proof validity: UNVERIFIABLE');report.ui.push({case:'configuration-required',unverifiable:true});
  await page.locator('.recipe-pick').selectOption('agent-action.subject-record.v0');await page.getByRole('button',{name:'Load example'}).click();
  await page.getByLabel('Original bytes file: subject',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from([0xc0,0xaf])});
  await page.getByRole('button',{name:'Recompute',exact:true}).click();await expect(page.getByTestId('result-dimensions')).toContainText('INVALID_UTF8');report.ui.push({case:'original-file-invalid-utf8',refused:true});
  await page.screenshot({path:resolve(out,'raw-byte-refusal.png'),fullPage:true});
});
