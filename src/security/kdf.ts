/**
 * Password-based key derivation: PBKDF2-HMAC-SHA256 (RFC 2898).
 *
 * We use @noble/hashes (audited, dependency-free JS) because expo-crypto exposes digests
 * but not PBKDF2. The async variant yields to the event loop so the UI can stay responsive
 * during PBKDF2 (see `PBKDF2_ITERATIONS` in `constants.ts`).
 */

import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH_BYTES } from './constants';
import { normalizePassword } from './passwordPolicy';

/**
 * Derive a 256-bit KEK from the user password and salt.
 * Overwrites are handled inside noble where possible; callers should zero the returned
 * KEK with `zeroize()` as soon as wrapping/unwrapping is done.
 */
export async function deriveKekFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<Uint8Array> {
  const normalized = normalizePassword(password);
  return pbkdf2Async(sha256, normalized, salt, {
    c: iterations,
    dkLen: PBKDF2_KEY_LENGTH_BYTES,
    asyncTick: 10,
  });
}

/**
 * Best-effort zeroing of sensitive key material held in Uint8Arrays.
 * JavaScript cannot guarantee memory is scrubbed (GC, copies, etc.), but this reduces
 * accidental long-lived key exposure in the heap.
 */
export function zeroize(bytes: Uint8Array | null | undefined): void {
  if (bytes) {
    bytes.fill(0);
  }
}
