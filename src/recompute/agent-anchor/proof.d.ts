import type { LogLine } from '../../types';
export const SUBJECT: 'agent-action.subject-record.v0';
export const CANON: 'receiptos.verify.canonical-json.v1';
export const ENVELOPE: 'chain-neutral.anchor-proof-envelope.v0';
export const MANIFEST: 'receiptos.manifest-proof.v0';
export const SLOT: 'invinoveritas.decision_receipt.slot_log.v1';
export const POLICY: 'chain-neutral.verifier-policy.v0';
export interface ProofResult {
  projection: 'chain-neutral.result.v0';
  proof_validity: 'VERIFIED' | 'REFUTED' | 'UNVERIFIABLE';
  anchor_assurance: 'ANCHOR_UNCHECKED' | 'CHAIN_CONSISTENT';
  reason: string;
  native: null | { profile: string; status: 'VERIFIED' | 'REFUTED' | 'UNVERIFIABLE'; reason: string };
}
export interface ProofInput {
  subject_bytes?: Uint8Array;
  envelope_bytes?: Uint8Array;
  subject_base64?: string;
  envelope_base64?: string;
  policy: unknown;
}
export function admitSubject(raw: Uint8Array): Promise<string>;
export function evaluateProof(input: ProofInput, configuration: unknown, trace?: LogLine[]): Promise<ProofResult>;
export function compareHost(browser: ProofResult, host: unknown): 'NOT_SUPPLIED' | 'MATCH' | 'DISAGREEMENT' | 'MALFORMED';
