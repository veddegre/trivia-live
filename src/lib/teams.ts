import type { LeaderboardEntry } from "@/lib/types";

export function teamNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export type TeamPlayer = {
  id: string;
  name: string;
  teamId: string | null;
  teamName: string | null;
  totalScore: number;
};

/** One board row per team. Points already live on every teammate. */
export function teamLeaderboard(
  players: TeamPlayer[],
  lastPoints?: Map<string, number>
): LeaderboardEntry[] {
  const byTeam = new Map<
    string,
    { name: string; totalScore: number; members: number; lastPoints?: number }
  >();
  for (const player of players) {
    if (!player.teamId || !player.teamName) continue;
    const last = lastPoints?.get(player.id);
    const row = byTeam.get(player.teamId);
    if (!row) {
      byTeam.set(player.teamId, {
        name: player.teamName,
        totalScore: player.totalScore,
        members: 1,
        lastPoints: last,
      });
      continue;
    }
    row.members += 1;
    if (row.lastPoints == null && last != null) row.lastPoints = last;
  }
  return [...byTeam.entries()]
    .map(([playerId, row]) => ({
      playerId,
      name: row.name,
      totalScore: row.totalScore,
      lastPoints: row.lastPoints,
      members: row.members,
    }))
    .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name));
}

export function playerRoster(players: TeamPlayer[]): LeaderboardEntry[] {
  return [...players]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      totalScore: player.totalScore,
      teamName: player.teamName ?? undefined,
    }));
}
