// Independent signature/identity premise check; no browser verifier imports.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';
const doc=JSON.parse(readFileSync(new URL('./fixtures/review-regressions-v0.json',import.meta.url)));
const C=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(C).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+C(v[k])).join(',')+'}';
const H=x=>createHash('sha256').update(x).digest('hex');
const key=x=>createPublicKey({key:Buffer.from(x,'base64'),format:'der',type:'spki'});
const names=['REVIEW_DUPLICATE_KEY_ATTACKER_FIRST','REVIEW_DUPLICATE_KEY_ATTACKER_SECOND'];
const result=[];
for(const name of names){
 const v=doc.vectors.find(x=>x.name===name);assert(v);const e=JSON.parse(Buffer.from(v.input.envelope_base64,'base64')),p=v.input.policy,cp=e.proof.checkpoint;
 assert.equal(verify(null,Buffer.from('chain-neutral.verifier-policy.v0\0'+C(p.body)),key(v.context.authorities[p.authority_id]),Buffer.from(p.signature,'base64')),true);
 assert.equal(H(C(p.body)),v.context.policy_id);assert.equal(e.policy_ref,v.context.policy_id);
 assert.equal(H('agent-action.local-manifest-checkpoint.v0\0'+C(cp.body)),cp.id);assert.equal(cp.id,p.body.checkpoint_id);assert.equal(e.checkpoint_id,cp.id);
 assert.equal(p.body.checkpoint_keys.length,2);assert.equal(new Set(p.body.checkpoint_keys.map(k=>k.id)).size,1);
 const signatures=p.body.checkpoint_keys.map(k=>verify(null,Buffer.from('agent-action.local-manifest-checkpoint.v0\0'+C(cp.body)),key(k.public_key_spki_base64),Buffer.from(cp.signature_base64,'base64')));
 assert.deepEqual(signatures,name.endsWith('FIRST')?[true,false]:[false,true]);
 assert.equal(v.expected.proof_validity,'UNVERIFIABLE');assert.equal(v.expected.reason,'AMBIGUOUS_LOG_TRUST_ROOT');
 result.push({name,policy_signature_valid:true,checkpoint_identity_selected:true,checkpoint_signature_by_key_order:signatures});
}
console.log(JSON.stringify({passed:true,checks:result}));
