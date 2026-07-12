// Client-side ports of recompute-kit recipes — pure keccak / abi.encode / namehash / arithmetic,
// so they run in the browser (viem). Each carries the KIT'S OWN golden vector as its self-test, so
// the lens stays byte-for-byte in lockstep with recompute-kit — a conformant implementation, not a
// second source of truth. The kit CLI form is shown so a skeptic re-runs it there.

import { keccak256, encodeAbiParameters, concat, stringToHex, toHex, namehash, type Hex } from 'viem';
import type { LogLine, Recipe, TriState } from '../types';

const L = (kind: LogLine['kind'], text: string): LogLine => ({ kind, text });
const VANTAGE =
  'Recompute proves this value is the deterministic function of the public inputs shown — nothing ' +
  'more. It does not attest that the inputs themselves are true.';

interface Kit {
  id: string;
  label: string;
  profile: string;
  blurb: string;
  fields: Recipe['fields'];
  example: Record<string, string>;
  compute: (f: Record<string, string>) => { value: string; steps: LogLine[] };
  cmd: (f: Record<string, string>, out: string) => string;
}

const need = (s: string | undefined, what: string): string => {
  if (!s || !s.trim()) throw new Error(`missing ${what}`);
  return s.trim();
};

const KITS: Kit[] = [
  {
    id: 'wyriwe/raw', label: 'WYRIWE · raw-input hash', profile: 'ERC-8299 §45',
    blurb: 'raw_input_hash = keccak256(raw_user_input) — the input-provenance leg.',
    fields: [{ key: 'raw', label: 'raw input (hex, 0x…)', placeholder: '0x68656c6c6f' }, { key: 'expected', label: 'expected (optional)', placeholder: '0x…' }],
    example: { raw: '0x68656c6c6f', expected: '0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8' },
    compute: (f) => {
      const raw = need(f.raw, 'raw input hex') as Hex;
      const v = keccak256(raw);
      return { value: v, steps: [L('cmd', 'recompute · wyriwe/raw'), L('dim', 'raw_input_hash = keccak256(raw_user_input)'), L('step', '[1] keccak256( raw bytes )'), L('out', `input ${raw}  (${(raw.length - 2) / 2} bytes)`), L('out', v)] };
    },
    cmd: (f, o) => `recompute-step wyriwe/raw ${f.raw} ${o}`,
  },
  {
    id: 'wyriwe/pipeline', label: 'WYRIWE · pipeline hash', profile: 'ERC-8299 §46',
    blurb: 'sanitization_pipeline_hash = keccak256(utf8(cid) ‖ raw_input_hash).',
    fields: [{ key: 'cid', label: 'sanitization spec CID', placeholder: 'ipfs://Qm…' }, { key: 'rawhash', label: 'raw_input_hash (hex)', placeholder: '0x…' }, { key: 'expected', label: 'expected (optional)', placeholder: '0x…' }],
    example: { cid: 'ipfs://QmccvoM6aRVgZ2dtFWvT6Wm3DmTvoAUHHotK7uQufnStVR', rawhash: '0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8', expected: '0x5798efed4aa92f96a0622fc30268042b067294bdb5fd06f599bf8d84fd5d734b' },
    compute: (f) => {
      const cid = need(f.cid, 'spec CID'); const rh = need(f.rawhash, 'raw_input_hash') as Hex;
      const pre = concat([stringToHex(cid), rh]);
      const v = keccak256(pre);
      return { value: v, steps: [L('cmd', 'recompute · wyriwe/pipeline'), L('dim', 'keccak256( utf8(cid) ‖ raw_input_hash )'), L('step', '[1] utf8(cid) ‖ raw_input_hash'), L('out', pre), L('step', '[2] keccak256( … )'), L('out', v)] };
    },
    cmd: (f, o) => `recompute-step wyriwe/pipeline ${f.cid} ${f.rawhash} ${o}`,
  },
  {
    id: 'name/keccak-binding', label: 'name → handle binding', profile: 'wyriwe preimage leg',
    blurb: 'keccak256(utf8(label)) — a name→handle binding. NOT the 8004 agentId, NOT an ENS namehash.',
    fields: [{ key: 'label', label: 'label (utf-8)', placeholder: 'eip155:1:0x…/2' }, { key: 'expected', label: 'expected (optional)', placeholder: '0x…' }],
    example: { label: 'eip155:1:0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/2', expected: '0xa4901e8856b7720cabdbef198f982d9563fbb3be72b49f9bf55666730cd09ee6' },
    compute: (f) => {
      const label = need(f.label, 'label');
      const v = keccak256(stringToHex(label));
      return { value: v, steps: [L('cmd', 'recompute · name/keccak-binding'), L('step', '[1] keccak256( utf8(label) )'), L('out', `utf8 → ${stringToHex(label)}`), L('out', v)] };
    },
    cmd: (f, o) => `recompute-step name/keccak-binding "${f.label}" ${o}`,
  },
  {
    id: 'ens/namehash', label: 'ENS namehash (EIP-137)', profile: 'EIP-137',
    blurb: 'node = keccak(parent ‖ keccak(label)) over labels — the id ENS resolves.',
    fields: [{ key: 'name', label: 'ENS name', placeholder: 'agent.eth' }, { key: 'expected', label: 'expected (optional)', placeholder: '0x…' }],
    example: { name: 'agent.eth', expected: '0xcebb0cc9358edff7ea493b46f7871562ee8038f59f564dfce786b65b8ec1edeb' },
    compute: (f) => {
      const name = need(f.name, 'name');
      const v = namehash(name);
      return { value: v, steps: [L('cmd', 'recompute · ens/namehash'), L('dim', 'EIP-137 recursive namehash over labels'), L('step', `[1] namehash("${name}")`), L('out', v)] };
    },
    cmd: (f, o) => `recompute-step ens/namehash ${f.name} ${o}`,
  },
  {
    id: '8004/agent-id', label: 'ERC-8004 agentId', profile: 'ERC-8004 (erc-8299.md)',
    blurb: 'agentId = bytes32(uint256(registryId)) — the registry-assigned id, left-padded. NOT a hash.',
    fields: [{ key: 'registryId', label: 'registryId (decimal)', placeholder: '860' }, { key: 'expected', label: 'expected (optional)', placeholder: '0x…' }],
    example: { registryId: '860', expected: '0x000000000000000000000000000000000000000000000000000000000000035c' },
    compute: (f) => {
      const id = need(f.registryId, 'registryId');
      const v = toHex(BigInt(id), { size: 32 });
      return { value: v, steps: [L('cmd', 'recompute · 8004/agent-id'), L('dim', 'bytes32(uint256(registryId)) — left-padded, no hash'), L('step', `[1] pad(${id}, 32 bytes)`), L('out', v)] };
    },
    cmd: (f, o) => `recompute-step 8004/agent-id ${f.registryId} ${o}`,
  },
  {
    id: 'scope/binding', label: 'scope binding root', profile: 'scope-contestation Guarantee 4',
    blurb: 'scopeRoot = keccak256(abi.encode(merkleRoot, count)) — truncation-resistant.',
    fields: [{ key: 'root', label: 'merkleRoot (bytes32)', placeholder: '0x…deadbeef' }, { key: 'count', label: 'count', placeholder: '4' }, { key: 'expected', label: 'expected (optional)', placeholder: '0x…' }],
    example: { root: '0x00000000000000000000000000000000000000000000000000000000deadbeef', count: '4', expected: '0x36d975060e33224d20b5b4277dd6c8025812812e010c2889b72c3ed4e0d75dd5' },
    compute: (f) => {
      const root = need(f.root, 'merkleRoot') as Hex; const n = need(f.count, 'count');
      const enc = encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [root, BigInt(n)]);
      const v = keccak256(enc);
      return { value: v, steps: [L('cmd', 'recompute · scope/binding'), L('dim', 'keccak256(abi.encode(merkleRoot, count))'), L('step', '[1] abi.encode(bytes32, uint256)'), L('out', enc), L('step', '[2] keccak256( … )'), L('out', v)] };
    },
    cmd: (f, o) => `recompute-step scope/binding ${f.root} ${f.count} ${o}`,
  },
  {
    id: '8203/settlement-proof', label: 'ConsultEscrow release', profile: 'ERC-8203 settlement',
    blurb: 'verdictHash = keccak256(abi.encode(jobId, keccak256(utf8(resultText)))).',
    fields: [{ key: 'jobId', label: 'jobId (bytes32)', placeholder: '0x…' }, { key: 'resultText', label: 'result text (utf-8)', placeholder: 'No intermediaries required…', area: true }, { key: 'expected', label: 'expected (optional)', placeholder: '0x…' }],
    example: { jobId: '0xbc01b40fe7a3509f35470053d4bc1844d50c9782546cf0fc11154adcb90caa56', resultText: 'No intermediaries required, cryptographic verification only.', expected: '0xdc568bd1cbacdd1ead8231e9d3d6f4e475f5168f3cc9f72b31935d46cfdd48f7' },
    compute: (f) => {
      const jobId = need(f.jobId, 'jobId') as Hex; const text = need(f.resultText, 'result text');
      const rh = keccak256(stringToHex(text));
      const v = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }], [jobId, rh]));
      return { value: v, steps: [L('cmd', 'recompute · 8203/settlement-proof'), L('step', '[1] resultHash = keccak256(utf8(resultText))'), L('out', rh), L('step', '[2] keccak256(abi.encode(jobId, resultHash))'), L('out', v)] };
    },
    cmd: (f, o) => `recompute-step 8203/settlement-proof ${f.jobId} "${f.resultText}" ${o}`,
  },
  {
    id: '8275/reputation', label: 'ERC-8275 winRate', profile: 'ERC-8275 (input recompute)',
    blurb: 'winRate = gated_wins / (gated_wins + gated_losses) — the recomputable INPUT (not the composite score).',
    fields: [{ key: 'wins', label: 'commit-gated wins', placeholder: '16' }, { key: 'losses', label: 'commit-gated losses', placeholder: '15' }, { key: 'expected', label: 'expected winRate (optional)', placeholder: '0.5161' }],
    example: { wins: '16', losses: '15', expected: '0.5161' },
    compute: (f) => {
      const w = Number(need(f.wins, 'wins')); const l = Number(need(f.losses, 'losses'));
      if (!Number.isFinite(w) || !Number.isFinite(l) || w + l <= 0) throw new Error('wins/losses must be numbers with a positive total');
      const v = (w / (w + l)).toFixed(4);
      return { value: v, steps: [L('cmd', 'recompute · 8275/reputation'), L('dim', 'winRate = gated_wins / (gated_wins + gated_losses)'), L('step', `[1] ${w} / (${w} + ${l})`), L('out', `= ${v}`)] };
    },
    cmd: (f, o) => `recompute-step 8275/reputation  # winRate=${o} from wins=${f.wins} losses=${f.losses}`,
  },
  {
    id: '8301/task-hash', label: 'ERC-8301 task hash', profile: 'ERC-8301 §AgentTask',
    blurb: 'INITIAL-task taskHash = keccak256(abi.encode(…7 fields…)); empty prevReplyHashes → keccak256(0x)=0xc5d2…a470, NOT bytes32(0).',
    fields: [{ key: 'task', label: 'task fields (JSON)', placeholder: '{"stage":1,"taskSeq":0,"inputHash":"0x…","timestamp":…,"expiresAt":…,"prevReplyHashesPacked":"0x","workflowRunId":"0x…"}', area: true }, { key: 'expected', label: 'expected (optional)', placeholder: '0x…' }],
    example: { task: JSON.stringify({ stage: 1, taskSeq: 0, inputHash: '0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8', timestamp: 1700000000, expiresAt: 1700001000, prevReplyHashesPacked: '0x', workflowRunId: '0x00000000000000000000000000000000000000000000000000000000deadbeef' }), expected: '0xf1f404c844a4aff1d0d7d17cebb518a2d386197aad09ab86517eaa01448301ec' },
    compute: (f) => {
      const t = JSON.parse(need(f.task, 'task JSON')) as Record<string, unknown>;
      const inner = keccak256((t.prevReplyHashesPacked as Hex) || '0x');
      const enc = encodeAbiParameters(
        [{ type: 'uint8' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }],
        [Number(t.stage), BigInt(t.taskSeq as number), t.inputHash as Hex, BigInt(t.timestamp as number), BigInt(t.expiresAt as number), inner, t.workflowRunId as Hex],
      );
      const v = keccak256(enc);
      return { value: v, steps: [L('cmd', 'recompute · 8301/task-hash'), L('step', '[1] inner = keccak256(prevReplyHashesPacked)'), L('out', `${inner}${t.prevReplyHashesPacked === '0x' ? '  (empty → keccak256(0x), not bytes32(0))' : ''}`), L('step', '[2] abi.encode(7 fields)'), L('out', enc), L('step', '[3] keccak256( … )'), L('out', v)] };
    },
    cmd: () => `recompute-step 8301/task-hash  # abi.encode(7 fields) → keccak256`,
  },
];

