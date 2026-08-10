import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { safeUploadPath } from "@/lib/uploads";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

type Ctx = { params: Promise<{ filename: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { filename } = await ctx.params;
  const filePath = safeUploadPath(filename);
  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
