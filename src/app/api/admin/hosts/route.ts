import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  hashPassword,
  requireSuperAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(1).max(80),
  password: z.string().min(6).max(200),
});

export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hosts = await prisma.user.findMany({
    where: { role: "HOST" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { games: true } },
    },
  });

  return NextResponse.json({ hosts });
}

export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const host = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      passwordHash,
      role: "HOST",
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { games: true } },
    },
  });

  return NextResponse.json({ host }, { status: 201 });
}
