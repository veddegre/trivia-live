"use client";

import { useEffect, useRef, useState } from "react";
import {
  centeredCrop,
  clampCrop,
  cropSideForZoom,
  exportSquareCrop,
  loadImageFromUrl,
  type CropRect,
} from "@/lib/image-crop";

type Props = {
  /** Object URL or public media URL to crop */
  src: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
};

const FRAME = 320;

export function ImageCropModal({ src, onCancel, onConfirm }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setImg(null);
    setCrop(null);
    setZoom(1);
    loadImageFromUrl(src)
      .then((loaded) => {
        if (cancelled) return;
        setImg(loaded);
        setCrop(centeredCrop(loaded.naturalWidth, loaded.naturalHeight, 1));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load image");
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  function applyZoom(nextZoom: number) {
    if (!img || !crop) return;
    const size = cropSideForZoom(
      img.naturalWidth,
      img.naturalHeight,
      nextZoom
    );
    const cx = crop.x + crop.size / 2;
    const cy = crop.y + crop.size / 2;
    setZoom(nextZoom);
    setCrop(
      clampCrop(img.naturalWidth, img.naturalHeight, {
        x: cx - size / 2,
        y: cy - size / 2,
        size,
      })
    );
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!crop || e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: crop.x,
      originY: crop.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!img || !crop || !dragRef.current) return;
    if (dragRef.current.pointerId !== e.pointerId) return;
    const displayScale = FRAME / crop.size;
    const dx = (e.clientX - dragRef.current.startX) / displayScale;
    const dy = (e.clientY - dragRef.current.startY) / displayScale;
    // Dragging the image right reveals more of the left → crop x decreases
    setCrop(
      clampCrop(img.naturalWidth, img.naturalHeight, {
        x: dragRef.current.originX - dx,
        y: dragRef.current.originY - dy,
        size: crop.size,
      })
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }

  async function confirm() {
    if (!img || !crop) return;
    setBusy(true);
    setError("");
    try {
      const blob = await exportSquareCrop(img, crop);
      await onConfirm(blob);
    } catch {
      setError("Could not save crop");
    } finally {
      setBusy(false);
    }
  }

  const displayScale = crop ? FRAME / crop.size : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-xl">
        <h3 className="display text-xl text-chalk">Square crop</h3>
        <p className="mt-1 text-sm text-muted">
          Drag to center the subject. Zoom in for a tighter crop. Image Zoom
          works best with the subject in the middle.
        </p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative touch-none overflow-hidden rounded-xl border border-line bg-ink-2"
            style={{ width: FRAME, height: FRAME, cursor: "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {img && crop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                draggable={false}
                className="pointer-events-none max-w-none select-none"
                style={{
                  width: img.naturalWidth * displayScale,
                  height: img.naturalHeight * displayScale,
                  transform: `translate(${-crop.x * displayScale}px, ${-crop.y * displayScale}px)`,
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                {error || "Loading…"}
              </div>
            )}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            disabled={!img}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--amber)]"
          />
        </label>

        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void confirm()}
            disabled={!img || !crop || busy}
          >
            {busy ? "Saving…" : "Use crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
