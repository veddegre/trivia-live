/**
 * Playback rate eases from startSpeed → 1 over the question timer (log space),
 * same idea as Image Zoom: linear rate feels stuck fast, then rushes at the end.
 */
export function playbackRate(opts: {
  startSpeed: number;
  elapsedMs: number;
  timeLimitSec: number;
  revealed?: boolean;
}): number {
  if (opts.revealed) return 1;
  const start = Math.max(1, opts.startSpeed);
  const limitMs = Math.max(1, opts.timeLimitSec * 1000);
  const t = Math.min(1, Math.max(0, opts.elapsedMs / limitMs));
  return start ** (1 - t);
}
