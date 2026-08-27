import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  isAllowedAudioMime,
  isAllowedImageMime,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  saveAudioUpload,
  saveImageUpload,
} from "@/lib/media";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`upload:${user.id}:${clientIp(req)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many uploads — wait a moment" },
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
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase();
  const kind = form.get("kind");

  if (kind === "audio" || isAllowedAudioMime(mime)) {
    if (!isAllowedAudioMime(mime)) {
      return NextResponse.json(
        { error: "Use an MP3, M4A, WAV, OGG, or AAC file" },
        { status: 400 }
      );
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Audio must be 10 MB or smaller" },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const { key } = await saveAudioUpload({ buffer, mime });
      return NextResponse.json({
        key,
        url: `/api/media/${encodeURIComponent(key)}`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (!isAllowedImageMime(mime)) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, WebP, GIF, or audio file" },
      { status: 400 }
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image must be 5 MB or smaller" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const { key } = await saveImageUpload({ buffer, mime });
    return NextResponse.json({
      key,
      url: `/api/media/${encodeURIComponent(key)}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
