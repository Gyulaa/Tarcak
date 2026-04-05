/**
 * Cryptographically secure random bytes via expo-crypto (native CSPRNG on iOS/Android).
 *
 * Note: `getRandomBytesAsync` is capped at 1024 bytes per call in expo-crypto; this helper chains calls.
 */

import * as Crypto from 'expo-crypto';

const EXPO_RANDOM_CHUNK_MAX = 1024;

/**
 * Fill a buffer with CSPRNG output. Length must be non-negative and reasonable for app use.
 */
export async function secureRandomBytes(length: number): Promise<Uint8Array> {
  if (!Number.isInteger(length) || length < 0 || length > 4 * 1024 * 1024) {
    throw new Error(`secureRandomBytes: invalid length ${length}`);
  }
  const out = new Uint8Array(length);
  let offset = 0;
  while (offset < length) {
    const take = Math.min(EXPO_RANDOM_CHUNK_MAX, length - offset);
    const chunk = await Crypto.getRandomBytesAsync(take);
    out.set(chunk, offset);
    offset += take;
  }
  return out;
}
