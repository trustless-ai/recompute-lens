export function utf8(text: string): Uint8Array;
export function hex(bytes: Uint8Array): string;
export function concat(...parts: Uint8Array[]): Uint8Array;
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean;
export function unhex(text: string): Uint8Array;
export function toBase64(bytes: Uint8Array): string;
export function fromBase64(value: string): Uint8Array;
export function sha256(bytes: Uint8Array): Promise<string>;
export function verifyEd25519(spki: Uint8Array, signature: Uint8Array, bytes: Uint8Array): Promise<boolean>;
