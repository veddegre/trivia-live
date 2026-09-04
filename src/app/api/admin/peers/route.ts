import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Other host / super-admin accounts — used to send a game copy. */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const peers = await prisma.user.findMany({
    where: { id: { not: user.id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ peers });
}
