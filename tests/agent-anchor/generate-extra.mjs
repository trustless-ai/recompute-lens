// Independent fixture producer: no imports from browser implementation or verifier.
// Public deterministic laboratory keys from published #85; not credentials.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, createPrivateKey, sign } from 'node:crypto';
const kit = JSON.parse(readFileSync(new URL('./fixtures/kit-vectors.json', import.meta.url)));
const C = v => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v)
  ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';
const H = v => createHash('sha256').update(v).digest('hex');
const b64 = v => Buffer.from(v).toString('base64');
const key = n => createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,n)]),format:'der',type:'pkcs8' });
const native = (profile, status, reason) => ({ profile, status, reason });
const A = 'agent-action.local-manifest-log.v0', B = 'invinoveritas.decision_receipt.slot_log.v1';
const expected = (proof_validity, reason, n = null, anchor_assurance = 'ANCHOR_UNCHECKED') => ({ projection:'chain-neutral.result.v0',proof_validity,anchor_assurance,reason,native:n });
const vectors = [];
function authorize(v) {
  const id = H(C(v.policy.body)); v.context.policy_id = id; v.env.policy_ref = id;
  v.policy.signature = sign(null,Buffer.from('chain-neutral.verifier-policy.v0\0'+C(v.policy.body)),key(51)).toString('base64');
}
function add(name, base, change, want, boundary) {
  const original = structuredClone(kit.vectors.find(v => v.name === base));
  const v = { ...original, env: JSON.parse(Buffer.from(original.input.envelope_base64,'base64')), policy:original.input.policy };
  change(v);
  vectors.push({name,boundary,input:{...v.input,policy:v.policy,envelope_base64:b64(C(v.env))},context:v.context,expected:want});
}
add('BROWSER_MODIFIED_CANONICAL_BYTES','A_VALID',v=>{const s=JSON.parse(Buffer.from(v.input.subject_base64,'base64'));s.metadata={changed:true};v.input.subject_base64=b64(C(s));},expected('REFUTED','RECEIPT_IDENTITY_MISMATCH'),'original subject bytes');
add('BROWSER_MISSING_PROOF','A_VALID',v=>v.env.proof=null,expected('UNVERIFIABLE','LOG_PROOF_MISSING',native(A,'UNVERIFIABLE','LOG_PROOF_MISSING')),'missing evidence');
add('BROWSER_MISSING_CHECKPOINT','A_VALID',v=>v.env.proof.checkpoint=null,expected('UNVERIFIABLE','CHECKPOINT_MISSING',native(A,'UNVERIFIABLE','CHECKPOINT_MISSING')),'missing checkpoint');
add('BROWSER_SLOT_WRONG_COUNT','B_VALID_CHAIN',v=>v.env.proof.count=1,expected('REFUTED','SLOT_POSITION_INVALID',native(B,'REFUTED','SLOT_POSITION_INVALID')),'slot count');
add('BROWSER_SLOT_INVALID_PATH','B_VALID_CHAIN',v=>v.env.proof.inclusion.merkle_path[0].hash='0'.repeat(64),expected('REFUTED','SLOT_INCLUSION_INVALID',native(B,'REFUTED','SLOT_INCLUSION_INVALID')),'slot siblings');
add('BROWSER_SLOT_SIDE_ALIAS','B_VALID_CHAIN',v=>v.env.proof.inclusion.merkle_path[0].side='left',expected('UNVERIFIABLE','SLOT_MALFORMED',native(B,'UNVERIFIABLE','SLOT_MALFORMED')),'explicit L/R browser subset; upstream treats any non-R as left');
add('BROWSER_CROSS_LABEL_MECHANISM','A_VALID',v=>{v.env.anchor_mechanism=v.policy.body.anchor_mechanism='snapshot-digest';authorize(v);},expected('UNVERIFIABLE','PROFILE_MECHANISM_UNSUPPORTED'),'explicit supported mechanism/profile pairs');
add('BROWSER_INPUT_SUPPLIED_CONFIGURATION','A_VALID',v=>{v.input.configuration=structuredClone(v.context);v.context=null;},expected('UNVERIFIABLE','POLICY_MISSING'),'separate caller configuration required');
add('BROWSER_UNKNOWN_AUTHORITY','A_VALID',v=>v.policy.authority_id='unaccepted',expected('UNVERIFIABLE','POLICY_AUTHORITY_UNKNOWN'),'selected authority lookup');
add('BROWSER_BAD_CHECKPOINT_ID','A_VALID',v=>v.env.proof.checkpoint.id='0'.repeat(64),expected('REFUTED','CHECKPOINT_IDENTITY_MISMATCH',native(A,'REFUTED','CHECKPOINT_IDENTITY_MISMATCH')),'checkpoint body digest');
add('BROWSER_BAD_CHECKPOINT_LOG','A_VALID',v=>{
  const cp=v.env.proof.checkpoint;cp.body.log_id='other';
  cp.id=H('agent-action.local-manifest-checkpoint.v0\0'+C(cp.body));
  cp.signature_base64=sign(null,Buffer.from('agent-action.local-manifest-checkpoint.v0\0'+C(cp.body)),key(52)).toString('base64');
  v.env.checkpoint_id=v.policy.body.checkpoint_id=cp.id;authorize(v);
},expected('REFUTED','LOG_IDENTITY_MISMATCH',native(A,'REFUTED','LOG_IDENTITY_MISMATCH')),'checkpoint log differs despite valid signature');
// Independent manifest producer for duplicate-odd and count-binding boundaries.
function tree(entries) {
  const d=Buffer.from('receiptos.verify.capsule-merkle.v1\0');
  const leaf=e=>H(Buffer.concat([d,Buffer.from([0]),Buffer.from(C(e))]));
  const pair=(a,b)=>H(Buffer.concat([d,Buffer.from([1]),Buffer.from(a,'hex'),Buffer.from(b,'hex')]));
  const manifest=entries.map(e=>({id:e.id,digest:H(e.bytes),size:Buffer.byteLength(e.bytes)})).sort((a,b)=>a.id<b.id?-1:1);
  const levels=[manifest.map(leaf)];while(levels.at(-1).length>1){const r=levels.at(-1),n=[];for(let i=0;i<r.length;i+=2)n.push(pair(r[i],r[i+1]??r[i]));levels.push(n);}
  const count=Buffer.alloc(4);count.writeUInt32BE(manifest.length);
  const root=H(Buffer.concat([d,Buffer.from([2]),count,Buffer.from(levels.at(-1)[0],'hex')]));
  let index=manifest.findIndex(e=>e.id.startsWith('receipt/')),cursor=index;
  const siblings=[];for(const row of levels.slice(0,-1)){const left=cursor%2===1;siblings.push({side:left?'left':'right',hash:row[left?cursor-1:cursor+1]??row[cursor]});cursor=Math.floor(cursor/2);}
  return {manifest,root,index,siblings,pair,leaf,d};
}
function odd(v, mode='valid') {
  const id=v.env.subject_id;
  const t=tree([{id:'a/one',bytes:'one'},{id:'b/two',bytes:'two'},{id:'receipt/'+id.slice(2),bytes:id}]);
  v.env.proof.leaf=t.manifest[t.index];v.env.proof.proof={schema:'receiptos.verify.capsule-inclusion.v1',index:t.index,leafCount:3,siblings:t.siblings};
  const cp=v.env.proof.checkpoint;
  cp.body.merkle_root=t.root;
  if(mode==='bad-odd'){
    t.siblings[0].hash='0'.repeat(64);let h=t.leaf(v.env.proof.leaf);
    for(const s of t.siblings)h=s.side==='left'?t.pair(s.hash,h):t.pair(h,s.hash);
    const count=Buffer.alloc(4);count.writeUInt32BE(3);
    cp.body.merkle_root=H(Buffer.concat([t.d,Buffer.from([2]),count,Buffer.from(h,'hex')]));
  }
  if(mode==='bad-size')cp.body.tree_size=4;
  cp.id=H('agent-action.local-manifest-checkpoint.v0\0'+C(cp.body));
  cp.signature_base64=sign(null,Buffer.from('agent-action.local-manifest-checkpoint.v0\0'+C(cp.body)),key(52)).toString('base64');
  v.env.checkpoint_id=v.policy.body.checkpoint_id=cp.id;authorize(v);
}
add('BROWSER_ODD_LEAF_VALID','A_VALID',v=>odd(v),expected('VERIFIED','BOUNDED_INCLUSION_VERIFIED',native(A,'VERIFIED','LOCAL_CHECKPOINT_INCLUSION_VERIFIED')),'positive odd-leaf producer');
add('BROWSER_ODD_LEAF_INVALID','A_VALID',v=>odd(v,'bad-odd'),expected('REFUTED','MERKLE_INCLUSION_INVALID',native(A,'REFUTED','MERKLE_INCLUSION_INVALID')),'self-consistent signed root does not waive duplicate-odd rule');
add('BROWSER_SIGNED_SIZE_CONFLICT','A_VALID',v=>odd(v,'bad-size'),expected('REFUTED','CHECKPOINT_TREE_SIZE_MISMATCH',native(A,'REFUTED','CHECKPOINT_TREE_SIZE_MISMATCH')),'signed tree size binds native leaf count');
function signCheckpoint(v, updateSelection=true) {
  const cp=v.env.proof.checkpoint;
  cp.id=H('agent-action.local-manifest-checkpoint.v0\0'+C(cp.body));
  cp.signature_base64=sign(null,Buffer.from('agent-action.local-manifest-checkpoint.v0\0'+C(cp.body)),key(52)).toString('base64');
  if(updateSelection){v.env.checkpoint_id=v.policy.body.checkpoint_id=cp.id;authorize(v);}
}
add('BROWSER_NATIVE_UNSELECTED_CHECKPOINT','A_VALID',v=>{v.env.proof.checkpoint.body.sequence++;signCheckpoint(v,false);},expected('REFUTED','SELECTED_CHECKPOINT_MISMATCH',native(A,'REFUTED','SELECTED_CHECKPOINT_MISMATCH')),'native checkpoint selection');
add('BROWSER_FAKE_CHECKPOINT_ID_SELECTED','A_VALID',v=>{v.env.proof.checkpoint.id=v.env.checkpoint_id=v.policy.body.checkpoint_id='0'.repeat(64);authorize(v);},expected('REFUTED','CHECKPOINT_IDENTITY_MISMATCH',native(A,'REFUTED','CHECKPOINT_IDENTITY_MISMATCH')),'signed policy cannot waive checkpoint body identity');
add('BROWSER_WRONG_ALGORITHM_SIGNED','A_VALID',v=>{
  const d=Buffer.from('receiptos.verify.capsule-merkle.v1\0');let top=H(Buffer.concat([d,Buffer.from([0]),Buffer.from(C(v.env.proof.leaf))]));
  for(const s of v.env.proof.proof.siblings)top=H(s.side==='left'?s.hash+top:top+s.hash);
  const count=Buffer.alloc(4);count.writeUInt32BE(v.env.proof.proof.leafCount);
  v.env.proof.checkpoint.body.merkle_root=H(Buffer.concat([d,Buffer.from([2]),count,Buffer.from(top,'hex')]));signCheckpoint(v);
},expected('REFUTED','MERKLE_INCLUSION_INVALID',native(A,'REFUTED','MERKLE_INCLUSION_INVALID')),'wrong algorithm under a self-consistent authenticated checkpoint');
add('BROWSER_SLOT_FALSE_SNAPSHOT','B_VALID_CHAIN',v=>{
  const p=v.env.proof,lines=p.snapshot.trim().split('\n').map(JSON.parse);lines[1].decider_sig='tampered';p.snapshot=lines.map(C).join('\n')+'\n';p.previous=null;v.policy.body.require_chain=false;authorize(v);
},expected('REFUTED','SLOT_SNAPSHOT_INVALID',native(B,'REFUTED','SLOT_SNAPSHOT_INVALID')),'full snapshot root independently checks unselected entries');
add('BROWSER_BROKEN_PROOF_WITH_TIMESTAMP','CORRUPT_SIBLING',v=>v.env.timestamp={ots_status:'confirmed'},expected('REFUTED','MERKLE_INCLUSION_INVALID',native(A,'REFUTED','MERKLE_INCLUSION_INVALID')),'broken inclusion remains REFUTED before timestamp availability');
add('BROWSER_MANIFEST_REQUIRED_HISTORY','A_CHAIN_VALID',v=>delete v.env.proof.consistency,expected('UNVERIFIABLE','CONSISTENCY_EVIDENCE_MISSING',native(A,'UNVERIFIABLE','CONSISTENCY_EVIDENCE_MISSING')),'policy-required full-manifest extension');
add('BROWSER_MANIFEST_CHANGED_OLD_ENTRY','A_CHAIN_VALID',v=>{
  const consistency=v.env.proof.consistency,previous=consistency.previous_checkpoint;
  consistency.previous_records[0].bytes_base64=b64('changed prior record');
  const priorTree=tree(consistency.previous_records.map(r=>({id:r.id,bytes:Buffer.from(r.bytes_base64,'base64')})));
  previous.body.merkle_root=priorTree.root;
  previous.id=H('agent-action.local-manifest-checkpoint.v0\0'+C(previous.body));
  previous.signature_base64=sign(null,Buffer.from('agent-action.local-manifest-checkpoint.v0\0'+C(previous.body)),key(52)).toString('base64');
  v.env.proof.checkpoint.body.previous_checkpoint_id=previous.id;signCheckpoint(v);
},expected('REFUTED','CONSISTENCY_OLD_ENTRY_CHANGED',native(A,'REFUTED','CONSISTENCY_OLD_ENTRY_CHANGED')),'recomputed and signed old/new roots do not waive entry preservation');
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:new URL('./fixtures/browser-vectors.json',import.meta.url);
writeFileSync(out,JSON.stringify({schema:'lens.browser-extra-vectors.v0',vectors},null,2)+'\n');
console.log('Authored '+vectors.length+' browser expectations without invoking a verifier.');
