import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  getSessionUser,
  makeSessionToken,
  parseSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureSuperAdmin } from "@/lib/seed-admin";

export async function POST(req: NextRequest) {
  await ensureSuperAdmin();

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = makeSessionToken(user.id);
  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  // Clear legacy single-password cookie
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  await ensureSuperAdmin();
  const user = await getSessionUser();
  if (user) {
    return NextResponse.json({ authenticated: true, user });
  }
  // Also accept a raw cookie parse if getSessionUser missed (edge case)
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (parseSessionToken(token)) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: false });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
