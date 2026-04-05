/**
 * Format `occurred_at` (Unix ms) for UI — locale-aware date and time.
 */
export function formatOccurredAt(occurredAtMs: number): string {
  try {
    return new Date(occurredAtMs).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(occurredAtMs);
  }
}
