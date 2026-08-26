import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gamesOwnedBy, requireUser } from "@/lib/auth";
import { generateJoinCode } from "@/lib/codes";
import { prisma } from "@/lib/db";
import {
  assertQuestionsForGameType,
  gameTypeSchema,
  questionCreateData,
  questionSchema,
} from "@/lib/question-schema";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  gameType: gameTypeSchema.optional().default("TRIVIA"),
  allowLateJoin: z.boolean().optional().default(true),
  questions: z.array(questionSchema).min(1).max(100),
});

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const games = await prisma.game.findMany({
    where: gamesOwnedBy(user),
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { questions: true, players: true } },
    },
  });
  return NextResponse.json({ games });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const indexErr = assertQuestionsForGameType(
    parsed.data.gameType,
    parsed.data.questions
  );
  if (indexErr) {
    return NextResponse.json({ error: indexErr }, { status: 400 });
  }

  let code = generateJoinCode();
  for (let i = 0; i < 8; i++) {
    const clash = await prisma.game.findUnique({ where: { code } });
    if (!clash) break;
    code = generateJoinCode();
  }

  const game = await prisma.game.create({
    data: {
      title: parsed.data.title,
      code,
      status: "DRAFT",
      gameType: parsed.data.gameType,
      allowLateJoin: parsed.data.allowLateJoin,
      ownerId: user.id,
      questions: {
        create: parsed.data.questions.map((q, order) =>
          questionCreateData(q, order, parsed.data.gameType)
        ),
      },
    },
    include: {
      questions: { orderBy: { order: "asc" } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ game }, { status: 201 });
}
