import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  makeSessionToken,
  safeEqualString,
  sessionCookieOptions,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  createFirstSuperAdmin,
  needsSetup,
  setupTokenRequired,
} from "@/lib/seed-admin";

const setupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
  setupToken: z.string().max(200).optional(),
});

export async function GET() {
  try {
    const needed = await needsSetup();
    return NextResponse.json({
      needsSetup: needed,
      setupTokenRequired: needed && setupTokenRequired(),
    });
  } catch (e) {
    console.error("setup check failed", e);
    return NextResponse.json(
      {
        needsSetup: true,
        setupTokenRequired: setupTokenRequired(),
        error:
          "Database not ready. Run migrations / db push, then restart the app.",
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`setup:${ip}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many setup attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  try {
    if (!(await needsSetup())) {
      return NextResponse.json(
        { error: "Setup already completed — sign in instead" },
        { status: 409 }
      );
    }

    const parsed = setupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (setupTokenRequired()) {
      const expected = process.env.SETUP_TOKEN?.trim() || "";
      if (!expected) {
        return NextResponse.json(
          {
            error:
              "SETUP_TOKEN is not configured on the server. Set it in the environment, then retry.",
          },
          { status: 503 }
        );
      }
      const provided = parsed.data.setupToken?.trim() || "";
      if (!provided || !safeEqualString(provided, expected)) {
        return NextResponse.json(
          { error: "Invalid setup token" },
          { status: 401 }
        );
      }
    }

    const user = await createFirstSuperAdmin(parsed.data);
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "Setup failed";
    console.error("setup failed", e);
    const status =
      message.includes("already") || message.includes("in use") ? 409 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
