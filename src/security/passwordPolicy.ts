/**
 * Password normalization and strength checks.
 *
 * NFKC normalization follows OWASP / Unicode best practice so visually similar passwords
 * map consistently before UTF-8 encoding for PBKDF2.
 */

import { MIN_PASSWORD_LENGTH } from './constants';
import { WeakPasswordError } from './errors';

/**
 * Apply Unicode NFKC normalization (compatibility composition).
 * Do this once at the boundary before feeding the password to the KDF.
 */
export function normalizePassword(password: string): string {
  return password.normalize('NFKC');
}

/**
 * Enforce a minimal policy before expensive KDF work.
 * Extend later (entropy checks, blocklists) without changing the KDF shape.
 */
export function assertPasswordAcceptable(password: string): void {
  const n = normalizePassword(password);
  const len = [...n].length; // code points, not UTF-16 units
  if (len < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters (after normalization).`
    );
  }
}
