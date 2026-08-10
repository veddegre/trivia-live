import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { brandOverrideSchema, validateBrandColors } from "@/lib/brand-schema";
import { brandOverridesFromInput } from "@/lib/branding";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

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

const patchSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    status: z.enum(["DRAFT", "LOBBY"]).optional(),
  })
  .merge(brandOverrideSchema);

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const colorErr = validateBrandColors(parsed.data);
  if (colorErr) {
    return NextResponse.json({ error: colorErr }, { status: 400 });
  }

  const { title, status, customize, ...brandFields } = parsed.data;
  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (status !== undefined) data.status = status;

  if (customize !== undefined || Object.keys(brandFields).length > 0) {
    Object.assign(
      data,
      brandOverridesFromInput({
        customize,
        ...brandFields,
        brandPreset: customize === false ? null : brandFields.brandPreset ?? null,
        brandMode: customize === false ? null : brandFields.brandMode ?? null,
      })
    );
  }

  const game = await prisma.game.update({
    where: { id },
    data,
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
