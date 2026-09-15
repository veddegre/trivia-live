/**
 * Zoom-out tracks the clock at a constant optical speed (lerp in log space).
 * Linear CSS scale looks slow, then rushes at the end: each step near 1x
 * shows much more of the photo than the same step at 10x.
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
  return start ** (1 - t);
}

/**
 * Mosaic cell size in CSS pixels. Uses the same log-time curve as zoomScale
 * (startZoom 6 / 10 / 16 → Soft / Heavy / Extreme). Revealed is 1px = sharp.
 */
export function pictureFinishPixelSize(opts: {
  startZoom: number;
  elapsedMs: number;
  timeLimitSec: number;
  revealed?: boolean;
}): number {
  if (opts.revealed) return 1;
  const scale = zoomScale(opts);
  if (scale <= 1) return 1;
  return scale * 4;
}

export function mediaPublicUrl(imageKey: string | null | undefined): string | null {
  if (!imageKey) return null;
  return `/api/media/${encodeURIComponent(imageKey)}`;
}
