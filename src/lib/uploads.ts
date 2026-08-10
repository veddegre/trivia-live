import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const ALLOWED = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
]);

export function extensionForMime(mime: string): string | null {
  return ALLOWED.get(mime) ?? null;
}

export async function saveUpload(file: File): Promise<{ url: string; filename: string }> {
  const ext = extensionForMime(file.type);
  if (!ext) throw new Error("Unsupported file type");
  if (file.size > 2 * 1024 * 1024) throw new Error("File too large (max 2MB)");

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const dest = path.join(UPLOAD_DIR, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buf);
  return { url: `/uploads/${filename}`, filename };
}

export function safeUploadPath(filename: string): string | null {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return path.join(UPLOAD_DIR, filename);
}
