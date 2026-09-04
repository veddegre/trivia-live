import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManageGame, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cloneGame } from "@/lib/create-draft-game";
import type { SourceGame } from "@/lib/game-pack";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  toOwnerId: z.string().min(1).max(80).optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await ctx.params;
  const game = await prisma.game.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!game || !canManageGame(user, game)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const toOwnerId = parsed.data.toOwnerId ?? user.id;
  if (toOwnerId !== user.id) {
    const target = await prisma.user.findUnique({
      where: { id: toOwnerId },
      select: { id: true, name: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Host not found" }, { status: 404 });
    }
  }

  const source: SourceGame = {
    title: game.title,
    gameType: game.gameType,
    allowLateJoin: game.allowLateJoin,
    questions: game.questions,
  };

  try {
    const copy = await cloneGame({ source, ownerId: toOwnerId });
    return NextResponse.json({ game: copy }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not copy game";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
