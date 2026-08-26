"use client";

import { useEffect, useRef } from "react";
import { zoomScale } from "@/lib/zoom";

type Props = {
  src: string;
  startZoom?: number;
  openedAt?: string | null;
  timeLimitSec?: number | null;
  revealed?: boolean;
  className?: string;
  alt?: string;
};

export function ZoomRevealImage({
  src,
  startZoom = 10,
  openedAt,
  timeLimitSec,
  revealed = false,
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
    const opened = openedAt ? new Date(openedAt).getTime() : Date.now();
    const limit = timeLimitSec ?? 30;
    let raf = 0;
    const tick = () => {
      const scale = zoomScale({
        startZoom,
        elapsedMs: Date.now() - opened,
        timeLimitSec: limit,
      });
      img.style.transform = `scale(${scale})`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [src, startZoom, openedAt, timeLimitSec, revealed]);

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
