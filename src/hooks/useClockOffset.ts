"use client";

import { useRef } from "react";
import { clockOffsetMs } from "@/lib/server-clock";

/**
 * How far this device's clock is ahead of the server.
 * Measured when a state payload arrives, then reused until the next one.
 */
export function useClockOffset(serverNow: string | null | undefined): number {
  const applied = useRef<string | null>(null);
  const offset = useRef(0);
  if (serverNow && serverNow !== applied.current) {
    const next = clockOffsetMs(serverNow, Date.now());
    if (next != null) {
      applied.current = serverNow;
      offset.current = next;
    }
  }
  return offset.current;
}
