/** Extra time a host can add to the open question, in 10 second steps. */
export const QUESTION_EXTRA_STEP_MS = 10_000;
export const QUESTION_EXTRA_CAP_MS = 120_000;

export function nextExtraMs(
  current: number,
  step = QUESTION_EXTRA_STEP_MS,
  cap = QUESTION_EXTRA_CAP_MS
): number {
  return Math.min(cap, current + step);
}

/**
 * Milliseconds left on the question clock.
 * Pause freezes the reading at the pause instant. Extra time extends the deadline.
 */
export function questionRemainingMs(opts: {
  openedAt: Date | null;
  timeLimitSec: number;
  extraMs?: number;
  pausedAt?: Date | null;
  now: number;
}): number | null {
  if (!opts.openedAt) return null;
  const end = opts.pausedAt ? opts.pausedAt.getTime() : opts.now;
  return opts.timeLimitSec * 1000 + (opts.extraMs ?? 0) - (end - opts.openedAt.getTime());
}

/** Move the start forward by the pause so later answers and visuals skip that gap. */
export function resumedOpenedAt(openedAt: Date, pausedAt: Date, now: Date): Date {
  return new Date(openedAt.getTime() + (now.getTime() - pausedAt.getTime()));
}

/**
 * Server-timeline "now" for countdowns and reveals.
 * A pause stamp is already server time, so the device offset is not applied to it.
 */
export function visualNowMs(
  clientNowMs: number,
  clockOffsetMs: number,
  pausedAt?: string | null
): number {
  if (pausedAt) {
    const paused = new Date(pausedAt).getTime();
    if (!Number.isNaN(paused)) return paused;
  }
  return clientNowMs - clockOffsetMs;
}
