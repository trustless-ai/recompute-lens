// SPDX-License-Identifier: CC0-1.0
// Browser adaptation of recompute-kit PR85 adapter.mjs @ b4537d7.
// The independently authored #85 result projection is retained in full.
import { parseStrict, canonicalize } from './strict-json.js';
import { sha256, fromBase64, concat, utf8, equalBytes, verifyEd25519 } from './bytes.js';
import { LOG_PROFILE, verifyAnchor } from './manifest.js';
import { SLOT, verifySlot } from './slot.js';
export { SLOT };
export const SUBJECT = 'agent-action.subject-record.v0';
export const CANON = 'receiptos.verify.canonical-json.v1';
export const ENVELOPE = 'chain-neutral.anchor-proof-envelope.v0';
export const MANIFEST = 'receiptos.manifest-proof.v0';
export const POLICY = 'chain-neutral.verifier-policy.v0';
const hex = x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
const exact = (x, fields) => x && typeof x === 'object' && !Array.isArray(x)
  && Object.keys(x).sort().join('|') === [...fields].sort().join('|');
const fields = ['profile','canonicalization','phase','claim','subject','action','scope','input','output','evidence','metadata'];
export async function admitSubject(raw) {
  const v = parseStrict(raw);
  if (!equalBytes(raw, canonicalize(v))) throw new Error('NON_CANONICAL_RECEIPT'); // GUARD raw-admission
  if (!exact(v, fields)) throw new Error('RECEIPT_SHAPE');
  if (v.profile !== SUBJECT || v.canonicalization !== CANON) throw new Error('RECEIPT_PROFILE_UNSUPPORTED');
  if (!['pre_action','post_action_record'].includes(v.phase)) throw new Error('RECEIPT_PHASE');
  for (const k of ['claim','subject','action','scope','input','output']) {
    if (v[k] !== null && (!exact(v[k], ['sha256']) || !hex(v[k].sha256))) throw new Error('COMMITMENT_SHAPE');
  }
  if (!Array.isArray(v.evidence) || v.evidence.some(x => !exact(x, ['sha256']) || !hex(x.sha256))) throw new Error('EVIDENCE_SHAPE');
  return '0x' + await sha256(raw); // Identity excludes NOTHING; never receiptos-c14n-v0.
}
async function authenticate(policy, configuration) {
  if (!policy || !configuration?.authorities) throw new Error('POLICY_MISSING');
  const body = policy.body;
  if (!body || body.profile !== POLICY) throw new Error('POLICY_PROFILE_UNSUPPORTED');
  const id = await sha256(canonicalize(body));
  if (id !== configuration.policy_id) throw new Error('POLICY_SELECTION_MISMATCH'); // GUARD policy-selection
  const key = Object.hasOwn(configuration.authorities, policy.authority_id) ? configuration.authorities[policy.authority_id] : null;
  if (!key) throw new Error('POLICY_AUTHORITY_UNKNOWN');
  if (!await verifyEd25519(fromBase64(key), fromBase64(policy.signature), concat(utf8(POLICY + '\0'), canonicalize(body)))) throw new Error('POLICY_SIGNATURE_INVALID'); // GUARD policy-signature
  if (body.subject_profile !== SUBJECT || !hex(body.checkpoint_id) || !body.log_id || typeof body.require_chain !== 'boolean'
    || typeof body.require_timestamp !== 'boolean' || !['local-ed25519','snapshot-digest'].includes(body.anchor_mechanism)) throw new Error('POLICY_SHAPE');
  return { body, id };
}
// configuration is a separate verifier-selected argument, never read from input
// or envelope metadata. Recipes require explicit configuration; no trusted default.
export async function evaluateProof(input, configuration, trace = []) {
  let native = null;
  const answer = (proof_validity, reason, anchor_assurance = 'ANCHOR_UNCHECKED') => ({
    projection: 'chain-neutral.result.v0', proof_validity, anchor_assurance, reason,
    native: native ? { profile: native.profile, status: native.status, reason: native.reason } : null,
  });
  try {
    if (!input || typeof input !== 'object') return answer('UNVERIFIABLE', 'MALFORMED_INPUT');
    const raw = input.subject_bytes ?? fromBase64(input.subject_base64);
    const id = await admitSubject(raw);
    trace.push({ kind: 'out', text: 'Strict canonical subject bytes SHA-256: ' + id });
    const e = parseStrict(input.envelope_bytes ?? fromBase64(input.envelope_base64));
    if (e?.profile !== ENVELOPE || ![MANIFEST, SLOT].includes(e.proof_profile)) return answer('UNVERIFIABLE', 'PROOF_PROFILE_UNSUPPORTED');
    if (e.subject_profile !== SUBJECT || e.subject_id !== id) return answer('REFUTED', 'RECEIPT_IDENTITY_MISMATCH'); // GUARD subject-binding
    const p = await authenticate(input.policy, configuration);
    trace.push({ kind: 'out', text: 'Ed25519 policy authenticated under independently selected configuration: ' + p.id });
    if (typeof e.log_id !== 'string' || !e.log_id || typeof p.body.log_id !== 'string' || !p.body.log_id) return answer('UNVERIFIABLE', 'LOG_IDENTITY_MALFORMED');
    if (e.policy_ref !== p.id || p.body.proof_profile !== e.proof_profile) return answer('UNVERIFIABLE', 'POLICY_BINDING_MISMATCH');
    if (e.log_id !== p.body.log_id) return answer('REFUTED', 'LOG_IDENTITY_MISMATCH');
    if (e.checkpoint_id !== p.body.checkpoint_id) return answer('REFUTED', 'SELECTED_CHECKPOINT_MISMATCH'); // GUARD selected-checkpoint
    if (e.anchor_mechanism !== p.body.anchor_mechanism) return answer('UNVERIFIABLE', 'ANCHOR_MECHANISM_UNSUPPORTED');
    // Browser supported mechanism/profile pairs are explicit. Cross-label policies
    // are a documented narrower admission than the #85 host adapter.
    if ((e.proof_profile === MANIFEST ? 'local-ed25519' : 'snapshot-digest') !== e.anchor_mechanism) return answer('UNVERIFIABLE', 'PROFILE_MECHANISM_UNSUPPORTED');
    if (e.proof_profile === MANIFEST) {
      native = await verifyAnchor(id, e.proof, { profile: LOG_PROFILE, log_id: p.body.log_id,
        checkpoint_id: e.checkpoint_id, trusted_keys: p.body.checkpoint_keys, require_consistency: p.body.require_chain }, trace);
    } else {
      const s = e.proof, claim = { subject_profile: SUBJECT, subject_id: id };
      if (!s?.inclusion?.line) return answer('UNVERIFIABLE', 'SLOT_MALFORMED');
      if (s.inclusion.line.scope !== 'decider' || s.inclusion.line.claim_sha256 !== await sha256(canonicalize(claim))) return answer('REFUTED', 'SLOT_RECEIPT_BINDING_MISMATCH');
      if (s.inclusion.log_root !== e.checkpoint_id) return answer('REFUTED', 'CHECKPOINT_COMMITMENT_MISMATCH');
      if (p.body.require_chain && !s.previous) return answer('UNVERIFIABLE', 'CHAIN_EVIDENCE_MISSING');
      native = await verifySlot(s, trace);
      if (native.status === 'VERIFIED') {
        if (!hex(native.log_root)) return answer('UNVERIFIABLE', 'NATIVE_REPORT_MALFORMED');
        if (native.log_root !== e.checkpoint_id) return answer('REFUTED', 'CHECKPOINT_COMMITMENT_MISMATCH'); // GUARD native-slot-checkpoint
      }
    }
    trace.push({ kind: 'out', text: 'Browser ' + native.profile + ': ' + native.status + ' / ' + native.reason });
    if (native.status !== 'VERIFIED') return answer(native.status, native.reason); // GUARD native-proof-validity
    if (e.timestamp !== null) return answer('UNVERIFIABLE', 'TIMESTAMP_VERIFIER_NOT_AVAILABLE'); // GUARD timestamp
    if (p.body.require_timestamp) return answer('UNVERIFIABLE', 'TIMESTAMP_EVIDENCE_MISSING');
    const chained = e.proof_profile === MANIFEST ? native.native.consistency === 'LOCAL_MANIFEST_EXTENSION_VERIFIED' : Boolean(e.proof.previous);
    return answer('VERIFIED', 'BOUNDED_INCLUSION_VERIFIED', chained ? 'CHAIN_CONSISTENT' : 'ANCHOR_UNCHECKED'); // GUARD assurance
  } catch (error) {
    // Data/capability failures never become success or semantic mutation kills.
    const reason = typeof error.code === 'string' ? error.code
      : error.name === 'NotSupportedError' ? 'WEBCRYPTO_ED25519_UNAVAILABLE'
      : error.name === 'DataError' || error.name === 'OperationError' ? 'CRYPTO_INPUT_MALFORMED'
      : error.message || 'MALFORMED_INPUT';
    return answer('UNVERIFIABLE', reason);
  }
}
export function compareHost(browser, host) {
  if (host == null) return 'NOT_SUPPLIED';
  if (!exact(host, ['projection','proof_validity','anchor_assurance','reason','native'])
    || host.projection !== 'chain-neutral.result.v0' || !['VERIFIED','REFUTED','UNVERIFIABLE'].includes(host.proof_validity)
    || !['ANCHOR_UNCHECKED','CHAIN_CONSISTENT','ANCHORED_VERIFIED'].includes(host.anchor_assurance) || typeof host.reason !== 'string'
    || host.native !== null && (!exact(host.native,['profile','status','reason']) || typeof host.native.profile !== 'string'
      || !['VERIFIED','REFUTED','UNVERIFIABLE'].includes(host.native.status) || typeof host.native.reason !== 'string')) return 'MALFORMED';
  // Host data is diagnostic only: it can neither override a refusal nor supply
  // verification that has not executed locally.
  try { return equalBytes(canonicalize(browser), canonicalize(host)) ? 'MATCH' : 'DISAGREEMENT'; }
  catch { return 'MALFORMED'; }
}
