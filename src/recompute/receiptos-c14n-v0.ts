// receiptos-c14n-v0 — the ReceiptOS §2.8 canonicalization profile, recomputed in the browser.
//
// This is a CONFORMANT implementation of the profile, not a reference to be trusted: it earns
// "conformant" by reproducing the profile's golden vector (see selfTest), exactly like any other
// port. The lens runs it on YOUR machine and NARRATES every operation with the real intermediate
// values — and hands you the exact bytes so you can re-hash them in any tool. Don't trust. Recompute.
//
//   receipt_root = 0x + sha256( C( A(E) ) )
//     A(E) = strip the top-level "anchor" field (root must not depend on its own anchored value)
//     C(·) = recursive: sort keys, compact separators, literal UTF-8 (non-ASCII NOT \u-escaped),
//            drop absent keys, no whitespace — JCS (RFC 8785) by reference; anchor-strip is the
//            sole normative delta.

export type TriState = 'verified-good' | 'verified-bad' | 'unverifiable';
export type LogKind = 'cmd' | 'step' | 'out' | 'ok' | 'bad' | 'warn' | 'dim';
export interface LogLine { kind: LogKind; text: string; }

export interface Result {
  profile: 'receiptos-c14n-v0';
  log: LogLine[];
  canonical: string;       // the exact bytes hashed — a skeptic re-hashes these
  canonicalHex: string;
  recomputedRoot: string;
  target: string | null;
  verdict: TriState;
  reason: string;
  vantageLimitation: string;
}

export const PROFILE = 'receiptos-c14n-v0' as const;

// Integrity ≠ testimony. Reused wording pattern from the /review proof's `vantage_limitation`.
export const VANTAGE_LIMITATION =
  'Recompute proves record integrity — that this record reproduces from its own inputs. It does ' +
  'not confirm the record reflects reality, only that it was not altered after the fact.';

const utf8 = (s: string) => new TextEncoder().encode(s);
const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
const hexSpaced = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');

// C(·) — recursive sorted-key / compact / literal-UTF-8 canonicalization.
export function canonicalize(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(o[k])).join(',') + '}';
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // slice to a concrete ArrayBuffer (avoids the ArrayBufferLike/SharedArrayBuffer DOM-types friction)
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', ab);
  return toHex(new Uint8Array(digest));
}

function stripAnchor(e: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const k of Object.keys(e)) if (k !== 'anchor') body[k] = e[k];
  return body;
}

export async function recompute(
  evidence: Record<string, unknown>,
  expectedRoot: string | null,
): Promise<Result> {
  const log: LogLine[] = [];
  const raw = JSON.stringify(evidence);

  log.push({ kind: 'cmd', text: 'recompute · receiptos-c14n-v0' });
  log.push({ kind: 'dim', text: 'profile: JCS (RFC 8785) canonicalization + top-level anchor-strip · digest = SHA-256' });

  log.push({ kind: 'step', text: '[1] parse input evidence' });
  log.push({ kind: 'out', text: `object · ${utf8(raw).length} UTF-8 bytes` });

  const body = stripAnchor(evidence);
  log.push({ kind: 'step', text: '[2] A(E) — strip top-level "anchor" (root must not depend on its own anchored value)' });
  log.push({ kind: 'out', text: `remaining keys: ${JSON.stringify(Object.keys(body))}` });

  const canonical = canonicalize(body);
  const cbytes = utf8(canonical);
  log.push({ kind: 'step', text: '[3] C(A(E)) — canonicalize: sort keys · compact · literal UTF-8 · no whitespace' });
  log.push({ kind: 'out', text: canonical });
  log.push({ kind: 'out', text: `${[...canonical].length} chars · ${cbytes.length} UTF-8 bytes` });
  log.push({ kind: 'dim', text: `bytes(hex): ${hexSpaced(cbytes)}` });

  log.push({ kind: 'step', text: '[4] sha256( those bytes )' });
  const hex = await sha256Hex(cbytes);
  log.push({ kind: 'out', text: hex });

  const root = '0x' + hex;
  const stored = (evidence.anchor as Record<string, unknown> | undefined)?.receipt_root as string | undefined;
  const target = (expectedRoot && expectedRoot.trim()) || stored || null;

  let verdict: TriState;
  let reason: string;
  if (!target) {
    verdict = 'unverifiable';
    reason = 'No expected or stored receipt_root to check against — recomputed only. Couldn’t evaluate, which is its own verdict, never a pass.';
    log.push({ kind: 'warn', text: `receipt_root = ${root}` });
    log.push({ kind: 'warn', text: 'no target to compare → UNVERIFIABLE' });
  } else if (root.toLowerCase() === target.toLowerCase()) {
    verdict = 'verified-good';
    reason = 'The recomputed receipt_root matches the target byte-for-byte.';
    log.push({ kind: 'step', text: '[5] compare recomputed vs target' });
    log.push({ kind: 'ok', text: `${root}  ==  ${target}  → MATCH · verified-good` });
  } else {
    verdict = 'verified-bad';
    reason = 'The recomputed receipt_root does NOT match the target — a determinate mismatch.';
    log.push({ kind: 'step', text: '[5] compare recomputed vs target' });
    log.push({ kind: 'bad', text: `${root}  !=  ${target}  → MISMATCH · verified-bad` });
  }

  return {
    profile: PROFILE, log, canonical, canonicalHex: toHex(cbytes),
    recomputedRoot: root, target, verdict, reason, vantageLimitation: VANTAGE_LIMITATION,
  };
}

// --- conformance self-test: the §2.8 golden vector, must reproduce byte-exact ------------------
export const GOLDEN = {
  evidence: { b: 1, a: { y: 'π', x: [true, null, '0x2a'] }, anchor: { txHash: '0xdead' } } as Record<string, unknown>,
  canonical: '{"a":{"x":[true,null,"0x2a"],"y":"π"},"b":1}',
  root: '0xe61c9a9eed9e1d7eb5107acd9bb71d53cee9fcdae806444f4dc93b2f9694c2ae',
};

export async function selfTest(): Promise<{ ok: boolean; got: string; canonicalOk: boolean }> {
  const canonicalOk = canonicalize(stripAnchor(GOLDEN.evidence)) === GOLDEN.canonical;
  const r = await recompute(GOLDEN.evidence, GOLDEN.root);
  return { ok: r.recomputedRoot === GOLDEN.root && r.verdict === 'verified-good' && canonicalOk, got: r.recomputedRoot, canonicalOk };
}
