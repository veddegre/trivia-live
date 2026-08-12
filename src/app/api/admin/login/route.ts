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
  try {
    await ensureSuperAdmin();
  } catch (e) {
    console.error("ensureSuperAdmin failed", e);
    return NextResponse.json(
      {
        error:
          "Database not ready for accounts. Run migrations / db push, then restart the app.",
      },
      { status: 503 }
    );
  }

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

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email } });
  } catch (e) {
    console.error("user lookup failed", e);
    return NextResponse.json(
      {
        error:
          "Database not ready for accounts. Run migrations / db push, then restart the app.",
      },
      { status: 503 }
    );
  }

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
  try {
    // Don't block the login screen on seeding — seed happens on POST / startup.
    const user = await getSessionUser();
    if (user) {
      return NextResponse.json({ authenticated: true, user });
    }
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (parseSessionToken(token)) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({ authenticated: false });
  } catch (e) {
    console.error("admin session check failed", e);
    return NextResponse.json(
      { authenticated: false, error: "Session check failed" },
      { status: 200 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
