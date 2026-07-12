// invinoveritas-witness-v1 — a composed-evaluator verdict-envelope proof, recomputed in the browser.
//
// This recipe verifies the ANCHOR half of a composed artifact (see
// github.com/composed-evaluators/verdict-envelope): one party (e.g. ThoughtProof's Sentinel)
// produces a judgment body; invinoveritas anchors it via POST /witness, which hashes the exact
// bytes it received and signs a receipt. This recipe recomputes that anchor's byte-integrity
// claim — "this exact body was witnessed, unaltered" — the same "don't trust, recompute" bar
// as receiptos-c14n-v0, applied to a different profile.
//
// SCOPE, STATED HONESTLY (tri-state design law: never a bare green): this recipe verifies
// body_hash == sha256(body) — that the anchored bytes are exactly what the judge produced, byte-
// for-byte, untampered since the moment of anchoring. It does NOT yet verify the Nostr event's
// BIP-340/schnorr signature (that invinoveritas's key actually issued this specific receipt) —
// that needs a secp256k1/schnorr library this repo doesn't carry yet (same "RPC-backed ones come
// after" honesty as the browser-first roadmap note). Treat this recipe's verdict as "the body is
// intact," not "invinoveritas issued this" — the signature tier is a natural follow-up recipe.

export type TriState = 'verified-good' | 'verified-bad' | 'unverifiable';
export type LogKind = 'cmd' | 'step' | 'out' | 'ok' | 'bad' | 'warn' | 'dim';
export interface LogLine { kind: LogKind; text: string; }

export interface WitnessProof {
  proof_payload: {
    schema: string;
    source: string;
    body: string;        // JCS-canonicalized JSON string produced by the judge
    body_hash: string;    // sha256(body) — no "0x" prefix in this schema
    source_verification_note?: string;
  };
  event?: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: unknown[];
    content: string;
  };
}

export interface Result {
  profile: 'invinoveritas-witness-v1';
  log: LogLine[];
  recomputedHash: string;
  target: string | null;
  verdict: TriState;
  reason: string;
  vantageLimitation: string;
  signatureNote: string; // separate from vantageLimitation: what this recipe does NOT cover yet
}

export const PROFILE = 'invinoveritas-witness-v1' as const;

// Wording matches the actual proof's own source_verification_note + /review proof's
// vantage_limitation pattern — integrity ≠ testimony, same discipline as receiptos-c14n-v0.
export const VANTAGE_LIMITATION =
  'Recompute proves the anchored body is byte-identical to what was witnessed — that it has not ' +
  'been altered since. It does not confirm the body\'s CONTENT is sound (that is a separate ' +
  '/review judgment), and "source" inside the body is self-declared by the submitter, not ' +
  'cryptographically verified by invinoveritas.';

export const SIGNATURE_NOTE =
  'This recipe does not verify the Nostr event signature (BIP-340/schnorr against ' +
  'verifier_pubkey) — that would additionally prove invinoveritas itself issued this exact ' +
  'receipt, not just that the body is internally intact. Needs a secp256k1/schnorr library; ' +
  'tracked as a follow-up recipe, same as this kit\'s RPC-backed recipes being a later tier.';

const utf8 = (s: string) => new TextEncoder().encode(s);
const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', ab);
  return toHex(new Uint8Array(digest));
}

