import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

const SETUP_LOCK_KEY = 88112233;

export async function countSuperAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "SUPERADMIN" } });
}

export async function needsSetup(): Promise<boolean> {
  try {
    return (await countSuperAdmins()) === 0;
  } catch {
    // User table missing / DB down — treat as setup needed after migrate
    return true;
  }
}

/** Whether POST /api/admin/setup requires the SETUP_TOKEN env value. */
export function setupTokenRequired(): boolean {
  if (process.env.SETUP_TOKEN?.trim()) return true;
  // Production always requires an explicit setup token
  return process.env.NODE_ENV === "production";
}

export async function claimOrphans(ownerId: string) {
  await prisma.game.updateMany({
    where: { ownerId: null },
    data: { ownerId },
  });
  await prisma.gameResult.updateMany({
    where: { ownerId: null },
    data: { ownerId },
  });
}

export async function createFirstSuperAdmin(opts: {
  email: string;
  name: string;
  password: string;
}) {
  const email = opts.email.trim().toLowerCase();
  const name = opts.name.trim();
  if (!email || !name || opts.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Name, email, and a password (${MIN_PASSWORD_LENGTH}+ chars) are required`
    );
  }

  // Serialize first-admin creation (Postgres advisory lock)
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})`;

    const existing = await tx.user.count({ where: { role: "SUPERADMIN" } });
    if (existing > 0) {
      throw new Error("Setup already completed");
    }

    const clash = await tx.user.findUnique({ where: { email } });
    if (clash) {
      throw new Error("Email already in use");
    }

    const passwordHash = await hashPassword(opts.password);
    const user = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "SUPERADMIN",
      },
    });

    await tx.game.updateMany({
      where: { ownerId: null },
      data: { ownerId: user.id },
    });
    await tx.gameResult.updateMany({
      where: { ownerId: null },
      data: { ownerId: user.id },
    });

    return user;
  });
}

/**
 * Optional headless bootstrap when SUPERADMIN_BOOTSTRAP=1 (or true).
 * Otherwise first visit to /admin creates the account via the setup form.
 */
export async function maybeBootstrapSuperAdmin() {
  if (
    !["1", "true", "yes"].includes(
      (process.env.SUPERADMIN_BOOTSTRAP || "").toLowerCase()
    )
  ) {
    return;
  }
  if ((await countSuperAdmins()) > 0) return;

  const email = (process.env.SUPERADMIN_EMAIL || "admin@localhost")
    .trim()
    .toLowerCase();
  const password =
    process.env.SUPERADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    "trivia-admin";
  const name = process.env.SUPERADMIN_NAME || "Super Admin";

  await createFirstSuperAdmin({ email, name, password });
}

/** @deprecated Use maybeBootstrapSuperAdmin / createFirstSuperAdmin */
export async function ensureSuperAdmin() {
  await maybeBootstrapSuperAdmin();
}
