// Shared recipe/registry types — imported by both the registry and the recipe modules.

export type TriState = 'verified-good' | 'verified-bad' | 'unverifiable';
export type LogKind = 'cmd' | 'step' | 'out' | 'ok' | 'bad' | 'warn' | 'dim';
export interface LogLine { kind: LogKind; text: string }
export interface ReproRow { label: string; value: string }

export interface LensResult {
  profile: string;
  log: LogLine[];
  verdict: TriState;
  reason: string;
  vantageLimitation: string;
  signatureNote?: string;
  reproduce: { rows: ReproRow[]; commands: string };
  // These optional dimensions belong to the new bounded browser profiles only.
  // Existing recipe results and the separate six-field RVR format are unchanged.
  dimensions?: {
    proofValidity: 'VERIFIED' | 'REFUTED' | 'UNVERIFIABLE';
    anchorAssurance: 'CHAIN_CONSISTENT' | 'ANCHOR_UNCHECKED';
    execution: 'BROWSER';
    nativeResult: string;
    hostComparison: 'NOT_SUPPLIED' | 'MATCH' | 'DISAGREEMENT' | 'MALFORMED';
    notCovered: string[];
  };
}

export interface Field { key: string; label: string; placeholder: string; area?: boolean; bytes?: boolean }

export interface Recipe {
  id: string;
  label: string;
  profile: string;
  blurb: string;
  fields: Field[];
  loadExample: () => Record<string, string>;
  run: (f: Record<string, string>) => Promise<LensResult | { error: string }>;
  selfTest: () => Promise<{ ok: boolean }>;
}
