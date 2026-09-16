import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ensureStarterBank } from "@/lib/question-bank";

export async function POST() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { bank, created } = await ensureStarterBank(user.id);
  return NextResponse.json({ bank, created }, { status: created ? 201 : 200 });
}
