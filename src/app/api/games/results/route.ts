import { NextResponse } from "next/server";
import { requireUser, resultsOwnedBy } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await prisma.gameResult.findMany({
    where: resultsOwnedBy(user),
    orderBy: { finishedAt: "desc" },
    take: 100,
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ results });
}