export async function recompute(proof: WitnessProof): Promise<Result> {
  const log: LogLine[] = [];
  const { body, body_hash: target } = proof.proof_payload;

  log.push({ kind: 'cmd', text: 'recompute · invinoveritas-witness-v1' });
  log.push({ kind: 'dim', text: 'profile: sha256(body) — body is the judge\'s JCS-canonicalized bytes, verbatim' });

  log.push({ kind: 'step', text: '[1] read proof_payload.body — the exact bytes the judge produced' });
  const bodyBytes = utf8(body);
  log.push({ kind: 'out', text: `${bodyBytes.length} UTF-8 bytes` });

  log.push({ kind: 'step', text: '[2] sha256( body bytes )' });
  const hex = await sha256Hex(bodyBytes);
  log.push({ kind: 'out', text: hex });

  let verdict: TriState;
  let reason: string;
  if (!target) {
    verdict = 'unverifiable';
    reason = 'No body_hash present on this proof to check against — recomputed only. Couldn\'t evaluate, which is its own verdict, never a pass.';
    log.push({ kind: 'warn', text: 'no target body_hash → UNVERIFIABLE' });
  } else if (hex.toLowerCase() === target.toLowerCase()) {
    verdict = 'verified-good';
    reason = 'The recomputed sha256 matches the proof\'s stated body_hash byte-for-byte.';
    log.push({ kind: 'step', text: '[3] compare recomputed vs target' });
    log.push({ kind: 'ok', text: `${hex}  ==  ${target}  → MATCH · verified-good` });
  } else {
    verdict = 'verified-bad';
    reason = 'The recomputed sha256 does NOT match the proof\'s stated body_hash — a determinate mismatch.';
    log.push({ kind: 'step', text: '[3] compare recomputed vs target' });
    log.push({ kind: 'bad', text: `${hex}  !=  ${target}  → MISMATCH · verified-bad` });
  }

  log.push({ kind: 'warn', text: 'signature NOT checked by this recipe — see signatureNote (body integrity only, not proof of who issued the anchor)' });

  return {
    profile: PROFILE, log, recomputedHash: hex, target: target || null,
    verdict, reason, vantageLimitation: VANTAGE_LIMITATION, signatureNote: SIGNATURE_NOTE,
  };
}

// --- conformance self-test: a real, live composed-evaluator sample -----------------------------
// Source: github.com/composed-evaluators/verdict-envelope samples/witness-proof-vta.json (PR #3,
// merged 2026-07-07) — the documented live-trading-agent verdict (VANRY blow-off-top fade,
// UNCERTAIN verdict), anchored via invinoveritas /witness. Swapped from the PR #2 sample per
// Raul's fixture note (2026-07-12): this is the vector actually documented, not the first one.
export const GOLDEN: WitnessProof = {
  proof_payload: {
    schema: 'invinoveritas.witnessed_claim.v1',
    source: 'sentinel.thoughtproof.ai',
    body: "{\"apiVersion\":\"sentinel-api-0.1.0\",\"artifactSchema\":\"sentinel.verdict.canonical.v1\",\"confidence\":100,\"evaluatedAt\":1783407984,\"mode\":\"trade_reasoning\",\"models\":{\"primary\":\"serv-nano\",\"secondary\":\"serv-swift\"},\"objections\":[\"step_0: The cited numerical thresholds are met by the visible evidence: 7d change is 186.85%, RSI14 is 92.91, and the thesis explicitly states $6.3B in 24h volume. No threshold is shown as unmet.\",\"step_1: The evidence is directionally consistent with the thesis's description of a strong upward move and parabolic rally. There is no contradiction in the visible trace.\",\"step_2: The thesis does not contradict itself: it identifies a blow-off-top setup, acknowledges the main counterargument, and explains that the short is sized modestly because of that uncertainty. The conclusion follows from the stated reasoning without unsupported leaps.\"],\"reasoning\":\"All critical steps adequately supported.\\n\\n[sentinel-cascade primary_hold: primary=HOLD, secondary=ALLOW]\",\"tier\":\"standard\",\"verdict\":\"UNCERTAIN\",\"verificationId\":\"sent_b982f4f28b0f4f03\"}",
    body_hash: 'b70758bd5592535c4f5634c7a7555f81b25890c107e724abd763790013e2fa1b',
    source_verification_note: "source is self-declared by the caller who submitted this body, NOT cryptographically verified by invinoveritas. This proof establishes WHEN this exact body was received and anchored, and WHAT it contains, byte-for-byte \u2014 it does not establish WHO actually authored it, and it carries no invinoveritas judgment about whether the content is sound.",
  },
};

export async function selfTest(): Promise<{ ok: boolean; got: string }> {
  const r = await recompute(GOLDEN);
  return { ok: r.verdict === 'verified-good', got: r.recomputedHash };
}
