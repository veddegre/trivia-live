import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ code: string }> };

/** Public lookup for join pages — no answers/correct keys. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const game = await prisma.game.findUnique({
    where: { code: code.toUpperCase() },
    select: {
      title: true,
      code: true,
      status: true,
      hostToken: true,
      _count: { select: { questions: true, players: true } },
    },
  });
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // hostToken only returned when ?host=1 and matches query token (validated client-side via URL)
  const urlHost = _req.nextUrl.searchParams.get("hostToken");
  const includeHost = urlHost && urlHost === game.hostToken;

  return NextResponse.json({
    game: {
      title: game.title,
      code: game.code,
      status: game.status,
      questionCount: game._count.questions,
      playerCount: game._count.players,
      ...(includeHost ? { hostToken: game.hostToken } : {}),
    },
  });
}
