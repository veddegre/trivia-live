import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createGameFromPack } from "@/lib/create-draft-game";
import { MAX_PACK_BYTES, parseImportBytes } from "@/lib/game-pack";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`import:${user.id}:${clientIp(req)}`, {
    limit: 8,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many imports — wait a moment" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Choose a pack file" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a pack file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Pack file is empty" }, { status: 400 });
  }
  if (file.size > MAX_PACK_BYTES) {
    return NextResponse.json(
      { error: "Pack must be 80 MB or smaller" },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const { pack, media } = await parseImportBytes(buf, file.name);
    const game = await createGameFromPack({
      pack,
      media,
      ownerId: user.id,
    });
    return NextResponse.json({ game }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not import pack";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
