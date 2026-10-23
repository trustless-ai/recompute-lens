// Physical isolated source mutations, executed by Chromium's actual Web Crypto.
// All originals restored byte-for-byte; root sources and expectations never edited.
import { chromium } from '@playwright/test';
import { readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve,relative,sep } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { admissionCases } from './admission-cases.mjs';
// URL path conversion is needed on Windows (spaces, drive prefix).
const { fileURLToPath }=await import('node:url');
const repo=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const source=resolve(repo,'src/recompute/agent-anchor');
const opt=process.argv.indexOf('--out');
const out=resolve(repo,opt>=0?process.argv[opt+1]:'build/agent-anchor/mutations');
if(existsSync(out))throw new Error('Refuse to overwrite mutation evidence: '+out);
if(!out.startsWith(repo+sep))throw new Error('Mutation output must be inside isolated repository build directory');
mkdirSync(out,{recursive:true});
const load=name=>JSON.parse(readFileSync(resolve(repo,'tests/agent-anchor',name)));
const kit=load('fixtures/kit-vectors.json'),extra=load('fixtures/browser-vectors.json');
const cases=new Map([...kit.vectors,...extra.vectors].map(v=>[v.name,v]));
const rawCases=new Map(admissionCases(new Uint8Array(Buffer.from(kit.vectors[0].input.subject_base64,'base64'))).map(v=>[v.name,v]));
const catalogOption=process.argv.indexOf('--catalog');
const mutations=load(catalogOption>=0?process.argv[catalogOption+1]:'mutations.json').mutations;
const originals=Object.fromEntries(readdirSync(source).filter(f=>f.endsWith('.js')).map(f=>[f,readFileSync(resolve(source,f),'utf8')]));
const hash=x=>createHash('sha256').update(x).digest('hex');
const hashes=files=>Object.fromEntries(Object.entries(files).map(([f,b])=>[f,hash(b)]));
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated physical browser mutation</title>');return;}
  const file=resolve(repo,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(out+sep)||!file.endsWith('.js')){res.statusCode=404;res.end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/javascript');
  try{res.end(readFileSync(file));}catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
function patch(files,edits){const changed={...files};for(const e of edits){if(changed[e.file].split(e.old).length-1!==e.count)return null;changed[e.file]=changed[e.file].split(e.old).join(e.new);}return changed;}
function materialize(dest,files){for(const [f,b] of Object.entries(files))writeFileSync(resolve(dest,f),b);}
async function execute(dest,m){
  const context=await browser.newContext(),page=await context.newPage();
  const route=origin+'/'+relative(repo,resolve(dest,'proof.js')).split(sep).join('/');
  const names=[...new Set([...m.controls,...(cases.has(m.witness)?[m.witness]:[])])];
  const proofInputs=names.map(name=>{const v=cases.get(name);return {name,input:v.input,context:v.context};});
  const rv=rawCases.get(m.witness);
  const raw=rv?{name:rv.name,b64:Buffer.from(rv.raw).toString('base64')}:null;
  try{
    await page.goto(origin);
    return await page.evaluate(async ({route,proofInputs,raw,diagnostic})=>{
      const mod=await import(route),results={};
      for(const v of proofInputs)results[v.name]=await mod.evaluateProof(v.input,v.context);
      let admission=null;
      if(raw){try{const bytes=Uint8Array.from(atob(raw.b64),c=>c.charCodeAt(0));admission={status:'ADMITTED',id:await mod.admitSubject(bytes)};}catch(e){admission={status:e.code||e.message};}}
      let host=null;
      if(diagnostic){const local=results.A_VALID;host=mod.compareHost(local,{...local,proof_validity:'REFUTED'});}
      return {results,admission,host};
    },{route,proofInputs,raw,diagnostic:m.kind==='DIAGNOSTIC'});
  }catch(e){return {execution_error:e.message};}
  finally{await context.close();}
}
function expectedWitness(m){
  if(m.kind==='CONTROLLED_NATIVE_FAULT')return {...cases.get(m.witness).expected,proof_validity:'REFUTED',anchor_assurance:'ANCHOR_UNCHECKED',reason:'CHECKPOINT_COMMITMENT_MISMATCH'};
  return cases.get(m.witness)?.expected;
}
function baselineOK(r,m){
  if(r.execution_error)return false;
  if(!m.controls.every(n=>isDeepStrictEqual(r.results[n],cases.get(n).expected)))return false;
  if(m.kind==='ADMISSION')return r.admission?.status===rawCases.get(m.witness).expected;
  if(m.kind==='DIAGNOSTIC')return r.host==='DISAGREEMENT';
  return isDeepStrictEqual(r.results[m.witness],expectedWitness(m));
}
const records=[];
try{
  for(const m of mutations){
    const dest=resolve(out,m.id);mkdirSync(dest);
    const conditioned=m.setup_edits?patch(originals,m.setup_edits):originals;
    if(!conditioned)throw new Error('Fault setup not applied');
    materialize(dest,conditioned);
    const baseline=await execute(dest,m);
    const changed=patch(conditioned,m.edits);let observation=null,classification;
    if(!baselineOK(baseline,m))classification='BASELINE_FAILED';
    else if(!changed)classification='NOT_APPLIED';
    else if(isDeepStrictEqual(hashes(changed),hashes(conditioned)))classification='NO_OP';
    else{
      materialize(dest,changed);observation=await execute(dest,m);
      if(observation.execution_error)classification='CRASHED';
      else if(Object.values(observation.results).some(v=>!v||typeof v.proof_validity!=='string') || Object.keys(observation.results).length!==Object.keys(baseline.results).length)classification='MISSING_OUTPUT';
      else if(!m.controls.every(n=>isDeepStrictEqual(observation.results[n],cases.get(n).expected)))classification='CONTROL_BROKEN';
      else if(m.kind==='ADMISSION')classification=observation.admission?.status==='ADMITTED'?'KILLED':'SURVIVED';
      else if(m.kind==='ASSURANCE')classification=observation.results[m.witness]?.anchor_assurance==='ANCHORED_VERIFIED'?'KILLED':'SURVIVED';
      else if(m.kind==='DIAGNOSTIC')classification=observation.host==='MATCH'?'DIAGNOSTIC_DETECTED':'SURVIVED';
      else classification=observation.results[m.witness]?.proof_validity==='VERIFIED'&&baseline.results[m.witness]?.proof_validity!=='VERIFIED'?'KILLED':'SURVIVED';
    }
    materialize(dest,conditioned);const restored=await execute(dest,m);
    const semanticRestoration=isDeepStrictEqual(baseline,restored);
    materialize(dest,originals);
    const byteRestoration=Object.entries(originals).every(([f,b])=>readFileSync(resolve(dest,f),'utf8')===b);
    const record={id:m.id,kind:m.kind,witness:m.witness,controls:m.controls,classification,
      source_original:hashes(originals),source_conditioned:hashes(conditioned),source_mutated:changed?hashes(changed):null,
      byte_restoration:byteRestoration,semantic_restoration:semanticRestoration,baseline,mutant:observation,restored,
      edits:m.edits,setup_edits:m.setup_edits??[],note:m.note??null};
    writeFileSync(resolve(dest,'observations.json'),JSON.stringify(record,null,2)+'\n');records.push(record);
    console.log(m.id+': '+classification);
  }
}finally{await browser.close();await new Promise(r=>server.close(r));}
const counts={};for(const r of records){const key=r.kind==='SENTINEL'?'sentinel':r.kind==='DIAGNOSTIC'?'diagnostic':r.kind==='CONTROLLED_NATIVE_FAULT'?'controlled_fault':'semantic';counts[key]??={};counts[key][r.classification]=(counts[key][r.classification]??0)+1;}
const passed=records.length===mutations.length&&records.every((r,i)=>r.byte_restoration&&r.semantic_restoration&&r.classification===(mutations[i].expected_classification??(r.kind==='DIAGNOSTIC'?'DIAGNOSTIC_DETECTED':'KILLED')));
const report={schema:'lens.chromium-physical-mutations.v0',passed,counts,records};
writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(out,'runtime.json'),JSON.stringify({node:process.version,platform:process.platform},null,2)+'\n');
if(!Object.entries(originals).every(([f,b])=>readFileSync(resolve(source,f),'utf8')===b))throw new Error('Root source changed');
console.log(JSON.stringify({passed,counts}));process.exitCode=passed?0:1;
