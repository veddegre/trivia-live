import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertCorrectIndexes, questionSchema } from "@/lib/question-schema";

type Ctx = { params: Promise<{ id: string }> };

/** Clear any leftover per-game brand columns (custom branding removed). */
const CLEAR_GAME_BRAND = {
  brandDisplayName: null,
  brandTagline: null,
  brandLogoUrl: null,
  brandPreset: null,
  brandMode: null,
  brandAccent: null,
  brandBackground: null,
} as const;

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      players: { orderBy: { totalScore: "desc" } },
    },
  });
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ game });
}

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["DRAFT", "LOBBY"]).optional(),
  allowLateJoin: z.boolean().optional(),
  questions: z.array(questionSchema).min(1).max(100).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.game.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { title, status, allowLateJoin, questions } = parsed.data;

  if (questions) {
    const indexErr = assertCorrectIndexes(questions);
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

    await prisma.$transaction([
      prisma.question.deleteMany({ where: { gameId: id } }),
      prisma.question.createMany({
        data: questions.map((q, order) => ({
          gameId: id,
          order,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          timeLimitSec: q.timeLimitSec,
          basePoints: q.basePoints,
          timeBonus: q.timeBonus,
        })),
      }),
    ]);
  }

  const data: Record<string, unknown> = { ...CLEAR_GAME_BRAND };
  if (title !== undefined) data.title = title;
  if (status !== undefined) data.status = status;
  if (allowLateJoin !== undefined) data.allowLateJoin = allowLateJoin;

  const game = await prisma.game.update({
    where: { id },
    data,
    include: { questions: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ game });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  await prisma.game.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
