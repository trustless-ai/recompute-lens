// SPDX-License-Identifier: Apache-2.0
// Adapted from pipavlo82/receiptos-verify; exact upstream pins and changes in
// research/agent-action-anchor-browser-v0/SOURCE_PINS.json and THIRD_PARTY_NOTICES.md.
// Browser port: Uint8Array / Web Crypto; no Node, subprocess, fetch, or host verdict.
import { canonicalize, parseStrict, problem } from './strict-json.js';
import { sha256, concat, utf8, unhex } from './bytes.js';
import { HEX, keys } from './common.js';

export const CAPSULE_SCHEMA = 'receiptos.verify.capsule.v1';
export const PROOF_SCHEMA = 'receiptos.verify.capsule-inclusion.v1';
const DOMAIN = utf8('receiptos.verify.capsule-merkle.v1\0');
const MAX_LEAVES = 65535;
const isDigest = value => typeof value === 'string' && HEX.test(value);
const cloneJson = value => parseStrict(canonicalize(value));
const fail = (code, message) => { throw problem(code, message); };
const hash = (...parts) => sha256(concat(...parts));
const leafHash = entry => hash(DOMAIN, new Uint8Array([0]), canonicalize(entry));
const nodeHash = (left, right) => hash(DOMAIN, new Uint8Array([1]), unhex(left), unhex(right));
function rootHash(top, count) {
  const encodedCount = new Uint8Array(4);
  new DataView(encodedCount.buffer).setUint32(0, count);
  return hash(DOMAIN, new Uint8Array([2]), encodedCount, unhex(top));
}
function validId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/.test(id)
    && id.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}
function checkEntry(entry) {
  keys(entry, ['id', 'digest', 'size']);
  if (!validId(entry.id) || !isDigest(entry.digest) || !Number.isSafeInteger(entry.size) || entry.size < 0) {
    fail('CAPSULE_MANIFEST_MALFORMED', 'Invalid manifest entry.');
  }
}
function checkManifest(manifest) {
  if (!Array.isArray(manifest) || !manifest.length || manifest.length > MAX_LEAVES) {
    fail('CAPSULE_MANIFEST_MALFORMED', 'A nonempty bounded manifest is required.');
  }
  let previous = null;
  for (const entry of manifest) {
    checkEntry(entry);
    if (previous !== null && entry.id <= previous) fail('CAPSULE_MANIFEST_ORDER', 'Manifest IDs must be unique and sorted.');
    previous = entry.id;
  }
}
async function tree(manifest) {
  const levels = [await Promise.all(manifest.map(leafHash))];
  while (levels.at(-1).length > 1) {
    const row = levels.at(-1), next = [];
    for (let i = 0; i < row.length; i += 2) next.push(await nodeHash(row[i], row[i + 1] ?? row[i]));
    levels.push(next);
  }
  return levels;
}
function inclusion(levels, index) {
  const leafCount = levels[0].length, siblings = [];
  let cursor = index;
  for (const row of levels.slice(0, -1)) {
    const left = cursor % 2 === 1;
    siblings.push({ side: left ? 'left' : 'right', hash: row[left ? cursor - 1 : cursor + 1] ?? row[cursor] });
    cursor = Math.floor(cursor / 2);
  }
  return { schema: PROOF_SCHEMA, index, leafCount, siblings };
}

// Original product tree: sorted manifest entries, domain-separated leaf/node/root
// hashes, odd-node duplication and an explicit count-bound root. No chain anchor
// or native Crystal capsule/Merkle wire conformance is asserted.
export async function buildManifest(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > MAX_LEAVES) {
    fail('CAPSULE_MANIFEST_MALFORMED', 'A nonempty bounded entry list is required.');
  }
  const manifest = (await Promise.all(entries.map(async entry => {
    keys(entry, ['id', 'bytes']);
    if (![null, Object.prototype].includes(Object.getPrototypeOf(entry)) || Object.getOwnPropertySymbols(entry).length
      || Object.getOwnPropertyNames(entry).length !== 2) fail('CAPSULE_MANIFEST_MALFORMED', 'Entries must have plain enumerable data fields.');
    const id = Object.getOwnPropertyDescriptor(entry, 'id'), data = Object.getOwnPropertyDescriptor(entry, 'bytes');
    if (![id, data].every(field => field && Object.hasOwn(field, 'value') && field.enumerable)) {
      fail('CAPSULE_MANIFEST_MALFORMED', 'Entry accessors are not admitted.');
    }
    if (!validId(id.value)) fail('CAPSULE_MANIFEST_MALFORMED', 'Entry IDs must be safe strings.');
    if (!(data.value instanceof Uint8Array || typeof data.value === 'string')) fail('CAPSULE_BYTES_REQUIRED', 'Entry bytes must be text or a Buffer.');
    const bytes = typeof data.value === 'string' ? utf8(data.value) : new Uint8Array(data.value);
    return { id: id.value, digest: await sha256(bytes), size: bytes.length };
  }))).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  // Copy the admitted manifest into the restricted canonical JSON domain.
  const safe = cloneJson(manifest);
  checkManifest(safe);
  const levels = await tree(safe);
  return { manifest: safe, merkleRoot: await rootHash(levels.at(-1)[0], safe.length), proofs: safe.map((_, index) => inclusion(levels, index)) };
}

export async function verifyInclusion(entry, proof, expectedRoot, trace = []) {
  try {
    entry = cloneJson(entry); proof = cloneJson(proof);
    checkEntry(entry);
    keys(proof, ['schema', 'index', 'leafCount', 'siblings']);
    if (proof.schema !== PROOF_SCHEMA || !isDigest(expectedRoot)
      || !Number.isSafeInteger(proof.leafCount) || proof.leafCount < 1 || proof.leafCount > MAX_LEAVES
      || !Number.isSafeInteger(proof.index) || proof.index < 0 || proof.index >= proof.leafCount || !Array.isArray(proof.siblings)) return false;
    let current = await leafHash(entry), cursor = proof.index, width = proof.leafCount, step = 0;
    trace.push({kind:'out',text:`Manifest domain-separated leaf hash: ${current}; index ${cursor}; count ${width}`});
    while (width > 1) {
      const sibling = proof.siblings[step++];
      keys(sibling, ['side', 'hash']);
      if (!isDigest(sibling.hash) || sibling.side !== (cursor % 2 ? 'left' : 'right')) return false;
      if (cursor % 2 === 0 && cursor + 1 >= width && sibling.hash !== current) return false;
      current = sibling.side === 'left' ? await nodeHash(sibling.hash, current) : await nodeHash(current, sibling.hash);
      trace.push({kind:'out',text:`Manifest binary-hash path step ${step}: ${current}`});
      cursor = Math.floor(cursor / 2); width = Math.ceil(width / 2);
    }
    const computedRoot = await rootHash(current, proof.leafCount);
    trace.push({kind:'out',text:`Manifest count-bound root: ${computedRoot}; checkpoint body root: ${expectedRoot}`});
    return step === proof.siblings.length && computedRoot === expectedRoot;
  } catch { return false; }
}
