// SPDX-License-Identifier: CC0-1.0
import type { LensResult, Recipe, LogLine } from '../../types';
import { SUBJECT, ENVELOPE, MANIFEST, SLOT, admitSubject, evaluateProof, compareHost } from './proof.js';
import { parseStrict, scalarString } from './strict-json.js';
import { utf8, hex, sha256, fromBase64 } from './bytes.js';
import examples from './examples.json';
type Dimensions = NonNullable<LensResult['dimensions']>;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('OBJECT_REQUIRED');
  return value as Record<string, unknown>;
};

const limits = [
  'ANCHORED_VERIFIED — NOT_COVERED',
  'Independently authenticated public-log provisioning, publication, freshness and non-equivocation — NOT_COVERED',
  'OpenTimestamps / public-chain consensus verification — NOT_COVERED',
  'External action execution, judgment correctness, payment authorization and claim authorization — NOT_COVERED',
];
const vantage = 'Browser execution verifies only the selected bounded record/proof profile. Trust configuration must be selected through an independent channel. Examples use public laboratory keys and confer no real-world authority. Local inclusion and finite history consistency do not establish public anchoring. This result is not an ERC-8404 verification receipt.';
const verdict = (p: string): LensResult['verdict'] => p === 'VERIFIED' ? 'verified-good' : p === 'REFUTED' ? 'verified-bad' : 'unverifiable';
const raw = (f: Record<string, string>, name: string): Uint8Array => f[name + '__base64'] !== undefined
  ? fromBase64(f[name + '__base64']) : utf8(scalarString(f[name] ?? ''));
const decode = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
function refused(profile: string, e: unknown): LensResult {
  const reason = e instanceof Error ? ((e as Error & { code?: string }).code ?? e.message) : 'MALFORMED_INPUT';
  return { profile, log: [{ kind: 'warn', text: reason }], verdict: 'unverifiable', reason, vantageLimitation: vantage,
    reproduce: { rows: [], commands: 'npm run test:agent-anchor' },
    dimensions: { proofValidity: 'UNVERIFIABLE', anchorAssurance: 'ANCHOR_UNCHECKED', execution: 'BROWSER',
      nativeResult: 'Not reached', hostComparison: 'NOT_SUPPLIED', notCovered: limits } };
}
const field = { key: 'subject', label: 'Original subject JSON bytes (UTF-8; no normalization)', placeholder: 'Paste exact canonical bytes or select the original file', area: true, bytes: true };
const subject: Recipe = {
  id: SUBJECT, label: 'Agent action subject identity', profile: SUBJECT,
  blurb: 'Admit the original restricted canonical bytes and hash every byte. No fields are excluded. Record identity does not establish action execution.',
  fields: [field, { key: 'expected', label: 'Independently selected subject_id (optional comparison)', placeholder: '0x…' }],
  loadExample: () => ({ subject: decode(fromBase64(examples.manifest.subject_base64)), expected: JSON.parse(decode(fromBase64(examples.manifest.envelope_base64))).subject_id }),
  run: async f => {
    try {
      const bytes = raw(f, 'subject'), id = await admitSubject(bytes), record = object(parseStrict(bytes));
      const expected = f.expected ?? '';
      const validity = expected ? expected === id ? 'VERIFIED' : 'REFUTED' : 'UNVERIFIABLE';
      const reason = expected ? expected === id ? 'SUBJECT_IDENTITY_MATCHED' : 'SUBJECT_IDENTITY_MISMATCH' : 'SUBJECT_ID_RECOMPUTED_NO_SELECTED_TARGET';
      return { profile: SUBJECT, log: [
        { kind: 'step', text: 'Admit raw UTF-8, duplicate-free JSON, safe integers, scalar strings, safe ASCII keys; max 4 MiB / 32 containers.' },
        { kind: 'out', text: 'Exact canonical-byte equality passed. No top-level field exclusions.' },
        { kind: 'out', text: 'SHA-256(original admitted bytes) = ' + id },
      ], verdict: verdict(validity), reason, vantageLimitation: vantage,
      reproduce: { rows: [
        { label: 'exact admitted UTF-8 bytes', value: decode(bytes) }, { label: 'exact admitted bytes (hex)', value: hex(bytes) },
        { label: 'SHA-256', value: id.slice(2) }, { label: 'subject_id', value: id },
        { label: 'selected target', value: expected || 'NOT_SELECTED' },
        { label: 'declared subject commitment', value: JSON.stringify(record.subject) },
        { label: 'declared claim commitment', value: JSON.stringify(record.claim) },
      ], commands: 'Hash the original admitted file: sha256sum subject.json\nNo canonicalization or anchor removal occurs before hashing.\nnpm run test:agent-anchor' },
      dimensions: { proofValidity: validity, anchorAssurance: 'ANCHOR_UNCHECKED', execution: 'BROWSER',
        nativeResult: 'Strict canonical admission + SHA-256; no proof requested', hostComparison: 'NOT_SUPPLIED', notCovered: limits } };
    } catch (e) { return refused(SUBJECT, e); }
  },
  selfTest: async () => ({ ok: await admitSubject(fromBase64(examples.manifest.subject_base64)) === JSON.parse(decode(fromBase64(examples.manifest.envelope_base64))).subject_id }),
};

