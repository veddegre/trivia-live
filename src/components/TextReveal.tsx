"use client";

import { useEffect, useState } from "react";
import { finishLineTokens, unscrambleText } from "@/lib/text-reveal";

type Props = {
  text: string;
  mode: "unscramble" | "line";
  seed?: string;
  openedAt?: string | null;
  timeLimitSec?: number | null;
  revealed?: boolean;
  /** Subtract from Date.now() so a fast or slow device tracks the server clock. */
  clockOffsetMs?: number;
  className?: string;
};

function progressAt(
  openedAt: string | null | undefined,
  timeLimitSec: number | null | undefined,
  revealed: boolean,
  clockOffsetMs: number
): number {
  if (revealed) return 1;
  if (!openedAt) return 0;
  const limit = Math.max(1, (timeLimitSec ?? 45) * 1000);
  const elapsed = Date.now() - clockOffsetMs - new Date(openedAt).getTime();
  return Math.min(1, Math.max(0, elapsed / limit));
}

export function TextReveal({
  text,
  mode,
  seed = "puzzle",
  openedAt,
  timeLimitSec,
  revealed = false,
  clockOffsetMs = 0,
  className = "",
}: Props) {
  const [progress, setProgress] = useState(() =>
    progressAt(openedAt, timeLimitSec, revealed, clockOffsetMs)
  );

  useEffect(() => {
    if (revealed || !openedAt) {
      setProgress(revealed ? 1 : 0);
      return;
    }
    let raf = 0;
    const tick = () => {
      setProgress(progressAt(openedAt, timeLimitSec, false, clockOffsetMs));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [openedAt, timeLimitSec, revealed, clockOffsetMs]);

  if (mode === "unscramble") {
    const shown = unscrambleText(text, progress, seed);
    return (
      <p
        className={`text-center font-mono text-3xl font-bold tracking-[0.18em] text-chalk md:text-5xl ${className}`}
      >
        {shown}
      </p>
    );
  }

  const tokens = finishLineTokens(text, progress);
  return (
    <p
      className={`text-center text-2xl font-semibold leading-snug text-chalk md:text-4xl ${className}`}
    >
      {tokens.map((token, i) => (
        <span key={`${i}-${token.hidden ? "h" : "s"}`}>
          {i > 0 ? " " : null}
          <span className={token.hidden ? "text-muted/70" : undefined}>
            {token.text}
          </span>
        </span>
      ))}
    </p>
  );
}
