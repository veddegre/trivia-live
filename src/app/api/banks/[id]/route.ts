import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertCorrectIndexes } from "@/lib/question-schema";
import {
  bankQuestionCreateData,
  bankWriteSchema,
  canManageBank,
} from "@/lib/question-bank";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const bank = await prisma.questionBank.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!bank || !canManageBank(user, bank)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ bank });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const parsed = bankWriteSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.questionBank.findUnique({ where: { id } });
  if (!existing || !canManageBank(user, existing)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.questions) {
    const indexErr = assertCorrectIndexes(parsed.data.questions);
    if (indexErr) {
      return NextResponse.json({ error: indexErr }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.bankQuestion.deleteMany({ where: { bankId: id } }),
      prisma.bankQuestion.createMany({
        data: parsed.data.questions.map((q, order) => ({
          bankId: id,
          ...bankQuestionCreateData(q, order),
        })),
      }),
    ]);
  }

  const data: { title?: string } = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title.trim();

  const bank = await prisma.questionBank.update({
    where: { id },
    data,
    include: {
      questions: { orderBy: { order: "asc" } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({ bank });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.questionBank.findUnique({ where: { id } });
  if (!existing || !canManageBank(user, existing)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.questionBank.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
