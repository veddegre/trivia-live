/**
 * Starting scale eases toward 1 as the clock runs down.
 * Ease-in (t²) keeps the crop tight longer, then opens in the last stretch.
 */
export function zoomScale(opts: {
  startZoom: number;
  elapsedMs: number;
  timeLimitSec: number;
  revealed?: boolean;
}): number {
  if (opts.revealed) return 1;
  const start = Math.max(1, opts.startZoom);
  const limitMs = Math.max(1, opts.timeLimitSec * 1000);
  const t = Math.min(1, Math.max(0, opts.elapsedMs / limitMs));
  const eased = t * t;
  return start + (1 - start) * eased;
}

export function mediaPublicUrl(imageKey: string | null | undefined): string | null {
  if (!imageKey) return null;
  return `/api/media/${encodeURIComponent(imageKey)}`;
}
