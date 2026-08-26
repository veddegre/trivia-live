import { NextRequest, NextResponse } from "next/server";
import { resolveBrand } from "@/lib/branding";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ code: string }> };

export const dynamic = "force-dynamic";

/** Public lookup for join pages — no answers/correct keys. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const ip = clientIp(_req);
  const limited = rateLimit(`by-code:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  const { code } = await ctx.params;
  const game = await prisma.game.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const playerCount = await prisma.player.count({ where: { gameId: game.id } });
  const questionCount = await prisma.question.count({ where: { gameId: game.id } });

  const brand = resolveBrand();

  const urlHost = _req.nextUrl.searchParams.get("hostToken");
  const includeHost = urlHost && urlHost === game.hostToken;

  return NextResponse.json(
    {
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
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
