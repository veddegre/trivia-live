import { NextRequest, NextResponse } from "next/server";
import { canManageGame, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildExportBytes,
  contentDisposition,
  type SourceGame,
} from "@/lib/game-pack";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const game = await prisma.game.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!game || !canManageGame(user, game)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const source: SourceGame = {
    title: game.title,
    gameType: game.gameType,
    allowLateJoin: game.allowLateJoin,
    questions: game.questions,
  };

  try {
    const { bytes, filename, contentType } = await buildExportBytes(source);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not export game";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
