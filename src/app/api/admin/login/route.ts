import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  getSessionUser,
  makeSessionToken,
  parseSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { needsSetup, setupTokenRequired } from "@/lib/seed-admin";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`login:${ip}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  if (await needsSetup()) {
    return NextResponse.json(
      {
        error: "Complete first-time setup before signing in",
        needsSetup: true,
      },
      { status: 409 }
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

  // Also throttle by email to slow targeted guessing
  const emailLimited = rateLimit(`login-email:${email}`, {
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!emailLimited.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(emailLimited.retryAfterSec) },
      }
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
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const setup = await needsSetup();
    const user = await getSessionUser();
    if (user) {
      return NextResponse.json({
        authenticated: true,
        user,
        needsSetup: false,
        setupTokenRequired: false,
      });
    }
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (parseSessionToken(token)) {
      return NextResponse.json({
        authenticated: false,
        needsSetup: setup,
        setupTokenRequired: setup && setupTokenRequired(),
      });
    }
    return NextResponse.json({
      authenticated: false,
      needsSetup: setup,
      setupTokenRequired: setup && setupTokenRequired(),
    });
  } catch (e) {
    console.error("admin session check failed", e);
    return NextResponse.json(
      {
        authenticated: false,
        needsSetup: true,
        setupTokenRequired: setupTokenRequired(),
        error: "Session check failed",
      },
      { status: 200 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