function anchorRecipe(profile: typeof MANIFEST | typeof SLOT, kind: 'manifest' | 'slot'): Recipe {
  const example = examples[kind];
  return {
    id: profile, label: kind === 'manifest' ? 'ReceiptOS manifest anchor proof' : 'Invinoveritas slot-log anchor proof', profile,
    blurb: `${ENVELOPE} · ${profile}. Browser proof verification with independently selected policy. No network requests. Public anchoring remains NOT_COVERED.`,
    fields: [field,
      { key: 'envelope', label: 'Untrusted proof envelope JSON', placeholder: '{"profile":"chain-neutral.anchor-proof-envelope.v0",…}', area: true, bytes: true },
      { key: 'policy', label: 'Signed verifier policy JSON (untrusted until authenticated)', placeholder: '{"body":…,"authority_id":…,"signature":…}', area: true },
      { key: 'configuration', label: 'Independently selected verifier configuration (policy_id + accepted authorities)', placeholder: 'Choose through an independent channel. Never copy trust from proof metadata.', area: true },
      { key: 'host', label: 'Optional host result projection — comparison only, never trusted', placeholder: '{"projection":"chain-neutral.result.v0",…}', area: true },
    ],
    loadExample: () => ({ subject: decode(fromBase64(example.subject_base64)), envelope: decode(fromBase64(example.envelope_base64)),
      policy: JSON.stringify(example.policy), configuration: JSON.stringify(example.configuration), host: '' }),
    run: async f => {
      try {
        const subjectBytes = raw(f, 'subject'), envelopeBytes = raw(f, 'envelope');
        const envelope = object(parseStrict(envelopeBytes)), policyBytes = raw(f, 'policy'), configBytes = raw(f, 'configuration');
        const policy = parseStrict(policyBytes), config = object(parseStrict(configBytes));
        if (envelope?.proof_profile !== profile) throw new Error('SELECTED_RECIPE_PROFILE_MISMATCH');
        const log: LogLine[] = [{ kind: 'step', text: `Selected exact recipe ${profile}; envelope ${ENVELOPE}.` }];
        const r = await evaluateProof({ subject_bytes: subjectBytes, envelope_bytes: envelopeBytes, policy }, config, log);
        let hostComparison: Dimensions['hostComparison'] = 'NOT_SUPPLIED';
        if (f.host) {
          try { hostComparison = compareHost(r, parseStrict(f.host)); } catch { hostComparison = 'MALFORMED'; }
        }
        if (hostComparison === 'DISAGREEMENT' || hostComparison === 'MALFORMED') log.push({ kind: 'warn', text: 'Host comparison: ' + hostComparison + '; browser result retained.' });
        const inputs: Array<[string, Uint8Array]> = [
          ['subject bytes SHA-256', subjectBytes], ['envelope bytes SHA-256', envelopeBytes],
          ['submitted policy bytes SHA-256', policyBytes], ['selected configuration bytes SHA-256', configBytes],
        ];
        const rows = await Promise.all(inputs.map(async ([label, bytes]) => ({ label, value: await sha256(bytes) })));
        // Display the original bytes as admitted only if admission actually succeeds.
        try {
          await admitSubject(subjectBytes);
          const record = object(parseStrict(subjectBytes));
          rows.push({ label: 'exact admitted subject bytes', value: decode(subjectBytes) },
            { label: 'exact admitted subject bytes (hex)', value: hex(subjectBytes) },
            { label: 'declared subject commitment', value: JSON.stringify(record.subject) },
            { label: 'declared claim commitment', value: JSON.stringify(record.claim) });
        } catch { rows.push({ label: 'subject byte admission', value: 'REFUSED; input digest is not an admitted subject identity' }); }
        rows.push({ label: 'independently selected policy_id', value: String(config.policy_id ?? 'MISSING') },
          { label: 'complete bounded browser result', value: JSON.stringify(r) });
        return { profile, log, verdict: verdict(r.proof_validity), reason: r.reason, vantageLimitation: vantage,
          reproduce: { rows, commands: 'npm ci\nnpm run test:agent-anchor\nnpm run test:browser\nAll proof and policy checks run locally; host reports are diagnostic only.' },
          dimensions: { proofValidity: r.proof_validity,
            anchorAssurance: r.anchor_assurance, execution: 'BROWSER',
            nativeResult: r.native ? JSON.stringify(r.native) : 'Not reached', hostComparison, notCovered: limits } };
      } catch (e) { return refused(profile, e); }
    },
    selfTest: async () => {
      const r = await evaluateProof(example, example.configuration);
      return { ok: r.proof_validity === 'VERIFIED' && r.reason === 'BOUNDED_INCLUSION_VERIFIED'
        && r.anchor_assurance === (kind === 'slot' ? 'CHAIN_CONSISTENT' : 'ANCHOR_UNCHECKED') };
    },
  };
}
export const AGENT_ANCHOR_RECIPES: Recipe[] = [subject, anchorRecipe(MANIFEST, 'manifest'), anchorRecipe(SLOT, 'slot')];
