"use client";

import { useEffect, useRef } from "react";
import { pictureFinishPixelSize } from "@/lib/zoom";

type Props = {
  src: string;
  startZoom?: number;
  openedAt?: string | null;
  timeLimitSec?: number | null;
  revealed?: boolean;
  className?: string;
  alt?: string;
};

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destW: number,
  destH: number
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = destW / destH;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > cr) {
    sw = img.naturalHeight * cr;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / cr;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, destW, destH);
}

export function PictureFinishImage({
  src,
  startZoom = 10,
  openedAt,
  timeLimitSec,
  revealed = false,
  className = "",
  alt = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.decoding = "async";
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) imgRef.current = img;
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!offRef.current) offRef.current = document.createElement("canvas");

    const paint = (pixel: number) => {
      const img = imgRef.current;
      if (!img?.naturalWidth) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cell = Math.max(1, pixel);
      const dw = Math.max(1, Math.round(w / cell));
      const dh = Math.max(1, Math.round(h / cell));
      const off = offRef.current!;
      off.width = dw;
      off.height = dh;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.imageSmoothingEnabled = cell <= 1.25;
      drawCover(octx, img, dw, dh);
      ctx.imageSmoothingEnabled = cell <= 1.25;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(off, 0, 0, w, h);
    };

    let raf = 0;
    let cancelled = false;

    const loop = () => {
      if (cancelled) return;
      if (revealed) {
        paint(1);
        return;
      }
      const opened = openedAt ? new Date(openedAt).getTime() : Date.now();
      const limit = timeLimitSec ?? 45;
      const tick = () => {
        if (cancelled) return;
        paint(
          pictureFinishPixelSize({
            startZoom,
            elapsedMs: Date.now() - opened,
            timeLimitSec: limit,
          })
        );
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    const waitForImage = () => {
      if (cancelled) return;
      if (imgRef.current?.naturalWidth) {
        loop();
        return;
      }
      raf = requestAnimationFrame(waitForImage);
    };
    waitForImage();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src, startZoom, openedAt, timeLimitSec, revealed]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: "var(--ink-2)" }}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        role="img"
        aria-label={alt}
      />
    </div>
  );
}
