import { NextResponse } from "next/server";
import { isSuperAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contentDisposition } from "@/lib/game-pack";
import {
  isNightRecap,
  recapFilename,
  recapToCsv,
} from "@/lib/night-recap";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const result = await prisma.gameResult.findUnique({ where: { id } });
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isSuperAdmin(user) && result.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isNightRecap(result.recap)) {
    return NextResponse.json(
      { error: "No recap for this night" },
      { status: 404 }
    );
  }

  const csv = recapToCsv(result.recap);
  const filename = recapFilename(result.gameTitle, result.joinCode);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition(filename),
      "Cache-Control": "no-store",
    },
  });
}
