import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { bankToPack } from "@/lib/bank-pack";
import { contentDisposition, packFilename } from "@/lib/game-pack";
import { prisma } from "@/lib/db";
import { canManageBank } from "@/lib/question-bank";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const bank = await prisma.questionBank.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!bank || !canManageBank(user, bank)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pack = bankToPack(bank);
  const filename = packFilename(bank.title, "json");
  return new NextResponse(JSON.stringify(pack, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": contentDisposition(filename),
      "Cache-Control": "no-store",
    },
  });
}