function toRecipe(k: Kit): Recipe {
  return {
    id: k.id, label: k.label, profile: k.profile, blurb: k.blurb, fields: k.fields,
    loadExample: () => k.example,
    run: async (f) => {
      let r: { value: string; steps: LogLine[] };
      try { r = k.compute(f); } catch (e) { return { error: (e as Error).message || 'invalid input' }; }
      const target = (f.expected || '').trim() || null;
      const steps = [...r.steps];
      let verdict: TriState, reason: string;
      if (!target) {
        verdict = 'unverifiable';
        reason = 'No expected value supplied to check against — recomputed only. Couldn’t evaluate, which is its own verdict, never a pass.';
        steps.push(L('warn', 'no target → UNVERIFIABLE'));
      } else if (r.value.toLowerCase() === target.toLowerCase()) {
        verdict = 'verified-good';
        reason = 'Recomputed value matches the target.';
        steps.push(L('step', '[compare]'), L('ok', `${r.value}  ==  ${target}  → MATCH`));
      } else {
        verdict = 'verified-bad';
        reason = 'Recomputed value does NOT match the target — a determinate mismatch.';
        steps.push(L('step', '[compare]'), L('bad', `${r.value}  !=  ${target}  → MISMATCH`));
      }
      return { profile: k.profile, log: steps, verdict, reason, vantageLimitation: VANTAGE, reproduce: { rows: [{ label: 'computed', value: r.value }], commands: '# reproduce in the kit:\n' + k.cmd(f, r.value) } };
    },
    selfTest: async () => { try { const r = k.compute(k.example); return { ok: r.value.toLowerCase() === (k.example.expected || '').toLowerCase() }; } catch { return { ok: false }; } },
  };
}

export const KIT_RECIPES: Recipe[] = KITS.map(toRecipe);
