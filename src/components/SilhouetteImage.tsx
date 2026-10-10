"use client";

import { useEffect, useRef } from "react";
import { silhouetteReveal } from "@/lib/zoom";

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

function colorDist(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number
) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db) / 441.7;
}

/** How much each pixel belongs to the subject (0 = background, 1 = shape). */
function subjectMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2]] as const;
  };
  const corners = [
    sample(0, 0),
    sample(width - 1, 0),
    sample(0, height - 1),
    sample(width - 1, height - 1),
  ];
  const br = corners.reduce((sum, c) => sum + c[0], 0) / corners.length;
  const bg = corners.reduce((sum, c) => sum + c[1], 0) / corners.length;
  const bb = corners.reduce((sum, c) => sum + c[2], 0) / corners.length;

  const count = width * height;
  const mask = new Float32Array(count);
  let subjectPixels = 0;
  for (let p = 0; p < count; p++) {
    const i = p * 4;
    const dist = colorDist(pixels[i], pixels[i + 1], pixels[i + 2], br, bg, bb);
    mask[p] = dist;
    if (dist > 0.18) subjectPixels++;
  }

  const ratio = subjectPixels / count;
  if (ratio < 0.04 || ratio > 0.94) {
    for (let p = 0; p < count; p++) {
      const i = p * 4;
      const lum =
        (pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722) /
        255;
      mask[p] = 1 - lum;
    }
  }
  return mask;
}

export function SilhouetteImage({
  src,
  startZoom = 10,
  openedAt,
  timeLimitSec,
  revealed = false,
  clockOffsetMs = 0,
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

    let mask: Float32Array | null = null;
    let original: Uint8ClampedArray | null = null;
    let bufW = 0;
    let bufH = 0;

    const paint = (amount: number) => {
      const img = imgRef.current;
      if (!img?.naturalWidth) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = window.devicePixelRatio || 1;
      const bw = Math.max(2, Math.round(w));
      const bh = Math.max(2, Math.round(h));
      const off = offRef.current!;
      if (!mask || bw !== bufW || bh !== bufH) {
        off.width = bw;
        off.height = bh;
        const octx = off.getContext("2d", { willReadFrequently: true });
        if (!octx) return;
        octx.imageSmoothingEnabled = true;
        drawCover(octx, img, bw, bh);
        const snap = octx.getImageData(0, 0, bw, bh);
        original = new Uint8ClampedArray(snap.data);
        mask = subjectMask(original, bw, bh);
        bufW = bw;
        bufH = bh;
      }
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx || !original || !mask) return;
      const out = octx.createImageData(bufW, bufH);
      const p = Math.min(1, Math.max(0, amount));
      for (let i = 0; i < mask.length; i++) {
        const shape = Math.min(1, mask[i] / 0.22);
        const o = i * 4;
        const base = 8 + (1 - shape) * 14;
        out.data[o] = base + (original[o] - base) * p;
        out.data[o + 1] = base + (original[o + 1] - base) * p;
        out.data[o + 2] = base + (original[o + 2] - base) * p;
        out.data[o + 3] = 255;
      }
      octx.putImageData(out, 0, 0);

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(off, 0, 0, w, h);
    };

    let raf = 0;
    let cancelled = false;
    const waitForImage = () => {
      if (cancelled) return;
      if (!imgRef.current?.naturalWidth) {
        raf = requestAnimationFrame(waitForImage);
        return;
      }
      const tick = () => {
        if (cancelled) return;
        const now = Date.now() - clockOffsetMs;
        const opened = openedAt ? new Date(openedAt).getTime() : now;
        paint(
          silhouetteReveal({
            startZoom,
            elapsedMs: revealed ? (timeLimitSec ?? 45) * 1000 : now - opened,
            timeLimitSec: timeLimitSec ?? 45,
            revealed,
          })
        );
        if (!revealed) raf = requestAnimationFrame(tick);
      };
      tick();
    };
    waitForImage();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src, startZoom, openedAt, timeLimitSec, revealed, clockOffsetMs]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: "var(--ink-2)" }}
    >
      <canvas ref={canvasRef} className="h-full w-full" role="img" aria-label={alt} />
    </div>
  );
}
