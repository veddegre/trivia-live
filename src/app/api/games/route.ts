import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { brandOverrideSchema, validateBrandColors } from "@/lib/brand-schema";
import { brandOverridesFromInput } from "@/lib/branding";
import { generateJoinCode } from "@/lib/codes";
import { prisma } from "@/lib/db";

const questionSchema = z.object({
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  timeLimitSec: z.number().int().min(5).max(300).default(30),
  basePoints: z.number().int().min(0).max(10000).default(500),
  timeBonus: z.number().int().min(0).max(10000).default(500),
});

const createSchema = z
  .object({
    title: z.string().min(1).max(120),
    questions: z.array(questionSchema).min(1).max(100),
  })
  .merge(brandOverrideSchema);

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const games = await prisma.game.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true, players: true } },
    },
  });
  return NextResponse.json({ games });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const colorErr = validateBrandColors(parsed.data);
  if (colorErr) {
    return NextResponse.json({ error: colorErr }, { status: 400 });
  }

  for (const q of parsed.data.questions) {
    if (q.correctIndex >= q.options.length) {
      return NextResponse.json(
        { error: "correctIndex out of range for a question" },
        { status: 400 }
      );
    }
  }

  let code = generateJoinCode();
  for (let i = 0; i < 8; i++) {
    const clash = await prisma.game.findUnique({ where: { code } });
    if (!clash) break;
    code = generateJoinCode();
  }

  const branding = brandOverridesFromInput({
    customize: parsed.data.customize,
    brandDisplayName: parsed.data.brandDisplayName,
    brandTagline: parsed.data.brandTagline,
    brandLogoUrl: parsed.data.brandLogoUrl,
    brandPreset: parsed.data.customize ? parsed.data.brandPreset ?? null : null,
    brandMode: parsed.data.customize ? parsed.data.brandMode ?? null : null,
    brandAccent: parsed.data.brandAccent,
    brandBackground: parsed.data.brandBackground,
  });

  const game = await prisma.game.create({
    data: {
      title: parsed.data.title,
      code,
      status: "DRAFT",
      ...branding,
      questions: {
        create: parsed.data.questions.map((q, order) => ({
          order,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          timeLimitSec: q.timeLimitSec,
          basePoints: q.basePoints,
          timeBonus: q.timeBonus,
        })),
      },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ game }, { status: 201 });
}
