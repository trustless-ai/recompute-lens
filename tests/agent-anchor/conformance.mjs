// Expectations are frozen independently authored #85 data, never adapter output.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { evaluateProof, admitSubject, compareHost } from '../../src/recompute/agent-anchor/proof.js';
import { admissionCases } from './admission-cases.mjs';
import { checkFile, checkChain } from '../../src/recompute/agent-anchor/slot.js';
const corpus = JSON.parse(readFileSync(new URL('./fixtures/kit-vectors.json', import.meta.url)));
const slots = JSON.parse(readFileSync(new URL('./fixtures/slot-vectors.json', import.meta.url)));
const extra = JSON.parse(readFileSync(new URL('./fixtures/browser-vectors.json', import.meta.url)));
const review = JSON.parse(readFileSync(new URL('./fixtures/review-regressions-v0.json', import.meta.url)));
const results = {}, failures = [];
for (const v of [...corpus.vectors, ...extra.vectors, ...review.vectors]) {
  const result = await evaluateProof(v.input, v.context); // no expected fields cross this boundary
  results[v.name] = result;
  if (!isDeepStrictEqual(result, v.expected)) failures.push({ name: v.name, expected: v.expected, actual: result });
}
const admission = {};
for (const v of admissionCases(new Uint8Array(Buffer.from(corpus.vectors[0].input.subject_base64,'base64')))) {
  let got;
  try { const id=await admitSubject(v.raw);got='ADMITTED';if(id!=='0x'+createHash('sha256').update(v.raw).digest('hex'))got='IDENTITY_MISMATCH'; }
  catch(e) {got=e.code||e.message;}
  admission[v.name]=got;
  if(got!==v.expected)failures.push({name:v.name,expected:v.expected,actual:got});
}
const original=corpus.vectors[0].expected;
const host_regressions={};
for(const v of review.host_vectors){
  const local=await evaluateProof(v.input,v.context),before=structuredClone(local);
  const comparison=compareHost(local,v.host);
  host_regressions[v.name]={local,comparison,local_unchanged:isDeepStrictEqual(before,local)};
  if(!isDeepStrictEqual(local,v.expected)||comparison!==v.expected_comparison||!isDeepStrictEqual(before,local))failures.push({name:v.name,actual:host_regressions[v.name]});
}
const diagnostic={same:compareHost(original,structuredClone(original)),different:compareHost(original,{...original,proof_validity:'REFUTED'}),missing:compareHost(original,null),malformed:compareHost(original,{status:'VERIFIED'})};
if(diagnostic.same!=='MATCH'||diagnostic.different!=='DISAGREEMENT'||diagnostic.missing!=='NOT_SUPPLIED'||diagnostic.malformed!=='MALFORMED')failures.push({name:'HOST_DIAGNOSTIC',actual:diagnostic});
const slotResults = {};
for (const v of slots.vectors) {
  let got;
  try {
    const r = await checkFile(v.file);
    if (v.prev != null) await checkChain(r.header, r.lines, v.prev);
    got = { status: 'ok', root: r.root };
  } catch { got = { status: 'reject' }; }
  slotResults[v.id] = got;
  if (got.status !== v.expect || got.status === 'ok' && got.root !== v.log_root) failures.push({ name: v.id, expected: v.expect, actual: got });
}
const report = { schema: 'lens.agent-anchor.conformance.v0', passed: !failures.length,
  kit_count: corpus.vectors.length, browser_count: extra.vectors.length, admission_count:Object.keys(admission).length,
  slot_count: slots.vectors.length, review_count: review.vectors.length, host_regression_count: review.host_vectors.length,
  results, host_regressions, admission, diagnostic, slot_results: slotResults, failures };
const encoded = JSON.stringify(report, null, 2) + '\n';
const out = process.argv.indexOf('--out');
if (out !== -1) { const dest = resolve(process.argv[out + 1]); mkdirSync(dest, { recursive: true }); writeFileSync(resolve(dest, 'conformance.json'), encoded); }
console.log(JSON.stringify({ passed: report.passed, kit: report.kit_count, slot: report.slot_count,
  sha256: createHash('sha256').update(encoded).digest('hex'), failures }));
process.exitCode = failures.length ? 1 : 0;
