// SPDX-License-Identifier: Apache-2.0
// ReceiptOS common.mjs helpers, ported without changing schema/equality semantics.
// See THIRD_PARTY_NOTICES.md and SOURCE_PINS.json for exact source attribution.
import { canonicalize, problem } from './strict-json.js';
import { equalBytes, fromBase64, sha256 } from './bytes.js';
export { canonicalize, sha256, problem };
export const equal = (a, b) => equalBytes(canonicalize(a), canonicalize(b));
export const HEX = /^[0-9a-f]{64}$/;
export const base64 = fromBase64;
export function keys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || required.some(k => !Object.hasOwn(value, k))
    || Object.keys(value).some(k => !required.includes(k) && !optional.includes(k))) {
    throw problem('SCHEMA_MISMATCH', 'Missing or unknown object fields.');
  }
}
