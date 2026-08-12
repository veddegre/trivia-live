import { NextResponse } from "next/server";
import { canManageGame, requireUser } from "@/lib/auth";
import { buildPublicState, resetGame } from "@/lib/game-manager";
import { emitGameReset, getSocketServer } from "@/lib/realtime";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.game.findUnique({ where: { id } });
  if (!existing || !canManageGame(user, existing)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { game, previousCode } = await resetGame(id);
    if (!game) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const io = getSocketServer();
    if (io) {
      await emitGameReset(io, previousCode, {
        code: game.code,
        hostToken: game.hostToken,
      });
      const state = await buildPublicState(game.code);
      if (state) io.to(`game:${game.code}`).emit("game:state", state);
    }

    // hostToken only returned to authenticated admin HTTP client
    return NextResponse.json({ game, previousCode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reset failed";
    const status = message === "Game not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
