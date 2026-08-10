"use client";

import { useEffect, useState } from "react";

/** Counts down from questionOpenedAt + timeLimitSec. Returns whole seconds remaining. */
export function useQuestionCountdown(
  questionOpenedAt: string | null | undefined,
  timeLimitSec: number | null | undefined,
  active: boolean
): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!active || !questionOpenedAt || !timeLimitSec) {
      setRemaining(null);
      return;
    }
    const opened = new Date(questionOpenedAt).getTime();
    const limit = timeLimitSec * 1000;
    const tick = () => {
      const left = Math.max(0, limit - (Date.now() - opened));
      setRemaining(Math.ceil(left / 1000));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [questionOpenedAt, timeLimitSec, active]);

  return remaining;
}
