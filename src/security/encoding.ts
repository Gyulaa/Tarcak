/**
 * Binary ↔ text helpers for SecureStore (strings only) and SQLCipher hex key literals.
 * Avoids Buffer so the same code runs on Hermes without extra polyfills.
 */

/**
 * Convert bytes to lowercase hex (for SQLCipher `PRAGMA key = "x'…'"` raw key form).
 */
export function bytesToLowerHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Parse strict lowercase/uppercase hex into bytes. Rejects odd length and non-hex characters.
 */
export function hexToBytes(hex: string): Uint8Array {
  const h = hex.trim();
  if (h.length % 2 !== 0) {
    throw new Error('hexToBytes: odd-length string');
  }
  if (!/^[0-9a-fA-F]*$/.test(h)) {
    throw new Error('hexToBytes: non-hex character');
  }
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const CHUNK = 0x8000;

/**
 * Base64-encode arbitrary bytes (SecureStore value).
 * Built in chunks to stay below `String.fromCharCode.apply` argument limits on some engines.
 */
export function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.subarray(i, Math.min(i + CHUNK, data.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/** Decode Base64 to bytes. */
export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
