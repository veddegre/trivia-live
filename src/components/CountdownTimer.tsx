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
  const r = size === "lg" ? 52 : 40;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const box = size === "lg" ? "w-44 md:w-52" : "w-28 md:w-32";
  const digit = size === "lg" ? "text-5xl md:text-6xl" : "text-3xl md:text-4xl";

  return (
    <div className={`mx-auto flex ${box} flex-col items-center`}>
      <div className="relative aspect-square w-full">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="color-mix(in srgb, var(--line) 85%, transparent)"
            strokeWidth={size === "lg" ? 8 : 7}
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={urgent ? "var(--bad)" : "var(--amber)"}
            strokeWidth={size === "lg" ? 8 : 7}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-200 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={`display tabular-nums leading-none ${digit} ${
              urgent ? "text-bad anim-glow" : size === "lg" ? "text-amber" : "text-chalk"
            }`}
          >
            {remainingSec}
          </div>
          <div
            className={`mt-0.5 font-bold uppercase tracking-[0.18em] ${
              size === "lg" ? "text-[0.65rem] text-amber" : "text-[0.6rem] text-amber"
            }`}
          >
            {remainingSec === 0 ? "Up" : size === "lg" ? "Seconds" : "s"}
          </div>
        </div>
      </div>
    </div>
  );
}
