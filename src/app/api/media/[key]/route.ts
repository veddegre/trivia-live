import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  isValidMediaKey,
  mimeForKey,
  resolveUploadPath,
} from "@/lib/media";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { key } = await ctx.params;
  const decoded = decodeURIComponent(key);
  if (!isValidMediaKey(decoded)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const full = resolveUploadPath(decoded);
  if (!full) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let data: Buffer;
  try {
    data = await fs.promises.readFile(full);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeForKey(decoded),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(data.length),
    },
  });
}
