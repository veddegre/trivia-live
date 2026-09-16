import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertCorrectIndexes } from "@/lib/question-schema";
import {
  MAX_BANKS,
  bankQuestionCreateData,
  bankWriteSchema,
  banksOwnedBy,
} from "@/lib/question-bank";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const banks = await prisma.questionBank.findMany({
    where: banksOwnedBy(user),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      questions: { orderBy: { order: "asc" } },
      _count: { select: { questions: true } },
    },
  });
  return NextResponse.json({ banks });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bankWriteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const indexErr = assertCorrectIndexes(parsed.data.questions);
  if (indexErr) {
    return NextResponse.json({ error: indexErr }, { status: 400 });
  }

  const count = await prisma.questionBank.count({ where: { ownerId: user.id } });
  if (count >= MAX_BANKS) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_BANKS} banks` },
      { status: 400 }
    );
  }

  const bank = await prisma.questionBank.create({
    data: {
      title: parsed.data.title.trim(),
      ownerId: user.id,
      questions: {
        create: parsed.data.questions.map((q, order) =>
          bankQuestionCreateData(q, order)
        ),
      },
    },
    include: {
      questions: { orderBy: { order: "asc" } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ bank }, { status: 201 });
}
