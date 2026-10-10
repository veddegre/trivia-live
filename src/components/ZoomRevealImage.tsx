"use client";

import { useEffect, useRef } from "react";
import { zoomScale } from "@/lib/zoom";

type Props = {
  src: string;
  startZoom?: number;
  openedAt?: string | null;
  timeLimitSec?: number | null;
  revealed?: boolean;
  /** Subtract from Date.now() so a fast or slow device tracks the server clock. */
  clockOffsetMs?: number;
  className?: string;
  alt?: string;
};

export function ZoomRevealImage({
  src,
  startZoom = 10,
  openedAt,
  timeLimitSec,
  revealed = false,
  clockOffsetMs = 0,
  className = "",
  alt = "",
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    if (revealed) {
      img.style.transition = "transform 0.7s ease-out";
      img.style.transform = "scale(1)";
      return;
    }

    img.style.transition = "none";
    const now = () => Date.now() - clockOffsetMs;
    const opened = openedAt ? new Date(openedAt).getTime() : now();
    const limit = timeLimitSec ?? 30;
    let raf = 0;
    const tick = () => {
      const scale = zoomScale({
        startZoom,
        elapsedMs: now() - opened,
        timeLimitSec: limit,
      });
      img.style.transform = `scale(${scale})`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [src, startZoom, openedAt, timeLimitSec, revealed, clockOffsetMs]);

  return (
    <div
      className={`relative overflow-hidden bg-ink ${className}`}
      style={{ background: "var(--ink-2)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`h-full w-full ${revealed ? "object-contain" : "object-cover"}`}
        style={{
          transformOrigin: "center center",
          transform: `scale(${revealed ? 1 : startZoom})`,
          willChange: "transform",
        }}
        draggable={false}
      />
    </div>
  );
}
