import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  MAX_BANK_PACK_BYTES,
  parseBankFile,
} from "@/lib/bank-pack";
import { createQuestionBank } from "@/lib/question-bank";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`bank-import:${user.id}:${clientIp(req)}`, {
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
    return NextResponse.json({ error: "Choose a bank file" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a bank file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Bank file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BANK_PACK_BYTES) {
    return NextResponse.json(
      { error: "Bank file must be 1 MB or smaller" },
      { status: 400 }
    );
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const pack = parseBankFile(buf, file.name);
    const bank = await createQuestionBank({
      ownerId: user.id,
      title: pack.title,
      questions: pack.questions,
    });
    return NextResponse.json({ bank }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not import bank";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
