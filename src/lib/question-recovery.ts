import { questionRemainingMs } from "@/lib/question-clock";

/**
 * What to do with a QUESTION row after a process restart.
 * A null openedAt is a song round waiting for Play, not a stuck timer.
 * A paused question stays paused until the host resumes it.
 */
export function questionRecoveryPlan(
  questionOpenedAt: Date | null,
  timeLimitSec: number,
  now: number,
  extraMs = 0,
  pausedAt: Date | null = null
):
  | { action: "wait" }
  | { action: "paused" }
  | { action: "lock" }
  | { action: "arm"; remainingMs: number } {
  if (!questionOpenedAt) return { action: "wait" };
  if (pausedAt) return { action: "paused" };
  const remainingMs = questionRemainingMs({
    openedAt: questionOpenedAt,
    timeLimitSec,
    extraMs,
    now,
  });
  if (remainingMs == null || remainingMs <= 0) return { action: "lock" };
  return { action: "arm", remainingMs };
}
