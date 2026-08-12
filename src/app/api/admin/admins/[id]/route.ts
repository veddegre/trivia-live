import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { countSuperAdmins } from "@/lib/seed-admin";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  email: z.string().email().max(200).optional(),
  name: z.string().min(1).max(80).optional(),
  password: z.string().min(6).max(200).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
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
    },
  });

  return NextResponse.json({ admin: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  const total = await countSuperAdmins();
  if (total <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last super-admin" },
      { status: 400 }
    );
  }

  // Reassign their games to the acting admin
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

  return NextResponse.json({ ok: true, deletedSelf: id === admin.id });
}
