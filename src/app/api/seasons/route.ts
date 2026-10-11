import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  MAX_SEASONS,
  seasonWriteSchema,
} from "@/lib/season";

function seasonsOwnedBy(user: { id: string; role: string }) {
  if (user.role === "SUPERADMIN") return {};
  return { ownerId: user.id };
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const seasons = await prisma.season.findMany({
    where: seasonsOwnedBy(user),
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ seasons });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = seasonWriteSchema.safeParse(await req.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "Check the season dates";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const count = await prisma.season.count({ where: { ownerId: user.id } });
  if (count >= MAX_SEASONS) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_SEASONS} seasons` },
      { status: 400 }
    );
  }

  const season = await prisma.season.create({
    data: {
      title: parsed.data.title,
      ownerId: user.id,
      startsOn: parsed.data.startsOn ?? null,
      endsOn: parsed.data.endsOn ?? null,
    },
  });
  return NextResponse.json({ season }, { status: 201 });
}
