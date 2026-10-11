import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildSeasonStandings,
  nightCountsInSeason,
  seasonWriteSchema,
  standingsFromStored,
} from "@/lib/season";

type Ctx = { params: Promise<{ id: string }> };

async function loadSeason(id: string, user: { id: string; role: string }) {
  const season = await prisma.season.findUnique({ where: { id } });
  if (!season) return null;
  if (user.role !== "SUPERADMIN" && season.ownerId !== user.id) return null;
  return season;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const season = await loadSeason(id, user);
  if (!season) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const results = await prisma.gameResult.findMany({
    where: { ownerId: season.ownerId },
    orderBy: { finishedAt: "asc" },
    select: {
      id: true,
      gameTitle: true,
      finishedAt: true,
      recap: true,
      podium: true,
    },
  });
  const nights = results.filter((result) =>
    nightCountsInSeason(result.finishedAt, season.startsOn, season.endsOn)
  );
  const standings = buildSeasonStandings(
    nights.map((night) => ({
      finishedAt: night.finishedAt.toISOString(),
      standings: standingsFromStored(night.recap, night.podium),
    }))
  );

  return NextResponse.json({
    season,
    nightCount: nights.length,
    standings,
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await loadSeason(id, user);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = seasonWriteSchema.safeParse(await req.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "Check the season dates";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const season = await prisma.season.update({
    where: { id },
    data: {
      title: parsed.data.title,
      startsOn: parsed.data.startsOn ?? null,
      endsOn: parsed.data.endsOn ?? null,
    },
  });
  return NextResponse.json({ season });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await loadSeason(id, user);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.season.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
