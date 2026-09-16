/**
 * Server-authoritative scoring: correct answers only.
 * Faster answers score higher: base + timeBonus * (1 - elapsed/limit).
 */
export type QuestionBonus = "NONE" | "DOUBLE" | "LIGHTNING";

export const QUESTION_BONUS_LABEL: Record<QuestionBonus, string> = {
  NONE: "Standard",
  DOUBLE: "Double points",
  LIGHTNING: "Lightning",
};

export function isQuestionBonus(value: unknown): value is QuestionBonus {
  return value === "NONE" || value === "DOUBLE" || value === "LIGHTNING";
}

export function scoreAnswer(opts: {
  isCorrect: boolean;
  elapsedMs: number;
  timeLimitSec: number;
  basePoints: number;
  timeBonus: number;
  bonus?: QuestionBonus;
}): number {
  if (!opts.isCorrect) return 0;
  const bonus = opts.bonus ?? "NONE";
  const timeBonus = bonus === "LIGHTNING" ? 0 : opts.timeBonus;
  const limitMs = Math.max(1, opts.timeLimitSec * 1000);
  const ratio = Math.min(1, Math.max(0, opts.elapsedMs / limitMs));
  const raw = Math.round(opts.basePoints + timeBonus * (1 - ratio));
  return bonus === "DOUBLE" ? raw * 2 : raw;
}

/** Consecutive correct answers at the end of a chronological result list. */
export function trailingCorrectStreak(results: Array<boolean | null>): number {
  let n = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] === true) n += 1;
    else break;
  }
  return n;
}

/** Longest current streak of 3+ among players, if any. */
export function hottestStreak(
  players: { name: string; streak: number }[]
): { name: string; count: number } | null {
  const hot = players
    .filter((p) => p.streak >= 3)
    .sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name));
  const top = hot[0];
  return top ? { name: top.name, count: top.streak } : null;
}

export function tiedForFirst<T extends { totalScore: number }>(board: T[]): T[] {
  if (board.length === 0) return [];
  const top = board[0].totalScore;
  return board.filter((row) => row.totalScore === top);
}

export function joinWinnerNames(names: string[]): string {
  return names.filter(Boolean).join(" & ");
}

/** TV / phone chip — null when the question is standard scoring. */
export function questionBonusLabel(
  bonus?: QuestionBonus | null
): string | null {
  if (bonus === "DOUBLE" || bonus === "LIGHTNING") {
    return QUESTION_BONUS_LABEL[bonus];
  }
  return null;
}
