import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Longest edge after server normalize (matches editor crop export). */
export const MAX_IMAGE_EDGE = 1600;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const KEY_RE = /^[a-f0-9]{32}\.(jpg|jpeg|png|webp|gif)$/i;

export function isAllowedImageMime(mime: string): boolean {
  return mime in MIME_TO_EXT;
}

export function isValidMediaKey(key: string): boolean {
  return KEY_RE.test(key);
}

export function mimeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_MIME[ext] || "application/octet-stream";
}

export function getUploadDir(): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "data", "uploads");
}

export function ensureUploadDir(): string {
  const dir = getUploadDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveUploadPath(key: string): string | null {
  if (!isValidMediaKey(key)) return null;
  const dir = path.resolve(getUploadDir());
  const full = path.resolve(dir, key);
  const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
  if (!full.startsWith(prefix)) return null;
  return full;
}

export function mediaFileExists(key: string): boolean {
  const full = resolveUploadPath(key);
  if (!full) return false;
  try {
    return fs.statSync(full).isFile();
  } catch {
    return false;
  }
}

/**
 * Normalize uploads: honor EXIF orientation, fit inside MAX_IMAGE_EDGE,
 * encode as JPEG. Always stores a `.jpg` key.
 */
export async function saveImageUpload(opts: {
  buffer: Buffer;
  mime: string;
}): Promise<{ key: string }> {
  if (!MIME_TO_EXT[opts.mime]) throw new Error("Unsupported image type");
  if (opts.buffer.length === 0) throw new Error("Empty file");
  if (opts.buffer.length > MAX_IMAGE_BYTES) throw new Error("Image is too large");

  let out: Buffer;
  try {
    out = await sharp(opts.buffer)
      .rotate()
      .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error("Could not process image");
  }

  if (out.length === 0) throw new Error("Could not process image");
  if (out.length > MAX_IMAGE_BYTES) throw new Error("Image is too large");

  const key = `${randomBytes(16).toString("hex")}.jpg`;
  const dir = ensureUploadDir();
  const full = path.join(dir, key);
  await fs.promises.writeFile(full, out, { flag: "wx" });
  return { key };
}

export async function deleteMediaFile(key: string): Promise<void> {
  const full = resolveUploadPath(key);
  if (!full) return;
  try {
    await fs.promises.unlink(full);
  } catch {
    /* already gone */
  }
}

export async function deleteMediaFiles(keys: Iterable<string>): Promise<void> {
  const unique = [...new Set([...keys].filter(Boolean))];
  await Promise.all(unique.map((key) => deleteMediaFile(key)));
}
