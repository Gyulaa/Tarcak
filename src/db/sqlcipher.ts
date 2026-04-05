/**
 * Build the SQLCipher PRAGMA that supplies a raw 256-bit key.
 *
 * Per SQLCipher docs, a hex-encoded key uses the SQLite blob literal form:
 *   PRAGMA key = "x'hexbytes'";
 *
 * The DEK must be exactly 32 bytes (64 hex chars). Do not pass user passwords here — only the random DEK.
 */

import { bytesToLowerHex } from '../security/encoding';

export function buildRawKeyPragmaSql(dek32: Uint8Array): string {
  if (dek32.length !== 32) {
    throw new Error('SQLCipher raw key must be 32 bytes.');
  }
  const hex = bytesToLowerHex(dek32);
  return `PRAGMA key = "x'${hex}'"`;
}
