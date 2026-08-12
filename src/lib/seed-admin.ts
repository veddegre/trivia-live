import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

let ensured = false;

/**
 * Ensures a SUPERADMIN exists (idempotent).
 * Defaults: SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD, falling back to
 * admin@localhost + ADMIN_PASSWORD (or trivia-admin).
 */
export async function ensureSuperAdmin() {
  if (ensured) return;
  const email = (
    process.env.SUPERADMIN_EMAIL ||
    "admin@localhost"
  ).trim().toLowerCase();
  const password =
    process.env.SUPERADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    "trivia-admin";
  const name = process.env.SUPERADMIN_NAME || "Super Admin";

  const existing = await prisma.user.findFirst({
    where: { role: "SUPERADMIN" },
  });
  if (existing) {
    ensured = true;
    // Claim orphan games / results for the first super-admin
    await prisma.game.updateMany({
      where: { ownerId: null },
      data: { ownerId: existing.id },
    });
    await prisma.gameResult.updateMany({
      where: { ownerId: null },
      data: { ownerId: existing.id },
    });
    return;
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { role: "SUPERADMIN" },
    });
    ensured = true;
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "SUPERADMIN",
    },
  });

  await prisma.game.updateMany({
    where: { ownerId: null },
    data: { ownerId: user.id },
  });
  await prisma.gameResult.updateMany({
    where: { ownerId: null },
    data: { ownerId: user.id },
  });

  ensured = true;
}
