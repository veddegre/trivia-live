"use client";

import { useEffect, useState } from "react";

import { visualNowMs } from "@/lib/question-clock";

/** Counts down from questionOpenedAt + timeLimitSec, plus any host-added seconds. */
export function useQuestionCountdown(
  questionOpenedAt: string | null | undefined,
  timeLimitSec: number | null | undefined,
  active: boolean,
  clockOffsetMs = 0,
  pausedAt?: string | null,
  extraMs = 0
): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!active || !questionOpenedAt || !timeLimitSec) {
      setRemaining(null);
      return;
    }
    const opened = new Date(questionOpenedAt).getTime();
    const limit = timeLimitSec * 1000 + extraMs;
    const tick = () => {
      const left = Math.max(0, limit - (visualNowMs(Date.now(), clockOffsetMs, pausedAt) - opened));
      setRemaining(Math.ceil(left / 1000));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [questionOpenedAt, timeLimitSec, active, clockOffsetMs, pausedAt, extraMs]);

  return remaining;
}
