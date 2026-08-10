"use client";

type Props = {
  remainingSec: number | null;
  totalSec: number | null;
  size?: "md" | "lg";
};

export function CountdownTimer({ remainingSec, totalSec, size = "md" }: Props) {
  if (remainingSec === null || !totalSec) return null;

  const pct = Math.max(0, Math.min(1, remainingSec / totalSec));
  const urgent = remainingSec <= 5;
  const digitClass =
    size === "lg"
      ? "text-6xl md:text-8xl"
      : "text-4xl md:text-5xl";

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-3">
        <div
          className={`display tabular-nums leading-none ${digitClass} ${
            urgent ? "text-bad anim-glow" : "text-amber"
          }`}
        >
          {remainingSec}
        </div>
        <div className="pb-1 text-sm uppercase tracking-[0.18em] text-muted">
          {remainingSec === 0 ? "Time’s up" : "seconds left"}
        </div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-ink-2">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
            urgent ? "bg-bad" : "bg-amber"
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
