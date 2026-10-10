/**
 * What to do with a QUESTION row after a process restart.
 * A null openedAt is a song round waiting for Play, not a stuck timer.
 */
export function questionRecoveryPlan(
  questionOpenedAt: Date | null,
  timeLimitSec: number,
  now: number
): { action: "wait" } | { action: "lock" } | { action: "arm"; remainingMs: number } {
  if (!questionOpenedAt) return { action: "wait" };
  const remainingMs = timeLimitSec * 1000 - (now - questionOpenedAt.getTime());
  if (remainingMs <= 0) return { action: "lock" };
  return { action: "arm", remainingMs };
}
