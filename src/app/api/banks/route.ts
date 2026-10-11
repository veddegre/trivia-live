import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  bankWriteSchema,
  banksOwnedBy,
  createQuestionBank,
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

  const indexErr = parsed.data.questions.some(
    (q) => q.correctIndex >= q.options.length
  );
  if (indexErr) {
    return NextResponse.json(
      { error: "A question's correct answer is out of range" },
      { status: 400 }
    );
  }

  try {
    const bank = await createQuestionBank({
      ownerId: user.id,
      title: parsed.data.title,
      questions: parsed.data.questions,
    });
    return NextResponse.json({ bank }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save bank";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
