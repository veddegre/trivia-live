import { z } from "zod";

export const SEASON_TITLE_MAX = 80;
export const MAX_SEASONS = 20;

const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => parseSeasonDay(value) != null, "Use a real date");

export const seasonWriteSchema = z
  .object({
    title: z.string().trim().min(1).max(SEASON_TITLE_MAX),
    startsOn: daySchema.nullable().optional(),
    endsOn: daySchema.nullable().optional(),
  })
  .refine(
    (value) => !value.startsOn || !value.endsOn || value.startsOn <= value.endsOn,
    { message: "The start date has to be on or before the end date" }
  );

export type SeasonRow = {
  name: string;
  points: number;
  nights: number;
  wins: number;
};

export type SeasonNightInput = {
  finishedAt: string;
  standings: { name: string; totalScore: number }[];
};

/** YYYY-MM-DD when it is a real calendar day, otherwise null. */
export function parseSeasonDay(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

export function finishedDay(finishedAt: Date): string {
  return finishedAt.toISOString().slice(0, 10);
}

export function nightCountsInSeason(
  finishedAt: Date,
  startsOn: string | null,
  endsOn: string | null
): boolean {
  const day = finishedDay(finishedAt);
  if (startsOn && day < startsOn) return false;
  if (endsOn && day > endsOn) return false;
  return true;
}

/** Same letters with different caps or spacing are one player. */
export function seasonNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function standingsFromStored(
  recap: unknown,
  podium: unknown
): { name: string; totalScore: number }[] {
  const fromRecap = readStandings(recap);
  if (fromRecap.length > 0) return fromRecap;
  return readStandings(
    Array.isArray(podium) ? { standings: podium } : null
  );
}

export function buildSeasonStandings(nights: SeasonNightInput[]): SeasonRow[] {
  const ordered = [...nights].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const rows = new Map<string, SeasonRow>();
  for (const night of ordered) {
    const top = night.standings.reduce(
      (best, row) => Math.max(best, row.totalScore),
      Number.NEGATIVE_INFINITY
    );
    for (const standing of night.standings) {
      const key = seasonNameKey(standing.name);
      if (!key) continue;
      const current = rows.get(key) ?? {
        name: standing.name.trim().replace(/\s+/g, " "),
        points: 0,
        nights: 0,
        wins: 0,
      };
      current.name = standing.name.trim().replace(/\s+/g, " ");
      current.points += standing.totalScore;
      current.nights += 1;
      if (standing.totalScore === top) current.wins += 1;
      rows.set(key, current);
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name)
  );
}

function readStandings(value: unknown): { name: string; totalScore: number }[] {
  if (!value || typeof value !== "object" || !("standings" in value)) return [];
  const list = (value as { standings: unknown }).standings;
  if (!Array.isArray(list)) return [];
  const out: { name: string; totalScore: number }[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const name =
      "name" in row && typeof row.name === "string"
        ? row.name.trim().replace(/\s+/g, " ")
        : "";
    const score =
      "totalScore" in row &&
      typeof row.totalScore === "number" &&
      Number.isFinite(row.totalScore)
        ? Math.round(row.totalScore)
        : null;
    if (!name || score == null) continue;
    out.push({ name, totalScore: score });
  }
  return out;
}
