import { NextRequest, NextResponse } from "next/server";
import { resolveBrand } from "@/lib/branding";
import { prisma } from "@/lib/db";
import { getSiteBrand } from "@/lib/site-brand";

type Ctx = { params: Promise<{ code: string }> };

/** Public lookup for join pages — no answers/correct keys. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const game = await prisma.game.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const playerCount = await prisma.player.count({ where: { gameId: game.id } });
  const questionCount = await prisma.question.count({ where: { gameId: game.id } });

  const site = await getSiteBrand();
  const brand = resolveBrand(site, game);

  const urlHost = _req.nextUrl.searchParams.get("hostToken");
  const includeHost = urlHost && urlHost === game.hostToken;

  return NextResponse.json({
    game: {
      title: game.title,
      code: game.code,
      status: game.status,
      allowLateJoin: game.allowLateJoin,
      questionCount,
      playerCount,
      ...(includeHost ? { hostToken: game.hostToken } : {}),
    },
    brand,
  });
}
