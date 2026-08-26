/** Square output size for Image Zoom crops (matches server MAX_IMAGE_EDGE). */
export const IMAGE_OUTPUT_SIZE = 1600;

export type CropRect = {
  x: number;
  y: number;
  size: number;
};

/** Square side length in natural pixels for a given zoom (>= 1). */
export function cropSideForZoom(
  naturalW: number,
  naturalH: number,
  zoom: number
): number {
  const minSide = Math.min(naturalW, naturalH);
  const z = Math.max(1, zoom);
  return Math.max(1, minSide / z);
}

export function clampCrop(
  naturalW: number,
  naturalH: number,
  crop: CropRect
): CropRect {
  const size = Math.min(crop.size, naturalW, naturalH);
  const x = Math.min(Math.max(0, crop.x), Math.max(0, naturalW - size));
  const y = Math.min(Math.max(0, crop.y), Math.max(0, naturalH - size));
  return { x, y, size };
}

export function centeredCrop(
  naturalW: number,
  naturalH: number,
  zoom = 1
): CropRect {
  const size = cropSideForZoom(naturalW, naturalH, zoom);
  return clampCrop(naturalW, naturalH, {
    x: (naturalW - size) / 2,
    y: (naturalH - size) / 2,
    size,
  });
}

/** Draw the square crop to a JPEG blob (max IMAGE_OUTPUT_SIZE). */
export async function exportSquareCrop(
  image: CanvasImageSource & { width: number; height: number },
  crop: CropRect,
  opts?: { outputSize?: number; quality?: number }
): Promise<Blob> {
  const out = Math.min(
    opts?.outputSize ?? IMAGE_OUTPUT_SIZE,
    Math.round(crop.size)
  );
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop image");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    out,
    out
  );

  const quality = opts?.quality ?? 0.85;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
  if (!blob) throw new Error("Could not encode image");
  return blob;
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}
