import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().max(200).optional(),
  password: z.string().min(6).max(200).optional(),
  currentPassword: z.string().min(1).max(200).optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.id } });
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (parsed.data.password) {
    if (!parsed.data.currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to set a new password" },
        { status: 400 }
      );
    }
    const ok = await verifyPassword(
      parsed.data.currentPassword,
      me.passwordHash
    );
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }
  }

  const data: { name?: string; email?: string; passwordHash?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.trim().toLowerCase();
    const clash = await prisma.user.findFirst({
      where: { email, NOT: { id: me.id } },
    });
    if (clash) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    data.email = email;
  }
  if (parsed.data.password) {
    data.passwordHash = await hashPassword(parsed.data.password);
  }

  const user = await prisma.user.update({
    where: { id: me.id },
    data,
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ user });
}
