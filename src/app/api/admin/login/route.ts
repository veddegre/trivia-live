import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeAdminToken, verifyAdminToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.ADMIN_PASSWORD || "trivia-admin";
  if (!body.password || body.password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const token = makeAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return NextResponse.json({ authenticated: verifyAdminToken(token) });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
