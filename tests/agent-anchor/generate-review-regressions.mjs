// Locally authored reconstructions of Echo-Merlini's documented review scenarios.
// NOT Echo's unpublished fixtures or independent verifier. No verifier imports.
// Fixed public laboratory seeds are test material, never operational credentials.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
const kit=JSON.parse(readFileSync(new URL('./fixtures/kit-vectors.json',import.meta.url)));
const extra=JSON.parse(readFileSync(new URL('./fixtures/browser-vectors.json',import.meta.url)));
const C=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(C).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+C(v[k])).join(',')+'}';
const H=v=>createHash('sha256').update(v).digest('hex'),b64=v=>Buffer.from(v).toString('base64');
const key=n=>createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,n)]),format:'der',type:'pkcs8'});
const publicKey=n=>createPublicKey(key(n)).export({format:'der',type:'spki'}).toString('base64');
const P='chain-neutral.verifier-policy.v0\0',D='agent-action.local-manifest-checkpoint.v0\0';
const A='agent-action.local-manifest-log.v0',B='invinoveritas.decision_receipt.slot_log.v1';
const expected=(proof_validity,reason,profile=null,anchor_assurance='ANCHOR_UNCHECKED')=>({projection:'chain-neutral.result.v0',proof_validity,anchor_assurance,reason,native:profile?{profile,status:proof_validity,reason}:null});
const U=(reason,profile=null)=>expected('UNVERIFIABLE',reason,profile),R=(reason,profile=null)=>expected('REFUTED',reason,profile);
const vectors=[];
function authorize(v,domain=P){const bytes=C(v.policy.body);v.context.policy_id=v.env.policy_ref=H(bytes);v.policy.signature=sign(null,Buffer.from(domain+bytes),key(51)).toString('base64');}
function checkpoint(v,{seed=52,domain=D,select=true}={}){const cp=v.env.proof.checkpoint;cp.id=H(D+C(cp.body));cp.signature_base64=sign(null,Buffer.from(domain+C(cp.body)),key(seed)).toString('base64');if(select){v.env.checkpoint_id=v.policy.body.checkpoint_id=cp.id;authorize(v);}}
function add(name,base,change,want,boundary){
 const v=structuredClone([...kit.vectors,...extra.vectors].find(x=>x.name===base));
 if(!v)throw new Error('Unknown base '+base);
 v.env=JSON.parse(Buffer.from(v.input.envelope_base64,'base64'));v.policy=v.input.policy;change(v);
 const input={...v.input,policy:v.policy,envelope_base64:b64(C(v.env))};
 vectors.push({name:'REVIEW_'+name,boundary,input,context:v.context,expected:want,
  commitments:{subject_bytes_sha256:H(Buffer.from(input.subject_base64,'base64')),envelope_bytes_sha256:H(Buffer.from(input.envelope_base64,'base64')),policy_body_sha256:H(C(v.policy.body))}});
}
for(const attackerFirst of [true,false])add('DUPLICATE_KEY_'+(attackerFirst?'ATTACKER_FIRST':'ATTACKER_SECOND'),'A_VALID',v=>{
 const real=v.policy.body.checkpoint_keys[0],attacker={id:real.id,public_key_spki_base64:publicKey(71)};
 v.policy.body.checkpoint_keys=attackerFirst?[attacker,real]:[real,attacker];checkpoint(v,{seed:71});
},U('AMBIGUOUS_LOG_TRUST_ROOT',A),'Correctly authority-signed duplicate IDs in both orders; attacker-signed checkpoint is valid under attacker key, not real key');
add('ATTACKER_CHECKPOINT_REAL_ID','A_VALID',v=>checkpoint(v,{seed:71}),R('CHECKPOINT_SIGNATURE_INVALID',A),'checkpoint key identity does not authorize a different signing key');
add('ENVELOPE_AUTHORITY_ONLY','A_VALID',v=>{v.env.authorities=structuredClone(v.context.authorities);v.context.authorities={};},U('POLICY_AUTHORITY_UNKNOWN'),'untrusted envelope cannot supply verifier authority');
add('CONTEXT_KEY_SWAP','A_VALID',v=>v.context.authorities[v.policy.authority_id]=publicKey(71),U('POLICY_SIGNATURE_INVALID'),'selected authority key binds policy authentication');
add('POLICY_NO_DOMAIN','A_VALID',v=>authorize(v,''),U('POLICY_SIGNATURE_INVALID'),'policy signature domain');
add('EMPTY_CHECKPOINT_KEYS','A_VALID',v=>{v.policy.body.checkpoint_keys=[];authorize(v);},U('LOG_TRUST_ROOT_MISSING',A),'authenticated policy still needs a checkpoint trust root');
add('CHECKPOINT_NO_DOMAIN','A_VALID',v=>checkpoint(v,{domain:''}),R('CHECKPOINT_SIGNATURE_INVALID',A),'checkpoint signature domain');
add('CHECKPOINT_POLICY_DOMAIN','A_VALID',v=>checkpoint(v,{domain:P}),R('CHECKPOINT_SIGNATURE_INVALID',A),'policy and checkpoint domains are distinct');
add('SIGNED_OTHER_LOG','A_VALID',v=>{v.env.proof.checkpoint.body.log_id='other/log';checkpoint(v);},R('LOG_IDENTITY_MISMATCH',A),'correctly signed selected checkpoint contradicts policy log');
add('WRONG_CHECKPOINT_SCHEMA','A_VALID',v=>{v.env.proof.checkpoint.body.schema='unsupported.v0';checkpoint(v);},U('CHECKPOINT_MALFORMED',A),'unknown native checkpoint profile is ungradable');
add('REQUIRED_CHAIN_MISSING','A_VALID',v=>{v.policy.body.require_chain=true;authorize(v);},U('CONSISTENCY_EVIDENCE_MISSING',A),'required manifest extension evidence is absent');
add('EXTRA_MANIFEST_SIBLING','A_VALID',v=>v.env.proof.proof.siblings.push({side:'right',hash:'0'.repeat(64)}),R('MERKLE_INCLUSION_INVALID',A),'extra native binary Merkle sibling');
add('MANIFEST_SIDE_CASE','A_VALID',v=>v.env.proof.proof.siblings[0].side='LEFT',R('MERKLE_INCLUSION_INVALID',A),'preserved native boolean rejection of malformed side');
add('COUNT_UINT32_WRAP','BROWSER_ODD_LEAF_VALID',v=>v.env.proof.proof.leafCount=2**32+3,R('CHECKPOINT_TREE_SIZE_MISMATCH',A),'count cannot wrap into the signed three-leaf tree size');
add('MANIFEST_UPPERCASE_HASH','A_VALID',v=>v.env.proof.proof.siblings[0].hash=v.env.proof.proof.siblings[0].hash.toUpperCase(),R('MERKLE_INCLUSION_INVALID',A),'preserved native boolean rejection of uppercase sibling');
add('EXTRA_SLOT_PATH','B_VALID_CHAIN',v=>v.env.proof.inclusion.merkle_path.push({side:'R',hash:'0'.repeat(64)}),R('SLOT_INCLUSION_INVALID',B),'extra ASCII-hex Merkle step');
add('SLOT_CRLF','B_VALID_CHAIN',v=>v.env.proof.snapshot=v.env.proof.snapshot.replaceAll('\n','\r\n'),R('SLOT_SNAPSHOT_INVALID',B),'snapshot lines must preserve canonical bytes');
add('SLOT_NO_FINAL_LF','B_VALID_CHAIN',v=>v.env.proof.snapshot=v.env.proof.snapshot.slice(0,-1),R('SLOT_SNAPSHOT_INVALID',B),'snapshot final newline');
add('SLOT_STRING_INDEX','B_VALID_CHAIN',v=>v.env.proof.index=String(v.env.proof.index),R('SLOT_POSITION_INVALID',B),'index must be an integer, no coercion');
const valid=structuredClone(kit.vectors.find(v=>v.name==='A_VALID').expected);
add('UNKNOWN_POLICY_MEMBER','A_VALID',v=>{v.policy.body.accept_any_root=true;authorize(v);},valid,'unknown authenticated policy members are ignored, not interpreted as authority');
add('PROFILE_MECHANISM_NARROWING','A_VALID',v=>{v.env.anchor_mechanism=v.policy.body.anchor_mechanism='snapshot-digest';authorize(v);},U('PROFILE_MECHANISM_UNSUPPORTED'),'browser pair allowlist intentionally narrows host acceptance');
add('SELECTED_LOG_CONTRADICTION','A_VALID',v=>v.env.log_id='other/log',R('LOG_IDENTITY_MISMATCH'),'selected log contradiction is determinate');
add('SELECTED_CHECKPOINT_CONTRADICTION','A_VALID',v=>v.env.checkpoint_id='0'.repeat(64),R('SELECTED_CHECKPOINT_MISMATCH'),'selected checkpoint contradiction is determinate');
add('SLOT_UPPERCASE_HASH','B_VALID_CHAIN',v=>v.env.proof.inclusion.merkle_path[0].hash=v.env.proof.inclusion.merkle_path[0].hash.toUpperCase(),U('SLOT_MALFORMED',B),'slot malformed sibling differs from preserved ReceiptOS boolean rejection');
add('SLOT_SIDE_CASE','B_VALID_CHAIN',v=>v.env.proof.inclusion.merkle_path[0].side='right',U('SLOT_MALFORMED',B),'slot uses literal L/R, not ReceiptOS left/right');
const broken=kit.vectors.find(v=>v.name==='CORRUPT_SIBLING');
const host_vectors=[
 {name:'REVIEW_HOST_VERIFIED_OVER_REFUTED',input:broken.input,context:broken.context,expected:broken.expected,host:valid,expected_comparison:'DISAGREEMENT'},
 {name:'REVIEW_HOST_EXTRA_FIELD',input:broken.input,context:broken.context,expected:broken.expected,host:{...valid,extra:true},expected_comparison:'MALFORMED'},
];
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:new URL('./fixtures/review-regressions-v0.json',import.meta.url);
writeFileSync(out,JSON.stringify({schema:'lens.browser-review-regressions.v0',provenance:{review:'https://github.com/trustless-ai/recompute-lens/pull/2#issuecomment-6376143028',authoring:'Local reconstructions from prose; not Echo original fixtures or independent verifier',reviewed_head:'84cf444537f9fdc028c355a830790fa80597f4aa',counts_note:'26 proof + 2 host cases; not a claim to reproduce the exact unpublished 23-probe set'},vectors,host_vectors},null,2)+'\n');
console.log(JSON.stringify({proof_vectors:vectors.length,host_vectors:host_vectors.length,oracle:'literal expected projections specified without invoking implementation'}));
