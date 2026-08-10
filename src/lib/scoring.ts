/**
 * Server-authoritative scoring: correct answers only.
 * Faster answers score higher: base + timeBonus * (1 - elapsed/limit).
 */
export function scoreAnswer(opts: {
  isCorrect: boolean;
  elapsedMs: number;
  timeLimitSec: number;
  basePoints: number;
  timeBonus: number;
}): number {
  if (!opts.isCorrect) return 0;
  const limitMs = Math.max(1, opts.timeLimitSec * 1000);
  const ratio = Math.min(1, Math.max(0, opts.elapsedMs / limitMs));
  return Math.round(opts.basePoints + opts.timeBonus * (1 - ratio));
}
