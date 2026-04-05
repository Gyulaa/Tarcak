import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * One forward-only schema step. Versions are monotonic integers; each runs at most once per DB file.
 */
export type Migration = {
  readonly version: number;
  /** Short label for logs and debugging. */
  readonly name: string;
  /** DDL / DML for this version (runner does not wrap in a transaction — SQLite DDL commits). */
  readonly up: (db: SQLiteDatabase) => Promise<void>;
};
