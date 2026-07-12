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
// Source: github.com/composed-evaluators/verdict-envelope samples/witness-proof.json (PR #2,
// merged 2026-07-06) — a real ThoughtProof Sentinel verdict, anchored via invinoveritas /witness.
export const GOLDEN: WitnessProof = {
  proof_payload: {
    schema: 'invinoveritas.witnessed_claim.v1',
    source: 'sentinel.thoughtproof.ai',
    body: "{\"apiVersion\":\"sentinel-api-0.1.0\",\"artifactSchema\":\"sentinel.verdict.canonical.v1\",\"confidence\":75,\"evaluatedAt\":1783377349,\"mode\":\"trade_reasoning\",\"models\":{\"primary\":\"serv-nano\",\"secondary\":\"serv-swift\"},\"objections\":[\"step_0: The agent's decision invokes three numerical thresholds: (1) price above SMA7, (2) price above SMA30, (3) RSI 56. The trace confirms: ETH $1800 > SMA7 $1750, ETH $1800 > SMA30 $1700, and RSI14 = 56. All thresholds are satisfied.\",\"step_1: The decision claims an uptrend thesis with ETH holding above rising SMAs. The trace shows: +4.2% 24h gain, +12% 7d gain, and price above both SMA7 and SMA30. All directional indicators point upward, consistent with the bullish framing.\",\"step_2: Classification of thesis claims: (1) 'ETH holds above rising SMA7 and SMA30' = factual, directly supported by trace. (2) 'RSI 56 leaves room for continuation' = interpretive judgment; RSI 56 is mid-range and does not signal overbought conditions, making the interpretation that momentum can continue logically sound. (3) 'measured long with invalidation below SMA7' = predictive/conditional; the invalidation level is derived from the stated support level (SMA7), creating internal coherence. No inferential defect detected: all claims either match the evidence or are reasonable interpretations/predictions grounded in the stated reasoning. [PROVENANCE DOWNGRADE: quote invalid or missing]\"],\"reasoning\":\"failScore=0.5 (1 critical step marginally unsupported). ALLOW with low confidence per ADR-0005 failScore-gate-decoupling.\\n\\n[sentinel-cascade primary_hold: primary=HOLD, secondary=CONDITIONAL_ALLOW]\",\"tier\":\"standard\",\"verdict\":\"ALLOW\",\"verificationId\":\"sent_fdfa8161fae649a5\"}",
    body_hash: '27f0accb9d5b02afbbc673b5d1adbf646a002220bece6b3d1fe764504074a84b',
    source_verification_note: 'source is self-declared by the caller who submitted this body, NOT cryptographically verified by invinoveritas.',
  },
};

export async function selfTest(): Promise<{ ok: boolean; got: string }> {
  const r = await recompute(GOLDEN);
  return { ok: r.verdict === 'verified-good', got: r.recomputedHash };
}
