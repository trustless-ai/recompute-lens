export const MAX_DOCUMENT_BYTES: number;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export function scalarString(value: string): string;
export function parseStrict(input: string | Uint8Array): JsonValue;
export function canonicalize(input: unknown): Uint8Array;
export function problem(code: string, message: string): Error & { code: string };
