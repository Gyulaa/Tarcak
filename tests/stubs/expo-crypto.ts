/** Node stand-in for the native expo-crypto module (tests only). */
import { randomBytes, randomUUID as nodeRandomUUID } from 'node:crypto';

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return new Uint8Array(randomBytes(byteCount));
}

export function randomUUID(): string {
  return nodeRandomUUID();
}
