// Recipe registry — the generic shell over the recompute modules. Each recipe declares its input
// fields, an example loader, a run() that parses + recomputes into a common LensResult, and a
// golden-vector selfTest. Adding a recipe = one module + one entry here; the UI is generic.

import * as receiptos from './recompute/receiptos-c14n-v0';
import * as invino from './recompute/invinoveritas-witness-v1';
import { KIT_RECIPES } from './recompute/kit';
import type { Recipe } from './types';

export type { LensResult, LogLine, TriState, Recipe } from './types';

function asObject(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return { ok: false, error: 'Input is not valid JSON.' }; }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: 'Input must be a JSON object.' };
  return { ok: true, value: v as Record<string, unknown> };
}

const receiptosRecipe: Recipe = {
  id: receiptos.PROFILE,
  label: 'ReceiptOS receipt_root (§2.8)',
  profile: receiptos.PROFILE,
  blurb: 'Canonicalize an evidence object (JCS + top-level anchor-strip) and sha256 it → receipt_root.',
  fields: [
    { key: 'evidence', label: 'Evidence object (JSON)', placeholder: '{"b":1,"a":{ … },"anchor":{ … }}', area: true },
    { key: 'expected', label: 'Expected receipt_root (optional — else uses anchor.receipt_root)', placeholder: '0x…' },
  ],
  loadExample: () => ({ evidence: JSON.stringify(receiptos.GOLDEN.evidence), expected: receiptos.GOLDEN.root }),
  run: async (f) => {
    const p = asObject(f.evidence || '');
    if (!p.ok) return { error: p.error };
    const r = await receiptos.recompute(p.value, f.expected || null);
    return {
      profile: r.profile, log: r.log, verdict: r.verdict, reason: r.reason, vantageLimitation: r.vantageLimitation,
      reproduce: {
        rows: [
          { label: 'bytes (UTF-8)', value: r.canonical },
          { label: 'bytes (hex)', value: r.canonicalHex },
          { label: 'sha256 →', value: r.recomputedRoot },
        ],
        commands: "# hash those exact bytes in any tool → same root:\nprintf '%s' '<canonical bytes above>' | shasum -a 256\n# or via the kit:\nrecompute-step receiptos/canonicalize evidence.json " + r.recomputedRoot,
      },
    };
  },
  selfTest: async () => ({ ok: (await receiptos.selfTest()).ok }),
};

const invinoRecipe: Recipe = {
  id: invino.PROFILE,
  label: 'invinoveritas witness anchor',
  profile: invino.PROFILE,
  blurb: 'Recompute sha256(body) of a composed-evaluator witness proof → body integrity (not the signature).',
  fields: [
    { key: 'proof', label: 'Witness proof (JSON)', placeholder: '{"proof_payload":{"body":"…","body_hash":"…"}}', area: true },
  ],
  loadExample: () => ({ proof: JSON.stringify(invino.GOLDEN) }),
  run: async (f) => {
    const p = asObject(f.proof || '');
    if (!p.ok) return { error: p.error };
    const proof = p.value as unknown as invino.WitnessProof;
    if (!proof.proof_payload || typeof proof.proof_payload.body !== 'string') {
      return { error: 'Expected a witness proof with proof_payload.body (a string).' };
    }
    const r = await invino.recompute(proof);
    return {
      profile: r.profile, log: r.log, verdict: r.verdict, reason: r.reason,
      vantageLimitation: r.vantageLimitation, signatureNote: r.signatureNote,
      reproduce: {
        rows: [
          { label: 'body bytes', value: `${new TextEncoder().encode(proof.proof_payload.body).length} UTF-8 bytes` },
          { label: 'sha256 →', value: r.recomputedHash },
        ],
        commands: "# hash the body bytes in any tool → the stated body_hash:\nprintf '%s' '<proof_payload.body>' | shasum -a 256",
      },
    };
  },
  selfTest: async () => ({ ok: (await invino.selfTest()).ok }),
};

export const RECIPES: Recipe[] = [receiptosRecipe, invinoRecipe, ...KIT_RECIPES];
