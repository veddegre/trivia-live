import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/password";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  email: z.string().email().max(200).optional(),
  name: z.string().min(1).max(80).optional(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const host = await prisma.user.findUnique({ where: { id } });
  if (!host || host.role !== "HOST") {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: {
    email?: string;
    name?: string;
    passwordHash?: string;
  } = {};

  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.trim().toLowerCase();
    const clash = await prisma.user.findFirst({
      where: { email, NOT: { id } },
    });
    if (clash) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    data.email = email;
  }
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.password) {
    data.passwordHash = await hashPassword(parsed.data.password);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { games: true } },
    },
  });

  return NextResponse.json({ host: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const host = await prisma.user.findUnique({ where: { id } });
  if (!host || host.role !== "HOST") {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  // Reassign their games/results to the super-admin doing the delete
  await prisma.$transaction([
    prisma.game.updateMany({
      where: { ownerId: id },
      data: { ownerId: admin.id },
    }),
    prisma.gameResult.updateMany({
      where: { ownerId: id },
      data: { ownerId: admin.id },
    }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
