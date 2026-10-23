// SPDX-License-Identifier: CC0-1.0
// Browser platform primitives only. No proof-supplied trust and no network calls.
export const utf8 = text => new TextEncoder().encode(text);
export const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export const concat = (...parts) => {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) { result.set(part, at); at += part.length; }
  return result;
};
export const equalBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
export function unhex(text) {
  if (typeof text !== 'string' || !/^(?:[0-9a-f]{2})*$/.test(text)) throw new Error('INVALID_HEX');
  return Uint8Array.from(text.match(/../g) ?? [], n => parseInt(n, 16));
}
export function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
}
export function fromBase64(value) {
  if (typeof value !== 'string' || value.length % 4) throw new Error('INVALID_BASE64');
  if (value.length > 4 * Math.ceil(4 * 1024 * 1024 / 3)) throw new Error('INPUT_TOO_LARGE');
  // Avoid a nested repeated regexp: Chromium can exhaust its regexp stack on a
  // valid 4 MiB document. Character scan + padding + roundtrip is equivalent.
  if (/[^A-Za-z0-9+/=]/.test(value)) throw new Error('INVALID_BASE64');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  if (value.slice(0, value.length - padding).includes('=')) throw new Error('INVALID_BASE64');
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  if (bytes.length > 4 * 1024 * 1024) throw new Error('INPUT_TOO_LARGE');
  if (toBase64(bytes) !== value) throw new Error('INVALID_BASE64');
  return bytes;
}
export async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('WEBCRYPTO_UNAVAILABLE');
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))));
}
export async function verifyEd25519(spki, signature, bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('WEBCRYPTO_UNAVAILABLE');
  const key = await crypto.subtle.importKey('spki', spki, { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify('Ed25519', key, signature, bytes);
}
