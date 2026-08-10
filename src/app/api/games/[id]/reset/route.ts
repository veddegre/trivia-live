import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildPublicState, resetGame } from "@/lib/game-manager";
import { getSocketServer } from "@/lib/realtime";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    const game = await resetGame(id);
    if (!game) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const io = getSocketServer();
    if (io) {
      const room = `game:${game.code}`;
      const state = await buildPublicState(game.code);
      io.to(room).emit("game:reset", { code: game.code });
      if (state) io.to(room).emit("game:state", state);
    }

    return NextResponse.json({ game });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reset failed";
    const status = message === "Game not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
