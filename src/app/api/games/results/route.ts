import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await prisma.gameResult.findMany({
    orderBy: { finishedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ results });
}
