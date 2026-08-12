import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "trivia_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

const WEAK_SECRETS = new Set([
  "",
  "trivia-dev-secret",
  "trivia-admin",
  "change-me",
  "change-me-too",
  "change-me-to-a-long-random-string",
  "secret",
  "password",
  "trivia-session-secret",
]);

/** Process-lifetime fallback when SESSION_SECRET is missing in production. */
let ephemeralSessionSecret: string | null = null;

function isStrongSecret(secret: string): boolean {
  return secret.length >= 24 && !WEAK_SECRETS.has(secret);
}

export { assertProductionSecrets } from "@/lib/production-secrets";

function sessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim() || "";
  if (isStrongSecret(fromEnv)) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    if (!ephemeralSessionSecret) {
      ephemeralSessionSecret = randomBytes(32).toString("hex");
    }
    return ephemeralSessionSecret;
  }

  return fromEnv || process.env.ADMIN_PASSWORD || "trivia-dev-secret";
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

export function makeSessionToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const [userId] = payload.split(":");
  return userId || null;
}

export function sessionCookieOptions() {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.COOKIE_SECURE === "1" ||
    process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/** Constant-time compare for setup tokens / secrets. */
export function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // still do a compare to reduce timing oracle on length alone for short tokens
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function generateSetupTokenHint(): string {
  return randomBytes(16).toString("hex");
}

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    // Lazy import — top-level `next/headers` breaks the custom Node server
    // (AsyncLocalStorage invariant before/outside a Next request).
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const userId = parseSessionToken(jar.get(SESSION_COOKIE)?.value);
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return toSessionUser(user);
  } catch (e) {
    console.error("getSessionUser failed", e);
    return null;
  }
}

/** Any signed-in host or super-admin. */
export async function requireUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function requireSuperAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "SUPERADMIN") return null;
  return user;
}

export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === "SUPERADMIN";
}

/** Prisma where clause: hosts only see their games; super-admin sees all. */
export function gamesOwnedBy(user: SessionUser) {
  if (user.role === "SUPERADMIN") return {};
  return { ownerId: user.id };
}

export function resultsOwnedBy(user: SessionUser) {
  if (user.role === "SUPERADMIN") return {};
  return { ownerId: user.id };
}

export function canManageGame(
  user: SessionUser,
  game: { ownerId: string | null }
): boolean {
  if (user.role === "SUPERADMIN") return true;
  return game.ownerId === user.id;
}

/** @deprecated Use requireUser — kept so older imports still compile during edit. */
export async function requireAdmin(): Promise<boolean> {
  return !!(await requireUser());
}

/** Legacy cookie name — clear on logout for older sessions. */
export const ADMIN_COOKIE = "trivia_admin";
