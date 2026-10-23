// SPDX-License-Identifier: Apache-2.0
// Adapted from pipavlo82/receiptos-verify; exact upstream pins and changes in
// research/agent-action-anchor-browser-v0/SOURCE_PINS.json and THIRD_PARTY_NOTICES.md.
// Browser port: Uint8Array / Web Crypto; no Node, subprocess, fetch, or host verdict.
import { concat, utf8, verifyEd25519 } from './bytes.js';
import { canonicalize, equal, sha256, base64, keys } from './common.js';
import { buildManifest, verifyInclusion } from './capsule.js';

export const LOG_PROFILE='agent-action.local-manifest-log.v0';
export const CHECKPOINT_DOMAIN='agent-action.local-manifest-checkpoint.v0\0';
export function checkpointBytes(body) { return concat(utf8(CHECKPOINT_DOMAIN),canonicalize(body)); }
export const checkpointIdentity=body=>sha256(checkpointBytes(body));
export async function receiptLeaf(receiptRoot) {
  if(typeof receiptRoot!=='string'||!/^0x[0-9a-f]{64}$/.test(receiptRoot))throw new Error('RECEIPT_ROOT_MALFORMED');
  const bytes=utf8(receiptRoot);
  return {id:'receipt/'+receiptRoot.slice(2),digest:await sha256(bytes),size:bytes.length};
}
function admittedCheckpoint(c) {
  keys(c,['body','id','key_id','signature_base64']);
  keys(c.body,['schema','log_id','sequence','tree_size','merkle_root','previous_checkpoint_id']);
  if(c.body.schema!==LOG_PROFILE||typeof c.body.log_id!=='string'||!c.body.log_id
      ||!Number.isSafeInteger(c.body.sequence)||c.body.sequence<0
      ||!Number.isSafeInteger(c.body.tree_size)||c.body.tree_size<1
      ||c.body.tree_size>65535
      ||!/^[0-9a-f]{64}$/.test(c.body.merkle_root)||!/^[0-9a-f]{64}$/.test(c.id)
      ||!(c.body.previous_checkpoint_id===null||/^[0-9a-f]{64}$/.test(c.body.previous_checkpoint_id))
      ||typeof c.key_id!=='string'||!c.key_id||base64(c.signature_base64).length!==64)throw new Error('CHECKPOINT_MALFORMED');
}
async function authenticate(c,selection) {
  const selected=selection.trusted_keys?.find(k=>k.id===c.key_id);
  if(!selected)return {status:'UNVERIFIABLE',reason:'LOG_TRUST_ROOT_MISSING'};
  try {
    keys(selected,['id','public_key_spki_base64']);
    if(!await verifyEd25519(base64(selected.public_key_spki_base64),base64(c.signature_base64),checkpointBytes(c.body))) // GUARD: checkpoint-signature
      return {status:'REFUTED',reason:'CHECKPOINT_SIGNATURE_INVALID'};
    return {status:'VERIFIED',reason:'CHECKPOINT_SIGNATURE_VERIFIED_UNDER_SELECTED_KEY'};
  }catch { return {status:'UNVERIFIABLE',reason:'LOG_TRUST_ROOT_MALFORMED'}; }
}
async function recordsTree(records) {
  if(!Array.isArray(records)||!records.length)throw new Error('CONSISTENCY_RECORDS_MALFORMED');
  return buildManifest(records.map(r=>{keys(r,['id','bytes_base64']);return {id:r.id,bytes:base64(r.bytes_base64)};}));
}
export async function verifyAnchor(receiptRoot,evidence,selection,trace=[]) {
  const native={leaf_binding:'NOT_CHECKED',inclusion:'NOT_CHECKED',checkpoint_identity:'NOT_CHECKED',
    log_identity:'NOT_CHECKED',signature:'NOT_CHECKED',consistency:'NOT_SUPPLIED'};
  const answer=(status,reason)=>({profile:LOG_PROFILE,status,reason,native:{...native},
    established_scope:status==='VERIFIED'?'LOCAL_MANIFEST_INCLUSION_UNDER_CALLER_SELECTED_KEY':null,
    public_log_authenticity:'NOT_COVERED',claim_authorization:'NOT_COVERED',
    limitations:['A caller-selected laboratory key is not an independently authenticated public log.',
      'This sorted, count-bound manifest is not a Certificate Transparency append-only tree.',
      'Inclusion does not authorize a claim or prove external execution.']});
  try {
    if(!evidence)return answer('UNVERIFIABLE','LOG_PROOF_MISSING');
    if(!selection||selection.profile!==LOG_PROFILE||evidence.profile!==LOG_PROFILE)
      return answer('UNVERIFIABLE','LOG_PROFILE_UNSUPPORTED');
    keys(selection,['profile','log_id','checkpoint_id','trusted_keys','require_consistency'],['previous_checkpoint_id']);
    if(!Array.isArray(selection.trusted_keys)||typeof selection.require_consistency!=='boolean')throw new Error('LOG_SELECTION_MALFORMED');
    if(new Set(selection.trusted_keys.map(k=>k.id)).size!==selection.trusted_keys.length)throw new Error('AMBIGUOUS_LOG_TRUST_ROOT');
    keys(evidence,['profile','leaf','proof','checkpoint'],['consistency']);
    if(!evidence.checkpoint)return answer('UNVERIFIABLE','CHECKPOINT_MISSING');
    const c=evidence.checkpoint; admittedCheckpoint(c);
    if(!equal(evidence.leaf,await receiptLeaf(receiptRoot))) // GUARD: receipt-leaf-binding
      return answer('REFUTED','RECEIPT_LOG_LEAF_MISMATCH');
    native.leaf_binding='VERIFIED';
    if(evidence.proof?.leafCount!==c.body.tree_size) // GUARD: checkpoint-tree-size
      return answer('REFUTED','CHECKPOINT_TREE_SIZE_MISMATCH');
    if(!await verifyInclusion(evidence.leaf,evidence.proof,c.body.merkle_root,trace)) // GUARD: native-merkle-proof
      return answer('REFUTED','MERKLE_INCLUSION_INVALID');
    native.inclusion='VERIFIED';
    if(c.id!==await checkpointIdentity(c.body)) // GUARD: checkpoint-identity
      return answer('REFUTED','CHECKPOINT_IDENTITY_MISMATCH');
    if(!selection.checkpoint_id)return answer('UNVERIFIABLE','CHECKPOINT_SELECTION_MISSING');
    if(c.id!==selection.checkpoint_id) // GUARD: selected-checkpoint
      return answer('REFUTED','SELECTED_CHECKPOINT_MISMATCH');
    native.checkpoint_identity='VERIFIED';
    trace.push({kind:'out',text:`Checkpoint domain/body SHA-256: ${c.id}; independently selected checkpoint: ${selection.checkpoint_id}`});
    if(c.body.log_id!==selection.log_id) // GUARD: selected-log
      return answer('REFUTED','LOG_IDENTITY_MISMATCH');
    native.log_identity='VERIFIED';
    const auth=await authenticate(c,selection);native.signature=auth.status;
    trace.push({kind:'out',text:`Checkpoint Ed25519 under policy-selected key ${c.key_id}: ${auth.status}`});
    if(auth.status!=='VERIFIED') // GUARD: trusted-checkpoint
      return answer(auth.status,auth.reason);
    if(selection.require_consistency&&!evidence.consistency)return answer('UNVERIFIABLE','CONSISTENCY_EVIDENCE_MISSING');
    if(evidence.consistency) {
      const consistency=evidence.consistency;
      keys(consistency,['profile','previous_checkpoint','previous_records','current_records']);
      if(consistency.profile!=='agent-action.full-manifest-extension.v0')return answer('UNVERIFIABLE','CONSISTENCY_PROFILE_UNSUPPORTED');
      const previous=consistency.previous_checkpoint;admittedCheckpoint(previous);
      if(previous.id!==await checkpointIdentity(previous.body)||c.body.previous_checkpoint_id!==previous.id
        ||previous.body.log_id!==c.body.log_id||c.body.sequence!==previous.body.sequence+1
        ||(selection.previous_checkpoint_id&&selection.previous_checkpoint_id!==previous.id))
        return answer('REFUTED','CONSISTENCY_CHECKPOINT_CONFLICT');
      const previousAuth=await authenticate(previous,selection);
      if(previousAuth.status!=='VERIFIED')return answer(previousAuth.status,'PREVIOUS_'+previousAuth.reason);
      const oldTree=await recordsTree(consistency.previous_records),newTree=await recordsTree(consistency.current_records);
      if(oldTree.merkleRoot!==previous.body.merkle_root||oldTree.manifest.length!==previous.body.tree_size
        ||newTree.merkleRoot!==c.body.merkle_root||newTree.manifest.length!==c.body.tree_size)
        return answer('REFUTED','CONSISTENCY_MANIFEST_ROOT_MISMATCH');
      if(oldTree.manifest.some(old=>!newTree.manifest.some(now=>equal(old,now)))) // GUARD: manifest-extension
        return answer('REFUTED','CONSISTENCY_OLD_ENTRY_CHANGED');
      native.consistency='LOCAL_MANIFEST_EXTENSION_VERIFIED';
      trace.push({kind:'out',text:`Full-manifest extension: ${oldTree.manifest.length} -> ${newTree.manifest.length} entries; ${oldTree.merkleRoot} -> ${newTree.merkleRoot}`});
    }
    return answer('VERIFIED','LOCAL_CHECKPOINT_INCLUSION_VERIFIED');
  }catch(error) {return answer('UNVERIFIABLE',error.code??error.message??'LOG_EVIDENCE_MALFORMED');}
}
