import { NextResponse } from "next/server";
import { isSuperAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isNightRecap } from "@/lib/night-recap";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const result = await prisma.gameResult.findUnique({
    where: { id },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isSuperAdmin(user) && result.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const recap = isNightRecap(result.recap) ? result.recap : null;
  return NextResponse.json({
    result: {
      id: result.id,
      gameTitle: result.gameTitle,
      joinCode: result.joinCode,
      winnerName: result.winnerName,
      winnerScore: result.winnerScore,
      playerCount: result.playerCount,
      podium: result.podium,
      finishedAt: result.finishedAt,
      owner: result.owner,
      recap,
    },
  });
}
