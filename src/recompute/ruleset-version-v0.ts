// ruleset-version-v0 — recompute a profile's `ruleset_version` in the browser.
//
// The carrier (Pavlo / ReceiptOS): ruleset_version = 0x·sha256( C(recipe_definition) ), where
// recipe_definition is a DECLARATION BLOCK, not an implementation file. Hashing the declaration —
// not code — is what keeps the version implementation-independent: the reference, the kit's bash
// recipe, this TS port and a from-spec rebuild all hash the SAME definition and agree on the version.
// The semver lives INSIDE the definition, so it's covered by the hash — any displayed version is read
// back by resolving the hash, never asserted alongside it.
//
// Conformant, not trusted: the self-test reproduces the candidate vectors published at
// pipavlo82/crystal-receipt @ f0b9d47 (conformance/ruleset-version.candidate-vectors.md) —
// both definition hashes (RV1/RV2) AND the pinned-record commitments (Ca/Cb, incl. the
// isolation property Cb ≠ Ca) — with the same canonicalizer the §2.8 receipt_root recipe uses.

import { canonicalize } from './receiptos-c14n-v0';
import type { TriState, LogLine } from '../types';

export const PROFILE = 'ruleset-version-v0' as const;

export const VANTAGE_LIMITATION =
  'Recompute proves the version binding — that this ruleset_version is the hash of exactly this ' +
  'declaration, and that the displayed semver is the one inside it. It does not judge whether the ' +
  'rules themselves are the right rules, only that the label cannot be forged apart from them.';

const utf8 = (s: string) => new TextEncoder().encode(s);
const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', ab)));
}

/** ruleset_version = 0x·sha256(canon(definition)). */
export async function rulesetVersion(def: Record<string, unknown>): Promise<{ canonical: string; rv: string }> {
  const canonical = canonicalize(def);
  const rv = '0x' + (await sha256Hex(utf8(canonical)));
  return { canonical, rv };
}

export interface Result {
  profile: typeof PROFILE;
  log: LogLine[];
  canonical: string;
  canonicalHex: string;
  rulesetVersion: string;
  declaredProfile: string | null;
  declaredVersion: string | null;
  target: string | null;
  verdict: TriState;
  reason: string;
  vantageLimitation: string;
}

export async function recompute(def: Record<string, unknown>, expected: string | null): Promise<Result> {
  const log: LogLine[] = [];
  const { canonical, rv } = await rulesetVersion(def);
  const canonicalHex = toHex(utf8(canonical));

  const declaredProfile = typeof def.profile === 'string' ? def.profile : null;
  const declaredVersion = typeof def.version === 'string' ? def.version : null;

  log.push({ kind: 'step', text: `C(recipe_definition) → ${utf8(canonical).length} bytes` });
  log.push({ kind: 'out', text: canonical });
  log.push({ kind: 'cmd', text: `sha256 → ruleset_version` });
  log.push({ kind: 'out', text: rv });
  log.push({ kind: 'step', text: `semver read back FROM the hashed definition: ${declaredProfile ?? '?'} / ${declaredVersion ?? '?'}` });

  const target = expected ? expected.trim().toLowerCase() : null;
  let verdict: TriState = 'unverifiable';
  let reason: string;
  if (target) {
    if (!/^0x[0-9a-f]{64}$/.test(target)) { verdict = 'unverifiable'; reason = 'Expected ruleset_version is not a 0x-prefixed 32-byte hex.'; }
    else if (rv === target) { verdict = 'verified-good'; reason = `Reproduces the expected ruleset_version — declared ${declaredProfile}/${declaredVersion} rides under the hash.`; log.push({ kind: 'ok', text: 'MATCH — verified under ' + declaredProfile + ' / ' + declaredVersion }); }
    else { verdict = 'verified-bad'; reason = `Recomputed ${rv} ≠ expected ${target}.`; log.push({ kind: 'bad', text: 'MISMATCH' }); }
  } else {
    reason = `ruleset_version = ${rv}. Declares ${declaredProfile}/${declaredVersion}, read back from the definition (paste an expected value to check a claim).`;
  }
  return { profile: PROFILE, log, canonical, canonicalHex, rulesetVersion: rv, declaredProfile, declaredVersion, target, verdict, reason, vantageLimitation: VANTAGE_LIMITATION };
}

// ── Golden: Pavlo's candidate vectors @ pipavlo82/crystal-receipt f0b9d47 ──────────
export const GOLDEN = {
  ref: 'pipavlo82/crystal-receipt@f0b9d47',
  def01: { canonicalization: 'JCS (RFC 8785)', delta: 'strip top-level anchor field', digest: 'sha256', output: '0x + 64 lowercase hex', profile: 'receiptos-c14n-v0', version: '0.1.0' } as Record<string, unknown>,
  RV1: '0x706bc9b3dc73159ccf4bbbebac3000a105de58f1253099ad23255998e9261e90',
  def02: { canonicalization: 'JCS (RFC 8785)', delta: 'strip top-level anchor field', digest: 'sha256', output: '0x + 64 lowercase hex', profile: 'receiptos-c14n-v0', reject: 'non-finite numbers at hash-relevant positions', version: '0.2.0' } as Record<string, unknown>,
  RV2: '0xa10b5ca766b5224b0df5eb3b430ec74a46b471c9360434d3c0589fd6306ca133',
  // pinned §2.8 record (unsigned); ruleset_version filled per-case
  record: { a: { x: [true, null, '0x2a'], y: 'π' }, b: 1 } as Record<string, unknown>,
  Ca: '0x44a8a22891e4cb5376224b8ab686df446383f5aa3e5a22d5550aaf510c1438f7',
  Cb: '0x16a80156bd197d6459e4b299a9119f989e53b6dfe2798924edb60297fabdb8e6',
};

async function commit(rv: string): Promise<string> {
  const pinned = { ...GOLDEN.record, ruleset_version: rv };
  return '0x' + (await sha256Hex(utf8(canonicalize(pinned))));
}

/** Reproduce all four candidate vectors byte-exact (defs → RV1/RV2, pinned records → Ca/Cb, isolation). */
export async function selfTest(): Promise<{ ok: boolean; detail: string }> {
  const rv1 = (await rulesetVersion(GOLDEN.def01)).rv;
  const rv2 = (await rulesetVersion(GOLDEN.def02)).rv;
  const ca = await commit(GOLDEN.RV1);
  const cb = await commit(GOLDEN.RV2);
  const ok = rv1 === GOLDEN.RV1 && rv2 === GOLDEN.RV2 && ca === GOLDEN.Ca && cb === GOLDEN.Cb && ca !== cb;
  return { ok, detail: ok ? 'RV1·RV2·Ca·Cb reproduce; Cb≠Ca (isolation)' : 'vector mismatch' };
}
