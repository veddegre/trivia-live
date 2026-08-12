import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
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

function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "trivia-dev-secret"
  );
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
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const [userId] = payload.split(":");
  return userId || null;
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

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const userId = parseSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return toSessionUser(user);
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
