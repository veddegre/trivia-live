"use client";

import { useEffect, useState } from "react";
import { finishLineTokens, revealProgress, unscrambleText } from "@/lib/text-reveal";

type Props = {
  text: string;
  mode: "unscramble" | "line";
  seed?: string;
  openedAt?: string | null;
  timeLimitSec?: number | null;
  revealed?: boolean;
  /** Subtract from Date.now() so a fast or slow device tracks the server clock. */
  clockOffsetMs?: number;
  /** Text is already the on-screen puzzle. Do not reveal further from a secret phrase. */
  literal?: boolean;
  className?: string;
};

export function TextReveal({
  text,
  mode,
  seed = "puzzle",
  openedAt,
  timeLimitSec,
  revealed = false,
  clockOffsetMs = 0,
  literal = false,
  className = "",
}: Props) {
  const [progress, setProgress] = useState(() =>
    revealProgress(openedAt, timeLimitSec, Date.now() - clockOffsetMs, revealed)
  );

  useEffect(() => {
    if (literal || revealed || !openedAt) {
      if (!literal) setProgress(revealed ? 1 : 0);
      return;
    }
    let raf = 0;
    const tick = () => {
      setProgress(
        revealProgress(openedAt, timeLimitSec, Date.now() - clockOffsetMs, false)
      );
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [openedAt, timeLimitSec, revealed, clockOffsetMs, literal]);

  if (literal) {
    if (mode === "unscramble") {
      return (
        <p
          className={`text-center font-mono text-3xl font-bold tracking-[0.18em] text-chalk md:text-5xl ${className}`}
        >
          {text}
        </p>
      );
    }
    const words = text.split(" ");
    return (
      <p
        className={`text-center text-2xl font-semibold leading-snug text-chalk md:text-4xl ${className}`}
      >
        {words.map((word, i) => {
          const hidden = !/[\p{L}\p{N}]/u.test(word);
          return (
            <span key={`${i}-${word}`}>
              {i > 0 ? " " : null}
              <span className={hidden ? "text-muted/70" : undefined}>{word}</span>
            </span>
          );
        })}
      </p>
    );
  }

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
