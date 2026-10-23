// SPDX-License-Identifier: Apache-2.0
// Browser port of babyblueviper1/invinoveritas slot_log_check.py @ ce8c504.
// Its original ASCII-hex pairing, header identity, duplicate-odd rule and chain
// checks remain separate from ReceiptOS. Ported #85 slot_bridge bounded domain.
// Browser additionally refuses ambiguous side aliases: only L/R are supported.
// Exact pins, license and adaptation notes: THIRD_PARTY_NOTICES.md / SOURCE_PINS.
import { sha256, utf8 } from './bytes.js';
import { parseStrict, canonicalize } from './strict-json.js';
export const SLOT = 'invinoveritas.decision_receipt.slot_log.v1';
const LINE_KEYS = ['slot', 'scope', 'event_ids', 'taken_at', 'claim_sha256', 'decider_sig', 'conflicts'];
const text = value => new TextDecoder().decode(canonicalize(value));
const same = (a, b) => text(a) === text(b);
const sha = value => sha256(utf8(value));
class Bad extends Error {}
const get = (v, k) => {
  if (!v || !Object.hasOwn(v, k)) throw new TypeError('Missing field: ' + k);
  return v[k];
};
function domain(v) {
  if (v === null || typeof v === 'string' || Number.isSafeInteger(v)) return;
  if (Array.isArray(v)) { for (const item of v) domain(item); return; }
  if (v && typeof v === 'object') { for (const item of Object.values(v)) domain(item); return; }
  throw new TypeError('outside bounded slot JSON domain');
}
async function root(leaves) {
  if (!leaves.length) return sha(SLOT + '|empty');
  let level = leaves;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(await sha(level[i] + (level[i + 1] ?? level[i])));
    level = next;
  }
  return level[0];
}
export async function checkFile(data) {
  if (typeof data !== 'string') throw new TypeError('snapshot must be text');
  if (!data.endsWith('\n')) throw new Bad('not newline-terminated');
  const raw = data.split('\n').slice(0, -1);
  if (!raw.length) throw new Bad('empty file');
  const header = parseStrict(raw[0]); domain(header);
  if (text(header) !== raw[0]) throw new Bad('header is not canonical JSON');
  if (header.schema !== SLOT) throw new Bad('unknown schema');
  const lines = [];
  for (const r of raw.slice(1)) {
    const x = parseStrict(r); domain(x);
    if (text(x) !== r) throw new Bad('a slot line is not canonical JSON');
    if (Object.keys(x).sort().join('|') !== [...LINE_KEYS].sort().join('|')
      || typeof x.slot !== 'string' || !/^[0-9a-f]{64}$/.test(x.slot) || !['account', 'decider'].includes(x.scope)) throw new Bad('malformed slot line');
    lines.push(x);
  }
  const slots = lines.map(x => x.slot);
  if (!same(slots, [...slots].sort()) || new Set(slots).size !== slots.length) throw new Bad('slot lines not strictly sorted by slot (a slot listed twice?)');
  if (header.n_slots !== lines.length) throw new Bad('n_slots does not match the lines');
  if (await root(await Promise.all(raw.slice(1).map(sha))) !== header.merkle_root) throw new Bad('merkle_root does not match the lines');
  if (!Number.isSafeInteger(get(header, 'cutoff')) || lines.some(x => !Number.isSafeInteger(x.taken_at))) throw new TypeError('integer timestamps required');
  if (lines.some(x => x.taken_at >= header.cutoff)) throw new Bad('a slot taken after the cutoff');
  return { header, lines, root: await sha(raw[0]) };
}
async function checkInclusion(log, trace = []) {
  const leaf = await sha(text(get(log, 'line')));
  trace.push({kind:'out',text:'Slot SHA-256(canonical line): '+leaf});
  if (leaf !== get(log, 'leaf')) throw new Bad('leaf is not sha256(JCS(line))');
  let h = leaf;
  for (const step of get(log, 'merkle_path')) {
    if (!['L', 'R'].includes(step.side) || typeof step.hash !== 'string' || !/^[0-9a-f]{64}$/.test(step.hash)) throw new TypeError('Unsupported slot sibling shape');
    h = await sha(step.side === 'R' ? h + step.hash : step.hash + h);
    trace.push({kind:'out',text:`Slot ASCII-hex pair (${step.side}): ${h}`});
  }
  if (h !== get(get(log, 'header'), 'merkle_root')) throw new Bad('merkle_path does not reach header.merkle_root');
  const id = await sha(text(log.header));
  trace.push({kind:'out',text:`Slot SHA-256(canonical header): ${id}; proof snapshot root: ${log.log_root}`});
  if (id !== get(log, 'log_root')) throw new Bad('log_root is not sha256(JCS(header))');
  return id;
}
export async function checkChain(header, lines, previous) {
  const old = await checkFile(previous);
  if (get(header, 'prev_root') !== old.root) throw new Bad("prev_root is not the previous snapshot's log_root (history rewritten?)");
  if (typeof get(old.header, 'date') !== 'string' || typeof get(header, 'date') !== 'string') throw new TypeError('date strings required');
  if (old.header.date >= header.date) throw new Bad('previous snapshot is not an earlier day');
  const previousSlots = new Map(old.lines.map(x => [x.slot, x]));
  if (old.lines.some(x => !lines.some(y => y.slot === x.slot))) throw new Bad('previous slot missing');
  for (const x of lines) {
    const p = previousSlots.get(x.slot);
    if (!p) continue;
    if (!Array.isArray(x.conflicts) || !Array.isArray(p.conflicts)) throw new TypeError('conflicts arrays required');
    const stable = o => Object.fromEntries(LINE_KEYS.filter(k => k !== 'conflicts').map(k => [k, o[k]]));
    if (!same(stable(p), stable(x)) || !same(x.conflicts.slice(0, p.conflicts.length), p.conflicts)) throw new Bad('slot changed since the previous day');
  }
}
export async function verifySlot(data, trace = []) {
  let stage = 'snapshot';
  try {
    const s = await checkFile(get(data, 'snapshot'));
    trace.push({kind:'out',text:`Full slot snapshot recomputed: ${s.lines.length} entries; log root ${s.root}`});
    stage = 'inclusion';
    const included = await checkInclusion(get(data, 'inclusion'), trace);
    if (included !== s.root || !same(data.inclusion.header, s.header)) throw new Bad('inclusion checkpoint differs from snapshot');
    stage = 'position';
    const index = get(data, 'index');
    if (!Number.isSafeInteger(index) || index < 0 || index >= s.lines.length || !same(s.lines[index], data.inclusion.line)) throw new Bad('selected leaf position differs from snapshot');
    if (!Number.isSafeInteger(get(data, 'count')) || data.count !== s.lines.length) throw new Bad('selected count differs from snapshot');
    stage = 'chain';
    if (data.previous != null) await checkChain(s.header, s.lines, data.previous);
    if (data.previous != null) trace.push({kind:'out',text:'Prior snapshot recomputed; prior root, date order and retained slot contents matched.'});
    return { profile: SLOT, status: 'VERIFIED', reason: 'SLOT_NATIVE_VERIFIED', stage: 'complete', log_root: s.root };
  } catch (e) {
    return { profile: SLOT, status: e instanceof Bad ? 'REFUTED' : 'UNVERIFIABLE',
      reason: e instanceof Bad ? 'SLOT_' + stage.toUpperCase() + '_INVALID' : 'SLOT_MALFORMED', stage };
  }
}
