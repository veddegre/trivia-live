import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { parseByteRange } from "@/lib/byte-range";
import {
  isValidMediaKey,
  mimeForKey,
  resolveUploadPath,
} from "@/lib/media";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { key } = await ctx.params;
  const decoded = decodeURIComponent(key);
  if (!isValidMediaKey(decoded)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const full = resolveUploadPath(decoded);
  if (!full) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let size: number;
  try {
    size = (await fs.promises.stat(full)).size;
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseHeaders = {
    "Content-Type": mimeForKey(decoded),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };

  const range = parseByteRange(req.headers.get("range"), size);
  if (range === null) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  const start = range === "all" ? 0 : range.start;
  const end = range === "all" ? size - 1 : range.end;
  const length = size === 0 ? 0 : end - start + 1;

  let data: Buffer;
  try {
    const file = await fs.promises.open(full, "r");
    try {
      data = Buffer.alloc(length);
      if (length > 0) await file.read(data, 0, length, start);
    } finally {
      await file.close();
    }
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const partial = range !== "all";
  return new NextResponse(new Uint8Array(data), {
    status: partial ? 206 : 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(length),
      ...(partial ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
