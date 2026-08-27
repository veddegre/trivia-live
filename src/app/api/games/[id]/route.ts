import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManageGame, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteMediaFiles } from "@/lib/media";
import {
  assertQuestionsForGameType,
  gameTypeSchema,
  questionCreateData,
  questionSchema,
} from "@/lib/question-schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      players: { orderBy: { totalScore: "desc" } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!game || !canManageGame(user, game)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ game });
}

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  gameType: gameTypeSchema.optional(),
  status: z.enum(["DRAFT", "LOBBY"]).optional(),
  allowLateJoin: z.boolean().optional(),
  questions: z.array(questionSchema).min(1).max(100).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.game.findUnique({ where: { id } });
  if (!existing || !canManageGame(user, existing)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { title, status, allowLateJoin, questions, gameType } = parsed.data;
  const nextType = gameType ?? existing.gameType;

  if (gameType && gameType !== existing.gameType && !questions) {
    return NextResponse.json(
      { error: "Include questions when changing game type" },
      { status: 400 }
    );
  }

  if (questions) {
    const indexErr = assertQuestionsForGameType(nextType, questions);
    if (indexErr) {
      return NextResponse.json({ error: indexErr }, { status: 400 });
    }
    if (
      existing.status === "QUESTION" ||
      existing.status === "REVEAL" ||
      existing.status === "BETWEEN"
    ) {
      return NextResponse.json(
        { error: "Can’t edit questions while a round is in progress" },
        { status: 400 }
      );
    }
    const answerCount = await prisma.answer.count({
      where: { question: { gameId: id } },
    });
    if (answerCount > 0) {
      return NextResponse.json(
        {
          error:
            "Can’t edit questions after answers exist. Use Play again first to clear the round.",
        },
        { status: 400 }
      );
    }

    const previous = await prisma.question.findMany({
      where: { gameId: id },
      select: { imageKey: true, audioKey: true },
    });
    const previousKeys = previous.flatMap((q) =>
      [q.imageKey, q.audioKey].filter((k): k is string => !!k)
    );
    const nextKeys = new Set(
      questions.flatMap((q) => {
        const keys: string[] = [];
        if (nextType === "IMAGE_ZOOM" && q.imageKey) keys.push(q.imageKey);
        if (nextType === "AUDIO_SPEED" && q.audioKey) keys.push(q.audioKey);
        return keys;
      })
    );
    const orphaned = previousKeys.filter((k) => !nextKeys.has(k));

    await prisma.$transaction([
      prisma.question.deleteMany({ where: { gameId: id } }),
      prisma.question.createMany({
        data: questions.map((q, order) => ({
          gameId: id,
          ...questionCreateData(q, order, nextType),
        })),
      }),
    ]);
    await deleteMediaFiles(orphaned);
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (status !== undefined) data.status = status;
  if (allowLateJoin !== undefined) data.allowLateJoin = allowLateJoin;
  if (gameType !== undefined) data.gameType = gameType;

  const game = await prisma.game.update({
    where: { id },
    data,
    include: { questions: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ game });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.game.findUnique({ where: { id } });
  if (!existing || !canManageGame(user, existing)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const media = await prisma.question.findMany({
    where: { gameId: id },
    select: { imageKey: true, audioKey: true },
  });
  await prisma.game.delete({ where: { id } });
  await deleteMediaFiles(
    media.flatMap((q) =>
      [q.imageKey, q.audioKey].filter((k): k is string => !!k)
    )
  );
  return NextResponse.json({ ok: true });
}
